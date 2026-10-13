# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**4TURA Home** (repo and stack still named Finance4Tura) is a personal
dashboard PWA. Its core is budgeting: incomes are received periodically, and
expenses are mapped to the most recent income before their date. Around that
sit Split Payments, Investments, Statistics, Books & Development and
Headquarters (home-utility tracking), plus an admin area.

**Current status**: live on AWS. Everything below describes what is deployed.

**Moved out**: the Practice Tests module was decoupled into its own app, **TYG**
(Test Your Growth), in the sibling repo `../TYG` with its own SAM stack
(`tyg-backend`), CloudFront distribution and `TYG_*` DynamoDB tables. It shares
this project's Cognito user pool, so the pool's pre-sign-up trigger (owned by
this stack) must keep working for TYG sign-ups too. TYG has its own
`googleAuth` Lambda. The old `TestTemplates` / `TestResults` / `KidConfig`
tables have since been deleted.

## Monorepo Structure

```
4TURAHome/
├── frontend/        # React + Vite PWA
├── backend/         # AWS SAM — template.yaml, Lambda handlers, unit tests
├── scripts/         # One-off maintenance scripts (see below)
├── Documentation/   # Deploy guides and per-module requirements
└── README.md
```

## Development Commands

**There is no local backend.** DynamoDB Local and `sam local start-api` were
removed — the app runs against AWS only. `npm run dev` serves the frontend
locally but talks to the deployed API, so a dev session reads and writes
**production data**.

### Backend (AWS SAM)
```bash
cd backend
ulimit -n 10240 && sam build --no-cached   # always --no-cached; ulimit avoids "too many open files" on macOS
sam deploy                                  # samconfig.toml has all defaults
node --test src/**/*.test.mjs               # Unit tests (pure functions, no AWS)
```

### Frontend (Vite + React)
```bash
cd frontend
npm run dev      # Dev server against the deployed API — production data
npm run build    # Production build
npm run lint     # Lint
npm test         # Vitest, single run
```

### Deploy frontend to AWS
```bash
cd frontend && npm run build
aws s3 sync dist s3://finance4tura-frontend --region eu-central-1 --delete
aws cloudfront create-invalidation --distribution-id E1O9C9K6CO439 --paths "/*" --region us-east-1
```

### Scripts
- `scripts/remap-expenses.mjs` — re-resolves the mapped income on every expense
  in the cloud tables, for all users. Live; run after bulk income changes.
- `scripts/seed-local.mjs`, `scripts/seed-investments.mjs` and
  `backend/create-tables.mjs` are **legacy**: they target DynamoDB Local on
  `localhost:8000`, which no longer exists. Kept for reference only.

## Architecture

### Backend
- **Runtime**: Node.js 22 (`nodejs22.x`), AWS Lambda via AWS SAM (`backend/template.yaml`)
- **Database**: AWS DynamoDB. `lib/dynamo.mjs` builds a plain client — no endpoint override.
- All infrastructure defined in `template.yaml`; deploy config in `samconfig.toml`
- One Lambda per module, routing on method + path inside the handler
- `userId` comes from the Cognito JWT `sub` claim. Handlers still fall back to
  `"local-dev"` when there is no authorizer — a leftover from local dev; in AWS
  every protected route has the authorizer, so it never applies.
- Admin-only routes (`/admin/*`, `PUT /app-settings`, `POST /fx-rates`) check
  the Cognito group **`admin`** from the `cognito:groups` claim.
- Every response carries `Cache-Control: no-store`, including API Gateway's
  default 4XX/5XX responses.

### Frontend
- React 19 + Vite inside `frontend/`
- Dependencies: `axios`, `react-router-dom`, `dayjs`, `recharts`, `amazon-cognito-identity-js`
- **Mobile-only.** There is no desktop layout: `Sidebar.jsx` and the `useIsMobile`
  hook were deleted. Every page renders as a centred phone-width column
  (`max-width: var(--app-max-w)`, 430 px) on any screen, so a laptop browser
  shows the same UI.
- `Layout.jsx` is a passthrough to `MobileLayout.jsx`, which owns the chrome:
  top bar (brand, avatar menu) and the bottom bar.
