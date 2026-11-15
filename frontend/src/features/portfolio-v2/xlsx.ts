import { SUPPORTED_CURRENCIES } from "../../utils/money";

/*
 * Minimal .xlsx reader for the one-time asset import: reads the first sheet's
 * cell values (shared strings, inline strings, numbers). An .xlsx is a zip of
 * XML files; entries are stored or deflated, which the browser's own
 * DecompressionStream handles, so no spreadsheet library is bundled.
 */

interface ZipEntry { name: string; method: number; compSize: number; offset: number; }

function readZipDirectory(buf: ArrayBuffer): ZipEntry[] {
  const view = new DataView(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66_000); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("Not an .xlsx file");
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const entries: ZipEntry[] = [];
  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new Error("Damaged .xlsx file");
    const method = view.getUint16(p + 10, true);
    const compSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const offset = view.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buf, p + 46, nameLen));
    entries.push({ name, method, compSize, offset });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function readEntry(buf: ArrayBuffer, e: ZipEntry): Promise<string> {
  const view = new DataView(buf);
  const nameLen = view.getUint16(e.offset + 26, true);
  const extraLen = view.getUint16(e.offset + 28, true);
  const data = new Uint8Array(buf, e.offset + 30 + nameLen + extraLen, e.compSize);
  if (e.method === 0) return new TextDecoder().decode(data);
  if (e.method !== 8) throw new Error("Unsupported compression in .xlsx file");
  const stream = new Response(data).body!.pipeThrough(new DecompressionStream("deflate-raw"));
  return await new Response(stream).text();
}

const colIndex = (ref: string) => {
  const letters = ref.replace(/\d+$/, "");
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
};

const xml = (text: string) => new DOMParser().parseFromString(text, "application/xml");
const textOf = (el: Element) => [...el.getElementsByTagName("t")].map(t => t.textContent ?? "").join("");

/** The first sheet as a grid of strings (empty cells = ""). */
export async function readFirstSheet(buf: ArrayBuffer): Promise<string[][]> {
  const entries = readZipDirectory(buf);
  const find = (name: string) => entries.find(e => e.name === name);
  const sheets = entries.filter(e => /^xl\/worksheets\/sheet\d+\.xml$/.test(e.name))
    .sort((a, b) => Number(a.name.match(/(\d+)\.xml$/)![1]) - Number(b.name.match(/(\d+)\.xml$/)![1]));
  const sheet = find("xl/worksheets/sheet1.xml") ?? sheets[0];
  if (!sheet) throw new Error("The file has no worksheet");
  const sharedEntry = find("xl/sharedStrings.xml");
  const shared = sharedEntry ? [...xml(await readEntry(buf, sharedEntry)).getElementsByTagName("si")].map(textOf) : [];

  const doc = xml(await readEntry(buf, sheet));
  const grid: string[][] = [];
  for (const row of [...doc.getElementsByTagName("row")]) {
    const r = Number(row.getAttribute("r")) - 1;
    const cells: string[] = [];
    for (const c of [...row.getElementsByTagName("c")]) {
      const ref = c.getAttribute("r");
      const idx = ref ? colIndex(ref) : cells.length;
      const t = c.getAttribute("t");
      const v = c.getElementsByTagName("v")[0]?.textContent ?? "";
      let value = v;
      if (t === "s") value = shared[Number(v)] ?? "";
      else if (t === "inlineStr") value = textOf(c);
      while (cells.length < idx) cells.push("");
      cells[idx] = value.trim();
    }
    grid[Number.isFinite(r) && r >= 0 ? r : grid.length] = cells;
  }
  return Array.from(grid, row => row ?? []);
}

/* ── Rows → asset bodies ──────────────────────────────────────────────────── */

export interface ImportRow {
  platform: string;
  type: string;
  symbol: string;
  name: string;
  units: number | null;
  isin: string;
  currency: string;
  /** Spreadsheet row (1-based) for messages. */
  line: number;
}

const HEADERS: Record<keyof Omit<ImportRow, "line">, RegExp> = {
  platform: /^platform/i,
  type: /^type/i,
  symbol: /^(symbol|ticker)/i,
  name: /name/i,
  units: /unit/i,
  isin: /isin|details/i,
  currency: /^currency/i,
};

/**
 * Guess a quote currency when the sheet has none: a Total is EUR; otherwise a
 * supported code at the end of the name or platform ("… RON"), then the
 * platform's usual quote currency, then EUR. Always editable in the preview.
 */
export function inferCurrency(row: Pick<ImportRow, "platform" | "type" | "name">): string {
  if (/^total$/i.test(row.type)) return "EUR";
  const codes = SUPPORTED_CURRENCIES as readonly string[];
  const tail = (s: string) => s.trim().split(/[\s()]+/).filter(Boolean).at(-1)?.toUpperCase() ?? "";
  if (codes.includes(tail(row.name))) return tail(row.name);
  if (codes.includes(tail(row.platform))) return tail(row.platform);
  const p = row.platform.toLowerCase();
  if (p.includes("etoro")) return "USD";
  if (p.includes("tradeville")) return "RON";
  return "EUR";
}

/** Finds the header row and maps every following non-empty row. */
export function mapRows(grid: string[][]): { rows: ImportRow[]; error?: string } {
  const headerAt = grid.findIndex(r => r.some(c => HEADERS.platform.test(c)) && r.some(c => HEADERS.type.test(c)));
  if (headerAt < 0) return { rows: [], error: "No header row with Platform and Type columns" };
  const header = grid[headerAt];
  const col = Object.fromEntries(Object.entries(HEADERS).map(([k, re]) => [k, header.findIndex(h => re.test(h))])) as Record<keyof typeof HEADERS, number>;
  const at = (r: string[], k: keyof typeof HEADERS) => (col[k] >= 0 ? (r[col[k]] ?? "").trim() : "");
  const rows: ImportRow[] = [];
  grid.slice(headerAt + 1).forEach((r, i) => {
    const platform = at(r, "platform");
    const type = at(r, "type");
    if (!platform && !type) return;
    const unitsRaw = at(r, "units");
    // Cell values are stored as plain decimals ("2.809" = 2.809 units).
    const units = unitsRaw === "" ? null : Number(unitsRaw.replace(",", "."));
    const base = { platform, type, symbol: at(r, "symbol"), name: at(r, "name"), units: Number.isFinite(units) ? units : null, isin: at(r, "isin"), line: headerAt + i + 2 };
    const explicit = at(r, "currency").toUpperCase();
    rows.push({ ...base, currency: explicit || inferCurrency(base) });
  });
  return { rows };
}
