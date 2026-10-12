# AWS Deployment Guide — 4TURA Home (Finance4Tura)

How the AWS environment is built. Use it to rebuild from scratch or to understand what's there.

> **Already deployed.** The infrastructure is live. For day-to-day updates see `AWS_Sync.md`.
>
> **AWS only.** There is no local backend (no DynamoDB Local, no `sam local`). The frontend dev server talks to the deployed API.

## Deployed Resources

| Layer | AWS Service | Value |
|---|---|---|
| Frontend hosting | S3 + CloudFront | bucket `finance4tura-frontend`, distribution `E1O9C9K6CO439`, `d34ylrmixnmvem.cloudfront.net` |
| Authentication | Cognito User Pool | `eu-central-1_CD7AdBFwQ`, app client `2nh5dljhrg9mq7nsmdg7cef21v`, group `admin` |
| API | API Gateway + Lambda (SAM) | `https://2t55twyqmh.execute-api.eu-central-1.amazonaws.com/Prod` |
| Database | DynamoDB | 11 tables, listed below |
| Secrets | SSM Parameter Store | `/finance4tura/gdrive-oauth2` (SecureString) |
| CloudFormation stack | SAM | `finance4tura-backend` |
| AWS account / region | — | `980921747943` / `eu-central-1` |

---

## Prerequisites

- AWS CLI installed and configured (`aws configure`)
- AWS SAM CLI (`brew install aws-sam-cli`)
- Node.js 22+
- An AWS account with sufficient IAM permissions

---

## 1. DynamoDB Tables

Tables are defined in `backend/template.yaml` and created by SAM on the first `sam deploy`. All are on-demand (`PAY_PER_REQUEST`) with a single string hash key.

| Table | PK | Notes |
|---|---|---|
| `Incomes` | `incomeId` | GSI `date-index` on `date` |
| `Expenses` | `expenseId` | GSI `date-index` on `date` |
| `InvestmentOperations` | `operationId` | |
| `PortfolioSnapshots` | `snapshotId` | |
| `SplitPayments` | `splitPaymentId` | |
| `Books_and_Dev` | `bookId` | |
| `HQ_Locations` | `hqId` | |
| `HQ_Templates` | `templateId` | |
| `HQ_Entries` | `entryId` | |
| `AppSettings` | `settingKey` | One global item, `settingKey = "global"` |
| `FxRates` | `rateId` | One global item, `rateId = "global"` |

The same account also holds tables for other apps (`TYG_*`, `Grabit`, `kalotura-data`, Amplify tables). They are not part of this stack.

---

## 2. Cognito User Pool (Authentication)

The pool is **not** created by this stack; the template refers to it by ID. It is shared with the TYG app.

### 2.1 The deployed User Pool

- **User Pool ID**: `eu-central-1_CD7AdBFwQ`
- **App Client ID**: `2nh5dljhrg9mq7nsmdg7cef21v` (no client secret)
- **Username attribute**: username (not email)
- **App client auth flows**: `ALLOW_USER_SRP_AUTH`, `ALLOW_ADMIN_USER_PASSWORD_AUTH`, `ALLOW_REFRESH_TOKEN_AUTH`. `USER_PASSWORD_AUTH` is deliberately off.
- **Password policy**: minimum 6 characters
- **Group**: `admin`. Admin API routes check membership through the `cognito:groups` claim.

### 2.2 Pre Sign-Up Lambda trigger (auto-confirm)

`backend/src/handlers/preSignUp.mjs` (`PreSignUpFunction`) is the pool's Pre Sign-Up trigger. It sets `autoConfirmUser = true`, so new accounts are active immediately without email verification. TYG sign-ups go through it too.

The function is in the stack, but wiring it to the pool was a one-time manual step:

