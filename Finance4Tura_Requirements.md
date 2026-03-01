# Finance4Tura – Structured Implementation Requirements

> Personal budgeting web application. Follow each phase sequentially. Complete the tests before proceeding to the next phase.

---

## Phase 0 – Project Scaffold & Local Infrastructure

### Goal
Set up the full development environment so every subsequent phase has a working foundation.

### Tasks

1. **Initialize monorepo structure**
   ```
   finance4tura/
   ├── frontend/          # React app (Create React App or Vite)
   ├── backend/           # AWS SAM project (Lambda functions)
   ├── docker/            # DynamoDB local config
   └── README.md
   ```

2. **DynamoDB Local (Docker)**
   - Create `docker/docker-compose.yml` that runs `amazon/dynamodb-local` on port `8000`.
   - Create a bootstrap script (`docker/init-tables.sh`) that creates the initial tables (see Phase 1 for schema).

3. **AWS SAM Backend**
   - Run `sam init` inside `backend/` to scaffold a SAM project.
   - Configure `template.yaml` to target the local DynamoDB endpoint (`http://localhost:8000`) via an environment variable (`DYNAMODB_ENDPOINT`).
   - Add a `samconfig.toml` for local invocation defaults.

4. **React Frontend**
   - Scaffold inside `frontend/` using Vite + React.
   - Install: `axios`, `react-router-dom`, `dayjs`.
   - Add a `.env.local` pointing the API base URL to the local SAM endpoint (`http://localhost:3001`).

5. **IAM / Auth stub**
   - Document (in `README.md`) the intended AWS IAM authentication flow.
   - Add a placeholder `AuthContext` in the React app that will later be wired to AWS Cognito / IAM Identity Center. For now, it can hard-code a test user.

### Tests – Phase 0
| # | Test | Expected Result |
|---|------|-----------------|
| 0.1 | `docker compose up` in `docker/` | DynamoDB Local starts; `aws dynamodb list-tables --endpoint-url http://localhost:8000` returns `{"TableNames":[]}` |
| 0.2 | `sam build && sam local start-api` in `backend/` | SAM API gateway starts on port `3001` with no errors |
| 0.3 | `npm run dev` in `frontend/` | React app opens in browser with no console errors |
| 0.4 | Health-check Lambda | `GET /health` returns `{ "status": "ok" }` |

---

## Phase 1 – Database Schema

### Goal
Define and provision all DynamoDB tables needed by the application.

### Tables

#### `Incomes`
| Attribute | Type | Notes |
|-----------|------|-------|
| `incomeId` | String (PK) | UUID |
| `seriesId` | String | Same for all occurrences of a repeating income; equals `incomeId` for single events |
| `summary` | String | Mandatory |
| `date` | String | ISO 8601 (`YYYY-MM-DD`), Mandatory |
| `amount` | Number | Mandatory |
| `currency` | String | Default `RON` |
| `isRepeatable` | Boolean | Default `false` |
| `repeatFrequency` | String | `daily` \| `weekly` \| `monthly` – only when `isRepeatable=true` |
| `seriesEndDate` | String | ISO 8601 – only when `isRepeatable=true` |
| `isException` | Boolean | `true` when this record overrides a single occurrence of a series |
| `createdAt` | String | ISO 8601 timestamp |

#### `Expenses`
| Attribute | Type | Notes |
|-----------|------|-------|
| `expenseId` | String (PK) | UUID |
| `seriesId` | String | Same for all occurrences; equals `expenseId` for single events |
| `summary` | String | Mandatory |
| `priority` | String | `High` \| `Medium` \| `Low` – Mandatory |
| `date` | String | ISO 8601, Mandatory |
| `amount` | Number | Mandatory |
| `currency` | String | Default `RON` |
| `isRepeatable` | Boolean | Default `false` |
| `repeatFrequency` | String | `daily` \| `weekly` \| `monthly` |
| `seriesEndDate` | String | ISO 8601 |
| `isException` | Boolean | |
| `mappedIncomeId` | String | FK → `Incomes.incomeId` (auto-mapped) |
| `mappedIncomeSummary` | String | Denormalized for fast UI rendering |
| `mappedIncomeDate` | String | Denormalized |
| `status` | String | `Pending` \| `Completed` – Default `Pending` |
| `createdAt` | String | ISO 8601 timestamp |

### Tasks
- Add table creation statements to `docker/init-tables.sh`.
- Add GSI on `Incomes`: `date-index` (partition key: `date`) for efficient date-range queries.
- Add GSI on `Expenses`: `date-index` (partition key: `date`).

