# Investments Module – Requirements

## Overview

A **desktop-only** page (`/investments`) to track the user's investment portfolio across multiple platforms. Everything lives on a single scrollable page with four logical sections:

1. **Current Holdings** — latest known value per platform, shown as summary cards. Shares row with the Portfolio Evolution chart.
2. **Portfolio Evolution Chart** — shows what the portfolio would look like had all historical deposits been invested in the S&P 500 (S&P simulation line), alongside the real portfolio total and individual platform lines.
3. **P&L Evolution (%)** — combined chart showing portfolio period-return % and S&P 500 monthly % change, plus an average comparison bar chart.
4. **Operations Log** — a table of all deposits and withdrawals, with the ability to add, edit, and delete entries.
5. **Portfolio Snapshots** — a table of all portfolio value readings, with the ability to add, edit, and delete snapshot records.

The page is **not accessible on mobile** — it does not appear in the mobile tab bar and the route is not linked from any mobile navigation element.

---

## Platforms

Fixed list — no free-text entry, no CRUD for platforms in the UI. The same list is shared across all sections.

| Platform | Default Currency |
|---|---|
| eToro | USD |
| Binance | USD |
| Fidelity | USD |
| Tradeville | USD |
| ING Funds RON | RON |
| ING Funds EUR | EUR |

> **Migration note**: "ING mutual fonds" entries in `Portfolio.xlsx` pre-date the EUR fund split and map to **ING Funds RON**. "Fidelity DXC" in the spreadsheet maps to **Fidelity**.

---

## Historical Data (from Portfolio.xlsx)

### Operations — 32 entries

| Date | Type | Platform | Amount |
|---|---|---|---|
| 2021-06-10 | Deposit | eToro | 210 |
| 2021-10-07 | Deposit | eToro | 210 |
| 2022-05-25 | Deposit | eToro | 208.74 |
| 2022-06-23 | Deposit | eToro | 209.99 |
| 2022-07-31 | Deposit | eToro | 201.51 |
| 2022-08-25 | Deposit | eToro | 196.68 |
| 2022-09-23 | Deposit | eToro | 50.94 |
| 2022-09-27 | Deposit | eToro | 200 |
| 2022-10-30 | Deposit | eToro | 200 |
| 2022-11-29 | Deposit | Binance | 137.41 |
| 2022-11-25 | Deposit | ING Funds RON | 261.03 |
| 2022-12-06 | Deposit | ING Funds RON | 273 |
| 2022-12-09 | Deposit | ING Funds RON | 212 |
| 2023-01-10 | Deposit | ING Funds RON | 609 |
| 2023-02-10 | Deposit | ING Funds RON | 604.20 |
| 2023-03-10 | Deposit | eToro | 600 |
| 2023-04-10 | Deposit | ING Funds RON | 530 |
| 2023-05-10 | Deposit | ING Funds RON | 530 |
| 2023-06-10 | Deposit | eToro | 636.65 |
| 2023-06-27 | Deposit | Tradeville | 1,176 |
| 2023-09-11 | Deposit | Tradeville | 525 |
| 2023-10-10 | Deposit | eToro | 517.25 |
| 2023-11-11 | Deposit | eToro | 522.70 |
| 2023-12-08 | Deposit | eToro | 526.55 |
| 2024-01-10 | Deposit | Tradeville | 525 |
| 2024-03-13 | Deposit | Tradeville | 525 |
| 2024-04-13 | Deposit | Tradeville | 539 |
| 2024-05-10 | Deposit | ING Funds RON | 1,083 |
| 2024-11-11 | Deposit | ING Funds RON | 533 |
| 2024-12-10 | Deposit | Tradeville | 1,050 |
| 2025-05-27 | Deposit | Fidelity | 10,032 |
| 2025-05-25 | Deposit | eToro | 5,676 |

### Portfolio Snapshots — 20 entries

Each row is a point-in-time reading; a `—` means no reading was recorded for that platform on that date.

