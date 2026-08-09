# Summary

Describe the requirement and completed work.

## Phase / Task

- Phase:
- Task:
- Branch:
- Commit SHA:

## Scope

List included work.

## Out of Scope

List intentionally excluded work.

## Architecture Impact

Explain affected layers.

## API Impact

- Routes added or modified:
- Request/response changes:
- Error-code changes:

## Database Impact

- Prisma schema changed: Yes/No
- Migration added: Yes/No
- Data-loss risk:
- Recovery plan:

## Security Impact

- Authentication:
- Authorization:
- CSRF:
- Rate limiting:
- Secrets:
- Logging:
- Security tests:

## Validation Evidence

```text
pnpm format:check:
pnpm lint:
pnpm typecheck:
pnpm test:
pnpm build:
git diff --check:
```

## Test Evidence

- Unit:
- Integration:
- Security:
- E2E:
- Coverage:

## UI Evidence

Add screenshots or state “Not applicable.”

## Known Limitations

List limitations or state “None.”

## Rollback / Recovery

Describe rollback or state “Not applicable.”

## Checklist

- [ ] Scope is limited to the approved task
- [ ] Architecture rules are followed
- [ ] Inputs are validated
- [ ] Authentication and RBAC are correct
- [ ] Financial calculations use Decimal arithmetic
- [ ] Required transactions and idempotency exist
- [ ] Tests cover success, failure and boundary paths
- [ ] Local validation passes
- [ ] CI passes
- [ ] Documentation is updated
- [ ] No secrets are committed
- [ ] No unrelated changes are included
- [ ] Working tree is clean
- [ ] Blocking review comments are resolved
