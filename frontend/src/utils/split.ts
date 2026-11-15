import type { Occurrence, SplitPayment } from "../types";

// Split-payment slot rules, shared by Today and Money → Split.

export const MAX_OCCURRENCES = 36;

export const isFilled = (o: Occurrence | undefined | null) => o != null && o.value !== "" && o.value != null;

const num = (v: unknown) => { const n = parseFloat(String(v)); return Number.isFinite(n) ? n : 0; };
export const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Exactly `occurrenceCount` slots, every time. The count belongs to the series
 * and is set on create or edit; a short or long stored array is padded or
 * trimmed here rather than silently changing how many slots there are.
 */
export function normOccs(entry: Pick<SplitPayment, "occurrenceCount" | "occurrences">): Occurrence[] {
  const src = entry.occurrences ?? [];
  const count = entry.occurrenceCount || 0;
  return Array.from({ length: count }, (_, i) => ({ index: i, value: src[i]?.value ?? "" }));
}

export function splitStats(entry: SplitPayment) {
  const occs = normOccs(entry);
  const paid = occs.filter(isFilled).length;
  const covered = entry.occurrenceType === "amount" ? occs.reduce((sum, o) => sum + num(o.value), 0) : 0;
  return {
    occs,
    paid,
    count: occs.length,
    covered,
    remaining: Math.max(0, round2(Number(entry.totalAmount || 0) - covered)),
    complete: occs.length > 0 && paid === occs.length,
  };
}

/** Fill every empty amount slot with an even split; the last absorbs the rounding rest. */
export function coverRest(entry: SplitPayment, occs: Occurrence[]): Occurrence[] {
  const covered = occs.reduce((sum, o) => sum + num(o.value), 0);
  const empty = occs.map((o, i) => (isFilled(o) ? -1 : i)).filter(i => i >= 0);
  if (empty.length === 0) return occs;
  const total = Number(entry.totalAmount || 0);
  const each = Math.max(0, round2((total - covered) / empty.length));
  const next = [...occs];
  let used = 0;
  empty.forEach((i, k) => {
    const last = k === empty.length - 1;
    const value = last ? Math.max(0, round2(total - covered - used)) : each;
    used += value;
    next[i] = { ...next[i], value: String(value) };
  });
  return next;
}

/** Newest createdDate first. */
export const byCreatedDesc = (a: SplitPayment, b: SplitPayment) =>
  (b.createdDate || "").localeCompare(a.createdDate || "");

/**
 * In progress vs settled, newest first. An entry awaiting the "Mark as
 * settled?" answer (`pendingId`) stays in progress.
 */
export function splitGroups(entries: SplitPayment[], pendingId: string | null) {
  const sorted = [...entries].sort(byCreatedDesc);
  const isOpen = (e: SplitPayment) => !splitStats(e).complete || e.splitPaymentId === pendingId;
  return { open: sorted.filter(isOpen), done: sorted.filter(e => !isOpen(e)) };
}

/** What is left to cover on open amount entries, per currency (> 0 only). */
export function outstandingByCurrency(open: SplitPayment[]): [string, number][] {
  const acc: Record<string, number> = {};
  open.forEach(e => {
    if (e.occurrenceType !== "amount") return;
    acc[e.currency] = round2((acc[e.currency] ?? 0) + splitStats(e).remaining);
  });
  return Object.entries(acc).filter(([, v]) => v > 0);
}
