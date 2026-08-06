# InvoiceFlow Dependency and CI Maintenance Policy

## 1. Purpose

Dependencies, runtimes, package managers, build tools and CI workflows are part of InvoiceFlow’s production supply chain.

Dependency and CI maintenance must be:

- Controlled
- Reviewable
- Reproducible
- Secure
- Compatible with the monorepo
- Supported by validation evidence

Upgrades must never be mixed casually into unrelated feature work.

## 2. Dependency Selection Rules

A new dependency may be introduced only when:

- A clear technical or business need exists
- Existing project tools cannot reasonably solve the requirement
- The package is actively maintained
- Its licence is compatible with InvoiceFlow
- Its security history has been reviewed
- Its Node.js and TypeScript compatibility is known
- Its transitive dependency size is reasonable
- Its runtime or bundle impact is acceptable
- It does not duplicate an existing library without justification
- It has sufficient documentation and community or vendor support

Prefer:

- Official packages
- Well-maintained packages
- Widely adopted libraries
- Packages with TypeScript support
- Small, focused libraries

Avoid:

- Abandoned packages
- Packages with unclear ownership
- Packages with unresolved critical vulnerabilities
- Large libraries for trivial utilities
- Multiple libraries solving the same concern
- Unnecessary runtime dependencies
- Packages requiring unsafe configuration

## 3. Dependency Categories

Distinguish:

### Runtime Dependencies

Required by the deployed application.
These require stricter review because they affect:

- Production behaviour
- Attack surface
- Startup
- Runtime performance
- Deployment size

### Development Dependencies

Used for:

- Compilation
- Linting
- Formatting
- Testing
- Local development
- CI validation

Development dependencies still require security and compatibility review.

### Workspace Dependencies

Internal packages such as:

- `@invoiceflow/shared-types`
- `@invoiceflow/validation`
- Future shared configuration packages

Workspace dependencies must use compatible contracts and must not introduce circular dependencies.

## 4. Version Policy

Require:

- `pnpm-lock.yaml` remains committed
- Resolved versions remain reproducible
- Dependency ranges in package manifests are chosen intentionally
- Major upgrades are isolated into dedicated work
- Runtime versions are documented
- Package-manager versions are documented
- CI and local development use compatible versions
- Workspace packages remain mutually compatible
- Do not use uncontrolled `latest` references in reproducible CI configuration
- Do not manually edit lockfile dependency records

The root `packageManager` field is the authoritative pnpm version declaration unless an approved architecture decision changes it.

## 5. Dependency Addition Evidence

Every new dependency proposal must document:

- Package name
- Requested version
- Dependency type
- Purpose
- Why existing tools are insufficient
- Alternatives considered
- Maintenance status
- Security impact
- Runtime or bundle impact
- Licence impact
- Configuration required
- Environment-variable impact
- Lockfile impact
- Validation results

A package must not be added merely because it is popular or convenient.

## 6. Dependency Upgrade Evidence

Every upgrade must document:

- Current version
- Target version
- Upgrade type:
  - Patch
  - Minor
  - Major
- Release notes reviewed
- Breaking changes
- Deprecated APIs
- Migration requirements
- Security impact
- Runtime compatibility
- TypeScript compatibility
- Test impact
- Rollback approach
- Validation evidence

Major upgrades require a dedicated task or phase unless required for an urgent security remediation.

## 7. Vulnerability Severity Policy

### Critical

- Blocks merge
- Blocks deployment
- Blocks release
- Requires immediate remediation, removal or approved emergency containment
- Exposed credentials must be rotated

### High

- Blocks production release
- Must normally be fixed before merge
- Formal risk acceptance is required for a temporary exception

### Moderate

- Must be reviewed for exploitability
- Must be scheduled for remediation
- Must be resolved before production when relevant to the deployed path

### Low

- Must be tracked
- May be handled through routine maintenance
- Must not be ignored permanently

Require:

- No blind vulnerability suppression
- No suppression solely to obtain a clean report
- Transitive vulnerabilities still require review
- “Development dependency” is not automatically a reason to ignore a finding
- Risk acceptance must identify owner, reason, impact and expiry
- Credential exposure requires credential rotation even after package remediation

## 8. Dependency Audit Policy

Planned checks may include:

- `pnpm audit`
- GitHub dependency review
- Dependabot
- Renovate
- Manual review of major upgrades
- Package maintenance review
- Licence review
- Stale-package review

Audit output must be reviewed rather than accepted blindly.

Audit results must distinguish:

- Production-reachable vulnerabilities
- Development-only vulnerabilities
- False positives
- Unused dependencies
- Transitive findings
- Findings requiring architecture changes

## 9. Update Cadence

Freeze the initial maintenance cadence:

- Critical security updates: immediately
- High security updates: within 7 days
- Routine dependency review: monthly
- Node.js and pnpm support review: quarterly
- GitHub Actions review: quarterly
- Major framework upgrades: planned phase only
- Emergency upgrades: isolated work with full regression validation
- Deprecated package review: monthly until replaced

Updates may be performed sooner when:

