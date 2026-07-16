# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Finance4Tura is a personal budgeting web app. Incomes are received periodically, and expenses are mapped to the most recent income before their date. The UI shows income-period column cards (4 on desktop, 1 on mobile with swipe), each with its associated expenses and a summary footer.

**Current status**: All phases complete and deployed to AWS.

## Monorepo Structure

```
finance4tura/
├── frontend/        # React + Vite app (port 5173 locally)
├── backend/         # AWS SAM Lambda functions (port 3001 locally)
├── docker/          # DynamoDB Local Docker config (port 8000)
├── Documentation/   # AWS_Deploy.md, AWS_Sync.md, Requirements.md
└── README.md
```

## Development Commands

### Docker (DynamoDB Local)
```bash
cd docker
docker compose up -d                                           # Start DynamoDB Local
aws dynamodb list-tables --endpoint-url http://localhost:8000  # Verify
./init-tables.sh                                               # Bootstrap tables (first time only)
```

### Backend (AWS SAM)
```bash
cd backend
sam build --no-cached              # Build (always use --no-cached to pick up changes)
sam local start-api                # API Gateway on port 3001
sam build --no-cached && sam deploy  # Deploy to AWS (samconfig.toml has all defaults)
```

### Frontend (Vite + React)
```bash
cd frontend
npm run dev      # Dev server on port 5173
npm run build    # Production build
npm run lint     # Lint
```

### Deploy frontend to AWS
```bash
cd frontend && npm run build
aws s3 sync dist s3://finance4tura-frontend --region eu-central-1 --delete
aws cloudfront create-invalidation --distribution-id E1O9C9K6CO439 --paths "/*" --region us-east-1
```

## Architecture

### Backend
- **Runtime**: Node.js 20, AWS Lambda via AWS SAM (`backend/template.yaml`)
- **Database**: DynamoDB Local in Docker for dev; real AWS DynamoDB in production
- `DYNAMODB_ENDPOINT` env var controls which endpoint Lambda connects to
- All infrastructure defined in `template.yaml`; deploy config in `samconfig.toml`
- `userId` extracted in every handler: `event.requestContext?.authorizer?.claims?.sub ?? "local-dev"`

### Frontend
- React 19 + Vite inside `frontend/`
- Dependencies: `axios`, `react-router-dom`, `dayjs`, `recharts`, `amazon-cognito-identity-js`
- Responsive: `useIsMobile` hook (breakpoint 768px) switches between desktop (Sidebar) and mobile (MobileLayout)
- Mobile tab bar: Home · Expense · Income · AI · Practice · Settings
- Home Overview (`/`) — new landing page (see below); Finance Dashboard moved to `/finance`
- Split Payments module (`/split-payments`) is desktop-only; data stored in DynamoDB (`SplitPayments` table)
- Investments module (`/investments`) shows portfolio evolution, S&P simulation, snapshots, and operation log
- AI News (`/ai-news`) — mobile shows Date/Source/Title/Link only (no Summary column)
- Backstage (`/backstage`) — raw data view for all tables, 10 rows per table by default with expand/collapse
- Practice Tests module (`/practice-tests`) — available on desktop (Evolve dropdown in Sidebar) and mobile (Practice tab); see below
- Books & Development module (`/books-and-dev`) — available on desktop (Evolve dropdown in Sidebar); see below
- PWA: `vite-plugin-pwa`, service worker, offline support
- `vite.config.js` requires `define: { global: 'globalThis' }` for `amazon-cognito-identity-js`
- `ErrorBoundary` wraps all routes in `App.jsx`; catches render errors and shows a dismissable fallback
- Shared color constants in `frontend/src/utils/colors.js` (PRIORITY_COLORS, HTTP_METHOD_COLORS, CHART_COLORS, BAR_COLORS)

### Practice Tests Module

Route: `/practice-tests` — accessible from desktop Sidebar (Evolve → Practice Tests) and mobile bottom tab bar (Practice).

**Tabs** (in order): Statistics · Tests · Templates · Kids — **Statistics is the default tab on load**