- Bottom bar: a floating dock (`--surface-deep`, `--r-xl`, `--shadow-raised`)
  inset from the screen edges. Each tab has a **duotone** icon from
  `components/TabIcons.jsx`, drawn to match the theme: a rounded line drawing
  in `currentColor` over a soft fill in one Dusk anchor per tab (terracotta
  Home, sage Finance, lilac Books, teal HQ — `TAB_ICON_COLORS` in
  `utils/colors.js`) plus a small tan detail. Because the outline is
  `currentColor`, it takes `--text-muted` when idle and `--accent` when active;
  the active tab also gets the `--accent-tint-bg` capsule, an accent bold label
  and an accent underline — the same selection treatment as the rest of the app.
- Tabs: **Home · Finance · Books · HQ**. Every tab navigates directly;
  there are no sheets. **Finance** opens `/finance` with `resetDashboard`
  state (back on the current income) and stays highlighted on all six Finance
  routes. The other Finance pages are reached from the Dashboard's ⋮ menu,
  listed by `financeItems`.
- The avatar (user initials, top right) opens the account menu: username, JWT
  session countdown, then **Settings · Admin · Sign out**. Backstage appears
  between Settings and Admin only while `backstageEnabled` is on; Admin only for
  `ADMIN_USER`. There is no System tab any more. Tab groups are `navGroups`,
  Finance menu entries `financeItems`, account menu entries `accountItems`, all in `components/navConfig.js`; icons in
  `components/navIcons.jsx`.
- Any route change closes the account menu.
- Routes: `/` Home Overview, `/finance` Dashboard, `/add-income`,
  `/add-expense`, `/split-payments`, `/statistics`, `/investments`,
  `/books-and-dev`, `/headquarters`, `/settings`, `/backstage`, `/admin`.
  Unknown paths redirect to `/`.
- `/admin` is guarded in `App.jsx` by username (`nenciulescu`); the API guards
  the same actions by Cognito group. Both must agree for Admin to work.
- `components/DateSheet.jsx` is the app's own calendar bottom sheet (Monday
  first, with a Clear action). Split Pay date slots use it instead of a native
  `<input type="date">`, which on iOS commits today's date when dismissed.
- PWA: `vite-plugin-pwa`, service worker, offline support; manifest name "4TURA Home"
- `vite.config.js` requires `define: { global: 'globalThis' }` for `amazon-cognito-identity-js`
- `ErrorBoundary` wraps all routes in `App.jsx`; catches render errors and shows a dismissable fallback
- **Design tokens live in `frontend/src/index.css`** — colour, radius,
  elevation, spacing and type, as CSS custom properties. Pages read them; they
  do not hold raw values. `src/test/designTokens.test.js` enforces this by
  scanning the source, so a stray hex or an off-scale radius fails the build.
- `frontend/src/components/tokens.js` mirrors the most-used tokens as strings
  (`T`, `TYPE`) for inline styles, which cannot put a CSS variable inside a
  shorthand. `frontend/src/components/ui.jsx` holds the shared primitives:
  `Card`, `HeroHeader`, `StatTile`, `SectionHeader`, `Pill`, `StatusDot`,
  `Checkbox`, `ProgressBar`, `Button`, `IconButton`, `Input`, `Sheet`,
  `Skeleton`.
- Categorical series colours in `frontend/src/utils/colors.js` — the palette
  anchors (`DUSK`), `PRIORITY_COLORS`, `HTTP_METHOD_COLORS`, `CHART_COLORS`,
  `BAR_COLORS`, `PLATFORM_COLORS`, `TYPE_COLORS`, `TAB_ICON_COLORS` (the
  bottom-bar icon fills, mapped onto Dusk anchors) and the `alpha()` tint helper.
  This is the one file allowed to hold hex literals.
- **Two-step inline delete** is the app-wide pattern: `Delete` → `Tap to
  confirm`, reverting after 4 s. No `window.confirm`. (The Finance Dashboard
  still uses a dialog because it has to ask "this occurrence or the series".)

### Home Overview Module

Route: `/` — the landing page after login. **File**: `frontend/src/pages/HomeOverview.jsx`.

One phone-width column of four blocks, loaded together (`listIncomes`,
`listExpenses`, `listSplitPayments`, `listBooks`, `listSnapshots`, plus
`getFxRates`):

1. **Current period expenses** — hero header with the current income (latest
   `date ≤ today`) and its date, styled exactly like the Dashboard's income
   header (`components/incomeHeader.js`, shared by both). Rows use the
   Dashboard's expense-row format without the edit/delete icons. Lists the expenses mapped to that income that
   were **outstanding when the page loaded**, sorted by priority then date.
   Ticking one marks it Completed (and unticking reverts it); the row stays,
   struck through, until the next load so a mistap can be undone. Footer:
   **Done** and **Pending** totals for the whole period. Empty states: "No
   expenses for this period." / "Nothing left to pay."
