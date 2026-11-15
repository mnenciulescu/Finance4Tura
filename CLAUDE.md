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
├── frontend/        # React + Vite + TypeScript PWA (Apple-style, Light/Dark) + One-Page desktop dashboard
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

### Frontend (Vite + React + TypeScript)
```bash
cd frontend
npm run dev        # Dev server against the deployed API — production data
npm run build      # Production build
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint (JS + TS)
npm test           # Vitest, single run
npm run test:e2e   # Playwright: iPhone (WebKit) + Pixel (Chrome) against a stubbed harness
npm run check      # typecheck + lint + test + build + bundle budget (≤ 200 KB initial JS)
node scripts/generate-pwa-assets.mjs   # re-render icons and iPhone launch screens
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

Rebuilt in November 2026 from `Documentation/Frontend_Redesign_Proposal.md`
(Apple-style, phone-first PWA). That document is the design brief; this
section describes what is implemented.

- **Stack**: React 19 + Vite, React Router 7, TypeScript for new code
  (`allowJs` keeps `api/` in JS), **TanStack Query** for server state,
  **React Aria Components** for behaviour/accessibility (menus, dialogs,
  switches, calendar, press/long-press), **Motion** for drag gestures and
  layout animation, Recharts (lazy-loaded), `amazon-cognito-identity-js`.
- **iPhone look on every phone, native behaviour on each.** Platform
  detection (`app/platform.ts`, plus an inline script in `index.html` that sets
  `data-platform` / `data-standalone` / `data-theme` before first paint) drives
  behaviour only — back handling, edge swipe, install flow, haptics, text size —
  never appearance.
- **Fonts**: the system font on Apple devices (SF Pro); bundled Inter
  (`@fontsource-variable/inter`) everywhere else. Type scale in `rem` on a
  17 px root; iPhone follows Dynamic Type via `font: -apple-system-body`.
- **Mobile-first**: the PWA is one centred 430 px column (`--app-max-w`) on any
  screen. The one exception is **One-Page** (`/one-page`), a desktop dashboard
  — see its section below.

#### Folders (`frontend/src`)

| Folder | Contents |
|---|---|
| `theme/` | `tokens.css` (spacing, radii, type, motion, z), `themes.css` (the **only** stylesheet with raw colours: Light + Dark, primitives → semantic tokens), `base.css`, `themes.ts` (registry, migration), `ThemeProvider.tsx`, `domainColors.ts` (priority/platform/type/HTTP → `var(--…)`), `useChartTheme.ts` |
| `ui/` | Component library, one CSS Module each: `Button`, `List`/`ListSection`/`ListRow`, `Sheet`/`FormSheet`, `ActionSheet`, `Alert`, `Menu` (`PullDownMenu`, `ContextMenu`), `SwipeActions`, `Segmented` (`SegmentedControl` = radiogroup, `SegmentedTabs` = tablist), `Toggle`, `Checkbox`, `Stepper`, `Fields`, `SearchField`, `Picker`, `Rating`, `DatePicker` (+ lazy `CalendarBody`), `Display` (`Card`, `Widget`, `StatTile`, `Badge`, `ProgressBar`, `ProgressRing`, …), `Toast`, `PrivateValue`, `icons/Icon.tsx` |
| `app/` | `AppShell`, `TabBar`, `Screen` (large-title nav bar), `AccountSheet`, `routes.tsx`, `navigation.ts`, `tabHistory.ts`, `overlays.ts`, `queryClient.ts`, `platform.ts`, `haptics.ts`, `install.ts`, `useKeyboardInset.ts`, `usePullToRefresh.tsx`, `UpdatePrompt.tsx`, `ErrorBoundary.tsx` |
| `features/` | `today/`, `money/{budget,split,stats,invest,forms}/`, `library/`, `hq/`, `account/{settings,backstage,admin}/`, `auth/`, `one-page/` |
| `data/` | `queries.ts` (reads + shared helpers), `mutations.ts` (writes for lazy screens), `hq.ts` |
| `context/` | `AuthContext`, `AppSettingsContext`, `YearContext`, `PrivacyContext` |
| `api/`, `utils/` | API modules (unchanged); `format`, `money`, `split`, `parseAmount` |

#### Themes and tokens
- **Light** and **Dark** (iOS system colours) plus **Automatic** (follows the
  device live). Stored as `uiTheme` (`auto | light | dark`). The old
  `appTheme` is migrated once: `light` → Light, Dusk/Amber/older → Dark.
- `theme-color` meta and `color-scheme` follow the applied theme.
- New theme = one `[data-theme="x"]` block in `themes.css` + one entry in
  `themes.ts`.
- `src/test/guards.test.ts` fails the build on: hex/`rgb()` outside
  `themes.css`/`themes.ts`; `--system-*` primitives outside the theme;
  non-token `border-radius`, `box-shadow` or `font-size` in stylesheets; form
  controls below 16 px (`--fs-control: max(16px, 1rem)`); a second
  `--app-max-w`; pinch zoom disabled.

#### Navigation
- **Tab bar**: **Today · Money · Library · HQ** (translucent material, filled
  icon when selected). Each tab remembers its last screen and scroll position;
  re-tapping the selected tab pops to its root (Money → Budget also jumps back
  to the current period).
- **Money** has a segmented control — **Budget · Split · Stats · Invest** —
  routes `/money`, `/money/split`, `/money/stats`, `/money/invest`. Segment
  switches replace the history entry.
- **Account**: the initials avatar at the trailing edge of every root screen
  opens the **Account sheet**: username, session countdown, **Settings**,
  **Backstage** (only while `backstageEnabled`), **Admin** (only `ADMIN_USER`),
  **Sign Out**. Settings/Backstage/Admin push onto the tab that opened them.
- **History rules** (`app/tabHistory.ts`, `app/overlays.ts`): every sheet,
  alert, action sheet and menu pushes a history entry, so the Android back
  button / gesture closes the top overlay first; leaving Today pushes once and
  other tab switches replace, so back from another tab's root returns to Today
  and back at Today leaves the app. A dirty form vetoes back with "Discard
  changes?". Navigating from inside an overlay calls `consume()` and replaces.
- **iPhone-only edge swipe** back on pushed screens (`/settings`, `/backstage`,
  `/admin`, `/hq/settings`); off on Android, whose system gesture uses the edge.
- **Routes**: `/`, `/money[/split|/stats|/invest]`, `/library`, `/hq`,
  `/hq/:locationId`, `/hq/settings`, `/settings`, `/backstage` (gated by
  `backstageEnabled`), `/admin` (username `nenciulescu`). Deep links
  `/money/expense/:id|new` and `/money/income/:id|new`, and the old
  `/add-expense`, `/add-income` (`?id=`, `?date=`) open the sheet over Budget.
  `/one-page` renders outside the phone shell (no tab bar).
  Old `/finance`, `/split-payments`, `/statistics`, `/investments`,
  `/books-and-dev`, `/headquarters` redirect. Unknown paths → `/`.
- Every screen except Today, every chart, the calendar, the forms, the
  Account sheet, Login and Motion's animation features are lazy-loaded;
  `scripts/check-bundle.mjs` keeps the first download ≤ 200 KB gzipped
  (currently ~199 KB) and what One-Page adds ≤ 150 KB (currently ~90 KB).

#### Patterns
- **Create / edit** = a `FormSheet` (Cancel · Title · Save/Add) over the
  current screen; dirty forms ask before discarding (Cancel, scrim, drag,
  Escape or system back). Save is disabled offline.
- **Delete**: swipe rows reveal Edit / Delete; Delete arms as "Confirm Delete"
  for 4 s and the second tap deletes — a full swipe only arms it. Menus and
  edit sheets confirm with an action sheet. Series deletes ask *This
  occurrence / Entire series*.
- **Long-press / right-click** opens the row's context menu (the platform's
  own callout and text selection are suppressed).
- **Amounts** accept `,` or `.` as the decimal separator (`utils/parseAmount`).
- **Dates** use the app's calendar sheet (`DatePickerSheet`, Monday first,
  Clear, no Today shortcut); native `<input type="date">` stays banned.
- **Pull to refresh** on Today, Budget, Library, HQ and the other Money
  segments. Toasts report results; an offline capsule appears without network.
- **Server state**: TanStack Query, persisted to IndexedDB (instant / offline
  launch, cache busted per build). Mutations are optimistic with rollback.
  Admin data (`meta.persist: false`) is never persisted. Sign-out (or a 401)
  clears memory and the persisted copy.
- **PWA**: `registerType: "prompt"` — a "New version available · Reload" toast
  replaces closing and reopening the app. Install row in Settings → About and
  a one-time banner on Today (Android: native prompt; iPhone Safari: Share →
  Add to Home Screen instructions). Icons: any, maskable, monochrome, Apple
  touch; 20 iPhone launch screens (Light/Dark) in `public/splash/`.

#### Sensitive values (`context/PrivacyContext.tsx`, `ui/PrivateValue.tsx`)
- **Income amounts** (Budget period header): hidden unless shown; the eye
  button on Budget toggles and persists `incomePrivacy` (`"true"` = visible),
  and Settings → Privacy sets the same default.
- **Holdings** on Today: masked until the eye button is held; released,
  cancelled, or the app hidden → masked again. Never persisted.
- Hidden values are not rendered at all (a redaction capsule, "Hidden amount").
- Settings → Privacy → **Hide in app switcher** blurs the app while hidden.
- Admin → Delete user requires the admin's password in an alert.

### Today

Route `/` — `features/today/Today.tsx`. Large title "Today" with the date.
Widgets, all loaded together (incomes, expenses, split payments, books,
snapshots, FX):

1. **This Period** — `PeriodHeader` (shared with Budget) for the current
   income (latest `date ≤ today`); the expenses mapped to it that were
   **outstanding when the screen loaded**, priority then date. Ticking marks
   Completed (optimistic, reverts on failure); the row stays struck through
   until the next load or pull to refresh. Footer: **Done** / **Pending**
   totals for the whole period. Empty states: "No expenses for this period." /
   "Nothing left to pay." Tapping the header opens Budget.
2. **Split Payments** — the three newest open entries with their slot grids
   (same rules as Split); *See All* → Money → Split.
3. **Holdings** — portfolio total in EUR and the platforms with a snapshot > 0
   in the last 12 months, all masked behind hold-to-reveal; FX date.
4. **Library** — persons (alphabetical) × types with entries, each cell the
   latest entry.

### Money → Budget

Route `/money` — `features/money/budget/Budget.tsx`.

- One income period at a time in a **CSS scroll-snap pager** (incomes in the
  selected year); ‹ › buttons, "Period N of M", and a **Today** button when
  off the current period. The pager takes the visible card's height.
- Nav bar: **year menu** (years with data, capped at the current year;
  `YearContext`, shared with Stats), **eye** (income amounts), **+** (New
  Expense / New Income).
- Period card: `PeriodHeader` (date, *Current* badge, name, private amount,
  ··· menu: Edit Income, Add Expense to This Period, Delete Income), the
  **budget bar** (Done / Pending / Free or Over, with Spent · Done · Pending ·
  Free/Over figures), expense rows (circular checkbox, priority dot, ★ special
  tint, summary, MM-DD, amount; tap = edit; swipe Edit/Delete; long-press menu),
  and **+ Add Expense** (pre-fills the period's date).
- Deleting an income remaps its expenses to the best remaining income,
  optimistically (`data/mutations.ts` → `useDeleteIncome`).

**Expense / income sheets** (`features/money/forms/`): Summary, Amount
(decimal), Currency, Date (current year only), live "Maps to …" preview via
`/expenses/resolve-income` (expenses); Priority, Status, Special (expenses);
Repeat → Frequency, Ends (create only). Editing a series member asks *Save for
This Occurrence Only / All Future Occurrences* (`PUT /{id}` vs `/{id}/series`).
Delete at the bottom of the edit sheet.

### Money → Split

Route `/money/split` — `features/money/split/`.

- Header line: `N open · M settled · left to cover …` per currency; **+** in
  the nav bar opens the create sheet.
- **In progress** (expanded by default) and **Settled** (collapsed section).
  Card head: coverage ring, title, total, date, `paid/count`, amount left.
- Slots (`SplitSlots.tsx`): **exactly `occurrenceCount`**, two per row, index
  badge, nothing beside them. Amount slots are text inputs with the decimal
  keyboard; date slots open the calendar sheet (Clear inside). Edits save after
  600 ms per entry with `{ occurrences }` only. Filling the last empty slot
  holds the save and asks **"Mark as settled?"** 700 ms after typing stops;
  Cancel restores, clearing the slot withdraws the question
  (`useSplitEditor.ts`, shared with Today). The card stays in progress and
  expanded while asked. "Saving… / Saved" footnote; failures toast.
- Card ··· menu: **Cover Rest** (amount entries; last slot absorbs rounding),
  **Clear All**, Edit, Delete (confirmed).
- Sheet: Title, Date, Total, Currency, Occurrences (stepper 1–36), Track by
  (segmented; locked once a slot is filled). Count changes keep values by index.

### Money → Stats

Route `/money/stats` — `features/money/stats/`. Calculations unchanged
(`statsMath.ts`): averages over months with data; **Survival / month** =
`avg.high + avg.medium × 0.8 + 7000` (`SURVIVAL_BASELINE`); future months
without data blank.

- Subtitle `N months with data · now <Mon>`; year menu in the nav bar.
- Tiles: Avg free / month (red when negative), Survival / month; High /
  Medium / Low average rows.
- **Free amount per month** bar chart (rounded tops, current month full
  opacity, others 50 %, dashed "now", zero line). Tapping a bar shows the
  month's Income / High / Medium / Low / Free under the chart.
- **★ Special expenses** — collapsible section with the total.

### Money → Invest

Route `/money/invest` — `features/money/invest/`. Data rules unchanged
(`investMath.ts`).

- Subtitle `N snapshots · M operations` (snapshot **dates**); **+** menu: New
  Snapshot / New Operation.
- **Total portfolio** — collapsible: EUR total, platform count, FX date;
  expanded rows for `heldPlatforms` (latest > 0) with share bars and %.
- **Evolution** — line chart from `CHART_START` (2023-01) with carry-forward;
  range control **1Y · 3Y · All** (default All); legend chips (Total on,
  `activePlatforms` off); operation-month dots; tooltip with value, operations
  and net cash.
- **Snapshots** grouped by date (3 at a time, Show N More / Show Less), rows
  swipe Edit/Delete, *+ Add Platform to This Date*.
- **Operations** newest first (3 at a time), Deposit/Withdrawal badges, notes
  on expand, swipe Edit/Delete. Sheets pre-fill the platform's currency;
  snapshot edits keep the id. Platforms: eToro, Binance, Fidelity, Tradeville,
  ING Funds RON, ING Funds EUR.

### Library (Books & Development)

Route `/library` — `features/library/`.

- Subtitle `N people · X of Y entries` (+ Clear when filtered); accessory row:
  search (title/author) and **Filter** (person, type, source, rating; count).
- One collapsible section per person (alphabetical, Unassigned last): a
  **Last 12 months** line chart of completions per month (any type/source,
  filtered entries) with the total, then entry cards revealed 1 → 6 → 11…
  with *Show N More* / *Show N Less* (steps back to the previous page).
- Card: title, author · source, type badge, inline 1–5 star re-rating
  (optimistic), `dateCompleted`; tap expands comments; swipe / long-press for
  Edit / Delete. Sheet: Person (suggestions), Title, Author, Type, Source,
  Completed (month picker), Rating, Comments.

### HQ (Headquarters)

Routes `/hq`, `/hq/:locationId`, `/hq/settings` — `features/hq/`.

- Chip bar: **Overview** · one chip per location (chip switches replace
  history); ··· → **HQ Settings** (pushed).
- **Overview**: per location, water templates show the consumption chart
  (cold/hot per month, values on points, dashed averages, last 3 years); other
  templates a read-only list (5, then Show More).
- **Location**: one section per template with **SMS** (water templates: the
  meter-reading text with Copy) and **New Entry**. Entries newest first;
  expand shows values and the computed **Consum Apa Rece / Calda**; Edit opens
  stacked fields that auto-save after 600 ms ("Saving… / Saved"; new entries
  are created on first save); swipe or button to delete (confirmed).
- **HQ Settings**: locations (name, address, order; delete disabled while
  templates exist) and templates (location fixed on edit, name, 1–30
  parameters with type, unit, reorder ↑↓, remove; deleting removes entries).

### One-Page (desktop dashboard)

Route `/one-page` — `features/one-page/`. Spec and implementation notes:
`Documentation/OnePage_Desktop_Proposal.md`. Frontend only; no backend change.

- **Layout**: sticky translucent header (year menu shared with Budget/Stats,
  Refresh, income eye, **+ New** — Expense, Income, Split, Snapshot, Operation,
  Library entry — Light | Dark switch, account menu). Three columns from
  1280 px, each scrolling on its own: **Budget · Split** | **Investments ·
  Statistics** | **Library · HQ**; two columns from 1024 px, one below (with a
  "made for larger screens" note). Blocks collapse from their title
  (`onePage.collapsed` in localStorage) and each has its own error boundary.
- **Presentation switch**: `routes.tsx` provides `LayoutContext` = `"desk"` on
  `/one-page`. There `Sheet`/`FormSheet` render as centred dialogs (520 px;
  760 px for large content sheets; close button when there is no form
  header), `ActionSheet` as an alert with stacked choices, and `SwipeActions`
  as hover/focus row buttons with the same two-step delete
  (`ui/DeskOverlays.tsx`, lazy). Every form, validation and confirmation is
  the phone's own code. `html[data-layout="desk"]` sets a 15 px root.
- **Lists** show 3, then *Show 5 More* / *Show Less* / *Show All*
  (`ui/ShowMore.tsx`).
- **Blocks**: Budget (period picker ‹ › + dropdown + Today, budget bar,
  All/Pending/Done/★ filter, rows with hover actions and right-click menu);
  Split (In progress / Settled tabs, same slots and settle prompt);
  Investments (Portfolio / Snapshots / Operations; **all amounts masked**
  behind hold-to-reveal); Statistics (tabs Budget, Priorities with a
  per-month table, ★ Special, Invest evolution — values hidden unless held —,
  Library per-person 12-month chart following the Library filters, HQ water
  charts); Library (search, Filter, a tab per person); HQ (Overview + a tab
  per location; entries inline with auto-save; ⚙ opens HQ Settings as a
  dialog).
- **State in the URL** (`?period=&split=&inv=&stats=&lib=&hq=&hqchart=`),
  written with replace, so browser Back only closes dialogs. Deep links
  `?expense=new|<id>&date=` and `?income=new|<id>` open the form and are
  consumed. Cross-links ("View evolution →", "Chart →", "View chart →",
  "Open in Budget →") switch the other block's tab and flash it.
- **Keyboard**: `N` then `E/I/S/P/O/B` (new …), `←/→` period, `T` current
  period, `/` library search, `H` income amounts, `R` refresh, `?` list.
  Ignored while typing or with a dialog open.
- **Entry points**: the URL; the Account sheet's *One-Page (Desktop)* row
  (screens ≥ 1024 px); Settings → Desktop → *Open One-Page on this computer*
  (`onePage.default`, only when `/` launches on a ≥ 1024 px screen). The
  account menu has *Open Mobile Layout*.
- Shared pieces extracted for both layouts: `SplitCard`, `InvestPanels`
  (`PortfolioCard`, `SnapshotList`, `OperationList`, `EvolutionPanel`),
  `StatsPanels`, `BookCard`, `ReadList`, `HqSettingsContent`,
  `useBudgetDeletes`, `splitGroups` / `outstandingByCurrency`.

### Settings, Backstage and Admin

Pushed from the Account sheet.

- **Settings**: Appearance (Automatic · Light · Dark, live previews), Privacy
  (income amounts default, hide in app switcher), Feedback (Haptics, where
  supported), About (version, session, Install App). Changes apply at once.
- **Backstage** (`backstageEnabled`): table chips (Incomes, Expenses,
  Operations, Snapshots, Splits), search, 10 per page, swipe or two-step delete,
  live **API log** of the last 50 calls (method, URL, status, ms; tap for time
  and params).
- **Admin** (`nenciulescu` only): App Settings toggles; FX matrix + **Update
  FX Rates**; **Back Up All Tables** (preview → per-table progress → Drive
  link); Users (email, counts, Admin/Disabled badges) → user sheet: admin role
  toggle (not for yourself), **Delete User and All Data** after re-entering
  your password.

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
- Login (`features/auth/Login.tsx`, lazy): username / password (show-hide eye),
  sign-up with confirmation when enabled, Google's own button (theme follows
  the app). Signing out clears the query cache and its IndexedDB copy.

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
# Frontend
cd frontend && npm test          # Vitest (jsdom)
cd frontend && npm run test:e2e  # Playwright, iPhone 15 (WebKit) + Pixel 7 (Chrome)

# Backend (Node.js built-in test runner)
cd backend && node --test src/**/*.test.mjs
```

