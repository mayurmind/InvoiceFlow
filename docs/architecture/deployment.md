# InvoiceFlow Deployment Guide

## Overview

InvoiceFlow is architected as a two-tier application:
1.  **Backend (API)**: A Node.js/Express service providing the core business logic, GST calculations, and PDF/Email processing. Powered by Prisma ORM.
2.  **Frontend (Web)**: A Next.js application that serves the administrative dashboard and client interface.

Both tiers are designed to be deployed as stateless Docker containers.

## Container Architecture

### 1. API Container (`apps/api/Dockerfile`)
- **Base Image**: `node:24-alpine`
- **Build Process**: Multi-stage. Installs dependencies using `pnpm`, builds shared packages (`packages/shared-types`, `packages/validation`), generates the Prisma client, and compiles the TypeScript API code.
- **Runtime**: Runs the compiled JavaScript directly (no `tsx` in production) to minimize memory overhead.

### 2. Web Container (`apps/web/Dockerfile`)
- **Base Image**: `node:24-alpine`
- **Build Process**: Multi-stage. Uses Next.js `standalone` output feature. This drastically reduces the size of the final image by only including the files necessary for production.
- **Runtime**: Standard Node.js execution of the standalone `server.js`.

## Infrastructure Requirements

### Database
- **PostgreSQL**: Version 15 or higher.
- **Connection Pooling**: PgBouncer is highly recommended if scaling the API horizontally, due to Prisma's connection management characteristics.
- **Supabase**: The current environment defaults to Supabase for PostgreSQL and Storage.

### Environment Variables
Strict separation of configuration from code. See [Environment Configuration](environment.md) for the exhaustive list of required variables.

## Deployment Process (Docker Compose / Single Node)

For a single-node deployment (e.g., a DigitalOcean Droplet or EC2 instance), use the provided `docker-compose.yml`.

1.  **Clone and Configure**:
    ```bash
    git clone https://github.com/mayurmind/InvoiceFlow.git
    cd InvoiceFlow
    # Create production env file
    cp apps/api/.env.example .env.prod
    # Edit .env.prod with real credentials!
    ```

2.  **Database Migration**:
    Before booting the API, apply the database schema.
    ```bash
    # Run the migration script (requires the API image)
    docker compose --env-file .env.prod run --rm api ./scripts/migrate.sh
    ```

3.  **Boot the Stack**:
    ```bash
    docker compose --env-file .env.prod up -d
    ```

4.  **Reverse Proxy**:
    It is mandatory to put a reverse proxy (Nginx, Caddy, or a managed Load Balancer) in front of the application to handle SSL termination and route traffic:
    - Route `https://api.yourdomain.com/*` -> API Container (Port 5000)
    - Route `https://app.yourdomain.com/*` -> Web Container (Port 3000)

## Continuous Integration / Continuous Deployment (CI/CD)

The `.github/workflows/deploy.yml` defines the automated pipeline:
1.  **Verification**: Runs the full 1365-test suite, ESLint, and TypeScript compiler checks.
2.  **Build**: Compiles the Docker images.
3.  **Push**: Pushes the images to a container registry.
4.  *(Pending)* **Deploy**: Triggers a webhook or updates a manifest to restart the production containers.

## Health Checks & Monitoring

- **API Health Endpoint**: `GET /api/v1/health`. Responds with `200 OK` and a JSON payload if the database is reachable.
- **Logging**: The API uses Pino for structured JSON logging. It automatically redacts sensitive headers (Cookies, Authorization). Configure your container orchestrator (e.g., Docker daemon or AWS CloudWatch) to aggregate `stdout`/`stderr` logs.
- **Rollback Strategy**: Since Docker images are immutable and tagged by Git commit SHA, rollbacks are performed by redeploying the previous image tag. *Caution*: Database migrations are generally forward-only; a rollback may require restoring a database backup if breaking schema changes were applied.
