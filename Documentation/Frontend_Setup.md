# Finance4Tura — Frontend

React + Vite single-page application for personal budgeting.

## Development

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build → dist/
npm run lint
```

## Environment Variables

| File | Used for |
|------|----------|
| `.env.local` | Local development (API on localhost:3001) |
| `.env.production` | Cloud build (AWS API Gateway + Cognito) |

## Project Structure

```
src/
├── api/
│   ├── client.js          # axios instance, auth interceptor
│   ├── incomes.js
│   ├── expenses.js
│   ├── splitPayments.js
│   └── investments.js
├── components/
│   ├── Layout.jsx          # app shell (renders Topbar/MobileLayout)
│   ├── Sidebar.jsx         # desktop top navigation bar (despite the filename, this is a horizontal Topbar)
│   └── IncomeCard.jsx      # income period column card
├── context/
│   ├── AuthContext.jsx     # Cognito auth (sign in, sign up, sign out, session restore)
│   └── YearContext.jsx     # selected year filter, shared across pages
├── hooks/
│   └── useIsMobile.js      # returns true when viewport width < 768px
└── pages/
    ├── Login.jsx
    ├── Dashboard.jsx
    ├── AddIncome.jsx
    ├── AddExpense.jsx
    ├── Statistics.jsx
    ├── Settings.jsx
    ├── Backstage.jsx       # database viewer + operation log
    ├── SplitPayment.jsx    # split payment tracker (desktop only)
    ├── Investments.jsx     # investment portfolio tracker (desktop only)
    ├── AiNews.jsx          # AI-curated financial news feed
    └── Admin.jsx           # admin panel (admin users only)
```

## Navigation

### Desktop (Topbar — horizontal bar at the top)
Logo/Dashboard · Add Income · Add Expense · Split Pay · Investments · Statistics · AI · Settings · Backstage · Admin (admin only)

### Mobile (bottom tab bar)
Dashboard · Add Income · Add Expense · Statistics · Settings

Split Pay and Investments are **desktop-only** and do not appear in the mobile tab bar.

## Authentication

Uses `amazon-cognito-identity-js`. The JWT ID token is stored in localStorage by the library and injected as an `Authorization` header on every API request via an axios interceptor.

`vite.config.js` includes `define: { global: 'globalThis' }` — required for the Cognito library to work in the browser.

## Deploying to Cloud

See `../Documentation/AWS_Sync.md`.