2. **Split Payments — Last 3** — the three newest **open** entries (by
   `createdDate`), with a *View all →* link. Each shows exactly
   `occurrenceCount` slots, two per row, no per-slot buttons: amounts are
   typed, dates open `DateSheet`. Edits save with a 600 ms debounce. Filling
   the last empty slot asks **"Mark as settled?"** before saving; confirming
   drops the entry off the list, cancelling restores the slot.
3. **Current Holdings** — total portfolio in EUR (latest snapshot per platform,
   converted with stored FX rates) behind a hold-to-reveal mask, then the
   platforms with a snapshot > 0 in the last 12 months, and the FX date.
4. **Books & Development — Latest per Person** — a grid of persons
   (alphabetical) × types that have entries, each cell the latest entry for that
   person and type.

### Finance Dashboard

Route: `/finance` — the **Finance** tab. **File**: `frontend/src/pages/Dashboard.jsx`.

- One income-period card (`IncomeCard`) at a time. Swipe horizontally, or use
  the ← / ◎ / → buttons (◎ returns to the current period).
- The header row holds the **year stepper** (`‹ 2026 ›`, capped at the current
  year, shared via `YearContext` with Statistics), the income ← / ◎ / → buttons,
  and a **⋮ Finance menu**. The menu lists the six Finance pages (`financeItems`), then a divider and **Show / Hide
  income amounts** — the privacy toggle, persisted in `localStorage` as
  `incomePrivacy`. An outside tap, Escape, or choosing an item closes it.
- The Finance tab and the menu's Dashboard item pass `resetDashboard` state,
  which jumps back to the current income.
- `IncomeCard` has its own `+ Add` expense button and an edit-income link.
  Both pass `from: "/finance"` and `returnStartIdx`, so saving returns to the
  same income column.
- Deleting a series member asks **This occurrence / Entire series**. Deleting an
  income remaps the affected expenses to the best remaining income, optimistically.
- **Expense row icons**: edit (✎) and delete (🗑) share `s.rowIcon` — a 26 px
  box — so they align and are equally tappable. They need *different* font
  sizes to look the same size: the emoji fills its em box while ✎ inks about
  70 % of it, so the pencil runs at 20 px against the emoji's 14 px.
- Add Income / Add Expense forms (`AddIncome.jsx`, `AddExpense.jsx`) reject
  dates outside the current year, preview the mapped income for expenses via
  `/expenses/resolve-income`, and ask "this occurrence / entire series" when
  editing a series member. Their `<form>` carries `.zoom-safe-form`.

### Split Payments Module

Route: `/split-payments` — Dashboard ⋮ menu. **File**: `frontend/src/pages/SplitPayment.jsx`
(self-contained; width-capped by the `COL_WIDTH` constant).

**Layout**:
- Header: title, `N open · M settled` plus per-currency "left to cover" totals, and a `+ New` button
- Two groups: **In progress** (always listed) and **Settled** (collapsed behind a toggle)
- Each entry is a card with a 3 px progress track showing `paid / occurrenceCount`

**Card behaviour**:
- Open entries render **expanded** by default; settled ones render **collapsed**
- Tapping the card head toggles either way; per-card overrides are held in `overrides` state keyed by `splitPaymentId`
- Collapsed head shows title, coverage badge, date, total, and remaining amount

**Coverage editing** (expanded body):
- Slots sit **two per row** for both kinds of entry, each with an index badge
  and nothing beside it. An amount slot is a `number` input (16 px, to stop
  iOS zoom); a date slot is a button that opens `DateSheet`, which holds Clear.
- There is **always exactly `occurrenceCount` slots** — a short or long stored
  array is padded or trimmed, and writes send back the full count.
- **Cover rest** (amount-tracked only) fills every empty slot with the even
  split — the last one absorbs the rounding remainder so the sum matches
  `totalAmount` exactly; **Clear all** empties them.
- Filling the last empty slot (typed, from the calendar, or via Cover rest)
  asks **"Mark as settled?"**. The save is held until confirmed; Cancel
  restores the slot.
- Coverage edits save with a 600 ms debounce per entry (`PUT /split-payments/{id}` with `{ occurrences }`)