| Date | eToro | Binance | Fidelity | Tradeville | ING Funds RON | ING Funds EUR |
|---|---|---|---|---|---|---|
| 2022-12-06 | 1,323 | 141 | — | — | 2,573 | — |
| 2023-01-10 | 1,342 | 132 | — | — | 6,475 | — |
| 2023-02-10 | 1,615 | 164 | — | — | 9,400 | — |
| 2023-03-10 | 2,087 | 145 | — | — | 9,258 | — |
| 2023-04-10 | 2,840 | 188 | — | — | 11,718 | — |
| 2023-05-10 | 2,790 | 176 | — | — | 14,193 | — |
| 2023-06-10 | 3,351 | 156 | — | — | 14,491 | — |
| 2023-06-27 | — | — | — | 1,176 | — | — |
| 2023-10-10 | 3,941 | 154 | — | 1,823 | 13,872 | — |
| 2023-11-11 | 5,307 | 216 | — | 1,858 | 14,045 | — |
| 2024-01-10 | 6,506 | 0 | — | 2,729 | 15,093 | — |
| 2024-03-13 | 7,584 | — | — | 3,181 | 16,918 | — |
| 2024-04-13 | — | — | — | 3,717 | — | — |
| 2024-05-10 | 6,839 | — | — | 3,839 | 22,398 | — |
| 2024-11-11 | 7,428 | — | — | 3,926 | 26,490 | — |
| 2024-04-11 | 6,100 | — | — | 5,225 | 14,761 | 1,981 |
| 2025-05-27 | 7,582 | — | 10,032 | 5,316 | 15,648 | 2,173 |
| 2025-05-25 | 13,600 | — | 10,222 | 5,824 | 16,295 | 2,164 |
| 2025-09-15 | 14,547 | — | 9,535 | 6,332 | 17,281 | 2,121 |
| 2025-12-25 | 14,516 | — | 10,222 | 7,047 | 18,997 | 2,103 |

---

## Database Schema

### Table 1: `InvestmentOperations`

Tracks every deposit or withdrawal.

| Attribute | Type | Notes |
|---|---|---|
| `operationId` | String (PK) | UUID |
| `userId` | String | Cognito sub |
| `date` | String | ISO 8601 (`YYYY-MM-DD`) |
| `type` | String | `Deposit` \| `Withdrawal` |
| `platform` | String | One of the 6 platforms |
| `amount` | Number | Always positive |
| `currency` | String | `EUR` \| `USD` \| `RON`; defaults from platform |
| `notes` | String | Optional free-text |

**GSI**: `date-index` on `date` — for date-range filtering.

---

### Table 2: `PortfolioSnapshots`

Tracks the total value held on a platform at a point in time. Each record is a **single platform reading** — multiple records may share the same date (one per platform updated that day).

| Attribute | Type | Notes |
|---|---|---|
| `snapshotId` | String (PK) | UUID |
| `userId` | String | Cognito sub |
| `date` | String | ISO 8601 (`YYYY-MM-DD`) |
| `platform` | String | One of the 6 platforms |
| `amount` | Number | Total value held on that platform at that date |
| `currency` | String | `EUR` \| `USD` \| `RON`; defaults from platform |

**GSI**: `date-index` on `date` — for date-range and latest-snapshot queries.

> **Design rationale**: one row per platform per snapshot (not one wide row for all platforms) so the user can record a single platform reading without having to enter all six at once — matching real usage patterns in the historical data. The "latest value" per platform is derived at query time by taking the most recent record per platform.

---

### Table 3: `SP500Monthly`

Stores monthly S&P 500 closing prices used for benchmark simulation.

| Attribute | Type | Notes |
|---|---|---|
| `monthId` | String (PK) | `YYYY-MM` format (e.g. `2023-01`) |
| `close` | Number | S&P 500 closing price for that month |

No GSI — all rows are fetched in full for simulation calculations.

---

## API Endpoints

### Operations

| Method | Path | Description |
|---|---|---|
| `GET` | `/investments/operations` | List all; supports `?from=&to=&platform=&type=` |
| `POST` | `/investments/operations` | Create a deposit or withdrawal |
| `PUT` | `/investments/operations/{operationId}` | Edit an operation |
| `DELETE` | `/investments/operations/{operationId}` | Delete an operation |

### Portfolio Snapshots

| Method | Path | Description |
|---|---|---|
| `GET` | `/investments/snapshots` | List all; supports `?from=&to=&platform=` |
| `GET` | `/investments/snapshots/latest` | Most recent snapshot per platform (powers Current Holdings cards) |
| `POST` | `/investments/snapshots` | Record a new platform value reading |
| `PUT` | `/investments/snapshots/{snapshotId}` | Update an existing snapshot in-place |
| `DELETE` | `/investments/snapshots/{snapshotId}` | Delete a snapshot |

### S&P 500 Data

| Method | Path | Description |
|---|---|---|
| `GET` | `/sp500` | Returns all rows from the `SP500Monthly` table |

---

## Page Layout

