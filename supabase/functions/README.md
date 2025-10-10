# Supabase Edge Functions Architecture

This directory contains the edge functions that implement the server-side
business logic for the application. This architecture moves sensitive
operations, validations, and database logic away from the frontend to improve
security, performance, and maintainability.

## 🏗️ Architecture Overview

### Directory Structure

```
supabase/functions/
├── _shared/                 # Shared utilities and libraries
│   ├── auth.ts             # Authentication and authorization helpers
│   ├── config.ts           # Environment configuration
│   ├── database.ts         # Database connection utilities
│   ├── response.ts         # Standardized API responses
│   ├── validation.ts       # Input validation with Zod schemas
│   └── types.ts            # Shared TypeScript types
├── user-management/         # User profile and role management
│   └── index.ts
├── financial-management/    # Financial operations and OCR processing
│   └── index.ts
└── README.md               # This file
```

### Design Principles

1. **Security First**: All sensitive operations happen server-side with proper
   authentication
2. **Input Validation**: Every input is validated using Zod schemas
3. **Role-Based Access**: Fine-grained permissions based on user roles
4. **Standardized Responses**: Consistent API response format across all
   functions
5. **Error Handling**: Comprehensive error handling with proper HTTP status
   codes
6. **Audit Logging**: All sensitive operations are logged for compliance

## 🔧 Shared Libraries

### Authentication (`_shared/auth.ts`)

Handles JWT token validation and role-based access control:

```typescript
// Validate user token and extract user data
const user = await validateAuth(request);

// Check if user has required role
await requireRole(user, ["admin", "super_admin"]);

// Check if user can access specific resource
await requireResourceAccess(user, "user_profile", targetUserId);
```

### Validation (`_shared/validation.ts`)

Provides input validation using Zod schemas:

```typescript
// Validate request body against schema
const data = await validateBody(request, createTransactionSchema);

// Validate query parameters
const params = await validateQuery(request, getUsersQuerySchema);
```

### Response Handling (`_shared/response.ts`)

Standardizes API responses:

```typescript
// Success response
return successResponse(data, { pagination: { page: 1, total: 100 } });

// Error response
return errorResponse(
  "VALIDATION_ERROR",
  "Invalid input",
  400,
  validationErrors,
);
```

## 🚀 Edge Functions

### User Management (`user-management/`)

Handles user profiles, roles, and administrative operations:

**Endpoints:**

- `GET /user-management/me` - Get current user profile
- `PATCH /user-management/me` - Update current user profile
- `GET /user-management` - List users (admin only)
- `POST /user-management/roles` - Update user roles (admin only)
- `PATCH /user-management?userId=uuid` - Admin update user (super admin only)
- `DELETE /user-management?userId=uuid` - Deactivate user (super admin only)

**Features:**

- Profile management with validation
- Role-based access control
- User search and filtering
- Audit logging for role changes
- Email notifications for role updates

### Financial Management (`financial-management/`)

Handles transactions, financial summaries, and OCR processing:

**Endpoints:**

- `GET /financial-management/transactions` - Get user transactions
- `POST /financial-management/transactions` - Create transaction
- `PATCH /financial-management/transactions/:id` - Update transaction
- `DELETE /financial-management/transactions/:id` - Delete transaction
- `GET /financial-management/summary` - Get financial summary
- `POST /financial-management/ocr` - Process OCR job
- `GET /financial-management/ocr` - Get OCR jobs

**Features:**

- Transaction CRUD with validation
- Server-side financial calculations
- Multi-currency support
- OCR processing for receipt automation
- Transaction categorization
- Audit trail for all financial operations

### Invite Codes (`invite-codes/`)

Implements the invite code system for organizations (hubs) inviting
entrepreneurs and super admins inviting organizations.

**Endpoints:**

- `POST /invite-codes` - Create an invite code (admin/hub_manager; super_admin
  can create organization invites)
- `GET /invite-codes/validate?code=...` - Validate an invite code (public)
- `POST /invite-codes/consume` - Consume an invite code after signup; links hub
  association when applicable
- `GET /invite-codes/health` - Health check

**Features:**

- RBAC enforced: hub managers/admins can create entrepreneur invites only; super
  admins can create both
