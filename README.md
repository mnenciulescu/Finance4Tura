# Finance4Tura

Personal budgeting web app. Incomes are received periodically; expenses are mapped to the most recent income before their date. The UI shows income-period column cards, each with its associated expenses and a summary footer.

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

Sign in using the Demo account (`demo` / `Demo12`) or create a new account from the login screen.

> **Note:** Local dev uses DynamoDB Local (Docker), which is a separate database from the cloud. Data added locally stays local. The `sam local start-api` fallback userId is `"local-dev"`.

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
│   │   ├── api/             # axios client + API modules
│   │   ├── components/      # Layout, Sidebar, IncomeCard
│   │   ├── context/         # AuthContext (Cognito)
│   │   └── pages/           # Dashboard, AddIncome, AddExpense, Statistics, Backstage, Login
│   ├── .env.local           # Local dev env vars
│   └── .env.production      # Cloud env vars
├── backend/         # AWS SAM Lambda functions (port 3001 locally)
│   ├── template.yaml        # SAM/CloudFormation stack
│   ├── samconfig.toml       # Deploy defaults (stack: finance4tura-backend)
│   └── src/handlers/
│       ├── health.mjs
│       ├── incomes.mjs
│       ├── expenses.mjs
│       └── preSignUp.mjs    # Cognito auto-confirm trigger
├── docker/
│   ├── docker-compose.yml   # DynamoDB Local (port 8000)
│   └── init-tables.sh
└── Documentation/
    ├── AWS_Deploy.md        # One-time cloud setup guide
    └── AWS_Sync.md          # Ongoing deploy reference
```

## Environment Variables

### Frontend

| Variable | File | Value |
|----------|------|-------|
| `VITE_API_BASE_URL` | `.env.local` | `http://localhost:3001` |
| `VITE_API_BASE_URL` | `.env.production` | `https://2t55twyqmh.execute-api.eu-central-1.amazonaws.com/Prod` |
| `VITE_COGNITO_USER_POOL_ID` | both | `eu-central-1_CD7AdBFwQ` |
| `VITE_COGNITO_CLIENT_ID` | both | `2nh5dljhrg9mq7nsmdg7cef21v` |
| `VITE_COGNITO_REGION` | both | `eu-central-1` |

### Backend

| Variable | Description |
|----------|-------------|
| `DYNAMODB_ENDPOINT` | Override DynamoDB URL. Set to `http://host.docker.internal:8000` locally; omit in production. |

## Authentication

Authentication uses **AWS Cognito** (User Pool `eu-central-1_CD7AdBFwQ`).

- **Sign up**: New accounts are auto-confirmed via a Pre Sign-Up Lambda trigger. Each user gets a fully isolated database view (all records filtered by Cognito `sub`).
- **Sign in**: Tokens are stored by `amazon-cognito-identity-js` in localStorage. The JWT ID token is sent as `Authorization: <token>` on every API request.
- **Local dev**: `sam local start-api` does not enforce the Cognito authorizer. The Lambda falls back to `userId = "local-dev"`.

## AWS Infrastructure

| Resource | Value |
|---|---|
| CloudFormation stack | `finance4tura-backend` |
| API Gateway URL | `https://2t55twyqmh.execute-api.eu-central-1.amazonaws.com/Prod` |
| S3 bucket | `finance4tura-frontend` |
| CloudFront distribution | `E1O9C9K6CO439` (`d34ylrmixnmvem.cloudfront.net`) |
| Cognito User Pool | `eu-central-1_CD7AdBFwQ` |
| AWS Region | `eu-central-1` |

## Implementation Phases

| Phase | Focus | Status |
|-------|-------|--------|
| 0 | Project scaffold (Docker, SAM, React, health check) | ✅ |
| 1 | DynamoDB table creation | ✅ |
| 2 | Backend Income CRUD | ✅ |
| 3 | Backend Expense CRUD + resolveIncome auto-mapping | ✅ |
| 4 | Frontend layout, routing, column card shells | ✅ |
| 5 | Add/Edit Income form | ✅ |
| 6 | Add/Edit Expense form + income mapping preview | ✅ |
| 7 | Column cards wired to live API | ✅ |
| 8 | Statistics panel (Recharts) | ✅ |
| 9 | AWS cloud portability (Cognito auth, S3/CloudFront, per-user data isolation) | ✅ |