### Test coverage
| Scope | Files | Tests |
|---|---|---|
| Frontend logic | `expandDates`, `incomeMapping`, `dateValidation`, `formValidation`, `statistics`, `YearContext`, `parseAmount`, `split`, `theme`, `navigation` | 128 incl. guards |
| Frontend guards | `guards.test.ts` — colour/radius/shadow/type tokens, 16 px controls, one 430 px column, pinch zoom | (in the row above) |
| Frontend UI library | `ui/ui.test.tsx` — sheets, discard prompt, overlay stack + system back, alerts, swipe two-step, PrivateValue, controls, toasts | 22 |
| Frontend screens | Today (10), split slots on Today + Split (29), Budget (13), forms (6), Stats (6), Invest (7), Library (6), HQ (6), shell (7), Settings/Admin/Login (7) | 96 |
| One-Page | `features/one-page/onePage.test.tsx` — blocks, Budget paging and periods, URL state, deep links, masked holdings, income privacy, shortcuts, theme switch, desktop dialog and hover actions | 13 |
| Cross-platform (Playwright) | back navigation, discard prompt, iOS-only edge swipe, long-press menu, hold-to-reveal, comma decimals, no overflow at 360/393/430 px × 2 themes — on both profiles | 26 |
| One-Page (Playwright) | `e2e/onepage.spec.ts` on desktop Chrome (1440) and desktop WebKit (1280): 3/2/1 columns, independent column scroll, no overflow at 1024–1920 px × 2 themes, Back closes dialogs, dirty-form Escape, hover two-step delete, right-click menu, hold-to-reveal (mouse and Space), shortcuts, cross-links | 34 |
| Backend handlers | `validation` (year range), `amountValidation` | 24 |
| Backend lib | `expandDates`, `resolveIncome` | 24 |

