# One-Page — Desktop Dashboard (Feature Proposal)

**Status:** implemented on branch `feature/one-page` (November 2026). See
§18 for how the implementation differs from this proposal.
**Scope:** frontend only. No backend, API, table or infrastructure change.
**Audience:** the implementer. Read with `CLAUDE.md` (what the PWA does today)
and `Frontend_Redesign_Proposal.md` (the design language).

---

## 1. Summary

One-Page is a new route, **`/one-page`**, in the existing app. It is a
desktop-only dashboard that puts everything the PWA spreads across the
**Money**, **Library** and **HQ** tabs onto one screen:

- **Three columns of blocks**, ordered by priority: finance first, with
  **Budget** at the top of the first column.
- **Tabs inside blocks** where a block covers several sub-areas
  (Investments, Statistics, Library, HQ).
- **Long lists show 3 entries**, with *Show more* / *Show less*.
- **Create and edit in pop-up dialogs**. These are the PWA's own form sheets,
  shown as centred dialogs.
- **Sensitive values stay hidden** with the same rules as the PWA: income
  amounts behind an eye toggle, holdings behind hold-to-reveal.
- **Light / Dark switch** in the header, shared with the PWA setting.
- **Apple-style (macOS-like) look on any desktop browser.** Pointer, hover,
  keyboard and right-click are first-class.
- **Statistics** has one tab per topic: Budget, Priorities, Special,
  Investments, Library, HQ.

It reuses the PWA's data layer, business logic, forms and components.
Nothing about the mobile app changes: same URLs, same layout, same 200 KB
first-download budget.

### Key decisions at a glance

| Question | Decision | Why |
|---|---|---|
| Separate app or a route? | A route in the same app, `/one-page`, outside the mobile shell | Same login, cache, data hooks, forms and deploy. No second build |
| Column arrangement | **Col 1 Money now** (Budget, Split) · **Col 2 Money over time** (Investments, Statistics) · **Col 3 Life** (Library, HQ) | Finance priority runs left to right, matching reading order |
| Scrolling | Each column scrolls on its own under a fixed header | Budget stays in view while browsing Library or HQ |
| Where charts live | In **Statistics**, one tab per topic. Blocks link to their tab | One place for analysis; blocks stay compact |
| Forms | Existing sheets, shown as centred dialogs through a presentation switch | No duplicated forms or validation |
| Navigation state | In the URL query (`?period=…&stats=invest…`) and replaced, not pushed | Reload and bookmarks keep the view; Back closes dialogs only |
| Small screens | Below 1024 px: single column plus a "made for desktop" note. No redirect | Desktop-only by design, but never broken |
| Entry point | Typed URL; **One-Page** link in the PWA Account sheet; optional "Open One-Page on this computer" preference | "Accessible directly from the main link" with no surprises |

---

## 2. Scope

**In scope:** everything under the PWA's Money, Library and HQ tabs.

| PWA area | Routes today | One-Page block |
|---|---|---|
| Money → Budget | `/money`, `/money/expense/:id`, `/money/income/:id` | **Budget** |
| Money → Split | `/money/split` | **Split Payments** |
| Money → Invest | `/money/invest` | **Investments** (data) + Statistics → Investments (chart) |
| Money → Stats | `/money/stats` | **Statistics** → Budget / Priorities / Special |
| Library | `/library` | **Library** + Statistics → Library (chart) |
| HQ | `/hq`, `/hq/:locationId`, `/hq/settings` | **HQ** + Statistics → HQ (water chart) |

**Out of scope:**
- **Today:** its widgets are covered by Budget (This Period), Investments
  (Holdings) and Library.
- **Settings, Backstage, Admin:** opened from the account menu; they open
  the PWA pages.
- **Login:** shared; the same login screen appears when signed out.

**Not changed:** the backend, the API, DynamoDB, Cognito, CloudFront and S3,
and every PWA screen.

---

## 3. Analysis of current PWA functionality

An inventory of what must survive, and how each mobile interaction maps to
the desktop. This is the checklist for "the entire current functionality is
kept".

### 3.1 Money → Budget

| Function | PWA today | One-Page |
|---|---|---|
| Year selection | Year menu (years with data, capped at the current year), `YearContext` shared with Stats | **Header** year menu; still drives Budget and Statistics together |
| Period navigation | Scroll-snap pager, ‹ ›, "Period N of M", **Today** | ‹ › buttons, `←` / `→` keys, **period dropdown** (all incomes in the year), **Today**; no swipe pager |
| Period header | Date, *Current* badge, name, private amount, ··· (Edit Income, Add Expense to This Period, Delete Income) | Same `PeriodHeader` component; ··· becomes a pull-down plus right-click menu |
| Budget bar | Done / Pending / Free or Over, figures | Same `BudgetBar` |
| Expense rows | Checkbox (optimistic), priority dot, ★ special, summary, MM-DD, amount; tap = edit; swipe Edit/Delete; long-press menu | Same row; click = edit, **hover reveals Edit / Delete** buttons, right-click = context menu. Two-step delete kept |
| Add | + Add Expense (pre-filled date); nav-bar + (New Expense / New Income) | **+ Add Expense** in the block; global **+ New** in the header |
| Delete income | Remaps expenses optimistically (`useDeleteIncome`) | Unchanged, same hook |
| Income privacy | Eye button, persists `incomePrivacy` | Eye in the **header**, same key |
| Deep links | `/money/expense/:id`, `/money/income/:id`, `/add-expense?id=&date=` | `/one-page?expense=<id|new>&date=` and `?income=<id|new>` open the dialog over One-Page |

### 3.2 Expense / Income forms

Summary, Amount (`parseAmount`, `,` or `.`), Currency, Date (current year,
app calendar), live "Maps to …" preview (`/expenses/resolve-income`),
Priority, Status, Special, Repeat → Frequency, Ends (create only). Editing a
series member asks *This Occurrence Only / All Future Occurrences*. Delete is
at the bottom of the form, and a dirty form asks before discarding.

On One-Page these are **the same components** (`ExpenseSheet`,
`IncomeSheet`) in dialog presentation (§9). All rules, validation and series
behaviour come for free.

### 3.3 Money → Split

