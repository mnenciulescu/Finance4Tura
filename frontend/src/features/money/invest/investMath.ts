import dayjs from "dayjs";
import { PLATFORMS } from "../../../theme/domainColors";
import { toEUR } from "../../../utils/money";
import type { FxMatrix, Operation, Snapshot } from "../../../types";

/** The evolution chart never plots anything before this month. */
export const CHART_START = "2023-01";
/** Snapshots / operations lists reveal this many entries at a time. */
export const PAGE_STEP = 3;

export const PLATFORM_CURRENCY: Record<string, "USD" | "EUR" | "RON"> = {
  "eToro": "USD",
  "Binance": "USD",
  "Fidelity": "USD",
  "Tradeville": "USD",
  "ING Funds RON": "RON",
  "ING Funds EUR": "EUR",
};

export interface ChartPoint {
  date: string;
  x: number;
  portfolio: number | null;
  cashFlow: number | null;
  hasOp: boolean;
  ops: Operation[];
  [platform: string]: unknown;
}

/**
 * Portfolio evolution, month by month: the latest snapshot per platform is
 * carried forward. Snapshots before CHART_START still feed the carry-forward,
 * but the plotted range starts there (or at the earliest data if later).
 */
export function buildChart(snapshots: Snapshot[], operations: Operation[], rates: FxMatrix | null) {
  const inEUR = snapshots.map(s => ({ ...s, amount: toEUR(s.amount, s.currency, rates), currency: "EUR" as const }));
  const allMonths = [...inEUR.map(s => s.date.slice(0, 7)), ...operations.map(op => op.date.slice(0, 7))];
  if (allMonths.length === 0) return { data: [] as ChartPoint[], years: [] as string[], xMax: 0 };
  const earliest = allMonths.reduce((min, m) => (m < min ? m : min));
  const startMonth = earliest < CHART_START ? CHART_START : earliest;
  const endMonth = allMonths.reduce((max, m) => (m > max ? m : max));
  if (endMonth < startMonth) return { data: [] as ChartPoint[], years: [] as string[], xMax: 0 };

  const months: string[] = [];
  let cur = dayjs(`${startMonth}-01`);
  const end = dayjs(`${endMonth}-01`);
  while (!cur.isAfter(end)) { months.push(cur.format("YYYY-MM")); cur = cur.add(1, "month"); }
  const years = [...new Set(months.map(m => m.slice(0, 4)))].sort();
  const baseYear = parseInt(years[0] ?? String(new Date().getFullYear()), 10);
  const dateToX = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    const t = new Date(y, m - 1, d).getTime();
    const ys = new Date(y, 0, 1).getTime();
    const ye = new Date(y + 1, 0, 1).getTime();
    return (y - baseYear) + (t - ys) / (ye - ys);
  };

  const byPlatform: Record<string, typeof inEUR> = {};
  inEUR.forEach(s => { (byPlatform[s.platform] ??= []).push(s); });
  Object.values(byPlatform).forEach(arr => arr.sort((a, b) => a.date.localeCompare(b.date)));

  const platformAt = (platform: string, month: string): number | null => {
    const endOfMonth = `${month}-31`;
    let latest: (typeof inEUR)[number] | null = null;
    for (const s of byPlatform[platform] ?? []) { if (s.date <= endOfMonth) latest = s; else break; }
    return latest && latest.amount > 0 ? parseFloat(latest.amount.toFixed(2)) : null;
  };
  const portfolioAt = (month: string) => {
    const total = PLATFORMS.reduce((sum, p) => sum + (platformAt(p, month) ?? 0), 0);
    return total > 0 ? parseFloat(total.toFixed(2)) : null;
  };

  const cashByMonth: Record<string, number> = {};
  operations.forEach(op => {
    const m = op.date.slice(0, 7);
    const eur = toEUR(op.amount, op.currency, rates);
    cashByMonth[m] = (cashByMonth[m] ?? 0) + (op.type === "Withdrawal" ? -eur : eur);
  });
  const opMonths = new Set(operations.map(op => op.date.slice(0, 7)));

  const data: ChartPoint[] = months.map(m => ({
    date: m,
    x: dateToX(`${m}-01`),
    portfolio: portfolioAt(m),
    ...Object.fromEntries(PLATFORMS.map(p => [p, platformAt(p, m)])),
    cashFlow: opMonths.has(m) ? (cashByMonth[m] ?? 0) : null,
    hasOp: opMonths.has(m),
    ops: operations.filter(op => op.date.slice(0, 7) === m),
  }));
  return { data, years, xMax: data.at(-1)?.x ?? years.length };
}

/** Snapshots grouped by date, newest first, with the carry-forward EUR total as of that date. */
export function groupSnapshots(snapshots: Snapshot[], rates: FxMatrix | null) {
  const inEUR = snapshots.map(s => ({ ...s, eur: toEUR(s.amount, s.currency, rates) }));
  const byDate: Record<string, Snapshot[]> = {};
  snapshots.forEach(s => { (byDate[s.date] ??= []).push(s); });
  Object.values(byDate).forEach(arr =>
    arr.sort((a, b) => PLATFORMS.indexOf(a.platform as never) - PLATFORMS.indexOf(b.platform as never)));
  const totalAt = (date: string) => PLATFORMS.reduce((sum, p) => {
    const latest = inEUR.filter(s => s.platform === p && s.date <= date).sort((a, b) => b.date.localeCompare(a.date))[0];
    return sum + (latest?.eur ?? 0);
  }, 0);
  return Object.keys(byDate).sort().reverse().map(date => ({ date, rows: byDate[date], totalEUR: totalAt(date) }));
}
