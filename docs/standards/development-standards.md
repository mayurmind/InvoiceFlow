# InvoiceFlow Development Standards

## 1. Purpose

This document defines the mandatory engineering standards for InvoiceFlow.

These rules apply strictly to all aspects of the codebase, including:

- Backend code
- Frontend code
- Shared packages
- Database code
- Tests
- Documentation
- CI/CD configuration
- Git commits and pull requests

A feature is **not complete** merely because it works locally. It must also meet architecture, validation, security, testing, and review requirements outlined in this document.

## 2. Core Engineering Principles

- **Correctness before speed:** It is better to deliver a slower feature that is correct than a fast feature that corrupts data.
- **Security by default:** Security must be built into the foundation of the feature, not patched as an afterthought.
- **Financial integrity is non-negotiable:** Any code touching invoices, payments, or financial calculations must have guaranteed precision and strict validation.
- **Explicit code over hidden behaviour:** Avoid "magic" frameworks or implicit side effects. Code should be readable and obvious.
- **Small, reviewable changes:** Pull requests must be small enough to review comprehensively.
- **One source of truth for shared contracts:** Types and schemas used across boundaries must exist in the shared packages.
- **No duplicated business logic:** Centralize core rules. Do not re-implement logic in multiple places.
- **No bypassing validation to make tests pass:** Tests must simulate realistic behavior.
- **No fake validation evidence:** Do not mock validation layers to hide structural flaws.
- **No approval while critical issues remain:** A pull request with unresolved critical feedback cannot be approved.

## 3. TypeScript Standards

- TypeScript strict mode must remain enabled.
- `any` is prohibited unless its use is technically unavoidable and documented.
- Use `unknown` for untrusted values and narrow the type safely.
- Public functions must have explicit parameter and return types.
- Exported service, repository, and utility functions require explicit return types.
- Avoid unsafe type assertions.
- Do not use `as unknown as SomeType` to bypass type safety.
- Use discriminated unions when modelling states.
- Prefer immutable inputs where practical.
- Do not suppress TypeScript errors without a written reason.
- Shared application contracts belong in `packages/shared-types`.
- Shared Zod schemas belong in `packages/validation`.
- Do not duplicate request, response, or enum definitions across packages.
- Prisma-generated types must not be exposed directly as public API contracts.
- API DTOs and persistence models must remain separate where their purposes differ.

**Acceptable:**

```ts
export function parsePageSize(value: unknown): number {
  if (typeof value !== 'string') {
    return 20;
  }

  const parsedValue = Number.parseInt(value, 10);

  return Number.isInteger(parsedValue) && parsedValue > 0 ? parsedValue : 20;
}
```

**Rejected:**

```ts
// REJECTED: Uses 'any', missing return type, unsafe assumptions.
export function parsePageSize(value: any) {
  if (!value) return 20;
  return parseInt(value as string);
}
```

## 4. Architecture and Data Flow

All backend feature development must follow the locked InvoiceFlow engineering flow. Logic must be strictly segregated into the appropriate layer:

`Route -> Middleware -> Controller -> Service -> Repository -> Prisma -> PostgreSQL`

1. **Route**: Defines the HTTP method and path. Delegates to the Controller.
2. **Middleware**: Handles authentication, authorization, and raw request validation.
3. **Controller**: Extracts request parameters/body, calls the Service layer, and formats the HTTP response. Must not contain business logic.
4. **Service**: Contains all business logic, orchestration, and domain rules.
5. **Repository**: Abstracts data access. The only layer allowed to directly interact with Prisma.
6. **Prisma**: The ORM layer executing queries against the database.
7. **PostgreSQL**: The relational database layer.

## 5. Testing and CI/CD Standards

- CI/CD checks (lint, format, typecheck, tests) must pass for every commit pushed to remote development branches.
- Do not mock the database repository layer in ways that hide SQL constraints or schema violations.
- Integration tests must be used for testing the Controller-to-Repository flow where appropriate.
- Tests must fail if business logic constraints are violated.

## 6. Git and Code Review Standards

- Commit messages must follow conventional commits (e.g., `feat:`, `fix:`, `chore:`, `docs:`).
- Branch names should be lowercase and descriptive.
- All code must undergo rigorous peer review before merging to `main`.
- If a security flaw or financial miscalculation is identified during review, it is considered a critical blocker.
