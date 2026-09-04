# Finance4Tura – Structured Implementation Requirements

> Personal budgeting web application. All phases have been implemented and deployed.

---

## Phase 0 – Project Scaffold & Local Infrastructure ✅

### Goal
Set up the full development environment so every subsequent phase has a working foundation.

### Tasks

1. **Initialize monorepo structure**
   ```
   finance4tura/
   ├── frontend/          # React app (Vite)
   ├── backend/           # AWS SAM project (Lambda functions)
   ├── docker/            # DynamoDB local config
   └── README.md
   ```

2. **DynamoDB Local (Docker)**
   - `docker/docker-compose.yml` runs `amazon/dynamodb-local` on port `8000`.
   - `docker/init-tables.sh` creates the initial tables.

3. **AWS SAM Backend**
   - `backend/template.yaml` defines all infrastructure (tables, Lambda, API Gateway, IAM roles).
   - `DYNAMODB_ENDPOINT` env var controls which DynamoDB endpoint Lambda connects to.
   - `samconfig.toml` stores deploy defaults (stack name: `finance4tura-backend`).

4. **React Frontend**
   - Scaffolded inside `frontend/` using Vite + React.
   - Dependencies: `axios`, `react-router-dom`, `dayjs`, `recharts`, `amazon-cognito-identity-js`.
   - `.env.local` points to local SAM endpoint; `.env.production` points to cloud API.

5. **Auth**
   - `AuthContext.jsx` wired to AWS Cognito User Pool using `amazon-cognito-identity-js`.
   - Vite requires `define: { global: 'globalThis' }` for the Cognito library to work in the browser.

### Tests – Phase 0
| # | Test | Expected Result |
|---|------|-----------------|
| 0.1 | `docker compose up` in `docker/` | DynamoDB Local starts; `aws dynamodb list-tables --endpoint-url http://localhost:8000` returns both table names |
| 0.2 | `sam build && sam local start-api` in `backend/` | SAM API gateway starts on port `3001` with no errors |
| 0.3 | `npm run dev` in `frontend/` | React app opens in browser at `http://localhost:5173` |
| 0.4 | Health-check Lambda | `GET /health` returns `{ "status": "ok" }` |

---

## Phase 1 – Database Schema ✅

### Goal
Define and provision all DynamoDB tables needed by the application.

### Tables

#### `Incomes`
| Attribute | Type | Notes |
|-----------|------|-------|
| `incomeId` | String (PK) | UUID |
| `userId` | String | Cognito sub — filters records per user |
| `seriesId` | String | Same for all occurrences of a repeating income; equals `incomeId` for single events |
| `summary` | String | Mandatory |
| `date` | String | ISO 8601 (`YYYY-MM-DD`), Mandatory |
| `amount` | Number | Mandatory |
| `currency` | String | Default `RON` |
| `isRepeatable` | Boolean | Default `false` |
| `repeatFrequency` | String | `daily` \| `weekly` \| `monthly` – only when `isRepeatable=true` |
| `seriesEndDate` | String | ISO 8601 – only when `isRepeatable=true` |
| `isException` | Boolean | `true` when this record overrides a single occurrence of a series |

#### `Expenses`
| Attribute | Type | Notes |
|-----------|------|-------|
| `expenseId` | String (PK) | UUID |
| `userId` | String | Cognito sub — filters records per user |
| `seriesId` | String | Same for all occurrences; equals `expenseId` for single events |
| `summary` | String | Mandatory |
| `priority` | String | `High` \| `Medium` \| `Low` – Mandatory |
| `date` | String | ISO 8601, Mandatory |
| `amount` | Number | Mandatory |
| `currency` | String | Default `RON` |
| `special` | Boolean | Default `false` — flags the expense as special; highlighted in red on Dashboard |
| `isRepeatable` | Boolean | Default `false` |
| `repeatFrequency` | String | `daily` \| `weekly` \| `monthly` |
| `seriesEndDate` | String | ISO 8601 |
| `isException` | Boolean | |
| `mappedIncomeId` | String | FK → `Incomes.incomeId` (auto-mapped) |
| `mappedIncomeSummary` | String | Denormalized for fast UI rendering |
| `mappedIncomeDate` | String | Denormalized |
| `status` | String | `Pending` \| `Completed` – Default `Pending` |

