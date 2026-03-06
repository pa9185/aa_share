import { NextRequest, NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

function getS3Client() {
  return new S3Client({
    region: process.env.AWS_REGION ?? "ap-northeast-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const userId = formData.get("userId") as string | null;

    if (!file || !userId) {
      return NextResponse.json({ error: "缺少檔案或使用者 ID" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "只接受 PDF 格式" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "檔案大小不能超過 20 MB" }, { status: 400 });
    }

    // ── Upload to S3 ──────────────────────────────────────────────────────────
    const bucket = process.env.AWS_S3_BUCKET!;
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const s3Key = `pdfs/${userId}/${Date.now()}-${safeFileName}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const s3 = getS3Client();
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        Body: buffer,
        ContentType: "application/pdf",
        // Do NOT set ACL – modern S3 buckets use bucket-level policies instead.
      })
    );

    // ── Create PDF record in Convex ───────────────────────────────────────────
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const pdfId = await convex.mutation(api.files.createPdf, {
      userId,
      fileName: file.name,
      fileSize: file.size,
      s3Key,
      s3Bucket: bucket,
    });

    return NextResponse.json({ pdfId, s3Key });
  } catch (err) {
    console.error("[upload] error:", err);
    return NextResponse.json(
      { error: "上傳失敗，請稍後再試" },
      { status: 500 }
    );
  }
}

export const config = {
  api: { bodyParser: false },
};