**File structure** (modular folder, replaces the old single `PracticeTests.jsx`):
```
frontend/src/pages/PracticeTests/
├── index.jsx          # Main entry: tab routing + shared state (templates/results/kids)
├── constants.js       # CHART_COLORS, GROUP_PALETTE, topicBg(), calcTotal(), today()
├── styles.js          # Entire `s` styles object (default export)
├── ResultsTab.jsx     # Results tab — all inline-edit + auto-save logic
├── StatisticsTab.jsx  # Statistics tab — chart, calendar, topic pass-rate blocks
├── TemplatesTab.jsx   # Templates tab — card grid + delete
├── KidsTab.jsx        # Kids tab — inline list management
├── TemplateModal.jsx  # Add/Edit template modal (extracted from TemplatesTab)
├── Modal.jsx          # Generic Modal wrapper component
└── helpers.js         # computeTopicPassRate() pure function
```

`App.jsx` imports `PracticeTests` from `"./pages/PracticeTests"` — Vite resolves this to `index.jsx` automatically, no import change needed.

**Tests tab** (formerly "Results tab"):
- Auto-selects first template and first kid on load, showing the inline table immediately
- "New Test" button adds an editable row at the top of the table (requires template + kid selected)
- **Auto-save**: any field change (topic scores, date, source, total, free points, verified) triggers a debounced save (600 ms); pressing "New Test" also schedules an immediate auto-save with default scores; Save button flushes any pending save and closes the row
- For a new row the first auto-save creates the record (stores resultId); subsequent saves update it — implemented with `useRef` to avoid stale-closure issues across debounce timers
- Clicking ✎ on any past result row converts it to inline-editable inputs in place (no modal); same auto-save pattern applies
- Topic score cells are color-coded: red = 0, yellow = partial, no highlight = full marks
- Total updates live as scores are entered; inputs clamp to topic `defaultPoints`
- Source input width: 160 px
- Results sorted by date descending (most recent first)
- Total column displays `(totalScore / 10).toFixed(2)` (two decimal places)
- Generic table (no template+kid filter): shows Kid, Date, Source, Template, Total, ✓, Actions

**Templates tab**:
- Card grid; Add/Edit modal (`TemplateModal.jsx`) with up to 30 topics and optional free-points field
- Each topic has a title and `defaultPoints`; topics can be reordered/removed

**Statistics tab**:
- **Summary bar** (top card): kid filter dropdown + two sections separated by vertical dividers:
  - **Last 5** — overall avg (mean of per-template avgs, `var(--text)` color, 22px) + per-template avgs for each template's last 5 results (template color, 16px)
  - **All tests** — same structure using all results; trailing vertical divider closes the bar
  - All stats respect the kid filter; template toggles do NOT affect the summary bar
- **Template toggle buttons** (below summary bar, above chart): pill buttons per template — click to show/hide that template's chart line and pass-rate block; active = colored bg + border, inactive = dimmed
- Left (70%): Grade Evolution line chart — `totalScore / 10` displayed with `.toFixed(2)` (two decimals), straight lines, per-template colors, labels above each point
  - Template toggle buttons live inside the chart card header (replacing the "Grade Evolution" title)
  - Chart labels rendered as SVG: `<rect>` pill background (`var(--surface)` fill, `var(--border)` stroke) behind `<text>` (fontSize 13, fontWeight 600, offset 14px above dot); `top` margin 36px prevents label clipping
  - Custom dot renderer guards `isNaN(cy)` to prevent phantom half-dots when a date has data for only some templates
  - Verified test dots shown with a **red outer ring** around the filled dot
  - Dashed **average reference line** per template (same color, 60 % opacity), labelled `avg X.XX`
- Right (30%): Monthly calendar with test-day color markers per template; nav arrows to change month
- Custom tooltip on hover: Final grade, source title, verified status
- Y-axis fixed to 8–10 range; chart and calendar cards stretch to equal height
- **Topic Pass Rate blocks** below chart/calendar — one block per visible (non-hidden) template:
  - Kid filter applies to all blocks; template toggle buttons control which blocks are shown
  - Each block header shows template name in its chart color
  - Columns match the template's topics with same group-border coloring as Tests tab
  - Cells show pass-rate % (red = 0, yellow = partial, none = 100 %); `—` when no data
  - Excluded from calculation: results where `calcTotal(topicScores) ≠ totalScore` (i.e. manual total override differs from topic sum)
  - `calcTotal` on frontend: `Math.round(sum * 10) / 10` (raw sum rounded to 1 decimal); `totalScore` stored at this scale
  - `computeTopicPassRate()` is a pure function in `helpers.js`

