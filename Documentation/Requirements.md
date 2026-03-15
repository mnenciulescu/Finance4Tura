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
- **Mobile bottom tab bar**: Dashboard · Add Income · Add Expense · Statistics · Settings. Split Pay and Investments are excluded from mobile navigation.
- **Main area**: page content below the Topbar.
- **Routes**: `/`, `/add-income`, `/add-expense`, `/statistics`, `/settings`, `/backstage`, `/split-payments`, `/investments`, `/ai-news`, `/admin`.

### Tests – Phase 4
| # | Test | Expected Result |
|---|------|-----------------|
| 4.1 | Open app on desktop | Topbar visible with all navigation links |
| 4.2 | Click `Add Income` | Navigates to `/add-income` |
| 4.3 | Click `Add Expense` | Navigates to `/add-expense` |
| 4.4 | Unauthenticated access | Login page shown instead of app |
| 4.5 | Open app on mobile | Bottom tab bar shown; Split Pay and Investments tabs absent |

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

### Statistics Displayed
- Total income, total expenses, net balance
- Expenses by priority (chart)
- Completion rate (Completed vs Pending)
- Computed from already-loaded data — no extra API calls.

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
A desktop-only page (`/investments`) to track the user's investment portfolio across multiple platforms, with S&P 500 benchmark simulation and P&L comparison charts.

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

#### `SP500Monthly`
| Attribute | Type | Notes |
|---|---|---|
| `monthId` | String (PK) | `YYYY-MM` (e.g. `2023-01`) |
| `close` | Number | S&P 500 monthly closing price |

No GSI; all rows fetched in full for simulation calculations. Shared/unscoped (no `userId`).

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
| `GET` | `/sp500` | Returns all rows from SP500Monthly table sorted by monthId |
| `POST` | `/sp500` with `{ sync: true }` | Fetches missing months from Yahoo Finance and stores them; returns `{ log, newRecords }` |
| `POST` | `/sp500` with `{ monthId, close }` | Upserts a single SP500Monthly record |

### Page Sections
1. **Current Holdings** (top row, left 30%) — one card per platform (latest amount + date); powered by `GET /investments/snapshots/latest`.
2. **Portfolio evolution** (top row, right 70%) — amber S&P simulation line vs grey portfolio total carry-forward; individual platform lines togglable; dots at operation months with detailed tooltip. Legend order: Portfolio total → platform lines → S&P simulation (last).
3. **P&L Evolution (%)** — full-width section; indigo portfolio period-return line + green S&P 500 monthly % line; right panel bar chart showing average portfolio P&L % vs average S&P 500 %.
4. **Portfolio Snapshots** — full-width table (newest first) with add/edit/delete; modal form with date, platform, amount, currency.
5. **Operations Log** — full-width table (newest first) with add/edit/delete; modal form with date, type, platform, amount, currency, notes.

### Portfolio Evolution Chart Logic
- Starting value = closest portfolio total in EUR (carry-forward from snapshots) to January 2023.
- For each subsequent month: `runningValue = runningValue × (sp500Close[thisMonth] / sp500Close[prevMonth])`.
- At each operation month (except the first): `runningValue += netCashFlowInEUR` (deposits minus withdrawals, converted to EUR via `frankfurter.app` live rates).
- S&P growth is applied only when `close != null` and `prevClose > 0`; otherwise the simulation line shows `null` (no dot rendered).
- Grey portfolio total line shows carry-forward of real snapshot totals in EUR.
- Chart X-axis auto-sizes to the last data point (`data.at(-1)?.x`); no empty space on the right.
- Chart extends to `max(lastSnapshotMonth, lastOperationMonth)` even when SP500 data ends earlier — extra months are appended with `close: null`.
- Tooltip at operation-month dots: ① Value at last op-point → ② S&P growth since then → ③ After S&P growth → ④ Each deposit/withdrawal → Net cash → = Simulated value.

### SP500 Data Sync (Settings)
- SP500 data is not auto-fetched on chart load. The chart renders with whatever data is in `SP500Monthly`.
- To update SP500 data: **Settings → Data → "Get latest S&P 500 data" → Run**.
- Calls `POST /sp500` with `{ sync: true }`. The Lambda fetches missing months from Yahoo Finance (`query1.finance.yahoo.com`) and stores them in `SP500Monthly`.
- An animated terminal-style log panel shows progress line by line (green = stored/done, amber = fetching/checking, red = error, grey = info).
- The SP500Function Lambda has a 30-second timeout to accommodate Yahoo Finance round-trips.

