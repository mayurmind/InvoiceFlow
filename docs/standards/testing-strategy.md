# InvoiceFlow Testing Strategy

## 1. Purpose

Tests protect:

- Financial correctness
- Authentication
- Authorization
- Data integrity
- State transitions
- Provider interactions
- Regression safety

## 2. Testing Principles

Require:

- Test behaviour, not implementation details
- Deterministic tests
- Isolated tests
- No order dependency
- Clear arrange-act-assert structure
- No hidden failures
- No real production services
- No production secrets
- Every bug fix should receive regression coverage where technically reasonable

## 3. Test Layers

### Unit Tests

For:

- Pure utilities
- Financial calculations
- GST calculations
- Date rules
- State-transition logic
- Validation helpers

### Service Tests

For:

- Business rules
- Workflow orchestration
- Permission-sensitive decisions
- Transactions
- Provider coordination

### Repository Integration Tests

For:

- Real Prisma behaviour
- PostgreSQL constraints
- Transactions
- Unique constraints
- Query filters
- Pagination
- Concurrency-sensitive behaviour

Mock-only tests are not enough for repository correctness.

### API Integration Tests

For:

- Middleware
- Validation
- Authentication
- RBAC
- Controllers
- Service integration
- Error envelopes
- HTTP statuses
- Cookies
- CSRF
- Rate limits

### Security Tests

For:

- Authentication failure
- Session replay
- CSRF
- IDOR
- Role escalation
- Mass assignment
- CORS
- Headers
- Upload rejection

### End-to-End Tests

For critical user journeys after frontend integration:

- Login
- Client creation
- Invoice creation
- Invoice sending
- Payment recording
- Dashboard verification

## 4. Approved Tool Direction

The planned direction (without installing packages):

- Vitest or Jest for unit and service tests
- Supertest for Express API tests
- Testcontainers or approved isolated PostgreSQL/Supabase test database for integration
- Playwright for frontend E2E
- Coverage through the selected test runner

Final package selection occurs during implementation and must remain compatible with the monorepo.

## 5. Test Directory Standards

Expected backend layout:

```text
apps/api/tests/
├── unit/
├── integration/
├── security/
├── e2e/
├── fixtures/
└── helpers/
```

Use names such as:

- `invoice.service.spec.ts`
- `payment.repository.integration.spec.ts`
- `auth.security.spec.ts`
- `invoice-lifecycle.e2e.spec.ts`

## 6. Test Data Rules

Require:

- Synthetic data only
- No production personal data
- No real credentials
- Deterministic UUIDs where helpful
- Unique test data where parallel execution occurs
- Cleanup after integration tests
- Independent fixtures
- No dependence on test execution order

## 7. Mocking Rules

Mocks are acceptable for:

- Email provider
- Storage provider
- Time source
- External monitoring
- Network failures

Mocks must not hide:

- PostgreSQL constraints
- Prisma behaviour
- Transactions
- Concurrency
- Authorization
- Real validation contracts

## 8. Financial Testing Requirements

Mandatory coverage for:

- Zero values
- Decimal quantities
- Discounts
- Taxable values
- CGST/SGST
- IGST
- Multiple tax rates
- ROUND_HALF_UP boundaries
- Line-total reconciliation
- Invoice-total reconciliation
- Partial payments
- Exact full payment
- Overpayment rejection
- Concurrent payment protection
- Cancellation rules
- Immutable sent snapshots

## 9. Authentication and Session Tests

Require:

- Correct login
- Incorrect login
- Generic failure response
- Disabled account
- Expired access token
- Expired refresh session
- Refresh rotation
- Refresh replay
- Session-family revocation
- Current logout
- Logout-all
- Role-change revocation
- Password-reset revocation
- Cookie flags
- CSRF rejection

## 10. RBAC Matrix Testing

Require positive and negative tests for:

- SUPER_ADMIN
- STAFF
- VIEWER
- Unauthenticated user

Every protected route must test:

- Allowed role
- Forbidden role
- Unauthenticated access
- Resource-level authorization where relevant

## 11. API Contract Tests

Verify:

- Exact success envelope
- Exact error envelope
- Stable machine-readable code
- Correct status
- Decimal strings
- ISO timestamp output
- YYYY-MM-DD business dates
- Pagination metadata
- Unknown-field rejection where required
- Sorting allowlists

## 12. Concurrency and Idempotency Tests

Require tests for:

- Atomic invoice numbers
- Duplicate invoice-creation submissions
- Duplicate invoice sends
- Duplicate payment submissions
- Concurrent overpayment attempts
- Refresh-token reuse
- Transaction rollback after failure
- Safe replay response

## 13. Provider Tests

For Resend and Supabase:

- Success
- Timeout
- Failure
- Invalid response
- Retry behaviour
- Idempotency
- No false SENT status after failed email
- No orphaned storage state after failed logo replacement

## 14. Coverage Thresholds

Initial thresholds for real test implementation:

Global application minimum:

- Statements: 80%
- Lines: 80%
- Functions: 80%
- Branches: 75%

Critical modules:

- Authentication and sessions: 90% statements and lines
- Financial calculations: 95% statements and lines
- Payment state transitions: 90% statements and lines
- Authorization: 90% statements and lines

State:

- Coverage does not replace test quality.
- Exclusions require documented review.
- Generated Prisma code is excluded.
- Configuration-only files may be excluded with justification.
- Thresholds may be increased after the test suite stabilizes.

## 15. Flaky Test Policy

Require:

- Do not rerun tests until they pass and ignore the failure
- Flaky tests are defects
- Identify root cause
- Quarantine only with explicit approval
- Track quarantined test with issue/reference
- Restore before release

## 16. CI Test Policy

Require:

- Tests run on backend and frontend pushes
- Tests run on pull requests targeting main
- CI cannot hide failures
- Frozen lockfile installation
- Failed tests block approval
- Integration services must use isolated CI databases
- Artifacts may include safe logs and coverage reports
- No secrets in artifacts

## 17. Placeholder Test Retirement

The existing P0.7 placeholder test is temporary.
It must be removed when the real backend test runner is introduced.
A placeholder echo must never remain as proof of application test coverage.

## 18. Testing Definition of Done

A feature is test-complete only when:

- Required test layers exist
- Positive paths pass
- Negative paths pass
- Boundary cases pass
- Security cases pass where applicable
- Regression test exists for fixed bugs
- Coverage thresholds pass
- No unexplained flaky tests remain
- Local checks pass
- CI passes
- Evidence is attached

## 19. Approval Status

Document: InvoiceFlow Testing Strategy
Phase: P0.8C
Status: Proposed — pending boss review
Applies from: Approval commit onward
