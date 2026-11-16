// Invented records in the DynamoDB shapes. No real data.
const y = new Date().getFullYear();
const pad = n => String(n).padStart(2, "0");
const incomes = [];
for (let m = 1; m <= 12; m++) incomes.push({ incomeId: `i${m}`, seriesId: "s-sal", summary: "Monthly salary", date: `${y}-${pad(m)}-10`, amount: 14200, currency: "RON", isRepeatable: true, repeatFrequency: "monthly" });
incomes.push({ incomeId: "ib", seriesId: "ib", summary: "Bonus", date: `${y}-06-20`, amount: 5000, currency: "RON" });
const names = [["Rent", "High", 3500], ["Electricity", "High", 240], ["Internet", "Medium", 60], ["Groceries", "Medium", 1800], ["Phone", "Low", 45], ["Gym", "Low", 150], ["Car insurance", "High", 900]];
const expenses = [];
let id = 1;
for (const inc of incomes) {
  if (inc.incomeId === "ib") continue;
  const m = inc.date.slice(5, 7);
  names.forEach(([summary, priority, amount], k) => {
    expenses.push({
      expenseId: `e${id++}`, seriesId: `se${k}`, summary, priority, amount, currency: "RON",
      date: `${y}-${m}-${pad(11 + k * 2)}`, status: Number(m) < new Date().getMonth() + 1 || k < 2 ? "Completed" : "Pending",
      special: k === 6 && m === "03", isRepeatable: true, mappedIncomeId: inc.incomeId, mappedIncomeSummary: inc.summary, mappedIncomeDate: inc.date,
    });
  });
}
const splits = [
  { splitPaymentId: "sp1", title: "Laptop instalments", totalAmount: 1200, currency: "RON", occurrenceCount: 6, occurrenceType: "amount", createdDate: `${y}-10-02`, occurrences: [{ value: "200" }, { value: "200" }, { value: "" }, { value: "" }, { value: "" }, { value: "" }] },
  { splitPaymentId: "sp2", title: "Radu - Engleza", totalAmount: 900, currency: "RON", occurrenceCount: 4, occurrenceType: "date", createdDate: `${y}-09-14`, occurrences: [{ value: `${y}-09-15` }, { value: "" }, { value: "" }, { value: "" }] },
  { splitPaymentId: "sp3", title: "Winter tyres", totalAmount: 350, currency: "EUR", occurrenceCount: 2, occurrenceType: "amount", createdDate: `${y}-08-01`, occurrences: [{ value: "175" }, { value: "" }] },
  { splitPaymentId: "sp4", title: "Sofa", totalAmount: 3000, currency: "RON", occurrenceCount: 3, occurrenceType: "amount", createdDate: `${y}-02-01`, occurrences: [{ value: "1000" }, { value: "1000" }, { value: "1000" }] },
];
const books = [];
const persons = ["Mihai", "Ana", "Radu"];
const titles = ["Atomic Habits", "Deep Work", "The Pragmatic Programmer", "Thinking, Fast and Slow", "Clean Code", "Sapiens", "AWS Solutions Architect", "React Patterns", "Dune", "Range"];
let b = 1;
for (let m = 0; m < 14; m++) {
  persons.forEach((p, pi) => {
    if ((m + pi) % 2) return;
    const d = new Date(y, new Date().getMonth() - m, 1);
    books.push({ bookId: `b${b}`, name: p, source: ["Book", "Voxa", "Udemy"][b % 3], type: ["Book", "Audiobook", "Training"][b % 3], author: "A. Author", title: titles[b % titles.length], dateCompleted: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, rating: (b % 5) + 1, comments: b % 4 ? "" : "Great read, recommended." });
    b++;
  });
}
const platforms = [["eToro", "USD", 8200], ["Binance", "USD", 1500], ["Fidelity", "USD", 12000], ["ING Funds RON", "RON", 30000], ["ING Funds EUR", "EUR", 4000]];
const snapshots = [];
let s = 1;
for (let q = 0; q < 12; q++) {
  const d = new Date(y - 2, q * 3, 28);
  platforms.forEach(([platform, currency, base], k) => snapshots.push({ snapshotId: `sn${s++}`, date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-28`, platform, currency, amount: Math.round(base * (1 + q * 0.06 + k * 0.01)) }));
}
const operations = [
  { operationId: "o1", date: `${y}-03-05`, type: "Deposit", platform: "eToro", amount: 1000, currency: "USD", notes: "Monthly top-up" },
  { operationId: "o2", date: `${y}-05-05`, type: "Deposit", platform: "Fidelity", amount: 2000, currency: "USD", notes: "" },
  { operationId: "o3", date: `${y}-07-12`, type: "Withdrawal", platform: "Binance", amount: 300, currency: "USD", notes: "Rebalance" },
  { operationId: "o4", date: `${y - 1}-11-02`, type: "Deposit", platform: "ING Funds RON", amount: 5000, currency: "RON", notes: "" },
];
const fx = { rates: { EUR: { EUR: 1, USD: 1.08, RON: 4.97 }, USD: { EUR: 0.926, USD: 1, RON: 4.6 }, RON: { EUR: 0.201, USD: 0.217, RON: 1 } }, updatedAt: `${y}-11-13T08:00:00Z` };
const locations = [{ hqId: "h1", name: "Apartment", address: "Sc. 6, Ap. 68", order: 0 }, { hqId: "h2", name: "Cabin", address: "", order: 1 }];
const water = ["Baie - Apa Rece", "Bucatarie - Apa Rece", "Baie - Apa Calda", "Bucatarie - Apa Calda"].map((t, i) => ({ parameterId: `p${i}`, title: t, type: "number", unit: "m³", order: i }));
const templates = [
  { templateId: "t1", hqId: "h1", name: "Water meters", parameters: water },
  { templateId: "t2", hqId: "h2", name: "Heating", parameters: [{ parameterId: "q1", title: "Pellets", type: "number", unit: "kg" }, { parameterId: "q2", title: "Serviced", type: "boolean" }] },
];
const entries = [];
for (let k = 0; k < 10; k++) {
  const d = new Date(y - 1, k * 2, 3);
  entries.push({ entryId: `en${k}`, templateId: "t1", hqId: "h1", date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-03`, createdAt: d.toISOString(), notes: "", values: water.map((p, i) => ({ parameterId: p.parameterId, title: p.title, value: 100 + k * (3 + i) + i * 40 })) });
}
entries.push({ entryId: "eh1", templateId: "t2", hqId: "h2", date: `${y}-10-01`, createdAt: `${y}-10-01T00:00:00Z`, values: [{ parameterId: "q1", title: "Pellets", value: 450 }, { parameterId: "q2", title: "Serviced", value: true }], notes: "" });
const users = [
  { username: "nenciulescu", email: "admin@example.com", enabled: true, role: "admin", incomes: 13, expenses: 84 },
  { username: "ana", email: "ana@example.com", enabled: true, role: "normal", incomes: 4, expenses: 20 },
  { username: "test-user", email: "test@example.com", enabled: false, role: "normal", incomes: 0, expenses: 0 },
];
// Portfolio v2 — invented assets and snapshots (no real holdings).
const iso = d => d.toISOString().slice(0, 10);
const daysAgo = n => iso(new Date(Date.now() - n * 86400000));
const pv2Assets = [
  { assetId: "pa-t1", platform: "Alpha Broker", type: "Total", name: "Alpha Broker total", units: null, symbol: null, isin: null, currency: "EUR", preferredSources: [], notes: null, order: -1, active: true },
  { assetId: "pa-1", platform: "Alpha Broker", type: "ETF", name: "Example World ETF", symbol: "EXW", units: 12.5, isin: "IE00B4L5Y983", currency: "USD", preferredSources: [], notes: null, order: 0, active: true },
  { assetId: "pa-2", platform: "Alpha Broker", type: "Crypto", name: "Example Coin", symbol: "EXC", units: 0.25, isin: null, currency: "USD", preferredSources: [], notes: null, order: 1, active: true },
  { assetId: "pa-t2", platform: "Beta Funds", type: "Total", name: "Beta Funds total", units: null, symbol: null, isin: null, currency: "EUR", preferredSources: [], notes: null, order: -1, active: true },
  { assetId: "pa-3", platform: "Beta Funds", type: "MutualFund", name: "Sample Balanced Fund RON", symbol: null, units: 40.75, isin: "US0378331005", currency: "RON", preferredSources: [], notes: null, order: 0, active: true },
];
const pv2Snapshots = [];
[[120, 0.9], [60, 0.95], [20, 1], [3, 1.04]].forEach(([ago, k], n) => {
  const date = daysAgo(ago);
  const gen = `${date}T09:00:00Z`;
  const a1 = 12.5 * 100 * k * 0.926, a2 = 0.25 * 40000 * k * 0.926, a3 = 40.75 * 50 * k * 0.201;
  const mk = (assetId, asset, unitPrice, value, valueEUR, cur) => ({
    snapshotId: `ps-${assetId}-${n}`, assetId, runId: `pr-${n}`, generatedAt: gen, latestPriceDate: date, asset, currency: cur, unitPrice, value,
    fxRate: cur === "EUR" ? 1 : cur === "USD" ? 0.926 : 0.201, fxDate: gen, valueEUR,
    sources: unitPrice ? [{ url: "https://example.com/price", title: "Price page", publisher: "Example Exchange", quote: `Close ${unitPrice}` }] : [],
    confidence: unitPrice ? "official" : null, comments: unitPrice ? null : "Sum of assets", source: unitPrice ? "agent" : "computed",
  });
  pv2Snapshots.push(
    mk("pa-1", pv2Assets[1], 100 * k, 1250 * k, a1, "USD"),
    mk("pa-2", pv2Assets[2], 40000 * k, 10000 * k, a2, "USD"),
    mk("pa-3", pv2Assets[4], 50 * k, 2037.5 * k, a3, "RON"),
    mk("pa-t1", pv2Assets[0], null, null, a1 + a2, "EUR"),
    mk("pa-t2", pv2Assets[3], null, null, a3, "EUR"),
  );
});
// Imported history (old module): platform Totals only, before the AI-era ones.
[[400, 900, 2400], [250, 1100, 2300]].forEach(([ago, alpha, beta], n) => {
  const date = daysAgo(ago);
  const mk = (assetId, asset, valueEUR) => ({
    snapshotId: `legacy-${assetId}-${n}`, assetId, runId: null, generatedAt: `${date}T12:00:00.000Z`, latestPriceDate: date,
    asset, currency: "EUR", unitPrice: null, value: null, fxRate: 0.92, fxDate: date, valueEUR, originalAmount: valueEUR / 0.92,
    originalCurrency: "USD", legacySnapshotId: `old-${n}`, sources: [], confidence: null, incomplete: false, stale: false,
    comments: "Imported from the old Investments module", source: "legacy",
  });
  pv2Snapshots.unshift(mk("pa-t1", pv2Assets[0], alpha), mk("pa-t2", pv2Assets[3], beta));
});
const pv2Ai = { configured: true, keyUpdatedAt: `${y}-11-01T10:00:00Z`, model: "claude-opus-5-5", maxSearches: 5, enabled: true };

export const db = { incomes, expenses, splits, books, snapshots, operations, fx, locations, templates, entries, users, pv2Assets, pv2Snapshots, pv2Ai };