| Function | PWA today | One-Page |
|---|---|---|
| Summary line | `N open · M settled · left to cover …` per currency | Block subtitle |
| Sections | In progress (expanded), Settled (collapsed) | Tabs **In progress · Settled**, 3 cards each + Show more |
| Card | Coverage ring, title, total, date, paid/count, amount left; slot grid | Same card. On wide columns the slot grid shows **3 per row** (2 on mobile) |
| Slots | Exactly `occurrenceCount`; amount slots (decimal) or date slots (calendar); 600 ms auto-save; "Mark as settled?" 700 ms after the last slot fills | Unchanged: same `SplitSlots` and `useSplitEditor` |
| Card menu | Cover Rest, Clear All, Edit, Delete (confirmed) | ··· and right-click |
| Create / edit | Sheet: Title, Date, Total, Currency, Occurrences 1–36, Track by | Dialog (same `SplitFormSheet`) |

### 3.4 Money → Invest

| Function | PWA today | One-Page |
|---|---|---|
| Total portfolio | Collapsible EUR total, platform count, FX date; rows per held platform with share bars | **Investments → Portfolio** tab; total and rows **masked behind hold-to-reveal** (see §10) |
| Evolution chart | From 2023-01, carry-forward, 1Y/3Y/All, legend chips, operation dots, tooltip | **Statistics → Investments**; hover tooltips |
| Snapshots | Grouped by date, 3 dates at a time, swipe Edit/Delete, *+ Add Platform to This Date* | **Investments → Snapshots** tab; 3 dates + Show more/less; hover actions |
| Operations | Newest first, 3 at a time, Deposit/Withdrawal badges, notes on expand | **Investments → Operations** tab; same |
| Forms | Snapshot / Operation sheets, platform currency pre-fill, snapshot edits keep the id | Dialogs (same `InvestForms`) |

> The PWA shows holdings masked **only on Today**; Invest shows amounts
> openly. One-Page sits on a desktop that may be in an office or on a shared
> screen, so it applies the Today rule to the Portfolio tab as well. This is
> a deliberate tightening, in the spirit of "protect sensitive data".

### 3.5 Money → Stats

Calculations come from `statsMath.ts`, unchanged: averages over months with
data, Survival / month = `avg.high + avg.medium × 0.8 + 7000`, and future
months left blank. Current UI: tiles (Avg free, Survival), High / Medium /
Low averages, the Free-per-month bar chart (tap a month for its breakdown)
and the Special expenses section. On One-Page these split into the
**Budget**, **Priorities** and **Special** tabs (§7.4).

### 3.6 Library

| Function | PWA today | One-Page |
|---|---|---|
| Subtitle | `N people · X of Y entries` (+ Clear when filtered) | Block subtitle |
| Search / filter | Search (title/author); Filter sheet (person, type, source, rating) | Search field in the block header; **Filter popover** (same fields) |
| Per person | Collapsible section; 12-month chart; entries 1 → 6 → 11 with Show N More / Show N Less | **Person tabs** (All + one per person, Unassigned last); 3 entries + Show more/less; the chart moves to Statistics → Library |
| Card | Title, author · source, type badge, inline 1–5 star rating (optimistic), date; tap expands comments; swipe / long-press Edit / Delete | Same; click expands; hover actions; right-click menu |
| Create / edit | Sheet: Person (suggestions), Title, Author, Type, Source, Completed (month picker), Rating, Comments | Dialog (same `BookSheet`) |

### 3.7 HQ

| Function | PWA today | One-Page |
|---|---|---|
| Location switching | Chip bar: Overview + one chip per location | Tabs: **Overview** + one per location |
| Overview | Water chart per water template; read-only lists of other templates (5, then Show More) | Latest entry per template, 3 + Show more; *View chart* jumps to Statistics → HQ |
| Location | Section per template: **SMS** (meter text + Copy), **New Entry**, entries newest first, expand shows values + Consum Apa Rece/Calda, inline editor with 600 ms auto-save, delete confirmed | Same sections; entries 3 + Show more; SMS opens a popover with Copy; **New Entry opens a dialog**; editing stays inline with auto-save |
| HQ Settings | Pushed screen: locations (name, address, order; delete blocked while templates exist), templates (1–30 parameters, type, unit, reorder, remove) | ⚙ in the HQ block header opens **HQ Settings as a large dialog** (same `HqSettings` content) |

> **New Entry:** the PWA creates the entry on first auto-save. The desktop
> dialog collects the values and creates the entry on **Add**, which is
> clearer with a mouse. After that the entry is edited inline with auto-save,
> exactly as in the PWA. The dialog reuses the inline editor's field set.

### 3.8 Cross-cutting behaviour that must carry over

- **Optimistic mutations with rollback** and toasts on failure (TanStack Query).
- **Offline:** cached data shows instantly from IndexedDB, an offline capsule
  appears, and Save is disabled offline.
- **Two-step delete** everywhere: *Delete* arms as *Confirm Delete* for 4 s.
  Menus confirm with an action sheet, shown on desktop as a small
  confirmation popover (§9.3).
- **Series delete** asks *This occurrence / Entire series*.
- **Dirty-form veto** on Cancel, Escape, scrim click and browser Back.
- **Dates** use the app calendar (Monday first, Clear). Native date inputs
  stay banned.
- **Session**: 401 → sign out; the countdown shows in the account menu.
- **Update prompt**: the "New version available · Reload" toast is shared.

### 3.9 Mobile-only behaviour that does not apply

Tab bar and tab history, edge swipe, pull to refresh (replaced by a ⟳
button and refetch on window focus), swipe rows (replaced by hover actions),
haptics, the keyboard inset, the install banner and iPhone launch screens.

---

## 4. Information architecture

### 4.1 Priority ranking

From the brief ("financial details have priority, especially Budget") and
from how often each area changes:

1. **Budget**: daily; ticking expenses, adding entries, checking Free.
2. **Split Payments**: weekly; filling slots.
3. **Investments**: monthly; snapshots and operations.
4. **Statistics**: read-mostly analysis.
5. **Library**: occasional.
6. **HQ**: monthly meter readings.

### 4.2 Layouts considered

| Option | Columns | Verdict |
|---|---|---|
| A. One module per column (Money · Library · HQ) | Money crammed into one column; Library and HQ get too much space | ✗ Fights the priority ranking |
| B. Budget spans two columns; everything else in the third | Budget very wide (rows stretch, hard to scan); five areas stacked in one column | ✗ |
| **C. Money now · Money over time · Life** | Col 1 Budget + Split; Col 2 Investments + Statistics; Col 3 Library + HQ | ✓ **Recommended** |
| D. A single Statistics column spanning the bottom | Charts read well wide, but push everything below the fold | ✗ Optional later as a "focus" mode (§13) |

Why **C**:
- The two blocks you act on most (Budget, Split) are in the first column, at
  the top-left, where the eye lands.
- Column 2 is the money analysis: how the portfolio is doing and how the year
  is going.
