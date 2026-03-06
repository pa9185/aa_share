import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  pdfs: defineTable({
    userId: v.string(),
    fileName: v.string(),
    fileSize: v.number(),
    s3Key: v.string(),       // S3 object key
    s3Bucket: v.string(),    // S3 bucket name
    extractedText: v.optional(v.string()),
    status: v.string(), // "uploading" | "ready" | "error"
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_s3Key", ["s3Key"]),

  tests: defineTable({
    pdfId: v.id("pdfs"),
    userId: v.string(),
    title: v.string(),
    questions: v.optional(
      v.array(
        v.object({
          id: v.string(),
          question: v.string(),
          options: v.array(v.string()),
          correctAnswer: v.number(),
          explanation: v.optional(v.string()),
        })
      )
    ),
    shareToken: v.string(),
    isPublic: v.boolean(),
    tokensUsed: v.optional(v.number()),
    questionCount: v.number(),
    status: v.string(), // "generating" | "ready" | "error"
    progressMessage: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    model: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_shareToken", ["shareToken"])
    .index("by_pdfId", ["pdfId"])
    .index("by_createdAt", ["createdAt"]),

  attempts: defineTable({
    testId: v.id("tests"),
    userId: v.string(),
    answers: v.array(v.number()), // -1 = unanswered
    score: v.number(),
    totalQuestions: v.number(),
    timeSpent: v.optional(v.number()), // seconds
    shareToken: v.string(),
    completedAt: v.number(),
  })
    .index("by_testId", ["testId"])
    .index("by_userId", ["userId"])
    .index("by_shareToken", ["shareToken"]),

  tokenUsage: defineTable({
    testId: v.id("tests"),
    userId: v.string(),
    model: v.string(),
    promptTokens: v.number(),
    completionTokens: v.number(),
    totalTokens: v.number(),
    createdAt: v.number(),
  })
    .index("by_createdAt", ["createdAt"])
    .index("by_testId", ["testId"]),
});