### Tests – Phase 1
| # | Test | Expected Result |
|---|------|-----------------|
| 1.1 | Run `docker/init-tables.sh` | Both tables appear in `aws dynamodb list-tables` output |
| 1.2 | Insert a sample Income item manually | Item visible via `aws dynamodb scan --table-name Incomes` |
| 1.3 | Insert a sample Expense item manually | Item visible via `aws dynamodb scan --table-name Expenses` |

---

## Phase 2 – Backend: Income CRUD

### Goal
Implement Lambda functions and API Gateway routes for Income management.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/incomes` | Create income (single or series) |
| `GET` | `/incomes` | List all income occurrences (supports `?from=&to=` date filter) |
| `GET` | `/incomes/{incomeId}` | Get a single income occurrence |
| `PUT` | `/incomes/{incomeId}` | Edit a single occurrence (creates exception record if part of a series) |
| `PUT` | `/incomes/{incomeId}/series` | Edit all future occurrences in a series |
| `DELETE` | `/incomes/{incomeId}` | Delete a single occurrence or entire series |

### Business Logic
- When `isRepeatable=true`, the `POST /incomes` handler must **generate all individual occurrence records** between `date` and `seriesEndDate` according to `repeatFrequency`, assigning a shared `seriesId`.
- `PUT` on a single occurrence of a series sets `isException=true` and stores only the changed fields, without modifying other series records.

### Tests – Phase 2
| # | Test | Expected Result |
|---|------|-----------------|
| 2.1 | `POST /incomes` with single income | 201 response; item in DynamoDB |
| 2.2 | `POST /incomes` with monthly repeat, 3-month window | 3 occurrence records created, all sharing same `seriesId` |
| 2.3 | `GET /incomes?from=2025-02-01&to=2025-02-28` | Returns only incomes within date range |
| 2.4 | `PUT /incomes/{id}` on a series occurrence | Only that record updated; other occurrences unchanged |
| 2.5 | `DELETE /incomes/{id}` | Record removed from DynamoDB |

---

## Phase 3 – Backend: Expense CRUD + Auto-Mapping

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
| `DELETE` | `/expenses/{expenseId}` | Delete single or series |
| `GET` | `/expenses/resolve-income?date={date}` | Preview which income would be mapped for a given date |

### Auto-Mapping Logic
Implement a shared helper function `resolveIncome(expenseDate)`:

1. Query the `Incomes` table for all records where `date <= expenseDate`.
2. Return the record with the **latest date** that is still earlier than `expenseDate`.
3. Store `mappedIncomeId`, `mappedIncomeSummary`, and `mappedIncomeDate` on the Expense record.
4. For repeatable expenses, apply `resolveIncome` independently for **each occurrence date**.

The `GET /expenses/resolve-income?date=` endpoint exposes this logic so the frontend can call it in real time when a user fills in the date field.

### Tests – Phase 3
| # | Test | Expected Result |
|---|------|-----------------|
| 3.1 | `POST /expenses` (single, date=Feb 11) with incomes on Feb 10 and Feb 25 | `mappedIncomeDate` = Feb 10 |
| 3.2 | `POST /expenses` (single, date=Mar 4) with incomes on Feb 10 and Feb 25 | `mappedIncomeDate` = Feb 25 |
| 3.3 | `POST /expenses` repeatable monthly × 3 | Each occurrence has its own correctly mapped income |
| 3.4 | `GET /expenses/resolve-income?date=2025-03-04` | Returns the Feb 25 income summary and date |
| 3.5 | `PUT /expenses/{id}` changing date | `mappedIncomeId` recalculated automatically |
| 3.6 | `GET /expenses?from=&to=` | Returns filtered results correctly |

---

## Phase 4 – Frontend: Layout & Navigation

### Goal
Build the core application shell matching the specified layout.

### Layout Specification
```
┌─────────────┬──────────────────────────────────────────────┬──────────────┐
│  Left Menu  │         6 Income–Period Columns               │  Statistics  │
│             │                                               │   Column     │
│ • Add Income│  [Col 1] [Col 2] [Col 3] [Col 4] [Col 5] [Col 6]           │
│ • Add Expense                                               │              │
│ • Statistics│  Most recent income period shown first        │              │
└─────────────┴──────────────────────────────────────────────┴──────────────┘
```

### Tasks

1. **App Shell** – Implement a three-panel layout using CSS Grid or Flexbox. Must be responsive (mobile: stack panels vertically).
2. **Left Navigation Menu** with three items: `Add Income`, `Add Expense`, `Statistics`.
3. **Six Income-Period Columns** – Placeholder cards for now. The first column corresponds to the most recent income occurrence on or before today's date.
4. **Statistics Panel** – Placeholder on the right.
5. **Routing** – Set up `react-router-dom` routes: `/`, `/add-income`, `/add-expense`, `/statistics`.

### Column Card Format
Each column card must display (matching `template_column_Fin.png`):
- **Header**: "Income [Month Day]" in colored header row
- **Income amount** at top
- **Expenses list** (with date, amount, and `Completed` badge where applicable)
- **Summary section** at bottom showing:
  - Funds available after expenses
  - Total expenses
  - Expenses left not completed

### Tests – Phase 4
| # | Test | Expected Result |
|---|------|-----------------|
| 4.1 | Open app on desktop | Three-panel layout visible; menu on left, 6 columns in center, stats on right |
| 4.2 | Open app on mobile (375 px viewport) | Panels stack vertically; no horizontal overflow |
| 4.3 | Click `Add Income` in menu | Navigates to `/add-income` |
| 4.4 | Click `Add Expense` in menu | Navigates to `/add-expense` |
| 4.5 | Column cards render placeholder data | Cards visible with correct section labels |

---

## Phase 5 – Frontend: Add & Edit Income Form

### Goal
Implement the Income form connected to the backend API.

### Form Fields
| Field | Type | Validation |
|-------|------|------------|
| Summary | Text input | Mandatory |
| Date | Date picker | Mandatory |
| Amount | Number input | Mandatory, > 0 |
| Currency | Dropdown | Mandatory, default `RON` |
| Repeatable | Toggle / Radio | Mandatory, default `Single event` |
| Repeat Frequency | Dropdown (`daily`, `weekly`, `monthly`) | Mandatory only if Repeatable |
| Series End Date | Date picker | Mandatory only if Repeatable; must be after Date |

### Behavior
- Repeat Frequency and Series End Date fields are **hidden** when Repeatable = `Single event`.
- On submit, call `POST /incomes`.
- On edit, pre-populate fields from existing record; call `PUT /incomes/{id}`.
- If the edited income is part of a series, show a dialog: **"Edit this occurrence only"** or **"Edit entire series"**.

### Tests – Phase 5
| # | Test | Expected Result |
|---|------|-----------------|
| 5.1 | Submit form with all required fields (single) | Income created; appears in column cards |
| 5.2 | Submit form without Summary | Validation error shown inline |
| 5.3 | Toggle Repeatable ON | Frequency and End Date fields appear |
| 5.4 | Submit repeatable income (monthly, 3 months) | 3 occurrence cards appear in correct columns |
| 5.5 | Click existing income → edit | Form pre-populated with current values |
| 5.6 | Edit single occurrence of a series | Dialog shown; choosing "this occurrence only" updates one card |

---

## Phase 6 – Frontend: Add & Edit Expense Form

### Goal
Implement the Expense form with real-time income mapping preview.

### Form Fields
| Field | Type | Validation |
|-------|------|------------|
| Summary | Text input | Mandatory |
| Priority | Dropdown (`High`, `Medium`, `Low`) | Mandatory |
| Date | Date picker | Mandatory |
| Mapped Income | Read-only text field (auto-filled) | Auto-populated; greyed-out |
| Amount | Number input | Mandatory, > 0 |
| Currency | Dropdown | Mandatory, default `RON` |
| Repeatable | Toggle / Radio | Mandatory, default `Single event` |
| Repeat Frequency | Dropdown | Mandatory only if Repeatable |
| Series End Date | Date picker | Mandatory only if Repeatable |

### Behavior
- As soon as the **Date** field is filled, call `GET /expenses/resolve-income?date={date}` and populate the **Mapped Income** field with `"{summary} – {date}"`.
- The Mapped Income field is always read-only.
- On submit, call `POST /expenses`.
- On edit, pre-populate; call `PUT /expenses/{id}`.
- If part of a series: show "Edit this occurrence only" or "Edit entire series" dialog.

### Tests – Phase 6
| # | Test | Expected Result |
|---|------|-----------------|
| 6.1 | Fill date Feb 11 (incomes on Feb 10 & Feb 25 exist) | Mapped Income auto-fills with "Salariu … – Feb 10" |
| 6.2 | Fill date Mar 4 | Mapped Income auto-fills with Feb 25 income |
| 6.3 | Submit expense form | Expense appears in correct column card |
| 6.4 | Mapped Income field is not editable | Field remains read-only at all times |
| 6.5 | Edit existing expense (series) | Dialog shown; series edit updates all future occurrences |

---

## Phase 7 – Frontend: Column Cards – Live Data

### Goal
Replace placeholder column data with real data from the backend.

### Tasks

1. On app load, call `GET /incomes` to retrieve all income occurrences sorted by date descending.
2. Identify the **6 most recent income periods** on or before today.
3. For each income period, call `GET /expenses?mappedIncomeId={incomeId}` to get associated expenses.
4. Render each column card with:
   - Income header (label + date)
   - Income amount
   - Expense rows (summary, date, amount, priority badge, Completed/Pending status)
   - Summary footer (funds available, total expenses, expenses not completed)
5. Clicking an income or expense opens the corresponding edit form.

### Tests – Phase 7
| # | Test | Expected Result |
|---|------|-----------------|
| 7.1 | Load app with seeded data | 6 columns populated with correct income and expense data |
| 7.2 | Click an expense row | Edit Expense form opens pre-populated |
| 7.3 | Click an income header | Edit Income form opens pre-populated |
| 7.4 | Column summary totals | Funds available = income – total expenses; figures match manual calculation |
| 7.5 | Mark expense as Completed | Card updates immediately; "Expenses left not completed" figure decreases |

---

## Phase 8 – Frontend: Statistics Panel

### Goal
Implement the right-side statistics panel summarizing the 6 visible columns.

### Statistics to Display
- Total income across all 6 periods
- Total expenses across all 6 periods
- Total remaining funds
- Expenses by priority (High / Medium / Low) – bar or pie chart
- Completion rate (Completed vs Pending expenses) – percentage
- Biggest expense category (by summary keyword or priority)

### Tasks
- Compute statistics from the data already loaded for the 6 columns (no extra API calls needed).
- Use a charting library (e.g., Recharts) for visual breakdowns.
- Panel must be responsive: collapses to a bottom section on mobile.

### Tests – Phase 8
| # | Test | Expected Result |
|---|------|-----------------|
| 8.1 | Statistics panel visible on load | Displays all 6 metrics |
| 8.2 | Total income figure | Matches sum of income amounts from the 6 columns |
| 8.3 | Total expenses figure | Matches sum of all expenses from the 6 columns |
| 8.4 | Priority chart renders | Chart visible with correct proportions |
| 8.5 | Completion rate | Correct percentage of Completed vs total expenses |

---

## Phase 9 – AWS Cloud Portability

### Goal
Ensure the application can be deployed to AWS with minimal changes.

### Tasks

1. **DynamoDB** – Remove the local endpoint override; production Lambda functions connect to real AWS DynamoDB via IAM role permissions.
2. **SAM / CloudFormation** – `template.yaml` should already define all resources. Verify it includes: DynamoDB tables, Lambda functions, API Gateway, and IAM execution roles.
3. **Authentication** – Replace the stub `AuthContext` with AWS Cognito (User Pools) or IAM Identity Center. Add the Cognito User Pool and App Client to `template.yaml`.
4. **Frontend deployment** – Add an S3 bucket + CloudFront distribution to `template.yaml` for hosting the React build.
5. **Environment variables** – All environment-specific values (table names, endpoints, Cognito pool IDs) must be passed as SAM parameters, never hard-coded.
6. **CI/CD stub** – Add a `deploy.sh` script that runs `sam build && sam deploy --guided` for the first deploy.

### Tests – Phase 9
| # | Test | Expected Result |
|---|------|-----------------|
| 9.1 | `sam build` succeeds | No build errors |
| 9.2 | `sam deploy --dry-run` (or CloudFormation change set) | No validation errors in template |
| 9.3 | All env vars externalized | No hard-coded table names, endpoints, or credentials in source code |
| 9.4 | Local dev still works after changes | `docker compose up` + `sam local start-api` + `npm run dev` still functional |

---

## Appendix: Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Repeating events storage | Expand into individual records at creation time | Simplifies queries; avoids complex recurrence expansion at read time |
| Income mapping | Stored on Expense record (denormalized) | Fast UI rendering without joins |
| Auth | AWS IAM / Cognito | Portable to AWS; no custom auth implementation needed |
| Local DB | DynamoDB Local in Docker | Identical API to AWS DynamoDB; zero migration cost |
| Frontend | React + Vite | Fast dev experience; compatible with S3/CloudFront hosting |
| API | AWS SAM Lambda | `sam local` mirrors production; deploys unchanged to AWS Lambda |