**Kids tab**:
- Inline list management (add/remove/rename); Save button with "Saved ✓" feedback

**API** (`frontend/src/api/practiceTests.js`):
- All calls go to `/practice-tests/templates`, `/practice-tests/results`, `/practice-tests/kids`

**Backend handler**: `backend/src/handlers/practiceTests.mjs`
- Max 30 topics per template (validated on create and update)
- `calcTotalScore(freePoints, topicScores)` — `Math.round(sum / 10 * 10) / 10` (rounds to 1 decimal)

### Books & Development Module

Route: `/books-and-dev` — accessible from desktop Sidebar (Evolve → Books & Development). Desktop-only.

**Table columns**: Person · Type · Source · Author · Title · Completed · Rating · Comments · Actions

**Filters**: person, type (Book/Audiobook/Training/Other), source (Book/Voxa/Udemy/Other), rating (1–5), free-text search on title/author

**Features**:
- Star rating component (1–5, clickable in modal, display-only in table)
- Type badges color-coded: purple = Audiobook, teal = Training, grey = Book
- Add/Edit modal; delete with confirmation
- `dateCompleted` stored as `YYYY-MM` string

**API** (`frontend/src/api/booksAndDev.js`):
- All calls go to `/books-and-dev` and `/books-and-dev/{bookId}`

**Backend handler**: `backend/src/handlers/booksAndDev.mjs`
- Sorted by `dateCompleted` descending, then title ascending

**Seed script**: `backend/src/seed-books-local.mjs` — seeds 89 entries from original Excel import (Mihai books/audiobooks/trainings + Radu books)

### Home Overview Module

Route: `/` — the main landing page after login. Finance Dashboard moved to `/finance`.

**Layout**: 2-column grid (`1fr 1fr`), 4 section cards.

**Section 1 — Pending Expenses (top-left)**:
- Calls `listIncomes()` and `listExpenses()`
- Finds the current income: the income with the most recent `date ≤ today`
- Shows all `Pending` expenses where `mappedIncomeId === currentIncome.incomeId`
- Displays: name, amount+currency, priority badge (High/Medium/Low), special star marker
- Shows sum of all pending amounts at the bottom

**Section 2 — Split Payments Latest (top-right)**:
- Calls `listSplitPayments()`
- Sorts by `createdDate` descending, shows the most recent entry
- Displays: title, date, total amount, coverage badge, occurrence status chips

**Section 3 — Practice Tests (bottom-left)**:
- Calls `listTemplates()`, `listResults()`, `getKids()`
- Grade Evolution line chart — same logic as StatisticsTab, all templates + kids, no filters; height fills card (ResponsiveContainer height="100%" with flex-grow wrapper); legend rendered inline with the section title (not inside the chart); `isNaN(cy)` guard on dot renderer prevents phantom half-dots
- Monthly calendar widget (same logic as StatisticsTab) — shows test-day color dots
- Chart 70% / Calendar 30% side by side

**Section 4 — Books & Development latest per person (bottom-right)**:
- Calls `listBooks()`
- Groups by `name` (person), shows most recent entry per person (by `dateCompleted`)
- Displays: type badge, title, read-only star rating, dateCompleted
- Persons listed in alphabetical order

**File**: `frontend/src/pages/HomeOverview.jsx` (self-contained, no external CSS)

### Authentication
- **Username/password**: `amazon-cognito-identity-js` → Cognito User Pool
- **Google Sign-In**: GIS popup → `POST /auth/google` (public Lambda) → Cognito JWT
- JWT stored in localStorage; axios interceptor injects `Authorization: <token>` on every request
- `AuthContext` provides: `user`, `loading`, `signIn`, `signUp`, `signInWithGoogle`, `signOut`

