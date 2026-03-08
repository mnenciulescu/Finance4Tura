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
│   ├── client.js        # axios instance, auth interceptor, operation log
│   ├── incomes.js
│   └── expenses.js
├── components/
│   ├── Layout.jsx        # app shell
│   ├── Sidebar.jsx       # navigation + sign-out
│   └── IncomeCard.jsx    # income period column card
├── context/
│   └── AuthContext.jsx   # Cognito auth (sign in, sign up, sign out, session restore)
└── pages/
    ├── Login.jsx
    ├── Dashboard.jsx
    ├── AddIncome.jsx
    ├── AddExpense.jsx
    ├── Statistics.jsx
    └── Backstage.jsx     # database viewer + operation log
```

## Authentication

Uses `amazon-cognito-identity-js`. The JWT ID token is stored in localStorage by the library and injected as an `Authorization` header on every API request via an axios interceptor.

`vite.config.js` includes `define: { global: 'globalThis' }` — required for the Cognito library to work in the browser.

## Deploying to Cloud

See `../Documentation/AWS_Sync.md`.