#### `SplitPayments`
| Attribute | Type | Notes |
|-----------|------|-------|
| `splitPaymentId` | String (PK) | UUID |
| `userId` | String | Cognito sub — filters records per user |
| `title` | String | Mandatory |
| `totalAmount` | Number | Mandatory |
| `currency` | String | `RON` \| `EUR` \| `USD`; default `RON` |
| `occurrenceCount` | Number | 1–36 |
| `occurrenceType` | String | `amount` \| `date` |
| `createdDate` | String | ISO 8601 (`YYYY-MM-DD`) |
| `occurrences` | List | Array of `{ index, value }` objects; `value` is the amount or date string entered by the user |

### Tasks
- All three tables defined in `backend/template.yaml` and auto-provisioned on `sam deploy`.
- GSI on `Incomes`: `date-index` (partition key: `date`) for efficient date-range queries.
- GSI on `Expenses`: `date-index` (partition key: `date`).
- `SplitPayments` has no GSI; records are fetched via scan filtered by `userId`.

### Tests – Phase 1
| # | Test | Expected Result |
|---|------|-----------------|
| 1.1 | Run `docker/init-tables.sh` | All three tables appear in `aws dynamodb list-tables --endpoint-url http://localhost:8000` output |
| 1.2 | Insert a sample Income item manually | Item visible via `aws dynamodb scan --table-name Incomes --endpoint-url http://localhost:8000` |
| 1.3 | Insert a sample Expense item manually | Item visible via `aws dynamodb scan --table-name Expenses --endpoint-url http://localhost:8000` |
| 1.4 | Insert a sample SplitPayment item manually | Item visible via `aws dynamodb scan --table-name SplitPayments --endpoint-url http://localhost:8000` |

---

## Phase 2 – Backend: Income CRUD ✅

### Goal
Implement Lambda functions and API Gateway routes for Income management.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/incomes` | Create income (single or series) |
| `GET` | `/incomes` | List all income occurrences (supports `?from=&to=` date filter) |
| `GET` | `/incomes/{incomeId}` | Get a single income occurrence |
| `PUT` | `/incomes/{incomeId}` | Edit a single occurrence (sets `isException=true` if part of a series) |
| `PUT` | `/incomes/{incomeId}/series` | Edit all future occurrences in a series |
| `DELETE` | `/incomes/{incomeId}` | Delete a single occurrence; pass `?deleteSeries=true` to delete entire series |

### Business Logic
- When `isRepeatable=true`, all individual occurrence records are generated at creation time between `date` and `seriesEndDate` according to `repeatFrequency`, all sharing a common `seriesId`.
- `PUT` on a single occurrence of a series sets `isException=true` on that record only; other series records are unchanged.
- All operations filter by `userId` (Cognito sub) for per-user data isolation.
- Lambda falls back to `userId = "local-dev"` when running under `sam local start-api` (no authorizer).

### Tests – Phase 2
| # | Test | Expected Result |
|---|------|-----------------|
| 2.1 | `POST /incomes` with single income | 201 response; item in DynamoDB |
| 2.2 | `POST /incomes` with monthly repeat, 3-month window | 3 occurrence records created, all sharing same `seriesId` |
| 2.3 | `GET /incomes?from=2025-02-01&to=2025-02-28` | Returns only incomes within date range |
| 2.4 | `PUT /incomes/{id}` on a series occurrence | Only that record updated; other occurrences unchanged |
| 2.5 | `DELETE /incomes/{id}` | Record removed from DynamoDB |
| 2.6 | `DELETE /incomes/{id}?deleteSeries=true` | All records with same `seriesId` removed |

---

## Phase 3 – Backend: Expense CRUD + Auto-Mapping ✅

### Goal
Implement Lambda functions for Expense management, including automatic mapping to Incomes.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/expenses` | Create expense (single or series) |
| `GET` | `/expenses` | List all expense occurrences (supports `?from=&to=`) |
| `GET` | `/expenses/{expenseId}` | Get single expense |
| `PUT` | `/expenses/{expenseId}` | Edit single occurrence |
| `PUT` | `/expenses/{expenseId}/series` | Edit all future occurrences in a series |
| `DELETE` | `/expenses/{expenseId}` | Delete single occurrence; pass `?deleteSeries=true` to delete entire series |
| `GET` | `/expenses/resolve-income?date={date}` | Preview which income would be mapped for a given date |

