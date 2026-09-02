# Investments Module – Requirements

## Overview

A **PWA-first** page (`/investments`) to track the user's investment portfolio across multiple platforms. It renders as a **single phone-width column, centered on desktop as well as mobile** — same widths, paddings and font sizes on every screen — and is built as four stacked blocks:

1. **Total portfolio** — expandable. Collapsed it shows the total value in EUR; expanded it breaks the total down per platform, using each platform's latest snapshot.
2. **Portfolio evolution** — a line chart of the actual portfolio value in EUR, month by month, **starting from 2023**.
3. **Portfolio snapshots** — snapshot readings grouped by date, showing the **3 most recent dates** with a *Show 3 more* control.
4. **Operations log** — deposits and withdrawals, showing the **3 most recent entries** with the same *Show 3 more* control.

Snapshots and operations are created, edited, and deleted from **bottom sheets**; deletes use a two-step inline confirm.

The page is reachable from the **mobile bottom tab bar** (Investments tab, after Split Pay) and from the **desktop Sidebar** (Finance → Investments).

> There is no S&P 500 simulation and no P&L Evolution chart — both were removed from the product.

**File**: `frontend/src/pages/Investments.jsx` (self-contained; no `useIsMobile`, no external CSS).

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
| `GET` | `/investments/snapshots/latest` | Most recent snapshot per platform |
| `POST` | `/investments/snapshots` | Record a new platform value reading |
| `PUT` | `/investments/snapshots/{snapshotId}` | Update an existing snapshot in-place |
| `DELETE` | `/investments/snapshots/{snapshotId}` | Delete a snapshot |

### FX Rates

| Method | Path | Description |
|---|---|---|
| `GET` | `/fx-rates` | Public. Returns the stored `{ rates, updatedAt }` EUR/USD/RON matrix |

The page never fetches rates from a third party at runtime — it reads the shared rates stored in the `FxRates` table, refreshed manually from **Admin → FX Rates**.

---

## Page Layout

`/investments` is a **single phone-width column (`max-width: 430px`), centered on desktop too** — same widths, paddings and font sizes on every screen, mirroring Split Pay and Home Overview. There is no separate desktop layout and no `useIsMobile` branch: one layout, width-capped by the `COL_WIDTH` constant.

The column is a page header plus four stacked blocks:

```
┌────────────────────────────────┐  ← max-width 430px, centered
│ Investments                    │
│ N snapshots · M operations     │
├────────────────────────────────┤
│ ▸ TOTAL PORTFOLIO              │  Block 1 — expandable
│   7.168,4  EUR                 │  collapsed by default
│   4 platforms · FX 30 Aug 2026 │
│   ── expanded ──────────────── │
│   ● eToro           2.315      │  per-platform breakdown:
│   ▬▬▬▬▬▬▬░░░░░░░░░  32,3%      │  share bar, share %,
│   32,3% · 2.500 USD · 1 Aug 26 │  original currency, date
├────────────────────────────────┤
│ PORTFOLIO EVOLUTION            │  Block 2
│ Actual value in EUR since 2023 │
│ [Total][eToro][Binance]…       │  legend toggle chips
│ ╭────────────────────────────╮ │
│ │      line chart, 210px     │ │
│ ╰────────────────────────────╯ │
├────────────────────────────────┤
│ PORTFOLIO SNAPSHOTS    [+ Add] │  Block 3
│ ▸ 1 Aug 2026    ●●  7.168,4 EUR│  3 dates shown,
│ ▸ 1 Aug 2025    ●   6.335,0 EUR│  expandable per date
│ ▸ 1 Aug 2024    ●   3.406,6 EUR│
│   [ Show 3 more   3/5 ]        │
├────────────────────────────────┤
│ OPERATIONS LOG         [+ Add] │  Block 4
│ ▸ ● Fidelity  DEPOSIT          │  3 entries shown,
│   10 Jan 2026 · +700 USD       │  expandable per entry
│   [ Show 3 more   3/5 ]        │
└────────────────────────────────┘
```

---

## Functional Requirements

### FR-1 Navigation
- **Mobile**: an **Investments** tab in the bottom tab bar, placed **after Split Pay** (5th and last tab).
- **Desktop**: the existing **Finance → Investments** entry in the Sidebar.
- Route: `/investments`, registered in `App.jsx`.

