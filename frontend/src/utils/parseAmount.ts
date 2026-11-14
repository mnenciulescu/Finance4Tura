/**
 * Parses a typed amount, accepting both "," and "." as the decimal separator
 * (proposal §10.6). Android keyboards show one or the other depending on the
 * language, and some offer only one.
 *
 *   "12,5"      → 12.5
 *   "12.5"      → 12.5
 *   "1.234,56"  → 1234.56   (ro-RO grouping)
 *   "1,234.56"  → 1234.56   (en grouping)
 *   ""          → NaN
 */
export function parseAmount(input: string | number | null | undefined): number {
  if (typeof input === "number") return input;
  if (input == null) return NaN;
  let s = String(input).trim().replace(/\s/g, "");
  if (s === "" || s === "-" ) return NaN;
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma !== -1 && lastDot !== -1) {
    // Whichever comes last is the decimal separator; the other groups thousands.
    const dec = lastComma > lastDot ? "," : ".";
    const group = dec === "," ? "." : ",";
    s = s.split(group).join("").replace(dec, ".");
  } else if (lastComma !== -1) {
    // Only commas: "1,234,567" groups (several commas); otherwise a decimal.
    s = (s.match(/,/g)?.length ?? 0) > 1 ? s.split(",").join("") : s.replace(",", ".");
  } else if ((s.match(/\./g)?.length ?? 0) > 1) {
    s = s.split(".").join("");
  }
  if (!/^-?\d*\.?\d*$/.test(s) || s === "." || s === "-.") return NaN;
  return Number(s);
}

/** Keeps only characters that can form an amount while typing. */
export const sanitizeAmountInput = (v: string) => v.replace(/[^\d.,-]/g, "");
