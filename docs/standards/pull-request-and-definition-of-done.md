# InvoiceFlow Pull Request Rules and Definition of Done

## 1. Purpose

InvoiceFlow tasks are not considered complete merely because the code runs locally. Completion requires architecture compliance, validation, testing, documentation, clean Git evidence and successful CI.

## 2. Branch Rules

The following branch rules are mandatory:

- `main` is stable and approved
- `backend` contains backend work
- `frontend` contains frontend work
- No force-push to approved shared branches
- No direct unfinished implementation on main
- Pull latest branch before starting
- Resolve divergence explicitly
- Review staged changes before commit

## 3. Commit Standards

Use Conventional Commits.

Allowed examples:

- `feat(auth): add login session service`
- `fix(invoice): prevent duplicate invoice numbers`
- `test(payment): cover concurrent overpayment`
- `docs(security): define session requirements`
- `refactor(client): isolate repository queries`
- `chore(ci): update validation workflow`

Rejected examples:

- `update`
- `changes`
- `done`
- `final`
- `work`
- `fix issue`

The following commit rules apply:

- One logical concern per commit
- No secret
- No unrelated generated file
- No fake evidence
- No knowingly failing commit presented for approval

## 4. Pull Request Size and Scope

The following PR scope rules apply:

- Small, reviewable PRs
- One phase or subtask per PR where practical
- No unrelated refactoring
- No hidden scope expansion
- Database, security and deployment impact identified

## 5. Required PR Description

Every PR must include:

- Requirement
- Problem being solved
- Scope
- Files/modules affected
- Architecture impact
- API impact
- Database impact
- Migration impact
- Security impact
- Validation commands
- Test results
- Coverage results when available
- UI screenshots when applicable
- Known limitations
- Rollback notes where applicable
- Commit SHA
- CI run result

## 6. Review Rules

A PR cannot be approved with:

- Failing CI
- Missing required tests
- Critical security issue
- Financial-integrity defect
- Unreviewed destructive migration
- Hidden validation failure
- Unrelated changes
- Exposed secret
- False implementation claim
- Unresolved blocking review comment

## 7. Reviewer Checklist

Reviewers must examine:

- Requirement compliance
- Architecture boundaries
- Validation
- Authentication
- Authorization
- Financial precision
- Transactions
- Idempotency
- Error handling
- Logging
- Tests
- Documentation
- Migration safety
- Secret handling
- Performance risks
- Scope discipline

## 8. Local Validation Gate

Before commit and before PR approval, the following checks must pass:

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git diff --check
```

Also review the following output:

```bash
git status
git diff
git diff --cached
git log -1 --oneline
```

## 9. Database Change Gate

Migration work requires:

- Prisma schema diff
- Migration files
- Migration status
- Forward migration result
- Fresh-database result
- Constraint tests
- Data-loss analysis
- Rollback or recovery plan
- Production-impact statement

## 10. Security Change Gate

Security changes require:

- Threat analysis
- Authentication impact
- Authorization impact
- CSRF impact
- Session impact
- Secret impact
- Logging review
- Security tests
- Rate-limit impact
- No unresolved critical/high issue

## 11. Definition of Ready

A task may begin only when:

- Requirement is clear
- Scope is frozen
- Dependencies are known
- Architecture decision is known
- Security impact is identified
- Acceptance criteria exist
- Branch is correct
- Working tree is clean

## 12. Definition of Done

A task is complete only when:

- Requirement is implemented
- Scope is respected
- Architecture boundaries are followed
- Types are safe
- Inputs are validated
- Authentication is correct where required
- Authorization is enforced server-side
- Financial rules are correct
- Transactions are correct
- Idempotency is implemented where required
- Error handling is complete
- Logging is safe
- Tests exist
- Coverage passes
- Documentation is updated
- Environment examples are updated where required
- Local validation passes
- CI passes
- No secret is committed
- Working tree is clean
- Commit and push evidence exist
- Boss review approves the task

**“Works on my machine” is not the Definition of Done.**

## 13. Approval Status

Document: InvoiceFlow Pull Request Rules and Definition of Done
Phase: P0.8D
Status: Proposed — pending boss review
Applies from: Approval commit onward
