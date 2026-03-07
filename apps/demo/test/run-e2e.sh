#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEMO_DIR="$(dirname "$SCRIPT_DIR")"

cd "$DEMO_DIR"

echo "==> Starting Docker services..."
docker compose up -d --wait

echo "==> Waiting for Postgres to be ready..."
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U bbv -d bbv_demo > /dev/null 2>&1; then
    echo "    Postgres is ready."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "    ERROR: Postgres did not become ready in time."
    docker compose logs postgres
    exit 1
  fi
  sleep 1
done

echo "==> Pushing Prisma schema to database..."
npx prisma db push --skip-generate --accept-data-loss 2>&1

echo "==> Generating Prisma client..."
npx prisma generate 2>&1

echo "==> Running E2E tests..."
npx jest --config jest.e2e.config.ts --forceExit --detectOpenHandles

echo "==> E2E tests complete."
