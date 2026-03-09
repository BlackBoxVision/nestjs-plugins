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

echo "==> Waiting for MinIO and creating bucket..."
for i in $(seq 1 15); do
  if curl -sf http://localhost:9004/minio/health/live > /dev/null 2>&1; then
    echo "    MinIO is ready."
    break
  fi
  if [ "$i" -eq 15 ]; then
    echo "    WARNING: MinIO health check failed, continuing anyway..."
  fi
  sleep 1
done

# Create the demo-uploads bucket via mc inside the minio container
docker compose exec -T minio sh -c \
  'mc alias set local http://localhost:9000 minioadmin minioadmin 2>/dev/null && mc mb --ignore-existing local/demo-uploads 2>/dev/null' \
  || echo "    WARNING: Could not create MinIO bucket (may already exist)"

echo "==> Resetting database (drop all tables + re-push schema)..."
npx prisma db push --force-reset --skip-generate --accept-data-loss 2>&1

echo "==> Generating Prisma client..."
npx prisma generate 2>&1

echo "==> Running E2E tests..."
npx jest --config jest.e2e.config.ts --forceExit --detectOpenHandles

echo "==> E2E tests complete."