- Invite validation with expiry and single-use enforcement
- On consumption: if invite originated from an organization/hub, the user is
  linked to that hub as entrepreneur. If subscription tables exist, the function
  also auto-assigns the Premium plan using a service-role client (idempotent).
  The response includes assigned_plan and subscription_assigned flags.
- Standardized responses, input validation (Zod), and CORS handling

### Subscriptions (`subscriptions/`)

REST API for managing subscription plans and user subscriptions. Note: Requires
DB tables `subscription_plans` and `user_subscriptions`.

**Plan Endpoints:**

- `GET /subscriptions/plans` - List active plans (public)
- `POST /subscriptions/plans` - Create a plan (super_admin only)
- `PATCH /subscriptions/plans?id=UUID` - Update a plan (super_admin only)
- `DELETE /subscriptions/plans?id=UUID` - Soft-delete (deactivate) a plan
  (super_admin only)

**User Subscription Endpoints:**

- `POST /subscriptions/assign` - Assign a plan to a user (admin/super_admin)
- `GET /subscriptions/me` - Get current user’s active subscription

**Payment:**

- `POST /subscriptions/paystack/initiate` - Initialize a Paystack transaction
  for the authenticated user. Body: `{ plan_id: UUID, callback_url?: string }`.
  Returns `{ authorization_url, access_code, reference }`.
- `POST /subscriptions/paystack/webhook` - Paystack webhook endpoint. Verifies
  signature and, on `charge.success`, activates a user subscription using
  `metadata.user_id` and `metadata.plan_id`.

**Notes:**

- Endpoints return clear errors if the required tables are not yet present.
- Plan management is restricted to super admins initially to keep governance
  tight.
- Period handling is naive for now; real billing periods will be updated via
  Paystack webhooks later.

### Business Templates (`business-templates/`)

Provides CRUD for business templates used to drive dynamic forms and workflows.

**Endpoints:**

- `GET /business-templates` - List active templates (public). Optional query:
  `?tier=free|pro|premium` to filter by subscription tier via
  `template_permissions`.
- `POST /business-templates` - Create template (super admin only)
- `PATCH /business-templates?id=UUID` - Update template (super admin only)
- `DELETE /business-templates?id=UUID` - Soft-delete (deactivate) template
  (super admin only)
- `GET /business-templates/health` - Health check

**Notes:**

- Templates include: `name`, `description`, `category`, `template_config`
  (JSON), `version`, `is_active`.
- Public listing is limited to `is_active=true` templates.
- Permissions: `template_permissions` table maps templates to tiers. During
  development, if no permissions are defined, all active templates are returned;
  otherwise filtering by `tier` is applied.
- Migrations:
  - `20250929_03_business_templates.sql` creates `business_templates` with RLS.
  - `20250929_04_template_permissions.sql` creates `template_permissions` with
    RLS.

## 🔒 Security Features

### Authentication & Authorization

- **JWT Validation**: All requests validate JWT tokens
- **Role-Based Access**: Fine-grained permissions (user, admin, super_admin)
- **Resource Access Control**: Users can only access their own data
- **Service Role Protection**: Admin operations use service role key

### Input Validation & Sanitization

- **Zod Schema Validation**: All inputs validated against TypeScript schemas
- **XSS Prevention**: String sanitization to prevent cross-site scripting
- **SQL Injection Protection**: Parameterized queries through Supabase client
- **Rate Limiting**: Built-in edge function rate limiting

### Data Security

- **Row Level Security (RLS)**: Database policies enforce user access
- **Audit Logging**: All sensitive operations logged with user context
- **Data Encryption**: Sensitive data encrypted at rest in Supabase
- **HTTPS Only**: All communications over encrypted channels

## 📊 Performance Optimizations

### Caching Strategy

- **Query Optimization**: Efficient database queries with proper indexes
- **Response Caching**: Cache frequently accessed data
- **Connection Pooling**: Managed by Supabase's pgBouncer

### Monitoring

- **Performance Metrics**: Response times, error rates, and throughput
- **Structured Logging**: JSON logs for easy parsing and analysis
- **Health Checks**: Endpoint health monitoring
- **Cold Start Optimization**: Minimal function initialization

## 🧪 Testing

### Local Testing