### Auto-Mapping Logic
Shared helper function `resolveIncome(expenseDate, userId)`:

1. Scans the `Incomes` table for records where `date <= expenseDate` AND `userId` matches.
2. Returns the record with the **latest date** that is still before or on `expenseDate`.
3. Stores `mappedIncomeId`, `mappedIncomeSummary`, and `mappedIncomeDate` on the Expense record.
4. For repeatable expenses, `resolveIncome` is applied independently for **each occurrence date**.

### Tests – Phase 3
| # | Test | Expected Result |
|---|------|-----------------|
| 3.1 | `POST /expenses` (single, date=Feb 11) with incomes on Feb 10 and Feb 25 | `mappedIncomeDate` = Feb 10 |
| 3.2 | `POST /expenses` (single, date=Mar 4) with incomes on Feb 10 and Feb 25 | `mappedIncomeDate` = Feb 25 |
| 3.3 | `POST /expenses` repeatable monthly × 3 | Each occurrence has its own correctly mapped income |
| 3.4 | `GET /expenses/resolve-income?date=2025-03-04` | Returns the Feb 25 income summary and date |
| 3.5 | `PUT /expenses/{id}` changing date | `mappedIncomeId` recalculated automatically |
| 3.6 | `DELETE /expenses/{id}?deleteSeries=true` | All records with same `seriesId` removed |

---

## Phase 4 – Frontend: Layout & Navigation ✅

### Goal
Build the core application shell.

### Layout
- **Desktop Topbar** (horizontal, sticky): Logo/Dashboard · Add Income · Add Expense · Split Pay · Investments · Statistics · AI · Settings · Backstage · Admin (admin users only). Year selector, avatar, and Sign out button on the right.
- **Mobile bottom tab bar**: Finance · Split Pay · Investments · Stats. Add Expense and Add Income are not tabs — they are actions inside the Finance page (mobile `/`).
- **Main area**: page content below the Topbar.
- **Routes**: `/`, `/add-income`, `/add-expense`, `/statistics`, `/settings`, `/backstage`, `/split-payments`, `/investments`, `/ai-news`, `/admin`.

### Tests – Phase 4
| # | Test | Expected Result |
|---|------|-----------------|
| 4.1 | Open app on desktop | Topbar visible with all navigation links |
| 4.2 | Click `Add Income` | Navigates to `/add-income` |
| 4.3 | Click `Add Expense` | Navigates to `/add-expense` |
| 4.4 | Unauthenticated access | Login page shown instead of app |
| 4.5 | Open app on mobile | Bottom tab bar shown with 4 tabs: Finance · Split Pay · Investments · Stats |
| 4.6 | Finance page on mobile | An **Add Expense** / **Add Income** action row sits above the income card; saving returns to `/` with the same income column and the Finance tab still highlighted |

---

## Phase 5 – Frontend: Add & Edit Income Form ✅

### Goal
Implement the Income form connected to the backend API.

