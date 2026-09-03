#!/bin/sh

set -e

echo "Starting database migration..."

if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL environment variable is not set."
  exit 1
fi

if [ -z "$DIRECT_URL" ]; then
  echo "Error: DIRECT_URL environment variable is not set."
  exit 1
fi

echo "Running prisma migrate deploy..."
cd /app/apps/api
npx prisma migrate deploy

echo "Migration completed successfully."
