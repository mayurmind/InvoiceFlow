# InvoiceFlow

## Project Purpose

InvoiceFlow is a modern web application designed for comprehensive invoice management, generation, and processing.

## Current Development Status

- **Phase**: P0.8A Development Standards
- **Active Focus**: Monorepo and environment setup. Backend development will start before frontend development.

## Technology Stack

- **Monorepo**: pnpm workspaces
- **Language**: TypeScript
- **Runtime**: Node.js
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

## Development Standards

All contributors must read and strictly adhere to the [InvoiceFlow Development Standards](docs/standards/development-standards.md) before writing, reviewing, testing, or committing any code.

## Local Setup Instructions

1. Install [Node.js](https://nodejs.org/) (v20+ recommended).
2. Install pnpm: `npm install -g pnpm`.
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
- `pnpm dev:web` - Start the frontend development server
- `pnpm build` - Build all packages and applications
- `pnpm lint` - Run ESLint across the workspace
- `pnpm typecheck` - Run TypeScript compiler checks
- `pnpm test` - Run tests across the workspace
- `pnpm format` - Auto-format code with Prettier
- `pnpm format:check` - Check code formatting