### Form Fields
| Field | Type | Validation |
|-------|------|------------|
| Summary | Text input | Mandatory |
| Date | Date picker | Mandatory |
| Amount | Number input | Mandatory, > 0 |
| Currency | Dropdown | Mandatory, default `RON` |
| Repeatable | Toggle | Default `false` |
| Repeat Frequency | Dropdown (`daily`, `weekly`, `monthly`) | Mandatory only if Repeatable |
| Series End Date | Date picker | Mandatory only if Repeatable; must be after Date |

### Behavior
- Repeat Frequency and Series End Date are hidden when Repeatable is off.
- On submit, calls `POST /incomes`.
- On edit (via `?id=`), pre-populates from existing record and calls `PUT /incomes/{id}`.
- If the edited income is part of a series, a dialog asks: **"Edit this occurrence only"** or **"Edit entire series"**.

---

## Phase 6 – Frontend: Add & Edit Expense Form ✅

### Goal
Implement the Expense form with real-time income mapping preview.

### Form Fields
| Field | Type | Validation |
|-------|------|------------|
| Summary | Text input | Mandatory |
| Priority | Dropdown (`High`, `Medium`, `Low`) | Mandatory |
| Date | Date picker | Mandatory |
| Mapped Income | Read-only (auto-filled) | Populated via `GET /expenses/resolve-income` |
| Amount | Number input | Mandatory, > 0 |
| Currency | Dropdown | Mandatory, default `RON` |
| Special | Pill toggle (`Yes` / `No`) | Default `No`; highlighted in purple when Yes |
| Repeatable | Toggle | Default `false` |
| Repeat Frequency | Dropdown | Mandatory only if Repeatable |
| Series End Date | Date picker | Mandatory only if Repeatable |

### Behavior
- When the Date field changes, calls `GET /expenses/resolve-income?date={date}` and populates Mapped Income.
- On submit calls `POST /expenses`; on edit calls `PUT /expenses/{id}`.
- If part of a series: dialog asks **"Edit this occurrence only"** or **"Edit entire series"**.

---

## Phase 7 – Frontend: Column Cards – Live Data ✅

### Goal
Replace placeholder column data with real data from the backend.

### Behavior
- On load, calls `GET /incomes` and `GET /expenses`.
- Shows the **4 most recent income periods** as column cards.
- Each card displays income header, amount (masked by default — hold mouse button to reveal), expense rows, and summary footer (income, total expenses, pending, balance).
- The **current income period** (latest income with date ≤ today) has a distinct green-tinted header background to indicate it is the active period.
- Expense rows show priority color dot, summary, date, amount, status toggle (Pending/Completed), edit link, and delete button.
- Expense rows with `special = true` display a purple **★** icon and a dark reddish row background.
- Delete button on a recurring expense shows a dialog: **"This occurrence"** or **"Entire series"**.
- Clicking an income or expense opens the edit form.

---

## Phase 8 – Frontend: Statistics Panel ✅

### Goal
Implement a statistics page summarizing loaded income and expense data.

### Layout
One phone-width column (`max-width: 430px`), centered on desktop as well as mobile — the same shape as Split Pay, Home Overview, and Investments. Header carries the page title, the months-with-data count, and a **year stepper** (`‹ 2026 ›`, capped at the current year) that writes to the same `YearContext` the desktop Sidebar selector uses.

Three stacked blocks:

1. **Monthly averages** — *Avg free / month* and *Survival / month* as a two-up stat row, then High / Medium / Low average rows. Averages are taken over the months that actually have data.
2. **Free amount per month** — a `recharts` BarChart for the selected year; bars are indigo when positive and red when negative, the current month is drawn at full opacity, and a dashed `now` reference line marks it. Tapping a bar opens a tooltip with the **full month breakdown** — Income, High, Medium, Low, Free.
3. **★ Special expenses** — an **expandable** block, collapsed by default. The collapsed head shows the count and the year total; expanded it lists each special expense with summary, date, and amount, plus a total footer.

