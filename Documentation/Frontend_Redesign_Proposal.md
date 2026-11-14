# 4TURA Home — Frontend Redesign Proposal

**Status:** proposal, not implemented. Written 2026-11-14 against `main` at the
time of writing; updated the same day for cross-platform behaviour (§10) and
a stack review (§12.1).
This document is the implementation brief for a full frontend redesign; nothing in the backend or the API changes.

**Goal:** replace the current Dusk / Light / Amber look and the current
navigation with a modern, Apple-style (iOS Human Interface Guidelines–inspired)
design that is built for an installed, phone-only PWA. It ships with two themes,
**Light** and **Dark** (plus an *Automatic* setting that follows the device),
on a token system that makes more themes cheap to add. Every existing feature
is kept; some are reached in a different way.

**Platforms:** the app should **feel like an iPhone app on every phone**, and
**behave natively on each one**. The look (layout, type, colour, components,
motion) is the same everywhere. Behaviour that the operating system owns —
the Android back button, keyboards, installation, haptics, system text size —
follows the platform, so nothing feels broken on Android or other phones.
§10 is the full cross-platform specification.

---

## Contents

1. [Principles](#1-principles)
2. [What exists today](#2-what-exists-today)
3. [Design language](#3-design-language)
4. [Theme system](#4-theme-system)
5. [Information architecture and navigation](#5-information-architecture-and-navigation)
6. [Component library](#6-component-library)
7. [Sensitive information](#7-sensitive-information)
8. [Screen-by-screen specification](#8-screen-by-screen-specification)
9. [Interaction patterns](#9-interaction-patterns)
10. [PWA and cross-platform behaviour](#10-pwa-and-cross-platform-behaviour)
11. [Accessibility](#11-accessibility)
12. [Technical architecture](#12-technical-architecture)
13. [Testing](#13-testing)
14. [Implementation plan](#14-implementation-plan)
15. [Open decisions](#15-open-decisions)
16. [Appendix A — feature parity checklist](#appendix-a--feature-parity-checklist)
17. [Appendix B — route map](#appendix-b--route-map)

---

## 1. Principles

1. **One phone layout, installed first, on any phone.** The app is used as a
   home-screen PWA. Design for a **360–430 px** wide viewport (360 covers common
   Android phones, 390–430 covers iPhones) in standalone mode, with safe areas,
   no browser chrome and thumb reach. Larger screens show the same centred
   column (as today, `max-width: 430px`).
2. **iPhone feel everywhere, native behaviour everywhere.** One visual design
   for all phones. Where an OS has its own convention for *how things work*
   (back navigation, install, keyboard, haptics, text size), the app follows
   that OS. Platform detection decides behaviour only, never appearance (§10.2).
3. **Native feel, not native imitation.** Borrow iOS structure — large titles,
   grouped inset lists, translucent bars, sheets with detents, swipe actions,
   segmented controls, action sheets — and its type and colour logic. Do not
   copy Apple artwork, SF Symbols glyphs or Apple branding (see §12.7 on
   licensing).
4. **Content first, chrome quiet.** Bars are translucent material; colour is
   reserved for meaning (priority, status, platform, money in/out) and for the
   single accent that marks what is interactive.
5. **Feature parity is a hard requirement.** Appendix A lists every current
   behaviour; each one must have a home in the new design before the old screen
   is removed.
6. **Fewer full-page detours.** Creating and editing things happens in sheets
   over the current screen, so the user never loses their place (today, Add
   Expense is a separate page that has to route back with `returnStartIdx`).
7. **Theming is data.** Components only read semantic tokens. A new theme is
   one CSS block plus one entry in a theme registry.
8. **Keep what already works.** The API layer, contexts (`AuthContext`,
   `AppSettingsContext`, `YearContext`), business logic in `utils/`, the
   16 px form-control rule, the no-native-date-input rule and the two-step
   delete safety all carry over.

---

## 2. What exists today

A short audit, so the proposal's changes are traceable.

### 2.1 Stack

React 19 + Vite 7, `react-router-dom` 7, `recharts` 3, `dayjs`, `axios`,
`amazon-cognito-identity-js`, `vite-plugin-pwa`. ~13.7 k lines of frontend
source. **All styling is inline style objects** (`const s = {…}` per file)
reading CSS custom properties from `src/index.css`; `components/tokens.js`
mirrors them as strings. `src/test/designTokens.test.js` bans raw hex, radii
and shadows outside `utils/colors.js` and `pages/Settings.jsx`.

### 2.2 Navigation

- Top bar: brand + avatar (initials). The avatar opens the account menu:
  username, JWT countdown, Settings, Backstage (gated by `backstageEnabled`),
  Admin (gated by username `nenciulescu`), Sign out.
- Bottom bar (floating dock): **Home · Finance · Books · HQ**.
- Finance opens the Dashboard; the other five Finance pages (Add Income, Add
  Expense, Split Pay, Statistics, Investments) live in the Dashboard's ⋮ menu,
  together with the Show / Hide income amounts toggle.

### 2.3 Screens

| Screen | File | Size |
|---|---|---|
| Login | `pages/Login.jsx` | 355 |
| Home Overview | `pages/HomeOverview.jsx` | 993 |
| Finance Dashboard | `pages/Dashboard.jsx` + `components/IncomeCard.jsx` | 629 + 618 |
| Add / Edit Expense | `pages/AddExpense.jsx` | 504 |
| Add / Edit Income | `pages/AddIncome.jsx` | 333 |
| Split Payments | `pages/SplitPayment.jsx` | 1070 |
| Statistics | `pages/Statistics.jsx` | 649 |
| Investments | `pages/Investments.jsx` | 1634 |
| Books & Development | `pages/BooksAndDev.jsx` | 924 |
| Headquarters | `pages/Headquarters/*` | ~2 000 |
| Settings | `pages/Settings.jsx` | 341 |
| Backstage | `pages/Backstage.jsx` | 521 |
| Admin | `pages/Admin.jsx` | 618 |

### 2.4 Pain points the redesign addresses

- **Inline styles everywhere.** No `:active` press states, no media queries per
  component, no `prefers-reduced-motion`, no `:focus-visible`; every pressed or
  hovered state needs React state. Files are long mostly because of style
  objects.
- **Finance is a hub hidden behind ⋮.** Four sibling areas (budget, split,
  stats, investments) sit in an overflow menu; nothing on screen says they
  exist.
- **Add / Edit are full pages** that must remember where to return
  (`from`, `returnStartIdx`).
- **Three ad-hoc themes** with hand-tuned values (Dusk's canvas lighter than its
  cards, etc.). Adding a fourth means re-tuning dozens of tokens.
- **Inconsistent patterns** between modules: Headquarters has its own
  `Modal.jsx` and `styles.js`; Investments and Split each define their own
  bottom sheet; the Dashboard uses a centred dialog for delete-series while the
  rest uses two-step inline delete.
- **Custom touch-swipe** on the Dashboard pager instead of native scroll
  snapping (no momentum, no accessibility).

---

## 3. Design language

### 3.1 Typography

The type is a large part of the iPhone feel, so it must look the same on
every phone.

- **Apple devices:** the system font, which is SF Pro (Text / Display picked
  automatically by size). Nothing is downloaded.
- **Every other device:** **Inter** (variable, self-hosted `woff2`, SIL Open
  Font Licence), a close match for SF Pro's proportions and numerals. Android's
  Roboto and Samsung's One UI font are deliberately *not* used, because they
  change the character of the design.

```css
--font-sans: -apple-system, BlinkMacSystemFont, "InterVariable", "Inter",
             "Segoe UI", Roboto, sans-serif;
--font-rounded: ui-rounded, "SF Pro Rounded", var(--font-sans);   /* big numbers */
--font-mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace; /* Backstage */
```

`-apple-system` comes first, so Apple browsers render with SF Pro and never
fetch Inter (browsers only download a web font they actually need). On Android
the first two names are unknown, so Inter is used. The Inter file (~ 340 KB,
Latin subset ~ 100 KB) is precached by the service worker, so it works offline
and does not flash on launch (`font-display: swap` plus `<link rel="preload">`
only when `-apple-system` is unavailable — detected by the platform script,
§10.2). Inter's `cv11` (single-storey a) is off and `tnum` is on, to stay close
to SF Pro.

Nunito is dropped.
Tabular numerals stay global: `font-variant-numeric: tabular-nums`.

Type scale — the iOS default ("Large" content size) scale, in `rem` so a future
text-size setting can scale it (§11):

| Token | Size / line | Weight | Use |
|---|---|---|---|
| `--type-large-title` | 34 / 41 | 700 | Screen title (collapses on scroll) |
| `--type-title1` | 28 / 34 | 700 | Hero figures (portfolio total) |
| `--type-title2` | 22 / 28 | 700 | Card titles, period name |
| `--type-title3` | 20 / 25 | 600 | Section-level emphasis |
| `--type-headline` | 17 / 22 | 600 | Row titles, button labels |
| `--type-body` | 17 / 22 | 400 | Default text, **all form inputs** |
| `--type-callout` | 16 / 21 | 400 | Secondary body |
| `--type-subheadline` | 15 / 20 | 400 | Row subtitles |
| `--type-footnote` | 13 / 18 | 400 | Section footers, metadata |
| `--type-caption1` | 12 / 16 | 400 | Chart axes, badges |
| `--type-caption2` | 11 / 13 | 400 | Tab-bar labels |

Section headers in grouped lists use footnote size, uppercase, secondary label
colour (the iOS grouped-list header style).

Body at 17 px also satisfies the existing iOS zoom rule (controls ≥ 16 px), so
`.zoom-safe-form` and its `!important` override can be deleted.

### 3.2 Layout and spacing

- 8-pt grid with 4-pt half steps: `--space-1` 4 · `--space-2` 8 · `--space-3`
  12 · `--space-4` 16 · `--space-5` 20 · `--space-6` 24 · `--space-8` 32.
- Screen margin **16 pt** (`--space-4`); inset grouped lists and cards sit 16 pt
  from the screen edge.
- Minimum tap target **44 × 44 pt**.
- Rows: 44 pt min height for single-line rows, 60 pt for two-line rows.

### 3.3 Shape

| Token | Value | Use |
|---|---|---|
| `--radius-xs` | 6 px | Badges, small chips |
| `--radius-sm` | 10 px | Buttons, inputs, segmented control |
| `--radius-md` | 12 px | Inset grouped lists, cards |
| `--radius-lg` | 16 px | Widgets on Today, large cards |
| `--radius-xl` | 22 px | Sheets (top corners) |
| `--radius-full` | 9999 px | Pills, avatar, toggles |

Progressive enhancement for iOS-style continuous corners:
`@supports (corner-shape: squircle) { .card { corner-shape: squircle; } }`.
Where unsupported, ordinary rounded corners are used — no visual break.
(Chrome on Android supports `corner-shape`; Safari does not yet — the
difference is subtle and acceptable.)

### 3.4 Materials and elevation

iOS separates layers with **materials** (translucent blur) and background
levels rather than heavy shadows.

```css
--material-bar: color-mix(in srgb, var(--bg-primary) 72%, transparent);
.material { background: var(--material-bar);
            -webkit-backdrop-filter: saturate(180%) blur(20px);
            backdrop-filter: saturate(180%) blur(20px); }
```

- Navigation bar and tab bar: material, with a 0.5 px separator that only
  appears once content scrolls under it (scroll-edge appearance, §6.2).
- Cards and grouped lists: flat, on `--bg-grouped-secondary`; no shadow in
  Dark, a barely-there shadow in Light (`--shadow-card`).
- Sheets and menus: `--shadow-overlay` plus a dimming scrim
  (`--scrim`, 40 % black in Light, 60 % in Dark).

### 3.5 Iconography

A single custom SVG icon set, drawn to read like iOS symbols: 24-unit grid,
rounded caps and joins, 1.75 stroke for "regular", filled variants for selected
tab items. `currentColor` only, so icons follow theme and state. Roughly 45
glyphs cover the app (tab icons, plus, ellipsis, chevrons, eye / eye-slash,
trash, pencil, checkmark, calendar, chart, filter, search, person, gear, shield,
sign-out, wallet, book, building, drop, arrow-up/down, star, etc.). Lives in
`src/ui/icons/` as one React component per glyph with a shared `<Icon>`
wrapper (`size`, `weight`, `filled`).

The duotone tab icons and `TAB_ICON_COLORS` are retired.

### 3.6 Motion

- Durations: `--dur-fast` 150 ms (press), `--dur-base` 250 ms (toggles, list
  changes), `--dur-slow` 350 ms (sheets, screen transitions).
- Curves: `--ease-standard: cubic-bezier(.2, .8, .2, 1)` for CSS transitions.
  Sheets, swipe rows, the segmented thumb and list changes use **Motion
  springs** (`stiffness ≈ 400, damping ≈ 40`, tuned per component) driven by
  the finger's velocity (§12.1).
- Screen push / pop: the **View Transitions API** (`document.startViewTransition`)
  for a horizontal slide on push and a reverse slide on pop, cross-fade for tab
  switches. Feature-detect and fall back to no animation.
- Press feedback: `:active { transform: scale(.97); opacity: .85 }` on tappable
  cards; list rows darken to `--fill-pressed`.
- Everything is disabled under `@media (prefers-reduced-motion: reduce)`.
- **Haptics** — a `haptic("light" | "success" | "warning")` helper is called on
  checkbox ticks, swipe-to-confirm, settle confirmation and segmented-control
  changes. Android: `navigator.vibrate(8–20 ms)`. iPhone: Safari exposes no
  vibration API, so the helper is a no-op there, except for toggles rendered as
  `<input type="checkbox" switch>`, which give the system haptic on recent iOS.
  Respects a Settings → Haptics toggle (default on).

---

## 4. Theme system

### 4.1 Token layers

Three layers, so a new theme only touches the middle one:

1. **Primitives** — the raw palette, per theme (`--blue-500` style is *not*
   used; primitives are named after iOS system colours).
2. **Semantic tokens** — what components read: `--bg-*`, `--label-*`,
   `--fill-*`, `--separator`, `--tint`, `--status-*`, `--series-*`.
3. **Component tokens** (optional, sparing) — e.g. `--tabbar-height`,
   `--sheet-grabber`. Defined once, from semantic tokens.

Components never reference primitives. A test enforces it (§13).

### 4.2 Theme registry

`src/theme/themes.js`:

```js
export const THEMES = [
  { id: "light", label: "Light", scheme: "light", metaColor: "#F2F2F7" },
  { id: "dark",  label: "Dark",  scheme: "dark",  metaColor: "#000000" },
];
export const THEME_SETTINGS = ["auto", ...THEMES.map(t => t.id)]; // stored value
```

- Stored in `localStorage` under a **new key** `uiTheme`
  (`"auto" | "light" | "dark"`, default `"auto"`).
- `auto` follows `prefers-color-scheme` live (a `matchMedia` listener flips
  `data-theme` without reload).
- Applied as `<html data-theme="light|dark">` before first render (inline
  script in `index.html`, so there is no flash of the wrong theme on launch).
- The `<meta name="theme-color">` is updated with the theme (`metaColor`), and
  `color-scheme` is set per theme so native controls, scrollbars and
  autofill render correctly (keeps the current behaviour).
- **Migration:** the old `appTheme` key is read once: `dark`/`dusk`/`prism`/
  `ember`/`amber` → `dark`, `light` → `light`, then `appTheme` is removed. Dusk,
  Light (old) and Amber are deleted.

Adding a third theme later = one `[data-theme="x"]` block in
`src/theme/themes.css` + one registry entry. The Settings picker renders from
the registry.

### 4.3 Theme values

Values follow Apple's published iOS system colours (default, not
high-contrast).

| Semantic token | Light | Dark | Meaning |
|---|---|---|---|
| `--bg-primary` | `#FFFFFF` | `#000000` | Plain screens, bars base |
| `--bg-grouped` | `#F2F2F7` | `#000000` | Screen behind grouped lists |
| `--bg-grouped-secondary` | `#FFFFFF` | `#1C1C1E` | Cards, list groups |
| `--bg-grouped-tertiary` | `#F2F2F7` | `#2C2C2E` | Inputs and tiles inside cards |
| `--bg-elevated` | `#FFFFFF` | `#1C1C1E` | Sheets, menus |
| `--label` | `#000000` | `#FFFFFF` | Primary text |
| `--label-secondary` | `rgba(60,60,67,.60)` | `rgba(235,235,245,.60)` | Subtitles, metadata |
| `--label-tertiary` | `rgba(60,60,67,.30)` | `rgba(235,235,245,.30)` | Placeholders, disabled |
| `--separator` | `rgba(60,60,67,.29)` | `rgba(84,84,88,.65)` | Hairlines (0.5 px) |
| `--fill` | `rgba(120,120,128,.20)` | `rgba(120,120,128,.36)` | Toggles off, segmented track |
| `--fill-secondary` | `rgba(120,120,128,.16)` | `rgba(120,120,128,.32)` | Chips, search field |
| `--fill-pressed` | `rgba(0,0,0,.06)` | `rgba(255,255,255,.08)` | Row press state |
| `--tint` | `#007AFF` | `#0A84FF` | Accent: links, buttons, selection |
| `--on-tint` | `#FFFFFF` | `#FFFFFF` | Text on tint |
| `--status-positive` | `#34C759` | `#30D158` | Done, deposit, free, settled |
| `--status-negative` | `#FF3B30` | `#FF453A` | Over budget, withdrawal, delete |
| `--status-warning` | `#FF9500` | `#FF9F0A` | Pending, medium priority |
| `--status-special` | `#AF52DE` | `#BF5AF2` | ★ special expenses |
| `--shadow-card` | `0 1px 2px rgba(0,0,0,.04)` | `none` | |
| `--shadow-overlay` | `0 10px 40px rgba(0,0,0,.18)` | `0 10px 40px rgba(0,0,0,.6)` | Sheets, menus |
| `--scrim` | `rgba(0,0,0,.40)` | `rgba(0,0,0,.60)` | Behind sheets |

**Categorical series colours** (`--series-1 … --series-8`) map onto iOS system
colours, with the Dark variant automatically brighter:

| Series | Light | Dark |
|---|---|---|
| 1 blue | `#007AFF` | `#0A84FF` |
| 2 green | `#34C759` | `#30D158` |
| 3 orange | `#FF9500` | `#FF9F0A` |
| 4 purple | `#AF52DE` | `#BF5AF2` |
| 5 teal | `#30B0C7` | `#40C8E0` |
| 6 pink | `#FF2D55` | `#FF375F` |
| 7 indigo | `#5856D6` | `#5E5CE6` |
| 8 yellow | `#FFCC00` | `#FFD60A` |

Domain colour mapping (replaces `utils/colors.js` constants; the file becomes a
map of domain keys → `var(--series-n)` / `var(--status-*)` strings, no hex):

| Domain | Mapping |
|---|---|
| Priority | High → `--status-negative`, Medium → `--status-warning`, Low → `--series-5` (teal) |
| Budget bar | Done → `--status-positive`, Pending → `--status-warning`, Free → `--tint`, Over → `--status-negative` |
| Platforms | eToro `--series-2`, Binance `--series-8`, Fidelity `--series-1`, Tradeville `--series-7`, ING Funds RON `--series-3`, ING Funds EUR `--series-6` (six distinct; check adjacent-line contrast in the chart before finalising) |
| Book types | Audiobook `--series-4`, Training `--series-5`, Book `--label-secondary`, Other `--series-7` |
| HTTP methods (Backstage) | GET `--series-1`, POST `--series-2`, PUT `--series-3`, DELETE `--status-negative` |
| Statistics bars | Free ≥ 0 → `--tint`, Free < 0 → `--status-negative` |

Charts read the same variables at runtime through a `useChartTheme()` hook
(reads `getComputedStyle(document.documentElement)` and re-reads on theme
change), because Recharts needs concrete colour strings for some props.

---

## 5. Information architecture and navigation

### 5.1 Tab bar

Four tabs, iOS tab bar (translucent material, full width, labels under
icons, selected item in `--tint` with a filled icon):

| Tab | Root screen | Contains |
|---|---|---|
| **Today** | `/` | The current Home Overview, as widgets |
| **Money** | `/money` | Budget · Split · Stats · Invest (segmented) |
| **Library** | `/library` | Books & Development |
| **HQ** | `/hq` | Headquarters |

Names are proposals (see §15). The tab bar is a standard edge-to-edge bar with
`padding-bottom: env(safe-area-inset-bottom)`, height 49 pt + inset — the
floating dock is retired.

Behaviour:

- Each tab keeps its own navigation stack and scroll position (re-selecting a
  tab returns to where the user was).
- **Tapping the already-selected tab** pops to its root and scrolls to the top;
  on Money → Budget it also jumps back to the current income period (today's
  `resetDashboard` behaviour, now triggered by the iOS convention).
- **System back (Android)** follows §10.3: it closes the top overlay, then pops
  the tab's stack, then returns to Today, then leaves the app.

### 5.2 Money: from hidden menu to visible structure

The ⋮ Finance menu disappears. Money's large-title header carries a
**segmented control** directly under the title:

```
Money                                  (avatar)
[ Budget | Split | Stats | Invest ]
```

- Each segment is its own route (`/money`, `/money/split`, `/money/stats`,
  `/money/invest`), so deep links, back and refresh work.
- The segmented control is sticky under the collapsed navigation bar while
  scrolling.
- **Add Income / Add Expense** move to a `+` button in the navigation bar
  (trailing). On Budget it opens a pull-down menu: *New Expense*, *New Income*.
  On Split: *New Split Payment*. On Invest: *New Snapshot*, *New Operation*.
  Each opens a form sheet (§6.7), not a page.
- **Show / Hide income amounts** becomes an eye button in the navigation bar
  on Budget (eye / eye-slash icon), with the same persisted behaviour (§7).
- **Year selection** (`YearContext`, shared by Budget and Stats) becomes a
  pull-down button in the navigation bar showing the year (`2026 ⌄`), listing
  available years, capped at the current year. Keeps the shared state.

### 5.3 Account

The initials avatar stays — at the trailing edge of every tab's large title,
like the account button in Apple's own apps. Tapping it opens an **Account
sheet** (medium detent):

```
┌───────────────────────────────┐
│            ───                │
│  (MN)  nenciulescu            │
│        Session · 47 min left  │
├───────────────────────────────┤
│  ⚙  Settings               ›  │
│  ⌘  Backstage              ›  │  ← only while backstageEnabled
│  🛡  Admin                  ›  │  ← only for ADMIN_USER
├───────────────────────────────┤
│        Sign Out  (red)        │
└───────────────────────────────┘
```

Settings, Backstage and Admin are pushed full screens (with a back button to
the tab they were opened from). Gating rules are unchanged
(`visibleItems()` from `navConfig.js` survives as `src/app/navigation.js`).

### 5.4 Routing

- A `<TabShell>` owns four `<Outlet>` stacks; React Router 7 nested routes per
  tab.
- **Modal routes** for sheets that should survive refresh and be linkable:
  `location.state.background` pattern — the sheet renders over the background
  route; on direct load it renders over the tab root.
  - `/money/expense/new?incomeId=&date=`
  - `/money/expense/:expenseId`
  - `/money/income/new`, `/money/income/:incomeId`
- Old routes redirect (Appendix B) so bookmarks and the installed PWA's start
  URL keep working.
- `/admin` stays guarded by username in the router, as today.

---

## 6. Component library

A new folder `src/ui/` replaces `components/ui.jsx`, `tokens.js`,
`navIcons.jsx`, `TabIcons.jsx`, `DateSheet.jsx`, `Headquarters/Modal.jsx` and
the per-page sheets. Each component has a CSS Module and a short test.

Behaviour and accessibility come from **React Aria Components** (menus,
dialogs, alerts, switches, tabs / segmented controls, list boxes, calendar,
press and long-press handling); gestures and animation from **Motion**; the
look is entirely our CSS (§12.1). Components are written in TypeScript.

### 6.1 Shell

- **`AppShell`** — root layout: safe-area padding, `100dvh`, the centred
  430 px column, tab bar, toast host, sheet host.
- **`TabBar`** — §5.1. `aria-label="Main"`, `aria-current="page"` on the
  selected tab.

### 6.2 `NavigationBar` + `LargeTitle`

- Large title (34 pt) at the top of each root screen, with optional trailing
  actions (avatar, `+`, eye, year menu).
- On scroll, a sentinel observed with `IntersectionObserver` collapses it: the
  large title scrolls away and a 17 pt inline title fades into a material bar.
  The bar's hairline separator appears only after content passes under it.
- Pushed screens use the compact bar from the start: `‹ Back` (label is the
  previous screen's title), centred title, trailing actions.
- Optional bottom accessory slot (the Money segmented control, Library search).

### 6.3 Lists

- **`List`** — `variant="insetGrouped" | "plain"`. Inset grouped: 16 pt side
  margin, `--radius-md`, `--bg-grouped-secondary`, hairline separators inset to
  the text start.
- **`ListSection`** — header (footnote, uppercase, secondary) and footer
  (footnote, secondary); collapsible variant with a disclosure chevron (used
  for Settled, Special expenses, per-person Library sections).
- **`ListRow`** — slots: `leading` (icon tile, checkbox, dot), `title`,
  `subtitle`, `trailing` (value, badge, toggle, chevron). Variants: navigation
  (chevron), toggle, value, destructive. Press state, `:focus-visible` ring.
- **`SwipeActions`** — wraps a row. Swipe left reveals trailing actions
  (Edit — grey/blue, Delete — red); a full swipe triggers the first
  destructive action's *confirm* state, not the delete itself (§9.2). Built on
  Motion `drag="x"` with velocity thresholds and rubber-banding, plus
  `touch-action: pan-y` so vertical scrolling is unaffected; every action is also reachable from a
  long-press context menu and from the edit sheet, so swipe is never the only
  path.

### 6.4 Controls

- **`Button`** — `filled` (tint), `tinted` (tint at 15 % behind tint label),
  `gray` (fill + label), `plain` (text only), `destructive`. Sizes `large`
  (50 pt, full width in sheets) / `medium` (34 pt) / `small` (28 pt).
- **`IconButton`** — 44 pt hit area, 28 pt visual circle optional.
- **`SegmentedControl`** — iOS look (fill track, elevated white/grey thumb that
  slides). Keyboard and `role="tablist"` semantics when it switches views;
  `role="radiogroup"` when it is a form value (Deposit / Withdrawal, Track by).
- **`Toggle`** — iOS switch, 51 × 31, `--status-positive` when on;
  `role="switch"`.
- **`Checkbox`** — iOS-style circular check (Reminders style): outlined circle
  → filled tint circle with checkmark; 28 pt visual, 44 pt hit area.
- **`Stepper`** — − / value / + (occurrence count, rating if desired).
- **`TextField`** — 17 px, grouped-row style (label left, value right) or
  stacked style; clear button; `inputMode` set per field
  (`decimal` for amounts).
- **`SearchField`** — rounded fill, magnifier, cancel button.
- **`Picker`** — row that opens a pull-down menu (Priority, Currency, Source,
  Type, Frequency, Platform).
- **`DateField`** + **`DatePickerSheet`** — the current `DateSheet` (Monday
  first, Clear action) restyled as an iOS inline calendar inside a sheet.
  **Native `<input type="date">` stays banned** for the same reason as today.
  `MonthField` variant for `dateCompleted` (YYYY-MM) shows a month-year wheel
  made of two scroll-snap columns.
- **`Rating`** — five stars, tap to set, tap the current value to clear
  (keeps `null` support).

### 6.5 Display

- **`Card`** / **`Widget`** — `--bg-grouped-secondary`, `--radius-lg`, padding
  16; widget variant has a header row (icon + title in tint, trailing chevron
  link).
- **`StatTile`** — big rounded-font value, caption, optional dot.
- **`Badge`** / **`Chip`** — small capsule, tinted background at 15 % of the
  series colour with the series colour as text.
- **`ProgressBar`** — capsule track (`--fill`), segmented fill; **`ProgressRing`**
  for Split coverage (`paid / occurrenceCount`).
- **`EmptyState`** — icon, headline, footnote, optional button.
- **`Skeleton`** — shimmer blocks, disabled under reduced motion.
- **`PrivateValue`** — §7.

### 6.6 Overlays

- **`Sheet`** — bottom sheet with detents (`medium` ≈ 50 %, `large` ≈ 92 %),
  grabber, drag-to-dismiss with velocity, scrim tap to dismiss, Escape to
  dismiss, **system back to dismiss** (via the overlay manager, §10.3), focus
  trap, `role="dialog" aria-modal="true"`, restores focus to the
  opener. One implementation for every sheet in the app.
- **`FormSheet`** — `Sheet` at `large` with a nav bar: *Cancel* (leading),
  title, *Save* / *Add* (trailing, bold, disabled until valid). Dismissing a
  dirty form asks via action sheet: *Discard Changes* / *Keep Editing*.
- **`ActionSheet`** — bottom-anchored list of choices + separate Cancel. Used
  for: delete series choice, edit-series scope, discard changes. (Sign out
  stays one tap, as today.)
- **`Alert`** — centred iOS alert (title, message, up to 3 buttons, optional
  secure text field). Used for: "Mark as settled?", Delete user (password),
  errors that need acknowledgement.
- **`Menu`** — pull-down menu anchored to a button (nav bar `+`, year picker,
  `…` card menus, filter pickers); also used as the long-press context menu
  on rows.
- **`Toast`** — top-of-screen capsule for non-blocking results
  ("Saved", "Could not save the change", "FX rates updated"), auto-dismiss
  3 s, `role="status"`.

---

## 7. Sensitive information

Today the app hides two kinds of value:

| Value | Current behaviour |
|---|---|
| Income amount on the Dashboard income header | Hidden by default according to Settings → Privacy (`incomePrivacy` in `localStorage`); toggled from the ⋮ menu; persisted. When hidden, text is transparent (keeps its width). |
| Portfolio total and per-platform amounts on Home → Current Holdings | Masked as `••••`; **press and hold** the eye button to reveal; released → masked again. Never persisted. |
| Password in Admin → Delete user | Password input; required before the delete call. |

The redesign keeps each one exactly and puts it on one mechanism.

### 7.1 `PrivacyContext`

```js
const { incomeVisible, setIncomeVisible } = usePrivacy();
```

- Initialised from `localStorage.incomePrivacy` (same key, so the user's current
  preference carries over).
- Settings → Privacy edits the **default** (as today: the value written to
  storage); the Budget eye button toggles the current state *and* persists it
  (as the ⋮ toggle does today).

### 7.2 `<PrivateValue>`

```jsx
<PrivateValue mode="toggle" visible={incomeVisible}>{fmt(amount)} RON</PrivateValue>
<PrivateValue mode="hold" group="holdings">{fmt(total)} EUR</PrivateValue>
```

- Hidden rendering: a rounded **redaction capsule** the width of the value
  (`--fill`, like iOS's redacted placeholders) instead of transparent text, so
  the user can see there *is* a value. Screen readers get "Hidden amount".
- `mode="toggle"` — follows the context flag.
- `mode="hold"` — paired with a `<RevealButton group="holdings">` (eye icon).
  Pointer-down (mouse or touch) reveals every `PrivateValue` in the group;
  pointer-up, pointer-cancel, pointer-leave or the page becoming hidden masks
  them again. Keyboard: Space held = reveal. Matches today's hold-to-reveal and
  adds the safety of re-masking on app switch.
- Values are not rendered into the DOM at all while hidden (the capsule is a
  placeholder), so they cannot be read from the accessibility tree or by
  selecting text.

### 7.3 Where it applies

| Screen | Value | Mode |
|---|---|---|
| Money → Budget, period header | Income amount | toggle |
| Today → Holdings widget | Total and per-platform amounts | hold |
| Admin → Delete user | Password | `Alert` secure text field (`type="password"`, `autocomplete="current-password"`) |
| Login | Password / confirm | secure fields with show/hide eye (new, optional — see §15) |

**Unchanged on purpose:** the budget-bar figures on Budget and the Investments
screen totals are visible today and stay visible. §15 lists extending privacy
to them as an option, not a default.

### 7.4 App switcher snapshot (optional)

When `document.visibilityState` becomes `hidden`, add a blur overlay class to
`<body>` so the iOS app switcher snapshot does not show figures. Off by
default; a Settings → Privacy toggle "Hide content in app switcher".

---

## 8. Screen-by-screen specification

Wireframes are schematic; spacing and type come from §3.

### 8.1 Login

```
        (app icon, 80 pt)
        4TURA Home              ← large title
        Sign in to continue     ← subheadline, secondary

  ┌──────────────────────────┐
  │ Username                 │
  │──────────────────────────│
  │ Password            (eye)│
  │──────────────────────────│
  │ Confirm password         │  ← sign-up mode only
  └──────────────────────────┘
  [        Sign In          ]   ← filled, large
           or
  [  Google Sign-In button  ]   ← GIS-rendered, only if googleLoginEnabled
  Don't have an account? Create one   ← only if createAccountEnabled
```

- Same logic: SRP sign-in, sign-up with password match check, GIS popup →
  `/auth/google`. Errors inline under the group in `--status-negative`.
- The Google button keeps Google's own rendered button (branding rules); its
  `theme` option follows the app theme (`outline` in Light, `filled_black` in
  Dark).

### 8.2 Today (Home Overview)

A vertical stack of **widgets** under the large title "Today" and the date
(footnote, e.g. "Friday, 14 November"):

1. **This Period** (widget, full width)
   - Header: income date (`NOV 10 2026 · MON`) and income name in title2;
     `Expenses` capsule.
   - List: the expenses outstanding at load, priority then date. Row: circular
     checkbox, priority dot, ★ if special, summary, date (`11-14`), amount.
     Ticking strikes through and dims, row stays until reload (unchanged).
     Special rows keep a `--status-special` 12 % tint.
   - Footer: two `StatTile`s — **Done** and **Pending** for the whole period.
   - Empty states unchanged ("No expenses for this period." / "Nothing left to
     pay.").
   - Tapping the header opens Money → Budget on the current period.
2. **Split Payments** — three newest open entries. Each: title, coverage ring
   (`2/6`), total, and the slot grid (two per row; amount fields typed, date
   slots open `DatePickerSheet`; 600 ms debounce; "Mark as settled?" `Alert`
   on the last empty slot, Cancel restores). Header link: *See All ›* →
   Money → Split.
3. **Holdings** — portfolio total (title1, rounded font) and platform rows with
   coloured dots, all `PrivateValue mode="hold"`; eye `RevealButton` in the
   widget header ("Hold to reveal"); footnote with the FX date.
4. **Library** — persons × types grid, each cell the latest entry (title,
   month). Header link → Library.

Pull-to-refresh reloads all five API calls (new; uses a custom indicator since
standalone PWAs have no native pull-to-refresh on iOS).

### 8.3 Money → Budget (Finance Dashboard)

```
Money                       2026⌄  👁  +  (MN)
[ Budget | Split | Stats | Invest ]
‹  Period 23 of 26  ›          [Today]
┌──────────────────────────────────────┐
│ NOV 10 2026 · MON              ···   │
│ Monthly salary          ▬▬▬▬ (hidden)│
│ ┌──────────────────────────────────┐ │
│ │■■■■■■■■■■■■■□□□□□□░░░░░░░░░░░░░░░│ │  segmented capsule
│ └──────────────────────────────────┘ │
│ ● Done 4 200  ● Pending 1 150  ● Free 2 650 │
├──────────────────────────────────────┤
│ ◯ ● Rent               11-12  3 500,00│  ← swipe: Edit · Delete
│ ◯ ● Electricity        11-15    240,00│
│ ◉ ● Internet  (struck) 11-11     60,00│
│ + Add Expense                        │
└──────────────────────────────────────┘
```

- **Period pager:** a horizontal **CSS scroll-snap** carousel of period cards
  (one per income in the selected year), replacing the custom touch handlers.
  Native momentum and VoiceOver support. Pager label (`Period 23 of 26`) with
  ‹ › buttons, and a **Today** button that appears only when the current
  period is off-screen (replaces ◎). Re-tapping the Money tab also returns to
  today (§5.1).
- **Period header:** date line (same shared header styles as Today's widget,
  keeping the "two designs in sync" rule), income name, income amount as
  `PrivateValue mode="toggle"`. Trailing `···` menu: *Edit Income*, *Add
  Expense to This Period*, *Delete Income* (destructive).
- **Budget bar:** one capsule bar with Done / Pending / Free (or Over) segments
  and a legend row with the four figures (Total spent, Done, Pending, Free or
  Over). Same arithmetic as `IncomeCard` today, including the minimum-segment
  rule so labels fit; labels move to the legend so the bar can be slimmer
  (12 pt).
- **Expense rows:** circular checkbox toggles Completed / Pending; priority
  dot; ★ special with tint; summary; `MM-DD`; amount (struck when done).
  Tap row → Edit Expense sheet. Swipe left → *Edit*, *Delete*. Long-press →
  context menu with the same, plus *Mark as Completed/Pending*.
- **Delete:** single expense → swipe/menu Delete → confirm (§9.2). Series member
  → `ActionSheet` *Delete This Occurrence* / *Delete Entire Series* / Cancel.
  Deleting an income: `ActionSheet` with the same series choice when
  applicable; affected expenses remap optimistically (unchanged logic).
- Sorting: priority then date (unchanged).

### 8.4 Expense and Income sheets (replace `/add-expense`, `/add-income`)

`FormSheet`, large detent. Title *New Expense* / *Edit Expense*.

**Expense** — inset grouped form:

| Group | Rows |
|---|---|
| Details | Summary (text), Amount (decimal, currency suffix), Date (`DateField`) |
| Mapping | *Maps to: Monthly salary · Nov 10* — live preview from `/expenses/resolve-income` (footnote style, updates on date change) |
| Classification | Priority (`Picker`: High / Medium / Low with dots), Status (segmented Pending / Completed), Special (toggle, ★) |
| Repeat | Repeat (toggle) → Frequency (`Picker` daily / weekly / monthly), Ends (`DateField`, required when repeating) |

- Validation unchanged (date within current year, amount > 0, required fields,
  series end date). Errors shown under the offending row in
  `--status-negative`; *Save* disabled until valid.
- Editing a series member: on *Save*, `ActionSheet` *Save for This Occurrence
  Only* / *Save for All Future Occurrences* (replaces the "Edit scope" field;
  same `PUT /{id}` vs `PUT /{id}/series` calls).
- Opened from a period's `+ Add Expense` or `···` → pre-fills `date` and the
  mapped income, as today's `incomeId`/`date` query does.
- On save the sheet closes and the Budget pager stays on the same period —
  `returnStartIdx` and `from` are no longer needed because the page never
  unmounts.
- Delete button at the bottom of the edit sheet (destructive, with confirm).

**Income** — same pattern: Summary, Amount, Currency, Date, Repeat (frequency,
ends). Series edit scope via `ActionSheet`.

### 8.5 Money → Split

```
Money                                  +  (MN)
[ Budget | Split | Stats | Invest ]
  3 open · 5 settled
  Left to cover: 4 200 RON · 350 EUR

IN PROGRESS
┌──────────────────────────────────────┐
│ ◔ 2/6  Laptop            1 200 RON ⌄ │  ring = coverage
│        Nov 2 · 800 RON left      ··· │
│  #1 [ 200 ] #2 [ 200 ]               │
│  #3 [     ] #4 [     ]               │
│  #5 [     ] #6 [     ]               │
└──────────────────────────────────────┘
SETTLED (5)                           ⌄
```

- Same grouping, expand/collapse defaults (open expanded, settled collapsed),
  per-card overrides.
- Card `···` menu: *Cover Rest* (amount-tracked only), *Clear All*, *Edit*,
  *Delete*. Cover Rest keeps the remainder-absorbing split.
- Slot rules unchanged: exactly `occurrenceCount` slots, two per row, amount
  inputs 17 px with `inputMode="decimal"`, date slots → `DatePickerSheet`,
  "Mark as settled?" `Alert` (*Mark Settled* / *Cancel*), 600 ms debounce,
  "Could not save the change." → `Toast`.
- New / Edit: `FormSheet` with Title, Date, Total, Currency (`Picker`),
  Occurrences (`Stepper` 1–36), Track By (segmented Amount / Date — disabled
  once a slot is filled, with a footnote explaining why).

### 8.6 Money → Stats

```
Money                       2026⌄        (MN)
[ Budget | Split | Stats | Invest ]
  9 months with data · now November

┌───────────────┐ ┌───────────────┐
│ Avg free/month│ │ Survival/month│
│   2 340       │ │  11 850       │
└───────────────┘ └───────────────┘
AVERAGES
│ ● High    4 100 │ ● Medium 2 300 │ ● Low 900 │

FREE AMOUNT PER MONTH
┌──────────────────────────────────────┐
│  bar chart, Jan–Dec, "now" marker    │
└──────────────────────────────────────┘

★ SPECIAL EXPENSES · 4 in 2026 · 6 300   ⌄
```

- All calculations unchanged (`monthsWithData`, `SURVIVAL_BASELINE`, null for
  future months).
- Chart restyled: rounded bar tops (`radius={[6,6,0,0]}`), no grid verticals,
  axis labels caption1 secondary, current month full opacity and others 50 %,
  dashed "now" line in `--label-tertiary`, zero line. Tooltip becomes a
  callout bubble with Income / High / Medium / Low / Free.
- Tapping a bar selects the month (persisted highlight) and shows the
  breakdown in a fixed panel under the chart — better on touch than hover
  tooltips. The tooltip remains for pointer devices.

### 8.7 Money → Invest

Four sections, same data rules as today:

1. **Total Portfolio** — collapsible card: total EUR (title1), platform count,
   `FX Nov 13` / `No FX rates set`. Expanded: per-platform rows with dot, EUR
   amount, share bar in platform colour, share %, original amount + currency,
   last snapshot date (`heldPlatforms`).
2. **Evolution** — line chart from `CHART_START` (2023-01), Total visible,
   platforms toggled by chips (`activePlatforms`) in a horizontally scrolling
   chip row; operation-month dots; tooltip with value, that month's operations
   and net cash. Add a range segmented control *1Y · 3Y · All* (new, view-only;
   default All so current behaviour is preserved).
3. **Snapshots** — grouped by date, newest first, 3 at a time with
   *Show 3 More* / *Show Less* (unchanged counts). Collapsed row: date, count
   badge, platform dots, carry-forward total. Expanded: platform rows with
   amount, `≈ N EUR`, swipe Edit / Delete; *Add Platform to This Date* row.
4. **Operations** — rows with platform dot, name, Deposit / Withdrawal badge
   (positive / negative colour), date, signed amount; tap expands notes; swipe
   Edit / Delete. Same 3-at-a-time reveal.

`+` menu: *New Snapshot*, *New Operation* → `FormSheet`s (type as segmented
Deposit / Withdrawal; currency pre-filled from platform default, editable).

### 8.8 Library (Books & Development)

```
Library                          +  (MN)
[🔍 Search title or author        ] [Filter ⌄(2)]
  3 people · 42 of 58 entries          Clear

MIHAI  (24)                              ⌄
┌──────────────────────────────────────┐
│ Last 12 months             10 completed│
│  line chart, Dec–Nov                  │
└──────────────────────────────────────┘
┌──────────────────────────────────────┐
│ Atomic Habits                         │
│ James Clear · Voxa                    │
│ [Audiobook] ★★★★☆           2026-09  │
└──────────────────────────────────────┘
[ Show Less ]        [ Show 5 More  6/24 ]
```

- Search moves out of the filter sheet into a `SearchField` under the title
  (iOS search-in-nav pattern); the rest of the filters (person, type, source,
  rating) stay in a filter sheet behind the **Filter** button, which shows the
  active count; **Clear** resets all. Filtering semantics unchanged (the
  per-person chart counts filtered entries, as today).
- Per-person collapsible sections, alphabetical, "Unassigned" last; the
  12-month line chart; entry cards; reveal 1 → 6 → 11… with *Show N More* /
  *Show N Less* side by side (current behaviour).
- Entry card: tap to expand comments; stars are tappable inline to re-rate
  (current behaviour); swipe or `···` → Edit / Delete.
- New / Edit: `FormSheet` — Person (text with suggestions from existing names),
  Title, Author, Type (`Picker`), Source (`Picker`), Completed (`MonthField`,
  YYYY-MM), Rating (`Rating`), Comments (multi-line).

### 8.9 HQ (Headquarters)

- Large title "HQ"; under it a horizontally scrolling **chip bar**: *Overview*
  · one chip per location · (no Settings chip). Settings moves to a `···`
  button in the navigation bar → pushed **HQ Settings** screen.
- **Overview** (today's HQ Dashboard): per location, water-consumption chart
  for water templates (Consum Apa Rece / Calda), read-only latest entries for
  other templates.
- **Location**: one inset section per template with a *New Entry* button in
  the section header. Entries as cards, newest first; tapping a card expands
  stacked labelled fields (number / text / boolean→`Toggle`, with units as
  trailing labels); auto-save 600 ms debounce with a subtle "Saved" footnote;
  computed consumption columns shown as read-only value rows; delete with
  confirm.
- **HQ Settings**: Locations section (rows → edit sheet: name, address; delete
  disabled with footnote while templates exist) and Templates section (rows →
  edit sheet: location picker, name, parameters list with add / reorder (drag
  handle) / delete, each parameter title + type `Picker` + unit; 1–30 limit
  with counter).
- `Headquarters/Modal.jsx`, `LocationModal.jsx`, `TemplateModal.jsx` and
  `styles.js` are replaced by `FormSheet`s and the shared library.

### 8.10 Settings

Pushed from the Account sheet. Inset grouped list:

| Section | Rows |
|---|---|
| Appearance | Theme — three-way picker with live mini-previews: **Automatic** · **Light** · **Dark** |
| Privacy | Show Income Amounts by Default (toggle; writes `incomePrivacy`) · Hide Content in App Switcher (toggle, optional §7.4) |
| About | Version (build hash), Session expires in … |

Saving is immediate (iOS settings convention) rather than the current draft +
Save button; theme previews no longer need hard-coded hex because each preview
is rendered inside a `data-theme` scope of its own.

### 8.11 Backstage

Pushed from Account (only while `backstageEnabled`).

- Segmented / `Picker` table selector: Incomes, Expenses, Operations,
  Snapshots, Splits.
- `SearchField`; results as a plain list with monospace secondary line
  (id, key fields); 10 per page with a pager row (‹ 1 / 7 ›).
- Swipe → Delete (with confirm).
- **API Log** section: last 50 calls from `opLog`, method badge coloured by
  HTTP method, path, status, duration; newest first; tap a row to expand
  request/response summary.

### 8.12 Admin

Pushed from Account (only for `ADMIN_USER`). Inset grouped sections:

1. **App Settings** — three toggles: Backstage, Google Login, Create Account.
2. **FX Rates** — 3 × 3 matrix as a compact table card, *Updated Nov 13*;
   *Update FX Rates* button (tinted) → spinner in button → `Toast`.
3. **Database Backup** — *Back Up All Tables* (filled) → progress list (one row
   per table with spinner → checkmark / error and item count), final link to
   the Drive folder name.
4. **Users** — rows: username, email, income/expense counts, *Admin* badge.
   Tap → user detail sheet: Admin role toggle, *Delete User and All Data*
   (destructive) → `Alert` with secure password field ("Enter your password to
   confirm"); wrong password shows the alert's error line, same
   `verifyPassword` flow.

---

## 9. Interaction patterns

### 9.1 Create / edit

Always a `FormSheet` over the current screen. Cancel with unsaved changes asks
to discard. Save closes and shows the change in place; failures keep the sheet
open with an inline error.

### 9.2 Delete (replaces the 4 s two-step inline confirm)

The safety property kept: **one accidental tap never deletes**.

- From a swipe action or context menu: tapping **Delete** turns the action
  into **Confirm Delete** (red, wider) for 4 s; a second tap deletes. A full
  swipe also lands on the confirm state, never deletes directly. (This is the
  current two-step pattern expressed with iOS swipe actions.)
- From an edit sheet's Delete button: `ActionSheet` *Delete Expense* / Cancel.
- Series choice and income deletion use `ActionSheet` (§8.3).
- After a delete, a `Toast` with **Undo** for 5 s (new): the API delete is
  deferred until the toast expires or the screen is left. Optional — see §15;
  if not adopted, the toast is informational only.

### 9.3 Auto-save

Split slots and HQ entries keep 600 ms debounced saves. A small "Saving…" →
"Saved" footnote in the card replaces silent saves; errors go to `Toast`.

### 9.4 Reveal more

Lists that page locally (Library, Snapshots, Operations) use a pair of plain
buttons at the end of the list: *Show Less* (when more than the first page is
shown) and *Show N More* with an `n/total` counter.

### 9.5 Gestures

| Gesture | Where | Fallback |
|---|---|---|
| Horizontal scroll-snap | Budget periods | ‹ › buttons, Today button |
| Swipe left on row | Expenses, entries, snapshots, operations, users, Backstage rows | Context menu, edit sheet |
| Long-press | Rows (context menu); Holdings eye (reveal) | `···` menus; Space key for reveal |
| Drag down | Sheets | Cancel / scrim / Escape / system back |
| Pull to refresh | Today, Budget, Library, HQ | — (data also reloads on focus) |
| Edge swipe back | **iPhone only:** pushed screens (Settings, Admin, Backstage, HQ Settings) | Back button |
| System back button / gesture | **Android:** everywhere (§10.3) | Back button in the nav bar |

The app's own edge swipe exists because an installed iPhone PWA has no back
gesture. On Android it is **disabled**, because the system back gesture uses
the same screen edges; Android users get the system back instead, wired into
the same navigation stack. Both end in the same state.

Long-press on Android normally starts text selection or Chrome's own context
menu. Rows that have an app context menu call `preventDefault()` on
`contextmenu` and set `user-select: none` / `-webkit-touch-callout: none`, so
the app's menu is the only one that appears, on both platforms.

---

## 10. PWA and cross-platform behaviour

### 10.1 Supported platforms

| Platform | Browser engine | Minimum | Notes |
|---|---|---|---|
| iPhone (installed or Safari) | WebKit | iOS 17 | Primary target; all iOS browsers use WebKit |
| Android (installed or browser) | Chrome / Chromium | Chrome 120 | Includes Edge, Brave, Opera |
| Samsung phones | Samsung Internet | 24 | Chromium-based; test separately (own UI chrome) |
| Android | Firefox | current | Can't install as standalone like Chrome; works in the browser |
| Desktop browsers | any of the above | — | Same 430 px column, as today |

Every feature used is either supported on all of these or has a defined
fallback:

| Feature | iOS Safari | Chrome Android | Fallback |
|---|---|---|---|
| `backdrop-filter` (materials) | ✓ (`-webkit-` prefix) | ✓ | Solid bar colour |
| CSS scroll-snap (period pager) | ✓ | ✓ | — |
| `100dvh`, `env(safe-area-inset-*)` | ✓ | ✓ | `100vh` |
| `color-mix()` | ✓ | ✓ | Pre-mixed token values |
| View Transitions | ✓ (18+) | ✓ | No animation |
| `corner-shape: squircle` | ✗ | ✓ | Rounded corners |
| `navigator.vibrate` (haptics) | ✗ | ✓ | No haptic |
| `beforeinstallprompt` | ✗ | ✓ | Install instructions sheet |
| Pointer events (swipes, sheets) | ✓ | ✓ | — |

### 10.2 Platform detection — behaviour only

`src/app/platform.js` runs before first render (inline in `index.html`) and
sets `<html data-platform="ios|android|other" data-standalone="true|false">`.

- iOS: `navigator.maxTouchPoints > 1` with an Apple platform / UA (covers
  iPadOS reporting as Mac); Android: UA-CH `navigator.userAgentData.platform`
  or UA fallback; standalone: `matchMedia("(display-mode: standalone)")` or
  `navigator.standalone`.
- **Allowed uses:** edge-swipe back (iOS only), back-button integration
  (all, matters on Android), install flow, haptics, font preload, keyboard
  handling.
- **Not allowed:** changing colours, layout, components or wording per platform.
  A lint rule / review checklist item: `data-platform` selectors may not set
  visual properties.

### 10.3 Back navigation (Android back button and gesture)

Android's system back must never skip past what the user is looking at, and
must never leave the app by accident. The app keeps an **overlay stack**
(sheets, alerts, action sheets, menus, the filter sheet, the date picker) on
top of the router's screen stack, and mirrors both in browser history:

1. Opening an overlay calls `history.pushState({ overlay: id }, "")`.
2. `popstate` closes the **top overlay** if there is one.
3. Closing an overlay from the UI (Cancel, scrim, drag down, Save) calls
   `history.back()` so history and UI stay in step; a guard flag stops the
   resulting `popstate` from closing a second overlay.
4. With no overlay open, back pops the current tab's screen stack (Settings →
   previous tab, HQ Settings → HQ, etc.).
5. At a tab's root that is not Today, back returns to **Today** (tab switches
   use `replace`, except leaving Today, which pushes once).
6. At Today's root, back leaves the app (Android's normal behaviour).

Unsaved forms: back on a dirty `FormSheet` opens the *Discard Changes* action
sheet instead of closing (the history entry is re-pushed).

Modal routes (`/money/expense/:id`, §5.4) are already URL entries, so they
follow the same rules without extra state.

On iPhone the same code runs; installed iPhone PWAs have no system back, so it
is simply never triggered there except by the app's own edge swipe and back
buttons, which use the same path.

### 10.4 Install and launch

- **Manifest** (shared): `display: "standalone"`, `orientation: "portrait"`,
  `start_url: "/"`, `scope: "/"`, `id: "/"`, name / short name "4TURA Home",
  `background_color` and `theme_color` `#F2F2F7`; icons: `any` 192 + 512,
  **maskable** 512 (Android adaptive icons crop to circles/squircles, so the
  artwork stays within the 80 % safe zone), `monochrome` 512 (Android themed
  icons).
- **iPhone:** `apple-touch-icon` 180; `apple-mobile-web-app-capable`;
  `apple-touch-startup-image` splash images for current iPhone sizes in both
  schemes (generated at build time).
- **Android:** the splash screen is generated by the OS from the manifest
  (name, maskable icon, `background_color`); nothing extra is needed.
- **Install prompt:**
  - Android / Chromium: capture `beforeinstallprompt`; show an **Install App**
    row in Settings → About and a one-time dismissible banner on Today.
  - iPhone Safari (not standalone): the same row opens an instructions sheet
    (Share → Add to Home Screen) with an illustration.
  - Already installed (`display-mode: standalone`): hidden.
- **Updates:** when the service worker finds a new version, a `Toast`
  "New version available — Reload" on every platform (fixes the current
  "close and reopen the app" step).

### 10.5 System bars and safe areas

- **Viewport:** `width=device-width, initial-scale=1, viewport-fit=cover,
  interactive-widget=resizes-content`. Pinch-zoom stays allowed (current
  accessibility decision).
- **Top:** iPhone uses `apple-mobile-web-app-status-bar-style:
  black-translucent`, so content runs under the status bar; the navigation bar
  pads with `env(safe-area-inset-top)`. Android colours its status bar from
  `theme-color`, which is updated with the theme (two `<meta name="theme-color">`
  tags with `media="(prefers-color-scheme: …)"` for Automatic, overwritten by
  JS for a fixed theme). Both read as one continuous bar.
- **Bottom:** the tab bar pads with `env(safe-area-inset-bottom)`, which covers
  the iPhone home indicator and the Android gesture bar / 3-button bar on
  edge-to-edge devices. Where Android reports `0` but draws a navigation bar,
  the OS places the bar below the viewport, so nothing overlaps.
- **Display cutouts and rounded screens:** handled by the same insets; no
  content within 16 px of the side edges.

### 10.6 Keyboard and input

- **Layout:** Android Chrome resizes the layout viewport when the keyboard opens
  (`interactive-widget=resizes-content`); iPhone does not, so a
  `visualViewport` resize listener lifts sheets and scrolls the focused field
  into view. One `useKeyboardInset()` hook hides the difference.
- **Amounts:** `inputMode="decimal"`. Android keyboards show `.` or `,`
  depending on language, and some show only one; parsing accepts **both**
  `,` and `.` as the decimal separator (the app formats in `ro-RO`, which uses
  `,`). Display formatting is unchanged.
- **Sizes:** all inputs 17 px — above iOS's 16 px zoom threshold; harmless on
  Android.
- **Dates:** the app's own `DatePickerSheet` on every platform (native date
  inputs stay banned), so date entry is identical on iPhone and Android.
- **Pickers:** custom `Menu`s instead of native `<select>`, so Priority,
  Currency, etc. look the same everywhere (native selects would show the
  Android Material dialog).
- `autocomplete`, `enterkeyhint` and `autocapitalize` set on every field, which
  both keyboards honour.

### 10.7 Scrolling, touch and refresh

- `overscroll-behavior: none` on `html, body` and the shell. This removes the
  iOS rubber-band that exposes the background **and** disables Chrome's own
  pull-to-refresh, so the app's pull-to-refresh is the only one, on all
  platforms.
- `contain` on inner scrollers and sheets.
- `-webkit-tap-highlight-color: transparent`; press states from CSS `:active`
  (Android Chrome otherwise flashes a blue box on tap).
- `-webkit-user-select: none` and `-webkit-touch-callout: none` on chrome (bars,
  buttons, rows); content values stay selectable so amounts can still be
  copied — except hidden `PrivateValue`s, which have nothing to copy.
- `touch-action: pan-y` on swipeable rows, `manipulation` on buttons (removes
  the double-tap-zoom delay everywhere).

### 10.8 Offline

The existing service worker is kept. An offline banner (material capsule under
the nav bar) appears when `navigator.onLine` is false, and write actions are
disabled with a footnote rather than failing silently. Same on all platforms.

---

## 11. Accessibility

- Contrast: all label/background pairs meet WCAG AA; Apple's system colours
  used as text on fills are checked (`--status-warning` on white fails for
  small text, so it is only used for dots, fills and large text; text uses
  `--label`).
- Every interactive element ≥ 44 × 44 pt; visible `:focus-visible` ring
  (2 px `--tint`, 2 px offset).
- Semantics: tab bar = `nav`, segmented view switchers = `tablist`, sheets =
  `dialog` with focus trap, alerts = `alertdialog`, toggles = `switch`,
  checkboxes keep native `input type="checkbox"` under the custom visual.
- Charts: each chart has a visually hidden table or `aria-label` summary
  (e.g. "Free amount per month, highest June 4 200").
- **System text size:** the type scale is in `rem`, so it follows the
  platform's larger-text setting.
  - Android: Chrome applies the system font scale to the root font size, so the
    whole scale grows with it.
  - iPhone: PWAs do not get Dynamic Type by default; the root font size is set
    from `font: -apple-system-body` (WebKit-only) so the scale follows the iOS
    Text Size setting too.
  - Layouts are checked at 130 % to make sure rows wrap rather than clip.
- **Screen readers:** tested with VoiceOver (iPhone) and TalkBack (Android).
- Reduced motion and reduced transparency (`prefers-reduced-transparency`:
  materials fall back to solid `--bg-primary`).
- Colour is never the only signal: priority dots have text labels in the edit
  sheet and `title`/`aria-label` in rows; budget segments have a legend.

---

## 12. Technical architecture

### 12.1 Stack review

The redesign is a good moment to ask whether the stack still fits. The use
case: a personal, phone-only PWA; static hosting on S3 + CloudFront; one
existing REST API; ~14 k lines of React with 200+ tests; and a design that
needs iPhone-quality gestures, sheets and transitions plus correct Android
back behaviour (§10). Each layer was weighed against that.

| Layer | Today | Verdict | Considered |
|---|---|---|---|
| UI framework | React 19 | **Keep** | Svelte / Solid / Vue: smaller and fast, but a full rewrite of logic and tests for no user-visible gain at this size |
| Build | Vite | **Keep** (current major) | — the best fit for a static SPA |
| Routing | React Router 7 | **Keep** | TanStack Router (typed routes): nice, but migration cost and no feature the proposal needs |
| Language | JavaScript | **Change: TypeScript for new code** | Plain JS. The redesign writes a new component library and new screens; typed props and API shapes catch a class of bugs that today only tests catch. `allowJs` keeps untouched `utils/` and `api/` as they are |
| Server data | `useEffect` + `useState` per page | **Change: TanStack Query** | Hand-written hooks (the earlier draft of §12.3) |
| Interaction and accessibility primitives | Hand-built | **Change: React Aria Components** | Radix UI; Ionic; hand-built |
| Animation and gestures | CSS transitions, hand-written touch handlers | **Change: Motion** (`motion`, formerly Framer Motion) | `vaul` for sheets only; hand-built springs |
| Styling | Inline style objects | **Change: CSS Modules** (§12.2) | Tailwind v4: fast to write, but long class strings in JSX and a second token syntax; vanilla-extract: typed, but adds a build plugin |
| Charts | Recharts 3 | **Keep** | visx (more control, much more code); Chart.js / uPlot (canvas; faster, but the data here is small and SVG themes more easily) |
| HTTP | axios | **Keep** | `fetch` + wrapper: no gain worth the churn; the interceptor (auth header, 401 sign-out) works |
| Dates | dayjs | **Keep** | — |
| Auth | `amazon-cognito-identity-js` | **Keep** (out of scope) | Amplify Auth v6 is the maintained successor but much heavier; revisit with the JWT-refresh limitation, not as part of the UI work |
| PWA | `vite-plugin-pwa` (Workbox) | **Keep** | — |
| Tests | Vitest + Testing Library | **Keep**, add Playwright (§13) | — |
| Native wrapper | none | **None** | Capacitor: only worth it for native-only APIs (Face ID, widgets); installed PWAs already cover this app's needs |

#### Why TanStack Query

It replaces the most repetitive code in the app and directly improves the
"native app" feel:

- **Instant launch, even offline:** the query cache is persisted to IndexedDB
  (`@tanstack/query-persist-client` + an IndexedDB persister). Opening the app
  shows the last data immediately, then refreshes in the background — the way
  native apps behave, instead of a blank screen or spinner on every launch.
- **Optimistic updates with rollback** (ticking an expense, editing slots,
  deleting) come from `useMutation` (`onMutate` / `onError`) rather than the
  hand-written revert code in each page today.
- **Refetch on focus and on reconnect** — returning to the app after a while
  shows fresh data with no code per screen.
- **Pull to refresh** is one `refetch()`; **shared data** (incomes and
  expenses used by both Today and Budget) is fetched once and reused across
  tabs.
- Small, framework-agnostic, works in jsdom tests with a `QueryClientProvider`
  wrapper; the existing `api/*.js` functions become the query functions
  unchanged.

#### Why React Aria Components (not hand-built, not Radix, not Ionic)

The proposal needs menus, context menus, dialogs, alerts, switches, segmented
controls, tabs, list boxes and a calendar, all accessible and all behaving
well under touch on both iOS and Android.

- **React Aria Components** (Adobe) ships these as **unstyled** components, so
  the iPhone look stays entirely in our CSS Modules. Its `usePress` /
  long-press handling normalises the iOS and Android touch quirks (ghost
  clicks, tap-and-scroll cancellation, long-press vs context menu), which is
  exactly where hand-built mobile UIs break. It also provides a localised
  `Calendar` (Monday-first via locale / `firstDayOfWeek`) to sit inside
  `DatePickerSheet`, focus management, and screen-reader behaviour tested on
  VoiceOver and TalkBack. Only the components used are bundled.
- **Radix UI** — also unstyled and solid, but weaker on touch interactions and
  has no calendar, date or number primitives.
- **Ionic (iOS mode on every platform)** — the closest off-the-shelf match to
  the design: real iOS-style sheets with breakpoints, swipe-to-reveal items,
  collapsing large titles, and Android hardware-back handling built in. It was
  the strongest alternative and was **not chosen** because:
  - its React routing integration (`IonReactRouter`) has historically been
    built on React Router **v5**, which would mean downgrading from v7 —
    confirm the current status before revisiting;
  - its web components use shadow DOM, which limits styling to its CSS
    variables and parts — fine for "looks like iOS", restrictive for "looks
    like *this* app";
  - shadow-DOM web components are awkward in jsdom, so many of the 200+
    Testing Library tests would need reworking or moving to browser tests;
  - it brings its own navigation, lifecycle and overlay model, which becomes
    the app's architecture rather than a library inside it.

  It remains the **fallback** if the hand-composed sheets and swipe rows
  (below) don't reach the required feel after Phase 1 (§15).

#### Why Motion

iPhone feel is mostly physics: sheets that follow the finger and settle with a
spring, rows that rubber-band, a segmented thumb that slides, lists that
animate items in and out. CSS easing curves only approximate springs, and
hand-written drag code (as on today's Dashboard pager) is where gesture bugs
live.

- **Motion** provides real spring animations, `drag` with constraints,
  momentum and velocity (for sheet detents and swipe-row thresholds), layout
  animations (rows reordering, cards expanding), and `AnimatePresence` for
  exit animations. Tree-shakeable (`LazyMotion` + `m` components load only the
  features used) and honours `prefers-reduced-motion` via `MotionConfig`.
- It replaces the separate `vaul` option: one gesture and animation layer for
  sheets, swipe rows, the segmented control and list changes.
- View Transitions (§3.6) stay for screen push / pop; Motion handles
  everything inside a screen.

### 12.2 Styling: CSS Modules + tokens

Move from inline style objects to **CSS Modules** (built into Vite, no new
dependency).

- Enables `:active`, `:focus-visible`, `@media`, `@supports`, `@container`,
  reduced-motion and transitions without React state.
- Shrinks page files substantially (style objects are roughly a third of most
  page files today).
- Inline `style` stays allowed only for genuinely dynamic values (bar widths,
  chart colours, CSS custom-property injection like `--seg-width`).

```
src/
├── theme/
│   ├── tokens.css          # spacing, radii, type, motion, z-index (theme-independent)
│   ├── themes.css          # [data-theme="light"], [data-theme="dark"] semantic tokens
│   ├── themes.js           # registry (§4.2)
│   ├── ThemeProvider.jsx   # auto / light / dark, matchMedia, meta theme-color
│   ├── domainColors.js     # priority, platform, type, HTTP → var(--…)
│   └── useChartTheme.js
├── ui/                      # component library (§6), one folder per component
│   ├── Button/ Button.tsx Button.module.css Button.test.tsx
│   ├── List/ … Sheet/ … SegmentedControl/ … PrivateValue/ …
│   └── icons/
├── app/
│   ├── AppShell.jsx  TabBar.jsx  NavigationBar.jsx
│   ├── navigation.js        # tabs, account items, visibleItems(), ADMIN_USER
│   └── routes.jsx           # route tree, modal routes, legacy redirects
├── features/                # one folder per area, replacing pages/
│   ├── today/  money/{budget,split,stats,invest,forms}/  library/  hq/
│   ├── account/{settings,backstage,admin}/  auth/
├── context/                 # Auth, AppSettings, Year (unchanged) + Privacy (new)
├── api/                     # unchanged
└── utils/                   # unchanged business logic (expandDates, incomeMapping, …)
```

### 12.3 State

- **Client state:** contexts stay (`AuthContext`, `AppSettingsContext`,
  `YearContext`); add `PrivacyContext` and `ThemeContext`. No global store.
- **Server state:** **TanStack Query** (§12.1). Each feature exposes typed hooks
  (`useIncomes(year)`, `useExpenses(year)`, `useToggleExpense()`,
  `useSplitPayments()`, `useUpdateSplitSlots()`, …) built on the existing
  `api/*.js` functions; screens stay presentational.
  - Query keys per resource and year (`["expenses", 2026]`); mutations
    invalidate or patch the matching keys.
  - Optimistic updates for every action that is optimistic today (expense
    status, Split slots, deletes, income delete remap), with rollback on error.
  - `staleTime` ~30 s, refetch on window focus and reconnect.
  - Persisted to IndexedDB (cache buster = app version) so launch is instant
    and offline shows last-known data with the offline banner (§10.8).
  - Sign-out and 401 clear the cache and the persisted copy, so no figures
    stay on the device after signing out.
- Debounced auto-save (Split slots, HQ entries) stays as a 600 ms debounce in
  front of a mutation.

### 12.4 Shared header

`components/incomeHeader.js` (shared by Home and Dashboard today) becomes the
`PeriodHeader` component in `features/money/budget/`, used by both Today's
widget and the Budget card, preserving the "keep the two designs in sync"
requirement.

### 12.5 Charts

Keep Recharts. A `ChartFrame` wrapper supplies `ResponsiveContainer`, theme
colours from `useChartTheme`, axis defaults (caption1, secondary label, no tick
lines), the callout tooltip, and the accessible summary.

### 12.6 Dependencies

| Package | Why | Status |
|---|---|---|
| `typescript` (dev) | Typed component library and screens; `allowJs` for existing JS | Add |
| `@tanstack/react-query` | Server-state cache, optimistic mutations, refetch on focus (§12.3) | Add |
| `@tanstack/react-query-persist-client` + `idb-keyval` | Persist the cache to IndexedDB for instant / offline launch | Add |
| `react-aria-components` | Accessible, unstyled menus, dialogs, switches, tabs, calendar, touch handling (§12.1) | Add |
| `motion` | Springs, drag gestures, layout and exit animations (§12.1) | Add |
| `@fontsource-variable/inter` | Self-hosted Inter for non-Apple devices (§3.1) | Add (or vendor the `woff2` directly) |
| `@playwright/test` (dev) | Device-emulation tests for iPhone and Android (§13) | Add |

Not added: `vaul` (Motion covers sheets), `@floating-ui/react` (React Aria
positions its popovers), a global state library, a CSS framework.

**Bundle budget:** the initial JS for the app shell plus Today stays under
**200 KB gzipped**; Recharts is lazy-loaded with the screens that draw charts
(Stats, Invest, Library, HQ Overview), and `LazyMotion` loads animation
features on demand. CI fails the build if the budget is exceeded
(`rollup-plugin-visualizer` report + a size check).

### 12.7 Licensing notes

- Do **not** bundle SF Pro or SF Symbols. Their licence limits use to Apple
  platform apps; the system font stack already renders SF Pro on Apple devices
  without shipping it.
- The icon set is original artwork in a similar style.
- Inter is SIL Open Font Licence — free to self-host and bundle.
- Google Sign-In keeps Google's rendered button to stay within its branding
  rules.

---

## 13. Testing

- Page tests render inside a test `QueryClientProvider` (retries off, fresh
  client per test) and keep mocking the `api/*` modules as today.
- **Keep** all business-logic tests in `src/test/` unchanged (`expandDates`,
  `incomeMapping`, `dateValidation`, `formValidation`, `statistics`,
  `YearContext`).
- **Rewrite** page tests against the new screens with the same assertions of
  behaviour (they test logic through the DOM): Home/Today (13 + 23 split),
  Split (13), Investments (9), Dashboard/Budget (9), Statistics (7), Library
  (6), HQ (4). Assertions tied to old chrome — `MobileLayout.test.jsx` tab
  labels, the ⋮ Finance menu tests in `Dashboard.test.jsx`, duotone icon
  tests — are replaced by TabBar, segmented-control and nav-bar-action tests.
- **New component tests** for every `src/ui` primitive: keyboard and ARIA
  roles, `Sheet` focus trap and dismiss paths, `SwipeActions` two-step
  confirm, `PrivateValue` (hidden values absent from the DOM, hold releases on
  pointer-cancel and visibility change), `ThemeProvider` (auto follows
  `matchMedia`, legacy `appTheme` migration).
- **Replace `designTokens.test.js`** with a new guard:
  - hex / `rgb()` only in `src/theme/themes.css`;
  - no primitive tokens referenced outside `src/theme/`;
  - `border-radius`, `box-shadow`, `font-size` in CSS Modules only via tokens;
  - no inline `style` containing colour, radius or shadow literals.
- **Keep** `noZoom` (controls ≥ 16 px) and `appWidth` (430 px column)
  regressions, adapted to CSS Modules (assert computed styles).
- **Visual check:** render each screen in both themes with the stubbed preview
  recipe (no real credentials, fixtures only), screenshotted at three sizes:
  **360 × 780** (small Android), **393 × 852** (iPhone / Pixel), **430 × 932**
  (large iPhone); compare before merging each phase.
- **Cross-platform behaviour tests** (Playwright with device emulation, against
  the stubbed preview): iPhone 15 (WebKit) and Pixel 7 (Chromium) profiles.
  Cover: back closes the top sheet → then pops the screen → then returns to
  Today; back on a dirty form asks to discard; edge swipe works on iOS and is
  inactive on Android; keyboard does not cover the focused field; decimal input
  accepts `,` and `.`; long-press shows only the app's menu; `PrivateValue`
  hold re-masks on `pointercancel`.
- **Real-device pass** at the end of each phase: one iPhone (installed PWA),
  one Pixel or similar (installed via Chrome), one Samsung (Samsung Internet).
  A short checklist: install, launch splash, safe areas top and bottom,
  keyboard, back button, haptics, theme switching, offline banner.
- The 9 currently failing date-slot tests should be fixed (or rewritten)
  during Phase 4 since the slot UI is rebuilt anyway.

---

## 14. Implementation plan

Each phase ships to production on its own and leaves the app fully usable.
Every phase's exit criteria include the cross-platform checks in §13
(Playwright on iPhone and Pixel profiles, plus the real-device pass).
Screens are migrated one at a time behind the new shell; old screens render
inside the new shell until replaced.

| Phase | Scope | Exit criteria |
|---|---|---|
| **0. Foundations** | `src/theme/` (tokens, Light/Dark, ThemeProvider, migration of `appTheme`), CSS Modules setup, TypeScript (`allowJs`), TanStack Query client with IndexedDB persistence, bundle-size check, new design-token guard test, icon set, Inter font for non-Apple devices, `platform.js`, Playwright setup with iPhone and Pixel profiles | Both themes switch live; old screens still render (old tokens aliased to new ones temporarily); type renders the same on iPhone and Android |
| **1. Component library** | `src/ui/` primitives (§6) on React Aria Components and Motion, with tests; `PrivacyContext` + `PrivateValue` | Component tests green; preview page renders every primitive in both themes; **gesture review** of Sheet and SwipeActions on a real iPhone and Android phone — if they fall short, decide on the Ionic fallback here (§15) |
| **2. Shell and navigation** | `AppShell`, `TabBar`, `NavigationBar` with large title, Account sheet, route tree with legacy redirects, per-tab stacks, **overlay manager and history integration (§10.3)**, iOS-only edge swipe, safe areas, keyboard hook | All current routes reachable; old URLs redirect; Settings/Backstage/Admin gated as today; Android back behaves per §10.3 in Playwright and on a real device |
| **3. Money → Budget + forms** | Budget screen, period pager, `PeriodHeader`, budget bar, expense rows with swipe, Expense and Income `FormSheet`s, year menu, eye toggle, `+` menu | Parity rows A.2–A.4 ticked; `/add-expense`, `/add-income` redirect to sheets |
| **4. Today** | Four widgets, hold-to-reveal holdings, split slots, pull-to-refresh | Parity A.1 ticked; date-slot tests fixed |
| **5. Split, Stats, Invest** | Remaining Money segments | Parity A.5–A.7 |
| **6. Library and HQ** | Library with search + filter sheet; HQ chips, Overview, location entries, HQ Settings | Parity A.8–A.9; `Headquarters/Modal.jsx` and `styles.js` deleted |
| **7. Account screens and Login** | Settings, Backstage, Admin, Login | Parity A.10–A.13 |
| **8. Clean-up** | Delete `index.css` legacy tokens, `components/tokens.js`, `ui.jsx`, `TabIcons.jsx`, `navIcons.jsx`, `DateSheet.jsx`, `incomeHeader.js`, `TAB_ICON_COLORS` and the Dusk/Amber palette; update CLAUDE.md, README, Frontend_Setup, module requirement docs; PWA icons and splash screens | No references to removed files; docs describe the new UI; Lighthouse PWA and accessibility ≥ 95; install flow checked on iPhone, Android Chrome and Samsung Internet |

Rough size: phases 0–2 are the bulk of new code (~3–4 k lines); each screen
phase is mostly a rewrite of presentation around unchanged logic.

---

## 15. Open decisions

Defaults are chosen so implementation can start without answers; each can be
flipped cheaply.

| # | Decision | Default in this proposal |
|---|---|---|
| 1 | Tab names | Today · Money · Library · HQ (alternatives: Home · Finance · Books · HQ, as today) |
| 2 | Accent colour | iOS blue. Could be user-selectable later (tint token is one variable) |
| 3 | Dark theme base | True black `#000000` (OLED, iOS default). Alternative: elevated grey `#1C1C1E` canvas |
| 4 | Undo-on-delete toast | Informational only in v1; deferred delete with Undo as a follow-up |
| 5 | Extend privacy to budget-bar figures and Investments totals | No (mimics current behaviour) |
| 6 | Show/hide eye on Login password fields | Yes |
| 7 | Hide content in app switcher | Available, off by default |
| 8 | Investments chart range control (1Y / 3Y / All) | Included, default All |
| 9 | Pull-to-refresh | Included on Today, Budget, Library, HQ |
| 10 | Settings saves immediately (no Save button) | Yes |
| 11 | Look on Android | Same iPhone look as on iPhone (behaviour adapts, §10). Alternative: Material styling on Android — rejected by default, it doubles the design work |
| 12 | Font on non-Apple devices | Bundled Inter (~100 KB subset). Alternative: device font (Roboto etc.) — no download, but looks less like iPhone |
| 13 | Haptics | On where the platform allows (Android), with a Settings toggle |
| 14 | Install banner on Today | One-time, dismissible, only when not installed |
| 15 | TypeScript | New code in TypeScript, existing `utils/` and `api/` stay JS until touched |
| 16 | Fallback UI kit | Ionic React (iOS mode everywhere), only if the Phase 1 gesture review fails — would replace React Aria + Motion for overlays and lists |

---

## Appendix A — feature parity checklist

Every row must be ticked before the old implementation is removed.

**A.1 Today (Home Overview)**
- [ ] Current income = latest income with `date ≤ today`; header with date and name
- [ ] Lists expenses mapped to it that were outstanding at load; priority then date
- [ ] Tick/untick toggles Completed/Pending with optimistic update and revert on error
- [ ] Ticked rows stay struck through until next load
- [ ] Done / Pending totals for the whole period; both empty states
- [ ] Split: 3 newest open entries; exact slot count; amount typed / date via calendar; 600 ms debounce; settle confirm; cancel restores; View all link
- [ ] Holdings: latest snapshot per platform, EUR via stored FX; platforms > 0 in last 12 months; FX date; hold-to-reveal mask
- [ ] Library grid: persons alphabetical × types, latest entry per cell

**A.2 Budget**
- [ ] One period at a time; previous / next / back to current
- [ ] Year selection capped at current year, shared with Stats
- [ ] Income amount privacy toggle, persisted in `incomePrivacy`
- [ ] Budget bar: total, done, pending, free / over, minimum segment sizing
- [ ] Expense rows: status toggle, priority, ★ special tint, date, amount, edit, delete
- [ ] Add expense pre-filled for a period; edit income; delete income with optimistic remap
- [ ] Delete series member: this occurrence / entire series
- [ ] Returning from add/edit lands on the same period

**A.3 Expense form**
- [ ] Summary, amount > 0, date within current year, priority, status, special, repeat (frequency, end date required)
- [ ] Live mapped-income preview via `/expenses/resolve-income`
- [ ] Edit scope for series members: single (`isException`) vs future (`/series`)

**A.4 Income form**
- [ ] Summary, amount > 0, currency, date within current year, repeat
- [ ] Edit scope for series members

**A.5 Split**
- [ ] Header counts and per-currency left to cover
- [ ] In progress / Settled groups; expand defaults and per-card overrides
- [ ] Exact `occurrenceCount` slots; padding/trimming; full-count writes
- [ ] Cover rest (remainder to last slot), Clear all
- [ ] Settle confirm on last empty slot (typed, calendar, cover rest); cancel restores
- [ ] Create/edit sheet; Track by locked once filled; count change preserves values; delete with confirm

**A.6 Stats**
- [ ] Months with data; Avg free / month; Survival / month (`SURVIVAL_BASELINE`)
- [ ] High / Medium / Low averages
- [ ] Free per month chart; negative colour; now marker; zero line; future months blank; full breakdown on selection
- [ ] Special expenses list with total

**A.7 Invest**
- [ ] Total portfolio with FX date or "no FX rates set"; per-platform shares of `heldPlatforms`
- [ ] Evolution from `CHART_START`; carry-forward; Total + toggleable platforms (`activePlatforms`); operation dots; tooltip with ops and net cash
- [ ] Snapshots grouped by date, 3 at a time, show more / less; edit, delete; add platform to date
- [ ] Operations newest first, 3 at a time; notes; edit, delete
- [ ] Create/edit sheets; currency default per platform; snapshot edit keeps id

**A.8 Library**
- [ ] Per-person sections, alphabetical, Unassigned last; collapsible
- [ ] 12-month completion line chart per person (filtered entries), total
- [ ] Reveal 1 → +5; show N more / show N less
- [ ] Filters: person, type, source, rating, search; active count; clear
- [ ] Inline re-rating; create / edit / delete

**A.9 HQ**
- [ ] Overview with water-consumption chart and read-only lists
- [ ] Location entries per template; new entry; 600 ms auto-save; delete
- [ ] Computed Consum Apa Rece / Calda
- [ ] Locations CRUD (no delete while templates exist); templates CRUD with 1–30 typed parameters and units

**A.10 Settings** — [ ] theme choice; [ ] default income-amount visibility

**A.11 Backstage** — [ ] gated by `backstageEnabled`; [ ] 5 tables; [ ] search; [ ] 10 per page; [ ] row delete; [ ] last 50 API calls

**A.12 Admin** — [ ] gated by username (frontend) / `admin` group (API); [ ] 3 app-setting toggles; [ ] FX matrix + update; [ ] backup all tables to Drive with per-table progress; [ ] users list with counts; [ ] admin role toggle; [ ] delete user after password re-entry

**A.13 Shell and auth** — [ ] SRP sign-in; [ ] sign-up (when enabled) with password match; [ ] Google sign-in (when enabled); [ ] account menu with username and JWT countdown; [ ] sign out; [ ] 401 → sign out; [ ] route change closes menus/sheets appropriately; [ ] unknown paths → `/`; [ ] error boundary around routes; [ ] offline PWA

**A.14 Cross-platform** — [ ] same look on iPhone, Android Chrome and Samsung Internet at 360–430 px; [ ] Android back closes overlays, then pops screens, then returns to Today, then exits; [ ] back on a dirty form asks to discard; [ ] edge swipe on iOS only; [ ] keyboard never covers the focused field; [ ] decimal entry accepts `,` and `.`; [ ] install flow on each platform; [ ] safe areas on notch, home indicator and Android gesture bar; [ ] larger system text does not clip

---

## Appendix B — route map

| Current | New | Notes |
|---|---|---|
| `/` | `/` | Today |
| `/finance` | `/money` | Budget segment |
| `/add-expense` | `/money/expense/new` | Sheet over Budget; `?incomeId=&date=` kept |
| `/add-expense?id=X` | `/money/expense/X` | Edit sheet |
| `/add-income` | `/money/income/new` | Sheet |
| `/add-income?id=X` | `/money/income/X` | Edit sheet |
| `/split-payments` | `/money/split` | |
| `/statistics` | `/money/stats` | |
| `/investments` | `/money/invest` | |
| `/books-and-dev` | `/library` | |
| `/headquarters` | `/hq` | `/hq/:locationId`, `/hq/settings` added |
| `/settings` | `/settings` | Pushed from Account sheet |
| `/backstage` | `/backstage` | Gated |
| `/admin` | `/admin` | Gated |
| `*` | `/` | Unchanged |

Every "Current" path redirects with `replace`, preserving query strings, so
existing bookmarks and the installed PWA keep working.
