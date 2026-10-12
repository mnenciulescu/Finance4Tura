# 4TURA Home (Finance4Tura) – Structured Implementation Requirements

> Personal dashboard PWA, built in phases. Every phase below is implemented and deployed, and each section describes the app **as it behaves today**. Where a phase's original design was later replaced, that's noted in the phase.

---

## Phase 0 – Project Scaffold ✅

### Goal
Set up the monorepo and the toolchain every later phase builds on.

### What exists
1. **Monorepo**
   ```
   4TURAHome/
   ├── frontend/          # React app (Vite)
   ├── backend/           # AWS SAM project (Lambda functions)
   ├── scripts/           # One-off maintenance scripts
   ├── Documentation/
   └── README.md
   ```
2. **AWS SAM backend** — `backend/template.yaml` defines tables, Lambdas, API Gateway and IAM. `samconfig.toml` holds deploy defaults (stack `finance4tura-backend`).
3. **React frontend** — Vite + React 19 in `frontend/`. Dependencies: `axios`, `react-router-dom`, `dayjs`, `recharts`, `amazon-cognito-identity-js`.
4. **Auth** — `AuthContext.jsx` on the Cognito User Pool via `amazon-cognito-identity-js`. Vite needs `define: { global: 'globalThis' }` for that library.

> **Retired:** the original local stack (DynamoDB Local in Docker, `sam local start-api`, a `local-dev` user, seed scripts) was removed. The app runs against AWS only; `npm run dev` uses the deployed API and production data.

### Tests – Phase 0
| # | Test | Expected Result |
|---|------|-----------------|
| 0.1 | `ulimit -n 10240 && sam build --no-cached` in `backend/` | Builds with no errors |
| 0.2 | `npm run dev` in `frontend/` | App opens at `http://localhost:5173` against the deployed API |
| 0.3 | `GET /health` | `{ "status": "ok" }` |
| 0.4 | `npm test` in both packages | Suites run (see CLAUDE.md for current counts) |

---

## Phase 1 – Database Schema ✅

### Goal
Define the core tables. Later phases add more (see the table summary at the end).

#### `Incomes`
| Attribute | Type | Notes |
|-----------|------|-------|
| `incomeId` | String (PK) | UUID |
| `userId` | String | Cognito sub — filters records per user |
| `seriesId` | String | Shared by all occurrences of a repeating income; equals `incomeId` for single events |
| `summary` | String | Required |
| `date` | String | `YYYY-MM-DD`, required |
| `amount` | Number | Required, > 0 |
| `currency` | String | Default `RON` |
| `isRepeatable` | Boolean | Default `false` |
| `repeatFrequency` | String | `daily` \| `weekly` \| `monthly` — only when repeatable |
| `seriesEndDate` | String | `YYYY-MM-DD` — only when repeatable |
| `isException` | Boolean | `true` when this record overrides a single occurrence of a series |

#### `Expenses`
| Attribute | Type | Notes |
|-----------|------|-------|
| `expenseId` | String (PK) | UUID |
| `userId` | String | Cognito sub |
| `seriesId` | String | As for incomes |
| `summary` | String | Required |
| `priority` | String | `High` \| `Medium` \| `Low` — required |
| `date` | String | `YYYY-MM-DD`, required |
| `amount` | Number | Required, > 0 |
| `currency` | String | Default `RON` |
| `special` | Boolean | Default `false` — ★ and red row on the Dashboard |
| `isRepeatable`, `repeatFrequency`, `seriesEndDate`, `isException` | | As for incomes |
| `mappedIncomeId` | String | FK → `Incomes.incomeId` (auto-mapped) |
| `mappedIncomeSummary`, `mappedIncomeDate` | String | Denormalized for fast rendering |
| `status` | String | `Pending` \| `Completed` — default `Pending` |

### Tasks
- Both tables defined in `template.yaml`, pay-per-request, created on `sam deploy`.
- GSI `date-index` (hash key `date`) on both.

---

## Phase 2 – Backend: Income CRUD ✅