### P&L Evolution Logic
- Portfolio P&L% per period: `(currentPortfolio - prevPortfolio - netCash) / prevPortfolio × 100`.
- S&P 500 monthly %: `(close[month] - close[prevMonth]) / close[prevMonth] × 100`.
- Both rendered on same chart with `connectNulls`.
- Right panel: bar chart of average portfolio P&L % vs average S&P 500 % with reference lines.

### Seed Scripts
| Script | Purpose |
|---|---|
| `backend/src/seed-investments.mjs` | Seeds 32 historical operations and ~68 snapshots (production or local) |
| `backend/src/seed-investments-local.mjs` | Seeds operations and snapshots for `local-dev` userId |
| `backend/src/seed-sp500.mjs` | Seeds `SP500Monthly` table from historical S&P 500 data |
| `backend/src/seed-local.mjs` | Seeds incomes/expenses for `local-dev` userId |
| `backend/src/sync-from-aws.mjs` | Syncs all 6 AWS DynamoDB tables to local, remapping real userId → `"local-dev"` |
| `backend/create-tables.mjs` | Creates all local DynamoDB tables programmatically |
| `scripts/seed-local.mjs` | Convenience wrapper for `seed-local.mjs` |

`docker/init-tables.sh` also creates the `SP500Monthly` table as part of local bootstrap.

### Tests – Phase 11
| # | Test | Expected Result |
|---|---|---|
| 11.1 | Navigate to `/investments` on desktop | All sections visible: Holdings + Portfolio evolution chart (top row), P&L Evolution, Snapshots, Operations |
| 11.2 | View on mobile | "Investments" absent from mobile tab bar |
| 11.3 | Current Holdings after seed | Each platform shows its latest amount and snapshot date |
| 11.4 | Portfolio evolution chart after seed | Amber S&P simulation line rendered last in legend; grey portfolio total line rendered; no empty space on the right of the chart |
| 11.5 | Toggle a platform chip | Line hides/shows in Portfolio evolution chart |
| 11.6 | Hover operation dot on Portfolio evolution chart | Tooltip shows numbered breakdown of simulation step |
| 11.7 | P&L Evolution chart after seed | Indigo portfolio % line and green S&P % line rendered; bar chart shows averages |
| 11.8 | Add operation | Row appears at top of Operations table; charts update |
| 11.9 | Edit operation | Row updates |
| 11.10 | Add snapshot | Holdings card updates; charts gain data point |
| 11.11 | Edit snapshot | `PUT /investments/snapshots/{id}` called; row and charts update |
| 11.12 | Delete snapshot | Holdings card reverts to previous value |
| 11.13 | Refresh | All data persists |
| 11.14 | `seed-sp500.mjs` runs | SP500Monthly populated; Portfolio evolution chart renders correctly |
| 11.15 | `sync-from-aws.mjs` runs | All 6 tables synced locally with userId remapped to `"local-dev"` |
| 11.16 | Settings → Data → "Get latest S&P 500 data" → Run | Terminal log appears; missing SP500 months fetched from Yahoo Finance and stored; log shows green "Done" line on completion |

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
| Investments — desktop only | Not in mobile tab bar | Complex multi-section page not suited for mobile; portfolio data is a power-user feature |
| Investments snapshots | One DynamoDB record per platform per reading | Allows recording a single platform without entering all six; matches real usage patterns |
| Investments chart carry-forward | Fill gaps by using the last known value for each platform | Produces continuous lines even when platforms are not updated simultaneously |
| Local DynamoDB credentials | No explicit credentials in `dynamo.mjs`; uses host AWS credentials via Docker | Matches the credential namespace used by `init-tables.sh` and the AWS CLI; seed script uses the same pattern |
| Statistics — Special Expenses | Hidden on mobile | The special expenses panel is complex and not touch-friendly; removed from mobile Stats view |
| S&P 500 benchmark simulation | Starting from closest snapshot total to Jan 2023; monthly compounding + net cash flow added at operation months | Provides a realistic "what if" comparison against a passive index strategy using actual deposit timing |
| FX conversion | Live rates from `frankfurter.app` at fetch time | Avoids storing historical rates; EUR is the common denominator for multi-currency portfolio comparisons |
| SP500Monthly table | Separate DynamoDB table with `monthId` PK, unscoped by userId | S&P 500 data is shared reference data; scoping by user would be wasteful and unnecessary |
