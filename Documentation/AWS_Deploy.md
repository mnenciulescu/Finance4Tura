# AWS Deployment Guide — Finance4Tura

This guide documents the one-time setup used to deploy Finance4Tura to AWS.

> **Already deployed.** The infrastructure is live. For day-to-day updates see `AWS_Sync.md`.

## Deployed Resources

| Layer | AWS Service | Value |
|---|---|---|
| Frontend hosting | S3 + CloudFront | `d34ylrmixnmvem.cloudfront.net` |
| Authentication | Cognito User Pool | `eu-central-1_CD7AdBFwQ` |
| API | API Gateway + Lambda (SAM) | `https://2t55twyqmh.execute-api.eu-central-1.amazonaws.com/Prod` |
| Database | DynamoDB | Tables: `Incomes`, `Expenses`, `SplitPayments` |
| CloudFormation stack | SAM | `finance4tura-backend` |
| AWS region | — | `eu-central-1` |

---

## Prerequisites

- AWS CLI installed and configured (`aws configure`)
- AWS SAM CLI installed (`brew install aws-sam-cli`)
- Node.js 20+
- An AWS account with sufficient IAM permissions

---

## 1. DynamoDB Tables

Tables are defined in `backend/template.yaml` and provisioned automatically by SAM on first `sam deploy`. No manual setup required.

---

## 2. Cognito User Pool (Authentication)

### 2.1 The deployed User Pool

- **User Pool ID**: `eu-central-1_CD7AdBFwQ`
- **App Client ID**: `2nh5dljhrg9mq7nsmdg7cef21v`
- **Username attribute**: username (not email)
- **Auth flows**: `ALLOW_USER_PASSWORD_AUTH`, `ALLOW_ADMIN_USER_PASSWORD_AUTH`, `ALLOW_REFRESH_TOKEN_AUTH`
- **Password policy**: minimum 6 characters (no complexity requirements)

### 2.2 Pre Sign-Up Lambda trigger (auto-confirm)

A Lambda function (`backend/src/handlers/preSignUp.mjs`) is wired as the Cognito Pre Sign-Up trigger. It sets `event.response.autoConfirmUser = true`, so all new sign-ups are confirmed immediately without email verification.

The trigger was registered via:

```bash
# Grant Cognito permission to invoke the Lambda
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

The `CognitoUserPoolArn` parameter defaults to the deployed pool ARN. The frontend sends the JWT ID token in the `Authorization` header (raw token, no `Bearer` prefix). Lambda extracts the user identity via:

```js
const userId = event.requestContext?.authorizer?.claims?.sub ?? "local-dev";
```

---

## 3. Google Sign-In Setup

Google Sign-In uses Google Identity Services (GIS) — an embedded popup, no redirect required.

### 3.1 Google Cloud Console

1. Create a project at [console.cloud.google.com](https://console.cloud.google.com)
2. **APIs & Services → OAuth consent screen** — choose External, fill in app name and email
3. **APIs & Services → Credentials → + Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized JavaScript origins:
     - `https://d34ylrmixnmvem.cloudfront.net`
     - `http://localhost:3000`
4. Copy the Client ID (`...apps.googleusercontent.com`)

### 3.2 Backend configuration

The `GoogleAuthFunction` Lambda (`backend/src/handlers/googleAuth.mjs`):
- Verifies the Google ID token via `https://oauth2.googleapis.com/tokeninfo`
- Creates a Cognito user on first sign-in (`AdminCreateUser` + `AdminSetUserPassword`)
- Returns Cognito JWT tokens after `AdminInitiateAuth`
- Uses a HMAC-derived deterministic password (never exposed to the user)

Environment variables set in `backend/template.yaml`:

| Variable | Description |
|----------|-------------|
| `USER_POOL_ID` | Cognito User Pool ID |
| `CLIENT_ID` | Cognito App Client ID |
| `GOOGLE_SECRET` | HMAC secret for deriving per-user passwords |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID (passed via `samconfig.toml` parameter override) |

The `GoogleAuthFunction` route (`POST /auth/google`) has `Auth: Authorizer: NONE` — it is a public endpoint.

### 3.3 Frontend env var

Add to `frontend/.env.production` and `frontend/.env.local`:

```env
VITE_GOOGLE_CLIENT_ID=<your-google-client-id>.apps.googleusercontent.com
```

---

## 4. Backend — SAM Deploy (Lambda + API Gateway)

### 4.1 Build

```bash
cd backend
sam build --no-cached
```

### 4.2 First-time deploy

```bash
sam deploy --guided
```

Answer the prompts:
- **Stack name**: `finance4tura-backend`
- **Region**: `eu-central-1`
- **Confirm changes before deploy**: `N`
- **Allow SAM to create IAM roles**: `Y`
- **Save config to samconfig.toml**: `Y`

After this, `samconfig.toml` stores all defaults and subsequent deploys only need:

```bash
sam build --no-cached && sam deploy
```

### 4.3 samconfig.toml structure

