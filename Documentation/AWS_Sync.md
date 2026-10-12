# AWS Sync Guide — Shipping Changes to 4TURA Home

How to push changes to AWS once the environment exists. For building the environment, see `AWS_Deploy.md`.

> **There is no local environment.** `npm run dev` serves the frontend on your machine but uses the deployed API and **production data**. Test against the real app, carefully.

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
| Both | Backend first, then frontend |
| New table or GSI | Edit `template.yaml`, then deploy the backend |
| FX rates | Admin → FX Rates → **Update FX rates** |
| App toggles (Backstage, Google sign-in, sign-up) | Admin → App Settings |
| Database backup | Admin → Database Backup → **Backup ALL Tables** |
| Expense ↔ income mapping drifted | `scripts/remap-expenses.mjs` (section 4) |
| Cognito users | Admin → Users, or the CLI (section 6) |

---

## 1. Updating the Frontend

```bash
cd frontend
npm test            # Vitest
npm run lint
npm run build

aws s3 sync dist s3://finance4tura-frontend --region eu-central-1 --delete

aws cloudfront create-invalidation \
  --distribution-id E1O9C9K6CO439 \
  --paths "/*" \
  --region us-east-1
```

Wait for the invalidation to finish before checking:

```bash
aws cloudfront wait invalidation-completed \
  --distribution-id E1O9C9K6CO439 --id <InvalidationId> --region us-east-1
```

> The installed PWA caches the app through its service worker. After a deploy, close and reopen it (or reload twice in a browser) to pick up the new build.

---

## 2. Updating the Backend (Lambda + API Gateway)

```bash
cd backend
npm test                                   # node --test
ulimit -n 10240 && sam build --no-cached
sam deploy
```

`--no-cached` makes sure source changes are picked up; `ulimit` avoids "too many open files" on macOS. `samconfig.toml` supplies the stack name, region, capabilities and the `GoogleClientId` parameter, and `confirm_changeset = false` means no prompt. When nothing changed, SAM reports "No changes to deploy" and exits — that's fine.

### Checking the deployed API URL

```bash
aws cloudformation describe-stacks \
  --stack-name finance4tura-backend \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text
```

---

## 3. Environment Variables

### Frontend

Edit `frontend/.env.production` (and `.env.local`, which holds the same values), then rebuild and sync.

```env
VITE_API_BASE_URL=https://2t55twyqmh.execute-api.eu-central-1.amazonaws.com/Prod
VITE_COGNITO_USER_POOL_ID=eu-central-1_CD7AdBFwQ
VITE_COGNITO_CLIENT_ID=2nh5dljhrg9mq7nsmdg7cef21v
VITE_COGNITO_REGION=eu-central-1
VITE_GOOGLE_CLIENT_ID=<your-google-client-id>.apps.googleusercontent.com
```

### Backend

Lambda environment variables live in `backend/template.yaml` — table names under `Globals`, the rest per function. `GoogleClientId` comes from `samconfig.toml` `parameter_overrides`. Redeploy after editing.

The Google Drive backup credentials are in SSM at `/finance4tura/gdrive-oauth2`. To rotate them:

```bash
aws ssm put-parameter --name /finance4tura/gdrive-oauth2 --type SecureString \
  --overwrite --value '{"client_id":"…","client_secret":"…","refresh_token":"…"}' \
  --region eu-central-1
```

The Lambda caches them per container, so the new value applies from its next cold start.

---

## 4. Data Maintenance

### FX rates

**Admin → FX Rates → Update FX rates** calls `POST /fx-rates`, which fetches EUR→USD and EUR→RON from frankfurter.app, builds the full EUR/USD/RON matrix and stores it in `FxRates`. Every page reads that stored copy. Nothing refreshes it automatically.

### Re-mapping expenses to incomes

Re-resolves `mappedIncomeId` / `mappedIncomeSummary` / `mappedIncomeDate` for **every expense of every user** in the cloud tables. Use it after a bulk income change leaves expenses on the wrong period. Uses your AWS CLI credentials.

The repo root has no `package.json`, so the script's AWS SDK imports don't resolve as-is. Install them once without saving: `cd scripts && npm install --no-save @aws-sdk/client-dynamodb @aws-sdk/util-dynamodb`, then run `node remap-expenses.mjs` from there.