### Database Schema

**Incomes** table (PK: `incomeId`):
- `userId`, `seriesId`, `summary`, `date`, `amount`, `currency`
- `isRepeatable`, `repeatFrequency` (`daily`|`weekly`|`monthly`), `seriesEndDate`
- `isException: true` when overriding a single occurrence in a series
- GSI: `date-index` on `date`

**Expenses** table (PK: `expenseId`):
- Same series fields as Incomes
- `priority`: `High`|`Medium`|`Low`; `status`: `Pending`|`Completed`
- `special`: Boolean, default `false` — flags the expense as special; shown with ★ icon and red row background on Dashboard
- `mappedIncomeId`, `mappedIncomeSummary`, `mappedIncomeDate` — denormalized from Incomes
- GSI: `date-index` on `date`

**InvestmentOperations** table (PK: `operationId`):
- `userId`, `date`, `type` (`Deposit`|`Withdrawal`), `platform`, `amount`, `currency`
- Platforms: `eToro`, `Binance`, `Fidelity`, `Tradeville`, `ING Funds RON`, `ING Funds EUR`

**PortfolioSnapshots** table (PK: `snapshotId`):
- `userId`, `date`, `platform`, `amount`, `currency`
- One record per platform per snapshot date; used for portfolio valuation over time

**SP500Monthly** table (PK: `monthId`):
- `monthId` (format: `YYYY-MM`), `close` (S&P 500 closing price for that month)
- No `userId` — shared reference data, seeded from CSV

**SplitPayments** table (PK: `splitPaymentId`):
- `userId`, `date`, `description`, `totalAmount`, `currency`, `participants` (array with name + share)

**TestTemplates** table (PK: `templateId`):
- `userId`, `name`, `subject`, `freePoints`, `topics` (array: `topicId`, `title`, `defaultPoints`), `createdAt`, `updatedAt`
- Max 30 topics per template

**TestResults** table (PK: `resultId`):
- `userId`, `templateId`, `templateName`, `kidName`, `date` (YYYY-MM-DD), `sourceTitle`
- `freePoints`, `topicScores` (array: `topicId`, `title`, `points`), `totalScore`, `verified`, `createdAt`, `updatedAt`

**KidConfig** table (PK: `userId`):
- `kids` (array: `kidId`, `name`, `order`); max 20 kids per user

**AppSettings** table (PK: `settingKey`):
- Single global item `settingKey = "global"` with `backstageEnabled`, `googleLoginEnabled`, `createAccountEnabled`
- No `userId` — applies to all users; GET is public (no auth), PUT requires admin

**FxRates** table (PK: `rateId`):
- Single global item `rateId = "global"` with `rates` and `updatedAt`
- `rates` is the full EUR/USD/RON conversion matrix: `rates[FROM][TO]` = value of 1 `FROM` in `TO` (e.g. `rates.USD.EUR`); all 9 combinations stored, diagonal = 1
- No `userId` — shared across all users; GET is public (no auth), POST (refresh from frankfurter.app, derives the matrix from EUR base) is admin-only
- Updated manually from **Admin → FX Rates → "Update FX rates"**. No runtime fetching or client-side buffering — all pages read these stored rates. Frontend `toEUR()` uses `rates[currency].EUR` (with legacy flat-form fallback)

**Books_and_Dev** table (PK: `bookId`):
- `userId`, `name`, `source`, `type`, `author`, `title`, `dateCompleted` (YYYY-MM), `rating` (1–5 or null), `comments`, `createdAt`, `updatedAt`

### Key Business Logic

**Repeating events**: Expanded into individual DynamoDB records at creation time. All occurrences share a `seriesId`.

**Income auto-mapping**: `resolveIncome(expenseDate, userId)` queries Incomes where `date <= expenseDate` and returns the one with the latest date. Applied per-occurrence for repeating expenses.

**Edit series behavior**: Editing a single occurrence sets `isException=true` on that record only. The `/series` endpoint handles bulk future updates.