- Column 3 holds the non-finance modules, always visible but not competing.
- Each column has two blocks, which balances heights.

### 4.3 Wireframe (≥ 1440 px)

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ ◉ 4TURA Home · One-Page   [2026 ▾]    ⟳   👁 Income   [+ New ▾]   [☀ Light|☾ Dark]  (MN) │  header 56 px, translucent
├──────────────────────────────┬────────────────────────────┬──────────────────────────────┤
│ BUDGET                       │ INVESTMENTS                │ LIBRARY        🔍  ⚲ Filter  │
│ ‹ 15 Nov · Salary ▾ ›  Today │ [Portfolio|Snapshots|Ops]  │ [All|Ana|Mihai|…]          + │
│ ┌──────────────────────────┐ │  Total  ▓▓▓▓▓▓  hold 👁    │  ▸ Book title   ★★★★☆  2026-10│
│ │ 15 Nov  Current  Salary  │ │  eToro    ▓▓▓▓ 42 %  ▓▓▓   │  ▸ Book title   ★★★☆☆  2026-09│
│ │ RON ▓▓▓▓▓▓      👁   ··· │ │  Binance  ▓▓   18 %  ▓▓▓   │  ▸ Course       ★★★★★  2026-08│
│ │ ███████▒▒▒▒░░░  Free …   │ │  …                         │  Show 5 more · 3/27          │
│ ├──────────────────────────┤ │                            ├──────────────────────────────┤
│ │ ○ ● Rent        11-16  … │ ├────────────────────────────┤ HQ                     ⚙   + │
│ │ ○ ● Phone       11-18  … │ │ STATISTICS                 │ [Overview|Home|Mountain]     │
│ │ ✓ ● Groceries   11-15  … │ │ [Budget|Prio|★|Inv|Lib|HQ] │  Water · 2026-11-01  SMS ⧉   │
│ │ Show 5 more · 3/14       │ │  Avg free  Survival        │  Gas   · 2026-10-30          │
│ │ + Add Expense            │ │  ▁▃▅▇▅▃▁▂▅  Free / month   │  Power · 2026-10-28          │
│ └──────────────────────────┘ │  Oct: Income … Free …      │  Show 2 more                 │
├──────────────────────────────┤                            │                              │
│ SPLIT PAYMENTS             + │                            │                              │
│ [In progress 3 | Settled 9]  │                            │                              │
│ ◔ Laptop  1 200 · 4/12  …    │                            │                              │
│   [1 ✓][2 ✓][3 _][4 _]…      │                            │                              │
│ Show 2 more                  │                            │                              │
└──────────────────────────────┴────────────────────────────┴──────────────────────────────┘
       col 1  (5fr)                   col 2  (4fr)                  col 3  (3.5fr)
```

---

## 5. Layout specification

### 5.1 Page frame

- **Header** (56 px, sticky, translucent material like the PWA tab bar):
  - App mark and "One-Page".
  - **Year** menu (shared `YearContext`).
  - **⟳ Refresh**: invalidates all queries; spins while fetching.
  - **👁 Income amounts** toggle (`incomePrivacy`).
  - **+ New** menu (§9.2).
  - **Light | Dark** segmented switch (§11).
  - **Account** avatar menu (§8.5).
- **Body**: a CSS grid of three columns, `gap: var(--space-5)`, padding
  `var(--space-5)`, max width **1920 px** centred. Beyond that the page
  background shows on both sides.
- **Column scrolling**: at ≥ 1280 px each column is its own scroll container,
  `height: calc(100dvh - header)`, `overscroll-behavior: contain`, with thin
  overlay scrollbars. Each column is a labelled `region` and keyboard
  focusable, so it can be scrolled with the keyboard.
- **Block**: an inset grouped card (`--bg-grouped-secondary`,
  `--radius-lg`, `--shadow-card`) with a block header that holds the title
  (Title 3), an optional subtitle, and the trailing actions (+, ⚙, ···).
  Blocks can be **collapsed** from their title; the collapsed state persists
  per block in `localStorage` (`onePage.collapsed`).

### 5.2 Breakpoints

| Width | Layout |
|---|---|
| **≥ 1600 px** | 3 columns, `5fr 4fr 3.5fr`; Split slots 3 per row |
| **1280–1599 px** | 3 columns, `4fr 4fr 3fr`; Split slots 2 per row |
| **1024–1279 px** | 2 columns: col 1 unchanged; col 2 stacks Investments, Statistics, Library and HQ. One page scroll (no per-column scroll) |
| **< 1024 px** | 1 column, page scroll, plus a dismissible note: "One-Page is made for larger screens. **Open the app** →" (links to `/`). Fully functional, never redirected |

A container query on each block (not only viewport media queries) decides
the internal density: chart heights, slots per row, whether row dates show.

### 5.3 Density

Desktop rows are denser than iOS rows: 36 px minimum height (44 px on
touch-capable screens via `@media (pointer: coarse)`), body text 15 px
(`--fs-subheadline` on the 17 px root), and form controls still
`--fs-control` (≥ 16 px). The type scale, radii, colours and spacing come
from the existing tokens. Only `--desk-*` layout tokens are added (§12.5).

---

## 6. Navigation model

### 6.1 Principles

1. **Everything is reachable in at most two clicks**: block → tab → item.
2. **Tabs never leave the page.** A tab change updates the URL query with
   `replace`, so browser Back is not filled with tab clicks.
3. **Dialogs are history entries** (existing overlay manager), so browser
   Back closes the top dialog, and a dirty form asks first. This is the same
   behaviour as Android back in the PWA.
4. **Cross-links between blocks** switch the other block's tab and scroll it
   into view with a brief highlight; they never navigate away.

### 6.2 URL state

`/one-page?period=<incomeId>&split=open|settled&inv=portfolio|snapshots|ops&stats=budget|prio|special|invest|library|hq&lib=<person|all>&hq=overview|<hqId>`

- Missing parameters fall back to defaults: current period, `open`,
  `portfolio`, `budget`, `all`, `overview`.
- Unknown values fall back silently.
- Search text and filters are not in the URL (privacy and noise), only in
  component state.
- Form deep links: `?expense=new&date=YYYY-MM-DD`, `?expense=<id>`,
  `?income=new|<id>`. These are consumed on open (removed from the URL with
  `replace`) so a reload does not reopen the form.

### 6.3 Cross-links

| From | Action | Goes to |
|---|---|---|
| Statistics → Budget, a month bar | Click | Breakdown under the chart (as in the PWA) plus **"Open in Budget"**, which selects that month's last period in the Budget block |
| Statistics → Special, a row | Click | Opens the expense dialog |
| Investments → Portfolio | "View evolution" | Statistics → Investments |
| Library, a person tab | "12-month chart" | Statistics → Library, that person highlighted |
| HQ → Overview, a water template | "View chart" | Statistics → HQ, that location |
| Budget period header | ··· → Add Expense to This Period | Expense dialog with the date pre-filled |

### 6.4 Keyboard

Shortcuts are active when focus is not in a text field. They are listed in
a **"?" shortcuts dialog** in the account menu.

| Key | Action |
|---|---|
| `N` then `E` / `I` / `S` / `B` / `O` / `P` | New Expense / Income / Split / Book / Operation / Snapshot |
| `←` / `→` | Previous / next Budget period (when focus is in the Budget block or on the page body) |
| `T` | Budget → current period |
| `/` | Focus Library search |
| `H` | Toggle income amounts |
| `R` | Refresh |
| `Esc` | Close the top dialog, menu or popover (with the discard prompt if dirty) |
| `Tab` / `Shift+Tab` | Move through header → col 1 → col 2 → col 3. Tabs inside a block use arrow keys (React Aria `Tabs`) |
| Hold `Space` on the reveal button | Reveal holdings while held (§10) |

### 6.5 Entry point

- **Direct URL:** `https://<app>/one-page`. Auth is shared, so a signed-in
  user lands straight in.