### Endpoints
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/incomes` | Create income (single or series) |
| `GET` | `/incomes` | List the user's incomes (supports `?from=&to=`) |
| `GET` | `/incomes/{incomeId}` | Get one occurrence |
| `PUT` | `/incomes/{incomeId}` | Edit one occurrence (sets `isException=true` if part of a series) |
| `PUT` | `/incomes/{incomeId}/series` | Edit all future occurrences |
| `DELETE` | `/incomes/{incomeId}` | Delete one; `?deleteSeries=true` deletes the series |

### Business Logic
- When `isRepeatable=true`, all occurrences between `date` and `seriesEndDate` are created up front, sharing a `seriesId`.
- `PUT` on one occurrence of a series sets `isException=true` on that record only.
- Every operation is scoped by `userId` (Cognito `sub`).
- `amount <= 0` → 400.

### Tests – Phase 2
| # | Test | Expected Result |
|---|------|-----------------|
| 2.1 | `POST /incomes` single | 201; item stored |
| 2.2 | `POST /incomes` monthly, 3-month window | 3 records sharing one `seriesId` |
| 2.3 | `GET /incomes?from=2025-02-01&to=2025-02-28` | Only incomes in range |
| 2.4 | `PUT /incomes/{id}` on a series member | Only that record changes |
| 2.5 | `DELETE /incomes/{id}` | Record removed |
| 2.6 | `DELETE /incomes/{id}?deleteSeries=true` | Whole series removed |

---

## Phase 3 – Backend: Expense CRUD + Auto-Mapping ✅

### Endpoints
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/expenses` | Create expense (single or series) |
| `GET` | `/expenses` | List (supports `?from=&to=`) |
| `GET` | `/expenses/{expenseId}` | Get one |
| `PUT` | `/expenses/{expenseId}` | Edit one occurrence |
| `PUT` | `/expenses/{expenseId}/series` | Edit all future occurrences |
| `DELETE` | `/expenses/{expenseId}` | Delete one; `?deleteSeries=true` deletes the series |
| `GET` | `/expenses/resolve-income?date={date}` | Preview which income a date maps to |

### Auto-Mapping Logic
`resolveIncome(expenseDate, userId)` in `expenses.mjs`:
1. Scans `Incomes` for the user's records with `date <= expenseDate`.
2. Takes the one with the latest date.
3. Stores `mappedIncomeId`, `mappedIncomeSummary` and `mappedIncomeDate` on the expense.
4. For a repeating expense, runs per occurrence date; re-runs when an expense's date changes.

`scripts/remap-expenses.mjs` re-applies the mapping to every expense in bulk.

### Tests – Phase 3
| # | Test | Expected Result |
|---|------|-----------------|
| 3.1 | Expense on Feb 11, incomes Feb 10 and Feb 25 | Maps to Feb 10 |
| 3.2 | Expense on Mar 4, same incomes | Maps to Feb 25 |
| 3.3 | Monthly expense × 3 | Each occurrence mapped on its own date |
| 3.4 | `GET /expenses/resolve-income?date=2025-03-04` | Returns the Feb 25 income |
| 3.5 | `PUT /expenses/{id}` changing date | Mapping recalculated |
| 3.6 | `DELETE /expenses/{id}?deleteSeries=true` | Whole series removed |

---

## Phase 4 – Frontend: Layout & Navigation ✅

### Goal
The application shell.

### Layout
- **Mobile-only**: every page is a centred phone-width column (430 px) on any screen. The original desktop top bar, `Sidebar.jsx` and `useIsMobile` were removed.
- **Top bar**: 4TURA Home wordmark, and an avatar with the user's initials that opens the **account menu** — username, session countdown, then **Settings · Admin · Sign out**. Backstage appears between Settings and Admin while enabled in App Settings; Admin only for the admin user.
- **Bottom bar**: **Home · Finance · Books · HQ**. Finance opens a sheet with Dashboard, Add Income, Add Expense, Split Pay, Statistics and Investments.
- A route change closes any open sheet or menu.
- **Routes**: `/`, `/finance`, `/add-income`, `/add-expense`, `/split-payments`, `/statistics`, `/investments`, `/books-and-dev`, `/headquarters`, `/settings`, `/backstage`, `/admin`. Unknown paths go to `/`.
- Configuration lives in `components/navConfig.js` (`navGroups`, `accountItems`).

