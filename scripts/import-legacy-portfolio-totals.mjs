/**
 * import-legacy-portfolio-totals.mjs
 *
 * Copies one user's platform history from the old Investments module
 * (PortfolioSnapshots: one value per platform per date) into Portfolio v2 as
 * platform Total snapshots (source "legacy"). There is no per-asset history,
 * so none is created. Old tables are only read.
 *
 * Dry run by default; idempotent (snapshot ids are `legacy-<old id>`).
 *
 *   node scripts/import-legacy-portfolio-totals.mjs --user <username>
 *   node scripts/import-legacy-portfolio-totals.mjs --user <username> --apply
 *   node scripts/import-legacy-portfolio-totals.mjs --user <username> --rollback [--apply]
 *
 * Options:
 *   --keep <oldSnapshotId,...>   which record to keep for same-date duplicates
 *   --archive <platform,...>     create these platforms' Totals archived
 *   --close <platform,...>       end these platforms with a 0 Total the day after
 *                                their last record (when it is not already 0)
 *   --fx historical|current      ECB rate of each date (default) or today's stored rates
 *
 * Uses the operator's AWS credentials (eu-central-1). Prints the report to the
 * terminal only — never commit its output.
 */
import { randomUUID } from "crypto";
import { createRequire } from "module";

process.env.AWS_REGION ??= "eu-central-1";
const POOL_ID = "eu-central-1_CD7AdBFwQ";
const OLD_TABLE = "PortfolioSnapshots";
const CURRENCIES = ["USD", "RON", "GBP", "CHF"];

// The AWS SDK lives in backend/node_modules.
const backend = new URL("../backend/", import.meta.url);
const requireBackend = createRequire(new URL("package.json", backend));
const { ScanCommand, GetCommand } = requireBackend("@aws-sdk/lib-dynamodb");
const { CognitoIdentityProviderClient, AdminGetUserCommand } = requireBackend("@aws-sdk/client-cognito-identity-provider");
const { docClient } = await import(new URL("src/lib/dynamo.mjs", backend));
const store = await import(new URL("src/lib/portfolioV2/store.mjs", backend));
const model = await import(new URL("src/lib/portfolioV2/model.mjs", backend));

/* ── Arguments ────────────────────────────────────────────────────────────── */

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };
const list = (name) => (opt(name) ?? "").split(",").map(s => s.trim()).filter(Boolean);
const flag = (name) => args.includes(`--${name}`);
const username = opt("user");
const apply = flag("apply");
const fxMode = opt("fx") ?? "historical";
if (!username) { console.error("--user <username> is required"); process.exit(1); }
if (!["historical", "current"].includes(fxMode)) { console.error("--fx must be historical or current"); process.exit(1); }

/* ── Helpers ──────────────────────────────────────────────────────────────── */

async function userSub(name) {
  const res = await new CognitoIdentityProviderClient({}).send(new AdminGetUserCommand({ UserPoolId: POOL_ID, Username: name }));
  const sub = res.UserAttributes?.find(a => a.Name === "sub")?.Value;
  if (!sub) throw new Error(`No sub for user ${name}`);
  return sub;
}

async function oldRecords(userId) {
  const out = [];
  let ExclusiveStartKey;
  do {
    const res = await docClient.send(new ScanCommand({
      TableName: OLD_TABLE, ExclusiveStartKey,
      FilterExpression: "userId = :u", ExpressionAttributeValues: { ":u": userId },
    }));
    out.push(...(res.Items ?? []));
    ExclusiveStartKey = res.LastEvaluatedKey;
  } while (ExclusiveStartKey);
  return out;
}

/** ECB rates (1 EUR in CUR) keyed by the business day frankfurter.app returns. */
async function historicalSeries(dates) {
  const series = {};
  const unique = [...new Set(dates)].sort();
  for (let i = 0; i < unique.length; i += 6) {
    await Promise.all(unique.slice(i, i + 6).map(async (d) => {
      const res = await fetch(`https://api.frankfurter.app/${d}?from=EUR&to=${CURRENCIES.join(",")}`);
      if (!res.ok) throw new Error(`frankfurter.app ${d}: HTTP ${res.status}`);
      const body = await res.json();
      series[body.date] = body.rates;
    }));
  }
  return series;
}

/** Today's stored matrix, as a one-day series dated by its update. */
async function currentSeries() {
  const res = await docClient.send(new GetCommand({ TableName: "FxRates", Key: { rateId: "global" } }));
  const rates = res.Item?.rates;
  if (!rates) throw new Error("No stored FX rates — run Admin → Update FX Rates");
  const perEur = Object.fromEntries(CURRENCIES.filter(c => rates.EUR?.[c]).map(c => [c, rates.EUR[c]]));
  return { "0000-01-01": perEur, updatedAt: res.Item.updatedAt };
}

const fmt = (n) => n.toLocaleString("en-GB", { maximumFractionDigits: 2 });

/* ── Rollback ─────────────────────────────────────────────────────────────── */

