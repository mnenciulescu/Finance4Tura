import type { FxMatrix, Snapshot } from "../types";
import dayjs from "dayjs";
import { PLATFORMS } from "../theme/domainColors";

/**
 * Converts to EUR with the stored FX matrix: rates[FROM][TO], so
 * rates[currency].EUR is the value of 1 CUR in EUR. Falls back to the legacy
 * flat form (base EUR, rates.USD = 1 EUR in USD).
 */
export function toEUR(amount: number, currency: string | undefined, rates: FxMatrix | null | undefined): number {
  if (!rates || !currency || currency === "EUR") return amount;
  const row = rates[currency];
  if (row && typeof row === "object" && row.EUR != null) return amount * row.EUR;
  if (typeof row === "number") return amount / row;
  return amount;
}

/** Latest snapshot per platform. */
export function latestByPlatform(snapshots: Snapshot[]): Record<string, Snapshot> {
  const out: Record<string, Snapshot> = {};
  for (const s of snapshots) {
    if (!out[s.platform] || s.date > out[s.platform].date) out[s.platform] = s;
  }
  return out;
}

/** Platforms with a snapshot > 0 in the last 12 months. */
export function activePlatforms(snapshots: Snapshot[]): string[] {
  const iso = dayjs().subtract(12, "month").format("YYYY-MM-DD");
  return PLATFORMS.filter(p => snapshots.some(s => s.platform === p && s.date >= iso && s.amount > 0));
}

/** Total of the latest snapshot per platform, in EUR. */
export function portfolioTotalEUR(snapshots: Snapshot[], rates: FxMatrix | null | undefined): number {
  return Object.values(latestByPlatform(snapshots))
    .reduce((sum, s) => sum + toEUR(s.amount, s.currency, rates), 0);
}
