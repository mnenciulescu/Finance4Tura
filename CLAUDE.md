# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Finance4Tura is a personal budgeting web app. Incomes are received periodically, and expenses are mapped to the most recent income before their date. The UI shows income-period column cards (4 on desktop, 1 on mobile with swipe), each with its associated expenses and a summary footer.

**Current status**: All phases complete and deployed to AWS.

## Monorepo Structure

```
finance4tura/
├── frontend/        # React + Vite app (port 5173 locally)
├── backend/         # AWS SAM Lambda functions (port 3001 locally)
├── docker/          # DynamoDB Local Docker config (port 8000)
├── Documentation/   # AWS_Deploy.md, AWS_Sync.md, Requirements.md
└── README.md
```

## Development Commands

### Docker (DynamoDB Local)
```bash
cd docker
docker compose up -d                                           # Start DynamoDB Local
aws dynamodb list-tables --endpoint-url http://localhost:8000  # Verify
./init-tables.sh                                               # Bootstrap tables (first time only)
```

### Backend (AWS SAM)
```bash
cd backend
sam build --no-cached              # Build (always use --no-cached to pick up changes)
sam local start-api                # API Gateway on port 3001
sam build --no-cached && sam deploy  # Deploy to AWS (samconfig.toml has all defaults)
```

### Frontend (Vite + React)
```bash
cd frontend
npm run dev      # Dev server on port 5173
npm run build    # Production build
npm run lint     # Lint
```

### Deploy frontend to AWS
```bash
cd frontend && npm run build
aws s3 sync dist s3://finance4tura-frontend --region eu-central-1 --delete
aws cloudfront create-invalidation --distribution-id E1O9C9K6CO439 --paths "/*" --region us-east-1
```

## Architecture

### Backend
- **Runtime**: Node.js 20, AWS Lambda via AWS SAM (`backend/template.yaml`)
- **Database**: DynamoDB Local in Docker for dev; real AWS DynamoDB in production
- `DYNAMODB_ENDPOINT` env var controls which endpoint Lambda connects to
- All infrastructure defined in `template.yaml`; deploy config in `samconfig.toml`
- `userId` extracted in every handler: `event.requestContext?.authorizer?.claims?.sub ?? "local-dev"`

### Frontend
- React 19 + Vite inside `frontend/`
- Dependencies: `axios`, `react-router-dom`, `dayjs`, `recharts`, `amazon-cognito-identity-js`
- Responsive: `useIsMobile` hook switches between desktop (Sidebar) and mobile (MobileLayout)
- Split Payments module (`/split-payments`) is desktop-only; data stored in `localStorage` (`split_payments_v1`)
- PWA: `vite-plugin-pwa`, service worker, offline support
- `vite.config.js` requires `define: { global: 'globalThis' }` for `amazon-cognito-identity-js`

### Authentication
- **Username/password**: `amazon-cognito-identity-js` → Cognito User Pool
- **Google Sign-In**: GIS popup → `POST /auth/google` (public Lambda) → Cognito JWT
- JWT stored in localStorage; axios interceptor injects `Authorization: <token>` on every request
- `AuthContext` provides: `user`, `loading`, `signIn`, `signUp`, `signInWithGoogle`, `signOut`

### Database Schema

**Incomes** table (PK: `incomeId`):
- `userId`, `seriesId`, `summary`, `date`, `amount`, `currency`
- `isRepeatable`, `repeatFrequency` (`daily`|`weekly`|`monthly`), `seriesEndDate`
- `isException: true` when overriding a single occurrence in a series
- GSI: `date-index` on `date`

**Expenses** table (PK: `expenseId`):
- Same series fields as Incomes
- `priority`: `High`|`Medium`|`Low`; `status`: `Pending`|`Completed`
- `special`: Boolean, default `false` — flags the expense as special; shown with ★ icon and red row background on Dashboard
- `mappedIncomeId`, `mappedIncomeSummary`, `mappedIncomeDate` — denormalized from Incomes
- GSI: `date-index` on `date`

### Key Business Logic

**Repeating events**: Expanded into individual DynamoDB records at creation time. All occurrences share a `seriesId`.

**Income auto-mapping**: `resolveIncome(expenseDate, userId)` queries Incomes where `date <= expenseDate` and returns the one with the latest date. Applied per-occurrence for repeating expenses.

**Edit series behavior**: Editing a single occurrence sets `isException=true` on that record only. The `/series` endpoint handles bulk future updates.

**Google Sign-In flow**: Google ID token → `verifyGoogleToken` (tokeninfo API) → `AdminGetUser` / `AdminCreateUser` + `AdminSetUserPassword` → `AdminInitiateAuth` → Cognito JWT returned.

## API Endpoints

```
POST   /auth/google                         # Google Sign-In (no auth required)
GET    /health

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
```

## AWS Infrastructure

| Resource | Value |
|---|---|
| CloudFormation stack | `finance4tura-backend` |
| API Gateway | `https://2t55twyqmh.execute-api.eu-central-1.amazonaws.com/Prod` |
| S3 bucket | `finance4tura-frontend` |
| CloudFront | `E1O9C9K6CO439` (`d34ylrmixnmvem.cloudfront.net`) |
| Cognito User Pool | `eu-central-1_CD7AdBFwQ` · Client: `2nh5dljhrg9mq7nsmdg7cef21v` |
| Region | `eu-central-1` |

## Design Decisions

| Decision | Choice |
|----------|--------|
| Repeating events | Expand to individual records at write time |
| Income mapping | Denormalized on Expense record for fast rendering |
| Local DB | DynamoDB Local (Docker) — identical API to AWS |
| Frontend | React + Vite (S3/CloudFront compatible), PWA |
| API | AWS SAM Lambda (`sam local` mirrors production) |
| Auth | Cognito User Pool + GIS Google Sign-In via custom Lambda |
| Cache-Control | `no-store` on all Lambda responses (prevents API Gateway CloudFront caching) |
