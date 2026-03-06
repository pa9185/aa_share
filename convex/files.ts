// Pure DB operations – no S3 SDK needed here.
// S3 uploads happen in the Next.js API route (app/api/upload/route.ts).
// S3 downloads (for text extraction) happen in convex/generateTest.ts.

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ── Mutations ────────────────────────────────────────────────────────────────

export const createPdf = mutation({
  args: {
    userId: v.string(),
    fileName: v.string(),
    fileSize: v.number(),
    s3Key: v.string(),
    s3Bucket: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("pdfs", {
      userId: args.userId,
      fileName: args.fileName,
      fileSize: args.fileSize,
      s3Key: args.s3Key,
      s3Bucket: args.s3Bucket,
      status: "ready",
      createdAt: Date.now(),
    });
  },
});

export const updatePdfText = mutation({
  args: { pdfId: v.id("pdfs"), text: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.pdfId, { extractedText: args.text });
  },
});

export const deletePdf = mutation({
  args: { pdfId: v.id("pdfs"), userId: v.string() },
  handler: async (ctx, args) => {
    const pdf = await ctx.db.get(args.pdfId);
    if (!pdf || pdf.userId !== args.userId) throw new Error("不允許的操作");
    await ctx.db.delete(args.pdfId);
  },
});

// ── Queries ──────────────────────────────────────────────────────────────────

export const getPdf = query({
  args: { pdfId: v.id("pdfs") },
  handler: async (ctx, args) => ctx.db.get(args.pdfId),
});

export const getUserPdfs = query({
  args: { userId: v.string() },
  handler: async (ctx, args) =>
    ctx.db
      .query("pdfs")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect(),
});
