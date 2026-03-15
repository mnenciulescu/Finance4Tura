# AWS Sync Guide — Updating Finance4Tura in the Cloud

This guide covers how to push local changes to AWS after the initial deployment is done.
Refer to `AWS_Deploy.md` for the one-time setup steps.

## Deployed Resources (Quick Reference)

| Resource | Value |
|---|---|
| CloudFormation stack | `finance4tura-backend` |
| API Gateway URL | `https://2t55twyqmh.execute-api.eu-central-1.amazonaws.com/Prod` |
| S3 bucket | `finance4tura-frontend` |
| CloudFront distribution ID | `E1O9C9K6CO439` |
| CloudFront domain | `https://d34ylrmixnmvem.cloudfront.net` |
| AWS region | `eu-central-1` |

---

## Quick Reference

| What changed | Command(s) to run |
|---|---|
| Frontend only | `npm run build` → `s3 sync` → CloudFront invalidation |
| Backend only | `sam build --no-cached && sam deploy` |
| Both | Run backend first, then frontend |
| DynamoDB schema | Update `template.yaml`, then `sam deploy` |
| Investment seed data | `node src/seed-investments.mjs` (from `backend/`) |
| SP500 seed data (initial) | `node src/seed-sp500.mjs` (from `backend/`) |
| SP500 latest data (ongoing) | Settings → Data → "Get latest S&P 500 data" → Run |
| Cognito settings | AWS Console or CLI (see section 7) |

---

## 1. Updating the Frontend

Run these commands every time you change anything in `frontend/`:

```bash
cd frontend
npm run build

aws s3 sync dist/ s3://finance4tura-frontend --region eu-central-1 --delete

aws cloudfront create-invalidation \
  --distribution-id E1O9C9K6CO439 \
  --paths "/*" \
  --region us-east-1
```

> The invalidation usually takes 30–60 seconds to propagate globally. Without it, users may see the old version.

### One-liner

```bash
cd frontend && npm run build && \
  aws s3 sync dist/ s3://finance4tura-frontend --region eu-central-1 --delete && \
  aws cloudfront create-invalidation \
    --distribution-id E1O9C9K6CO439 --paths "/*" --region us-east-1
```

---

## 2. Updating the Backend (Lambda + API Gateway)

```bash
cd backend
sam build --no-cached && sam deploy
```

> Use `--no-cached` to ensure source file changes are picked up. The `samconfig.toml` handles all deploy defaults (stack name, region, capabilities, Google Client ID parameter).

SAM will detect changed Lambda functions, re-package and upload them, apply any infrastructure changes from `template.yaml`, and deploy automatically (no confirmation prompt — `confirm_changeset = false` in `samconfig.toml`).

### Checking the deployed API URL

```bash
aws cloudformation describe-stacks \
  --stack-name finance4tura-backend \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text
```

---

## 3. Updating Environment Variables

### Frontend env vars

Edit `frontend/.env.production`, then rebuild and sync (full section 1 flow).

```env
VITE_API_BASE_URL=https://2t55twyqmh.execute-api.eu-central-1.amazonaws.com/Prod
VITE_COGNITO_USER_POOL_ID=eu-central-1_CD7AdBFwQ
VITE_COGNITO_CLIENT_ID=2nh5dljhrg9mq7nsmdg7cef21v
VITE_COGNITO_REGION=eu-central-1
VITE_GOOGLE_CLIENT_ID=<your-google-client-id>.apps.googleusercontent.com
```

### Backend env vars (Lambda)

Backend environment variables are defined in `backend/template.yaml` under each function's `Environment` section. The `GoogleClientId` is passed via `samconfig.toml` `parameter_overrides`. After editing, redeploy:

```bash
cd backend && sam build --no-cached && sam deploy
```

---

## 4. Seeding Investment History

The investment history (operations + portfolio snapshots) is seeded via `backend/src/seed-investments.mjs`. The S&P 500 monthly closing prices are seeded separately via `backend/src/seed-sp500.mjs`. These are one-off scripts — run them after deploying a fresh environment.

### Seed investments (operations + snapshots)

```bash
# Production (uses your configured AWS credentials, real userId)
cd backend
node src/seed-investments.mjs

# Local DynamoDB (uses host AWS credentials, userId = "local-dev")
DYNAMODB_ENDPOINT=http://localhost:8000 node src/seed-investments.mjs

# Local-dev specific seed (uses "local-dev" userId explicitly)
DYNAMODB_ENDPOINT=http://localhost:8000 node src/seed-investments-local.mjs
```

### Seed S&P 500 monthly data

The seed script is used for the **initial historical backfill**. For ongoing updates (fetching the latest missing months after the app is live), use the Settings UI instead.

```bash
# Production — initial historical seed
cd backend
node src/seed-sp500.mjs

# Local DynamoDB
DYNAMODB_ENDPOINT=http://localhost:8000 node src/seed-sp500.mjs
```

### Update SP500 data via Settings (recommended for ongoing use)

Once the app is deployed and the SP500 table has historical data, use the built-in Settings sync to fetch any missing months:

1. Open the app → **Settings** → **Data** section.
2. Click **Run** next to "Get latest S&P 500 data".
3. An animated terminal log shows progress. Green lines indicate stored records; a final "Done" line confirms completion.

This calls `POST /sp500` with `{ sync: true }`, which triggers a Lambda that fetches missing months from Yahoo Finance and stores them in `SP500Monthly`. The Lambda has a 30-second timeout.

### Seed incomes and expenses (local dev)