**Entry CRUD**:
- Add/Edit uses one form in a **bottom sheet** at column width (rounded top, grabber, `env(safe-area-inset-bottom)` padding)
- Fields: title, date, total amount, currency (RON/EUR/USD), occurrences (1–36), track by (amount/date)
- On edit, `occurrenceType` is locked once any occurrence is filled; changing the count preserves existing values by index
- Delete is the two-step inline confirm

**Tests**: `SplitPayment.test.jsx` (13) and `HomeOverview.splitPay.test.jsx` (23)

### Investments Module

Route: `/investments` — Dashboard ⋮ menu. **File**: `frontend/src/pages/Investments.jsx`
(self-contained; width-capped by the `COL_WIDTH` constant).

**Layout**: a header (`N snapshots · M operations`) plus four stacked blocks.

**Block 1 — Total portfolio** (expandable, collapsed by default):
- Collapsed head: total value in EUR, platform count, and the FX-rate date (`FX <date>` or `no FX rates set`)
- Expanded: one row per platform with colour dot, EUR amount, share bar in the platform colour, share %, original amount + currency (when not EUR), and last-snapshot date
- Lists `heldPlatforms` — every platform whose **latest snapshot is > 0**, i.e. exactly what makes up the total, so the shares add up to 100 %

**Block 2 — Portfolio evolution**:
- 210 px `recharts` LineChart of the actual portfolio value in EUR, month by month
- **Plotted range starts at `CHART_START` (`2023-01`)** — earlier snapshots/operations still feed the carry-forward but are never plotted; if the earliest data is later, the chart starts there instead
- Lines: **Total** (visible by default) + one per active platform (hidden by default), all `connectNulls`; legend toggle chips above the chart
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

**Add / edit**: both forms are **bottom sheets** at column width. Operation type is a segmented Deposit/Withdrawal control. Currency pre-fills from the platform default and stays editable. Snapshot edits use `PUT /investments/snapshots/{id}` and keep the record's id.

**Delete**: two-step inline confirm (`Delete` → `Tap to confirm`; `✕` → `!` on snapshot rows).

**Platforms** (fixed list): eToro, Binance, Fidelity, Tradeville (USD), ING Funds RON (RON), ING Funds EUR (EUR).

**API** (`frontend/src/api/investments.js`): `listOperations` / `createOperation` / `updateOperation` / `deleteOperation`, `listSnapshots` / `createSnapshot` / `updateSnapshot` / `deleteSnapshot`. FX rates come from `getFxRates()`.

**Tests**: `frontend/src/pages/Investments.test.jsx` — 9 render tests against mocked APIs.

### Statistics Module

Route: `/statistics` — Dashboard ⋮ menu. **File**: `frontend/src/pages/Statistics.jsx`.

**Header**: title, `N months with data · now <Month>`, and a **year stepper** (`‹ 2026 ›`). It reads/writes the same `YearContext` as the Dashboard's stepper, so the two stay in sync. Stepping forward is disabled at the current year.

**Block 1 — Monthly averages**:
- Two-up stat row: **Avg free / month** (indigo when ≥ 0, red when negative) and **Survival / month** (`avg.high + avg.medium × 0.8 + SURVIVAL_BASELINE`, where `SURVIVAL_BASELINE = 7000` RON)
- Below the divider: High / Medium / Low average rows with colour dots
- All averages are over `monthsWithData` — months with at least one income or expense

**Block 2 — Free amount per month**:
- `recharts` BarChart (220 px) for the selected year; bar fill is `C.Free` when free ≥ 0 and `C.High` when negative; the current month renders at full opacity, other months at 0.7
- Dashed **now** `ReferenceLine` on the current month; zero baseline `ReferenceLine`
- Y-axis uses a compact `fmtAxis` formatter (`12500` → `12,5k`) and a 44 px width to fit the column
- Custom `MonthTooltip` shows the **full month breakdown**: Income, High, Medium, Low, Free
- Future months with no data are `null` so they render blank rather than as zero

**Block 3 — ★ Special expenses** (expandable, collapsed by default):
- Collapsed head: `N in <year>` plus the year total in purple
- Expanded: one row per special expense (summary, date, amount) and a Total footer

**Tests**: `frontend/src/pages/Statistics.test.jsx` — 7 render tests, with `vi.setSystemTime` pinning "today".

### Books & Development Module

Route: `/books-and-dev` — the **Books** tab. **File**: `frontend/src/pages/BooksAndDev.jsx`.

