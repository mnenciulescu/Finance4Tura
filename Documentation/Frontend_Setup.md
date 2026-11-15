# 4TURA Home — Frontend

React 19 + Vite + TypeScript progressive web app with an Apple-style design
that feels like an iPhone app on every phone and behaves natively on each.
Mobile-first: every PWA page is a centred phone-width column (430 px), whatever
the screen. The exception is **One-Page** (`/one-page`), a desktop dashboard with
Money, Library and HQ on one screen (`OnePage_Desktop_Proposal.md`). The design brief is `Frontend_Redesign_Proposal.md`; `CLAUDE.md`
describes what is implemented, screen by screen.

## Development

```bash
npm install
npm run dev        # http://localhost:5173 — uses the deployed API and production data
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint (JS + TS)
npm test           # Vitest, single run (npm run test:watch to watch)
npm run test:e2e   # Playwright: iPhone 15 (WebKit) + Pixel 7 (Chrome); One-Page on desktop Chrome + desktop WebKit
npm run build      # production build → dist/
npm run check      # all of the above except e2e, plus the bundle budget
```

There is no local backend. Anything you do in a dev session changes real data.
The Playwright suite does **not** touch AWS: it builds the app from
`e2e/harness/` with Cognito stubbed and every API call answered from invented
fixtures. First run: `npx playwright install webkit`.

## Environment Variables

| File | Used for |
|------|----------|
| `.env.production` | Production build |
| `.env.local` | `npm run dev` — same values as production |

Both hold `VITE_API_BASE_URL`, `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`, `VITE_COGNITO_REGION` and `VITE_GOOGLE_CLIENT_ID`.

## Stack

| Layer | Choice |
|---|---|
| UI | React 19, React Router 7 |
| Language | TypeScript for new code; `api/` stays JavaScript (`allowJs`) |
| Server state | TanStack Query, persisted to IndexedDB (`idb-keyval`) |
| Behaviour / accessibility | React Aria Components (+ `react-aria` for long press) |
| Gestures / animation | Motion (`LazyMotion`, features loaded on demand) |
| Styling | CSS Modules + design tokens in `src/theme/` |
| Charts | Recharts, lazy-loaded with the screens that draw them |
| Auth | `amazon-cognito-identity-js` (SRP) + Google Identity Services |
| PWA | `vite-plugin-pwa` (Workbox), `registerType: "prompt"` |
| Fonts | System font on Apple devices; `@fontsource-variable/inter` elsewhere |

## Project Structure

```
src/
├── theme/        # tokens.css, themes.css (only raw colours), base.css, themes.ts, ThemeProvider, domainColors, useChartTheme
├── ui/           # component library: List, Sheet/FormSheet, ActionSheet, Alert, Menu, SwipeActions,
│                 # Segmented, Toggle, Checkbox, Stepper, Fields, SearchField, Picker, Rating,
│                 # DatePicker (+ lazy CalendarBody), Display, Toast, PrivateValue, icons/
├── app/          # AppShell, TabBar, Screen (large title), AccountSheet, routes, navigation,
│                 # tabHistory, overlays (history/back), queryClient, platform, haptics, install,
│                 # useKeyboardInset, usePullToRefresh, UpdatePrompt, ErrorBoundary
├── features/
│   ├── today/            # /
│   ├── money/            # /money (budget), /money/split, /money/stats, /money/invest, forms/
│   ├── library/          # /library
│   ├── hq/               # /hq, /hq/:locationId, /hq/settings
│   ├── account/          # /settings, /backstage, /admin
│   ├── auth/             # Login
│   └── one-page/         # /one-page — desktop dashboard (header, blocks/, state, shortcuts)
├── data/         # queries.ts (reads), mutations.ts (writes), hq.ts
├── context/      # Auth, AppSettings, Year, Privacy
├── api/          # one module per backend area (unchanged)
├── utils/        # format, money, split, parseAmount
├── test/         # setup, render helper, logic tests, build guards
├── App.tsx       # providers, auth gate
└── main.tsx      # fonts, styles, install-prompt capture
e2e/              # Playwright specs + harness (stubbed Cognito, fixture API)
scripts/          # check-bundle.mjs, generate-pwa-assets.mjs
public/           # icons (any, maskable, monochrome, Apple touch), splash/ (iPhone launch screens)
```

