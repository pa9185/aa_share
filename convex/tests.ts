import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ── Mutations ────────────────────────────────────────────────────────────────

export const createTestRecord = mutation({
  args: {
    pdfId: v.id("pdfs"),
    userId: v.string(),
    title: v.string(),
    questionCount: v.number(),
    shareToken: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("tests", {
      pdfId: args.pdfId,
      userId: args.userId,
      title: args.title,
      questionCount: args.questionCount,
      shareToken: args.shareToken,
      isPublic: true,
      status: "generating",
      progressMessage: "準備中...",
      createdAt: Date.now(),
    });
  },
});

export const finalizeTest = mutation({
  args: {
    testId: v.id("tests"),
    questions: v.array(
      v.object({
        id: v.string(),
        question: v.string(),
        options: v.array(v.string()),
        correctAnswer: v.number(),
        explanation: v.optional(v.string()),
      })
    ),
    tokensUsed: v.number(),
    promptTokens: v.number(),
    completionTokens: v.number(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.testId, {
      questions: args.questions,
      tokensUsed: args.tokensUsed,
      model: args.model,
      status: "ready",
      progressMessage: undefined,
      errorMessage: undefined,
    });

    // Record token usage
    const test = await ctx.db.get(args.testId);
    if (test) {
      await ctx.db.insert("tokenUsage", {
        testId: args.testId,
        userId: test.userId,
        model: args.model,
        promptTokens: args.promptTokens,
        completionTokens: args.completionTokens,
        totalTokens: args.tokensUsed,
        createdAt: Date.now(),
      });
    }
  },
});

export const setTestProgress = mutation({
  args: { testId: v.id("tests"), message: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.testId, { progressMessage: args.message });
  },
});

export const markTestError = mutation({
  args: { testId: v.id("tests"), error: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.testId, {
      status: "error",
      errorMessage: args.error,
      progressMessage: undefined,
    });
  },
});

export const deleteTest = mutation({
  args: { testId: v.id("tests"), userId: v.string() },
  handler: async (ctx, args) => {
    const test = await ctx.db.get(args.testId);
    if (!test || test.userId !== args.userId) throw new Error("不允許的操作");
    // Delete all attempts
    const attempts = await ctx.db
      .query("attempts")
      .withIndex("by_testId", (q) => q.eq("testId", args.testId))
      .collect();
    for (const attempt of attempts) {
      await ctx.db.delete(attempt._id);
    }
    await ctx.db.delete(args.testId);
  },
});

export const togglePublic = mutation({
  args: { testId: v.id("tests"), userId: v.string() },
  handler: async (ctx, args) => {
    const test = await ctx.db.get(args.testId);
    if (!test || test.userId !== args.userId) throw new Error("不允許的操作");
    await ctx.db.patch(args.testId, { isPublic: !test.isPublic });
  },
});

// ── Queries ──────────────────────────────────────────────────────────────────

export const getTest = query({
  args: { testId: v.id("tests") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.testId);
  },
});

export const getTestByShareToken = query({
  args: { shareToken: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tests")
      .withIndex("by_shareToken", (q) => q.eq("shareToken", args.shareToken))
      .first();
  },
});

export const getTestByPdfId = query({
  args: { pdfId: v.id("pdfs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("tests")
      .withIndex("by_pdfId", (q) => q.eq("pdfId", args.pdfId))
      .first();
  },
});

export const getUserTests = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    const tests = await ctx.db
      .query("tests")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
    return tests;
  },
});
