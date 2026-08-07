# InvoiceFlow Implementation Roadmap

## 1. PURPOSE

This document defines the proposed implementation sequence from P1 through production delivery. It becomes authoritative after approval.

- Scope changes require explicit review.
- Later phases must not begin while their blocking dependencies are unresolved.
- Security, testing and documentation are part of implementation, not optional cleanup work.
- CI failure blocks normal progression when the CI job actually executes project validation and fails.
- External infrastructure failures are handled separately from project defects.

## 2. IMPLEMENTATION PRINCIPLES

- Backend-first development
- Contract-first APIs
- Database integrity before dependent services
- Security controls implemented with the feature they protect
- Tests implemented with each feature
- No large unreviewable phase commits
- No mixing unrelated phases
- No premature frontend integration
- No production deployment before release hardening
- Every phase ends with evidence and approval

## 3. HIGH-LEVEL ROADMAP

P1 — Backend Engineering Foundation
P2 — Database Foundation
P3 — Authentication and User Management
P4 — Business Settings and Client Management
P5 — Invoice Engine and GST
P6 — Invoice Lifecycle, PDF and Email
P7 — Payments, Dashboard and Audit
P8 — Frontend Integration
P9 — Hardening, E2E and Release Candidate
P10 — Deployment, Handover and V1 Closure

| Phase | Name                                    | Primary outcome                     | Depends on | Approximate effort | Primary risk                  | Approval gate                          |
| ----- | --------------------------------------- | ----------------------------------- | ---------- | ------------------ | ----------------------------- | -------------------------------------- |
| P1    | Backend Engineering Foundation          | Robust API shell & testing setup    | P0         | 1 week             | Incorrect configuration       | CI & tests pass, health works          |
| P2    | Database Foundation                     | Core schema, migrations, connection | P1         | 1 week             | Flawed constraints            | DB tests pass, migrations clean        |
| P3    | Authentication and User Management      | Login, session, RBAC                | P2         | 1.5 weeks          | Session security              | Auth tests pass, no token leaks        |
| P4    | Business Settings and Client Management | Client & business APIs              | P3         | 1 week             | RBAC/authorization failures   | Integration & security tests pass      |
| P5    | Invoice Engine and GST                  | Invoice creation, tax rules         | P4         | 1.5 weeks          | Floating-point or GST errors  | Financial units & snapshot tests pass  |
| P6    | Invoice Lifecycle, PDF and Email        | Immutable invoices, PDF, emails     | P5         | 1 week             | Delivery state mismatches     | Mocks pass, exact PDF matches          |
| P7    | Payments, Dashboard and Audit           | Payment handling, metrics           | P6         | 1 week             | Race conditions               | Reconciliations pass, concurrency safe |
| P8    | Frontend Integration                    | Full Next.js UI integration         | P7         | 2 weeks            | Contract divergence           | Protected screens work, flows pass     |
| P9    | Hardening, E2E and Release Candidate    | Security, testing, RC ready         | P8         | 1.5 weeks          | Undiscovered critical bugs    | 0 critical/high bugs, E2E passes       |
| P10   | Deployment, Handover and V1 Closure     | Live production environment         | P9         | 1 week             | Production configuration bugs | Smoke test passes, CI green            |

## 4. P1 — BACKEND ENGINEERING FOUNDATION

**P1 Outcome:**
A production-grade Express/TypeScript backend shell with configuration, observability, validation, standardized errors and real test infrastructure.

**Expected work:**

- Express installation and setup
- Application bootstrap
- Environment validation
- App configuration module
- Request ID middleware
- Logging foundation
- Helmet/security headers
- CORS foundation
- Rate-limiter foundation
- Central error classes
- Global error middleware
- API response helpers
- Health endpoint
- Versioned `/api/v1` router
- Zod middleware
- Real test runner
- Supertest
- Coverage configuration
- Test helpers
- Remove P0.7 placeholder test
- CI updates required for real tests
- Environment examples update

**P1 must NOT include:**

- Prisma schema
- Database migrations
- Login implementation
- User accounts
- Client APIs
- Invoice APIs

**Approval gate:**

- API starts locally
- `/health` works
- `/api/v1` router exists
- invalid routes return approved error envelope
- startup configuration fails securely on missing required values
- test runner executes real tests
- placeholder echo removed
- security middleware foundation present
- all validation commands pass
- CI passes

## 5. P2 — DATABASE FOUNDATION

**Expected work:**

- Prisma installation/configuration
- PostgreSQL/Supabase development connection
- Core Prisma schema
- migrations
- enums
- indexes
- constraints
- seed strategy
- runtime DB connection handling
- repository foundation
- transaction helper policy
- integration database test environment

**Expected core domains include:**

- User
- Session
- BusinessSettings
- Client
- Invoice
- InvoiceItem
- InvoiceCounter
- Payment
- EmailDelivery
- AuditLog