- **PWA Account sheet:** a new row, **One-Page (desktop)**, which opens
  `/one-page`.
- **Optional preference (Settings → Appearance):** "Open One-Page on this
  computer". Stored per browser (`onePage.default = "true"`). When set, `/`
  replaces to `/one-page` on screens ≥ 1024 px only. Off by default; phones
  never redirect.
- **Back to the app:** account menu → **Open mobile layout** (`/`).

---

## 7. Block specifications

### 7.1 Budget (col 1, top), highest priority

**Header:** "Budget" · subtitle `Period N of M` · trailing **+ Add Expense**,
··· (New Income, Edit Income, Delete Income).

**Period bar:**
- ‹ and › buttons.
- A **period dropdown** listing every income in the selected year (date ·
  name), current period marked. It replaces the swipe pager.
- **Today** button, shown when off the current period.

**Period card**, top to bottom:
1. `PeriodHeader`, reused: date, *Current*, name, private amount, eye.
2. `BudgetBar` with Spent · Done · Pending · Free/Over.
3. **Filter chips** (desktop addition, client-side only): *All · Pending ·
   Done · ★ Special*. Default *All*.
4. Expense rows in the PWA order (`byPriorityThenDate`). **3 shown**, then
   *Show 5 more* / *Show less* / *Show all (14)*. The count is per period
   and resets when the period changes.
5. **+ Add Expense**, which pre-fills the period's date.