### Backups

**Admin → Database Backup → Backup ALL Tables** exports all 11 tables (all users) to CSV in a new dated folder under `4TURA_DB_Backups` on Google Drive. See `Backup_Requirements.md`.

### Legacy scripts

`scripts/seed-local.mjs`, `scripts/seed-investments.mjs` and `backend/create-tables.mjs` were written for DynamoDB Local, which no longer exists. Don't run them against production.

---

## 5. DynamoDB Schema Changes

DynamoDB is schemaless — new attributes need no table change. Update the handler and redeploy.

| Change | Action required |
|---|---|
| New table | Add it to `template.yaml` (and to `Globals` env, the function's policy, and the backup list in `adminBackup.mjs` + its IAM policy) |
| New or deleted GSI | Update `template.yaml`, deploy |
| Changing a primary key | New table, migrate data, update code |

---

## 6. Cognito

Most user admin is on **Admin → Users**: list users with their record counts, add or remove the `admin` group, delete a user (asks for your password).

From the CLI:

```bash
# Create a user with a permanent password
aws cognito-idp admin-create-user --user-pool-id eu-central-1_CD7AdBFwQ \
  --username <username> --region eu-central-1
aws cognito-idp admin-set-user-password --user-pool-id eu-central-1_CD7AdBFwQ \
  --username <username> --password <password> --permanent --region eu-central-1

# Grant admin
aws cognito-idp admin-add-user-to-group --user-pool-id eu-central-1_CD7AdBFwQ \
  --username <username> --group-name admin --region eu-central-1

# List / delete
aws cognito-idp list-users --user-pool-id eu-central-1_CD7AdBFwQ --region eu-central-1
aws cognito-idp admin-delete-user --user-pool-id eu-central-1_CD7AdBFwQ \
  --username <username> --region eu-central-1
```

The pool is shared with TYG. Deleting a user removes their TYG login as well.

---

## 7. Viewing Logs

```bash
sam logs -n IncomesFunction --stack-name finance4tura-backend --tail
aws logs tail /aws/lambda/<log-group-name> --follow --region eu-central-1
```

Function logical IDs: `GoogleAuthFunction`, `PreSignUpFunction`, `HealthFunction`, `IncomesFunction`, `ExpensesFunction`, `AdminFunction`, `InvestmentOperationsFunction`, `PortfolioSnapshotsFunction`, `SplitPaymentsFunction`, `BooksAndDevFunction`, `HQFunction`, `AppSettingsFunction`, `FxRatesFunction`, `AdminBackupFunction`, `AiNewsFunction`.

The frontend also keeps a log of its last 50 API calls on the **Backstage** page (when enabled).

---

## 8. Rolling Back a Bad Deploy

### Frontend

Build the previous commit and sync it:

```bash
git checkout <previous-commit> -- frontend/src
cd frontend && npm run build
aws s3 sync dist s3://finance4tura-frontend --region eu-central-1 --delete
aws cloudfront create-invalidation --distribution-id E1O9C9K6CO439 --paths "/*" --region us-east-1
git checkout HEAD -- src    # restore your working tree afterwards
```

### Backend

Fix forward and redeploy — usually simplest. A failed deploy rolls itself back; for a deploy that succeeded but misbehaves, check out the previous `backend/` and run `sam build --no-cached && sam deploy`.

---

## 9. Recommended Workflow

```
1. Change the code; run the tests
   (frontend: npm test && npm run lint | backend: npm test)

2. Commit and push to GitHub (main)

3. Deploy the backend first, if it changed
   cd backend && ulimit -n 10240 && sam build --no-cached && sam deploy

4. Deploy the frontend, if it changed
   cd frontend && npm run build
   aws s3 sync dist s3://finance4tura-frontend --region eu-central-1 --delete
   aws cloudfront create-invalidation --distribution-id E1O9C9K6CO439 --paths "/*" --region us-east-1

5. Wait for the invalidation, then check https://d34ylrmixnmvem.cloudfront.net
```

> Backend before frontend avoids a window where the new frontend calls an endpoint that doesn't exist yet.
