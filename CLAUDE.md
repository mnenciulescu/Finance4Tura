# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Finance4Tura is a personal budgeting web app. Incomes are received periodically, and expenses are mapped to the most recent income before their date. The UI shows one income-period card at a time, swipeable between periods, with its associated expenses and a summary footer.

**Current status**: All phases complete and deployed to AWS.

**Moved out**: the Practice Tests module was decoupled into its own app, **TYG**
(Test Your Growth), living in a sibling repo at `../TYG` with its own SAM stack
(`tyg-backend`), CloudFront distribution and `TYG_*` DynamoDB tables. It shares
this project's Cognito user pool, so `GoogleSecret` must stay in sync between
the two templates and the pool's pre-sign-up trigger (owned by this stack) must
keep working. The old `TestTemplates` / `TestResults` / `KidConfig` tables are
retained but orphaned — no longer in this stack, kept only as a rollback path.

## Monorepo Structure

```
finance4tura/
├── frontend/        # React + Vite app
├── backend/         # AWS SAM Lambda functions
├── Documentation/   # AWS_Deploy.md, AWS_Sync.md, Requirements.md
└── README.md
```

## Development Commands

**There is no local backend.** DynamoDB Local, `sam local start-api` and the
seed scripts were removed — the app runs against AWS only. `npm run dev` serves
the frontend locally but talks to the deployed API, so a dev session reads and
writes **production data**.

### Backend (AWS SAM)
```bash
cd backend
sam build --no-cached              # Build (always use --no-cached to pick up changes)
sam build --no-cached && sam deploy  # Deploy to AWS (samconfig.toml has all defaults)
node --test src/**/*.test.mjs      # Unit tests (pure functions, no AWS)
```

### Frontend (Vite + React)
```bash
cd frontend
npm run dev      # Dev server against the deployed API — production data
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
- **Database**: AWS DynamoDB. There is no local endpoint override.
- All infrastructure defined in `template.yaml`; deploy config in `samconfig.toml`
- `userId` extracted in every handler from the Cognito JWT `sub` claim

### Frontend
- React 19 + Vite inside `frontend/`
- Dependencies: `axios`, `react-router-dom`, `dayjs`, `recharts`, `amazon-cognito-identity-js`
- **Mobile-only.** There is no desktop layout: `Sidebar.jsx` and the `useIsMobile`
  hook were deleted. Every page renders as a centred phone-width column
  (`max-width: 430px`) on any screen, so a laptop browser shows the same UI.
- `Layout.jsx` is a passthrough to `MobileLayout.jsx`, which owns the chrome:
  top bar (brand, avatar menu with the JWT session countdown) and the bottom bar.
- Bottom bar groups mirror what the desktop dropdowns used to be —
  **Home · Finance · Evolve · HQ · System**. Finance and System open bottom
  sheets (`NavSheet.jsx`); Evolve and HQ navigate directly. Config lives in
  `components/navConfig.js`, icons in `components/navIcons.jsx`.
- Home Overview is `/`; the Finance Dashboard is `/finance`.
- The Dashboard owns the year stepper and the privacy (hide amounts) toggle —
  both used to live in the desktop chrome.
- Backstage (`/backstage`) — table picker + search + live API log
- Books & Development (`/books-and-dev`) — card list with a filter sheet
- PWA: `vite-plugin-pwa`, service worker, offline support
- `vite.config.js` requires `define: { global: 'globalThis' }` for `amazon-cognito-identity-js`
- `ErrorBoundary` wraps all routes in `App.jsx`; catches render errors and shows a dismissable fallback
- Shared color constants in `frontend/src/utils/colors.js` (PRIORITY_COLORS, HTTP_METHOD_COLORS, CHART_COLORS, BAR_COLORS)

### Books & Development Module

Route: `/books-and-dev` — reached from the Evolve tab in the bottom bar.

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


### Split Payments Module

Route: `/split-payments` — Finance group in the bottom bar. Centred phone-width column (`max-width: 430px`) on any screen.

**File**: `frontend/src/pages/SplitPayment.jsx` (self-contained; width-capped by the `COL_WIDTH` constant)

**Layout**:
- Header: title, `N open · M settled` plus per-currency "left to cover" totals, and a `+ New` button
- Two groups: **In progress** (always listed) and **Settled** (collapsed behind a toggle)
- Each entry is a card with a 3 px progress track showing `paid / occurrenceCount`

**Card behaviour**:
- Open (not fully covered) entries render **expanded** by default; settled ones render **collapsed**
- Tapping the card head toggles either way; per-card overrides are held in `overrides` state keyed by `splitPaymentId`
- Collapsed head shows title, coverage badge, date, total, and remaining amount

**Coverage editing** (expanded body):
- Occurrence tiles in a fixed-column grid so it never reflows between devices — 2 columns for amount-tracked, 1 column for date-tracked; each tile has an index badge, an input, and one action button
- Input is `number` (`occurrenceType === "amount"`) or `date` (`occurrenceType === "date"`); font-size is 16 px everywhere to stop iOS zoom-on-focus
- Action button is `+` when empty (fills the suggested even split, or today's date) and `✕` when filled (clears it)
- **Cover rest** button (amount-tracked entries only) fills every empty occurrence at once — the last one absorbs the rounding remainder so the sum matches `totalAmount` exactly; **Clear all** empties them
- All coverage edits save with a 600 ms debounce per entry (`PUT /split-payments/{id}` with `{ occurrences }`)

**Entry CRUD**:
- Add/Edit uses the same form — a **bottom sheet** (rounded top, grabber, `env(safe-area-inset-bottom)` padding) at column width, on desktop as well as mobile
- Fields: title, date, total amount, currency (RON/EUR/USD), occurrences (1–36), track by (amount/date)
- On edit, `occurrenceType` is locked once any occurrence is filled; changing the count preserves existing values by index
- Delete is a two-step inline confirm ("Delete" → "Tap to confirm", auto-reverts after 4 s) — no separate dialog

### Investments Module

Route: `/investments` — Finance group in the bottom bar. Centred phone-width column (`max-width: 430px`) on any screen.

**File**: `frontend/src/pages/Investments.jsx` (self-contained; width-capped by the `COL_WIDTH` constant)

**Layout**: a header (`N snapshots · M operations`) plus four stacked blocks.

**Block 1 — Total portfolio** (expandable, collapsed by default):
- Collapsed head: total value in EUR, platform count, and the FX-rate date (`FX <date>` or `no FX rates set`)
- Expanded: one row per platform with colour dot, EUR amount, share bar in the platform colour, share %, original amount + currency (when not EUR), and last-snapshot date
- Lists `heldPlatforms` — every platform whose **latest snapshot is > 0**, i.e. exactly what makes up the total, so the shares add up to 100 %

**Block 2 — Portfolio evolution**:
- 210 px `recharts` LineChart of the actual portfolio value in EUR, month by month
- **Plotted range starts at `CHART_START` (`2023-01`)** — earlier snapshots/operations still feed the carry-forward but are never plotted; if the earliest data is later, the chart starts there instead
- Lines: **Total** (grey `#94a3b8`, visible by default) + one per active platform (hidden by default), all `connectNulls`; legend toggle chips above the chart
- Platform chips use `activePlatforms` (snapshot > 0 in the last 12 months) to keep the legend clear — deliberately a narrower set than Block 1's `heldPlatforms`
- Dots mark operation months (`isNaN(cy)` guard prevents phantom half-dots); tooltip shows the portfolio value, that month's operations, and net cash in EUR

