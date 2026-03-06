import { v } from "convex/values";
import { query } from "./_generated/server";

// All admin queries – protect via ADMIN_SECRET checked in Next.js middleware/page

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const [pdfs, tests, attempts, tokens] = await Promise.all([
      ctx.db.query("pdfs").collect(),
      ctx.db.query("tests").collect(),
      ctx.db.query("attempts").collect(),
      ctx.db.query("tokenUsage").collect(),
    ]);

    const totalTokens = tokens.reduce((s, t) => s + t.totalTokens, 0);
    const promptTokens = tokens.reduce((s, t) => s + t.promptTokens, 0);
    const completionTokens = tokens.reduce(
      (s, t) => s + t.completionTokens,
      0
    );

    const readyTests = tests.filter((t) => t.status === "ready").length;
    const errorTests = tests.filter((t) => t.status === "error").length;

    return {
      totalPdfs: pdfs.length,
      totalTests: tests.length,
      readyTests,
      errorTests,
      totalAttempts: attempts.length,
      totalTokens,
      promptTokens,
      completionTokens,
    };
  },
});

export const getAllTests = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const tests = await ctx.db
      .query("tests")
      .withIndex("by_createdAt")
      .order("desc")
      .take(args.limit ?? 50);

    return tests;
  },
});

export const getTokenUsageHistory = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return ctx.db
      .query("tokenUsage")
      .withIndex("by_createdAt")
      .order("desc")
      .take(args.limit ?? 100);
  },
});

export const getModelBreakdown = query({
  args: {},
  handler: async (ctx) => {
    const records = await ctx.db.query("tokenUsage").collect();
    const breakdown: Record<
      string,
      { count: number; totalTokens: number }
    > = {};
    for (const r of records) {
      if (!breakdown[r.model]) {
        breakdown[r.model] = { count: 0, totalTokens: 0 };
      }
      breakdown[r.model].count++;
      breakdown[r.model].totalTokens += r.totalTokens;
    }
    return breakdown;
  },
});

export const verifyAdminSecret = query({
  args: { secret: v.string() },
  handler: async (_ctx, args) => {
    const expected = process.env.ADMIN_SECRET;
    if (!expected) return false;
    return args.secret === expected;
  },
});
