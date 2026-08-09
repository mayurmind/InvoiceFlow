# InvoiceFlow Security Baseline

## 1. Purpose and Scope

This baseline applies to:

- Frontend
- Backend
- Authentication
- Authorization
- Sessions
- Database
- File storage
- Email
- Logging
- Audit records
- CI/CD
- Deployment
- Third-party services

Security is mandatory and cannot be treated as optional hardening after implementation.

## 2. Core Security Principles

Require:

- Deny by default
- Least privilege
- Defence in depth
- Secure defaults
- Server-side enforcement
- No trust in frontend input
- Fail securely
- Minimize sensitive data
- Explicit authorization
- No hidden security failures
- No security bypass merely for development convenience

## 3. Account Provisioning

- No public registration in MVP
- Only SUPER_ADMIN creates users
- SUPER_ADMIN may create STAFF and VIEWER accounts
- Initial SUPER_ADMIN is provisioned securely during deployment
- Account creation is audited
- Account activation and deactivation are audited
- Email addresses are normalized before lookup
- Duplicate normalized emails are prohibited
- Temporary credentials must be changed securely
- Disabled accounts cannot receive usable sessions
- The final active SUPER_ADMIN cannot be accidentally removed, demoted or disabled

## 4. Password Security

Use Argon2id for new password hashes.

Initial minimum configuration:

- Memory: at least 19 MiB
- Iterations: at least 2
- Parallelism: at least 1

Password policy:

- Minimum length: 15 characters while MFA is unavailable
- Maximum length: at least 64 characters
- Allow spaces
- Allow Unicode
- Allow password-manager-generated passwords
- No mandatory uppercase/lowercase/symbol pattern
- No silent truncation
- Block known compromised passwords where practical
- Do not force periodic password changes without evidence of compromise
- Require change after administrator reset or suspected compromise

Never:

- Store plaintext passwords
- Store reversibly encrypted passwords
- Log passwords
- Return password hashes
- Expose password-policy internals in unsafe detail

## 5. Login Security

Require:

- Generic login-failure response
- No account enumeration
- Authentication failure does not reveal whether an email exists
- Disabled users receive no session
- lastLoginAt updates only after success
- Successful and failed attempts are logged safely
- Login is rate-limited
- Brute-force protections must not allow easy denial-of-service account locking
- Re-authentication is required before highly sensitive account operations
- HTTPS is mandatory in production

## 6. Token Architecture

- Access-token lifetime: 15 minutes
- Refresh-session lifetime: 7 days

Require:

- Separate access and refresh secrets
- Strong random secrets
- Explicitly allowed signing algorithms
- Validate issuer
- Validate audience
- Validate expiration
- Validate token type
- Never accept unsigned tokens
- Never place sensitive business information in JWT claims
- Never log complete tokens
- Tokens must include only the claims required for authentication and authorization

## 7. Secure Cookie Rules

Production authentication cookies must use:

- HttpOnly
- Secure
- Path=/
- SameSite=Lax or SameSite=Strict
- No Domain attribute

Preferred production cookie names:

- __Host-invoiceflow-access
- __Host-invoiceflow-refresh

Never store access tokens, refresh tokens or session identifiers in:

- localStorage
- sessionStorage
- IndexedDB
- Persistent frontend state
- URLs

Safe development-cookie differences:

- `Secure` and `__Host-` prefixes may be omitted during local `http://localhost` development without weakening production requirements.

## 8. Refresh Session Security

Persist only a cryptographic hash of each refresh token.

A refresh-session record must support:

- User ID
- Secure token hash
- Token-family identifier
- Expiration
- Creation timestamp
- Last-used timestamp
- Rotation timestamp
- Revocation timestamp
- Replacement-session reference
- Safe IP metadata
- Safe user-agent metadata

Require:

- Rotation on every successful refresh
- Reuse detection
- Entire family revocation following replay
- Current-session logout
- Logout-all
- Revocation after password change
- Revocation after password reset
- Revocation after account deactivation
- Revocation after security-sensitive role changes
- Expired and revoked sessions cannot be refreshed

## 9. CSRF Protection

State clearly that HttpOnly cookies alone do not prevent CSRF.

Every state-changing cookie-authenticated request must use:

- Same-origin proxy
- Origin verification
- Referer fallback where appropriate
- Signed session-bound CSRF token or an equivalent approved method
- Custom CSRF header
- Rejection of missing or invalid CSRF evidence
- No state-changing GET routes

Login, logout, refresh and sensitive financial operations require CSRF analysis.

## 10. Authorization and RBAC

Require:

- Authentication and authorization remain separate
- Backend authorization is mandatory
- UI hiding is not authorization
- Deny by default
- Every protected route declares allowed roles
- Sensitive services enforce business authorization
- Resource access is checked for every request
- Prevent IDOR
- Avoid revealing unauthorized resource existence
- Role changes revoke affected active sessions
- The final active SUPER_ADMIN is protected

Define broad MVP permissions:

SUPER_ADMIN:

- Full approved MVP administration
- User provisioning
- Business settings
- Client and invoice management
- Payment management
- Audit access

STAFF:

- Approved operational client, invoice and payment work
- No user administration
- No security-setting management
- No final SUPER_ADMIN-level actions

VIEWER:

- Read-only approved business data
- No writes
- No user administration
- No security changes
- No detailed security audit access

## 11. CORS and Proxy Security

Normal browser traffic uses the same-origin Next.js proxy.

When CORS is required:

- Exact allowlisted origins only
- Credentials only with approved origins
- Never use wildcard origin with credentials
- Restrict methods
- Restrict headers
- Do not reflect arbitrary Origin values
- Separate development and production allowlists
- Reject missing or unapproved production origins