_(Do not freeze every field again if P0.6 already owns the schema contract. Reference the approved database design instead of contradicting it.)_

**Approval gate:**

- fresh database migration succeeds
- migration status clean
- Prisma generation succeeds
- database constraints tested
- no unsafe production data
- integration-test DB works
- CI passes

## 6. P3 — AUTHENTICATION AND USER MANAGEMENT

**Expected work:**

- initial SUPER_ADMIN provisioning strategy
- login
- logout
- logout-all
- access JWT
- refresh-session creation
- refresh rotation
- replay detection
- session revocation
- account deactivate/reactivate
- staff/viewer provisioning
- password reset by approved admin workflow
- Argon2id password hashing
- RBAC middleware
- CSRF implementation
- auth rate limiting
- security audit events

**Required tests:**

- login success/failure
- generic failure response
- disabled account
- cookie attributes
- refresh
- replay
- CSRF
- role boundaries
- logout
- logout-all
- session revocation

**Approval gate:**

- security tests pass
- auth integration tests pass
- no token storage in browser-accessible persistence
- no account enumeration
- CI passes

## 7. P4 — BUSINESS SETTINGS AND CLIENT MANAGEMENT

**Expected work:**
Business settings:

- legal/business name
- invoice address
- GSTIN
- PAN where required
- state/state code
- contact information
- logo reference
- invoice defaults
- bank/payment display details

Clients:

- create
- read
- update
- deactivate/archive according to approved policy
- GST/customer location data
- place-of-supply support
- search
- pagination
- role restrictions

_(Logo upload security must follow P0.8B.)_

**Approval gate:**

- business settings validated
- client CRUD/business rules correct
- RBAC correct
- upload validation correct
- integration/security tests pass
- CI passes

## 8. P5 — INVOICE ENGINE AND GST

**Expected work:**

- invoice draft creation
- atomic financial-year invoice numbering
- line items
- SAC code
- quantity
- rate
- discount
- taxable amount
- GST rate
- CGST/SGST
- IGST
- place-of-supply decision
- totals
- rounding
- due date
- invoice snapshots
- draft editing
- duplication

**Freeze:**

- **Invoice numbering example:** INV/26-27/0001
- **Maximum invoice-number length:** 16 characters
- **Invoice state values:** DRAFT, SENT, PARTIALLY_PAID, PAID, CANCELLED (OVERDUE is derived).
- **Financial rules:**
  - no JS floating-point money
  - backend authoritative
  - ROUND_HALF_UP
  - decimal strings at boundaries
  - transactions
  - atomic sequence

**Approval gate:**

- financial unit tests
- GST boundary tests
- concurrency test for numbering
- snapshot integrity
- integration tests
- CI passes

## 9. P6 — INVOICE LIFECYCLE, PDF AND EMAIL

**Expected work:**

- send invoice
- immutable sent snapshot
- PDF DTO
- PDF generation
- secure storage strategy
- invoice email
- Resend integration
- React Email template
- email delivery record
- idempotency
- provider failure handling
- cancellation rules
- cancellation reason
- duplicate/retry protection

**Critical rule:**
Do not mark an invoice SENT merely because email sending was requested. Provider acceptance and invoice-state transitions must follow the approved workflow.

**Approval gate:**

- generated PDF matches stored invoice snapshot
- email provider mocked tests
- email idempotency tests
- failed provider request does not create false success
- cancellation rules tested
- CI passes

## 10. P7 — PAYMENTS, DASHBOARD AND AUDIT

**Payments:**

- record payment
- partial payment
- full payment
- overpayment rejection
- concurrent payment protection
- idempotency
- reversal workflow

**Dashboard MVP:**
`GET /api/v1/dashboard/summary`

Metrics should include approved MVP values such as:

- outstanding amount
- paid amount
- invoice status counts
- recent invoices
- recent payments where appropriate
  _(Do not build advanced reports in MVP.)_

**Audit:**
Critical backend events only.

**Approval gate:**

- payment totals reconcile
- concurrency protection works
- dashboard figures reconcile
- audit events generated
- CI passes

## 11. P8 — FRONTEND INTEGRATION

Backend implementation should be sufficiently stable before full integration.

**Expected work:**

- Next.js application foundation if not already complete
- same-origin `/api/v1` proxy
- authentication state
- protected navigation
- role-aware UI
- business settings
- clients
- invoices
- PDF/download/send experience
- payments
- dashboard
- error/loading/empty states
- accessibility
- responsive design

_(Frontend must not duplicate backend-authoritative GST or financial calculations.)_

**Approval gate:**

- frontend consumes real backend
- cookies/session flow works
- no tokens in localStorage
- protected screens enforce backend rules
- critical browser journeys pass
- CI passes

## 12. P9 — HARDENING AND RELEASE CANDIDATE

**Expected work:**