Vitest page tests render with Testing Library inside `test/utils.tsx`
(providers, fresh query client) against mocked API modules. Playwright runs the
real app built from `e2e/harness/` — Cognito stubbed, every API call answered
from invented fixtures, nothing reaches AWS. Time-dependent tests pin "today".

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
| Frontend | React + Vite + TypeScript (S3/CloudFront static), PWA; React Aria Components + Motion + TanStack Query (see `Frontend_Redesign_Proposal.md` §12.1) |
| API | AWS SAM Lambda, one function per module |
| Auth | Cognito User Pool + GIS Google Sign-In via custom Lambda |
| Cache-Control | `no-store` on all Lambda responses (prevents API Gateway CloudFront caching) |
| FX rates | Stored in `FxRates` DynamoDB table (base EUR), shared across all users; refreshed manually from Admin → FX Rates. No runtime online fetch or localStorage buffering |
| One phone-width layout | Every PWA page is a centred 430 px column on any screen. The app is used as an installed PWA; one layout removes desktop/mobile divergence. Supports 360–430 px phones |
| One-Page | A desktop dashboard at `/one-page`, not a second app: same login, cache, data hooks and forms. A layout context switches shared components to dialogs and hover actions. Phones never redirect to it |
| Navigation | Four tabs — Today · Money · Library · HQ. Money's sections are a visible segmented control, not a hidden menu. Settings/Backstage/Admin live in the Account sheet. Overlays and tabs are mirrored in browser history so Android back behaves natively |
| Split Payments | Card list; open entries expanded, settled collapsed; slot count pinned to the series; app calendar instead of native date fields; settling asks first; debounced coverage auto-save shared by Today and Split |
| Statistics | Expenses-by-Priority chart removed and its data moved into the Free-amount tooltip; Special Expenses is an expandable block |
| Investments | Expandable total, chart from 2023 with 1Y/3Y/All range, snapshots and operations revealed 3 at a time; sheets for add/edit; swipe or confirmed delete |
| Library | Library tab; per-person sections with a 12-month completion chart, inline star ratings, search + filter sheet |
| App Settings | Global settings stored in DynamoDB (`AppSettings` table); GET is public, PUT is admin-only |
| Admin | Page restricted to username `nenciulescu` in the frontend; admin API routes require the Cognito `admin` group |
| Cognito auth flows | App client allows `USER_SRP_AUTH`, `REFRESH_TOKEN_AUTH` and `ADMIN_USER_PASSWORD_AUTH` only; `USER_PASSWORD_AUTH` is off. This narrows the surface but is **not** a defence against a known password — SRP authenticates with the password too. The real protection is that no password is derivable (see Google Sign-In below) |
| `sam build` on macOS | Prefix with `ulimit -n 10240 &&` to avoid "too many open files" OS error |
| Themes | **Light** and **Dark** (iOS system colours) plus **Automatic**. Primitives → semantic tokens in `themes.css`, the only file with raw colours. Dusk/Amber removed; `appTheme` migrated to `uiTheme` |
| Shape and type | Six radii (`--radius-xs…full`), iOS type scale in rem on a 17 px root (Dynamic Type on iPhone), 8 pt spacing, materials (translucent blur) for bars. SF Pro on Apple devices, bundled Inter elsewhere |
| Colors | Components read semantic tokens; domain colours (`theme/domainColors.ts`) map to `var(--series-n)` / `var(--status-*)`. Charts resolve them via `useResolvedColors`. `guards.test.ts` fails the build on a raw value elsewhere |
| `color-scheme` | Set per theme (`light` / `dark`) so native controls, autofill and scrollbars render against the right surface |
| Bundle budget | First download ≤ 200 KB gzipped (`scripts/check-bundle.mjs`): screens, charts, calendar, forms, Login and motion features lazy-loaded |
| Server state | TanStack Query persisted to IndexedDB for instant/offline launch; optimistic mutations; cleared on sign-out; admin data never persisted |
| Error boundary | `app/ErrorBoundary.tsx` around the routes (resets on navigation); shows Try Again |
| iOS zoom on focus | Every control uses `--fs-control: max(16px, 1rem)`; iOS zooms below 16 px and never zooms back. Viewport zoom suppression rejected — it breaks pinch-zoom accessibility |
| Native date fields | Banned app-wide: iOS opens the wheel on today and commits it on dismiss. `DatePickerSheet` (React Aria calendar, Monday first, Clear) and a month picker replace them |
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
- No JWT refresh — when the ID token expires the next 401 signs the user out. The Account sheet shows the countdown.
- No server-side pagination — all records returned per request.
- Statistics "Survival / month" hardcodes RON 7,000 as a fixed living cost baseline (`SURVIVAL_BASELINE`).
- `GET /ai-news` (`AiNewsFunction`, optional `AnthropicApiKey` parameter) is still deployed but **no page calls it** — the AI News page was removed from the frontend.
- The `"local-dev"` userId fallback in handlers is dead code from the removed local backend.