The `/investments` page is a single scrollable page with four vertical sections:

```
┌──────────────────────────────────────────────────────────────────────┐
│  CURRENT HOLDINGS (30%)  │  PORTFOLIO EVOLUTION CHART (70%)         │
│  [ eToro ]  [ Binance ]  │  Legend: [Portfolio total] [eToro] ...   │
│  [ Fidelity ] [Tradeville]│         [Binance] ... [S&P simulation]  │
│  [ ING RON ] [ ING EUR ] │  Grey line: Portfolio total              │
│  Latest value + date     │  Platform lines (togglable, hidden by    │
│                          │    default)                              │
│                          │  Amber line: S&P simulation (last)       │
│                          │  Dots at operation months; rich tooltip  │
├──────────────────────────────────────────────────────────────────────┤
│  P&L EVOLUTION (%)                                           (full)  │
│  Left: indigo portfolio period-return line + green S&P monthly %    │
│  Right (30%): bar chart — avg portfolio P&L % vs avg S&P %         │
│  Reference lines at averages                                        │
├──────────────────────────────────────────────────────────────────────┤
│  PORTFOLIO SNAPSHOTS                       [+ Add Snapshot]  (full)  │
│  Table: Date · Platform · Amount · Currency · Edit · Delete         │
├──────────────────────────────────────────────────────────────────────┤
│  OPERATIONS LOG                         [+ Add Operation]   (full)  │
│  Table: Date · Platform · Type · Amount · Currency · Notes          │
│         Edit · Delete                                               │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Functional Requirements

### FR-1 Navigation
A **"Investments"** link appears in the **desktop Topbar only**. It must not appear in the mobile bottom tab bar, and the route must not be reachable from any mobile navigation element.

### FR-2 Current Holdings Section
- Displays one card per platform showing: platform name, latest recorded amount, currency, and the date of the last snapshot.
- If no snapshot exists for a platform yet, the card shows "No data".
- Powered by `GET /investments/snapshots/latest`.
- Occupies the left 30% of the top row; the Portfolio Evolution chart fills the remaining 70%.

### FR-3 Portfolio Evolution Chart

A `recharts` `LineChart` displayed in the top row (right 70%). Section title: **"Portfolio evolution"**. Contains three categories of lines, all togglable via legend buttons above the chart.

#### Legend buttons (left → right order)
1. **Portfolio total** (grey `#94a3b8`)
2. Individual platform chips (one per active platform, colour-coded)
3. **S&P simulation** (amber `#f59e0b`) — always last

Platform lines are **hidden by default** on first render; Portfolio total and S&P simulation are visible by default.

#### Lines rendered

| Line | `dataKey` | Colour | Dots | Default |
|---|---|---|---|---|
| Portfolio total | `portfolio` | `#94a3b8` | At operation months | Visible |
| eToro | `eToro` | `#22c55e` | At operation months | Hidden |
| Binance | `Binance` | `#f59e0b` | At operation months | Hidden |
| Fidelity | `Fidelity` | `#3b82f6` | At operation months | Hidden |
| Tradeville | `Tradeville` | `#a855f7` | At operation months | Hidden |
| ING Funds RON | `ING Funds RON` | `#ef4444` | At operation months | Hidden |
| ING Funds EUR | `ING Funds EUR` | `#f97316` | At operation months | Hidden |
| S&P simulation | `adjusted` | `#f59e0b` | At operation months | Visible |

All lines use `connectNulls={true}`.

---

#### Data computation — `testingChartData` useMemo

Inputs: `sp500` (all SP500Monthly records), `operations`, `snapshotsInEUR` (snapshots converted to EUR), `fxRates`.

**Step 1 — Filter visible months**

```js
const allSorted = [...sp500].sort((a, b) => a.monthId.localeCompare(b.monthId));
const visible = allSorted.filter(d => d.monthId.slice(0, 4) >= "2023");
```

Only months from 2023 onward are shown.

**Step 2 — Find `startPortfolio`**

The S&P simulation needs an anchor value. Find the snapshot date closest to the first visible month (`visible[0].monthId`):

```js
const chartStartMonth = visible[0]?.monthId ?? "2023-01";
// Build totalByDate: { "YYYY-MM-DD": sumOfAllPlatformsInEUR }
snapshotsInEUR.forEach(s => { totalByDate[s.date] = (totalByDate[s.date] ?? 0) + s.amount; });
// Pick the snapshot date whose timestamp is closest to chartStartMonth
const closestSnapDate = snapshotDates.reduce((best, d) =>
  Math.abs(new Date(d) - new Date(chartStartMonth + "-01")) <
  Math.abs(new Date(best) - new Date(chartStartMonth + "-01")) ? d : best
);
const startPortfolio = totalByDate[closestSnapDate]; // EUR total at that date
```

