import type { Pv2Usage } from "../../types";

/**
 * List prices in USD per million tokens (Anthropic pricing page, Nov 2026);
 * cache writes are 5-minute writes (1.25 × input). Haiku 5.5's rate for
 * prompts of 100K tokens or fewer. Web search: $10 per 1,000; web fetch has
 * no charge beyond its tokens. An estimate, not the bill.
 */
const PRICES: Record<string, { input: number; cacheRead: number; cacheWrite: number; output: number }> = {
  "claude-opus-5-5": { input: 4, cacheRead: 0.2, cacheWrite: 5, output: 20 },
  "claude-sonnet-5-5": { input: 2, cacheRead: 0.1, cacheWrite: 2.5, output: 10 },
  "claude-haiku-5-5": { input: 0.1, cacheRead: 0.01, cacheWrite: 0.125, output: 0.5 },
};
const SEARCH_USD = 10 / 1000;

/** Estimated USD cost of the usage on `model`, or null for a model without a price here. */
export function estimateCost(model: string, u: Partial<Pv2Usage> | undefined): number | null {
  const p = PRICES[model];
  if (!p || !u) return null;
  const m = 1_000_000;
  return ((u.inputTokens ?? 0) * p.input + (u.cacheReadTokens ?? 0) * p.cacheRead
    + (u.cacheWriteTokens ?? 0) * p.cacheWrite + (u.outputTokens ?? 0) * p.output) / m
    + (u.webSearches ?? 0) * SEARCH_USD;
}

export const totalTokens = (u: Partial<Pv2Usage> | undefined) =>
  (u?.inputTokens ?? 0) + (u?.cacheReadTokens ?? 0) + (u?.cacheWriteTokens ?? 0) + (u?.outputTokens ?? 0);

export const fmtUsd = (v: number) => `$${v < 0.1 ? v.toFixed(3) : v.toFixed(2)}`;