- Header: `N of M entries`, a **Filters** button (with an active-filter count) and **Clear**.
- One collapsible **section per person** (alphabetical, "Unassigned" last),
  entries newest first, **5 at a time** with *Show more*.
- Each section opens with a **Last 12 months** line chart: entries completed
  per month (any type or source), oldest to newest, with the 12-month total.
- Each entry card: type badge (purple = Audiobook, teal = Training, grey =
  Book), title, author, source, read-only stars, `dateCompleted`, comments.
- **Filter sheet**: person, type (Book/Audiobook/Training/Other), source
  (Book/Voxa/Udemy/Other), rating (1–5), free-text search on title/author.
- Add/Edit in a bottom sheet with a clickable 1–5 star rating; delete is the
  two-step inline confirm.
- `dateCompleted` stored as `YYYY-MM`. The API returns entries sorted by
  `dateCompleted` descending, then title ascending.
- **API** (`frontend/src/api/booksAndDev.js`): `/books-and-dev` and `/books-and-dev/{bookId}`.

### Headquarters Module

Route: `/headquarters` — the **HQ** tab. **Files**: `frontend/src/pages/Headquarters/`
(`index.jsx`, `DashboardTab.jsx`, `LocationTab.jsx`, `SettingsTab.jsx`,
`EntryTable.jsx`, `LocationModal.jsx`, `TemplateModal.jsx`, `Modal.jsx`, `styles.js`).

Tracks readings (water meters and the like) per physical location.

- **Tabs**: *HQ Dashboard* · one per location · *Settings*.
- **Settings**: add/edit/delete locations (name, optional address) and tracker
  templates (location, name, 1–30 parameters, each `number` / `text` /
  `boolean` with an optional unit). A location with templates cannot be deleted.
- **Location tab**: one section per template with **+ New Entry**. Entries are
  cards, newest first, with stacked labelled inputs when editing; edits
  auto-save with a 600 ms debounce. Delete is the two-step inline confirm.
- **Water templates**: a template whose parameters include the four
  `Baie/Bucatarie - Apa Rece/Calda` meters gets computed **Consum Apa Rece /
  Calda** columns (consumption between consecutive readings) and, on the
  Dashboard, a consumption chart. Other templates show a read-only entry list.
- **API** (`frontend/src/api/headquarters.js`): `/headquarters`,
  `/headquarters/templates`, `/headquarters/entries` (+ `/{id}` for PUT/DELETE).
- **Tests**: `Headquarters/Headquarters.test.jsx` (4).

### Settings, Backstage and Admin

Reached from the avatar menu.

- **Settings** (`/settings`): colour theme (Dusk, Light, Amber — saved in
  `localStorage` as `appTheme`) and the default income-amount visibility.
- **Backstage** (`/backstage`): table picker (Incomes, Expenses, Operations,
  Snapshots, Splits), search, 10 rows a page, row delete, and a live log of the
  last 50 API calls (`opLog` in `api/client.js`). Visible only while
  `backstageEnabled` is on.
- **Admin** (`/admin`, `nenciulescu` only):
  - **App Settings** — toggles for `backstageEnabled`, `googleLoginEnabled`,
    `createAccountEnabled`
  - **FX Rates** — shows the stored matrix; **Update FX rates** calls `POST /fx-rates`
  - **Database Backup** — *Backup ALL Tables* exports every table to CSV in a
    dated Google Drive folder (see `Documentation/Backup_Requirements.md`)
  - **Users** — Cognito users with income/expense counts; toggle the `admin`
    group; delete a user after re-entering your own password

### Authentication
- **Username/password**: `amazon-cognito-identity-js` → Cognito User Pool (SRP)
- **Google Sign-In**: GIS popup → `POST /auth/google` (public Lambda) → Cognito JWT
- Sign-up and Google sign-in can each be switched off from Admin → App Settings;
  the login page hides them accordingly. The pre-sign-up trigger auto-confirms
  new users.
- The Cognito library keeps the session in `localStorage`; the ID token is held
  in memory by `api/client.js` and an axios interceptor sends it as
  `Authorization: <token>` (no `Bearer`). A 401 signs the user out.
- `AuthContext` provides: `user`, `loading`, `signIn`, `signUp`, `signOut`,
  `signInWithGoogle`, `verifyPassword`

### Database Schema

All tables are pay-per-request with a single string hash key.