**Block 3 — Portfolio snapshots**:
- Readings **grouped by date**, newest first; collapsed card head shows the date, a count badge, a colour dot per recorded platform, and the carry-forward EUR total as of that date
- Expanded: one row per platform with amount + currency, the `≈ N EUR` equivalent, ✎ / ✕ buttons, and an **+ Add platform to this date** button that pre-fills the sheet with that date
- Shows the **3 most recent dates**; **Show 3 more** (with an `N/total` counter) reveals three more at a time, **Show less** collapses back

**Block 4 — Operations log**:
- One card per operation, newest first; collapsed head shows platform dot + name, a Deposit/Withdrawal badge (green/red), the date, and the signed amount
- Expanded: notes (when present) plus Edit / Delete
- Same 3-at-a-time reveal control as Block 3

**Add / edit**: both forms are **bottom sheets** at column width (rounded top, grabber, `env(safe-area-inset-bottom)` padding, 16 px inputs to stop iOS zoom). Operation type is a segmented Deposit/Withdrawal control. Currency pre-fills from the platform default and stays editable. Snapshot edits use `PUT /investments/snapshots/{id}` and keep the record's id.

**Delete**: two-step inline confirm that auto-reverts after 4 s (`Delete` → `Tap to confirm`; `✕` → `!` on snapshot rows) — no `window.confirm`.

**API** (`frontend/src/api/investments.js`): `listOperations` / `createOperation` / `updateOperation` / `deleteOperation`, `listSnapshots` / `createSnapshot` / `updateSnapshot` / `deleteSnapshot`. FX rates come from `getFxRates()`.

**Tests**: `frontend/src/pages/Investments.test.jsx` — 9 render tests against mocked APIs, covering the four blocks, the 2023 chart start, the 3-at-a-time reveals, the sheets, and the two-step delete.

### Finance Page (mobile)

On mobile, `/` renders `Dashboard` — the Finance page — and the tab is labelled **Finance** (renamed from Home).

