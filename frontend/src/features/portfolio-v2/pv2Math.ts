import type { Pv2Asset, Pv2Snapshot } from "../../types";
import { PLATFORM_COLOR } from "../../theme/domainColors";

/* Portfolio v2 — pure helpers for the One-Page block (series, summaries). */

export const RANGES = ["1w", "1m", "3m", "1y", "all"] as const;
export type Range = (typeof RANGES)[number];
export const RANGE_LABEL: Record<Range, string> = { "1w": "1W", "1m": "1M", "3m": "3M", "1y": "1Y", all: "All" };
export const DEFAULT_RANGE: Range = "3m";
/** Asset prices older than this (days) are shown as stale. */
export const STALE_DAYS = 7;

export const TYPE_LABEL: Record<string, string> = {
  Total: "Total", MutualFund: "Mutual fund", Stock: "Stock", ETF: "ETF", Crypto: "Crypto", Bond: "Bond", Other: "Other",
};

const DAY = 86_400_000;
const toTime = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
export const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);

/** First day shown for a range, relative to `today` (null = everything). */
export function rangeStart(range: Range, today: string): string | null {
  const d = new Date(`${today}T00:00:00Z`);
  switch (range) {
    case "1w": return isoDay(d.getTime() - 7 * DAY);
    case "1m": d.setUTCMonth(d.getUTCMonth() - 1); return isoDay(d.getTime());
    case "3m": d.setUTCMonth(d.getUTCMonth() - 3); return isoDay(d.getTime());
    case "1y": d.setUTCFullYear(d.getUTCFullYear() - 1); return isoDay(d.getTime());
    default: return null;
  }
}

/** Latest snapshot per asset (price date, then generation time). */
export function latestByAsset(snapshots: Pv2Snapshot[]): Record<string, Pv2Snapshot> {
  const out: Record<string, Pv2Snapshot> = {};
  for (const s of snapshots) {
    const cur = out[s.assetId];
    if (!cur || s.priceDate > cur.priceDate || (s.priceDate === cur.priceDate && s.generatedAt > cur.generatedAt)) out[s.assetId] = s;
  }
  return out;
}

/** Platforms in display order (as they first appear by asset order). */
export function platformsOf(assets: Pv2Asset[]): string[] {
  const sorted = [...assets].sort((a, b) => a.platform.localeCompare(b.platform) || a.order - b.order);
  return [...new Set(sorted.map(a => a.platform))];
}

export interface AssetRow { asset: Pv2Asset; snap: Pv2Snapshot | null; stale: boolean; }
export interface PlatformSummary {
  platform: string;
  valueEUR: number;
  share: number;
  priceDate: string | null;
  incomplete: boolean;
  /** Assets with no price yet. */
  missing: number;
  stale: number;
  rows: AssetRow[];
}

/**
 * The last snapshot, per platform: the platform's latest Total (or, before
 * one exists, the sum of its assets' latest snapshots) and each asset's
 * latest price. Sorted by value, largest first.
 */
export function summarize(assets: Pv2Asset[], snapshots: Pv2Snapshot[], today: string) {
  const latest = latestByAsset(snapshots);
  const out: PlatformSummary[] = [];
  for (const platform of platformsOf(assets)) {
    const onPlatform = assets.filter(a => a.platform === platform);
    const total = onPlatform.find(a => a.type === "Total");
    const parts = onPlatform.filter(a => a.type !== "Total" && a.active !== false)
      .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
    const rows = parts.map(asset => {
      const snap = latest[asset.assetId] ?? null;
      const stale = !!snap && (toTime(today) - toTime(snap.priceDate)) / DAY > STALE_DAYS;
      return { asset, snap, stale };
    });
    const totalSnap = total ? latest[total.assetId] : undefined;
    const summed = rows.reduce((s, r) => s + (r.snap?.valueEUR ?? 0), 0);
    const priced = rows.filter(r => r.snap);
    out.push({
      platform,
      valueEUR: totalSnap ? totalSnap.valueEUR : summed,
      share: 0,
      priceDate: totalSnap?.priceDate ?? priced.map(r => r.snap!.priceDate).sort().at(-1) ?? null,
      incomplete: totalSnap ? !!totalSnap.incomplete : priced.length < rows.length,
      missing: rows.length - priced.length,
      stale: rows.filter(r => r.stale).length,
      rows,
    });
  }
  const grand = out.reduce((s, p) => s + p.valueEUR, 0);
  out.forEach(p => { p.share = grand > 0 ? (p.valueEUR / grand) * 100 : 0; });
  out.sort((a, b) => b.valueEUR - a.valueEUR);
  const lastDate = snapshots.map(s => s.generatedAt).sort().at(-1) ?? null;
  return { platforms: out, totalEUR: grand, lastGeneratedAt: lastDate };
}

export interface SeriesPoint { date: string; t: number; Total: number | null; [platform: string]: number | null | string; }

/**
 * Portfolio value in EUR over time from the platform Totals, carried forward
 * between snapshots (a step line). A platform's line starts at its first
 * Total; the portfolio line is the sum of every platform's latest Total.
 * Within a range, the value in force at the range start is the first point.
 */
export function buildSeries(assets: Pv2Asset[], snapshots: Pv2Snapshot[], range: Range, today: string) {
  const totalOf = new Map(assets.filter(a => a.type === "Total").map(a => [a.assetId, a.platform]));
  const byPlatform: Record<string, { date: string; value: number; gen: string }[]> = {};
  for (const s of snapshots) {
    const platform = totalOf.get(s.assetId);
    if (!platform) continue;
    (byPlatform[platform] ??= []).push({ date: s.priceDate, value: s.valueEUR, gen: s.generatedAt });
  }
  Object.values(byPlatform).forEach(list => list.sort((a, b) => a.date.localeCompare(b.date) || a.gen.localeCompare(b.gen)));
  const platforms = platformsOf(assets).filter(p => byPlatform[p]?.length);

  const at = (platform: string, date: string) => {
    let v: number | null = null;
    for (const e of byPlatform[platform] ?? []) { if (e.date <= date) v = e.value; else break; }
    return v;
  };

  const start = rangeStart(range, today);
  let dates = [...new Set(Object.values(byPlatform).flat().map(e => e.date))].sort();
  if (start) {
    const before = dates.some(d => d < start);
    dates = dates.filter(d => d >= start);
    if (before && dates[0] !== start) dates.unshift(start);
  }
  // Extend the last value to today so the step line reaches the present.
  if (dates.length && dates.at(-1)! < today) dates.push(today);

  const data: SeriesPoint[] = dates.map(date => {
    const point: SeriesPoint = { date, t: toTime(date), Total: null };
    let sum = 0;
    let any = false;
    for (const p of platforms) {
      const v = at(p, date);
      point[p] = v;
      if (v != null) { sum += v; any = true; }
    }
    point.Total = any ? sum : null;
    return point;
  });
  return { data, platforms };
}

/** Change of one line between the first and the last point of the range. */
export function change(data: SeriesPoint[], key: string) {
  const vals = data.map(d => d[key]).filter((v): v is number => typeof v === "number");
  if (vals.length < 2) return null;
  const first = vals[0];
  const last = vals.at(-1)!;
  return { abs: last - first, pct: first !== 0 ? ((last - first) / first) * 100 : null };
}

/** Platform colour: the app's own for known platforms, else the series palette. */
export function platformColor(platform: string, index: number) {
  return PLATFORM_COLOR[platform] ?? `var(--series-${(index % 8) + 1})`;
}