If no snapshots exist, the chart renders nothing.

**Step 3 — Carry-forward helpers**

```js
// portfolioAt(monthId): sum of latest snapshot per platform up to end of that month
function portfolioAt(monthId) {
  const endOfMonth = monthId + "-31";
  return PLATFORMS.reduce((sum, p) => {
    const arr = snapshotsByPlatform[p] ?? [];
    let latest = null;
    for (const s of arr) { if (s.date <= endOfMonth) latest = s; else break; }
    return sum + (latest?.amount ?? 0);
  }, 0);
}

// platformAt(platform, monthId): latest snapshot for a single platform up to end of that month
function platformAt(platform, monthId) { /* same logic, single platform */ }
```

Snapshots are pre-sorted ascending by date per platform. "End of month" is `monthId + "-31"` (intentionally beyond the last day so all dates in that month match).

**Step 4 — Cash flows per month**

```js
const opCashByMonth = {}; // { "YYYY-MM": netEUR }
operations.forEach(op => {
  const month = op.date.slice(0, 7);
  const eur = toEUR(op.amount, op.currency, fxRates);
  opCashByMonth[month] = (opCashByMonth[month] ?? 0) + (op.type === "Withdrawal" ? -eur : eur);
});
const opMonths = new Set(operations.map(op => op.date.slice(0, 7)));
```

`toEUR(amount, currency, rates)` converts using live rates from `frankfurter.app` (USD→EUR, RON→EUR; EUR stays as-is).

**Step 5 — Build data points (the core simulation loop)**

State carried across iterations:
- `runningValue` — starts at `startPortfolio`; the S&P simulation value
- `lastOpValue` — `runningValue` at the most recent operation month (for tooltip ①)
- `lastOpClose` — S&P 500 close at the most recent operation month (for tooltip ②)

```js
let runningValue = startPortfolio;
let lastOpValue  = startPortfolio;
let lastOpClose  = visible[0]?.close ?? 1;

const data = visible.map((d, i) => {
  let spPct = null, spGrowthSinceLastOp = null,
      valueBeforeCash = null, cashFlow = null, prevOpValue = null;

  if (i > 0) {
    const prevClose = visible[i - 1].close;

    // Apply S&P 500 monthly growth to runningValue
    if (prevClose > 0) {
      spPct = (d.close - prevClose) / prevClose * 100;
      runningValue = runningValue * (d.close / prevClose);
    }

    // If this month has operations, add/subtract cash flows
    if (opMonths.has(d.monthId)) {
      prevOpValue         = lastOpValue;                          // tooltip ①
      spGrowthSinceLastOp = (d.close - lastOpClose) / lastOpClose * 100; // tooltip ②
      valueBeforeCash     = runningValue;                         // tooltip ③

      cashFlow     = opCashByMonth[d.monthId] ?? 0;
      runningValue += cashFlow;                                   // apply cash

      lastOpValue = runningValue;   // advance anchors
      lastOpClose = d.close;
    }
  } else {
    lastOpClose = d.close; // first month: set anchor, no growth applied
  }

  return {
    date: d.monthId, x: dateToX(d.monthId + "-01"), close: d.close,
    adjusted:  runningValue,          // S&P simulation line
    portfolio: portfolioAt(d.monthId), // Portfolio total line
    ...platformValues,                 // one key per platform
    // Tooltip context (only populated at operation months, i > 0):
    spPct, spGrowthSinceLastOp, valueBeforeCash, prevOpValue, cashFlow,
    hasOp: opMonths.has(d.monthId),
    ops: operations.filter(op => op.date.slice(0, 7) === d.monthId),
  };
});
```

**Key invariant**: S&P growth is applied first (`runningValue *= ratio`), then cash is added/subtracted (`runningValue += cashFlow`). The first month is the anchor — no growth or cash is applied.

---

#### Tooltip behaviour

- **Non-operation months**: shows `adjusted` (S&P simulation value) and `spPct` (S&P % change this month).
- **Operation months** (i > 0, `hasOp === true`): shows a numbered step-by-step breakdown:

