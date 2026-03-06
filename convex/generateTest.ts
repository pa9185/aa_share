"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";
import { api } from "./_generated/api";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require("pdf-parse");

// ── S3 用戶端 ──────────────────────────────────────────────────────────────

function getS3Client() {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "S3 憑證未設定。請在 Convex 後台執行：\n" +
      "  npx convex env set AWS_ACCESS_KEY_ID     \"<金鑰>\"\n" +
      "  npx convex env set AWS_SECRET_ACCESS_KEY \"<密鑰>\"\n" +
      "  npx convex env set AWS_ENDPOINT_URL      \"https://s3.p.thme.cc\"\n" +
      "  npx convex env set AWS_S3_BUCKET         \"<儲存桶名稱>\"\n" +
      "  npx convex env set AWS_REGION            \"us-east-1\""
    );
  }
  return new S3Client({
    endpoint: process.env.AWS_ENDPOINT_URL ?? "https://s3.p.thme.cc",
    region: process.env.AWS_REGION ?? "us-east-1",
    forcePathStyle: true,
    credentials: { accessKeyId, secretAccessKey },
  });
}

// ── 工具函式 ───────────────────────────────────────────────────────────────

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/** 安全解析 JSON，失敗時拋出含原始內容的 Error（而非原生 SyntaxError）。 */
function safeJsonParse<T>(raw: string, context: string): T {
  if (!raw.trim()) {
    throw new Error(`${context}：回應內容為空`);
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new Error(`${context}：非有效 JSON。內容前 300 字：${raw.slice(0, 300)}`);
  }
}

// ── 主要 Action ────────────────────────────────────────────────────────────

export const generateTest = action({
  args: {
    pdfId: v.id("pdfs"),
    questionCount: v.number(),
    userId: v.string(),
    shareToken: v.string(),
    title: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    // 先建立考題記錄（狀態：生成中）
    const testId = await ctx.runMutation(api.tests.createTestRecord, {
      pdfId: args.pdfId,
      userId: args.userId,
      title: args.title,
      questionCount: args.questionCount,
      shareToken: args.shareToken,
    });

    try {
      // ── 1. 取得 PDF 資料 ────────────────────────────────────────────────
      const pdf = await ctx.runQuery(api.files.getPdf, { pdfId: args.pdfId });
      if (!pdf) throw new Error("找不到 PDF 檔案");

      // ── 2. 擷取文字（快取於 Convex，避免重複下載 S3）──────────────────
      let text = pdf.extractedText ?? "";

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

        // pdf-parse 在解析部分 PDF 的 XMP metadata 時會拋出 SyntaxError，
        // 明確包住並轉換為 Error，防止原生 SyntaxError 向上傳播。
        let pdfData: { text: string };
        try {
          pdfData = await Promise.resolve(pdfParse(buffer));
        } catch (pdfErr: unknown) {
          const msg = pdfErr instanceof Error ? pdfErr.message : String(pdfErr);
          throw new Error(`PDF 解析失敗，請確認檔案未損毀：${msg}`);
        }

        // 清理並截斷：快取後所有後續生成皆沿用此版本，確保 token 一致
        text = (pdfData.text ?? "")
          .replace(/\n{3,}/g, "\n\n")
          .replace(/[ \t]{2,}/g, " ")
          .trim()
          .slice(0, 18000); // 約 4500 tokens

        if (!text) throw new Error("PDF 擷取的文字為空，可能是掃描版圖片 PDF，目前不支援");

        await ctx.runMutation(api.files.updatePdfText, {
          pdfId: args.pdfId,
          text,
        });
      }

      // ── 3. 呼叫 OpenRouter ──────────────────────────────────────────────
      await ctx.runMutation(api.tests.setTestProgress, {
        testId,
        message: "AI 正在生成題目，請稍候...",
      });

      // 預設付費模型，無需 OpenRouter 開啟資料分享設定
      const model = process.env.OPENROUTER_MODEL ?? "openai/gpt-4o-mini";
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) throw new Error("未設定 OPENROUTER_API_KEY");

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
            "HTTP-Referer": process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
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

      // 務必先讀 text()，永不呼叫 response.json()：
      // response.json() 在內容為空時拋出原生 SyntaxError，無法被 catch 正確攔截
      const responseText = await response.text();

      if (!response.ok) {
        let hint = "";
        if (responseText.includes("data policy") || responseText.includes("Free model")) {
          hint =
            "\n解決方式：前往 https://openrouter.ai/settings/privacy 啟用「Allow free model publication」" +
            "，或改用付費模型：npx convex env set OPENROUTER_MODEL \"openai/gpt-4o-mini\"";
        }
        throw new Error(
          `OpenRouter 請求失敗（狀態碼 ${response.status}）：${responseText.slice(0, 400)}${hint}`
        );
      }

      // ── 4. 解析 AI 回應 ─────────────────────────────────────────────────
      type OpenRouterResponse = {
        choices: Array<{ message: { content: string }; finish_reason: string }>;
        usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      };
      const data = safeJsonParse<OpenRouterResponse>(responseText, "OpenRouter 外層回應");

      const rawContent = data.choices?.[0]?.message?.content ?? "";
      if (!rawContent.trim()) {
        throw new Error(
          `AI 回傳空白內容。模型：${model}，結束原因：${data.choices?.[0]?.finish_reason ?? "未知"}`
        );
      }

      // 移除部分模型加上的 markdown 程式碼區塊標記
      const jsonStr = rawContent
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/i, "")
        .trim();

      type QuestionsPayload = {
        questions: Array<{
          question: string;
          options: string[];
          correctAnswer: number;
          explanation?: string;
        }>;
      };
      const parsed = safeJsonParse<QuestionsPayload>(jsonStr, "AI 題目 JSON");

      if (!Array.isArray(parsed.questions) || parsed.questions.length === 0) {
        throw new Error(`AI 回傳的題目格式不正確，請重試。原始內容：${jsonStr.slice(0, 200)}`);
      }

      const questions = parsed.questions.map((q, i) => ({
        id: `q${i}`,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation ?? "",
      }));

      // ── 5. 儲存題目並記錄 token 使用量 ────────────────────────────────
      const usage = data.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
      await ctx.runMutation(api.tests.finalizeTest, {
        testId,
        questions,
        tokensUsed: usage.total_tokens,
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        model,
      });

      return testId;
    } catch (err: unknown) {
      // 永遠拋出 new Error（而非原始錯誤物件），
      // 避免 Convex 把 SyntaxError 之類的原生錯誤標示為「Uncaught」
      const message = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(api.tests.markTestError, {
        testId,
        error: message,
      });
      throw new Error(message);
    }
  },
});
