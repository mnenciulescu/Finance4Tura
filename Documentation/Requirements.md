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

### Tasks
- Both tables defined in `backend/template.yaml` and auto-provisioned on `sam deploy`.
- GSI on `Incomes`: `date-index` (partition key: `date`) for efficient date-range queries.
- GSI on `Expenses`: `date-index` (partition key: `date`).

### Tests – Phase 1
| # | Test | Expected Result |
|---|------|-----------------|
| 1.1 | Run `docker/init-tables.sh` | Both tables appear in `aws dynamodb list-tables --endpoint-url http://localhost:8000` output |
| 1.2 | Insert a sample Income item manually | Item visible via `aws dynamodb scan --table-name Incomes --endpoint-url http://localhost:8000` |
| 1.3 | Insert a sample Expense item manually | Item visible via `aws dynamodb scan --table-name Expenses --endpoint-url http://localhost:8000` |

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
- **Sidebar** (left): navigation links (Dashboard, Add Income, Add Expense, Statistics, Backstage), username display, Sign out button.
- **Main area** (center): page content.
- **Routes**: `/`, `/add-income`, `/add-expense`, `/statistics`, `/backstage`.

### Tests – Phase 4
| # | Test | Expected Result |
|---|------|-----------------|
| 4.1 | Open app on desktop | Sidebar visible; navigation links work |
| 4.2 | Click `Add Income` | Navigates to `/add-income` |
| 4.3 | Click `Add Expense` | Navigates to `/add-expense` |
| 4.4 | Unauthenticated access | Login page shown instead of app |

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
A desktop-only module for logging advance payments split across multiple occurrences and tracking when the total is fully covered.

### Behavior
- Accessible via **"Split Payments"** in the desktop top navigation bar (`/split-payments`). Not present in the mobile tab bar.
- Page shows a data table of all split payment entries plus an **"Add New Split Payment"** button.
- Data is persisted in `localStorage` (`split_payments_v1`) — no backend API required.

### Create Form Fields
| Field | Type | Notes |
|-------|------|-------|
| Created Date | Read-only | Auto-filled with today's date |
| Title | Text input | Mandatory |
| Amount | Number input | Mandatory, > 0 |
| Currency | Dropdown | `RON`, `EUR`, `USD`; default `RON` |
| No. of Occurrences | Integer input | Mandatory; 1–36 |
| Occurrence Type | Dropdown | `amount` – cells show equal installment value; `date` – cells record payment dates |

### Table Columns
- **Fixed**: Created Date, Title, Total Amount, Currency
- **Dynamic**: one editable input cell per occurrence (number input for `amount` type; date input for `date` type); cells turn green when a value is entered
- **Coverage badge**: shows `paid / total`; turns green with ✓ when all occurrences are filled
- **Delete** (✕) removes the entry from the list and localStorage

### Tests – Phase 10
| # | Test | Expected Result |
|---|---|---|
| 10.1 | Navigate to `/split-payments` | Page loads; empty-state message shown |
| 10.2 | Add entry with 3 amount occurrences | Row appears with 3 number inputs; coverage shows `0/3` |
| 10.3 | Enter a value in first cell | Cell turns green; coverage updates to `1/3` |
| 10.4 | Fill all cells | Coverage shows `3/3 ✓` |
| 10.5 | Refresh page | Entries still present (localStorage) |
| 10.6 | Delete entry | Row removed; localStorage updated |
| 10.7 | Open on mobile | "Split Payments" absent from bottom tab bar |

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