```bash
DYNAMODB_ENDPOINT=http://localhost:8000 node src/seed-local.mjs
# or via the convenience wrapper:
node scripts/seed-local.mjs
```

> **Local DynamoDB note**: DynamoDB Local scopes tables by AWS access key + region. `init-tables.sh` and the seed scripts both use the host's real AWS credentials (no hardcoded `local`/`local`). If tables are missing locally, run `docker/init-tables.sh` first (it creates all tables including `SP500Monthly`).

---

## 5. Syncing AWS Data to Local

`backend/src/sync-from-aws.mjs` downloads all data from the 6 live AWS DynamoDB tables and writes it into the local DynamoDB instance, remapping the real Cognito userId to `"local-dev"`. This lets you work locally with production data without modifying any real records.

### Tables synced

| Table | Notes |
|---|---|
| `Incomes` | userId remapped to `"local-dev"` |
| `Expenses` | userId remapped to `"local-dev"` |
| `SplitPayments` | userId remapped to `"local-dev"` |
| `InvestmentOperations` | userId remapped to `"local-dev"` |
| `PortfolioSnapshots` | userId remapped to `"local-dev"` |
| `SP500Monthly` | No userId — copied as-is |

### Running the sync

```bash
cd backend
DYNAMODB_ENDPOINT=http://localhost:8000 node src/sync-from-aws.mjs
```

Prerequisites:
- Local DynamoDB must be running (`docker compose up -d` in `docker/`)
- All local tables must exist (`docker/init-tables.sh` or `node create-tables.mjs`)
- AWS CLI must be configured with credentials that have read access to the production tables

> After sync, start the local SAM API and frontend dev server — the app will show real production data scoped to `"local-dev"`.

---

## 6. DynamoDB Schema Changes

DynamoDB is schemaless — adding new attributes to items requires no table changes. Just update the Lambda handler code and redeploy.

The only cases that require a table-level change are:

| Change | Action required |
|---|---|
| Adding a new GSI (Global Secondary Index) | Update `template.yaml`, run `sam deploy` |
| Changing the primary key | Create a new table, migrate data, update code |
| Deleting a GSI | Update `template.yaml`, run `sam deploy` |

---

## 7. Cognito Changes

### Add a user manually

```bash
aws cognito-idp admin-create-user \
  --user-pool-id eu-central-1_CD7AdBFwQ \
  --username <username> \
  --region eu-central-1

aws cognito-idp admin-set-user-password \
  --user-pool-id eu-central-1_CD7AdBFwQ \
  --username <username> \
  --password <password> \
  --permanent \
  --region eu-central-1
```

### List users

```bash
aws cognito-idp list-users \
  --user-pool-id eu-central-1_CD7AdBFwQ \
  --region eu-central-1
```

### Delete a user

```bash
aws cognito-idp admin-delete-user \
  --user-pool-id eu-central-1_CD7AdBFwQ \
  --username <username> \
  --region eu-central-1
```

---

## 8. Viewing Logs

### Lambda function logs (real-time)

```bash
# Tail logs for a specific function (replace <FunctionName> with the logical name)
sam logs -n IncomesFunction --stack-name finance4tura-backend --tail

# Or using CloudWatch directly
aws logs tail /aws/lambda/<log-group-name> --follow --region eu-central-1
```

### Lambda log groups

```
/aws/lambda/finance4tura-backend-GoogleAuthFunction-*
/aws/lambda/finance4tura-backend-IncomesFunction-*
/aws/lambda/finance4tura-backend-ExpensesFunction-*
/aws/lambda/finance4tura-backend-SplitPaymentsFunction-*
/aws/lambda/finance4tura-backend-InvestmentOperationsFunction-*
/aws/lambda/finance4tura-backend-PortfolioSnapshotsFunction-*
/aws/lambda/finance4tura-backend-SP500Function-*
/aws/lambda/finance4tura-backend-AiNewsFunction-*
/aws/lambda/finance4tura-backend-AdminFunction-*
/aws/lambda/finance4tura-backend-HealthFunction-*
/aws/lambda/finance4tura-backend-PreSignUpFunction-*
```

Get the exact log group names:

```bash
aws logs describe-log-groups \
  --region eu-central-1 \
  --query "logGroups[?contains(logGroupName, 'finance4tura')].logGroupName" \
  --output table
```

---

## 9. Rolling Back a Bad Deploy

### Frontend rollback

Re-run `npm run build` on the previous git commit and sync again, then invalidate CloudFront.

```bash
git checkout <previous-commit> -- frontend/src
cd frontend && npm run build
aws s3 sync dist/ s3://finance4tura-frontend --region eu-central-1 --delete
aws cloudfront create-invalidation --distribution-id E1O9C9K6CO439 --paths "/*" --region us-east-1
```

### Backend rollback

Fix the code locally and redeploy — that's the simplest path. Alternatively, use the CloudFormation Console → Stack → Roll back.

---

## 10. Recommended Workflow for Local → Cloud

```
1. Make and test changes locally
   (frontend: npm run dev | backend: sam local start-api)

2. Commit changes to git

3. Deploy backend first (if changed)
   cd backend && sam build --no-cached && sam deploy

4. Deploy frontend (if changed)
   cd frontend && npm run build
   aws s3 sync dist/ s3://finance4tura-frontend --region eu-central-1 --delete
   aws cloudfront create-invalidation --distribution-id E1O9C9K6CO439 --paths "/*" --region us-east-1

5. Verify in browser at https://d34ylrmixnmvem.cloudfront.net
```

> Always deploy the backend before the frontend when both change, to avoid a window where the new frontend calls an API endpoint that does not exist yet.
