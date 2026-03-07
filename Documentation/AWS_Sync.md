# AWS Sync Guide — Updating Finance4Tura in the Cloud

This guide covers how to push local changes to AWS after the initial deployment is done.
Refer to `AWS_Deploy.md` for the one-time setup steps.

---

## Quick Reference

| What changed | Command(s) to run |
|---|---|
| Frontend only | `npm run build` → `s3 sync` → CloudFront invalidation |
| Backend only | `sam build && sam deploy` |
| Both | Run backend first, then frontend |
| DynamoDB schema | Manual table update (see section 4) |
| Cognito settings | AWS Console or CLI (see section 5) |

---

## 1. Updating the Frontend

Run these commands every time you change anything in `frontend/`:

### Step 1 — Build

```bash
cd frontend
npm run build
```

### Step 2 — Sync to S3

```bash
# Upload all hashed assets with long-lived cache (only changed files are uploaded)
aws s3 sync dist/ s3://finance4tura-frontend \
  --delete \
  --cache-control "public,max-age=31536000,immutable" \
  --exclude "index.html"

# Always re-upload index.html with no-cache
aws s3 cp dist/index.html s3://finance4tura-frontend/index.html \
  --cache-control "no-cache,no-store,must-revalidate"
```

### Step 3 — Invalidate CloudFront cache

```bash
aws cloudfront create-invalidation \
  --distribution-id <DISTRIBUTION_ID> \
  --paths "/*"
```

> Without this step, users may see the old version for up to 24 hours.
> The invalidation usually takes 30–60 seconds to propagate globally.

### One-liner (copy-paste after first setup)

```bash
cd frontend && npm run build && \
  aws s3 sync dist/ s3://finance4tura-frontend --delete \
    --cache-control "public,max-age=31536000,immutable" --exclude "index.html" && \
  aws s3 cp dist/index.html s3://finance4tura-frontend/index.html \
    --cache-control "no-cache,no-store,must-revalidate" && \
  aws cloudfront create-invalidation \
    --distribution-id <DISTRIBUTION_ID> --paths "/*"
```

---

## 2. Updating the Backend (Lambda + API Gateway)

Run these commands every time you change anything in `backend/`:

```bash
cd backend
sam build && sam deploy
```

SAM will:
- Detect which Lambda functions changed
- Package and upload only the changed code
- Apply any infrastructure changes from `template.yaml`
- Show a change set before deploying (confirm with `Y`)

### Deploying without confirmation prompt

Once you are confident in your changes, skip the interactive prompt:

```bash
sam build && sam deploy --no-confirm-changeset
```

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
VITE_API_BASE_URL=https://xxxxxxxxxx.execute-api.eu-central-1.amazonaws.com/Prod
VITE_COGNITO_USER_POOL_ID=eu-central-1_XXXXXXXXX
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_COGNITO_REGION=eu-central-1
```

### Backend env vars (Lambda)

Backend environment variables are defined in `backend/template.yaml` under each function's `Environment` section:

```yaml
Environment:
  Variables:
    INCOMES_TABLE: !Ref IncomesTable
    EXPENSES_TABLE: !Ref ExpensesTable
```

After editing `template.yaml`, redeploy:

```bash
cd backend && sam build && sam deploy
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

### Adding a new GSI example

In `backend/template.yaml`:

```yaml
GlobalSecondaryIndexes:
  - IndexName: new-index
    KeySchema:
      - AttributeName: newField
        KeyType: HASH
    Projection:
      ProjectionType: ALL
```

Then:

```bash
cd backend && sam build && sam deploy
```

---

## 5. Cognito Changes

### Add or remove a user manually

```bash
# Create a user
aws cognito-idp admin-create-user \
  --user-pool-id <USER_POOL_ID> \
  --username user@example.com \
  --temporary-password Temp1234!

# Delete a user
aws cognito-idp admin-delete-user \
  --user-pool-id <USER_POOL_ID> \
  --username user@example.com
```

### Change password policy

```bash
aws cognito-idp update-user-pool \
  --user-pool-id <USER_POOL_ID> \
  --policies "PasswordPolicy={MinimumLength=12,RequireUppercase=true,RequireLowercase=true,RequireNumbers=true,RequireSymbols=true}"
```

### Update the App Client (e.g. add callback URLs for hosted UI)

```bash
aws cognito-idp update-user-pool-client \
  --user-pool-id <USER_POOL_ID> \
  --client-id <CLIENT_ID> \
  --callback-urls "https://dxxxxxxxxxxxx.cloudfront.net/callback" \
  --logout-urls "https://dxxxxxxxxxxxx.cloudfront.net"
```

---

## 6. Viewing Logs

### Lambda function logs (real-time)

```bash
# Tail logs for a specific function
sam logs -n IncomesFunction --stack-name finance4tura-backend --tail

# Or using CloudWatch directly
aws logs tail /aws/lambda/<function-name> --follow
```

### API Gateway access logs

Enable access logging in the AWS Console:
API Gateway → your API → Stages → Prod → Logs/Tracing → enable **Access Logging**.

---

## 7. Rolling Back a Bad Deploy

### Frontend rollback

S3 does not keep versions by default. Best practice: keep the previous `dist/` folder locally, or enable S3 versioning:

```bash
# Enable versioning (do this once after bucket creation)
aws s3api put-bucket-versioning \
  --bucket finance4tura-frontend \
  --versioning-configuration Status=Enabled
```

To roll back to a previous frontend build, re-run `npm run build` on the previous commit and sync again.

### Backend rollback

SAM/CloudFormation keeps a history of every deployed stack version:

```bash
# List previous changesets
aws cloudformation list-change-sets \
  --stack-name finance4tura-backend

# Roll back to the previous version
aws cloudformation cancel-update-stack \
  --stack-name finance4tura-backend

# Or use the CloudFormation Console → Stack → Roll back
```

Alternatively, just fix the code locally and redeploy — Lambda cold starts are fast.

---

## 8. Recommended Workflow for Local → Cloud

```
1. Make and test changes locally
   (frontend: npm run dev | backend: sam local start-api)

2. Commit changes to git

3. Deploy backend first (if changed)
   cd backend && sam build && sam deploy

4. Deploy frontend (if changed)
   cd frontend && npm run build
   aws s3 sync dist/ s3://finance4tura-frontend --delete \
     --cache-control "public,max-age=31536000,immutable" --exclude "index.html"
   aws s3 cp dist/index.html s3://finance4tura-frontend/index.html \
     --cache-control "no-cache,no-store,must-revalidate"
   aws cloudfront create-invalidation \
     --distribution-id <DISTRIBUTION_ID> --paths "/*"

5. Verify in browser at your CloudFront/custom domain
```

> Always deploy the backend before the frontend when both change, to avoid a window where the new frontend calls an API endpoint that does not exist yet.