**Incomes** table (PK: `incomeId`):
- `userId`, `seriesId`, `summary`, `date`, `amount`, `currency`
- `isRepeatable`, `repeatFrequency` (`daily`|`weekly`|`monthly`), `seriesEndDate`
- `isException: true` when overriding a single occurrence in a series
- GSI: `date-index` on `date`

**Expenses** table (PK: `expenseId`):
- Same series fields as Incomes
- `priority`: `High`|`Medium`|`Low`; `status`: `Pending`|`Completed`
- `special`: Boolean, default `false` — shown with ★ and a red row background on the Dashboard
- `mappedIncomeId`, `mappedIncomeSummary`, `mappedIncomeDate` — denormalized from Incomes
- GSI: `date-index` on `date`

**InvestmentOperations** table (PK: `operationId`):
- `userId`, `date`, `type` (`Deposit`|`Withdrawal`), `platform`, `amount`, `currency`, `notes`

**PortfolioSnapshots** table (PK: `snapshotId`):
- `userId`, `date`, `platform`, `amount`, `currency`
- One record per platform per snapshot date

**SplitPayments** table (PK: `splitPaymentId`):
- `userId`, `title`, `totalAmount`, `currency` (`RON`|`EUR`|`USD`),
  `occurrenceCount` (1–36), `occurrenceType` (`amount`|`date`), `createdDate`
- `occurrences`: array of `{ index, value }`; `value` is an amount, a
  `YYYY-MM-DD` date, or `""` when empty

**Books_and_Dev** table (PK: `bookId`):
- `userId`, `name`, `source`, `type`, `author`, `title`, `dateCompleted` (YYYY-MM), `rating` (1–5 or null), `comments`, `createdAt`, `updatedAt`

**HQ_Locations** (PK: `hqId`): `userId`, `name`, `address`, `order`, `createdAt`

**HQ_Templates** (PK: `templateId`): `userId`, `hqId`, `name`,
`parameters` (`{ parameterId, title, type, unit, order }`, max 30), `createdAt`, `updatedAt`

**HQ_Entries** (PK: `entryId`): `userId`, `templateId`, `hqId`, `date`,
`values` (`{ parameterId, title, value }`), `notes`, `createdAt`, `updatedAt`

**AppSettings** table (PK: `settingKey`):
- Single global item `settingKey = "global"` with `backstageEnabled`, `googleLoginEnabled`, `createAccountEnabled`
- No `userId` — applies to all users; GET is public, PUT is admin-only

**FxRates** table (PK: `rateId`):
- Single global item `rateId = "global"` with `rates` and `updatedAt`
- `rates` is the full EUR/USD/RON matrix: `rates[FROM][TO]` = value of 1 `FROM` in `TO` (e.g. `rates.USD.EUR`); all 9 combinations stored, diagonal = 1
- GET is public; POST (refresh from frankfurter.app, deriving the matrix from EUR base) is admin-only
- Refreshed manually from **Admin → FX Rates**. No runtime fetching — all pages read these stored rates. Frontend `toEUR()` uses `rates[currency].EUR` (with legacy flat-form fallback)

### Key Business Logic

**Repeating events**: Expanded into individual DynamoDB records at creation time. All occurrences share a `seriesId`.

**Income auto-mapping**: `resolveIncome(expenseDate, userId)` in `expenses.mjs` scans Incomes where `date <= expenseDate` and returns the one with the latest date. Applied per-occurrence for repeating expenses, and re-run when an expense's date changes.

**Edit series behavior**: Editing a single occurrence sets `isException=true` on that record only. The `/series` endpoint handles bulk future updates.

**Google Sign-In flow**: Google ID token → `tokeninfo` verification → `AdminGetUser` / `AdminCreateUser` → `AdminSetUserPassword` with a fresh random password → `AdminInitiateAuth` → Cognito JWT returned.

**Portfolio Evolution chart**: per-month totals carry forward the latest snapshot per platform (`portfolioAt`/`platformAt`); the month spine runs from `CHART_START` (`2023-01`), or the earliest data if that is later, to the latest snapshot/operation month. No S&P 500 simulation.

## API Endpoints

Public routes are marked; everything else needs the Cognito authorizer.

