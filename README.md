# Warrantor Backend

Enterprise-grade serverless warranty management API built on AWS. Infinite scalability, zero idle costs, millisecond latency.

<div align="center">

[![Serverless Framework](https://img.shields.io/badge/Serverless-Framework-red.svg?logo=serverless&logoColor=white&style=for-the-badge)](https://serverless.com)
[![AWS](https://img.shields.io/badge/AWS-Powered-FF9900.svg?logo=amazon-aws&logoColor=white&style=for-the-badge)](https://aws.amazon.com/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933.svg?logo=node.js&logoColor=white&style=for-the-badge)](https://nodejs.org/)
[![DynamoDB](https://img.shields.io/badge/DynamoDB-NoSQL-527FFF.svg?logo=amazon-dynamodb&logoColor=white&style=for-the-badge)](https://aws.amazon.com/dynamodb/)

[Documentation](#overview) · [Quick Start](#quick-start) · [Architecture](#system-architecture) · [API Reference](#api-reference)

</div>

---

## Overview

A fully serverless backend for warranty management built on AWS Lambda, DynamoDB, and Cognito. Designed for enterprise scalability with zero idle costs and automatic infrastructure management.

### Key Capabilities

- **Serverless Compute** — AWS Lambda with automatic scaling and pay-per-invocation pricing
- **Enterprise Authentication** — JWT-based authentication via AWS Cognito
- **High-Performance Database** — DynamoDB with Global Secondary Indexes and sub-millisecond latency
- **Secure File Storage** — S3 with presigned URLs for direct client uploads
- **AI-Powered Summaries** — AWS Bedrock with Gemma 3 4B for intelligent summaries
- **Real-Time Notifications** — Dynamic notification system with automatic expiry tracking
- **Clean Architecture** — 4-tier abstraction separating handlers, services, libraries, and utilities
- **Infrastructure as Code** — Single-command CloudFormation deployment via Serverless Framework

---

## System Architecture

The backend uses a completely serverless infrastructure orchestrated by the Serverless Framework. All components are managed, on-demand AWS services with automatic scaling and pay-per-use pricing.


## System Architecture

```mermaid
flowchart TD
    subgraph AWS["AWS Cloud Environment"]
        APIGW[" API Gateway (HTTP APIs)"]
        Lambda[" AWS Lambda (Node.js 20.x)"]
        Cognito[" AWS Cognito (User Pools)"]
        Dynamo["DynamoDB (NoSQL)"]
        S3["Amazon S3 (Uploads Bucket)"]
    end

    Client(["Client Application"]) -->|HTTP Request| APIGW
    APIGW -->|Proxy Integration| Lambda
    Lambda -->|Get / Auth| Cognito
    Lambda <-->|CRUD Operations| Dynamo
    Lambda -->|Generate Presigned URL| S3
    Client -->|Direct PUT Upload| S3
```

### Architecture Principles

- **Zero idle costs** — Pay only for requests processed
- **Automatic scaling** — Lambda handles concurrent requests without manual intervention
- **Isolated execution** — Each function runs in its own secure environment
- **Granular permissions** — IAM policies follow principle of least privilege
- **No server management** — AWS handles all infrastructure maintenance

---

## Technology Stack

### Compute & Routing
**AWS Lambda + HTTP API Gateway** — Serverless functions triggered by HTTP requests. Gateway routes based on path and method. No managing EC2 instances or containers.

### Authentication & Identity
**Amazon Cognito + JWT** — Cognito manages user signup, login, and password reset. Custom middleware validates JWT tokens on every request, extracting userId for authorization checks.

### Database
**Amazon DynamoDB** — Fully managed NoSQL database. Single-table design with Global Secondary Indexes for efficient queries. Sub-millisecond latency at any scale.

### Storage
**Amazon S3 + Presigned URLs** — Bypasses the 6MB Lambda payload limit by generating temporary upload URLs. Clients upload directly to S3, streaming images without touching Lambda.

### AI Integration
**AWS Bedrock (Gemma 3 4B)** — Generates warranty summaries for users. Costs $0.04 per 1M input tokens and $0.08 per 1M output tokens — approximately 99% cheaper than Claude.

### Infrastructure as Code
**Serverless Framework** — Deploys CloudFormation stacks from `serverless.yml`. One command provisions tables, functions, API routes, S3 buckets, and IAM permissions.

### Bundling
**esbuild** — Minifies and tree-shakes dependencies before upload, reducing bundle sizes from ~5MB to ~200KB.

---

## Authentication Flow

Every API request follows the same authentication pipeline:

```mermaid
sequenceDiagram
    participant Client
    participant APIGateway
    participant AuthMiddleware
    participant CognitoVerify
    participant HandlerService

    Client->>APIGateway: HTTP GET /warranties (Header: Bearer <TOKEN>)
    APIGateway->>AuthMiddleware: Passes raw Event Object
    AuthMiddleware->>AuthMiddleware: Extracts `userId` (Username) mapping
    AuthMiddleware->>CognitoVerify: Validates Signature & Expiration via `aws-jwt-verify`
    
    alt is Invalid Token
        CognitoVerify-->>AuthMiddleware: Throws SignatureDoesNotMatch
        AuthMiddleware-->>Client: 401 Unauthorized Response
    else is Valid Token
        CognitoVerify-->>AuthMiddleware: Returns Validated Payload
        AuthMiddleware->>AuthMiddleware: Decodes Base64 API Body & `JSON.parse`
        AuthMiddleware->>HandlerService: Calls Handler with clean JS Object + `userId` appended
        HandlerService-->>Client: 200 HTTP OK + Data
    end

```

**Key Detail** — The middleware attaches `event.userId` (the Cognito user's unique ID) to every request. Handlers trust this value because the middleware verified it cryptographically.

---

## Data Model

### Warranties Table
```
Primary Key: id (UUID)
Sort Key: userId

Fields:
├─ productName (string)
├─ brand (string)
├─ category (string)
├─ warrantyProvider (string)
├─ purchaseDate (ISO date)
├─ expiryDate (ISO date)
├─ coverageDetails (string)
├─ pictureUrl (S3 URL)

Indexes:
└─ userId-index (query all warranties for a user)
```

### Notifications Table
```
Primary Key: id (UUID)
Sort Key: userId

Fields:
├─ warrantyId (reference)
├─ productName (string)
├─ isRead (boolean)
├─ createdAt (ISO timestamp)
├─ expiresAt (ISO date)

Computed on Fetch:
├─ type (EXPIRY_WARNING | EXPIRED)
├─ title (display heading)
├─ message (formatted string)
├─ daysLeft (computed from expiresAt)

Indexes:
└─ userId-createdAt-index (list recent notifications for user)
```

### Settings Table
```
Primary Key: userId (Cognito ID)

Fields:
├─ language (e.g., en-US)
├─ notificationsEnabled (boolean)
```

---

## API Reference

### Create Warranty

```http
POST /warranties
Authorization: Bearer <token>
Content-Type: application/json

{
  "productName": "MacBook Pro 16\"",
  "brand": "Apple",
  "category": "Electronics",
  "warrantyProvider": "AppleCare",
  "purchaseDate": "2024-01-15",
  "expiryDate": "2025-01-15",
  "coverageDetails": "Accidental damage protection included",
  "pictureUrl": "https://s3.amazonaws.com/warrantor-uploads-dev-123456/warranties/user-id/file-id.jpg"
}
```

**Response (201 Created)**
```json
{
  "message": "Warranty created successfully"
}
```

Upon creation, a notification is automatically generated with `type: EXPIRY_WARNING`.

### List Warranties

```http
GET /warranties
Authorization: Bearer <token>
```

**Response (200 OK)**
```json
{
  "warranties": [
    {
      "id": "f7ab2c9d-12ab-4c3e-8d9e-1234abcd5678",
      "productName": "MacBook Pro 16\"",
      "brand": "Apple",
      "category": "Electronics",
      "warrantyProvider": "AppleCare",
      "purchaseDate": "2024-01-15",
      "expiryDate": "2025-01-15",
      "coverageDetails": "Accidental damage protection included",
      "pictureUrl": "https://s3.amazonaws.com/..."
    }
  ],
  "count": 1
}
```

### Update Warranty

```http
PUT /warranties/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "productName": "MacBook Pro 16\" M3 Max"
}
```

Only provided fields are updated. Other fields remain unchanged.

**Response (200 OK)**
```json
{
  "message": "Warranty updated successfully"
}
```

### Delete Warranty

```http
DELETE /warranties/{id}
Authorization: Bearer <token>
```

**Response (200 OK)**
```json
{
  "message": "Warranty deleted successfully"
}
```

### Get Notifications

```http
GET /notifications
Authorization: Bearer <token>
```

**Response (200 OK)**
```json
{
  "notifications": [
    {
      "id": "eec9ad-456b",
      "warrantyId": "f7ab2c9d-12ab-4c3e-8d9e-1234abcd5678",
      "productName": "MacBook Pro 16\"",
      "type": "EXPIRY_WARNING",
      "title": "EXPIRY WARNING",
      "message": "Your MacBook Pro 16\" warranty expires in 12 days. Consider filing any pending claims.",
      "daysLeft": 12,
      "isRead": false,
      "createdAt": "2026-04-05T10:00:00Z",
      "expiresAt": "2026-04-17T00:00:00Z"
    },
    {
      "id": "abc123-def4",
      "warrantyId": "another-warranty-id",
      "productName": "iPhone 13",
      "type": "EXPIRED",
      "title": "EXPIRED",
      "message": "Your iPhone 13 warranty has expired. You can no longer file claims.",
      "daysLeft": -5,
      "isRead": true,
      "createdAt": "2026-03-15T10:00:00Z",
      "expiresAt": "2026-04-10T00:00:00Z"
    }
  ],
  "unreadCount": 1
}
```

Types are computed dynamically based on `daysLeft`:
- `daysLeft > 0` → `EXPIRY_WARNING`
- `daysLeft ≤ 0` → `EXPIRED`

### Get Settings

```http
GET /settings
Authorization: Bearer <token>
```

**Response (200 OK)**
```json
{
  "email": "user@example.com",
  "name": "John Doe",
  "language": "en-US",
  "notificationsEnabled": true
}
```

Email and name come from Cognito. Language and notification preference come from the Settings table.

### Update Settings

```http
PUT /settings
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Jane Doe",
  "language": "es-ES",
  "notificationsEnabled": false,
  "newPassword": "SecureNewPassword123!"
}
```

- `name` — Updates Cognito user attribute
- `newPassword` — Updates Cognito password (permanent)
- `language`, `notificationsEnabled` — Updates Settings table

**Response (200 OK)**
```json
{
  "message": "Settings updated successfully"
}
```

### Get S3 Upload URL

```http
GET /uploads
Authorization: Bearer <token>
```

**Response (200 OK)**
```json
{
  "uploadUrl": "https://warrantor-uploads-dev-123456.s3.amazonaws.com/warranties/user-123/file-id.jpg?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=...",
  "pictureUrl": "https://warrantor-uploads-dev-123456.s3.amazonaws.com/warranties/user-123/file-id.jpg",
  "fileId": "abc123-def4-ghi5"
}
```

The `uploadUrl` is valid for 1 hour. Use it to upload the image directly to S3.

**Upload to S3**
```http
PUT <uploadUrl>
Content-Type: image/jpeg

[Binary image data]
```

No authorization header needed — the presigned URL includes temporary credentials.

After upload succeeds (200 OK), use the `pictureUrl` when creating or updating a warranty.

---

## Project Structure

```
warrantor-backend/
│
├── src/
│   ├── functions/                 # API handlers (routing layer)
│   │   ├── warranties/
│   │   │   ├── create.js          # POST /warranties
│   │   │   ├── get.js             # GET /warranties
│   │   │   ├── update.js          # PUT /warranties/{id}
│   │   │   ├── remove.js          # DELETE /warranties/{id}
│   │   │   └── getUploadUrl.js    # GET /uploads
│   │   ├── notifications/
│   │   │   └── get.js             # GET /notifications
│   │   └── settings/
│   │       ├── get.js             # GET /settings
│   │       └── update.js          # PUT /settings
│   │
│   ├── services/                  # Business logic (pure functions)
│   │   ├── warrantyService.js
│   │   ├── notificationService.js
│   │   └── settingsService.js
│   │
│   ├── libs/                       # AWS SDK clients (initialized once)
│   │   ├── dynamo.js
│   │   ├── cognito.js
│   │   └── s3.js
│   │
│   ├── middleware/                 # Auth & validation
│   │   └── auth.js                 # JWT verification
│   │
│   └── utils/                      # Formatting helpers
│       └── response.js             # HTTP response wrapper
│
├── serverless.yml                  # Infrastructure definition
├── .env.example                    # Environment template
├── package.json
└── README.md
```

### 4-Tier Architecture Pattern

This structure separates concerns to improve testability and maintainability:

1. **Functions (handlers)** — Pure routing. Accept event, call service, return formatted response.
2. **Services (business logic)** — Core logic independent of AWS. Database reads/writes, computations.
3. **Libs (AWS clients)** — SDK initialization happens once and is reused across invocations, saving cold-start time.
4. **Utils (helpers)** — Shared formatting and response builders.

---

## Quick Start

### Prerequisites

- Node.js v20 or higher
- AWS account with credentials configured (`~/.aws/credentials`)
- Serverless Framework installed globally: `npm install -g serverless`

### Installation

```bash
git clone https://github.com/yourusername/warrantor-backend.git
cd warrantor-backend
npm install
```

### Configuration

Create `.env` file:
```bash
cp .env.example .env
```

Fill in your AWS Cognito details from the AWS Console:
```env
COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX
COGNITO_CLIENT_ID=abcdef1234567890
```

### Deployment

Deploy to AWS:
```bash
serverless deploy
```

Output:
```
✓ Service deployed to stack warrantor-backend-dev
✓ Endpoint: https://abc123def.execute-api.us-east-1.amazonaws.com
```

The Serverless Framework automatically:
- Bundles code with esbuild
- Creates DynamoDB tables
- Provisions Lambda functions
- Sets up API Gateway routes
- Configures S3 bucket
- Applies IAM permissions

### Testing

Get a Cognito access token:
```bash
aws cognito-idp admin-initiate-auth \
  --user-pool-id us-east-1_XXXXXXXXX \
  --client-id abcdef1234567890 \
  --auth-flow ADMIN_NO_SRP_AUTH \
  --auth-parameters USERNAME=user@example.com,PASSWORD=YourPassword123
```

Test an endpoint with cURL:
```bash
curl -X GET https://abc123def.execute-api.us-east-1.amazonaws.com/warranties \
  -H "Authorization: Bearer eyJhbGc..."
```

Or use Postman:
1. Import the API Gateway endpoint
2. Add `Authorization` header with Bearer token
3. Create, read, update, delete warranties

---

## Security

### Authentication Layer

Every request (except raw S3 reads) is protected by `authMiddleware`:

1. Extract JWT from `Authorization: Bearer` header
2. Verify signature using Cognito's public keys (RSA256)
3. Check token expiration
4. Extract `userId` (Cognito user ID) and attach to event
5. Proceed to handler or reject with 401

### Authorization Layer

Every database operation includes a `ConditionExpression` preventing one user from accessing another's data:

```javascript
// Example: user cannot delete another user's warranty
const command = new DeleteItemCommand({
  TableName: "warranties",
  Key: {
    id: { S: warrantyId },
    userId: { S: userId }     // From JWT
  }
});
```

If the provided `userId` doesn't match the warranty owner, the delete fails.

### IAM Permissions

Lambda execution role has minimal required permissions:
- DynamoDB: Only `PutItem`, `Query`, `GetItem`, `UpdateItem`, `DeleteItem`
- Cognito: Only `AdminGetUser`, `AdminUpdateUserAttributes`, `AdminSetUserPassword`
- S3: Only `PutObject` (presigned URLs, not direct access)

No permission for `DescribeTable`, `CreateTable`, `DeleteTable`, or cross-account access.

### Data Encryption

- S3: Server-side encryption (SSE-S3) enabled by default
- DynamoDB: Encryption at rest via AWS-managed keys
- Transit: All requests use HTTPS

---

## Cost Analysis

Estimated monthly costs for 1,000 active users:

| Service | Usage | Cost |
|---------|-------|------|
| Lambda | 10M invocations @ 1s average | $2.00 |
| DynamoDB | 100K reads, 50K writes | $0.50 |
| S3 | 100GB storage + 1GB transfer | $2.50 |
| Cognito | 1,000 MAU (free tier included) | $0.00 |
| Bedrock | 1M tokens/month | $0.20 |
| **Total** | | **$5.20/month** |

Compare to traditional infrastructure:
- EC2 + RDS + LoadBalancer: $500–1,000/month minimum
- This serverless solution: ~99% cheaper at scale

---

## Deployment & Management

### Stage-Specific Deployments

Deploy to different environments:
```bash
serverless deploy --stage dev
serverless deploy --stage staging
serverless deploy --stage prod
```

Each stage gets its own Lambda functions, DynamoDB tables, and API Gateway endpoint.

### View Logs

Stream logs from a specific function:
```bash
serverless logs -f createWarranty --tail
serverless logs -f getNotifications --tail
```

### Remove Everything

Tear down the entire stack:
```bash
serverless remove --stage dev
```

This deletes Lambda functions, API Gateway, DynamoDB tables, and S3 buckets.

### Local Testing

Install the offline plugin for local testing:
```bash
npm install --save-dev serverless-offline
sls offline start
```

Then test against `http://localhost:3000` instead of AWS.

---

## Contributing

Contributions are welcome. Please:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -m 'Add your feature'`
4. Push to branch: `git push origin feature/your-feature`
5. Open a Pull Request

---

## License

MIT © 2026 Warrantor

---

## Support

- [Serverless Framework Documentation](https://www.serverless.com/framework/docs)
- [AWS Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [DynamoDB Design Patterns](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)

---

**Built with AWS Serverless Technologies**