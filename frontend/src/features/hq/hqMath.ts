import type { HqEntry, HqTemplate } from "../../types";
import { MONTH_ABBR } from "../../utils/format";

// Water-meter logic carried over from Headquarters/DashboardTab + LocationTab.

export function findParamId(template: HqTemplate, ...titles: string[]): string | null {
  const params = template.parameters || [];
  for (const title of titles) {
    const p = params.find(x => x.title.trim() === title.trim());
    if (p?.parameterId) return p.parameterId;
  }
  return null;
}

export function waterIds(template: HqTemplate) {
  return {
    baieRece: findParamId(template, "Baie - Apa Rece"),
    bucRece: findParamId(template, "Bucatarie - Apa Rece", "Bucatarie  - Apa Rece"),
    baieCalda: findParamId(template, "Baie - Apa Calda"),
    bucCalda: findParamId(template, "Bucatarie - Apa Calda", "Bucatarie  - Apa Calda"),
  };
}

export function isWaterTemplate(t: HqTemplate) {
  const w = waterIds(t);
  return !!(w.baieRece && w.bucRece && w.baieCalda && w.bucCalda);
}

export function numValue(entry: HqEntry, id: string | null): number | null {
  if (!id) return null;
  const v = (entry.values || []).find(x => x.parameterId === id)?.value;
  if (v === null || v === undefined || v === "") return null;
  return Number(v);
}

const fmtMonth = (iso: string) => `${MONTH_ABBR[Number(iso.slice(5, 7)) - 1]} '${iso.slice(2, 4)}`;

/** Monthly consumption between consecutive readings, last three years. */
export function waterChartData(template: HqTemplate, entries: HqEntry[], now = new Date()) {
  const w = waterIds(template);
  const cutoff = new Date(now);
  cutoff.setFullYear(cutoff.getFullYear() - 3);
  const threeYearsAgo = cutoff.toISOString().slice(0, 10);
  const all = entries.filter(e => e.templateId === template.templateId).sort((a, b) => a.date.localeCompare(b.date));
  if (all.length < 2) return [];
  const firstIn = all.findIndex(e => e.date >= threeYearsAgo);
  const start = firstIn <= 0 ? 1 : firstIn;
  const out: { label: string; apaRece: number; apaCalda: number }[] = [];
  for (let i = start; i < all.length; i++) {
    const curr = all[i];
    const prev = all[i - 1];
    if (curr.date < threeYearsAgo) continue;
    const days = (new Date(curr.date).getTime() - new Date(prev.date).getTime()) / 86400000;
    if (days <= 0) continue;
    const sum = (e: HqEntry, a: string | null, b: string | null) => (numValue(e, a) ?? 0) + (numValue(e, b) ?? 0);
    out.push({
      label: fmtMonth(curr.date),
      apaRece: Math.round(((sum(curr, w.baieRece, w.bucRece) - sum(prev, w.baieRece, w.bucRece)) / days) * 30 * 100) / 100,
      apaCalda: Math.round(((sum(curr, w.baieCalda, w.bucCalda) - sum(prev, w.baieCalda, w.bucCalda)) / days) * 30 * 100) / 100,
    });
  }
  return out;
}

export interface ComputedColumn { title: string; ids: string[]; }

export function computedColumns(template: HqTemplate): ComputedColumn[] {
  const w = waterIds(template);
  const cols: ComputedColumn[] = [];
  if (w.baieRece && w.bucRece) cols.push({ title: "Consum Apa Rece", ids: [w.baieRece, w.bucRece] });
  if (w.baieCalda && w.bucCalda) cols.push({ title: "Consum Apa Calda", ids: [w.baieCalda, w.bucCalda] });
  return cols;
}

/** { entryId: { columnTitle: monthly average } } — consumption since the previous reading. */
export function computedValues(entries: HqEntry[], cols: ComputedColumn[]): Record<string, Record<string, number>> {
  if (cols.length === 0) return {};
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const out: Record<string, Record<string, number>> = {};
  for (let i = 0; i < sorted.length; i++) {
    const curr = sorted[i];
    out[curr.entryId] = {};
    if (i === 0) continue;
    const prev = sorted[i - 1];
    const days = (new Date(curr.date).getTime() - new Date(prev.date).getTime()) / 86400000;
    if (days <= 0) continue;
    for (const col of cols) {
      const s = (e: HqEntry) => col.ids.reduce((acc, id) => { const v = numValue(e, id); return v !== null ? acc + v : acc; }, 0);
      out[curr.entryId][col.title] = Math.round(((s(curr) - s(prev)) / days) * 30 * 100) / 100;
    }
  }
  return out;
}

/** The meter-reading SMS for water templates (latest entry), or null. */
export function smsText(template: HqTemplate, entriesNewestFirst: HqEntry[]): string | null {
  const w = waterIds(template);
  if (!w.baieRece || !w.baieCalda || !w.bucRece || !w.bucCalda) return null;
  const latest = entriesNewestFirst[0];
  if (!latest) return null;
  const v = (id: string) => numValue(latest, id) ?? "—";
  return `Nenciulescu - Sc. 6, Ap. 68\nIndexi:\n- Baie Rece: ${v(w.baieRece)}\n- Baie Calda: ${v(w.baieCalda)}\n- Bucatarie Rece: ${v(w.bucRece)}\n- Bucatarie Calda: ${v(w.bucCalda)}`;
}

export const byDateDesc = (a: HqEntry, b: HqEntry) => b.date.localeCompare(a.date) || (b.createdAt || "").localeCompare(a.createdAt || "");

/** The location HQ views open on: Mosoaia when it exists, else the first. */
export const DEFAULT_LOCATION_NAME = "Mosoaia";
export function defaultLocation<T extends { name: string }>(locs: T[]): T | undefined {
  return locs.find(l => l.name.trim().toLowerCase() === DEFAULT_LOCATION_NAME.toLowerCase()) ?? locs[0];
}