### FR-2 Block 1 — Total portfolio (expandable)
- Collapsed head shows: `Total portfolio` label, the total value in EUR, and a meta line with the number of platforms still holding money and the FX-rate date (`FX <date>`, or `no FX rates set`).
- Tapping the head expands the **holdings breakdown** — one row per platform, in the fixed platform order.
- Each holding row shows: colour dot, platform name, amount in EUR, a share bar in the platform colour, the share %, the original amount + currency (only when not already EUR), and the date of that platform's latest snapshot.
- The breakdown lists **every platform whose latest snapshot is > 0** (`heldPlatforms`) — exactly the platforms that make up the total, so the shares add up to 100 %. A platform that has gone quiet still appears here as long as it holds money.
- All amounts are converted to EUR using the stored FX rates.

### FR-3 Block 2 — Portfolio evolution chart
- A `recharts` `LineChart` at 210 px height, plotting the **actual portfolio value in EUR** month by month. No S&P 500 simulation and no P&L chart — both were removed.
- **The plotted range starts at `CHART_START` (`2023-01`)**. Snapshots and operations before that date still feed the carry-forward, but are never plotted. If the earliest data is later than `CHART_START`, the chart starts at the earliest data instead.
- Lines: **Total** (grey `#94a3b8`, visible by default) plus one line per active platform (colour-coded, **hidden by default**), all with `connectNulls`.
- Legend toggle chips above the chart control which lines are drawn; active = coloured border + tinted background, inactive = dimmed.
- Platform chips list `activePlatforms` — platforms with a snapshot > 0 in the last 12 months — to keep the legend free of platforms that have gone quiet. (Block 1 deliberately uses the wider `heldPlatforms` set instead.)
- Per-month values carry forward the latest snapshot per platform (`platformAt` / `portfolioAt`); the month spine runs from `CHART_START` (or the earliest data) to the latest snapshot/operation month.
- Dots mark months that contain operations; the custom dot renderer guards `isNaN(cy)` to prevent phantom half-dots.
- Tapping a point shows a tooltip with the actual portfolio value, each operation that month, and the net cash flow in EUR.

### FR-4 Block 3 — Portfolio snapshots
- Snapshots are **grouped by date**, newest first. One card per date.
- Collapsed card head shows: the date, a badge with how many platforms were recorded that day, a colour dot per recorded platform, and the **carry-forward portfolio total in EUR** as of that date.
- Tapping the head expands the card to one row per platform: colour dot, platform name, amount + currency, the `≈ N EUR` equivalent when the currency is not EUR, and ✎ / ✕ buttons.
- An **+ Add platform to this date** button inside the expanded card opens the sheet pre-filled with that date.
- Only the **3 most recent dates** are listed. A **Show 3 more** button (with an `N/total` counter) reveals three more at a time; **Show less** collapses back to 3.

### FR-5 Block 4 — Operations log
- One card per operation, newest first.
- Collapsed card head shows: platform colour dot, platform name, a `DEPOSIT` / `WITHDRAWAL` badge (green / red), the date, and the signed amount + currency.
- Tapping the head expands the card to show the notes (when present) and **Edit** / **Delete** actions.
- Only the **3 most recent operations** are listed, with the same **Show 3 more** / **Show less** control as Block 3.

### FR-6 Adding and editing
Both forms are **bottom sheets** (rounded top, grabber, `env(safe-area-inset-bottom)` padding) at column width, on desktop as well as mobile.