## Navigation

- **Tab bar**: Today · Money · Library · HQ. Each tab keeps its last screen
  and scroll position; tapping the selected tab pops to its root.
- **Money**: segmented control Budget · Split · Stats · Invest.
- **Account sheet** (initials avatar, top right): username, session
  countdown, Settings, Backstage (while enabled), Admin (`nenciulescu`),
  Sign Out.
- **Back**: every overlay is a history entry, so Android's back closes the top
  sheet or menu first, then pops a pushed screen, then returns to Today, then
  leaves the app. iPhone gets an edge swipe on pushed screens instead.
- Old URLs (`/finance`, `/add-expense`, `/books-and-dev`, …) redirect.
- **One-Page** (`/one-page`): outside the phone shell. `LayoutContext` =
  `"desk"` makes `Sheet`/`FormSheet` centred dialogs, `ActionSheet` an alert
  and `SwipeActions` hover buttons (`ui/DeskOverlays.tsx`, lazy). Tab and
  period state live in the URL query (replaced, not pushed). Reached from the
  Account sheet on screens ≥ 1024 px or via Settings → Desktop.

## Themes

Light and Dark (iOS system colours) plus Automatic, stored as `uiTheme`.
`index.html` applies the theme and platform before first paint. To add a
theme: one `[data-theme="x"]` block in `src/theme/themes.css` and one entry in
`src/theme/themes.ts`.

## Authentication

Uses `amazon-cognito-identity-js` (SRP). The library keeps the session in
`localStorage`; on load `AuthContext` restores it and passes the ID token to
`api/client.js`, whose interceptor sends `Authorization: <token>` on every
request. A 401 signs the user out; signing out clears the query cache and its
IndexedDB copy. There is no token refresh.

Google Sign-In uses a GIS popup and `POST /auth/google`. The login screen
hides the Google button and Create account when they're switched off in App
Settings.

`vite.config.js` includes `define: { global: 'globalThis' }` — required for the
Cognito library to work in the browser.

## Conventions

- **Tokens only.** Colours, radii, shadows and type come from `src/theme/`.
  `src/test/guards.test.ts` fails the build on a raw value elsewhere.
- **Form controls ≥ 16 px** (`--fs-control`), so iOS never zooms on focus.
  Pinch zoom stays enabled.
- **No native date inputs** — use `DateField` / `DatePickerSheet` / `MonthField`.
- **Amounts** go through `parseAmount()` (accepts `,` and `.`).
- **Create/edit in sheets**, **delete in two steps** (swipe arms, second tap
  confirms; menus confirm with an action sheet).
- **Behaviour may depend on the platform, appearance may not.**
- **Bundle budget**: initial JavaScript ≤ 200 KB gzipped; One-Page adds
  ≤ 150 KB (`npm run check:bundle`). Keep new screens lazy, and mark top-level
  `lazy()` in shared modules `/* @__PURE__ */` so unused modules stay out of
  the entry.
- **One-Page reuses, never copies**: shared content lives in panels
  (`InvestPanels`, `StatsPanels`, `SplitCard`, `BookCard`, `ReadList`,
  `HqSettingsContent`, `useBudgetDeletes`) used by both layouts.

## Tests

- **Vitest + Testing Library** (jsdom): 251 tests — logic, build guards, the
  component library, every screen and One-Page against mocked API modules.
  Tests run at phone width (390 px) unless they widen the window.
- **Playwright**: 26 tests on an iPhone (WebKit) and a Pixel (Chrome) profile
  — back navigation, discard prompt, edge swipe, long-press menus,
  hold-to-reveal, comma decimals, no horizontal overflow at 360/393/430 px in
  both themes. `e2e/onepage.spec.ts`: 17 One-Page tests on desktop Chrome
  (1440 px) and desktop WebKit (1280 px).

## PWA assets

`node scripts/generate-pwa-assets.mjs` re-renders the icons and the 20 iPhone
launch screens (Light/Dark) from SVG and rewrites the
`apple-touch-startup-image` links in `index.html`.

## Deploying

See `AWS_Sync.md`.