> The separate **Expenses by Priority** line chart was removed. The per-month priority split it carried now lives in the Free-amount bar tooltip.

Data is fetched per selected year via `listIncomes` / `listExpenses`; everything else is computed client-side.

---

## Phase 9 – AWS Cloud Portability ✅

### Goal
Deploy the full application to AWS and implement per-user data isolation.

### What Was Implemented

1. **Cognito User Pool** (`eu-central-1_CD7AdBFwQ`) with a Pre Sign-Up Lambda trigger (`preSignUp.mjs`) that auto-confirms all new users. New accounts become active immediately with no email verification required.

2. **API Gateway Cognito Authorizer** — all routes protected. The JWT ID token is sent in the `Authorization` header (without `Bearer` prefix). The Lambda extracts `userId` from `event.requestContext.authorizer.claims.sub`.

3. **Per-user data isolation** — all DynamoDB records carry a `userId` field. Every read, write, and delete operation filters or validates by `userId`.

4. **Frontend auth** — `AuthContext.jsx` uses `amazon-cognito-identity-js`. On sign-in, `setAuthToken(jwt)` is called and the axios request interceptor injects `Authorization: <token>` on every API call. Session is restored from localStorage on page load.

5. **S3 + CloudFront hosting** — React build served via CloudFront (`d34ylrmixnmvem.cloudfront.net`). CloudFront errors for unknown paths return `index.html` (required for client-side routing).

6. **Cache-Control** — Lambda responses include `Cache-Control: no-store` to prevent API Gateway's internal CloudFront layer from caching API responses.

7. **samconfig.toml** — stores deploy defaults under `[default.deploy.parameters]`: stack name `finance4tura-backend`, region `eu-central-1`, `CAPABILITY_IAM`, `resolve_s3 = true`.

### Tests – Phase 9
| # | Test | Expected Result |
|---|------|-----------------|
| 9.1 | `sam build --no-cached && sam deploy` | Deploys to `finance4tura-backend` stack without errors |
| 9.2 | Unauthenticated `GET /incomes` | Returns `{"message":"Unauthorized"}` (401) |
| 9.3 | Authenticated `GET /incomes` with Demo token | Returns Demo user's records only |
| 9.4 | New user sign-up | Account created and auto-confirmed; app loads with empty database |
| 9.5 | Income amount masked on Dashboard | Amount shows `••••••` until mouse button is held down |
| 9.6 | Local dev still works | `docker compose up` + `sam local start-api` + `npm run dev` functional |

---

---

## Phase 10 – Split Payments Module ✅

### Goal
A desktop-only module for logging advance payments split across multiple occurrences and tracking when the total is fully covered. Data is stored in DynamoDB and synced via the backend API.

### Behavior
- Accessible via **"Split Pay"** in the desktop top navigation bar (`/split-payments`). Not present in the mobile tab bar.
- Page shows a data table of all split payment entries plus an **"Add New Split Payment"** button.
- Data is persisted in the `SplitPayments` DynamoDB table, scoped per user via `userId`.
- On load, calls `GET /split-payments` to fetch the user's entries.
- Occurrence values are updated via `PUT /split-payments/{splitPaymentId}` (debounced 600ms) on every cell change.

### API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/split-payments` | List all entries for the authenticated user |
| `POST` | `/split-payments` | Create a new split payment entry |
| `PUT` | `/split-payments/{splitPaymentId}` | Update an existing entry (e.g. update occurrence values) |
| `DELETE` | `/split-payments/{splitPaymentId}` | Delete an entry |

### Create Form Fields
| Field | Type | Notes |
|-------|------|-------|
| Date | Editable date input | Pre-filled with today's date; user can change it |
| Title | Text input | Mandatory |
| Amount | Number input | Mandatory, > 0 |
| Currency | Dropdown | `RON`, `EUR`, `USD`; default `RON` |
| No. of Occurrences | Integer input | Mandatory; 1–36 |
| Occurrence Type | Dropdown | `amount` – cells show equal installment value; `date` – cells record payment dates |