```bash
# Allow Cognito to invoke the Lambda
aws lambda add-permission \
  --function-name <PreSignUpFunction-ARN> \
  --statement-id cognito-presignup \
  --action lambda:InvokeFunction \
  --principal cognito-idp.amazonaws.com \
  --source-arn arn:aws:cognito-idp:eu-central-1:980921747943:userpool/eu-central-1_CD7AdBFwQ \
  --region eu-central-1

# Wire the trigger to the User Pool
aws cognito-idp update-user-pool \
  --user-pool-id eu-central-1_CD7AdBFwQ \
  --lambda-config PreSignUp=<PreSignUpFunction-ARN> \
  --region eu-central-1
```

> `update-user-pool` resets any setting you don't pass. Check the current config with `describe-user-pool` first and pass everything back.

### 2.3 API Gateway Cognito Authorizer

Defined in `backend/template.yaml`:

```yaml
Auth:
  DefaultAuthorizer: CognitoAuthorizer
  AddDefaultAuthorizerToCorsPreflight: false
  Authorizers:
    CognitoAuthorizer:
      UserPoolArn: !Ref CognitoUserPoolArn
```

`CognitoUserPoolArn` defaults to the deployed pool. The frontend sends the ID token in the `Authorization` header (raw token, no `Bearer` prefix), and handlers read the user from `event.requestContext.authorizer.claims.sub`.

Public routes override the authorizer with `Auth: Authorizer: NONE`: `POST /auth/google`, `GET /app-settings`, `GET /fx-rates`, `GET /ai-news`.

---

## 3. Google Sign-In Setup

Google Sign-In uses Google Identity Services (GIS) — a popup, no redirect.

### 3.1 Google Cloud Console

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com)
2. **APIs & Services → OAuth consent screen** — External; fill in app name and email
3. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized JavaScript origins: `https://d34ylrmixnmvem.cloudfront.net` and `http://localhost:5173`
4. Copy the Client ID (`...apps.googleusercontent.com`)

### 3.2 Backend

`GoogleAuthFunction` (`backend/src/handlers/googleAuth.mjs`), on `POST /auth/google`:
- Verifies the Google ID token via `https://oauth2.googleapis.com/tokeninfo`
- Creates the Cognito user on first sign-in (`AdminCreateUser`)
- Sets a **fresh random password** (`AdminSetUserPassword`) and immediately uses it with `AdminInitiateAuth` (`ADMIN_USER_PASSWORD_AUTH`)
- Returns the Cognito tokens

Nothing is stored and no secret is involved. An earlier version derived the password from a secret plus the Google `sub`; that secret was public and is now inert. Don't reintroduce a derived-password scheme.

| Variable | Description |
|----------|-------------|
| `USER_POOL_ID` | Cognito User Pool ID |
| `CLIENT_ID` | Cognito App Client ID |
| `GOOGLE_CLIENT_ID` | From the `GoogleClientId` parameter, set in `samconfig.toml` |

### 3.3 Frontend

`frontend/.env.production`:

```env
VITE_GOOGLE_CLIENT_ID=<your-google-client-id>.apps.googleusercontent.com
```

The Google button only shows while **Admin → App Settings → Google Sign-In** is on.

---

## 4. Google Drive Backup Credentials

The Admin page's **Backup ALL Tables** writes CSVs to Google Drive as a real Google account, through OAuth2 (not a service account).

1. In Google Cloud, create an OAuth client with the Drive API enabled, and get a **refresh token** for the account that owns the backup folder (scope `https://www.googleapis.com/auth/drive`).
2. Store the credentials as a SecureString:

   ```bash
   aws ssm put-parameter \
     --name /finance4tura/gdrive-oauth2 \
     --type SecureString \
     --value '{"client_id":"…","client_secret":"…","refresh_token":"…"}' \
     --region eu-central-1
   ```

3. Put the ID of the parent Drive folder (`4TURA_DB_Backups`) in `GDRIVE_BACKUP_FOLDER_ID` on `AdminBackupFunction` in `template.yaml`.

`AdminBackupFunction` has `ssm:GetParameter` on that parameter and `dynamodb:Scan` on all 11 tables. Timeout 300 s, memory 512 MB.

---

## 5. Backend — SAM Deploy (Lambda + API Gateway)

### 5.1 Build

```bash
cd backend
ulimit -n 10240 && sam build --no-cached
```

