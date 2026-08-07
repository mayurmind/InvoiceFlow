# InvoiceFlow Project Risk Register

## 1. PURPOSE

Risks are tracked before they become defects or schedule blockers.

## 2. RISK SCALE

**Probability:**

- Low
- Medium
- High

**Impact:**

- Low
- Medium
- High
- Critical

**Overall priority:**

- P1 — Critical
- P2 — High
- P3 — Medium
- P4 — Low

## 3. REQUIRED RISK REGISTER

| ID   | Risk                                        | Category       | Probability | Impact   | Priority | Early warning                     | Prevention                                 | Mitigation               | Recovery                   | Owner           | Review phase |
| ---- | ------------------------------------------- | -------------- | ----------- | -------- | -------- | --------------------------------- | ------------------------------------------ | ------------------------ | -------------------------- | --------------- | ------------ |
| R001 | Incorrect GST calculation                   | Financial      | Medium      | Critical | P1       | Minor discrepancies in unit tests | Authoritative backend logic, ROUND_HALF_UP | Financial tests          | Recalculate & alert        | Team Lead       | P5           |
| R002 | Floating-point monetary corruption          | Financial      | High        | Critical | P1       | JS numbers used for money         | Use DECIMAL/Decimal.js exclusively         | Code review enforcement  | Data patch script          | Backend Lead    | P5           |
| R003 | Duplicate invoice numbers under concurrency | Technical      | Medium      | High     | P2       | Database constraint violations    | Atomic numbering, transactions             | Integration tests        | Manual intervention        | DevOps          | P5           |
| R004 | Payment over-recording/race condition       | Financial      | Low         | High     | P2       | Payment totals > invoice amount   | Idempotency keys, DB locks                 | Concurrency tests        | DB transaction rollback    | Backend Lead    | P7           |
| R005 | Authentication/session vulnerability        | Security       | Medium      | Critical | P1       | Failed security tests             | Short-lived JWT, secure cookies            | RBAC middleware          | Invalidate all sessions    | Security Lead   | P3           |
| R006 | CSRF due to cookie authentication           | Security       | Medium      | High     | P2       | CSRF token missing/mismatched     | SameSite cookies, CSRF tokens              | Middleware checks        | Patch & rotate sessions    | Security Lead   | P3           |
| R007 | RBAC/IDOR authorization defect              | Security       | Low         | High     | P2       | Unauthorized resource access      | Strict middleware validation               | E2E Security tests       | Immediate patch            | Security Lead   | P4           |
| R008 | Secret leakage                              | Security       | Low         | Critical | P1       | Secrets seen in logs/repo         | strict `.env` gitignore, scanners          | Code reviews             | Rotate secrets immediately | DevOps          | P10          |
| R009 | Supabase/Prisma connection exhaustion       | Infrastructure | Medium      | Medium   | P3       | Slow API responses                | Connection pooling (PgBouncer)             | Load testing             | Restart connections        | DevOps          | P2           |
| R010 | Database migration failure                  | Infrastructure | Low         | High     | P2       | Down migrations failing           | Local integration DB tests                 | CI validation            | Rollback DB snapshot       | DevOps          | P2           |
| R011 | Email provider outage                       | Infrastructure | Low         | Medium   | P3       | Emails failing to send            | Provider failure handling                  | Mock tests               | Retry queues               | Backend Lead    | P6           |
| R012 | Duplicate invoice email sending             | Technical      | Low         | Medium   | P3       | Complaints from clients           | Idempotency keys, delivery records         | Logic tests              | Manual communication       | Backend Lead    | P6           |
| R013 | PDF mismatch with stored invoice            | Business       | Low         | High     | P2       | Discrepancy reports               | Immutable snapshots                        | Snapshot integrity tests | Regenerate from snapshot   | Frontend Lead   | P6           |
| R014 | File-upload abuse                           | Security       | Low         | High     | P2       | Malicious logo uploads            | Strict file type/size limits               | Validation rules         | Delete malicious files     | Security Lead   | P4           |
| R015 | GitHub Actions outage                       | Infrastructure | High        | Medium   | P3       | CI pipeline stalls                | Understand infrastructure vs project       | Wait for recovery        | Manual deployment if safe  | DevOps          | P0           |
| R016 | CI configuration defect                     | Technical      | Medium      | Medium   | P3       | False positive/negative CI        | Isolate step failures                      | Validate locally         | Fix workflow               | DevOps          | P1           |
| R017 | Dependency vulnerability                    | Security       | High        | High     | P2       | Dependabot alerts                 | Regular dependency audits                  | Update dependencies      | Revert to safe version     | Security Lead   | P9           |
| R018 | Render cold start/service availability      | Infrastructure | High        | Low      | P4       | Initial slow API responses        | Ping services, optimize bundle             | Caching                  | Upgrade tier               | DevOps          | P10          |
| R019 | Scope creep                                 | Project        | High        | Medium   | P3       | New feature requests              | Explicit architecture review               | Change control           | Defer to future phases     | Project Manager | P0           |
| R020 | Student-team schedule delay                 | Project        | High        | High     | P2       | Missed milestones                 | Realistic student estimates                | Regular status checks    | Adjust scope               | Project Manager | P0           |
| R021 | Frontend/backend contract divergence        | Technical      | Medium      | High     | P2       | API 400 errors on UI              | Contract-first APIs                        | Shared types/schemas     | Re-align contracts         | Team Lead       | P8           |
| R022 | Production configuration mistake            | Infrastructure | Low         | High     | P2       | Application won't start in prod   | Smoke tests                                | Staging checks           | Rollback                   | DevOps          | P10          |
| R023 | Insufficient backup/recovery testing        | Operations     | Low         | Critical | P1       | Data loss without recovery        | Backup/restore validation                  | Routine checks           | Point-in-time restore      | DevOps          | P9           |
| R024 | Logging sensitive information               | Security       | Low         | High     | P2       | PII in logs                       | Logging redaction                          | Review logs              | Purge logs                 | Security Lead   | P9           |
| R025 | Incorrect business date/timezone handling   | Business       | Medium      | High     | P2       | Invoices on wrong dates           | Asia/Kolkata enforcement                   | Timezone tests           | Data correction            | Backend Lead    | P5           |

## 4. SPECIAL CI INFRASTRUCTURE RISK

**Lesson from the P0.8 incident:**
A CI run can fail or be cancelled before executing project commands because GitHub-hosted runner infrastructure is unavailable.

**Required response:**

1. Confirm whether a runner was acquired.
2. Confirm whether project steps actually executed.
3. Classify infrastructure failures separately.
4. Do not modify working project code to solve external infrastructure failure.
5. Retry once infrastructure recovers.
6. A later green CI run on a descendant commit validates the combined repository tree contained in that commit.

## 5. FINANCIAL RISKS

Special treatment is required for:

- rounding
- tax calculation
- snapshots
- numbering
- payments
- concurrency
- immutable records

These risks require tests, not only code review.

## 6. SECURITY RISKS

Special treatment is required for:

- authentication
- authorization
- CSRF
- token replay
- password security
- secrets
- uploads
- rate limiting
- logging

## 7. RISK REVIEW CADENCE

Risks must be reviewed:

- before each phase
- after security incidents
- after architecture changes
- before release candidate
- before production deployment

## 8. ESCALATION

Critical risks block progression.

High risks require either:

- correction, or
- documented approved mitigation

No unresolved critical financial/security risk may be accepted for release.

## 9. APPROVAL STATUS

Document: InvoiceFlow Project Risk Register
Phase: P0.9
Status: Proposed — pending boss review
Applies from: Approval commit onward