```
① Value at last op-point:    12,345 EUR
② S&P 500 growth since then: +4.23%
③ After S&P growth:          12,867 EUR
── ── ──
④ Deposit · eToro            +636.65 USD
④ Deposit · ING Funds RON    +530 RON
   Net cash (EUR):            +1,100 EUR
── ── ──
= S&P simulation:            13,967 EUR
```

All EUR amounts formatted with `ro-RO` locale (dots as thousands separator, commas as decimal).

---

#### X-axis

Uses a numeric `x` value computed as fractional year position:

```js
function dateToX(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return (y - baseYear) + (new Date(y, m-1, d) - new Date(y, 0, 1)) /
                          (new Date(y+1, 0, 1) - new Date(y, 0, 1));
}
```

X-axis ticks are placed at integer year boundaries; tick labels show the 4-digit year.

---

#### Data sources

| Data | API call | Used for |
|---|---|---|
| S&P 500 monthly closes | `GET /sp500` | Growth multiplier each month; `lastOpClose` anchor |
| Portfolio snapshots | `GET /investments/snapshots` | `portfolioAt`, `platformAt`, `startPortfolio` |
| Investment operations | `GET /investments/operations` | `opMonths`, `opCashByMonth`, tooltip `ops` list |
| FX rates | `GET https://api.frankfurter.app/latest?base=EUR` | `toEUR` conversion for cash flows |

### FR-4 P&L Evolution Chart
- A full-width `recharts` ComposedChart section below the top row.
- **Left panel (70%)**: combined line chart with `connectNulls`:
  - **Indigo line** — portfolio period-return %: `(currentPortfolio - prevPortfolio - netCash) / prevPortfolio × 100` per snapshot period.
  - **Green line** — S&P 500 monthly % change: `(close[month] - close[prevMonth]) / close[prevMonth] × 100`.
- **Right panel (30%)**: bar chart showing average portfolio P&L % vs average S&P 500 % over the same period.
- Reference lines at the average values for each series.
- All amounts converted to EUR for portfolio calculations.

### FR-5 Operations Log Section
- Table of all deposit/withdrawal records, newest first.
- Columns: Date, Platform, Type, Amount, Currency, Notes, Edit (pencil), Delete (✕).
- **+ Add Operation** button opens a modal form:
  - Date (date picker, pre-filled today, editable)
  - Type: `Deposit` / `Withdrawal` (toggle or dropdown)
  - Platform (dropdown, 6 options)
  - Amount (number > 0)
  - Currency (dropdown, pre-filled from platform default, editable)
  - Notes (optional text)
- Clicking **Edit** on a row opens the same modal pre-filled with that row's data; saves via `PUT`.
- Clicking **Delete** removes the row after confirmation.

### FR-6 Portfolio Snapshots Section
- Table of all snapshot records, newest first.
- Columns: Date, Platform, Amount, Currency, Edit (pencil), Delete (✕).
- **+ Add Snapshot** button opens a modal form:
  - Date (date picker, pre-filled today, editable)
  - Platform (dropdown, 6 options)
  - Amount (number ≥ 0)
  - Currency (dropdown, pre-filled from platform default, editable)
- Clicking **Edit** on a row opens the same modal pre-filled with that row's data; saves via `PUT /investments/snapshots/{snapshotId}`.
- Clicking **Delete** removes the row; Current Holdings cards and charts update accordingly.

### FR-7 Platform List
Fixed application constant — no CRUD in the UI. Same 6 platforms used in all sections.

### FR-8 Currency / FX Conversion
- All portfolio amounts are converted to EUR for chart calculations (S&P Simulation, P&L Evolution, portfolio total line).
- Live exchange rates fetched from `https://api.frankfurter.app/latest?base=EUR`.
- USD → EUR and RON → EUR conversions applied at fetch time using the live rate.
- Platform default currencies: eToro = USD, Binance = USD, Fidelity = USD, Tradeville = USD, ING Funds RON = RON, ING Funds EUR = EUR.

### FR-9 Desktop Only
The feature is desktop-only. It must not appear in mobile navigation and must not be accessible from any mobile navigation element.

---

## Non-Functional Requirements

| # | Requirement |
|---|---|
| NFR-1 | Three DynamoDB tables: `InvestmentOperations`, `PortfolioSnapshots`, `SP500Monthly`, defined in `backend/template.yaml`. |
| NFR-2 | Lambda handlers and routes for investments, snapshots, and SP500 registered in SAM template. |
| NFR-3 | All records scoped by `userId`; every read, write, and delete validates ownership (SP500Monthly is shared/unscoped). |
| NFR-4 | Historical data seeded via dedicated one-off scripts (see Seed Scripts section). |
| NFR-5 | Follows the existing design system (CSS variables, modal and table patterns from other pages). |
| NFR-6 | Desktop only — not present in mobile tab bar or any mobile navigation. |
| NFR-7 | Charts use `recharts` (already a project dependency). |

