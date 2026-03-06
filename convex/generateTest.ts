"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");

function getS3Client() {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const endpoint = process.env.AWS_ENDPOINT_URL;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "S3 憑證未設定。請在 Convex 後台執行：\n" +
      "  npx convex env set AWS_ACCESS_KEY_ID     \"<key>\"\n" +
      "  npx convex env set AWS_SECRET_ACCESS_KEY \"<secret>\"\n" +
      "  npx convex env set AWS_ENDPOINT_URL      \"https://s3.p.thme.cc\"\n" +
      "  npx convex env set AWS_S3_BUCKET         \"<bucket>\"\n" +
      "  npx convex env set AWS_REGION            \"us-east-1\""
    );
  }

  return new S3Client({
    endpoint: endpoint ?? "https://s3.p.thme.cc",
    region: process.env.AWS_REGION ?? "us-east-1",
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export const generateTest = action({
  args: {
    pdfId: v.id("pdfs"),
    questionCount: v.number(),
    userId: v.string(),
    shareToken: v.string(),
    title: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    // ── 1. Create test record with "generating" status ─────────────────────
    const testId = await ctx.runMutation(api.tests.createTestRecord, {
      pdfId: args.pdfId,
      userId: args.userId,
      title: args.title,
      questionCount: args.questionCount,
      shareToken: args.shareToken,
    });

    try {
      // ── 2. Get PDF record ────────────────────────────────────────────────
      const pdf = await ctx.runQuery(api.files.getPdf, { pdfId: args.pdfId });
      if (!pdf) throw new Error("找不到 PDF 檔案");

      // ── 3. Extract text (cached in Convex to save S3 bandwidth + tokens) ─
      let text = pdf.extractedText;

      if (!text) {
        await ctx.runMutation(api.tests.setTestProgress, {
          testId,
          message: "正在從 S3 下載並解析 PDF...",
        });

        const client = getS3Client();
        const resp = await client.send(
          new GetObjectCommand({ Bucket: pdf.s3Bucket, Key: pdf.s3Key })
        );

        if (!resp.Body) throw new Error("S3 回應沒有檔案內容");
        const buffer = await streamToBuffer(resp.Body as NodeJS.ReadableStream);
        const parsed = await pdfParse(buffer);
        text = parsed.text as string;

        // Clean & truncate before caching – this truncated version is what
        // every future generation for this PDF will use, guaranteeing consistent
        // token costs and avoiding re-downloading from S3.
        text = text
          .replace(/\n{3,}/g, "\n\n")
          .replace(/[ \t]{2,}/g, " ")
          .trim()
          .slice(0, 18000); // ≈ 4 500 tokens – good balance of depth vs cost

        await ctx.runMutation(api.files.updatePdfText, {
          pdfId: args.pdfId,
          text,
        });
      }

      // ── 4. Call OpenRouter ───────────────────────────────────────────────
      await ctx.runMutation(api.tests.setTestProgress, {
        testId,
        message: "AI 正在生成題目，請稍候...",
      });

      // Default to a paid model that works without OpenRouter data-sharing settings.
      // Free models (suffix ":free" or google/gemini-flash-1.5 without ":free")
      // require "Allow free model publication" in https://openrouter.ai/settings/privacy
      const model = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) throw new Error("未設定 OPENROUTER_API_KEY");

      // Keep the prompt concise – every token costs money
      const prompt =
        `根據以下文本生成 ${args.questionCount} 道繁體中文選擇題，` +
        `每題 4 個選項（A/B/C/D），1 個正確答案。` +
        `只輸出 JSON，不要 markdown 或任何額外文字：\n` +
        `{"questions":[{"question":"...","options":["...","...","...","..."],"correctAnswer":0,"explanation":"..."}]}\n` +
        `correctAnswer 為正確答案的索引（0=A,1=B,2=C,3=D）。\n\n文本：\n${text}`;

      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer":
              process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
            "X-Title": "Quiz Practice Platform",
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content: prompt }],
            temperature: 0.6,
            max_tokens: 4096,
          }),
        }
      );

      // Always consume body as text first – response.json() itself throws
      // "Unexpected end of JSON input" when the body is empty or truncated,
      // which bypasses any outer try/catch.
      const responseText = await response.text();

      if (!response.ok) {
        let hint = "";
        if (
          responseText.includes("data policy") ||
          responseText.includes("Free model publication")
        ) {
          hint =
            " | 解決：前往 https://openrouter.ai/settings/privacy 啟用「Allow free model publication」，或改用付費模型：npx convex env set OPENROUTER_MODEL \"openai/gpt-4o-mini\"";
        }
        throw new Error(
          `OpenRouter HTTP ${response.status}: ${responseText.slice(0, 400)}${hint}`
        );
      }

      // Parse the outer OpenRouter envelope
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(
          `OpenRouter 回應非 JSON (HTTP ${response.status})，前 300 字：${responseText.slice(0, 300)}`
        );
      }

      const rawContent: string = data.choices?.[0]?.message?.content ?? "";

      if (!rawContent.trim()) {
        throw new Error(
          `AI 回傳空白內容。模型：${model}，finish_reason：${data.choices?.[0]?.finish_reason ?? "unknown"}`
        );
      }

      // Strip markdown fences some models wrap responses in
      const jsonStr = rawContent
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/i, "")
        .trim();

      let parsed: { questions: Array<{ question: string; options: string[]; correctAnswer: number; explanation?: string }> };
      try {
        parsed = JSON.parse(jsonStr);
      } catch {
        throw new Error(
          `AI 回傳非有效 JSON。前 300 字：${jsonStr.slice(0, 300)}`
        );
      }

      if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
        throw new Error("AI 回傳格式不正確，請重試");
      }

      const questions = parsed.questions.map((q, i) => ({
        id: `q${i}`,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation ?? "",
      }));

      const usage = data.usage ?? {};

      // ── 5. Persist & record token usage ─────────────────────────────────
      await ctx.runMutation(api.tests.finalizeTest, {
        testId,
        questions,
        tokensUsed: usage.total_tokens ?? 0,
        promptTokens: usage.prompt_tokens ?? 0,
        completionTokens: usage.completion_tokens ?? 0,
        model,
      });

      return testId;
    } catch (err) {
      await ctx.runMutation(api.tests.markTestError, {
        testId,
        error: String(err),
      });
      throw err;
    }
  },
});