- **Add Expense / Add Income are not tab-bar destinations.** They are Finance actions and live in a two-up action row at the top of the mobile Dashboard, above the swipeable income card (`s.mobileActions` / `s.mobileAction` in `Dashboard.jsx`). Desktop keeps them in the Sidebar and does not render the row.
- Each `IncomeCard` also keeps its own per-income `+ Add` expense button and edit-income link.
- `IncomeCard` computes `financeHome = isMobile ? "/" : "/finance"` and passes it as the `from` route state, so saving an add/edit returns to the right Finance page — on mobile that is `/`, which keeps the Finance tab highlighted. `returnStartIdx` still restores the income column.
- **Expense row icons**: edit (✎) and delete (🗑) share `s.rowIcon(isMobile)` — a 26 px box on mobile, 18 px on desktop — so they align and are equally tappable. They need *different* font sizes to look the same size: the emoji fills its em box while ✎ inks about 70 % of it, so the pencil runs at 20 px mobile / 15 px desktop against the emoji's 14 px / 11 px.

### Statistics Module

Route: `/statistics` — Finance group in the bottom bar. Centred phone-width column (`max-width: 430px`) on any screen.

**File**: `frontend/src/pages/Statistics.jsx` (self-contained, no external CSS)

**Header**: title, `N months with data · now <Month>`, and a **year stepper** (`‹ 2026 ›`). The page carries its own; it reads/writes the same `YearContext` as the Dashboard's stepper, so the two stay in sync. Stepping forward is disabled at the current year.

**Block 1 — Monthly averages**:
- Two-up stat row: **Avg free / month** (indigo when ≥ 0, red when negative) and **Survival / month** (`avg.high + avg.medium × 0.8 + 7000`, purple)
- Below the divider: High / Medium / Low average rows with colour dots
- All averages are over `monthsWithData` — months with at least one income or expense

**Block 2 — Free amount per month**:
- `recharts` BarChart (220 px) for the selected year; bar fill is `C.Free` when free ≥ 0 and `C.High` when negative; the current month renders at full opacity, other months at 0.7
- Dashed **now** `ReferenceLine` on the current month; zero baseline `ReferenceLine`
- Y-axis uses a compact `fmtAxis` formatter (`12500` → `12,5k`) and a 44 px width to fit the column
- Custom `MonthTooltip` shows the **full month breakdown**: Income, High, Medium, Low, Free — this is where the priority split lives now
- Future months with no data are `null` so they render blank rather than as zero

**Block 3 — ★ Special expenses** (expandable, collapsed by default):
- Collapsed head: `N in <year>` plus the year total in purple
- Expanded: one row per special expense (summary, date, amount) and a Total footer
- Previously desktop-only; now visible on mobile as well

**Removed**: the `{year} — Expenses by Priority` line chart. Its per-month High/Medium/Low data is surfaced through the Free-amount bar tooltip instead.

**Tests**: `frontend/src/pages/Statistics.test.jsx` — 7 render tests against mocked `incomes` / `expenses` APIs, with `vi.setSystemTime` pinning "today".

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

**Section 3 — Current Holdings (bottom-left)**:
- Calls `listSnapshots()` and `getFxRates()`
- Latest snapshot per platform, converted to EUR via `toEUR()`
- Amounts hidden behind a reveal toggle; shows the FX rate date

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


**SplitPayments** table (PK: `splitPaymentId`):
- `userId`, `date`, `description`, `totalAmount`, `currency`, `participants` (array with name + share)

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

**Portfolio Evolution chart** (Investments page): Plots the actual portfolio value in EUR month by month. Per-month totals carry forward the latest snapshot per platform (`portfolioAt`/`platformAt`); the month spine runs from `CHART_START` (`2023-01`), or the earliest data if that is later, to the latest snapshot/operation month — pre-2023 records still feed the carry-forward but are never plotted. Lines: Portfolio total + one per active platform, toggled via legend chips; dots mark operation months, and the tooltip shows the actual portfolio value plus that month's deposits/withdrawals and net cash. No S&P 500 simulation.

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


GET    /split-payments
POST   /split-payments
PUT    /split-payments/{splitPaymentId}
DELETE /split-payments/{splitPaymentId}

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
| Frontend pages | `Investments`, `Statistics`, `Dashboard` (render tests against mocked APIs) | 18 |
| Frontend components | `MobileLayout` (tab bar), `IncomeCard` (row icon sizing) | 7 |
| Frontend regression | `noZoom` (16px form controls on mobile) | 3 |
| Backend handlers | `validation` (year range), `amountValidation` | 27 |
| Backend lib | `expandDates`, `resolveIncome` | 21 |