async function rollback(userId) {
  const [assets, snapshots] = await Promise.all([store.listAssets(userId), store.listSnapshots(userId)]);
  const legacy = snapshots.filter(s => s.source === "legacy");
  const created = assets.filter(a => a.type === "Total" && a.notes === model.LEGACY_TOTAL_NOTE)
    .filter(a => !snapshots.some(s => s.assetId === a.assetId && s.source !== "legacy"))
    .filter(a => !assets.some(o => o.type !== "Total" && o.platform === a.platform));
  console.log(`Imported snapshots: ${legacy.length}; Totals created by the import (no other data): ${created.map(a => a.platform).join(", ") || "none"}`);
  if (!apply) { console.log("\nDry run — add --apply to delete them."); return; }
  await store.deleteSnapshots(legacy.map(s => s.snapshotId));
  for (const a of created) await store.deleteAsset(a.assetId);
  console.log("Deleted.");
}

/* ── Import ───────────────────────────────────────────────────────────────── */

async function run() {
  const userId = await userSub(username);
  if (flag("rollback")) return rollback(userId);

  const [old, assets, snapshots] = await Promise.all([oldRecords(userId), store.listAssets(userId), store.listSnapshots(userId)]);
  const plan = model.planLegacyTotals(old, { assets, snapshots, keep: list("keep"), archive: list("archive"), close: list("close") });

  console.log(`User ${username}: ${old.length} old records.\n`);
  for (const p of plan.perPlatform) {
    const total = p.totalAssetId ? "existing Total" : `new Total (${plan.totalsToCreate.find(t => t.platform === p.platform)?.active === false ? "archived" : "active"})`;
    console.log(`  ${p.platform.padEnd(16)} ${String(p.imported).padStart(3)} of ${String(p.found).padStart(3)}  ${p.first ?? "—"} → ${p.last ?? "—"}  ${total}${p.cutoff ? `  (cut-over ${p.cutoff})` : ""}`);
  }
  if (plan.closing.length) console.log(`\n  Closing 0 Totals: ${plan.closing.map(c => `${c.platform} on ${c.date}`).join(", ")}`);
  if (plan.skipped.length) {
    console.log(`\nSkipped ${plan.skipped.length}:`);
    plan.skipped.forEach(s => console.log(`  ${s.platform} ${s.date} ${s.id}: ${s.reason}`));
  }
  if (plan.duplicates.length) {
    console.log("\nSame-date records with different amounts — choose one per date with --keep <id,…>:");
    plan.duplicates.forEach(d => console.log(`  ${d.platform} ${d.date}: ${d.records.map(r => `${r.id} = ${fmt(r.amount)} ${r.currency}`).join("  |  ")}`));
    console.log("\nNothing written.");
    process.exitCode = 2;
    return;
  }

  // FX for every record, computed before anything is written.
  const series = fxMode === "historical" ? await historicalSeries(plan.records.map(r => r.old.date)) : await currentSeries();
  const fxDateOverride = fxMode === "current" ? series.updatedAt?.slice(0, 10) : null;
  delete series.updatedAt;
  const priced = [];
  const fxErrors = [];
  for (const r of plan.records) {
    const fx = model.legacyFxRate(series, r.old.currency, fxMode === "current" ? "9999-12-31" : r.old.date);
    if (fx.error) fxErrors.push(`${r.platform} ${r.old.date}: ${fx.error}`);
    else priced.push({ ...r, fx: fxDateOverride && r.old.currency !== "EUR" ? { ...fx, fxDate: fxDateOverride } : fx });
  }
  if (fxErrors.length) {
    console.log(`\nNo FX rate for ${fxErrors.length} record(s):`);
    fxErrors.forEach(e => console.log(`  ${e}`));
    console.log("\nNothing written.");
    process.exitCode = 2;
    return;
  }

  const now = new Date();
  const created = plan.totalsToCreate.map(t => model.buildLegacyTotalAsset({ ...t, assetId: randomUUID(), userId, now }));
  const totalOf = (platform) => [...assets, ...created].find(a => a.type === "Total" && a.platform.toLowerCase() === platform.toLowerCase());
  const records = [
    ...priced.map(r => model.buildLegacyTotal({ old: r.old, totalAsset: totalOf(r.platform), fx: r.fx, userId })),
    ...plan.closing.map(c => model.buildLegacyClose({ totalAsset: totalOf(c.platform), date: c.date, userId })),
  ];

  console.log(`\nFX: ${fxMode}. Per platform, first → last value in EUR:`);
  for (const p of plan.perPlatform) {
    const mine = records.filter(r => r.asset.platform === p.platform && !r.snapshotId.startsWith("legacy-close-"));
    if (mine.length) console.log(`  ${p.platform.padEnd(16)} ${fmt(mine[0].valueEUR)} → ${fmt(mine.at(-1).valueEUR)}`);
  }
  console.log(`\n${records.length} snapshot(s), ${created.length} new Total asset(s).`);
  if (!apply) { console.log("Dry run — add --apply to write."); return; }

  for (const a of created) await store.putAsset(a);
  for (const r of records) await store.putSnapshot(r);
  console.log("Written.");
}

run().catch(e => { console.error(e); process.exit(1); });