### Table Columns
- **Fixed**: Created Date, Title, Total Amount, Currency
- **Dynamic**: one editable input cell per occurrence (number input for `amount` type; date input for `date` type); cells turn green when a value is entered
- **Coverage badge**: shows `paid / total`; turns green with ✓ when all occurrences are filled
- **Delete** (✕) removes the entry from DynamoDB

### Tests – Phase 10
| # | Test | Expected Result |
|---|---|---|
| 10.1 | Navigate to `/split-payments` | Page loads; entries fetched from API; empty-state message shown if none; entries sorted newest first |
| 10.2 | Add entry with 3 amount occurrences | `POST /split-payments` called; row appears at top with 3 number inputs; coverage shows `0/3` |
| 10.3 | Enter a value in first cell | Cell turns green; coverage updates to `1/3`; `PUT /split-payments/{id}` called after 600ms debounce |
| 10.4 | Fill all cells | Coverage shows `3/3 ✓` |
| 10.5 | Refresh page | Entries still present (fetched from DynamoDB) |
| 10.6 | Delete entry | `DELETE /split-payments/{id}` called; row removed |
| 10.7 | Open on mobile | "Split Pay" absent from bottom tab bar |
| 10.8 | Add entry with custom date | Date field pre-filled with today; user can set a different date |

---

---

## Phase 11 – Investments Module ✅

### Goal
A **PWA-first** page (`/investments`) to track the user's investment portfolio across multiple platforms. Renders as a single phone-width column, centered on desktop as well as mobile, built from four stacked blocks. See `Documentation/Investments_Requirement.md` for the full spec.

### Platforms
Fixed list — no CRUD in the UI:

| Platform | Default Currency |
|---|---|
| eToro | USD |
| Binance | USD |
| Fidelity | USD |
| Tradeville | USD |
| ING Funds RON | RON |
| ING Funds EUR | EUR |

### Tables

#### `InvestmentOperations`
| Attribute | Type | Notes |
|---|---|---|
| `operationId` | String (PK) | UUID |
| `userId` | String | Cognito sub |
| `date` | String | ISO 8601 |
| `type` | String | `Deposit` \| `Withdrawal` |
| `platform` | String | One of the 6 platforms |
| `amount` | Number | Always positive |
| `currency` | String | Defaults from platform |
| `notes` | String | Optional |

GSI: `date-index` on `date`.

#### `PortfolioSnapshots`
| Attribute | Type | Notes |
|---|---|---|
| `snapshotId` | String (PK) | UUID |
| `userId` | String | Cognito sub |
| `date` | String | ISO 8601 |
| `platform` | String | One of the 6 platforms |
| `amount` | Number | Total value on that platform at that date |
| `currency` | String | Defaults from platform |

GSI: `date-index` on `date`. One record per platform per reading (not one wide row for all platforms).

### Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/investments/operations` | List; supports `?from=&to=&platform=&type=` |
| `POST` | `/investments/operations` | Create operation |
| `PUT` | `/investments/operations/{operationId}` | Edit operation |
| `DELETE` | `/investments/operations/{operationId}` | Delete operation |
| `GET` | `/investments/snapshots` | List all snapshots |
| `GET` | `/investments/snapshots/latest` | Most recent snapshot per platform |
| `POST` | `/investments/snapshots` | Record a new snapshot |
| `PUT` | `/investments/snapshots/{snapshotId}` | Update an existing snapshot in-place |
| `DELETE` | `/investments/snapshots/{snapshotId}` | Delete snapshot |

### Page Blocks

One phone-width column (`max-width: 430px`), centered on desktop as well as mobile, with four stacked blocks:

