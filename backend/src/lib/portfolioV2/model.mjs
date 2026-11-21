// Portfolio v2 — pure domain rules (no AWS, no network). Every number that
// ends up in a snapshot is computed here, never by the AI agent.
import { isSupportedCurrency, rateToEUR, SUPPORTED_CURRENCIES } from "../currencies.mjs";

export const ASSET_TYPES = ["Total", "MutualFund", "Stock", "ETF", "Crypto", "Bond", "Other"];

/** Prices older than this (days) are kept but marked stale; crypto uses hours. */
export const MAX_PRICE_AGE_DAYS = 10;
export const MAX_CRYPTO_AGE_HOURS = 24;
/** A crypto price is new data again once the last snapshot is this old. */
export const CRYPTO_REFRESH_MS = 60 * 60 * 1000;
/** Price moves beyond this vs the last snapshot are flagged for a check. */
export const JUMP_THRESHOLD = 0.3;

const LIMITS = { platform: 60, symbol: 20, name: 160, notes: 2000, source: 300, sources: 10 };

/* ── Types and identifiers ────────────────────────────────────────────────── */

/** Maps the spreadsheet's spellings ("Mutual fond", "etf", …) to the enum. */
export function normalizeType(raw) {
  const t = String(raw ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!t) return null;
  if (["mutual fond", "mutual fund", "mutualfund", "fund", "fond"].includes(t)) return "MutualFund";
  return ASSET_TYPES.find(x => x.toLowerCase() === t) ?? null;
}

/** ISO 6166: 2 letters, 9 alphanumerics, 1 check digit (Luhn over the digit expansion). */
export function isValidIsin(raw) {
  const isin = String(raw ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}[A-Z0-9]{9}[0-9]$/.test(isin)) return false;
  const digits = isin.split("").map(ch => (/[A-Z]/.test(ch) ? String(ch.charCodeAt(0) - 55) : ch)).join("");
  let sum = 0;
  let double = true; // the check digit is excluded below, so start doubling at the rightmost payload digit
  for (let i = digits.length - 2; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    double = !double;
  }
  return (10 - (sum % 10)) % 10 === Number(digits[digits.length - 1]);
}

const clean = (v, max) => {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
};

/* ── Asset validation ─────────────────────────────────────────────────────── */

/**
 * Validates and normalises an asset body. `others` are the user's other
 * assets (for the one-Total-per-platform rule). Returns { value, errors }.
 */
export function validateAsset(body = {}, { others = [], current = null } = {}) {
  const errors = {};
  const type = current?.type === "Total" ? "Total" : (normalizeType(body.type) ?? (ASSET_TYPES.includes(body.type) ? body.type : null));
  const platform = clean(body.platform ?? current?.platform, LIMITS.platform);
  if (!platform) errors.platform = "Platform is required";
  if (!type) errors.type = `Type must be one of ${ASSET_TYPES.join(", ")}`;

  const value = {
    platform,
    type,
    symbol: null,
    name: clean(body.name, LIMITS.name),
    units: null,
    isin: null,
    currency: "EUR",
    preferredSources: [],
    notes: clean(body.notes, LIMITS.notes),
    order: Number.isFinite(Number(body.order)) ? Number(body.order) : (current?.order ?? 0),
    active: body.active === undefined ? (current?.active ?? true) : Boolean(body.active),
  };

  if (type === "Total") {
    value.name = value.name ?? `${platform ?? ""} total`.trim();
    value.active = true;
    if (current == null && platform && others.some(a => a.type === "Total" && sameText(a.platform, platform))) {
      errors.type = `${platform} already has a Total`;
    }
    return { value, errors };
  }

  value.symbol = clean(body.symbol, LIMITS.symbol)?.toUpperCase() ?? null;
  value.isin = clean(body.isin, 12)?.toUpperCase() ?? null;
  if (!value.name) errors.name = "Name is required";
  const units = typeof body.units === "string" ? Number(body.units.replace(",", ".")) : Number(body.units);
  if (!(Number.isFinite(units) && units > 0)) errors.units = "Units must be greater than 0";
  else value.units = units;
  if (value.isin && !isValidIsin(value.isin)) errors.isin = "Not a valid ISIN";
  if (!value.isin && !value.symbol && !value.name) errors.symbol = "Give an ISIN, a symbol or a name";
  const currency = String(body.currency ?? "").trim().toUpperCase();
  if (!isSupportedCurrency(currency)) errors.currency = `Currency must be one of ${SUPPORTED_CURRENCIES.join(", ")}`;
  else value.currency = currency;
  value.preferredSources = (Array.isArray(body.preferredSources) ? body.preferredSources : [])
    .map(s => clean(s, LIMITS.source)).filter(Boolean).slice(0, LIMITS.sources);
  return { value, errors };
}

