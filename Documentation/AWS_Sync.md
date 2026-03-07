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
| Cognito settings | AWS Console or CLI (see section 5) |

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

> Use `--no-cached` to ensure source file changes are picked up. The `samconfig.toml` handles all deploy defaults (stack name, region, capabilities).

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
```

### Backend env vars (Lambda)

Backend environment variables are defined in `backend/template.yaml` under `Globals.Function.Environment`. After editing, redeploy:

```bash
cd backend && sam build --no-cached && sam deploy
```

---

## 4. DynamoDB Schema Changes

DynamoDB is schemaless — adding new attributes to items requires no table changes. Just update the Lambda handler code and redeploy.

The only cases that require a table-level change are:

| Change | Action required |
|---|---|
| Adding a new GSI (Global Secondary Index) | Update `template.yaml`, run `sam deploy` |
| Changing the primary key | Create a new table, migrate data, update code |
| Deleting a GSI | Update `template.yaml`, run `sam deploy` |

---

## 5. Cognito Changes

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

## 6. Viewing Logs

### Lambda function logs (real-time)

```bash
# Tail logs for a specific function
sam logs -n IncomesFunction --stack-name finance4tura-backend --tail

# Or using CloudWatch directly
aws logs tail /aws/lambda/finance4tura-backend-IncomesFunction-9vHDnp9D1GLA --follow --region eu-central-1
```

### All Lambda log groups

```
/aws/lambda/finance4tura-backend-IncomesFunction-9vHDnp9D1GLA
/aws/lambda/finance4tura-backend-ExpensesFunction-rwdmgTUf9WJs
/aws/lambda/finance4tura-backend-HealthFunction-vuj1kp0HafVt
```

---

## 7. Rolling Back a Bad Deploy

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

## 8. Recommended Workflow for Local → Cloud

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
