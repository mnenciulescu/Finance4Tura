# AWS Deployment Guide — Finance4Tura

This guide walks through deploying the full Finance4Tura stack to AWS:

| Layer | AWS Service |
|---|---|
| Frontend hosting | S3 + CloudFront |
| Authentication | Cognito User Pool |
| API | API Gateway + Lambda (SAM) |
| Database | DynamoDB |
| DNS (optional) | Route 53 + ACM |

---

## Prerequisites

- AWS CLI installed and configured (`aws configure`)
- AWS SAM CLI installed (`brew install aws-sam-cli`)
- Node.js 18+
- An AWS account with sufficient IAM permissions (AdministratorAccess for first deploy)

---

## 1. DynamoDB Tables

The tables are defined and created automatically by SAM (`backend/template.yaml`). They will be provisioned when you run `sam deploy` in step 3. No manual setup required.

If you want to create them manually first:

```bash
aws dynamodb create-table \
  --table-name Finance4Tura-Incomes \
  --attribute-definitions AttributeName=incomeId,AttributeType=S \
  --key-schema AttributeName=incomeId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST

aws dynamodb create-table \
  --table-name Finance4Tura-Expenses \
  --attribute-definitions AttributeName=expenseId,AttributeType=S \
  --key-schema AttributeName=expenseId,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST
```

---

## 2. Cognito User Pool (Authentication)

### 2.1 Create the User Pool

```bash
aws cognito-idp create-user-pool \
  --pool-name Finance4Tura-Users \
  --policies "PasswordPolicy={MinimumLength=8,RequireUppercase=true,RequireLowercase=true,RequireNumbers=true}" \
  --auto-verified-attributes email \
  --username-attributes email \
  --query "UserPool.Id" \
  --output text
```

Save the returned **User Pool ID** (format: `eu-central-1_XXXXXXXXX`).

### 2.2 Create the App Client

```bash
aws cognito-idp create-user-pool-client \
  --user-pool-id <YOUR_USER_POOL_ID> \
  --client-name Finance4Tura-Web \
  --no-generate-secret \
  --explicit-auth-flows ALLOW_USER_SRP_AUTH ALLOW_REFRESH_TOKEN_AUTH \
  --query "UserPoolClient.ClientId" \
  --output text
```

Save the returned **App Client ID**.

### 2.3 Note your values

You will need these in later steps:
- `VITE_COGNITO_USER_POOL_ID` = User Pool ID
- `VITE_COGNITO_CLIENT_ID` = App Client ID
- `VITE_COGNITO_REGION` = your AWS region (e.g. `eu-central-1`)

### 2.4 Protect the API with a Cognito Authorizer

In `backend/template.yaml`, add a Cognito authorizer to each API route:

```yaml
# Under Globals or per-function
Auth:
  DefaultAuthorizer: CognitoAuthorizer
  Authorizers:
    CognitoAuthorizer:
      UserPoolArn: !GetAtt CognitoUserPool.Arn

# Reference the existing User Pool instead of creating a new one:
CognitoUserPool:
  Type: AWS::Cognito::UserPool
  Properties:
    UserPoolName: Finance4Tura-Users
```

Or pass the User Pool ARN as a SAM parameter:

```yaml
Parameters:
  CognitoUserPoolArn:
    Type: String
```

Then deploy with:

```bash
sam deploy --parameter-overrides CognitoUserPoolArn=arn:aws:cognito-idp:<region>:<account>:userpool/<pool-id>
```

---

## 3. Backend — SAM Deploy (Lambda + API Gateway)

### 3.1 Build

```bash
cd backend
sam build
```

### 3.2 First-time guided deploy

```bash
sam deploy --guided
```

Answer the prompts:
- **Stack name**: `finance4tura-backend`
- **Region**: your preferred region (e.g. `eu-central-1`)
- **Confirm changes before deploy**: `Y`
- **Allow SAM to create IAM roles**: `Y`
- **Save config to samconfig.toml**: `Y`

This creates `samconfig.toml` — subsequent deploys only need `sam deploy`.

### 3.3 Get the API URL

After deploy, SAM outputs the API Gateway URL:

```
Outputs:
  ApiUrl: https://xxxxxxxxxx.execute-api.eu-central-1.amazonaws.com/Prod
```

Save this as `VITE_API_BASE_URL` for the frontend build.

### 3.4 Subsequent deploys

```bash
cd backend
sam build && sam deploy
```

---

## 4. Frontend — Build & Deploy to S3 + CloudFront

### 4.1 Create the S3 bucket

```bash
aws s3 mb s3://finance4tura-frontend --region eu-central-1

# Block all public access (CloudFront will serve the content)
aws s3api put-public-access-block \
  --bucket finance4tura-frontend \
  --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

### 4.2 Create a CloudFront Origin Access Control

```bash
aws cloudfront create-origin-access-control \
  --origin-access-control-config '{
    "Name": "Finance4Tura-OAC",
    "OriginAccessControlOriginType": "s3",
    "SigningBehavior": "always",
    "SigningProtocol": "sigv4"
  }' \
  --query "OriginAccessControl.Id" \
  --output text
