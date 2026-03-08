# Finance4Tura

Personal budgeting web app. Incomes are received periodically; expenses are automatically mapped to the most recent income before their date. The UI shows income-period column cards, each with its associated expenses and a summary footer.

## Live App

| Environment | URL |
|---|---|
| Production | `https://d34ylrmixnmvem.cloudfront.net` |
| Local frontend | `http://localhost:5173` |
| Local API | `http://localhost:3001` |

## Quick Start (Local Development)

### 1. DynamoDB Local (Docker)

```bash
cd docker
docker compose up -d
# Verify running:
aws dynamodb list-tables --endpoint-url http://localhost:8000
# Bootstrap tables (first time only):
./init-tables.sh
```

### 2. Backend (AWS SAM)

```bash
cd backend
sam build
sam local start-api   # API Gateway on http://localhost:3001
# Health check:
curl http://localhost:3001/health
```

### 3. Frontend (Vite + React)

```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

Sign in using the Demo account (`demo` / `Demo12`), create a new account, or use **Continue with Google**.

> **Note:** Local dev uses DynamoDB Local (Docker), separate from the cloud database. The `sam local start-api` fallback userId is `"local-dev"`.

## Development Commands

| Task | Command |
|------|---------|
| Start DynamoDB | `cd docker && docker compose up -d` |
| Bootstrap tables | `cd docker && ./init-tables.sh` |
| Build backend | `cd backend && sam build --no-cached` |
| Start API locally | `cd backend && sam local start-api` |
| Deploy backend | `cd backend && sam build --no-cached && sam deploy` |
| Start frontend | `cd frontend && npm run dev` |
| Build frontend | `cd frontend && npm run build` |
| Deploy frontend | See `Documentation/AWS_Sync.md` |

## Architecture

```
finance4tura/
├── frontend/        # React + Vite (port 5173 locally)
│   ├── src/
│   │   ├── api/             # axios client + API modules (incomes, expenses)
│   │   ├── components/      # Layout, Sidebar, MobileLayout, IncomeCard
│   │   ├── context/         # AuthContext (Cognito + Google Sign-In)
│   │   ├── hooks/           # useIsMobile
│   │   └── pages/           # Dashboard, AddIncome, AddExpense, Statistics, Settings, Backstage, Login
│   ├── .env.local           # Local dev env vars
│   └── .env.production      # Cloud env vars
├── backend/         # AWS SAM Lambda functions (port 3001 locally)
│   ├── template.yaml        # SAM/CloudFormation stack
│   ├── samconfig.toml       # Deploy defaults (stack: finance4tura-backend)
│   └── src/
│       ├── handlers/
│       │   ├── health.mjs         # GET /health
│       │   ├── incomes.mjs        # Income CRUD
│       │   ├── expenses.mjs       # Expense CRUD + resolveIncome
│       │   ├── googleAuth.mjs     # POST /auth/google (Google Sign-In)
│       │   └── preSignUp.mjs      # Cognito auto-confirm trigger
│       └── lib/
│           ├── dynamo.mjs         # DynamoDB client
│           └── expandDates.mjs    # Recurring date expansion
├── docker/
│   ├── docker-compose.yml   # DynamoDB Local (port 8000)
│   └── init-tables.sh
└── Documentation/
    ├── AWS_Deploy.md        # One-time cloud setup guide
    ├── AWS_Sync.md          # Ongoing deploy reference
    ├── Requirements.md      # Full requirements and phase specs
    └── Frontend_Setup.md    # Frontend scaffold notes
```

## Environment Variables

### Frontend (`frontend/.env.local` / `frontend/.env.production`)

| Variable | Local | Production |
|----------|-------|------------|
| `VITE_API_BASE_URL` | `http://localhost:3001` | `https://2t55twyqmh.execute-api.eu-central-1.amazonaws.com/Prod` |
| `VITE_COGNITO_USER_POOL_ID` | `eu-central-1_CD7AdBFwQ` | same |
| `VITE_COGNITO_CLIENT_ID` | `2nh5dljhrg9mq7nsmdg7cef21v` | same |
| `VITE_COGNITO_REGION` | `eu-central-1` | same |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth Client ID | same |

