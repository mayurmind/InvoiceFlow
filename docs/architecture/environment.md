# Production Environment Configuration

This document outlines the environment variables required to run InvoiceFlow in production.
Never commit real values to version control.

## Backend (API) Configuration

The following variables must be provided to the `apps/api` container.

### Core Configuration
| Variable | Description | Example / Default |
|---|---|---|
| `NODE_ENV` | Must be `production` | `production` |
| `PORT` | The port the API binds to | `5000` |
| `HOST` | The host binding address | `0.0.0.0` |
| `LOG_LEVEL` | Pino log level (`fatal`, `error`, `warn`, `info`, `debug`, `trace`) | `info` |
| `CORS_ALLOWED_ORIGINS` | Comma-separated list of allowed frontend origins | `https://app.invoiceflow.com` |
| `FRONTEND_URL` | The primary URL of the frontend (used for redirects/emails) | `https://app.invoiceflow.com` |

### Database (Prisma / PostgreSQL)
| Variable | Description |
|---|---|
| `DATABASE_URL` | Connection string for migrations and standard queries. If using PgBouncer, point this to the pooler. |
| `DIRECT_URL` | Direct connection string to the database (used by Prisma migrations if `DATABASE_URL` is a pooler). |

### Security & Authentication
> **CRITICAL**: These secrets must be cryptographically secure, random strings (e.g., generated via `openssl rand -hex 32`). Do not reuse them across environments.

| Variable | Description |
|---|---|
| `ACCESS_TOKEN_SECRET` | Secret key for signing short-lived JWT Access Tokens. |
| `REFRESH_TOKEN_SECRET` | Secret key for signing long-lived JWT Refresh Tokens. |
| `CSRF_SECRET` | Secret key for generating and verifying CSRF tokens. |
| `ACCESS_TOKEN_TTL` | Expiry time for access tokens (e.g., `15m`). |
| `REFRESH_TOKEN_TTL` | Expiry time for refresh tokens (e.g., `7d`). |
| `JWT_ISSUER` | String identifying the token issuer (e.g., `invoiceflow-api`). |
| `JWT_AUDIENCE` | String identifying the intended audience (e.g., `invoiceflow-web`). |

### Super Admin Bootstrap
These variables are required *only* during the initial database provisioning to create the first `SUPER_ADMIN` user.
| Variable | Description |
|---|---|
| `SUPER_ADMIN_EMAIL` | The email address for the initial admin. |
| `SUPER_ADMIN_PASSWORD` | The password for the initial admin (they will be forced to change it on first login). |

### Supabase Storage
| Variable | Description |
|---|---|
| `SUPABASE_URL` | Base URL of the Supabase project. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key for bypassing RLS and accessing storage. |
| `SUPABASE_STORAGE_BUCKET` | The name of the bucket used to store business assets (e.g., `business-assets`). |

### Email Delivery
| Variable | Description | Example |
|---|---|---|
| `EMAIL_PROVIDER` | The active email provider. | `mock`, `smtp`, `resend`, `sendgrid` |
| `EMAIL_FROM_ADDRESS` | The sender address for system emails. | `noreply@invoiceflow.com` |
| `EMAIL_FROM_NAME` | The sender name for system emails. | `InvoiceFlow` |
| `SMTP_HOST` | (If `EMAIL_PROVIDER=smtp`) SMTP server host. | `smtp.mailgun.org` |
| `SMTP_PORT` | (If `EMAIL_PROVIDER=smtp`) SMTP port. | `587` |
| `SMTP_USER` | (If `EMAIL_PROVIDER=smtp`) SMTP username. | |
| `SMTP_PASS` | (If `EMAIL_PROVIDER=smtp`) SMTP password. | |

---

## Frontend (Web) Configuration

The Next.js application requires variables at build time and runtime.
*(Note: Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser.)*

| Variable | Description | Example |
|---|---|---|
| `NODE_ENV` | Must be `production` | `production` |
| `NEXT_PUBLIC_API_URL` | The public URL where the backend API is accessible. | `https://api.invoiceflow.com/api/v1` |
