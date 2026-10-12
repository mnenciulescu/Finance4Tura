# 4TURA Home — Frontend

React 19 + Vite progressive web app. Mobile-only: every page is a centred phone-width column (430 px), whatever the screen.

## Development

```bash
npm install
npm run dev      # http://localhost:5173 — uses the deployed API and production data
npm test         # Vitest, single run (npm run test:watch to watch)
npm run lint
npm run build    # production build → dist/
```

There is no local backend. Anything you do in a dev session changes real data.

## Environment Variables

| File | Used for |
|------|----------|
| `.env.production` | Production build |
| `.env.local` | `npm run dev` — same values as production |

Both hold `VITE_API_BASE_URL`, `VITE_COGNITO_USER_POOL_ID`, `VITE_COGNITO_CLIENT_ID`, `VITE_COGNITO_REGION` and `VITE_GOOGLE_CLIENT_ID`.

## Project Structure

```
src/
├── api/                    # one module per backend area
│   ├── client.js           # axios instance, auth header, 401 → sign out, opLog (last 50 calls)
│   ├── incomes.js, expenses.js, splitPayments.js, investments.js, fxRates.js
│   ├── booksAndDev.js, headquarters.js
│   └── appSettings.js, admin.js, adminBackup.js
├── components/
│   ├── Layout.jsx          # passthrough to MobileLayout
│   ├── MobileLayout.jsx    # top bar, avatar menu, bottom bar
│   ├── navConfig.js        # navGroups (tabs), financeItems (Dashboard menu), accountItems (avatar menu), ADMIN_USER
│   ├── TabIcons.jsx        # full-colour bottom-bar icons (palette: TAB_ICON_COLORS)
│   ├── navIcons.jsx        # line icons for the Finance and account menus
│   ├── IncomeCard.jsx      # income-period card on the Dashboard
│   ├── DateSheet.jsx       # the app's calendar sheet (Monday first, with Clear)
│   ├── ui.jsx              # shared primitives: Card, Sheet, Button, Pill, StatTile, …
│   ├── tokens.js           # design tokens as strings (T, TYPE) for inline styles
│   ├── Field.jsx
│   └── ErrorBoundary.jsx
├── context/
│   ├── AuthContext.jsx     # Cognito + Google sign-in, session restore, verifyPassword
│   ├── AppSettingsContext.jsx  # global toggles from GET /app-settings
│   └── YearContext.jsx     # selected year, shared by Dashboard and Statistics
├── pages/
│   ├── HomeOverview.jsx    # /
│   ├── Dashboard.jsx       # /finance
│   ├── AddIncome.jsx, AddExpense.jsx
│   ├── SplitPayment.jsx, Statistics.jsx, Investments.jsx
│   ├── BooksAndDev.jsx     # /books-and-dev
│   ├── Headquarters/       # /headquarters — tabs, entry table, modals
│   ├── Settings.jsx, Backstage.jsx, Admin.jsx
│   └── Login.jsx
├── test/                   # util tests and build-guard regressions
├── utils/colors.js         # categorical colours — the only file allowed raw hex
├── index.css               # design tokens and themes
├── App.jsx                 # routes, providers, ErrorBoundary
└── main.jsx                # theme resolver, root render
```

## Navigation

### Bottom bar
**Home · Finance · Books · HQ**

- **Home** → `/` (Home Overview)
- **Finance** → `/finance` (Dashboard), back on the current income. Highlighted on every Finance page.

The other Finance pages are in the **⋮ Finance menu** on the Dashboard header: Dashboard, Add Income, Add Expense, Split Pay, Statistics, Investments, then Show / Hide income amounts.
- **Books** → `/books-and-dev`
- **HQ** → `/headquarters`

### Avatar menu (initials, top right)
Username and session countdown, then **Settings · Admin · Sign out**.

- **Backstage** appears between Settings and Admin while Admin → App Settings → Backstage is on.
- **Admin** appears only for `ADMIN_USER` (`nenciulescu`). The `/admin` route redirects anyone else to `/`.

All three lists are data in `navConfig.js`; `visibleItems()` applies the Backstage and Admin gates. A route change closes the account menu.

## Authentication

Uses `amazon-cognito-identity-js` (SRP). The library keeps the session in `localStorage`; on load `AuthContext` restores it and passes the ID token to `api/client.js`, whose interceptor sends `Authorization: <token>` on every request. A 401 signs the user out — there is no token refresh.

Google Sign-In uses a GIS popup and `POST /auth/google`. The login page hides the Google button and the Create account option when they're switched off in App Settings.

`vite.config.js` includes `define: { global: 'globalThis' }` — required for the Cognito library to work in the browser.

## Conventions

- **Design tokens only.** Colours, radii, shadows, spacing and type come from CSS variables in `index.css` (or `tokens.js` for inline shorthand). `src/test/designTokens.test.js` fails the build on a raw value elsewhere; categorical colours live in `utils/colors.js`.
- **16 px form controls** so iOS doesn't zoom on focus (`noZoom.test.jsx` guards it). The Add forms use `.zoom-safe-form`.
- **Width**: pages cap at `var(--app-max-w)` (430 px); `appWidth.test.jsx` guards it.
- **Bottom sheets** for add/edit forms; **two-step inline delete** (`Delete` → `Tap to confirm`, 4 s) instead of `window.confirm`.
- **Don't mix shorthand and longhand** CSS properties across style objects that get spread together (e.g. `border` vs `borderColor`); React warns and the result depends on order.

## Tests

Vitest + Testing Library, `jsdom`. 215 tests: util and context tests in `src/test/`, render tests next to each page and component, against mocked API modules. See CLAUDE.md for the breakdown and the currently failing date-slot tests.

## Deploying

See `AWS_Sync.md`.