### Backend

| Variable | Description |
|----------|-------------|
| `DYNAMODB_ENDPOINT` | Override DynamoDB URL. Set to `http://host.docker.internal:8000` locally; omit in production. |

## Authentication

Authentication uses **AWS Cognito** (User Pool `eu-central-1_CD7AdBFwQ`) with two sign-in methods:

### Username & Password
New accounts are auto-confirmed via a Pre Sign-Up Lambda trigger — no email verification required. Each user gets a fully isolated database view (all records filtered by Cognito `sub`).

### Google Sign-In
Uses Google Identity Services (GIS) embedded popup — no redirect. Flow:
1. User clicks "Continue with Google" → Google popup appears
2. Google returns a signed ID token to the browser
3. Frontend POSTs the token to `POST /auth/google` (public Lambda, no Cognito authorizer)
4. Lambda verifies the token, auto-creates a Cognito account on first sign-in, and returns Cognito JWT tokens
5. App session established — identical to username/password sign-in

Google accounts use the username format `google_{googleSub}` in Cognito.

### Token handling
JWT ID token is stored by `amazon-cognito-identity-js` in localStorage. The axios interceptor injects `Authorization: <token>` on every API request.

> **Local dev:** `sam local start-api` does not enforce the Cognito authorizer. Lambda falls back to `userId = "local-dev"`.

## AWS Infrastructure

| Resource | Value |
|---|---|
| CloudFormation stack | `finance4tura-backend` |
| API Gateway URL | `https://2t55twyqmh.execute-api.eu-central-1.amazonaws.com/Prod` |
| S3 bucket | `finance4tura-frontend` |
| CloudFront distribution | `E1O9C9K6CO439` (`d34ylrmixnmvem.cloudfront.net`) |
| Cognito User Pool | `eu-central-1_CD7AdBFwQ` · App Client: `2nh5dljhrg9mq7nsmdg7cef21v` |
| Google OAuth Client | `887159107424-2g02147g1s2lvhanbjnl1i3u68okskr1.apps.googleusercontent.com` |
| AWS Region | `eu-central-1` |

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | Cognito | Health check |
| `POST` | `/auth/google` | None | Google Sign-In token exchange |
| `POST` | `/incomes` | Cognito | Create income (single or recurring) |
| `GET` | `/incomes` | Cognito | List incomes (`?from=&to=`) |
| `GET` | `/incomes/{id}` | Cognito | Get single income |
| `PUT` | `/incomes/{id}` | Cognito | Edit single occurrence |
| `PUT` | `/incomes/{id}/series` | Cognito | Edit all future occurrences |
| `DELETE` | `/incomes/{id}` | Cognito | Delete (`?deleteSeries=true` for series) |
| `POST` | `/expenses` | Cognito | Create expense (auto-maps to income) |
| `GET` | `/expenses` | Cognito | List expenses (`?from=&to=`) |
| `GET` | `/expenses/{id}` | Cognito | Get single expense |
| `PUT` | `/expenses/{id}` | Cognito | Edit single occurrence |
| `PUT` | `/expenses/{id}/series` | Cognito | Edit all future occurrences |
| `DELETE` | `/expenses/{id}` | Cognito | Delete (`?deleteSeries=true` for series) |
| `GET` | `/expenses/resolve-income` | Cognito | Preview income mapping for `?date=` |

## Implementation Phases

| Phase | Focus | Status |
|-------|-------|--------|
| 0 | Project scaffold (Docker, SAM, React, health check) | ✅ |
| 1 | DynamoDB table schema | ✅ |
| 2 | Backend Income CRUD | ✅ |
| 3 | Backend Expense CRUD + resolveIncome auto-mapping | ✅ |
| 4 | Frontend layout, routing, column card shells | ✅ |
| 5 | Add/Edit Income form | ✅ |
| 6 | Add/Edit Expense form + income mapping preview | ✅ |
| 7 | Column cards wired to live API | ✅ |
| 8 | Statistics panel (Recharts) | ✅ |
| 9 | AWS cloud deployment — Cognito auth, S3/CloudFront, Google Sign-In, PWA | ✅ |