1. **Total portfolio** — expandable. Collapsed: total value in EUR, platform count, FX-rate date. Expanded: one row per platform with EUR amount, share bar, share %, original currency amount, and last-snapshot date.
2. **Portfolio evolution** — 210 px `recharts` LineChart of the actual portfolio value in EUR, **starting from 2023**. Grey **Total** line visible by default, platform lines hidden; legend toggle chips above the chart.
3. **Portfolio snapshots** — readings grouped by date, newest first, **3 dates shown** with a *Show 3 more* / *Show less* control. Each date card expands to per-platform rows with ✎ / ✕ and an *Add platform to this date* button.
4. **Operations log** — deposits and withdrawals, newest first, **3 shown** with the same reveal control. Each card expands to show notes and Edit / Delete.

Add and edit both use **bottom sheets** at column width (rounded top, grabber, safe-area padding, 16 px inputs). Delete is a **two-step inline confirm** that auto-reverts after 4 s — no `window.confirm`.

### Portfolio Evolution Chart Logic
- Plots the **actual** portfolio value in EUR month by month. No S&P 500 simulation and no P&L chart — both were removed from the product.
- The plotted range starts at `CHART_START` (`2023-01`); earlier snapshots and operations still feed the carry-forward but are never plotted. If the earliest data is later than `CHART_START`, the chart starts there instead.
- Per-month values carry forward the latest snapshot per platform (`platformAt` / `portfolioAt`); the month spine ends at the latest snapshot/operation month.
- Lines: **Total** (grey `#94a3b8`, visible by default) plus one per active platform (colour-coded, hidden by default), all with `connectNulls`.
- Platform chips list platforms with a snapshot > 0 in the last 12 months. The Total portfolio block instead lists every platform whose latest snapshot is > 0, so its shares add up to the displayed total.
- Dots mark months containing operations; the dot renderer guards `isNaN(cy)` to avoid phantom half-dots.
- Amounts converted to EUR with the shared rates from `GET /fx-rates` (stored in DynamoDB, refreshed from Admin → FX Rates) — no runtime third-party fetch.
### Seed Scripts
| Script | Purpose |
|---|---|
| `backend/src/seed-investments.mjs` | Seeds 32 historical operations and ~68 snapshots (production or local) |
| `backend/src/seed-investments-local.mjs` | Seeds operations and snapshots for `local-dev` userId |
| `backend/src/seed-local.mjs` | Seeds incomes/expenses for `local-dev` userId |
| `backend/src/sync-from-aws.mjs` | Syncs the AWS DynamoDB tables to local, remapping real userId → `"local-dev"` |
| `backend/create-tables.mjs` | Creates all local DynamoDB tables programmatically |
| `scripts/seed-local.mjs` | Convenience wrapper for `seed-local.mjs` |

### Tests – Phase 11
| # | Test | Expected Result |
|---|---|---|
| 11.1 | Open `/investments` on desktop and mobile | Same phone-width column with the four stacked blocks; centered on desktop |
| 11.2 | Mobile bottom tab bar | **Investments** tab present, after **Split Pay** |
| 11.3 | Tap the Total portfolio block | Expands to the per-platform breakdown; shares sum to 100 % of the displayed total |
| 11.4 | Portfolio evolution chart after seed | Grey Total line rendered; platform lines hidden but togglable; chart starts at 2023 |
| 11.5 | Toggle a legend chip | Line hides/shows; chip dims when hidden |
| 11.6 | Tap an operation dot | Tooltip shows the portfolio value, that month's operations, and net cash in EUR |
| 11.7 | Snapshots block after seed | 3 date cards, collapsed, each with its carry-forward EUR total; **Show 3 more** reveals 3 more |
| 11.8 | Add operation | New card appears at the top of the Operations log; chart updates |
| 11.9 | Edit operation | `PUT /investments/operations/{id}` called; card updates |
| 11.10 | Add snapshot | Total portfolio and chart update; the date card gains a platform row |
| 11.11 | Edit snapshot | `PUT /investments/snapshots/{id}` called; record updates in place and keeps its id |
| 11.12 | Delete a snapshot or an operation | First tap arms the inline confirm, second tap deletes |
| 11.13 | Refresh | All data persists |
| 11.14 | `sync-from-aws.mjs` runs | Tables synced locally with userId remapped to `"local-dev"` |
| 11.15 | `npx vitest run src/pages/Investments.test.jsx` | 9 tests pass |