`ulimit` avoids "too many open files" on macOS; `--no-cached` makes sure source changes are picked up.

### 5.2 First-time deploy

```bash
sam deploy --guided
```

- **Stack name**: `finance4tura-backend`
- **Region**: `eu-central-1`
- **Confirm changes before deploy**: `N`
- **Allow SAM to create IAM roles**: `Y`
- **Save config to samconfig.toml**: `Y`

After that, `sam deploy` alone is enough.

### 5.3 samconfig.toml

```toml
version = 0.1

[default.global.parameters]
stack_name = "finance4tura-backend"

[default.build.parameters]
cached = true
parallel = true

[default.deploy.parameters]
region = "eu-central-1"
capabilities = "CAPABILITY_IAM"
resolve_s3 = true
confirm_changeset = false
parameter_overrides = "GoogleClientId=<your-google-client-id>.apps.googleusercontent.com"
```

> Deploy settings must be under `[default.deploy.parameters]`, not `[default.deploy.guided]`.

The optional `AnthropicApiKey` parameter (`NoEcho`) feeds the unused `/ai-news` endpoint. Leave it blank.

### 5.4 Template parameters

| Parameter | Default | Purpose |
|---|---|---|
| `CognitoUserPoolArn` | the deployed pool | API authorizer |
| `GoogleClientId` | `""` | Google token verification |
| `AnthropicApiKey` | `""` | Optional summaries for `/ai-news` |

### 5.5 Get the API URL

```bash
aws cloudformation describe-stacks \
  --stack-name finance4tura-backend \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text
```

---

## 6. Frontend — Build & Deploy to S3 + CloudFront

### 6.1 S3 bucket

```bash
aws s3 mb s3://finance4tura-frontend --region eu-central-1

aws s3api put-public-access-block \
  --bucket finance4tura-frontend \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

### 6.2 CloudFront Origin Access Control

```bash
aws cloudfront create-origin-access-control \
  --origin-access-control-config '{
    "Name": "Finance4Tura-OAC",
    "OriginAccessControlOriginType": "s3",
    "SigningBehavior": "always",
    "SigningProtocol": "sigv4"
  }' \
  --query "OriginAccessControl.Id" --output text
```

### 6.3 CloudFront distribution

Distribution `E1O9C9K6CO439`, domain `d34ylrmixnmvem.cloudfront.net`:
- **Origin**: `finance4tura-frontend.s3.eu-central-1.amazonaws.com` with the OAC above
- **Default root object**: `index.html`
- **Viewer protocol policy**: `redirect-to-https`
- **Custom error response**: 403 → `/index.html` with HTTP 200 (needed for client-side routes)
- **Cache policy**: `658327ea-f89d-4fab-a63d-7e88639e58f6` (CachingOptimized)

The API is called directly on its API Gateway URL, not through CloudFront.

### 6.4 S3 bucket policy (CloudFront access only)

```bash
aws s3api put-bucket-policy \
  --bucket finance4tura-frontend \
  --policy '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": { "Service": "cloudfront.amazonaws.com" },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::finance4tura-frontend/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "arn:aws:cloudfront::980921747943:distribution/E1O9C9K6CO439"
        }
      }
    }]
  }'
