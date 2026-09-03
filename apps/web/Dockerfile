# ---------------------------------------------------------
# Stage 1: Build
# ---------------------------------------------------------
FROM node:24-alpine AS builder

# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

WORKDIR /app

# Copy workspace configs and package files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/validation/package.json ./packages/validation/
COPY packages/config/package.json ./packages/config/
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of the source
COPY . .

# Build the web application
# This will utilize the "standalone" output mode configured in Next.js
WORKDIR /app
RUN pnpm --filter web build

# ---------------------------------------------------------
# Stage 2: Production Runtime
# ---------------------------------------------------------
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
# Disable Next.js telemetry
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copy standalone output
# Automatically leverages output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Note: The standalone build outputs a server.js file in the root of the standalone directory,
# but it maintains the monorepo path structure inside the standalone dir.
CMD ["node", "apps/web/server.js"]
