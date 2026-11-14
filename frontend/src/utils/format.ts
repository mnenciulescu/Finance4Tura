// Number and date formatting shared by every screen. Amounts use ro-RO
// grouping (1.234,56) as before.

const toNum = (n: unknown) => (typeof n === "number" ? n : Number(n) || 0);

/** 1234.5 → "1.234,50" */
export const fmtMoney = (n: unknown) =>
  toNum(n).toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 1234.5 → "1.235" */
export const fmtInt = (n: unknown) => Math.round(toNum(n)).toLocaleString("ro-RO");

/** Up to two decimals, no padding: 1234.5 → "1.234,5" */
export const fmtNum = (n: unknown) =>
  toNum(n).toLocaleString("ro-RO", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

/** One decimal: 1234.56 → "1.234,6" */
export const fmt1 = (n: unknown) =>
  toNum(n).toLocaleString("ro-RO", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Compact axis labels: 12500 → "12,5k" */
export const fmtAxis = (v: number) => {
  if (v === 0) return "0";
  if (Math.abs(v) >= 1000) return `${(v / 1000).toLocaleString("ro-RO", { maximumFractionDigits: 1 })}k`;
  return fmtInt(v);
};

export const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "2026-11-10" → { month: "NOV", day: "10", year: "2026" } */
export function monthParts(iso: string) {
  const [y, m, d] = iso.split("-");
  return { month: MONTH_ABBR[Number(m) - 1].toUpperCase(), day: String(Number(d)), year: y };
}

/** Day of week from YYYY-MM-DD, computed in UTC to match the date string. */
export function dowOf(iso: string, override?: string) {
  if (override) return override.slice(0, 3);
  const [y, m, d] = iso.split("-").map(Number);
  return DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** "2026-11-10" → "10 Nov 2026" */
export const fmtDate = (iso?: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${Number(d)} ${MONTH_ABBR[Number(m) - 1]} ${y}`;
};

/** "2026-11-10" → "Nov 10" */
export const fmtShortDate = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${MONTH_ABBR[Number(m) - 1]} ${Number(d)}`;
};

/** Local today as YYYY-MM-DD. */
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
