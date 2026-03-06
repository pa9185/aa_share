import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// ── Mutations ────────────────────────────────────────────────────────────────

export const createAttempt = mutation({
  args: {
    testId: v.id("tests"),
    userId: v.string(),
    answers: v.array(v.number()),
    score: v.number(),
    totalQuestions: v.number(),
    timeSpent: v.optional(v.number()),
    shareToken: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("attempts", {
      testId: args.testId,
      userId: args.userId,
      answers: args.answers,
      score: args.score,
      totalQuestions: args.totalQuestions,
      timeSpent: args.timeSpent,
      shareToken: args.shareToken,
      completedAt: Date.now(),
    });
  },
});

// ── Queries ──────────────────────────────────────────────────────────────────

export const getAttempt = query({
  args: { attemptId: v.id("attempts") },
  handler: async (ctx, args) => ctx.db.get(args.attemptId),
});

export const getAttemptByShareToken = query({
  args: { shareToken: v.string() },
  handler: async (ctx, args) =>
    ctx.db
      .query("attempts")
      .withIndex("by_shareToken", (q) => q.eq("shareToken", args.shareToken))
      .first(),
});

export const getTestAttempts = query({
  args: { testId: v.id("tests") },
  handler: async (ctx, args) =>
    ctx.db
      .query("attempts")
      .withIndex("by_testId", (q) => q.eq("testId", args.testId))
      .order("desc")
      .collect(),
});

export const getUserAttempts = query({
  args: { userId: v.string() },
  handler: async (ctx, args) =>
    ctx.db
      .query("attempts")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(50),
});

export const getBestAttempt = query({
  args: { testId: v.id("tests"), userId: v.string() },
  handler: async (ctx, args) => {
    const attempts = await ctx.db
      .query("attempts")
      .withIndex("by_testId", (q) => q.eq("testId", args.testId))
      .collect();
    const mine = attempts.filter((a) => a.userId === args.userId);
    if (mine.length === 0) return null;
    return mine.reduce((best, curr) =>
      curr.score > best.score ? curr : best
    );
  },
});