```

Save the returned **OAC ID**.

### 4.3 Create the CloudFront Distribution

```bash
aws cloudfront create-distribution --distribution-config '{
  "CallerReference": "finance4tura-'$(date +%s)'",
  "Origins": {
    "Quantity": 1,
    "Items": [{
      "Id": "S3-finance4tura-frontend",
      "DomainName": "finance4tura-frontend.s3.eu-central-1.amazonaws.com",
      "S3OriginConfig": { "OriginAccessIdentity": "" },
      "OriginAccessControlId": "<YOUR_OAC_ID>"
    }]
  },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-finance4tura-frontend",
    "ViewerProtocolPolicy": "redirect-to-https",
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
    "Compress": true
  },
  "CustomErrorResponses": {
    "Quantity": 1,
    "Items": [{
      "ErrorCode": 403,
      "ResponsePagePath": "/index.html",
      "ResponseCode": "200",
      "ErrorCachingMinTTL": 0
    }]
  },
  "DefaultRootObject": "index.html",
  "Enabled": true,
  "Comment": "Finance4Tura frontend"
}'
```

> The `CustomErrorResponses` entry for 403→index.html is required for React Router to work correctly on direct URL access or page refresh.

Note the returned **Distribution Domain Name** (e.g. `dxxxxxxxxxxxx.cloudfront.net`) and **Distribution ID**.

### 4.4 Grant CloudFront access to the S3 bucket

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
          "AWS:SourceArn": "arn:aws:cloudfront::<ACCOUNT_ID>:distribution/<DISTRIBUTION_ID>"
        }
      }
    }]
  }'
```

### 4.5 Set environment variables and build

Create `frontend/.env.production`:

```env
VITE_API_BASE_URL=https://xxxxxxxxxx.execute-api.eu-central-1.amazonaws.com/Prod
VITE_COGNITO_USER_POOL_ID=eu-central-1_XXXXXXXXX
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_COGNITO_REGION=eu-central-1
```

Build:

```bash
cd frontend
npm run build
```

### 4.6 Upload to S3

```bash
aws s3 sync dist/ s3://finance4tura-frontend \
  --delete \
  --cache-control "public,max-age=31536000,immutable" \
  --exclude "index.html"

# Upload index.html with no-cache so updates are picked up immediately
aws s3 cp dist/index.html s3://finance4tura-frontend/index.html \
  --cache-control "no-cache,no-store,must-revalidate"
```

### 4.7 Invalidate CloudFront cache after every deploy

```bash
aws cloudfront create-invalidation \
  --distribution-id <DISTRIBUTION_ID> \
  --paths "/*"
```

---

## 5. Custom Domain (Optional)

### 5.1 Request an ACM certificate

> ACM certificates for CloudFront **must be in `us-east-1`** regardless of your app's region.

```bash
aws acm request-certificate \
  --domain-name finance4tura.yourdomain.com \
  --validation-method DNS \
  --region us-east-1 \
  --query "CertificateArn" \
  --output text
```

Complete DNS validation by adding the CNAME record shown in the ACM console to your DNS provider (or Route 53).

### 5.2 Attach the certificate to CloudFront

In the AWS Console → CloudFront → your distribution → **Edit** → under **Custom SSL certificate**, select the validated ACM cert, and add your domain under **Alternate domain names (CNAMEs)**.

### 5.3 Point your domain to CloudFront

In Route 53 (or your DNS provider), create a CNAME or ALIAS record:

```
finance4tura.yourdomain.com → dxxxxxxxxxxxx.cloudfront.net
```

---

## 6. Deploy Checklist

```
[ ] DynamoDB tables provisioned (auto via SAM or manually)
[ ] Cognito User Pool + App Client created
[ ] samconfig.toml saved after first guided deploy
[ ] Backend deployed: sam build && sam deploy
[ ] API Gateway URL noted for VITE_API_BASE_URL
[ ] S3 bucket created with public access blocked
[ ] CloudFront distribution created with OAC
[ ] S3 bucket policy grants access to CloudFront only
[ ] frontend/.env.production filled with real values
[ ] npm run build succeeds
[ ] Assets synced to S3 (immutable cache on assets, no-cache on index.html)
[ ] CloudFront cache invalidated
[ ] App loads at CloudFront domain (or custom domain)
[ ] Authentication flow tested (sign up, sign in, protected API calls)
```

---

## 7. Estimated AWS Costs (Free Tier / Low Traffic)

| Service | Free Tier | Notes |
|---|---|---|
| DynamoDB | 25 GB storage, 25 WCU/RCU | Sufficient for personal use |
| Lambda | 1M requests/month | Well within free tier |
| API Gateway | 1M requests/month (first 12 months) | |
| S3 | 5 GB storage, 20K GET requests | Minimal for a SPA |
| CloudFront | 1 TB transfer, 10M requests/month (always free) | |
| Cognito | 50,000 MAU free | Free for personal use |

For a personal budgeting app with low traffic, **total monthly cost is effectively $0** within free tier limits.
