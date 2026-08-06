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

## 7. Frontend Architecture

- Use Next.js App Router exclusively.
- Use Tailwind CSS for styling; avoid custom CSS where utility classes suffice.
- Use shadcn/ui for component foundation.
- Keep server components and client components strictly separated. Data fetching should occur in Server Components whenever possible.

## 8. File Naming and Import Rules

- Use `kebab-case` for all file and directory names.
- Group files by feature rather than strictly by type where appropriate.
- Use absolute imports (e.g., `@/components/`) instead of relative imports (`../../components/`).

## 9. API Response Standards

- API responses must follow a consistent envelope structure (e.g., `{ data, error, meta }`).
- Never leak stack traces or internal error details to the client.

## 10. HTTP Status Rules

- `200 OK` for successful queries and updates.
- `201 Created` for successful creation.
- `400 Bad Request` for validation failures.
- `401 Unauthorized` for missing or invalid authentication.
- `403 Forbidden` for authenticated users lacking required permissions.
- `404 Not Found` for missing resources.
- `500 Internal Server Error` for unexpected backend crashes.

## 11. Financial-Code Rules

- **No floating-point arithmetic for currency.** All financial amounts must be represented, stored, and calculated as integers (e.g., cents).
- Format to decimal strings only at the presentation layer.

## 12. GST Calculation Rules

- GST and other tax calculations must use precise integer mathematics or a dedicated decimal library.
- Follow strict, legally compliant rounding rules for tax calculations (typically round half to even or round half up).

## 13. Date and Timezone Rules

- Store all dates and timestamps in UTC (ISO 8601 format) in the database.
- Perform timezone conversions exclusively on the client/presentation layer based on the user's locale.

## 14. Environment-Variable Rules

- Never hardcode secrets. Use environment variables.
- Prefix frontend-exposed variables correctly (e.g., `NEXT_PUBLIC_`).
- Fail fast on application startup if required environment variables are missing.

## 15. Error Handling

- Catch and handle expected errors (e.g., Prisma unique constraint violations) gracefully.
- Throw custom `AppError` classes containing an HTTP status code and a safe message.

## 16. Logging

- Log meaningful context (e.g., `userId`, `invoiceId`, `action`) without logging sensitive PII or credentials.
- Use structured logging (JSON) in production.

## 17. Database Standards

- Use Prisma migrations to evolve the database schema.
- Do not make manual schema changes to the PostgreSQL database.
- Always include database-level constraints (e.g., `UNIQUE`, `NOT NULL`, foreign keys) to enforce data integrity beyond the application layer.

## 18. Validation Standards

- Use Zod schemas (from `packages/validation`) to validate all incoming request payloads, query parameters, and path variables.
- Validate data at the controller/middleware boundary before it reaches the service layer.

## 19. Security-Aware Coding

- Sanitize user inputs to prevent XSS.
- Use parameterized queries (handled automatically by Prisma) to prevent SQL Injection.
- Implement rate limiting on sensitive endpoints (e.g., login, password reset).

## 20. Complete Testing Standards

- Unit test all business logic and financial calculations thoroughly.
- Mock external APIs (e.g., email sending) in tests.
- Maintain a minimum test coverage threshold (e.g., 80%) for core domain logic.

## 21. Code Quality

- No commented-out code or `console.log` statements in production.
- Use ESLint and Prettier to enforce formatting and style.

## 22. Documentation

- Document complex business logic and architectural decisions in code or architecture documents.
- Keep the `README.md` up-to-date with setup instructions and core scripts.

## 23. Detailed Git and PR Standards

- Pull requests must have a descriptive title and reference any related issue tracking numbers.
- PRs must pass all CI checks before they can be reviewed.
- Squash and merge PRs to keep the `main` history clean.

## 24. Definition of Done

- Code is written and passes all local validations.
- Unit and integration tests are written and passing.
- Feature is manually tested.
- PR is reviewed and approved by at least one other engineer.
- CI/CD pipeline passes completely.

## 25. Exceptions

- Any deviation from these standards requires documented justification and explicit approval from the engineering lead.

## 26. Enforcement

- These rules are enforced via automated CI checks (ESLint, Prettier, TypeScript) and human code review. Code that violates these standards will be rejected.

## 27. Approval Status

- **Status:** Approved (P0.8A)