const sameText = (a, b) => String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();

/** Identity of an asset on its platform (one per platform + ISIN / symbol / name). */
export function assetMatchKey(a) {
  const id = a.type === "Total" ? "__total__" : (a.isin || a.symbol || a.name || "");
  return `${String(a.platform ?? "").trim().toLowerCase()}|${String(id).trim().toLowerCase()}`;
}

/* ── Snapshots ────────────────────────────────────────────────────────────── */

/** The latest snapshot per asset (by price date, then generation time). */
export function latestByAsset(snapshots) {
  const out = {};
  for (const s of snapshots) {
    const cur = out[s.assetId];
    if (!cur || s.latestPriceDate > cur.latestPriceDate || (s.latestPriceDate === cur.latestPriceDate && s.generatedAt > cur.generatedAt)) out[s.assetId] = s;
  }
  return out;
}

/** Snapshot days follow the user's clock (Romania), not UTC. */
export const SNAPSHOT_TIME_ZONE = "Europe/Bucharest";
const DAY_FMT = new Intl.DateTimeFormat("en-CA", { timeZone: SNAPSHOT_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
/** The local calendar day (YYYY-MM-DD) a snapshot was generated on. */
export const snapshotDay = (when) => DAY_FMT.format(new Date(when));

/**
 * One generated snapshot per asset per day: a later run on the same day
 * replaces that day's snapshot instead of adding one. Returns the snapshot
 * to overwrite (`replace`, null when none), any extra same-day copies to
 * delete, and the latest snapshot from an earlier day (`previous`) that the
 * new one is compared with.
 */
export function sameDaySlot(assetSnapshots, now = new Date()) {
  const day = snapshotDay(now);
  // Imported history is never replaced by a run.
  const today = assetSnapshots.filter(s => s.source !== "legacy" && s.generatedAt && snapshotDay(s.generatedAt) === day)
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt));
  const earlier = assetSnapshots.filter(s => !today.includes(s));
  const previous = Object.values(latestByAsset(earlier))[0] ?? null;
  return { replace: today[0] ?? null, extra: today.slice(1), previous };
}

const isoDay = (d) => d.toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);

/**
 * Checks what the agent reported before anything is computed or written.
 * Returns { ok: true, stale, ageDays, message } or { ok: false, status:
 * "not_found" | "failed", message }. An old but confirmed price is accepted
 * and marked stale; it is still a confirmed price.
 */
export function checkAgentResult(r, asset, now = new Date()) {
  if (!r || typeof r !== "object") return { ok: false, status: "failed", message: "The agent returned no result" };
  if (!r.found) return { ok: false, status: "not_found", message: clean(r.reasonIfNotFound, 300) || "No confirmed price found" };
  const price = Number(r.unitPrice);
  if (!(Number.isFinite(price) && price > 0)) return { ok: false, status: "failed", message: "The reported price is not a positive number" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r.priceDate ?? ""))) return { ok: false, status: "failed", message: "The reported price date is not a date" };
  const today = isoDay(now);
  if (r.priceDate > today) return { ok: false, status: "failed", message: `The price date ${r.priceDate} is in the future` };
  const currency = String(r.currency ?? "").trim().toUpperCase();
  if (currency !== asset.currency) return { ok: false, status: "failed", message: `Currency mismatch: the source quotes ${currency || "?"}, the asset is ${asset.currency}` };
  const sources = (Array.isArray(r.sources) ? r.sources : []).filter(s => /^https:\/\//i.test(String(s?.url ?? "")));
  if (sources.length === 0) return { ok: false, status: "failed", message: "No https source given for the price" };
  if (!["official", "secondary"].includes(r.confidence)) return { ok: false, status: "failed", message: "Unknown source confidence" };
  const { stale, ageDays } = priceAge(r.priceDate, asset, now);
  return { ok: true, stale, ageDays, message: stale ? `Latest published price is from ${r.priceDate} (${ageDays} days old)` : null };
}

/** How old a price is on `now`'s day, and whether that counts as stale. */
export function priceAge(priceDate, asset, now = new Date()) {
  const ageDays = daysBetween(priceDate, isoDay(now));
  const maxDays = asset.type === "Crypto" ? Math.ceil(MAX_CRYPTO_AGE_HOURS / 24) : MAX_PRICE_AGE_DAYS;
  return { ageDays, stale: ageDays > maxDays };
}

/**
 * Whether the result is new data for the asset (§6.4): no previous snapshot,
 * a later price date, a changed number of units, or — crypto, priced 24/7 —
 * a last snapshot older than an hour.
 */