---

## Seed / Local Dev Scripts

All scripts live in `backend/src/` unless noted.

| Script | Purpose |
|---|---|
| `backend/src/seed-investments.mjs` | Seeds 32 historical operations and ~68 portfolio snapshots. Production: uses real AWS credentials. Local: prefix with `DYNAMODB_ENDPOINT=http://localhost:8000`. |
| `backend/src/seed-investments-local.mjs` | Seeds investment operations and snapshots specifically for `local-dev` userId. |
| `backend/src/seed-sp500.mjs` | Seeds the `SP500Monthly` table from historical S&P 500 monthly close data. Run once per environment. |
| `backend/src/seed-local.mjs` | Seeds incomes and expenses for the `local-dev` userId. |
| `backend/src/sync-from-aws.mjs` | Syncs all 6 AWS DynamoDB tables to local DynamoDB, remapping the real Cognito userId to `"local-dev"`. |
| `backend/create-tables.mjs` | Creates all local DynamoDB tables programmatically (alternative to `docker/init-tables.sh`). |
| `scripts/seed-local.mjs` | Convenience wrapper that calls `backend/src/seed-local.mjs`. |

`docker/init-tables.sh` also creates the `SP500Monthly` table as part of local bootstrap.

### Running seed scripts

```bash
# Seed investments (production)
cd backend
node src/seed-investments.mjs

# Seed investments (local DynamoDB)
DYNAMODB_ENDPOINT=http://localhost:8000 node src/seed-investments.mjs

# Seed S&P 500 data (local)
DYNAMODB_ENDPOINT=http://localhost:8000 node src/seed-sp500.mjs

# Seed incomes/expenses (local)
DYNAMODB_ENDPOINT=http://localhost:8000 node src/seed-local.mjs

# Sync AWS data to local (remaps userId → "local-dev")
DYNAMODB_ENDPOINT=http://localhost:8000 node src/sync-from-aws.mjs
```

---

## Acceptance Tests

| # | Test | Expected Result |
|---|---|---|
| I-1 | Navigate to `/investments` on desktop | Single page loads with all four sections visible (Holdings + Portfolio Evolution chart top row, P&L Evolution, Snapshots, Operations) |
| I-2 | View on mobile | "Investments" absent from bottom tab bar; route not accessible from mobile navigation |
| I-3 | Current Holdings cards on first load (after seed) | Each active platform shows its latest amount and snapshot date |
| I-4 | Portfolio Evolution chart on first load | Grey portfolio total line and amber S&P simulation line rendered; individual platform lines hidden but togglable via legend |
| I-5 | Toggle a platform line in the chart legend | Line disappears / reappears; S&P simulation chip is the last button in the legend row |
| I-6 | S&P simulation tooltip at an operation dot | Shows numbered breakdown: ① value at last op-point → ② S&P 500 growth since then → ③ value after S&P growth → ④ each deposit/withdrawal → net cash (EUR) → = S&P simulation value |
| I-7 | P&L Evolution chart on first load | Indigo portfolio % line and green S&P 500 % line both rendered; right bar chart shows average comparison |
| I-8 | Click **+ Add Operation**, fill form, save | `POST /investments/operations` called; new row appears at top of Operations table |
| I-9 | Edit an existing operation | `PUT /investments/operations/{id}` called; row updates |
| I-10 | Delete an operation | `DELETE` called; row removed |
| I-11 | Click **+ Add Snapshot** for eToro | `POST /investments/snapshots` called; eToro Holdings card updates to new value; charts update |
| I-12 | Edit an existing snapshot | `PUT /investments/snapshots/{id}` called; row updates in table and charts refresh |
| I-13 | Delete a snapshot | Record removed; Holdings card reverts to previous snapshot value |
| I-14 | Refresh page | All data persists (fetched from DynamoDB) |
| I-15 | Seed script runs against local DynamoDB | All 32 operations and snapshot records imported without errors |
| I-16 | `seed-sp500.mjs` runs against local DynamoDB | SP500Monthly table populated; S&P Simulation chart renders correctly |
| I-17 | `sync-from-aws.mjs` runs | All 6 tables synced locally; userId remapped to `"local-dev"`; local app shows production data |
