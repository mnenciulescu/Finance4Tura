# Finance4Tura

Personal budgeting web app. Incomes are received periodically; expenses are mapped to the most recent income before their date.

## Quick Start

### 1. DynamoDB Local (Docker)

```bash
cd docker
docker compose up -d
# Verify running:
aws dynamodb list-tables --endpoint-url http://localhost:8000
# Bootstrap tables:
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
npm run dev   # http://localhost:3000
```

## Development Commands

| Task | Command |
|------|---------|
| Start DynamoDB | `cd docker && docker compose up -d` |
| Bootstrap tables | `cd docker && ./init-tables.sh` |
| Build backend | `cd backend && sam build` |
| Start API locally | `cd backend && sam local start-api` |
| Start frontend | `cd frontend && npm run dev` |
| Frontend tests | `cd frontend && npm run test` |
| Lint frontend | `cd frontend && npm run lint` |
| Deploy to AWS | `cd backend && sam build && sam deploy --guided` |

## Architecture

```
finance4tura/
├── frontend/        # React + Vite (port 3000)
├── backend/         # AWS SAM Lambda functions (port 3001)
│   ├── template.yaml
│   ├── samconfig.toml
│   └── src/handlers/
│       ├── health.mjs
│       ├── incomes.mjs   # Phase 2
│       └── expenses.mjs  # Phase 3
├── docker/
│   ├── docker-compose.yml  # DynamoDB Local (port 8000)
│   └── init-tables.sh
└── README.md
```

## Environment Variables

| Variable | Where | Value |
|----------|-------|-------|
| `VITE_API_BASE_URL` | `frontend/.env.local` | `http://localhost:3001` |
| `DYNAMODB_ENDPOINT` | SAM `samconfig.toml` | `http://localhost:8000` (local) / empty (AWS) |

## Auth (Phase 9)

Authentication uses AWS Cognito / IAM Identity Center. In local development, `AuthContext.jsx` provides a hard-coded stub user. Phase 9 will replace this with real Cognito tokens passed as `Authorization: Bearer <token>` headers to the API Gateway.

## Implementation Phases

| Phase | Focus | Status |
|-------|-------|--------|
| 0 | Project scaffold (Docker, SAM, React, health check) | ✅ |
| 1 | DynamoDB table creation | ✅ |
| 2 | Backend Income CRUD | ⬜ |
| 3 | Backend Expense CRUD + resolveIncome | ⬜ |
| 4 | Frontend layout, routing, column card shells | ⬜ |
| 5 | Add/Edit Income form | ⬜ |
| 6 | Add/Edit Expense form + income mapping preview | ⬜ |
| 7 | Column cards wired to live API | ⬜ |
| 8 | Statistics panel (Recharts) | ⬜ |
| 9 | AWS cloud portability (Cognito, S3/CloudFront) | ⬜ |
