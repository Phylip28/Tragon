#!/usr/bin/env bash
set -euo pipefail

# One-time environment setup and integrity verification for Tragón.

# --- Setup ---

echo "==> Spinning up infrastructure..."
docker compose up --build -d

echo "==> Waiting for postgres to be healthy..."
RETRIES=30
until docker compose exec postgres pg_isready -U tragon > /dev/null 2>&1; do
  RETRIES=$((RETRIES - 1))
  if [ "$RETRIES" -le 0 ]; then
    echo "ERROR: postgres did not become healthy in time."
    exit 1
  fi
  sleep 2
done
echo "    postgres is ready."

echo "==> Running migrations..."
docker compose exec backend uv run python manage.py migrate --noinput

# --- Verification ---

echo ""
echo "==> Verifying containers..."

if docker ps --format '{{.Names}} {{.Status}}' | grep -q 'tragon-backend.*Up'; then
  echo "    tragon-backend is Up"
else
  echo "ERROR: tragon-backend is not running"
  docker ps
  exit 1
fi

if docker ps --format '{{.Names}} {{.Status}}' | grep -q 'tragon-frontend.*Up'; then
  echo "    tragon-frontend is Up"
else
  echo "ERROR: tragon-frontend is not running"
  docker ps
  exit 1
fi

if docker ps --format '{{.Names}} {{.Status}}' | grep -q 'tragon-postgres.*Up'; then
  echo "    tragon-postgres is Up"
else
  echo "ERROR: tragon-postgres is not running"
  docker ps
  exit 1
fi

echo ""
echo "==> Health checks..."

RETRIES=10
until curl -sf http://localhost:8000/admin/login/ > /dev/null 2>&1; do
  RETRIES=$((RETRIES - 1))
  if [ "$RETRIES" -le 0 ]; then
    echo "ERROR: backend health check failed (http://localhost:8000/admin/login/)"
    docker logs tragon-backend-1 --tail 10
    exit 1
  fi
  sleep 2
done
echo "    backend responds at http://localhost:8000"

RETRIES=15
until curl -sf http://localhost:4321/ > /dev/null 2>&1; do
  RETRIES=$((RETRIES - 1))
  if [ "$RETRIES" -le 0 ]; then
    echo "ERROR: frontend health check failed (http://localhost:4321/)"
    docker logs tragon-frontend-1 --tail 10
    exit 1
  fi
  sleep 2
done
echo "    frontend responds at http://localhost:4321"

echo ""
echo "==> Auditing logs (last 5 lines each)..."
echo "--- Backend ---"
docker logs tragon-backend-1 --tail 5 2>&1
echo ""
echo "--- Frontend ---"
docker logs tragon-frontend-1 --tail 5 2>&1
echo ""
echo "--- Postgres ---"
docker logs tragon-postgres-1 --tail 5 2>&1

echo ""
echo "==> All checks passed. Environment is ready."
echo "   Backend:  http://localhost:8000"
echo "   Frontend: http://localhost:4321"
echo "   Postgres: localhost:5432"
