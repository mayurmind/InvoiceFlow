# InvoiceFlow

## Project Purpose

InvoiceFlow is a modern web application designed for comprehensive invoice management, generation, and processing.

## Current Development Status

- **Phase**: Production Release Candidate (`v1.0.0-rc.1`)
- **Status**: 100% Development Complete. The application is frozen for feature development.
- **Active Focus**: Deployment Preparation and Infrastructure setup.

## Technology Stack

- **Monorepo**: pnpm workspaces
- **Language**: TypeScript
- **Runtime**: Node.js 24 LTS
- **Package Manager**: pnpm 9.15.9
- **Backend (Planned)**: Express, Prisma, PostgreSQL
- **Frontend (Planned)**: Next.js
- **Tooling**: ESLint, Prettier, GitHub Actions

## Monorepo Structure

- `apps/api/` - Backend application
- `apps/web/` - Frontend application
- `packages/shared-types/` - Shared TypeScript types
- `packages/validation/` - Shared validation schemas
- `packages/config/` - Shared configurations (ESLint, TS)

## Branch Strategy

- `main` - Production-ready code
- `backend` - Active backend development
- `frontend` - Active frontend development

## Project Planning

- [Implementation Roadmap](docs/planning/implementation-roadmap.md)
- [Project Risk Register](docs/planning/risk-register.md)
- [P1 Readiness Checklist](docs/planning/p1-readiness-checklist.md)
- [Phase 0 Closure and P1 Authorization](docs/planning/p0-closure-and-p1-authorization.md)

## Engineering Standards

InvoiceFlow development follows mandatory architecture, TypeScript, financial-integrity, security, testing and delivery standards.

- [Development Standards](docs/standards/development-standards.md)
- [Security Baseline](docs/standards/security-baseline.md)
- [Testing Strategy](docs/standards/testing-strategy.md)
- [Pull Request Rules and Definition of Done](docs/standards/pull-request-and-definition-of-done.md)
- [Dependency and CI Maintenance Policy](docs/standards/dependency-and-ci-policy.md)

## Architecture & Deployment

- [Deployment Guide](docs/architecture/deployment.md)
- [Environment Configuration](docs/architecture/environment.md)

## Local Setup Instructions

1. Install [Node.js](https://nodejs.org/) (Node.js 24 LTS).
2. Install pnpm: `npm install -g pnpm@9.15.9`.
3. Clone the repository and checkout the active development branch (e.g., `backend`).
4. Install dependencies: `pnpm install`
5. Set up environment variables (see below).

## Environment Variable Setup

Copy the example environment files to create your local configurations.
**SECURITY WARNING**: Never commit `.env`, `.env.local`, service-role keys, JWT secrets, database passwords, or real API keys to version control.

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

## Available Scripts

Run these commands from the repository root:

- `pnpm dev:api` - Start the backend development server
- `pnpm build` - Build all packages and applications
- `pnpm lint` - Run ESLint across the workspace
- `pnpm typecheck` - Run TypeScript compiler checks
- `pnpm test` - Run tests across the workspace
- `pnpm format` - Auto-format code with Prettier
- `pnpm format:check` - Check code formatting