### Tests – Phase 4
| # | Test | Expected Result |
|---|------|-----------------|
| 4.1 | Open the app | Bottom bar shows Home · Finance · Books · HQ |
| 4.2 | Tap Finance | Sheet lists its six pages; tapping Finance again closes it |
| 4.3 | Tap the avatar as the admin user | Settings, Admin, Sign out (Backstage too when enabled) |
| 4.4 | Same as another user, Backstage off | Settings, Sign out |
| 4.5 | Unauthenticated access | Login page instead of the app |

---

## Phase 5 – Frontend: Add & Edit Income Form ✅

### Form Fields
| Field | Type | Validation |
|-------|------|------------|
| Summary | Text | Required |
| Date | Date | Required; within the current year |
| Amount | Number | Required, > 0 |
| Currency | Select | Required, default `RON` |
| Repeatable | Toggle | Default off |
| Repeat Frequency | Select (`daily`, `weekly`, `monthly`) | Required when repeatable |
| Series End Date | Date | Required when repeatable; within the current year |

### Behavior
- Frequency and end date are hidden unless Repeatable is on.
- Submit calls `POST /incomes`; edit (`?id=`) pre-fills and calls `PUT /incomes/{id}`.
- Editing a series member offers **This occurrence only** or **Entire series**.
- Saving returns to the page it came from (`/finance` for links on an income card) and restores the income column.
- The form carries `.zoom-safe-form` so inputs are 16 px on phones.

---

## Phase 6 – Frontend: Add & Edit Expense Form ✅

### Form Fields
| Field | Type | Validation |
|-------|------|------------|
| Summary | Text | Required |
| Priority | Select (`High`, `Medium`, `Low`) | Required |
| Date | Date | Required; within the current year |
| Mapped Income | Read-only | From `GET /expenses/resolve-income` |
| Amount | Number | Required, > 0 |
| Currency | Select | Required, default `RON` |
| Special | Yes / No | Default No |
| Repeatable | Toggle | Default off |
| Repeat Frequency | Select | Required when repeatable |
| Series End Date | Date | Required when repeatable; within the current year |

### Behavior
- Changing the date previews the mapped income.
- Submit calls `POST /expenses`; edit calls `PUT /expenses/{id}`, or `/series` for the whole series.
- An income card's **+ Add** pre-fills the date and returns to the same column after saving.

---

## Phase 7 – Frontend: Finance Dashboard ✅

### Goal
Show income periods with their expenses. Route `/finance`.

### Behavior
- Loads `GET /incomes` and `GET /expenses`; shows **one income-period card at a time** for the selected year.
- Move between periods by swiping or with **← / ◎ / →** (◎ returns to the current period). Opening Dashboard from the Finance sheet jumps to the current period.
- Header row: **year stepper** (capped at the current year, shared with Statistics), the period buttons, and a **⋮ Finance menu** listing the six Finance pages plus **Show / Hide income amounts** (remembered on the device).
- The **current period** (latest income dated ≤ today) has a distinct header.
- Each card: income header with **+ Add** expense and edit link, expense rows, and a footer splitting spent (completed / pending) against free.
- Expense rows: priority dot, summary, date, amount, status toggle, edit (✎) and delete (🗑). `special` rows show ★ and a red background.
- Deleting a series member asks **This occurrence / Entire series**. Deleting an income remaps its expenses to the best remaining income.

---

## Phase 8 – Frontend: Statistics ✅

### Layout
One phone-width column. Header: title, months-with-data count, and a **year stepper** (`‹ 2026 ›`, capped at the current year) sharing `YearContext` with the Dashboard.

Three blocks:
1. **Monthly averages** — *Avg free / month* and *Survival / month* (`High + 80% Medium + 7,000 RON`), then High / Medium / Low averages, over months that have data.
2. **Free amount per month** — bar chart for the year; positive and negative bars in different colours, the current month at full opacity with a dashed `now` line. The tooltip gives the full month: Income, High, Medium, Low, Free.
3. **★ Special expenses** — expandable, collapsed by default: count and year total; expanded, each special expense and a total.