- A security advisory is published
- Runtime support ends
- A provider requires compatibility changes
- A production defect is caused by a dependency
- A critical CI action becomes unsupported

## 10. Runtime Policy

Require:

- Supported Node.js LTS releases only
- Supported pnpm releases only
- Local and CI versions must be compatible
- The root `packageManager` field remains authoritative for pnpm
- Runtime upgrades require dependency compatibility checks
- Runtime upgrades require local validation
- Runtime upgrades require CI validation
- Unsupported runtimes block production deployment
- Development environments should avoid undocumented version drift

## 11. GitHub Actions Policy

Require:

- Official or explicitly approved actions
- Supported action versions
- Immutable commit SHAs may be used for stronger supply-chain control
- Workflow permissions follow least privilege
- No unnecessary repository write access
- No secret access for untrusted pull-request code
- No arbitrary scripts downloaded and executed without review
- No secrets printed in logs
- No secrets stored in artifacts
- Frozen-lockfile installation
- Dependency caching must not cache secrets
- Jobs should define reasonable timeouts
- Failures must remain visible
- CI must not hide errors using fallback success commands

Forbidden examples:

```yaml
run: pnpm test || true
```

## 12. Workflow Permission Rules

- Define explicit permissions block for all GitHub Action workflows.
- Use `contents: read` by default.
- Never grant `write` permissions unless explicitly required for a specific task (e.g., releasing).
- Do not grant repository administrative permissions to CI runners.

## 13. Baseline CI Required Checks

Every CI run must include:

- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

All checks must pass without warnings treated as acceptable errors.

## 14. CI Failure Policy

- Any CI failure blocks the merge.
- No bypassing CI for administrative convenience.
- A flaky CI run is treated as a defect and must be fixed, not ignored.

## 15. Secret Safety in CI

- Do not log or echo secrets.
- Use GitHub Secrets for injecting credentials.
- Do not pass secrets to untrusted actions or third-party scripts.
- Mask secrets automatically in runner output.

## 16. CI Artifact Policy

- Retain artifacts only as long as strictly necessary (e.g., 7-14 days).
- Never include `.env` files or hardcoded credentials in build artifacts.
- Store test coverage and logs safely without exposing PII or database dumps.

## 17. Lockfile Policy

- The `pnpm-lock.yaml` file must be committed and kept up-to-date.
- CI must use `--frozen-lockfile` (or `pnpm install --frozen-lockfile`) to prevent unintended upgrades.
- Manual edits to `pnpm-lock.yaml` are strictly prohibited.

## 18. Upgrade Validation Gate

All dependency upgrades must pass:

- Local test execution
- Full CI pipeline execution
- Build size review (if significant)
- Security audit scan (`pnpm audit`)

## 19. Deprecated Dependency Policy

- Deprecated dependencies must be tracked.
- A deprecated package must be scheduled for replacement within a maximum of 3 months.
- New dependencies must not rely on known deprecated packages.

## 20. Dependency Removal Policy

- Remove unused dependencies immediately to reduce attack surface.
- Review `package.json` regularly for orphaned dependencies.
- Use tools like `knip` or `depcheck` to verify unused packages before removal.

## 21. Duplicate Dependency Policy

- Avoid resolving multiple versions of the same dependency unless absolutely necessary.
- Use pnpm overrides/resolutions to enforce single versions of transitive dependencies if they conflict or introduce vulnerabilities.

## 22. Monorepo Dependency Rules

- Share common dependencies (e.g., TypeScript, ESLint, Prettier) at the root level where practical.
- Use workspace protocols (e.g., `workspace:*`) for internal package references.
- Do not allow cross-app dependencies (e.g., `apps/web` depending on `apps/api`) directly; extract shared logic to `packages/`.

## 23. CI Performance and Reliability

- Cache pnpm store and build outputs to reduce CI times.
- Ensure caching mechanisms do not accidentally cache stale or corrupted build states.
- Set explicit timeouts for jobs to prevent hung runners.

## 24. Dependabot or Renovate Policy

- Dependabot or Renovate may be introduced in a future phase.
- When introduced, automated PRs must still pass all CI checks and human review.
- Security updates must be prioritized over feature updates.

## 25. Emergency Dependency Response

- In the event of a zero-day vulnerability in a dependency, immediate mitigation is required.
- If a patch is unavailable, the dependency must be temporarily removed, mocked, or isolated until safe.

## 26. Production Release Gate

A release to production requires:

- Clean CI run on `main`.
- Clean security audit.
- No unresolved high or critical vulnerabilities.
- Final boss review.

## 27. Exceptions and Risk Acceptance

- Exceptions to these rules require documented justification.
- Risk acceptance for vulnerabilities requires explicit approval from the engineering lead, stating the reason and expiration of the acceptance.

## 28. Maintenance Definition of Done

A maintenance or dependency upgrade task is complete when:

- The package is updated.
- `pnpm-lock.yaml` is regenerated cleanly.
- CI passes.
- PR is reviewed and approved.

## 29. Approval Status

Document: InvoiceFlow Dependency and CI Maintenance Policy
Phase: P0.8E
Status: Proposed — pending boss review
Applies from: Approval commit onward