---

## Phase 12 – AI News Page ✅

### Goal
A page (`/ai-news`) that fetches and displays AI-curated financial news from multiple sources.

### Behavior
- Accessible via **"AI"** link in the desktop top navigation bar and (optionally) the mobile tab bar.
- Shows a feed of news articles with title, source, and link.
- Includes a progress indicator while articles are loading.
- HTML entities in article titles are decoded for clean display.

### Tests – Phase 12
| # | Test | Expected Result |
|---|---|---|
| 12.1 | Navigate to `/ai-news` | Page loads; loading indicator shown; articles appear |
| 12.2 | Article titles | No raw HTML entities (e.g. `&amp;` rendered as `&`) |

---

## Appendix: Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Repeating events storage | Expand into individual records at creation time | Simplifies queries; avoids complex recurrence expansion at read time |
| Income mapping | Stored on Expense record (denormalized) | Fast UI rendering without joins |
| Auth | AWS Cognito User Pool + Pre Sign-Up trigger | Portable to AWS; auto-confirms users without email verification |
| Per-user isolation | `userId` field on every DynamoDB record | Simple filter; no separate tables per user |
| Local DB | DynamoDB Local in Docker | Identical API to AWS DynamoDB; zero migration cost |
| Local userId fallback | `"local-dev"` | Allows local dev without JWT; data stays isolated from cloud |
| Frontend | React + Vite | Fast dev experience; compatible with S3/CloudFront hosting |
| API | AWS SAM Lambda | `sam local` mirrors production; deploys unchanged to AWS |
| API response caching | `Cache-Control: no-store` on all responses | Prevents API Gateway's internal CloudFront from caching per-user data |
| Vite polyfill | `define: { global: 'globalThis' }` | Required for `amazon-cognito-identity-js` to run in the browser |
| Split Payments storage | DynamoDB (`SplitPayments` table) via API | Consistent with the rest of the app; data persists across devices and browsers |
| Split Pay nav label | "Split Pay" (shortened) | Fits the compact topbar without wrapping |
| Investments — one phone-width layout | Same 430 px column on desktop and mobile; Investments tab added to the mobile tab bar after Split Pay | The page is used mainly from the phone as an installed PWA; a single layout removes the desktop/mobile divergence, matching Split Pay and Home Overview |
| Investments snapshots | One DynamoDB record per platform per reading | Allows recording a single platform without entering all six; matches real usage patterns |
| Investments chart carry-forward | Fill gaps by using the last known value for each platform | Produces continuous lines even when platforms are not updated simultaneously |
| Local DynamoDB credentials | No explicit credentials in `dynamo.mjs`; uses host AWS credentials via Docker | Matches the credential namespace used by `init-tables.sh` and the AWS CLI; seed script uses the same pattern |
| Statistics — one phone-width layout | Same 430 px column on desktop and mobile; Stats tab added to the mobile tab bar; Expenses-by-Priority chart dropped and its data moved into the Free-amount tooltip; Special Expenses turned into an expandable block (now visible on mobile too) | Consistent with Split Pay, Home Overview, and Investments; two 12-month charts did not fit a phone, and the priority split reads better on demand than as a second chart |
| FX conversion | Shared rates stored in the `FxRates` DynamoDB table, refreshed manually from Admin → FX Rates | EUR is the common denominator for a multi-currency portfolio; storing the rates avoids a third-party fetch on every page load |