**Snapshot sheet** — Date (pre-filled today, or the card's date), Platform (dropdown), Amount (number ≥ 0), Currency (dropdown, pre-filled from the platform default and editable).
**Operation sheet** — Date, Type (segmented **Deposit / Withdrawal** control, green / red when selected), Platform, Amount (number > 0), Currency, Notes (optional).

- Create uses `POST`; edit uses `PUT` for both snapshots and operations — a snapshot edit updates in place and keeps its `snapshotId`.
- All inputs use `font-size: 16px` to stop iOS zoom-on-focus.

### FR-7 Deleting
Delete is a **two-step inline confirm** — the first tap arms it (`Delete` → `Tap to confirm` for operations, `✕` → `!` for snapshot rows) and it auto-reverts after 4 s. No `window.confirm`, no separate dialog.

### FR-8 Platform list
Fixed application constant — no CRUD in the UI. The same 6 platforms and their colours are used in every block.

### FR-9 Currency / FX conversion
- Every amount displayed in EUR is converted with `toEUR()` using the shared rates from `GET /fx-rates`.
- `toEUR` reads the matrix form `rates[FROM].EUR`, with a fallback to the legacy flat form.
- Platform default currencies: eToro = USD, Binance = USD, Fidelity = USD, Tradeville = USD, ING Funds RON = RON, ING Funds EUR = EUR.

---

## Non-Functional Requirements

| # | Requirement |
|---|---|
| NFR-1 | Two DynamoDB tables: `InvestmentOperations` and `PortfolioSnapshots`, defined in `backend/template.yaml`. |
| NFR-2 | Lambda handlers and routes for operations and snapshots registered in the SAM template. |
| NFR-3 | All records scoped by `userId`; every read, write, and delete validates ownership. |
| NFR-4 | Historical data seeded via dedicated one-off scripts (see Seed Scripts section). |
| NFR-5 | Follows the existing design system — CSS variables only, no hard-coded theme colours, works in both dark and light themes. |
| NFR-6 | **PWA-first**: one phone-width layout for every screen; tap targets ≥ 38 px; bottom sheets; 16 px inputs; safe-area padding. |
| NFR-7 | Charts use `recharts` (already a project dependency). |
| NFR-8 | The page is self-contained in `frontend/src/pages/Investments.jsx` — no external CSS, no shared sub-components. |

---

## Seed / Local Dev Scripts

All scripts live in `backend/src/` unless noted.

| Script | Purpose |
|---|---|
| `backend/src/seed-investments-local.mjs` | Seeds investment operations and snapshots for the `local-dev` userId. |
| `backend/src/seed-local.mjs` | Seeds incomes and expenses for the `local-dev` userId. |
| `backend/src/sync-from-aws.mjs` | Syncs the AWS DynamoDB tables to local DynamoDB, remapping the real Cognito userId to `"local-dev"`. |

### Running seed scripts

```bash
cd backend

# Seed investments for local-dev
node src/seed-investments-local.mjs

# Seed incomes/expenses (local)
node src/seed-local.mjs

# Sync AWS data to local (remaps userId → "local-dev")
node src/sync-from-aws.mjs
```

---

## Tests

`frontend/src/pages/Investments.test.jsx` renders the page against mocked `investments` / `fxRates` APIs (9 tests):

| Test | Covers |
|---|---|
| renders the four blocks with data | Block titles, counts, and that the plotted line spans exactly the months from `CHART_START` — a pre-2023 snapshot feeds carry-forward but is not plotted |
| total block is collapsed and expands | FR-2 — collapsed by default; expanding lists every held platform, including stale ones |
| shows only 3 snapshot dates then reveals more | FR-4 — Show 3 more / Show less |
| expands a snapshot date | FR-4 — per-platform rows, EUR equivalent, add-to-this-date |
| shows only 3 operations then reveals more | FR-5 |
| expands an operation and deletes it | FR-5, FR-7 — two-step confirm; `DELETE` only fires on the second tap |
| opens the snapshot sheet and the operation sheet | FR-6 |
| saves a new operation through the sheet | FR-6 — `POST` payload |
| toggles chart legend lines | FR-3 |

---

## Acceptance Tests

| # | Test | Expected Result |
|---|---|---|
| I-1 | Open `/investments` on mobile and on desktop | Identical phone-width column with four stacked blocks; on desktop it is centered |
| I-2 | Mobile bottom tab bar | An **Investments** tab appears after **Split Pay** and routes to `/investments` |
| I-3 | Tap the Total portfolio block | Expands to the per-platform breakdown; shares sum to 100 % of the displayed total |
| I-4 | Portfolio evolution chart on first load | Only the grey **Total** line is drawn; platform lines hidden but togglable; the x-axis starts at 2023 |
| I-5 | Toggle a legend chip | The matching line appears / disappears; the chip dims when hidden |
| I-6 | Tap a chart point at an operation month | Tooltip shows the portfolio value, each operation, and net cash in EUR |
| I-7 | Portfolio snapshots block on first load | Exactly 3 date cards, collapsed, each showing the carry-forward EUR total |
| I-8 | Tap **Show 3 more** | Three more date cards appear; the counter updates; **Show less** returns to 3 |
| I-9 | Expand a snapshot date | Per-platform rows with amount, currency, EUR equivalent, and ✎ / ✕ |
| I-10 | **+ Add** on Snapshots, fill the sheet, save | `POST /investments/snapshots` called; the new reading appears and the total updates |
| I-11 | **+ Add platform to this date** inside a date card | Sheet opens pre-filled with that card's date |
| I-12 | Edit a snapshot | `PUT /investments/snapshots/{id}` called; the record updates in place and keeps its id |
| I-13 | Delete a snapshot (two taps) | First tap arms the confirm, second deletes; the total reverts to the previous reading |
| I-14 | Operations log on first load | Exactly 3 operation cards, collapsed, newest first |
| I-15 | **+ Add** on Operations, fill the sheet, save | `POST /investments/operations` called; the new operation appears at the top |
| I-16 | Edit / delete an operation | `PUT` / `DELETE` called; the two-step confirm guards the delete |
| I-17 | Refresh the page | All data persists (fetched from DynamoDB) |
| I-18 | Switch between dark and light theme | Every block, chip, sheet, and badge stays legible — CSS variables only |