```

### 6.5 Environment variables

`frontend/.env.production`:

```env
VITE_API_BASE_URL=https://2t55twyqmh.execute-api.eu-central-1.amazonaws.com/Prod
VITE_COGNITO_USER_POOL_ID=eu-central-1_CD7AdBFwQ
VITE_COGNITO_CLIENT_ID=2nh5dljhrg9mq7nsmdg7cef21v
VITE_COGNITO_REGION=eu-central-1
VITE_GOOGLE_CLIENT_ID=<your-google-client-id>.apps.googleusercontent.com
```

### 6.6 Build and sync

```bash
cd frontend
npm run build
aws s3 sync dist s3://finance4tura-frontend --region eu-central-1 --delete
aws cloudfront create-invalidation --distribution-id E1O9C9K6CO439 --paths "/*" --region us-east-1
```

---

## 7. First-Run Data

- **App Settings**: until an admin saves **Admin → App Settings**, `GET /app-settings` returns the defaults — all three toggles on. Saving creates the `global` item.
- **FX rates**: press **Admin → FX Rates → Update FX rates** once. Until then, Investments shows "no FX rates set" and amounts are left unconverted.
- **Admin user**: add your user to the Cognito `admin` group. The frontend shows Admin only to username `nenciulescu` (`ADMIN_USER` in `navConfig.js`, and the `/admin` route in `App.jsx`). Change both if the admin username changes.

---

## 8. Implementation Notes

### Cache-Control on API responses

Every Lambda response sets `Cache-Control: no-store`, and so do API Gateway's default 4XX/5XX responses. Without it, API Gateway's internal CloudFront layer can cache a response and serve it to later requests.

### Vite browser polyfill

`frontend/vite.config.js` sets `define: { global: 'globalThis' }`, because `amazon-cognito-identity-js` references Node's `global`.

### `local-dev` fallback

Handlers default `userId` to `"local-dev"` when there is no authorizer context. That was for the removed local backend and never applies in AWS.

---

## 9. Deploy Checklist (rebuild from scratch)

```
[ ] Cognito User Pool exists, with username sign-in and the admin group
[ ] App client allows USER_SRP_AUTH, ADMIN_USER_PASSWORD_AUTH, REFRESH_TOKEN_AUTH
[ ] backend/template.yaml points CognitoUserPoolArn at the pool
[ ] samconfig.toml has [default.deploy.parameters] with the GoogleClientId override
[ ] /finance4tura/gdrive-oauth2 stored in SSM; GDRIVE_BACKUP_FOLDER_ID set
[ ] sam build --no-cached && sam deploy succeeds (creates all 11 tables)
[ ] PreSignUpFunction wired as the pool's Pre Sign-Up trigger
[ ] API Gateway URL confirmed from stack outputs
[ ] S3 bucket created with public access blocked
[ ] CloudFront distribution with OAC + 403→/index.html (200)
[ ] S3 bucket policy grants access to the distribution only
[ ] Google OAuth client with the CloudFront domain as an authorized origin
[ ] frontend/.env.production filled in
[ ] npm run build, s3 sync, CloudFront invalidation
[ ] App loads at https://d34ylrmixnmvem.cloudfront.net
[ ] Admin user in the admin group; App Settings saved; FX rates updated
[ ] Username/password sign-up and Google sign-in tested
```

---

## 10. Estimated AWS Costs

| Service | Free Tier | Notes |
|---|---|---|
| DynamoDB | 25 GB storage | On-demand; personal use stays tiny |
| Lambda | 1M requests/month | Well within free tier |
| API Gateway | 1M requests/month (first 12 months) | |
| S3 | 5 GB storage, 20K GET requests | Minimal for a SPA |
| CloudFront | 1 TB transfer, 10M requests/month | |
| Cognito | 50,000 MAU (Lite) | |
| SSM Parameter Store | Standard parameters free | |

For personal traffic the monthly cost is effectively $0.

---

## 11. Viewing Logs

```bash
# Tail one function by its logical name
sam logs -n IncomesFunction --stack-name finance4tura-backend --tail

# Or through CloudWatch
aws logs tail /aws/lambda/<log-group-name> --follow --region eu-central-1
```

Log groups follow `/aws/lambda/finance4tura-backend-<LogicalId>-<suffix>`. The functions are:

```
GoogleAuthFunction          PreSignUpFunction          HealthFunction
IncomesFunction             ExpensesFunction           AdminFunction
InvestmentOperationsFunction PortfolioSnapshotsFunction SplitPaymentsFunction
BooksAndDevFunction         HQFunction                 AppSettingsFunction
FxRatesFunction             AdminBackupFunction        AiNewsFunction
```

List the exact names:

```bash
aws logs describe-log-groups \
  --region eu-central-1 \
  --query "logGroups[?contains(logGroupName, 'finance4tura')].logGroupName" \
  --output table
```
