# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Finance4Tura is a personal budgeting web app. Incomes are received periodically, and expenses are mapped to the most recent income before their date. The UI shows 6 income-period column cards, each with its associated expenses and a summary footer.

**Current status**: Pre-implementation (Phase 0). Only requirements and design assets exist. Follow phases sequentially and validate tests before proceeding to the next phase.

## Intended Monorepo Structure

```
finance4tura/
├── frontend/        # React + Vite app (port 3000)
├── backend/         # AWS SAM Lambda functions (port 3001)
├── docker/          # DynamoDB Local Docker config (port 8000)
└── README.md
```

## Development Commands

### Docker (DynamoDB Local)
```bash
docker compose up -d                                           # Start DynamoDB Local
aws dynamodb list-tables --endpoint-url http://localhost:8000  # Verify DynamoDB running
docker/init-tables.sh                                          # Bootstrap tables
```

### Backend (AWS SAM)
```bash
sam build                             # Build Lambda functions
sam local start-api                   # Start local API Gateway on port 3001
sam build && sam deploy --guided      # First-time deploy to AWS
```

### Frontend (Vite + React)
```bash
npm run dev      # Start dev server on port 3000
npm run build    # Production build
npm run lint     # Lint
npm run test     # Run tests
```

## Architecture

### Backend
- **Runtime**: AWS Lambda via AWS SAM (`backend/template.yaml`)
- **Database**: DynamoDB Local in Docker for dev; real AWS DynamoDB in production
- `DYNAMODB_ENDPOINT` env var controls which endpoint Lambda connects to (set to `http://localhost:8000` locally, omitted in production)
- All infrastructure (tables, Lambda, API Gateway, IAM roles) defined in `template.yaml`

### Frontend
- React + Vite scaffolded inside `frontend/`
- Dependencies: `axios`, `react-router-dom`, `dayjs`, `recharts`
- `frontend/.env.local` sets `VITE_API_BASE_URL=http://localhost:3001`
- Routes: `/`, `/add-income`, `/add-expense`, `/statistics`
- `AuthContext` stub for future AWS Cognito / IAM Identity Center integration

### Database Schema

**Incomes** table (PK: `incomeId`):
- `seriesId` — shared across all occurrences of a repeating income; equals `incomeId` for singles
- `isRepeatable`, `repeatFrequency` (`daily`|`weekly`|`monthly`), `seriesEndDate`
- `isException: true` when a record overrides a single occurrence within a series
- GSI: `date-index` on `date` for range queries

**Expenses** table (PK: `expenseId`):
- Same series fields as Incomes
- `priority`: `High`|`Medium`|`Low`
- `status`: `Pending`|`Completed` (default `Pending`)
- `mappedIncomeId`, `mappedIncomeSummary`, `mappedIncomeDate` — denormalized from Incomes for fast rendering
- GSI: `date-index` on `date`

### Key Business Logic

**Repeating events**: Expanded into individual DynamoDB records at creation time (not stored as recurrence rules). All occurrences share a `seriesId`.

**Income auto-mapping** (`resolveIncome(expenseDate)`): Query Incomes where `date <= expenseDate`, return the one with the latest date. Applied per-occurrence for repeating expenses. Exposed via `GET /expenses/resolve-income?date=` for real-time frontend preview.

**Edit series behavior**: Editing a single occurrence of a series sets `isException=true` on that record only; other series records are unchanged. A separate "edit entire series" endpoint handles bulk updates.

## API Endpoints

```
GET    /health
POST   /incomes
GET    /incomes                          # supports ?from=&to=
GET    /incomes/{incomeId}
PUT    /incomes/{incomeId}               # single occurrence (sets isException=true if series)
PUT    /incomes/{incomeId}/series        # all future occurrences
DELETE /incomes/{incomeId}

POST   /expenses
GET    /expenses                         # supports ?from=&to=
GET    /expenses/{expenseId}
PUT    /expenses/{expenseId}
PUT    /expenses/{expenseId}/series
DELETE /expenses/{expenseId}
GET    /expenses/resolve-income?date=    # preview income mapping for a date
```

## Implementation Phases

| Phase | Focus |
|-------|-------|
| 0 | Project scaffold: Docker, SAM, React, health-check Lambda |
| 1 | DynamoDB table creation via `init-tables.sh` |
| 2 | Backend Income CRUD |
| 3 | Backend Expense CRUD + `resolveIncome` auto-mapping |
| 4 | Frontend layout (3-panel), routing, placeholder column cards |
| 5 | Add/Edit Income form |
| 6 | Add/Edit Expense form with real-time income mapping preview |
| 7 | Column cards wired to live API data |
| 8 | Statistics panel (Recharts, computed from loaded data — no extra API calls) |
| 9 | AWS cloud portability: Cognito auth, S3/CloudFront, externalized env vars |

## Design Decisions

| Decision | Choice |
|----------|--------|
| Repeating events | Expand to individual records at write time |
| Income mapping storage | Denormalized on Expense record |
| Local DB | DynamoDB Local (Docker) — identical API to AWS |
| Frontend | React + Vite (S3/CloudFront compatible) |
| API | AWS SAM Lambda (`sam local` mirrors production) |
| Auth | AWS Cognito / IAM Identity Center (Phase 9) |