```bash
# Start local Supabase
npm run supabase:start

# Deploy functions locally
npm run supabase:deploy

# Run integration tests
npm run test:edge-functions
```

### Staging/Production Testing

```bash
# Smoke tests
npm run test:smoke -- --env=staging

# Performance tests
npm run test:performance

# Health checks
npm run test:health -- --env=production
```

### Test Coverage

- **Unit Tests**: Individual function handlers
- **Integration Tests**: Full request/response cycles
- **Authorization Tests**: Role-based access verification
- **Error Handling Tests**: Invalid inputs and edge cases
- **Performance Tests**: Response time and throughput

## 🚀 Deployment

### Automated Deployment

GitHub Actions automatically:

1. Runs linting and type checking
2. Performs security scans with Semgrep
3. Runs integration tests locally
4. Deploys to staging on PR
5. Deploys to production on main branch merge
6. Runs smoke tests and performance monitoring

### Manual Deployment

```bash
# Deploy to staging
supabase functions deploy --project-ref staging-ref

# Deploy to production
supabase functions deploy --project-ref prod-ref

# Set environment variables
supabase secrets set KEY=value --project-ref project-ref
```

## 🔧 Development

### Adding New Functions

1. Create new directory under `supabase/functions/`
2. Implement `index.ts` with proper error handling
3. Use shared libraries for auth, validation, and responses
4. Add tests in the test suite
5. Update deployment workflow if needed

### Best Practices

- **Use TypeScript**: Strong typing prevents runtime errors
- **Validate All Inputs**: Use Zod schemas for validation
- **Handle Errors Gracefully**: Return proper HTTP status codes
- **Log Important Events**: Use structured logging
- **Follow Naming Conventions**: Consistent naming across functions
- **Document Changes**: Update README and API documentation

### Local Development Workflow

```bash
# Start local development environment
npm run supabase:start

# Make changes to functions
# (Edit files in supabase/functions/)

# Deploy changes locally
npm run supabase:deploy

# Test changes
npm run test:edge-functions

# Stop local environment
npm run supabase:stop
```

## 📋 Environment Variables

Functions require these environment variables:

```bash
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
RESEND_API_KEY=your_resend_api_key  # Optional, for email functions
```

Set these in Supabase Dashboard > Settings > Edge Functions or via CLI:

```bash
supabase secrets set SUPABASE_URL=your_value --project-ref your-project-ref
```

## 🚨 Troubleshooting

### Common Issues

1. **Function Not Found (404)**
   - Check function deployment: `supabase functions list`
   - Verify function name matches directory name
   - Ensure function is properly exported

2. **Authentication Errors (401/403)**
   - Verify JWT token is valid and not expired
   - Check user has required role for endpoint
   - Ensure Authorization header format: `Bearer <token>`

3. **Validation Errors (400)**
   - Check request body matches expected schema
   - Verify Content-Type header is `application/json`
   - Review validation error details in response

4. **Database Connection Issues**
   - Verify Supabase environment variables
   - Check RLS policies allow operation
   - Review database logs for connection errors

### Debugging

```bash
# Check function logs
supabase functions logs function-name --project-ref your-project-ref

# Local debugging with console.log
console.log(JSON.stringify({ level: 'debug', data: someData }));

# Test with curl
curl -X GET \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  https://your-project-ref.supabase.co/functions/v1/user-management/me
```

## 📚 Additional Resources

- [Supabase Edge Functions Documentation](https://supabase.com/docs/guides/functions)
- [Deno Deploy Documentation](https://deno.com/deploy/docs)
- [Database Schema and RLS Policies](../migrations/)
- [Frontend API Integration Guide](../../src/lib/api-client.ts)

---

For questions or issues, check the function logs in the Supabase Dashboard or
run local tests to debug problems.

## 📦 Default Subscription Plans

A migration seeds default plans (idempotent): Free, Pro, and Premium.

- Migration file:
  supabase/migrations/20250929_02_seed_default_subscription_plans.sql
- Uniqueness is enforced on lower(name) to avoid duplicates across environments.
- Features JSON is permissive during development: all entrepreneur features
  enabled; limits included for guidance only.

You can list active plans via GET /subscriptions/plans after running migrations.