- full integration tests
- security regression suite
- Playwright E2E
- permission matrix
- IDOR
- CSRF
- CORS
- rate limits
- upload abuse
- mass assignment
- SQL-injection review
- XSS review
- dependency audit
- accessibility review
- performance review
- logging redaction
- backup/restore validation
- production-like smoke tests

**Approval gate:**

- zero unresolved critical security defects
- zero unresolved high exploitable security defects
- coverage thresholds pass
- E2E passes
- CI passes
- release candidate approved

## 13. P10 — DEPLOYMENT AND V1 CLOSURE

**Expected work:**

- Render backend
- Vercel frontend
- Supabase production database/storage
- production secrets
- domains
- HTTPS
- CORS
- monitoring
- Sentry
- database migrations
- secure initial SUPER_ADMIN
- production smoke test
- rollback procedure
- README
- API docs
- deployment guide
- user/admin guide where required
- final demo
- v1 release tag only after approval

**Approval gate:**

- production smoke test passes
- monitoring works
- rollback documented
- no secrets exposed
- final CI green
- final client review approved

## 14. DEPENDENCY MAP

```text
P1 Foundation
   ↓
P2 Database
   ↓
P3 Authentication
   ↓
P4 Business/Clients
   ↓
P5 Invoice Engine
   ↓
P6 PDF/Email Lifecycle
   ↓
P7 Payments/Dashboard/Audit
   ↓
P8 Frontend Integration
   ↓
P9 Hardening
   ↓
P10 Deployment
```

**Permitted parallel work where safe:**

- UI design can progress while backend implementation continues.
- Email template design may progress before provider integration.
- Documentation can be continuously updated.
  _(Do not create dependencies that risk schema or contract divergence.)_

## 15. MILESTONE PLAN

- **M1 — Backend skeleton operational**: Deliverable: Configured API; Evidence: CI/Health endpoint; Blocker: Express issues; Authority: Boss.
- **M2 — Database stable**: Deliverable: Schema deployed; Evidence: DB tests pass; Blocker: Migration fails; Authority: Boss.
- **M3 — Authentication secure**: Deliverable: RBAC working; Evidence: Security tests; Blocker: Session gaps; Authority: Boss.
- **M4 — Client/business foundation complete**: Deliverable: Business Settings and Client APIs; Evidence: Integration tests; Blocker: IDOR; Authority: Boss.
- **M5 — Invoice engine correct**: Deliverable: Math/GST perfect; Evidence: Calculation tests; Blocker: Floating point issues; Authority: Boss.
- **M6 — Invoice delivery complete**: Deliverable: Email/PDF; Evidence: Snapshots/Mocks; Blocker: Storage fails; Authority: Boss.
- **M7 — Payment/dashboard backend complete**: Deliverable: Sync logic; Evidence: Concurrency tests; Blocker: Race conditions; Authority: Boss.
- **M8 — Full-stack integration complete**: Deliverable: Working UI; Evidence: Frontend E2E; Blocker: Contract breaks; Authority: Boss.
- **M9 — Release candidate**: Deliverable: Hardened app; Evidence: Security pass; Blocker: High vulns; Authority: Boss.
- **M10 — V1 production release**: Deliverable: Deployed product; Evidence: Live smoke tests; Blocker: Infrastructure; Authority: Boss.

## 16. ESTIMATED PROJECT SCHEDULE

- **Phase duration**: Variable depending on scope
- **Cumulative duration**: 30–40 days (4–6 weeks) target for a disciplined college-level MVP from P1 onwards.
- **Critical-path dependencies**: P1 -> P2 -> P3 -> P4 -> P5 -> P6 -> P7 -> P8 -> P9 -> P10.

## 17. DAILY DEVELOPMENT LOOP

1. Confirm approved task.
2. Pull backend branch.
3. Confirm clean working tree.
4. Implement only approved scope.
5. Add tests.
6. Format.
7. Lint.
8. Typecheck.
9. Test.
10. Build.
11. Review diff.
12. Commit.
13. Push.
14. Verify CI.
15. Submit evidence.
16. Receive boss approval.

## 18. PHASE EVIDENCE REQUIREMENTS

Every future implementation phase must provide:

- phase/task name
- branch
- base SHA
- final SHA
- changed-file list
- architecture impact
- database impact
- migration evidence where applicable
- tests and exact results
- coverage when applicable
- format result
- lint result
- typecheck result
- build result
- security result
- git diff --check
- clean-tree evidence
- remote divergence
- CI run URL/result
- known limitations
- rollback/recovery notes

## 19. CHANGE CONTROL

Any new feature must be classified:

- Required now
- Approved scope correction
- V1.0
- Future
- Rejected

_(Do not silently insert features into the MVP.)_

Any change affecting authentication, database schema, invoice calculation, permissions, payment logic, or deployment architecture requires explicit architecture review.

## 20. IMPLEMENTATION ROADMAP APPROVAL STATUS

Document: InvoiceFlow Implementation Roadmap
Phase: P0.9
Status: Proposed — pending boss review
Applies from: Approval commit onward