Backend and frontend-utils tests are pure-function or context tests. `Investments.test.jsx` renders the page with `@testing-library/react` against mocked API modules — still no DynamoDB or network calls.

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
| Frontend | React + Vite (S3/CloudFront compatible), PWA |
| API | AWS SAM Lambda (one function per route) |
| Auth | Cognito User Pool + GIS Google Sign-In via custom Lambda |
| Cache-Control | `no-store` on all Lambda responses (prevents API Gateway CloudFront caching) |
| FX rates | Stored in `FxRates` DynamoDB table (base EUR), shared across all users; refreshed manually from Admin → FX Rates (admin-only POST fetches frankfurter.app). No runtime online fetch or localStorage buffering |
| Mobile tab bar scope | Only top-level destinations are tabs: Finance · Split Pay · Investments · Stats. Add Expense / Add Income moved into the Finance page as an action row | They are actions on Finance data, not destinations; four tabs also leaves the bar readable on small phones |
| Statistics | Mobile-first stacked blocks in one phone-width (430 px) column on desktop and mobile alike; Stats added as the 6th mobile tab; own year stepper (no global picker on mobile); Expenses-by-Priority chart removed and its data moved into the Free-amount tooltip; Special Expenses is an expandable block, now visible on mobile |
| Investments | Mobile-first stacked blocks in one phone-width (430 px) column on desktop and mobile alike; Investments added to the mobile tab bar after Split Pay; expandable total, chart from 2023, snapshots and operations revealed 3 at a time; bottom sheets for add/edit; two-step inline delete |
| Split Payments | DynamoDB-backed card list (no table); one phone-width (430 px) layout on desktop and mobile alike; open entries expanded, settled collapsed; debounced coverage auto-save |
| Books & Development | Evolve tab; card list, star ratings, filter sheet |
| App Settings | Global settings stored in DynamoDB (`AppSettings` table); GET is public, PUT is admin-only (`nenciulescu`) |
| Admin menu | Restricted to user `nenciulescu` both locally and in AWS |
| Cognito auth flows | App client allows `USER_SRP_AUTH`, `REFRESH_TOKEN_AUTH` and `ADMIN_USER_PASSWORD_AUTH` only; `USER_PASSWORD_AUTH` is off. Note this narrows the surface but is **not** a defence against a known password — SRP authenticates with the password too. The real protection is that no password is derivable (see Google Sign-In below) |
| `sam build` on macOS | Prefix with `ulimit -n 10240 &&` to avoid "too many open files" OS error |
| Themes | **Ember** (default, defined on `:root`): a light blue-grey base `#dce6ec` with white cards, strong `#9db2c0` borders for block separation, and a burnt-orange `#c2410c` accent — drawn from a navy/sand/slate reference palette, inverted to a light ground. Plus Light and Amber via `data-theme`. `main.jsx` and Settings share one resolver; legacy `"dark"` and `"prism"` map to Ember. |
| Colors | Categorical constants in `frontend/src/utils/colors.js`; theme-aware values use CSS vars from `index.css` |
| Error boundary | `ErrorBoundary` class component wraps all routes; catches render errors, logs to console, shows retry UI |
| iOS zoom on focus | `.zoom-safe-form` class on the Add Expense / Add Income `<form>`, with a `@media (max-width: 767px)` rule forcing `font-size: 16px !important` on inputs/selects/textareas (`index.css`) | iOS Safari zooms the viewport for controls under 16px and never zooms back; the pages set 13px inline, so the override needs `!important`. Suppressing zoom via the viewport meta was rejected — it breaks pinch-zoom accessibility |
| Amount validation | Backend rejects `amount <= 0` with HTTP 400; frontend validates before submit |

## Google Sign-In credential design

`googleAuth` generates a **fresh random Cognito password on every sign-in**,
sets it, and uses it immediately. No secret is involved and nothing is stored.

This replaced a scheme that derived the password as
`HMAC-SHA256(GOOGLE_SECRET, googleSub)`, with `GOOGLE_SECRET` hardcoded in
`backend/template.yaml` — in a public repository. A Google `sub` is an
identifier, not a credential, so the pair was enough to authenticate as any
federated user. The secret has been removed from the template and both
federated accounts had their passwords reset.

The old value is still in this repository's git history and must be treated as
permanently compromised, but it is now inert: nothing derives from it and it is
set nowhere. Do not reintroduce a derived-credential scheme.

## Known Limitations

- `resolveIncome()` in `expenses.mjs` uses `ScanCommand` (full table scan). For small user datasets this is acceptable; a userId GSI would improve it at scale.
- No JWT refresh mechanism — token expiry requires re-login.
- No server-side pagination — all records returned per request.
- Statistics "Survival / month" hardcodes RON 7,000 as a fixed living cost baseline (`SURVIVAL_BASELINE`).