```
POST   /auth/google                         # public — Google Sign-In
GET    /health
GET    /ai-news                             # public — see Known Limitations

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

GET    /investments/operations
POST   /investments/operations
PUT    /investments/operations/{operationId}
DELETE /investments/operations/{operationId}

GET    /investments/snapshots/latest        # most recent snapshot per platform
GET    /investments/snapshots
POST   /investments/snapshots
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

GET    /headquarters                        # locations
POST   /headquarters
PUT    /headquarters/{hqId}
DELETE /headquarters/{hqId}                 # 400 while the location has templates
GET    /headquarters/templates
POST   /headquarters/templates
PUT    /headquarters/templates/{templateId}
DELETE /headquarters/templates/{templateId}
GET    /headquarters/entries
POST   /headquarters/entries
PUT    /headquarters/entries/{entryId}
DELETE /headquarters/entries/{entryId}

GET    /app-settings                        # public
PUT    /app-settings                        # admin

GET    /fx-rates                            # public — stored { rates, updatedAt }
POST   /fx-rates                            # admin — refresh from frankfurter.app

GET    /admin/users                         # admin — Cognito users + record counts
PUT    /admin/users/{username}/role         # admin — add/remove the admin group
DELETE /admin/users/{username}              # admin

GET    /admin/backup/preview                # admin — table item counts
POST   /admin/backup/prepare                # admin — create the dated Drive folder
POST   /admin/backup/run-table              # admin — export one table to CSV in it
```

## Testing

### Run tests
```bash
# Frontend (Vitest)
cd frontend && npm test

# Backend (Node.js built-in test runner)
cd backend && node --test src/**/*.test.mjs
```

### Test coverage
| Scope | Files | Tests |
|---|---|---|
| Frontend utils | `expandDates`, `incomeMapping`, `dateValidation`, `formValidation`, `statistics`, `colors`, `YearContext` | 86 |
| Frontend pages | `HomeOverview` (13), `HomeOverview.splitPay` (23), `SplitPayment` (13), `Investments` (9), `Dashboard` (9), `Statistics` (7), `BooksAndDev` (5), `Headquarters` (4) | 83 |
| Frontend components | `MobileLayout` (tab bar, tab icons, account menu), `IncomeCard` (row icon sizing), `ui` (shared primitives) | 31 |
| Frontend regression | `noZoom` (16px form controls), `appWidth`, `designTokens` (no raw colours, radii or shadows outside the token files) | 16 |
| Backend handlers | `validation` (year range), `amountValidation` | 24 |
| Backend lib | `expandDates`, `resolveIncome` | 24 |

Backend and frontend-utils tests are pure-function or context tests. Page tests
render with `@testing-library/react` against mocked API modules — no DynamoDB
or network calls.

**Known failing (as of 2026-10-11)**: 9 date-slot tests — 7 in
`HomeOverview.splitPay.test.jsx`, 2 in `SplitPayment.test.jsx`. They fail on a
clean `main` too, so they are not caused by later changes.

## AWS Infrastructure

| Resource | Value |
|---|---|
| CloudFormation stack | `finance4tura-backend` |
| API Gateway | `https://2t55twyqmh.execute-api.eu-central-1.amazonaws.com/Prod` |
| S3 bucket | `finance4tura-frontend` |
| CloudFront | `E1O9C9K6CO439` (`d34ylrmixnmvem.cloudfront.net`) |
| Cognito User Pool | `eu-central-1_CD7AdBFwQ` · Client: `2nh5dljhrg9mq7nsmdg7cef21v` · group `admin` |
| DynamoDB tables | `Incomes`, `Expenses`, `InvestmentOperations`, `PortfolioSnapshots`, `SplitPayments`, `Books_and_Dev`, `HQ_Locations`, `HQ_Templates`, `HQ_Entries`, `AppSettings`, `FxRates` |
| SSM parameter | `/finance4tura/gdrive-oauth2` — Google Drive OAuth2 client + refresh token for backups |
| Region | `eu-central-1` |

## Design Decisions