```toml
version = 0.1

[default.global.parameters]
stack_name = "finance4tura-backend"

[default.build.parameters]
cached = true
parallel = true

[default.local_start_api.parameters]
warm_containers = "EAGER"
parameter_overrides = "DynamoDbEndpoint=http://host.docker.internal:8000"

[default.deploy.parameters]
region = "eu-central-1"
capabilities = "CAPABILITY_IAM"
resolve_s3 = true
confirm_changeset = false
parameter_overrides = "GoogleClientId=<your-google-client-id>.apps.googleusercontent.com"
```

> **Important**: Deploy settings must be under `[default.deploy.parameters]`, not `[default.deploy.guided]`.

### 4.4 Get the API URL

```bash
aws cloudformation describe-stacks \
  --stack-name finance4tura-backend \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text
```

---

## 5. Frontend — Build & Deploy to S3 + CloudFront

### 5.1 S3 bucket

```bash
aws s3 mb s3://finance4tura-frontend --region eu-central-1

aws s3api put-public-access-block \
  --bucket finance4tura-frontend \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

### 5.2 CloudFront Origin Access Control

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

### 5.3 CloudFront Distribution

Distribution ID: `E1O9C9K6CO439`, domain: `d34ylrmixnmvem.cloudfront.net`

Key configuration:
- **Default root object**: `index.html`
- **Viewer protocol policy**: `redirect-to-https`
- **Custom error response**: 403 → `/index.html` with HTTP 200 (required for React Router)
- **Cache policy**: `658327ea-f89d-4fab-a63d-7e88639e58f6` (CachingOptimized)

### 5.4 S3 bucket policy (CloudFront access only)

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

### 5.5 Environment variables

`frontend/.env.production`:

```env
VITE_API_BASE_URL=https://2t55twyqmh.execute-api.eu-central-1.amazonaws.com/Prod
VITE_COGNITO_USER_POOL_ID=eu-central-1_CD7AdBFwQ
VITE_COGNITO_CLIENT_ID=2nh5dljhrg9mq7nsmdg7cef21v
VITE_COGNITO_REGION=eu-central-1
VITE_GOOGLE_CLIENT_ID=<your-google-client-id>.apps.googleusercontent.com
```

### 5.6 Build and sync

```bash
cd frontend
npm run build

aws s3 sync dist/ s3://finance4tura-frontend --region eu-central-1 --delete

aws cloudfront create-invalidation \
  --distribution-id E1O9C9K6CO439 \
  --paths "/*" \
  --region us-east-1
```

---

## 6. Important Implementation Notes

### Cache-Control on API responses

Lambda responses include `"Cache-Control": "no-store"` in their headers. This is required because API Gateway internally routes through a CloudFront layer that will cache responses if no cache directive is set. Without this header, a user's first API call returning empty data would be cached and served to all subsequent requests.

### Vite browser polyfill

`frontend/vite.config.js` includes `define: { global: 'globalThis' }`. This is required because `amazon-cognito-identity-js` references the Node.js `global` variable, which does not exist in the browser.

### Local dev userId

When running `sam local start-api`, the Cognito authorizer is not enforced. Lambda falls back to `userId = "local-dev"`. All locally-created records use this userId.

### Google Sign-In password derivation

Google users never set a password. The backend derives a stable deterministic password from the Google `sub` using HMAC-SHA256 keyed with `GOOGLE_SECRET`. This allows `ADMIN_USER_PASSWORD_AUTH` to work transparently on every sign-in without storing any credential.

---

## 7. Deploy Checklist (for re-deployment from scratch)

```
[ ] DynamoDB tables provisioned (auto via sam deploy)
[ ] Cognito User Pool created with username auth + Pre Sign-Up trigger
[ ] Cognito App Client has ALLOW_ADMIN_USER_PASSWORD_AUTH enabled
[ ] backend/template.yaml references correct CognitoUserPoolArn
[ ] samconfig.toml has [default.deploy.parameters] with GoogleClientId override
[ ] sam build --no-cached && sam deploy succeeds
[ ] API Gateway URL confirmed from stack outputs
[ ] S3 bucket created with public access blocked
[ ] CloudFront distribution created with OAC + 403→index.html error response
[ ] S3 bucket policy grants access to CloudFront distribution only
[ ] Google Cloud project created with OAuth consent screen configured
[ ] OAuth 2.0 Client ID created with CloudFront domain as authorized JS origin
[ ] frontend/.env.production filled with all values including VITE_GOOGLE_CLIENT_ID
[ ] npm run build succeeds
[ ] aws s3 sync dist/ s3://finance4tura-frontend --delete
[ ] CloudFront cache invalidated
[ ] App loads at https://d34ylrmixnmvem.cloudfront.net
[ ] Username/password sign-up tested
[ ] Google Sign-In tested (first sign-in creates Cognito account automatically)
```

---

## 8. Estimated AWS Costs (Free Tier / Low Traffic)

| Service | Free Tier | Notes |
|---|---|---|
| DynamoDB | 25 GB storage, 25 WCU/RCU | Sufficient for personal use |
| Lambda | 1M requests/month | Well within free tier |
| API Gateway | 1M requests/month (first 12 months) | |
| S3 | 5 GB storage, 20K GET requests | Minimal for a SPA |
| CloudFront | 1 TB transfer, 10M requests/month (always free) | |
| Cognito | 50,000 MAU free | Free for personal use |

For a personal budgeting app with low traffic, **total monthly cost is effectively $0** within free tier limits.