**Google Sign-In flow**: Google ID token → `verifyGoogleToken` (tokeninfo API) → `AdminGetUser` / `AdminCreateUser` + `AdminSetUserPassword` → `AdminInitiateAuth` → Cognito JWT returned.

**Portfolio Evolution chart** (Investments page): Starting from the closest portfolio snapshot to Jan 2023, simulate what the portfolio would be worth if invested in S&P 500. For each month: `runningValue *= sp500Close[thisMonth] / sp500Close[prevMonth]` (only when `close != null`). At each operation month (from 2nd onward): `runningValue += netCashFlowInEUR` (deposits/withdrawals converted to EUR). Actual portfolio (carry-forward of latest snapshot per platform) shown alongside. Chart auto-sizes X-axis to last data point; extends to `max(lastSnapshotMonth, lastOperationMonth)` even beyond last SP500 close. Legend order: Portfolio total → platform lines → S&P simulation (last).

**SP500 sync**: Not automatic. Use **Settings → Data → "Get latest S&P 500 data" → Run** to fetch missing months from Yahoo Finance (Lambda calls Yahoo Finance server-side; browser cannot call Yahoo Finance directly due to CORS). SP500Function timeout is 30s.

## API Endpoints

```
POST   /auth/google                         # Google Sign-In (no auth required)
GET    /health

POST   /incomes
GET    /incomes                             # supports ?from=&to=
GET    /incomes/{incomeId}
PUT    /incomes/{incomeId}                  # single occurrence (sets isException=true if series)
PUT    /incomes/{incomeId}/series           # all future occurrences
DELETE /incomes/{incomeId}                  # supports ?deleteSeries=true

POST   /expenses
GET    /expenses                            # supports ?from=&to=
GET    /expenses/{expenseId}
PUT    /expenses/{expenseId}
PUT    /expenses/{expenseId}/series
DELETE /expenses/{expenseId}                # supports ?deleteSeries=true
GET    /expenses/resolve-income?date=       # preview income mapping for a date

GET    /investments/operations              # list all operations for userId
POST   /investments/operations              # create operation
PUT    /investments/operations/{operationId}
DELETE /investments/operations/{operationId}

GET    /investments/snapshots/latest        # most recent snapshot per platform
GET    /investments/snapshots               # all snapshots for userId
POST   /investments/snapshots              # create snapshot
PUT    /investments/snapshots/{snapshotId}
DELETE /investments/snapshots/{snapshotId}

GET    /sp500                               # all SP500Monthly records (no auth required)
POST   /sp500  { sync: true }              # fetch missing months from Yahoo Finance; returns { log, newRecords }
POST   /sp500  { monthId, close }          # upsert a single SP500Monthly record

GET    /split-payments
POST   /split-payments
PUT    /split-payments/{splitPaymentId}
DELETE /split-payments/{splitPaymentId}

GET    /practice-tests/templates
POST   /practice-tests/templates
GET    /practice-tests/templates/{templateId}
PUT    /practice-tests/templates/{templateId}
DELETE /practice-tests/templates/{templateId}

GET    /practice-tests/results              # supports ?templateId=&kidName=&from=&to=
POST   /practice-tests/results
GET    /practice-tests/results/{resultId}
PUT    /practice-tests/results/{resultId}
DELETE /practice-tests/results/{resultId}

GET    /practice-tests/kids
PUT    /practice-tests/kids

GET    /books-and-dev
POST   /books-and-dev
PUT    /books-and-dev/{bookId}
DELETE /books-and-dev/{bookId}

GET    /app-settings                          # public (no auth required)
PUT    /app-settings                          # admin only

GET    /fx-rates                              # public (no auth required) — returns stored { rates, updatedAt }
POST   /fx-rates                              # admin only — refresh rates from frankfurter.app and store
```

## Testing

### Run tests
```bash
# Frontend (Vitest)
cd frontend && npm test -- --run

# Backend (Node.js built-in test runner)
cd backend && node --test src/**/*.test.mjs
```

