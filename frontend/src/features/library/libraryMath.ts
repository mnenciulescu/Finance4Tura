import type { Book } from "../../types";
import { MONTH_ABBR } from "../../utils/format";

export const SOURCES = ["Book", "Voxa", "Udemy", "Other"];
export const TYPES = ["Book", "Audiobook", "Training", "Other"];
export const STATS_MONTHS = 12;
export const PAGE = 5;
export const UNASSIGNED = "Unassigned";

/** The last N calendar months as YYYY-MM keys, current month first. */
export function recentMonths(n: number, now = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
}

export interface MonthCount { key: string; label: string; count: number; }

/** Entries completed per month over the window, oldest first — any type or source. */
export function monthlyCounts(items: Book[], monthKeys: string[]): MonthCount[] {
  const counts = new Map(monthKeys.map(k => [k, 0]));
  for (const b of items) {
    const k = (b.dateCompleted || "").slice(0, 7);
    if (counts.has(k)) counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...monthKeys].reverse().map(k => ({ key: k, label: MONTH_ABBR[Number(k.slice(5, 7)) - 1], count: counts.get(k) ?? 0 }));
}

export interface Filters { name: string; source: string; type: string; rating: string; search: string; }
export const NO_FILTERS: Filters = { name: "", source: "", type: "", rating: "", search: "" };

export function applyFilters(books: Book[], f: Filters): Book[] {
  const q = f.search.toLowerCase();
  return books.filter(b => {
    if (f.name && b.name !== f.name) return false;
    if (f.source && b.source !== f.source) return false;
    if (f.type && b.type !== f.type) return false;
    if (f.rating && String(b.rating) !== f.rating) return false;
    if (q && !(b.title || "").toLowerCase().includes(q) && !(b.author || "").toLowerCase().includes(q)) return false;
    return true;
  });
}

/** One section per person, newest first within; alphabetical, Unassigned last. */
export function sectionsOf(books: Book[], now = new Date()) {
  const keys = recentMonths(STATS_MONTHS, now);
  const byPerson = new Map<string, Book[]>();
  for (const b of books) {
    const key = b.name?.trim() || UNASSIGNED;
    if (!byPerson.has(key)) byPerson.set(key, []);
    byPerson.get(key)!.push(b);
  }
  return [...byPerson.entries()]
    .map(([person, items]) => {
      const sorted = [...items].sort((a, b) =>
        (b.dateCompleted || "").localeCompare(a.dateCompleted || "") || (a.title || "").localeCompare(b.title || ""));
      return { person, items: sorted, monthly: monthlyCounts(sorted, keys) };
    })
    .sort((a, b) => Number(a.person === UNASSIGNED) - Number(b.person === UNASSIGNED) || a.person.localeCompare(b.person));
}

/** "Show less" steps back to the previous reveal (1, 6, 11, …), so a short last page is undone exactly. */
export const previousReveal = (visible: number) => 1 + PAGE * Math.floor((visible - 2) / PAGE);