> The separate *Expenses by Priority* line chart was removed; its per-month split lives in the bar tooltip.

Data is loaded per year with `listIncomes` / `listExpenses` and computed client-side.

---

## Phase 9 – AWS Deployment & Per-User Isolation ✅

### What Was Implemented
1. **Cognito User Pool** (`eu-central-1_CD7AdBFwQ`) with a Pre Sign-Up trigger (`preSignUp.mjs`) that auto-confirms new users.
2. **API Gateway Cognito authorizer** on every route except the public ones (`/auth/google`, `GET /app-settings`, `GET /fx-rates`, `/ai-news`). The ID token goes in `Authorization` without `Bearer`; handlers read `claims.sub`.
3. **Per-user isolation** — every record carries `userId`; every read, write and delete checks it.
4. **Frontend auth** — the Cognito library restores the session on load; the ID token is sent on every request; a 401 signs the user out.
5. **S3 + CloudFront** hosting at `d34ylrmixnmvem.cloudfront.net`, with 403 → `/index.html` for client-side routes.
6. **Cache-Control: no-store** on every response, including API Gateway's default errors.
7. **samconfig.toml** defaults under `[default.deploy.parameters]`.

### Tests – Phase 9
| # | Test | Expected Result |
|---|------|-----------------|
| 9.1 | `sam build --no-cached && sam deploy` | Stack `finance4tura-backend` updates without errors |
| 9.2 | Unauthenticated `GET /incomes` | 401 `{"message":"Unauthorized"}` |
| 9.3 | Authenticated `GET /incomes` | Only the caller's records |
| 9.4 | New user sign-up | Auto-confirmed; app loads empty |
| 9.5 | Privacy toggle on the Dashboard | Income amounts masked until toggled back |

---

## Phase 10 – Split Payments Module ✅

Payments split into instalments, tracked until settled. Route `/split-payments` (Finance sheet), plus a **Last 3** block on the Home Overview. Full spec: `SplitPayment_Requirement.md`.

### Summary
- DynamoDB-backed (`SplitPayments` table, `/split-payments` CRUD).
- Card list in two groups, **In progress** (expanded) and **Settled** (collapsed), with per-currency "left to cover" totals.
- Exactly `occurrenceCount` slots per entry, two per row. Amounts are typed; dates use the app's calendar sheet (no native date field). No per-slot buttons.
- **Cover rest** and **Clear all** on amount entries.
- Filling the last slot asks **"Mark as settled?"** before saving.
- Slot edits save with a 600 ms debounce. Create/edit in a bottom sheet; two-step inline delete.

> **Replaced:** the original desktop-only table with clickable paid/unpaid cells and a ✕ per row.

### Tests – Phase 10
Automated in `SplitPayment.test.jsx` (13) and `HomeOverview.splitPay.test.jsx` (23); acceptance tests in the full spec.

---

## Phase 11 – Investments Module ✅

Portfolio tracker across six platforms. Route `/investments` (Finance sheet). Full spec: `Investments_Requirement.md`.

### Platforms
| Platform | Default Currency |
|---|---|
| eToro, Binance, Fidelity, Tradeville | USD |
| ING Funds RON | RON |
| ING Funds EUR | EUR |

### Tables
- `InvestmentOperations` (PK `operationId`): `userId`, `date`, `type` (`Deposit` \| `Withdrawal`), `platform`, `amount` (always positive), `currency`, `notes`.
- `PortfolioSnapshots` (PK `snapshotId`): `userId`, `date`, `platform`, `amount`, `currency` — one record per platform per reading.

### Endpoints
| Method | Path | Description |
|---|---|---|
| `GET` / `POST` | `/investments/operations` | List / create |
| `PUT` / `DELETE` | `/investments/operations/{operationId}` | Edit / delete |
| `GET` | `/investments/snapshots` | List |
| `GET` | `/investments/snapshots/latest` | Latest per platform |
| `POST` | `/investments/snapshots` | Record a reading |
| `PUT` / `DELETE` | `/investments/snapshots/{snapshotId}` | Edit in place / delete |

