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

## 12. Approval Status

Document: InvoiceFlow Dependency and CI Maintenance Policy
Phase: P0.8E
Status: Proposed — pending boss review
Applies from: Approval commit onward