export function isNewData(last, asset, priceDate, now = new Date()) {
  if (!last) return true;
  if (priceDate > last.latestPriceDate) return true;
  if (Number(last.asset?.units) !== Number(asset.units)) return true;
  if (asset.type === "Crypto" && now.getTime() - Date.parse(last.generatedAt) >= CRYPTO_REFRESH_MS) return true;
  return false;
}

/* ── Pre-check: skip lookups that cannot find a newer price ──────────────── */

/** A lookup checked less than this long ago is not repeated. */
export const RECHECK_AFTER_MS = 6 * 60 * 60 * 1000;
/** From this hour (Romania), a weekday's own close counts as published (US markets close 22:00/23:00). */
const SAME_DAY_CLOSE_HOUR = 23;

const LOCAL_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: SNAPSHOT_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
});
function localNow(now) {
  const p = Object.fromEntries(LOCAL_PARTS.formatToParts(now).map(x => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
}
const weekday = (day) => new Date(`${day}T12:00:00Z`).getUTCDay(); // 0 = Sunday
function previousBusinessDay(day) {
  const d = new Date(`${day}T12:00:00Z`);
  do d.setUTCDate(d.getUTCDate() - 1); while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return d.toISOString().slice(0, 10);
}

/**
 * The newest price date that can already be published for this asset type:
 * the previous business day (fund NAVs and closes appear the next morning),
 * or today for stocks / ETFs late on a weekday. Holidays are not known, so
 * this never skips too much: on a holiday it only searches once more.
 */
export function latestPublishableDate(type, now = new Date()) {
  const { day, hour } = localNow(now);
  const wd = weekday(day);
  if ((type === "Stock" || type === "ETF") && wd >= 1 && wd <= 5 && hour >= SAME_DAY_CLOSE_HOUR) return day;
  return previousBusinessDay(day);
}

/**
 * Why a lookup for this asset can be skipped, or null when it is needed.
 * Never skips crypto, an asset without a snapshot, or one whose units changed
 * (that needs a new snapshot whatever the price).
 */
export function precheckSkip(asset, last, now = new Date(), checkedAt = null) {
  if (!last || asset.type === "Crypto") return null;
  if (Number(last.asset?.units) !== Number(asset.units)) return null;
  // The last lookup: a snapshot, or a run item that found no newer price.
  const lastCheck = [last.generatedAt, checkedAt].filter(Boolean).sort().at(-1);
  const ago = now.getTime() - Date.parse(lastCheck);
  if (ago >= 0 && ago < RECHECK_AFTER_MS) {
    const h = Math.max(1, Math.round(ago / 3_600_000));
    return `Checked ${h} h ago · price for ${last.latestPriceDate} already recorded`;
  }
  if (last.latestPriceDate >= latestPublishableDate(asset.type, now)) {
    return `Up to date · price for ${last.latestPriceDate} already recorded`;
  }
  return null;
}

/** When each asset was last looked up with a result (updated / no new data), from recent runs. */
export function lastCheckedByAsset(runs) {
  const out = {};
  for (const run of runs) for (const it of run.items ?? []) {
    if (it.type === "Total" || it.precheck || !it.finishedAt) continue;
    if (it.status !== "updated" && it.status !== "no_new_data") continue;
    if (!out[it.assetId] || it.finishedAt > out[it.assetId]) out[it.assetId] = it.finishedAt;
  }
  return out;
}

/** value = units × unitPrice; valueEUR = value × FX. Unrounded. */
export function computeValues(asset, unitPrice, fx) {
  const rate = rateToEUR(fx?.rates, asset.currency);
  if (rate == null) return { error: `No FX rate for ${asset.currency} → EUR — update FX rates in Admin` };
  const value = Number(asset.units) * Number(unitPrice);
  return { value, fxRate: rate, valueEUR: value * rate, fxDate: fx?.updatedAt ?? null };
}

/** Copy of the asset fields kept on each snapshot. */
export const assetCopy = (a) => ({
  platform: a.platform, type: a.type, symbol: a.symbol ?? null, name: a.name,
  units: a.units ?? null, isin: a.isin ?? null, currency: a.currency,
});

/** Builds an agent snapshot record (ids and times supplied by the caller). */
export function buildAssetSnapshot({ asset, result, values, last, runId, snapshotId, userId, now = new Date() }) {
  const notes = [];
  if (result.comments) notes.push(clean(result.comments, 1000));
  const { stale, ageDays } = priceAge(result.priceDate, asset, now);
  if (stale) notes.push(`Latest published price is ${ageDays} days old`);
  if (last?.unitPrice > 0) {
    const move = Number(result.unitPrice) / last.unitPrice - 1;
    if (Math.abs(move) > JUMP_THRESHOLD) notes.push(`Check price: ${(move * 100).toFixed(1)}% vs ${last.latestPriceDate}`);
  }
  return {
    snapshotId, userId, assetId: asset.assetId, runId,
    generatedAt: now.toISOString(),
    latestPriceDate: result.priceDate,
    stale,
    asset: assetCopy(asset),
    currency: asset.currency,
    unitPrice: Number(result.unitPrice),
    value: values.value,
    fxRate: values.fxRate,
    fxDate: values.fxDate,
    valueEUR: values.valueEUR,
    sources: result.sources
      .filter(s => /^https:\/\//i.test(String(s?.url ?? "")))
      .slice(0, 5)
      .map(s => ({
        url: String(s.url).slice(0, 1000),
        title: clean(s.title, 300),
        publisher: clean(s.publisher, 160),
        quote: clean(s.quote, 500),
        retrievedAt: now.toISOString(),
      })),
    confidence: result.confidence,
    priceType: clean(result.priceType, 20),
    flagged: notes.some(n => n.startsWith("Check price")),
    comments: notes.join(" · ") || null,
    source: "agent",
  };
}

/**
 * A platform's Total (§6.5): Σ valueEUR of the latest snapshot of every active
 * asset on the platform, carrying forward the ones without new data.
 * `newIds` = snapshot ids written in this run.
 */
export function computePlatformTotal(platformAssets, latest, newIds = new Set()) {
  const parts = platformAssets.filter(a => a.type !== "Total" && a.active !== false);
  let valueEUR = 0;
  let latestPriceDate = null;
  let hasNew = false;
  const carried = [];
  const missing = [];
  for (const a of parts) {
    const snap = latest[a.assetId];
    if (!snap) { missing.push(a.name); continue; }
    valueEUR += Number(snap.valueEUR) || 0;
    if (!latestPriceDate || snap.latestPriceDate > latestPriceDate) latestPriceDate = snap.latestPriceDate;
    if (newIds.has(snap.snapshotId)) hasNew = true;
    else carried.push(snap.latestPriceDate);
  }
  const counted = parts.length - missing.length;
  const notes = [`Sum of ${counted} asset${counted === 1 ? "" : "s"}`];
  if (carried.length) notes.push(`${carried.length} carried forward from ${[...new Set(carried)].sort()[0]}`);
  if (missing.length) notes.push(`incomplete: ${missing.length} asset${missing.length === 1 ? "" : "s"} without a price`);
  return { valueEUR, latestPriceDate, hasNew, counted, carried: carried.length, missing: missing.length, comments: notes.join("; ") };
}

export function buildTotalSnapshot({ totalAsset, total, runId, snapshotId, userId, now = new Date() }) {
  return {
    snapshotId, userId, assetId: totalAsset.assetId, runId,
    generatedAt: now.toISOString(),
    latestPriceDate: total.latestPriceDate,
    asset: assetCopy(totalAsset),
    currency: "EUR",
    unitPrice: null, value: null, fxRate: null, fxDate: null,
    valueEUR: total.valueEUR,
    sources: [],
    confidence: null,
    incomplete: total.missing > 0,
    comments: total.comments,
    source: "computed",
  };
}

/* ── Runs ─────────────────────────────────────────────────────────────────── */

export const RUN_STALE_MS = 20 * 60 * 1000;

/** The items of a new run: every active non-Total asset, then one per platform Total. */
export function runItems(assets) {
  const priced = assets.filter(a => a.type !== "Total" && a.active !== false)
    .sort((a, b) => a.platform.localeCompare(b.platform) || (a.order ?? 0) - (b.order ?? 0));
  const platforms = new Set(priced.map(a => a.platform));
  const totals = assets.filter(a => a.type === "Total" && platforms.has(a.platform));
  return [...priced, ...totals].map(a => ({
    assetId: a.assetId, name: a.name, platform: a.platform, type: a.type,
    symbol: a.symbol ?? null, isin: a.isin ?? null, status: "queued",
  }));
}

/** Counts per status for the run summary. */
export function summarize(items) {
  const out = { updated: 0, noNewData: 0, notFound: 0, failed: 0, skipped: 0 };
  for (const it of items) {
    if (it.type === "Total") continue;
    if (it.status === "updated") out.updated++;
    else if (it.status === "no_new_data") out.noNewData++;
    else if (it.status === "not_found") out.notFound++;
    else if (it.status === "failed") out.failed++;
    else if (it.status === "skipped") out.skipped++;
  }
  return out;
}

export function finalStatus(items, cancelled = false) {
  if (cancelled) return "cancelled";
  return items.some(i => i.status === "failed" || i.status === "not_found") ? "completed_with_errors" : "completed";
}