## 12. Rate Limiting and Abuse Prevention

Initial minimum policy:

POST /api/v1/auth/login

- 5 attempts per 15 minutes
- Keyed safely by IP and normalized account identifier
- Do not store raw email values in limiter keys

POST /api/v1/auth/refresh

- 10 requests per 15 minutes per session/IP

POST /api/v1/invoices/:id/send

- 10 requests per hour per authenticated user

Other authenticated API routes:

- 100 requests per 15 minutes per user

Require:

- Standard 429 RATE_LIMITED error
- Shared production storage when multiple API instances exist
- Safe abuse logging
- Stricter future reset-password limits
- Limits must remain configurable without disabling them in production

## 13. Security Headers

Require Helmet or equivalent controls for:

- Content Security Policy
- HSTS in production
- X-Content-Type-Options
- Frame protection
- Referrer Policy
- Permissions Policy where applicable

Do not disable headers globally merely to solve local errors.

## 14. Input Validation and Mass Assignment

Require:

- Zod validation for body, query, params and environment variables
- Reject unknown fields for authentication and financial writes
- Allowlisted update objects
- Never pass complete request bodies directly into Prisma
- Validate UUIDs
- Validate enums
- Validate dates
- Validate pagination
- Allowlist sorting
- Normalize email addresses
- Normalize GST identifiers
- Database constraints remain mandatory
- Validation occurs before service execution

## 15. File Upload Security

MVP supports only business-logo uploads.

Freeze:

- Formats: PNG, JPEG and WebP
- SVG prohibited
- Maximum file size: 2 MB
- Maximum files per request: 1
- SUPER_ADMIN only

Require:

- Extension validation
- Declared MIME validation
- Actual file-signature validation
- Random storage filename
- Never trust original filename
- Reject executable or suspicious polyglot content
- CSRF protection
- Request-size limits
- Rate limiting
- Safe replacement of existing logos
- Supabase service-role key remains backend-only
- Uploads stored only in approved storage bucket

## 16. Secret Management

Require:

- No secrets in Git
- No secrets in frontend bundles
- No secrets in screenshots
- No secrets in logs
- Separate development and production secrets
- Immediate rotation after exposure
- Vercel, Render, Supabase and GitHub secret stores
- Separate access and refresh secrets
- SUPABASE_SERVICE_ROLE_KEY is server-only
- `.env.example` contains placeholders only
- Startup fails when required configuration is missing

## 17. Database Security

Require:

- Least-privilege runtime credentials
- Separate migration privileges where practical
- No database URLs in logs
- Prisma parameterized queries
- Reviewed and parameterized raw SQL
- Foreign keys
- Unique constraints
- Check constraints
- Transactions for financial writes
- No production data in tests
- Documented backup and restoration process
- Destructive migrations require explicit review

## 18. Logging and Audit Security

Audit:

- Authentication success and failure
- Authorization failure
- Session creation
- Session rotation
- Session revocation
- User creation
- User deactivation
- Role changes
- Business-setting changes
- Invoice sending
- Invoice cancellation
- Payment creation
- Payment reversal
- Suspicious validation failures
- Provider failures
- Upload rejection

Never log:

- Passwords
- Password hashes
- Access tokens
- Refresh tokens
- Cookies
- JWT secrets
- Database URLs
- Service-role keys
- Resend API keys
- Full bank-account information
- Sensitive request bodies
- Unnecessary personal data

## 19. Error Response Security

Require:

- No production stack traces
- No Prisma messages
- No PostgreSQL messages
- No raw provider errors
- Stable application error codes
- Safe request ID
- Secure internal logs
- Enumeration-resistant authentication errors
- Partial failures must never return false success

## 20. Third-Party Provider Security

Apply to:

- Supabase
- Resend
- Sentry
- Vercel
- Render

Require:

- Server-side credentials
- Least privilege
- Timeouts
- Safe provider-error mapping
- Minimum necessary personal data
- Webhook-signature verification when webhooks are added
- Invoice-email idempotency
- Credential rotation following suspected exposure

## 21. Supply Chain Security

Require:

- Committed lockfile
- Frozen-lockfile CI installation
- Dependency-review evidence
- Audit checks
- Avoid abandoned packages
- Approved GitHub Action versions or pinned SHAs
- Critical vulnerabilities block release
- Audit suppression requires documented risk acceptance
- Dependabot introduction is governed by P0.8E

## 22. Security Test Requirements

Future implementation must cover:

- Authentication success and failure
- Account enumeration resistance
- Disabled accounts
- Token expiration
- Refresh rotation
- Refresh replay
- Current logout
- Logout-all
- CSRF rejection
- RBAC boundaries
- IDOR
- Rate limits
- CORS
- Security headers
- Mass assignment
- Validation
- Upload rejection
- Secret leakage
- Audit records

## 23. Incident Response

1. Contain the issue.
2. Revoke affected sessions.
3. Rotate exposed credentials.
4. Preserve safe evidence.
5. Identify affected users and records.
6. Fix and test the root cause.
7. Document the incident.
8. Add regression coverage.
9. Redeploy only after approval.

## 24. Security Definition of Done

A security-sensitive feature is complete only when:

- Threats were identified
- Input validation exists
- Authentication is correct
- Authorization is server-side
- CSRF requirements are met
- Rate limits exist
- Secrets remain protected
- Logs contain no secrets
- Security tests pass
- CI passes
- Documentation is updated
- No unresolved critical or high issue exists
- Boss review approves it

## 25. Approval Status

Document: InvoiceFlow Security Baseline
Phase: P0.8B
Status: Proposed — pending boss review
Applies from: Approval commit onward
