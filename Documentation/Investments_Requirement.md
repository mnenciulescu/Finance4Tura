# Investments Module – Requirements

## Overview

A new **desktop-only** page (`/investments`) to track the user's investment portfolio across multiple platforms. Everything lives on a single page with three logical sections:

1. **Current Holdings** — latest known value per platform, shown as summary cards.
2. **Portfolio Chart** — a line chart showing the evolution of each platform's value over time.
3. **Operations Log** — a table of all deposits and withdrawals, with the ability to add new entries.
4. **Snapshot Log** — a table of all portfolio value readings, with the ability to add new readings per platform.

The page is **not accessible on mobile** — it does not appear in the mobile tab bar and the route is not linked from any mobile navigation element.

---

## Platforms

Fixed list — no free-text entry, no CRUD for platforms in the UI. The same list is shared across all sections.

| Platform | Default Currency |
|---|---|
| eToro | USD |
| Binance | USD |
| Fidelity | USD |
| Tradeville | RON |
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
| `GET` | `/investments/snapshots/latest` | Most recent snapshot per platform (powers Current Holdings cards) |
| `POST` | `/investments/snapshots` | Record a new platform value reading |
| `DELETE` | `/investments/snapshots/{snapshotId}` | Delete a snapshot |

---

## Page Layout

The `/investments` page is a single scrollable page with four vertical sections:

```
┌─────────────────────────────────────────────────────┐
│  CURRENT HOLDINGS                                   │
│  [ eToro ] [ Binance ] [ Fidelity ] [ Tradeville ]  │
│  [ ING Funds RON ] [ ING Funds EUR ]                │
│  Latest value per platform + date of last reading   │
├─────────────────────────────────────────────────────┤
│  PORTFOLIO EVOLUTION  (line chart)                  │
│  One line per platform · X axis = date              │
│  Toggleable platform visibility                     │
├─────────────────────────────────────────────────────┤
│  OPERATIONS LOG                   [+ Add Operation] │
│  Table: Date · Platform · Type · Amount · Currency  │
│         Notes · Edit · Delete                       │
├─────────────────────────────────────────────────────┤
│  PORTFOLIO SNAPSHOTS              [+ Add Snapshot]  │
│  Table: Date · Platform · Amount · Currency         │
│         Delete                                      │
└─────────────────────────────────────────────────────┘
```

---

## Functional Requirements

### FR-1 Navigation
A **"Investments"** link appears in the **desktop Sidebar only**. It must not appear in the mobile bottom tab bar, and the route must not be reachable from any mobile navigation element.

### FR-2 Current Holdings Section
- Displays one card per platform showing: platform name, latest recorded amount, currency, and the date of the last snapshot.
- If no snapshot exists for a platform yet, the card shows "No data".
- Powered by `GET /investments/snapshots/latest`.

### FR-3 Portfolio Evolution Chart
- A `recharts` LineChart with one line per platform.
- X axis: date (chronological). Y axis: amount in native currency.
- Each line connects the snapshot readings for that platform over time (gaps between readings are bridged by carrying the last known value forward, so lines are continuous).
- Platform lines are togglable via a legend (click to show/hide).
- Powered by all records from `GET /investments/snapshots`.

### FR-4 Operations Log Section
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

### FR-5 Portfolio Snapshots Section
- Table of all snapshot records, newest first.
- Columns: Date, Platform, Amount, Currency, Delete (✕).
- **+ Add Snapshot** button opens a modal form:
  - Date (date picker, pre-filled today, editable)
  - Platform (dropdown, 6 options)
  - Amount (number ≥ 0)
  - Currency (dropdown, pre-filled from platform default, editable)
- Clicking **Delete** removes the row; Current Holdings cards and the chart update accordingly.

### FR-6 Platform List
Fixed application constant — no CRUD in the UI. Same 6 platforms used in all sections.

### FR-7 Currency Defaults
Selecting a platform in any form pre-fills currency with that platform's default. The currency field remains editable for edge cases.

### FR-8 Desktop Only
The feature is desktop-only. It must not appear in mobile navigation and must not be accessible from any mobile navigation element.

---

## Non-Functional Requirements

| # | Requirement |
|---|---|
| NFR-1 | Two new DynamoDB tables: `InvestmentOperations`, `PortfolioSnapshots`, defined in `backend/template.yaml`. |
| NFR-2 | Two new Lambda handlers and routes registered in SAM template. |
| NFR-3 | All records scoped by `userId`; every read, write, and delete validates ownership. |
| NFR-4 | Historical data from `Portfolio.xlsx` to be seeded via a one-off migration script. |
| NFR-5 | Follows the existing design system (CSS variables, modal and table patterns from other pages). |
| NFR-6 | Desktop only — not present in mobile tab bar or any mobile navigation. |
| NFR-7 | Chart uses `recharts` (already a project dependency). |

---

## Acceptance Tests

| # | Test | Expected Result |
|---|---|---|
| I-1 | Navigate to `/investments` on desktop | Single page loads with all four sections visible |
| I-2 | View on mobile | "Investments" absent from bottom tab bar; route not accessible from mobile navigation |
| I-3 | Current Holdings cards on first load (after seed) | Each active platform shows its latest amount and snapshot date |
| I-4 | Portfolio Evolution chart on first load | Lines visible for eToro, Binance, Tradeville, ING Funds RON, ING Funds EUR; Fidelity line starts from 2025-05-27 |
| I-5 | Toggle a platform line in the chart legend | Line disappears / reappears |
| I-6 | Click **+ Add Operation**, fill form, save | `POST /investments/operations` called; new row appears at top of Operations table |
| I-7 | Edit an existing operation | `PUT /investments/operations/{id}` called; row updates |
| I-8 | Delete an operation | `DELETE` called; row removed |
| I-9 | Click **+ Add Snapshot** for eToro | `POST /investments/snapshots` called; eToro Holdings card updates to new value; chart gains new data point |
| I-10 | Delete a snapshot | Record removed; Holdings card reverts to previous snapshot value |
| I-11 | Refresh page | All data persists (fetched from DynamoDB) |
| I-12 | Seed script runs against local DynamoDB | All 32 operations and 20 snapshot rows imported without errors |