| Decision | Choice |
|----------|--------|
| Repeating events | Expand to individual records at write time |
| Income mapping | Denormalized on Expense record for fast rendering |
| Frontend | React + Vite (S3/CloudFront compatible), PWA |
| API | AWS SAM Lambda, one function per module |
| Auth | Cognito User Pool + GIS Google Sign-In via custom Lambda |
| Cache-Control | `no-store` on all Lambda responses (prevents API Gateway CloudFront caching) |
| FX rates | Stored in `FxRates` DynamoDB table (base EUR), shared across all users; refreshed manually from Admin → FX Rates. No runtime online fetch or localStorage buffering |
| One phone-width layout | Every page is a centred 430 px column on any screen; the desktop layout, `Sidebar.jsx` and `useIsMobile` were removed. The app is used mainly as an installed PWA, and one layout removes the desktop/mobile divergence |
| Navigation | Four tabs — Home · Finance · Books · HQ. Each tab opens one page. Finance opens the Dashboard, whose ⋮ menu reaches the other Finance pages and the income-amounts toggle — the menu lives where Finance work happens, so the bar needs no sheet. Settings, Backstage and Admin live in the avatar menu, so the bar holds only content |
| Split Payments | DynamoDB-backed card list (no table); open entries expanded, settled collapsed; slot count pinned to the series; app calendar instead of native date fields; settling asks first; debounced coverage auto-save |
| Statistics | Expenses-by-Priority chart removed and its data moved into the Free-amount tooltip; Special Expenses is an expandable block |
| Investments | Expandable total, chart from 2023, snapshots and operations revealed 3 at a time; bottom sheets for add/edit; two-step inline delete |
| Books & Development | Books tab; per-person sections with a 12-month completion chart, star ratings, filter sheet |
| App Settings | Global settings stored in DynamoDB (`AppSettings` table); GET is public, PUT is admin-only |
| Admin | Page restricted to username `nenciulescu` in the frontend; admin API routes require the Cognito `admin` group |
| Cognito auth flows | App client allows `USER_SRP_AUTH`, `REFRESH_TOKEN_AUTH` and `ADMIN_USER_PASSWORD_AUTH` only; `USER_PASSWORD_AUTH` is off. This narrows the surface but is **not** a defence against a known password — SRP authenticates with the password too. The real protection is that no password is derivable (see Google Sign-In below) |
| `sam build` on macOS | Prefix with `ulimit -n 10240 &&` to avoid "too many open files" OS error |
| Themes | **Dusk** (default, defined on `:root`): a mid-dark warm grey canvas `#4a4e57` carrying deep navy cards `#2d3343`, a single sandy tan accent `#bc9876` and muted blue-grey secondaries. Deliberately not a black dark mode — the canvas is *lighter* than the cards. Nothing is pure white or pure black; status colours are desaturated to sage / tan / dusty terracotta. Cards carry no stroke: separation comes from surface and shadow, and `--border` is a 7% hairline used only for separators. Plus Light and Amber via `data-theme`. `main.jsx` and Settings share one resolver; legacy `"dark"`, `"prism"` and `"ember"` map to Dusk. |
| Shape and type | Five radii (`--r-sm/md/lg/xl/pill`), three elevations (`--shadow-card/raised/sheet`), a 4pt spacing scale (`--sp-*`) and a nine-step type scale (`--fs-*` / `--lh-*`). Set in **Nunito**, with tabular numerals globally so amounts align. |
| Colors | Theme surfaces come from CSS vars in `index.css`; categorical series colours from `frontend/src/utils/colors.js`. `designTokens.test.js` fails the build on a raw value anywhere else |
| `color-scheme` | Set per theme (`dark` on Dusk, `light` on the others) so native checkboxes, select popups, date pickers and scrollbars render against the right surface rather than in the platform's light default |
| Error boundary | `ErrorBoundary` class component wraps all routes; catches render errors, logs to console, shows retry UI |
| iOS zoom on focus | Every form control is 16 px; the Add Expense / Add Income forms set 13 px inline, so `.zoom-safe-form` forces `font-size: 16px !important` under 767 px (`index.css`). iOS Safari zooms for controls under 16 px and never zooms back. Suppressing zoom via the viewport meta was rejected — it breaks pinch-zoom accessibility |
| Native date fields | Avoided where a stray tap is costly (Split Pay slots): iOS opens the wheel on today and commits it on dismiss. `DateSheet` replaces them |
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

- `resolveIncome()` in `expenses.mjs` uses `ScanCommand` (full table scan), and every list endpoint scans then filters by `userId`. Fine at this size; a `userId` GSI would help at scale.
- No JWT refresh — when the ID token expires the next 401 signs the user out. The avatar menu shows the countdown.
- No server-side pagination — all records returned per request.
- Statistics "Survival / month" hardcodes RON 7,000 as a fixed living cost baseline (`SURVIVAL_BASELINE`).
- `GET /ai-news` (`AiNewsFunction`, optional `AnthropicApiKey` parameter) is still deployed but **no page calls it** — the AI News page was removed from the frontend.
- The `"local-dev"` userId fallback in handlers is dead code from the removed local backend.