### Page Blocks
1. **Total portfolio** — expandable; EUR total, platform count, FX date; expanded, per-platform share bars for every platform still holding money.
2. **Portfolio evolution** — EUR line chart **from 2023**, carrying forward the latest reading per platform; Total line on by default, platform lines togglable; dots on operation months.
3. **Portfolio snapshots** — grouped by date, 3 at a time, each expandable to per-platform rows with edit, delete and *Add platform to this date*.
4. **Operations log** — newest first, 3 at a time, expandable for notes and edit/delete.

Bottom sheets for add/edit; two-step inline delete. EUR conversion uses the stored FX rates (Phase 15). No S&P 500 simulation.

### Tests – Phase 11
`Investments.test.jsx` — 9 render tests. Acceptance tests in the full spec.

---

## Phase 12 – AI News Page ⛔ Retired

An `/ai-news` page showed AI news from Google News and MIT Technology Review RSS feeds. **The page has been removed from the frontend.** The backend endpoint `GET /ai-news` (`AiNewsFunction`, optional `AnthropicApiKey` parameter) is still deployed but unused.

---

## Phase 13 – Home Overview ✅

### Goal
A landing page (`/`) summarising the day. The Finance Dashboard moved to `/finance`.

### Blocks
1. **Current period expenses** — the current income in a hero header; the expenses mapped to it that were outstanding when the page loaded, by priority then date. Ticking marks one Completed (unticking reverts); ticked rows stay, struck through, until the next load. Footer: **Done** and **Pending** totals for the period.
2. **Split Payments — Last 3** — the three newest open entries, with the Split Pay slot rules and settle prompt; *View all →*.
3. **Current Holdings** — EUR total behind a hold-to-reveal mask, active platforms, FX date.
4. **Books & Development — Latest per Person** — persons × types, the latest entry in each.

### Tests – Phase 13
`HomeOverview.test.jsx` (13) and `HomeOverview.splitPay.test.jsx` (23).

---

## Phase 14 – Books & Development ✅

### Goal
A reading and training log per person. Route `/books-and-dev` — the **Books** tab.

### Data
`Books_and_Dev` (PK `bookId`): `userId`, `name` (person), `source` (Book / Voxa / Udemy / Other), `type` (Book / Audiobook / Training / Other), `author`, `title`, `dateCompleted` (`YYYY-MM`), `rating` (1–5 or null), `comments`, `createdAt`, `updatedAt`. CRUD on `/books-and-dev`, sorted by `dateCompleted` desc then title.

### Behavior
- One collapsible section per person (alphabetical, Unassigned last), newest first, 5 at a time.
- Per-person summary for the last 3 months: count, average rating, split by type.
- Filter sheet: person, type, source, rating, text search on title/author.
- Add/edit in a bottom sheet with a 1–5 star picker; two-step inline delete.

### Tests – Phase 14
`BooksAndDev.test.jsx` (5).

---

## Phase 15 – App Settings, FX Rates, Admin, Backstage ✅

### App Settings
- `AppSettings` table, one `global` item: `backstageEnabled`, `googleLoginEnabled`, `createAccountEnabled` (all default on).
- `GET /app-settings` is public (the login page needs it); `PUT` is admin-only.

### FX Rates
- `FxRates` table, one `global` item with the full EUR/USD/RON matrix (`rates[FROM][TO]`) and `updatedAt`.
- `GET /fx-rates` is public; `POST /fx-rates` (admin) fetches from frankfurter.app and stores the matrix. Pages never fetch rates from a third party.

### Admin page (`/admin`)
Shown only to username `nenciulescu`; the API requires the Cognito `admin` group.
- **App Settings** toggles
- **FX Rates** with **Update FX rates**
- **Database Backup** (Phase 17)
- **Users** — list with income/expense counts, toggle admin, delete after re-entering your password

### Settings page (`/settings`)
- Colour theme: Dusk (default), Light, Amber
- Default visibility of income amounts

### Backstage (`/backstage`)
Raw viewer for Incomes, Expenses, Operations, Snapshots and Splits — search, 10 rows a page, delete — plus a live log of the last 50 API calls. In the avatar menu only while `backstageEnabled` is on.