### Test coverage
| Scope | Files | Tests |
|---|---|---|
| Frontend utils | `expandDates`, `incomeMapping`, `dateValidation`, `formValidation`, `statistics`, `colors`, `YearContext` | 86 |
| Backend handlers | `validation` (year range), `amountValidation` | 27 |
| Backend lib | `expandDates`, `resolveIncome` | 21 |

All tests are pure-function or context tests — no DynamoDB or network calls needed.

## Local Dev Seed Scripts

```bash
# Sync all tables from AWS → local DynamoDB (remaps real userId → local-dev)
cd backend
node src/sync-from-aws.mjs

# Seed investment operations + snapshots for local-dev (historical data)
node src/seed-investments-local.mjs

# Seed Books & Development table from Excel import data (89 entries)
node src/seed-books-local.mjs

# General local seed (incomes/expenses)
node src/seed-local.mjs

# Mirror nenciulescu's AWS data to the demo user (production only)
node src/seed-demo-from-nenciulescu.mjs
```

## AWS Infrastructure

| Resource | Value |
|---|---|
| CloudFormation stack | `finance4tura-backend` |
| API Gateway | `https://2t55twyqmh.execute-api.eu-central-1.amazonaws.com/Prod` |
| S3 bucket | `finance4tura-frontend` |
| CloudFront | `E1O9C9K6CO439` (`d34ylrmixnmvem.cloudfront.net`) |
| Cognito User Pool | `eu-central-1_CD7AdBFwQ` · Client: `2nh5dljhrg9mq7nsmdg7cef21v` |
| Region | `eu-central-1` |

## Design Decisions

| Decision | Choice |
|----------|--------|
| Repeating events | Expand to individual records at write time |
| Income mapping | Denormalized on Expense record for fast rendering |
| Local DB | DynamoDB Local (Docker) — identical API to AWS |
| Frontend | React + Vite (S3/CloudFront compatible), PWA |
| API | AWS SAM Lambda (`sam local` mirrors production) |
| Auth | Cognito User Pool + GIS Google Sign-In via custom Lambda |
| Cache-Control | `no-store` on all Lambda responses (prevents API Gateway CloudFront caching) |
| S&P simulation | Carry-forward snapshot totals + cumulative monthly S&P growth applied to running value |
| FX rates | Stored in `FxRates` DynamoDB table (base EUR), shared across all users; refreshed manually from Admin → FX Rates (admin-only POST fetches frankfurter.app). No runtime online fetch or localStorage buffering |
| Split Payments | DynamoDB-backed, desktop-only; per-participant share breakdown |
| Practice Tests | Available on both desktop (Evolve sidebar dropdown) and mobile; auto-save on field change (debounced 600 ms, useRef pattern); inline row editing; color-coded topic cells; Statistics is default tab; "Results" tab renamed "Tests"; Statistics tab has summary bar (kid filter + Last 5 / All tests per-template avgs), template toggle pill buttons controlling chart lines and pass-rate blocks, average reference line, and per-template Topic Pass Rate blocks |
| Books & Development | Desktop-only (Evolve sidebar dropdown); star ratings, type/source/person filters, seeded from Excel |
| App Settings | Global settings stored in DynamoDB (`AppSettings` table); GET is public, PUT is admin-only (`nenciulescu`) |
| Admin menu | Restricted to user `nenciulescu` both locally and in AWS |
| `sam build` on macOS | Prefix with `ulimit -n 10240 &&` to avoid "too many open files" OS error |
| Themes | Dark (default) and light via `data-theme="light"` on `<html>`; all components use CSS variables |
| Colors | Categorical constants in `frontend/src/utils/colors.js`; theme-aware values use CSS vars from `index.css` |
| Error boundary | `ErrorBoundary` class component wraps all routes; catches render errors, logs to console, shows retry UI |
| Amount validation | Backend rejects `amount <= 0` with HTTP 400; frontend validates before submit |

## Known Limitations

- `resolveIncome()` in `expenses.mjs` uses `ScanCommand` (full table scan). For small user datasets this is acceptable; a userId GSI would improve it at scale.
- No JWT refresh mechanism — token expiry requires re-login.
- No server-side pagination — all records returned per request.
- Statistics "Survival / Month" hardcodes RON 7,000 as a fixed living cost baseline.