Row interactions:
- Checkbox toggles status, optimistic.
- Click the row to edit in a dialog.
- Hovering shows trailing icon buttons **Edit** and **Delete** (two-step).
- Right-click opens the context menu: Edit, Mark Completed/Pending, Delete
  (the same items as the PWA's long-press menu).

Empty states match the PWA. Keyboard: rows are a grid list (React Aria
`GridList`) with arrows to move, `Space` to toggle, `Enter` to edit and
`Delete` to arm or confirm delete.

### 7.2 Split Payments (col 1, below Budget)

- **Header:** "Split Payments" · subtitle (open · settled · left to cover per
  currency) · **+**.
- **Tabs:** In progress (count) · Settled (count).
- **3 cards per tab**, then Show more/less. In-progress cards are expanded
  with their slot grid; settled cards are collapsed (click to expand), as in
  the PWA.
- Slot grid, auto-save and "Mark as settled?" are unchanged (`SplitSlots`,
  `useSplitEditor`). The "Saving… / Saved" footnote is kept.
- Card ··· and right-click: Cover Rest, Clear All, Edit, Delete.

### 7.3 Investments (col 2, top)

**Header:** "Investments" · subtitle `N snapshots · M operations` · **+**
(New Snapshot / New Operation).

| Tab | Content |
|---|---|
| **Portfolio** (default) | EUR total and per-platform rows (share bar, %, original currency) for `heldPlatforms`; FX date. **All amounts masked** with hold-to-reveal (§10). "View evolution →" links to the Statistics tab |
| **Snapshots** | Grouped by date, newest first; **3 dates**, Show more/less; rows with hover Edit/Delete; *+ Add Platform to This Date* per group |
| **Operations** | Newest first; **3 rows**, Show more/less; Deposit/Withdrawal badge; click expands notes; hover Edit/Delete |

### 7.4 Statistics (col 2, below Investments)

One block with **one tab per topic**, as the brief asks. All charts are
Recharts, lazy-loaded and themed through `useResolvedColors`, with hover
tooltips and a crosshair cursor. Each chart keeps a `role="img"` summary as
in the PWA.

| Tab | Content | Source (unchanged logic) |
|---|---|---|
| **Budget** | Tiles: Avg free / month, Survival / month, `N months with data · now <Mon>`. **Free amount per month** bar chart (rounded tops, current month full opacity, dashed "now", zero line). Clicking a bar shows Income / High / Medium / Low / Free plus "Open in Budget" | `statsMath.ts`, `FreeChart` |
| **Priorities** | High / Medium / Low averages (as in the PWA) plus a **per-month table** (month × High / Medium / Low / Total). This is the same data the Free tooltip shows, laid out for a wide screen | `statsMath` rows |
| **★ Special** | Total, then the special expenses for the year: 3 rows, Show more/less; click opens the expense | `statsMath` / expenses |
| **Investments** | Evolution line chart from `CHART_START` with carry-forward, **1Y · 3Y · All** range, legend chips (Total on, platforms off), operation dots and tooltip. **Amounts follow the holdings mask**: masked state shows the shape and hides the axis values and tooltip figures | `investMath.ts`, `EvolutionChart` |
| **Library** | 12-month completions line chart, **one line per person** (legend chips toggle), with totals; filtered by the Library block's current filters so the two agree | `libraryMath.ts`, `MonthlyChart` (generalised to multi-series) |
| **HQ** | Location picker, then the water consumption chart (cold/hot per month, values on points, dashed averages, last 3 years) per water template | `hqMath.ts`, `WaterChart` |

The year menu in the header applies to **Budget, Priorities and Special**,
exactly as the shared `YearContext` does today. Investments, Library and HQ
have their own time ranges, as in the PWA.

### 7.5 Library (col 3, top)

- **Header:** "Library" · subtitle `N people · X of Y entries` (+ Clear) ·
  search field (`/`) · **Filter** button with a count, opening a popover
  (Person, Type, Source, Rating, reusing `FilterSheet` content) · **+**.
- **Person tabs:** All · one per person, alphabetical · Unassigned last. The
  *All* tab lists entries newest first, with the person shown on each card.
- Per tab: "12 months: N completed" line → link to Statistics → Library.
  Then **3 entries**, *Show 5 more* / *Show less*, matching the PWA's Library
  steps.
- Card: title, author · source, type badge, inline star rating (optimistic),
  `dateCompleted`. Click expands comments; hover Edit/Delete; right-click
  menu.

### 7.6 HQ (col 3, below Library)

- **Header:** "HQ" · ⚙ (HQ Settings dialog) · **+** (New Entry, which asks
  for a template when ambiguous).
- **Tabs:** Overview · one per location (in `order`).
- **Overview:** per location, a small group with the **latest entry per
  template** (date, first two values), 3 then Show more. Water templates
  get "View chart →".
- **Location tab:** one section per template, each with:
  - **SMS** (water): a popover with the meter-reading text and **Copy**.
  - **New Entry**: a dialog.
  - Entries newest first: **3**, then Show more/less. Click expands values
    and the computed *Consum Apa Rece / Calda*. **Edit** expands the inline
    stacked editor with 600 ms auto-save ("Saving… / Saved"). Delete is
    confirmed.
- **HQ Settings dialog** (large, 720 px): the PWA `HqSettings` content.
  Locations and templates sections side by side at ≥ 1440 px, stacked below
  that.

---

## 8. Cross-cutting UI rules

### 8.1 "Show 3, then more" (the list rule)

A single `ShowMore` component replaces the three per-screen variants (the
Invest `MoreLess`, the Library and the HQ buttons):

- **Collapsed:** the first **3** items of the list in its existing order.
- **Controls** under the list: **Show N more** (N = min(5, remaining), with a
  `shown/total` count) · **Show less** (back to 3, shown once more than 3 are
  visible) · **Show all** (when more than 10 remain).
- No controls when the list has 3 or fewer items.
- After *Show less*, the block scrolls so its header stays visible.
- Expanded counts are per list and reset when the list's scope changes
  (period, tab, filter). They are not persisted.
- Snapshots count **dates** (groups), not rows, as in the PWA.

### 8.2 Row actions on desktop

| Mobile | Desktop |
|---|---|
| Swipe → Edit / Delete | Hover (or keyboard focus) reveals trailing **Edit** and **Delete** icon buttons; Delete arms "Confirm" for 4 s, second click deletes |
| Long-press → menu | Right-click → the same `ContextMenu`; the browser's own menu is suppressed only on rows |
| Tap → edit / expand | Click; `Enter` from the keyboard |
| Pull to refresh | ⟳ in the header; refetch on window focus (TanStack default) |

On touch-capable desktops (`pointer: coarse`) the hover buttons stay visible.

### 8.3 Feedback

The existing `Toast` (bottom-centre, max 420 px), the offline capsule under
the header, and per-block skeletons while loading (`ScreenSkeleton`, block
sized). A failing block shows an inline error with **Try Again**, so one
failed query never blanks the page: each block has its own error boundary.

### 8.4 Empty states

Each block keeps the PWA's empty copy ("No expenses for this period.", "No
entries yet.", …) plus its primary action button.

### 8.5 Account menu (avatar)

Username, session countdown (`useSessionRemaining`), **Settings**,
**Backstage** (while enabled), **Admin** (`ADMIN_USER`), **Keyboard
Shortcuts**, **Open mobile layout**, **Sign Out**. Settings, Backstage and
Admin open the existing PWA pages, which stay phone-width; making them
desktop-native is out of scope.

---

## 9. Create and edit: pop-up dialogs

### 9.1 Presentation switch, not new forms

Every create and edit form today is a `Sheet` / `FormSheet`. One-Page wraps
its tree in a **`PresentationProvider value="dialog"`**. In dialog mode,
`Sheet` renders through the same React Aria `ModalOverlay` / `Modal` /
`Dialog` but:

- **Centred, 520 px wide** (`detent="large"` → 720 px), max height 85 vh,
  internal scroll, `--radius-xl`, `--shadow-overlay`.
- **No grabber and no drag-to-dismiss.** Scrim click, Escape, Cancel and
  browser Back still close it, with the same discard veto.
- **Header unchanged:** Cancel · Title · Save/Add. `Enter` in a single-line
  field submits; `⌘/Ctrl+Enter` submits from anywhere.
- **Focus:** trapped, first field focused, focus returned to the trigger on
  close (React Aria).
- **Nested pickers** (calendar, currency, priority) open as **popovers**
  anchored to their field instead of stacked sheets.

`ActionSheet` (series choices, delete confirmations) becomes a small centred
**alert dialog** in dialog mode. Its button order is macOS-style: the
default on the right, destructive in red.

This gives all forms with their validation, series prompts, "Maps to"
preview and discard prompts with no duplicated code.

### 9.2 Entry points

| Form | Header **+ New** | Block entry point |
|---|---|---|
| Expense | ✓ (`N E`) | Budget **+ Add Expense** (period date), period ··· → Add Expense to This Period |
| Income | ✓ (`N I`) | Budget ··· → New Income |
| Split payment | ✓ (`N S`) | Split **+** |
| Snapshot | ✓ (`N P`) | Investments **+**, Snapshots → *+ Add Platform to This Date* |
| Operation | ✓ (`N O`) | Investments **+** |
| Book | ✓ (`N B`) | Library **+** (person pre-filled from the active tab) |
| HQ entry | ✓ (asks for the template) | HQ → template → **New Entry** |
| HQ location / template | — | HQ ⚙ → HQ Settings |

### 9.3 Confirmations

- **Destructive actions from menus** open an alert dialog: *Delete
  "Rent"?* with Cancel and Delete.
- **Inline row deletes** use the two-step button.
- **Series:** *This Occurrence / Entire Series* (delete),
  *This Occurrence Only / All Future Occurrences* (edit).
- **Delete Income** explains that its expenses will be remapped, as today.

---

## 10. Sensitive data

The rules mirror the PWA (`PrivacyContext`, `PrivateValue`, `RevealButton`,
`RevealScope`). Hidden values are **not rendered** (a redaction capsule
labelled "Hidden amount"), so they cannot be read by selecting text or
inspecting the page.

| Data | Default | Reveal | Re-hide |
|---|---|---|---|
| **Income amounts** (Budget period header, Statistics → Budget "Income" in the month breakdown) | Per `incomePrivacy` (shared with the PWA) | Header 👁 toggle (`H`); persists | Toggle again |
| **Holdings**: Portfolio total, platform amounts and share values, Snapshot amounts, Operation amounts, Evolution axis and tooltip values | **Masked, always** | **Press and hold** the eye (mouse button or `Space` / `Enter` held); values show while held | Release, pointer leaving the button, window blur or tab hidden. Never persisted |
| **Everything else** (expenses, splits, books, HQ) | Visible | — | — |

Desktop-specific protections:
- **"Hide in app switcher"** (`uiPrivacyShield`) also blurs One-Page when the
  window loses focus or the tab is hidden, which covers screen-sharing and
  Alt-Tab.
- Masked charts keep their shape but drop numeric axis labels and tooltip
  figures, so the trend is visible without the amounts.
- Values are not reflected in the document title, URL, or `aria-label`s
  while masked.

> **Alternative considered:** click-to-reveal for holdings with a 30-second
> auto-mask, which is easier with a trackpad. Rejected for the first version
> to keep the PWA's behaviour. It could be offered later as a Settings
> option.

---

## 11. Themes

- **Light** and **Dark** from `themes.css`, unchanged. The header switch is a
  two-segment control **☀ Light | ☾ Dark**.
- The choice writes the **same `uiTheme` key**, so One-Page and the PWA
  agree. The PWA's third option, **Automatic**, stays in Settings. While
  `uiTheme = auto` the switch shows the resolved theme, and clicking either
  segment pins it explicitly. The account menu has "Use system setting" to
  return to Automatic.
- Applied before first paint by the existing `index.html` boot script.
  `theme-color` and `color-scheme` follow the theme, as today.
- Charts re-resolve colours on theme change (`useResolvedColors`).

---

## 12. Apple style on any desktop

### 12.1 Look

- macOS-like surfaces: grouped grey page background, white or elevated cards,
  a translucent header (`backdrop-filter`, with a solid token fallback where
  unsupported), hairline separators, SF-like type.
- **Fonts**: the system font on Apple devices (SF Pro). Bundled **Inter**
  elsewhere (Windows, Linux, ChromeOS), as in the PWA, so Windows does not
  fall back to Segoe and the look stays consistent.
- **Controls**: segmented controls for tabs, pull-down menus with ✓ for the
  current choice, rounded buttons (filled tint for primary, grey for
  secondary), macOS-style switches.
- **Icons**: the existing `ui/icons` set.

### 12.2 Behaviour on desktop

- **Hover states** on every interactive element (`--fill-hover`, new token
  pair in `themes.css`), only under `@media (hover: hover)`.
- **Focus rings**: a 3 px tint ring with `:focus-visible`, never on mouse
  click.
- **Cursors**: pointer on clickable rows, default elsewhere; text selection
  is allowed in content and suppressed only on controls.
- **Scrollbars**: thin, theme-coloured (`scrollbar-width: thin`,
  `scrollbar-color` from tokens).
- **Tooltips**: React Aria `Tooltip` on icon-only buttons, with the shortcut
  shown (e.g. "New Expense — N E").
- **Reduced motion** respected (`MotionConfig reducedMotion="user"`).
- **Browsers**: current Chrome, Edge, Firefox and Safari on macOS, Windows
  and Linux. Manual smoke test on Windows with 125 % / 150 % display scaling.

### 12.3 Accessibility

Each column is a `region`, each block a `section` with a heading, and tabs
use React Aria `Tabs` (arrow keys, `aria-controls`). Lists are `GridList`s.
Dialogs use `aria-modal` with focus trap and restore. Contrast follows the
existing tokens (WCAG AA). The 200 % browser zoom layout falls back to the
2- or 1-column breakpoints automatically.

---

## 13. Technical design

### 13.1 Routing and shell

`/one-page` must render **outside `AppShell`** (no tab bar, no 430 px
column, no tab history) but **inside** the providers it needs (auth,
query client, theme, privacy, year, toasts, forms).

```tsx
// app/routes.tsx (sketch)
const OnePage = lazy(() => import("../features/one-page/OnePage"));

<FormsProvider>
  <Routes>
    <Route path="/one-page" element={<Suspense fallback={<OnePageSkeleton />}><OnePage /></Suspense>} />
    <Route path="*" element={<AppShell><Suspense …><MobileRoutes /></Suspense></AppShell>} />
  </Routes>
</FormsProvider>
```

`MobileRoutes` is today's `<Routes>` block, unchanged. The `*` catch-all
inside it still redirects unknown paths to `/`.

### 13.2 Folder

```
src/features/one-page/
├── OnePage.tsx              # header + grid + PresentationProvider("dialog")
├── OnePage.module.css
├── Header.tsx               # year, refresh, privacy, + New, theme switch, account menu
├── useOnePageState.ts       # URL query ⇄ tab / period state (replace)
├── useShortcuts.ts          # keyboard map (§6.4)
├── Block.tsx                # card + collapsible header + error boundary + skeleton
├── ShowMore.tsx             # list rule (§8.1); also adopted by the PWA screens
├── blocks/
│   ├── BudgetBlock.tsx
│   ├── SplitBlock.tsx
│   ├── InvestBlock.tsx
│   ├── StatsBlock.tsx       # tab per topic; each tab lazy
│   ├── LibraryBlock.tsx
│   └── HqBlock.tsx
└── onePage.test.tsx
```

### 13.3 Reuse and the refactors it needs

The PWA screens mix "screen chrome" (`Screen` large title, nav-bar buttons,
pull to refresh) with "content". To reuse content rather than copy it, each
screen's body is extracted into a **panel** that both the screen and the
block render.

| Extract | From | Used by |
|---|---|---|
| `BudgetPeriodCard` (PeriodHeader + BudgetBar + rows + Add) | `Budget.tsx` | Budget screen pager page, BudgetBlock |
| `SplitCard` (+ existing `SplitSlots`) | `SplitScreen.tsx` | Split screen, Today widget, SplitBlock |
| `PortfolioPanel`, `SnapshotList`, `OperationList` | `InvestScreen.tsx` | Invest screen, InvestBlock |
| `StatsSummary`, `SpecialList` (+ existing `FreeChart`) | `StatsScreen.tsx` | Stats screen, StatsBlock |
| `BookCard` | `Library.tsx` | Library screen, LibraryBlock |
| `TemplateSection` (exists), `OverviewList` | `HqScreen.tsx` | HQ screen, HqBlock |
| `HqSettingsContent` | `HqSettings.tsx` | `/hq/settings` screen, HQ Settings dialog |
| `MonthlyChart` multi-series | `features/library/MonthlyChart.tsx` | Library (one series), Stats → Library (one per person) |

Rules for these refactors:
- **Pure extractions.** No behaviour change on mobile; the existing 246
  Vitest and 26 Playwright tests must pass untouched. This is the safety net.
- Panels take a `limit` / `ShowMore` slot so the PWA keeps its paging
  (Library 5, Invest 3, HQ 5) and One-Page uses 3.
- Row components gain a `hoverActions` prop (desktop) next to their existing
  swipe wrapper. `SwipeActions` is not rendered in dialog presentation.

### 13.4 Data

No new endpoints and no new query keys. One-Page mounts the same hooks the
screens use:

`useIncomesForYear` / `useExpensesForYear` (Budget, Stats),
`useToggleExpense`, `useSaveExpense`, `useSaveIncome`, `useDeleteExpense`,
`useDeleteIncome`, `useSplitPayments` + `saveSplitOccurrences`,
`useSaveSplit`, `useDeleteSplit`, `useOperations`, `useSnapshots`,
`useFxRates`, the operation and snapshot cruds, `useBooks`, `useSaveBook`,
`useRateBook`, `useDeleteBook`, and `useHqLocations` / `useHqTemplates` /
`useHqEntries` with their mutations.

- **All queries start in parallel** on mount (no waterfalls). Each block
  renders as soon as its own data arrives.
- The IndexedDB-persisted cache means a returning visit paints instantly
  from cache, then refreshes.
- Optimistic updates already patch every cached list, so a change in one
  block (e.g. ticking an expense) updates the others (Statistics)
  immediately.
- The API calls on first load are the ones the mobile app makes when you
  visit every tab once: about 10 GETs. No backend load concern.

### 13.5 Styling and the build guards

- New layout tokens in `tokens.css`: `--desk-max-w: 1920px`,
  `--desk-header-h: 56px`, `--desk-gap`, `--desk-col-min: 320px`. No raw
  colours outside `themes.css`.
- New colour tokens in `themes.css` (Light + Dark): `--fill-hover`,
  `--focus-ring`, `--scrollbar-thumb`.
- **`src/test/guards.test.ts`** changes:
  - Keep the rule that the **mobile** shell, tab bar and sheet overlays use
    `--app-max-w: 430px`, defined once.
  - Allow `--desk-max-w` **only** in `features/one-page/` and in the dialog
    presentation styles of `ui/Overlays.module.css`.
  - All other guards (tokens, 16 px controls, pinch zoom) apply to One-Page
    too.

### 13.6 Bundle

- One-Page is a **lazy route**, so the PWA's first download stays at about
  199.5 KB, within the 200 KB budget. `check-bundle.mjs` is unchanged for
  the entry.
- Add a second budget for the **One-Page chunk set** (route chunk, blocks,
  shared panels; charts excluded and lazy per Statistics tab): **≤ 150 KB
  gzipped**, enforced by `check-bundle.mjs --route one-page`.
- Statistics tabs load their chart chunk on first open. The Budget tab's
  chart loads with the page because it is the default tab.

### 13.7 PWA and deploy

- `navigateFallback: '/index.html'` already serves `/one-page` offline and on
  reload. CloudFront's SPA error-response fallback serves it online, the same
  way `/money` works today. **No infrastructure change.**
- The manifest `start_url` stays `/`. The installed PWA keeps opening the
  mobile layout unless the "Open One-Page on this computer" preference is
  set.
- Deploy is the usual `npm run build` → S3 sync → CloudFront invalidation.

### 13.8 Platform detection

`app/platform.ts` already detects platform and standalone mode. One-Page
adds no platform branches for appearance. It uses only `(hover: hover)`,
`(pointer: coarse)` and container queries.

---

## 14. Explicitly not added

To honour "keep the functionality, no backend change", the following ideas
came up during the analysis and are **left out**. They are listed so they
are not slipped in during implementation:

- Duplicate an expense to the next period.
- Bulk select and bulk mark or delete.
- Drag and drop of expenses between periods (a date change plus remap would
  work with the existing API, but it is new behaviour).
- A global cross-module search.
- Export or print views.
- Desktop-native Settings, Backstage and Admin.

---

## 15. Testing

### 15.1 Vitest (jsdom)

- `onePage.test.tsx`, rendered with `renderApp` and mocked API modules:
  - All six blocks render with fixtures; each shows at most 3 items, and
    *Show 5 more* / *Show less* / *Show all* behave per §8.1.
  - Changing a tab updates the URL query with **replace**; reloading with a
    query restores the tabs; invalid values fall back.
  - `?expense=new&date=…` opens the expense dialog with the date and is
    consumed.
  - Dialog presentation: `FormSheet` renders without a grabber and Escape
    with a dirty form shows *Discard changes?*.
  - Privacy: income amounts follow `incomePrivacy`; holdings and evolution
    values are absent until the reveal button is held, and come back masked
    on release and on `window` blur.
  - Theme switch writes `uiTheme` and updates `data-theme`.
  - Optimistic tick in Budget updates the Statistics Budget tab.
  - A block whose query fails shows Try Again while the others render.
  - Keyboard: `N` `E` opens New Expense; `←` / `→` change period; shortcuts
    are ignored while typing.
- Panel extractions: **the existing suite must pass unchanged.**
- Guards updated as in §13.5.

### 15.2 Playwright

New desktop projects **`desktop-chrome`** (1440×900) and
**`desktop-webkit`** (1280×800, approximates Safari), against the existing
stubbed harness. Tests:

- No horizontal overflow at 1024 / 1280 / 1440 / 1920 px × Light / Dark.
- 3 columns at ≥ 1280, 2 at 1024–1279, 1 below 1024 (with the note).
- Columns scroll independently; the header stays put.
- Browser Back closes the top dialog first, then leaves One-Page.
- Hover reveals row actions; two-step delete; right-click shows the app menu.
- Hold-to-reveal with the mouse and with `Space`.
- The existing iPhone and Pixel specs keep passing; `/one-page` on a phone
  shows the single-column note.

---

## 16. Implementation plan

Each phase is shippable and keeps the mobile app unchanged.

| Phase | Work | Done when |
|---|---|---|
| **1. Foundations** | Route split (`/one-page` outside `AppShell`), `PresentationProvider` + dialog mode for `Sheet` / `FormSheet` / `ActionSheet` / pickers, desktop tokens, guards update, `Block`, `ShowMore`, header (year, privacy, theme, account, refresh, + New) | Empty 3-column page in both themes; every form opens as a dialog from + New |
| **2. Panel extractions** | §13.3 refactors, mobile screens switched to the panels | Existing 246 + 26 tests green, no visual change on mobile |
| **3. Finance blocks** | Budget, Split, Investments; hover actions, context menus, URL state, keyboard map | Budget fully usable on desktop |
| **4. Statistics** | Six tabs, cross-links, masked charts, multi-series `MonthlyChart` | All charts per topic |
| **5. Library and HQ** | Person tabs, filter popover, HQ tabs, SMS popover, New Entry dialog, HQ Settings dialog | All Money / Library / HQ functions reachable |
| **6. Polish and entry points** | Breakpoints, small-screen note, Account-sheet row in the PWA, "Open One-Page on this computer" preference, shortcuts dialog, per-block error boundaries, bundle budget for the route, Playwright desktop projects, docs (`CLAUDE.md`, `Frontend_Setup.md`, README) | `npm run check` and `npm run test:e2e` green; deployed |

---

## 17. Open questions and risks

| Item | Notes / default if not decided |
|---|---|
| Budget showing only 3 expenses | Strict reading of the brief. Periods often have 10–20 expenses, so *Show all* and the *Pending* chip are provided. **Default:** 3, as asked; revisit after use |
| Holdings masked on the Portfolio tab | Stricter than the PWA's Invest screen (§3.4). **Default:** masked |
| Theme switch vs Automatic | Two-segment switch pins Light or Dark; Automatic remains in Settings and the account menu |
| Panel extraction regressions | Mitigated by doing phase 2 alone, with the full existing suite as the gate |
| Long sessions on desktop | No token refresh (known limitation): the 401 sign-out will be noticed more on a desktop left open. The countdown is in the account menu. A refresh flow would be a separate change |
| Very wide screens (> 1920 px) | Content capped at 1920 px and centred; a fourth column is not planned |
| Windows display scaling at 125–150 % | Effective widths of 1280–1536 px land in the 3-column range; verify manually |

---

## 18. Implementation notes

What was built follows §1–§17, with these differences:

| Proposal | Implemented | Why |
|---|---|---|
| `PresentationProvider` (§9.1) | `LayoutContext` in `ui/layout.ts`, provided by `app/routes.tsx` (`"desk"` on `/one-page`) so the global expense and income forms present as dialogs too | One switch for every shared component |
| Desktop presentations | `ui/DeskOverlays.tsx` (`DeskSheet`, `DeskActionSheet`, `DeskRowActions`), lazy, loaded with One-Page | Keeps the PWA's first download within budget |
| Form dialogs | 520 px and sized to content; large content sheets (HQ Settings) 760 px; a close button when there is no Cancel · Title · Save header | Less empty space than a fixed 85 vh |
| Nested pickers and Library filters as popovers | They open as stacked dialogs (the same `Sheet`) | Reuse without a second picker implementation |
| HQ **New Entry** dialog (§3.7) | Kept the phone's inline editor (created on first auto-save) | Same behaviour as the PWA, one code path |
| Header **+ New** includes HQ entry | Not included; New Entry is in each HQ template section | An entry needs its template |
| Holdings masking (§10) | Amounts masked (Portfolio total and platforms, snapshot and operation amounts, evolution axis and tooltip); share percentages and bars stay visible | Proportions without amounts |
| Theme switch | Light \| Dark segmented control; *Use System Appearance* in the account menu when a theme is pinned | As proposed |
| Desktop density (§5.3) | `html[data-layout="desk"]` sets a 15 px root (controls stay ≥ 16 px) | One rule instead of per-component sizes |
| Error boundary per block | The app's `ErrorBoundary` inside each `Block` | Reuse |
| One-Page bundle budget | `check-bundle.mjs` reports what One-Page adds (≈ 90 KB gzipped, budget 150 KB); the Account sheet dialog became lazy so the PWA entry stays ≈ 199 KB | §13.6 |
| Account entry | *One-Page (Desktop)* row in the Account sheet only on screens ≥ 1024 px | Phones are never sent to a desktop page |

Files: `features/one-page/` (`OnePage.tsx`, `Header.tsx`, `Block.tsx`,
`state.ts`, `blocks/*`), `app/onePage.ts` (path, preference),
`ui/layout.ts`, `ui/DeskOverlays.tsx`, `ui/ShowMore.tsx`,
`features/library/PeopleChart.tsx`; tests in
`features/one-page/onePage.test.tsx` and `e2e/onepage.spec.ts`.

### 18.1 Revision — four columns (November 2026)

- **Columns**: as many as fit at 360 px each — four from 1520 px, three from
  1144 px, two from 1024 px. Four: **Budget · Budget Statistics** | **Split
  Payments · Investment Statistics · Investments** | **HQ Statistics · HQ** |
  **Library Statistics · Library**. With three, the Library column moves under
  HQ; with two, money on the left and HQ + Library on the right.
- **Statistics** is no longer one block: its tabs became Budget Statistics
  (Budget · Priorities · ★ Special, `?stats=`), Investment Statistics (with its
  own hold-to-reveal eye), HQ Statistics (`?hqchart=`) and Library
  Statistics. Cross-links scroll to these blocks.
- **Budget** always shows every row of the period; no Show More / Less.
- **Header** has no + New and no income eye; the eye and New Income / New
  Expense are in the Budget block, and every other block has its own +.
- **Type**: a 14 px root with a desk type scale in `tokens.css` (body 14,
  footnote 12, smallest 11 px); tighter block padding, gaps and header.


- **HQ block** (later revision): no Overview tab; one tab per location, opening on Mosoaia (`defaultLocation` in `hq/hqMath.ts`, falling back to the first location). HQ Statistics opens on the same location. The phone HQ screen keeps its Overview.

- **Denser type** (later revision): a 13 px root (body 13 px, smallest 10.5 px,
  form controls 13 px on One-Page only) and a 320 px minimum column, so four
  columns fit from 1360 px and three from 1024 px. Stars, Split slots and the
  Library card footer were tightened to fit; column scrollbars are very faint.

- **Holdings eye** (later revision): on One-Page the eye is a flag, not
  press-and-hold — a click shows the investment amounts, the next click hides
  them (`RevealButton toggle`). Both investment blocks share it; values are
  masked again when the page is hidden. Today's Holdings on the phone stays
  press-and-hold.

- **Money eye** (later revision): Budget and Budget Statistics each have an
  eye that shows/hides every money amount in both blocks (income, expenses,
  budget bar, tiles, averages, per-month table, ★ Special, Free chart axis and
  tooltip). It reuses the persisted income-privacy flag and `H`.
- **Split cards** are denser on One-Page: 32 px slots, tighter head, body and
  footer.