---

## Phase 16 – Headquarters ✅

Meter readings per location. Route `/headquarters` — the **HQ** tab. Full spec: `Headquarters_Requirements.md`.

- Tables `HQ_Locations`, `HQ_Templates`, `HQ_Entries`; one Lambda (`HQFunction`).
- Tabs: HQ Dashboard · one per location · Settings.
- Templates of up to 30 parameters (`number` / `text` / `boolean`); entries auto-save with a 600 ms debounce.
- Water templates get computed consumption columns and a dashboard chart.

### Tests – Phase 16
`Headquarters.test.jsx` (4).

---

## Phase 17 – Database Backup ✅

**Admin → Database Backup → Backup ALL Tables** exports all 11 tables (every user) to CSV in a new dated Google Drive folder, one table per request, with live per-table status. Full spec: `Backup_Requirements.md`.

---

## Phase 18 – One Layout & Design System ✅

### Goal
One consistent, phone-first app.

- Every page is a 430 px column on every screen; desktop layout removed.
- Design tokens (colour, radius, elevation, spacing, type) as CSS variables in `index.css`; `designTokens.test.js` fails the build on raw values elsewhere.
- Shared primitives in `components/ui.jsx`; categorical colours in `utils/colors.js`.
- Themes: Dusk (default), Light, Amber; Nunito with tabular numerals.
- 16 px form controls everywhere (no iOS zoom), guarded by `noZoom.test.jsx`.
- App calendar sheet (`DateSheet`) where a native date field would be risky.
- Bottom sheets for forms; two-step inline delete instead of dialogs.

---

## Table Summary

| Table | PK | Phase |
|---|---|---|
| `Incomes` | `incomeId` | 1 |
| `Expenses` | `expenseId` | 1 |
| `SplitPayments` | `splitPaymentId` | 10 |
| `InvestmentOperations` | `operationId` | 11 |
| `PortfolioSnapshots` | `snapshotId` | 11 |
| `Books_and_Dev` | `bookId` | 14 |
| `AppSettings` | `settingKey` | 15 |
| `FxRates` | `rateId` | 15 |
| `HQ_Locations`, `HQ_Templates`, `HQ_Entries` | `hqId`, `templateId`, `entryId` | 16 |

---

## Appendix: Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Repeating events | Expand into individual records at creation | Simple queries; no recurrence logic at read time |
| Income mapping | Denormalized onto the expense | Fast rendering without joins |
| Auth | Cognito User Pool + Pre Sign-Up auto-confirm | No email verification needed for a personal app |
| Google sign-in | Custom Lambda, fresh random password per sign-in | Popup flow, nothing derivable or stored |
| Per-user isolation | `userId` on every record | Simple filter; no per-user tables |
| Environments | AWS only | One environment to keep correct; local stack retired |
| Frontend | React + Vite, PWA | Fast builds; static hosting on S3/CloudFront |
| API | AWS SAM, one Lambda per module | Simple deploys; infrastructure in one template |
| API response caching | `Cache-Control: no-store` everywhere | Stops API Gateway's CloudFront serving stale per-user data |
| Vite polyfill | `define: { global: 'globalThis' }` | Required by `amazon-cognito-identity-js` |
| Layout | One 430 px column everywhere | Used mainly as an installed PWA; no desktop/mobile divergence |
| Navigation | Four content tabs; settings and admin in the avatar menu | The bar holds only places visited daily |
| Split Payments | DynamoDB via API; slot count fixed by the series; app calendar; settle prompt | Data on every device; no accidental slots or dates |
| Investments snapshots | One record per platform per reading | Record one platform without entering all six |
| Investments chart | Carry forward the last value per platform | Continuous lines when platforms update at different times |
| FX conversion | Shared rates in `FxRates`, refreshed by an admin | EUR as common denominator without a third-party call per page load |
| Statistics | Priority chart folded into the free-amount tooltip | Two 12-month charts didn't fit a phone |
| Design tokens | CSS variables, enforced by a test | Consistent themes; no drift |
