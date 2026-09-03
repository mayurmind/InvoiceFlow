# ---------------------------------------------------------
# Stage 1: Build
# ---------------------------------------------------------
FROM node:24-alpine AS builder

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

# Copy workspace configs and package files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/validation/package.json ./packages/validation/
COPY packages/config/package.json ./packages/config/
COPY apps/api/package.json ./apps/api/

# Install dependencies (frozen lockfile for deterministic builds)
RUN pnpm install --frozen-lockfile

# Copy the rest of the monorepo source
COPY . .

# Generate Prisma Client
WORKDIR /app/apps/api
RUN pnpm prisma generate

# Build the shared packages and the API
WORKDIR /app
RUN pnpm --filter shared-types build
RUN pnpm --filter validation build
RUN pnpm --filter api build

# Prune dev dependencies to save space for the runtime image
# We use pnpm deploy to extract only the api app and its production dependencies
RUN pnpm --filter api deploy --prod /app/out

# ---------------------------------------------------------
# Stage 2: Production Runtime
# ---------------------------------------------------------
FROM node:24-alpine AS runner

WORKDIR /app

# Set production environment
ENV NODE_ENV=production

# Copy the deployed production output from the builder stage
COPY --from=builder /app/out ./

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 expressjs && \
    chown -R expressjs:nodejs /app

USER expressjs

EXPOSE 5000

# Start the application using the compiled JavaScript
CMD ["node", "dist/index.js"]
