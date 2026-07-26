#!/usr/bin/env bash
set -euo pipefail

echo "==> Starting services with docker compose..."
docker compose up -d --build

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
if [ $? -ne 0 ]; then
  echo "ERROR: migrations failed."
  exit 1
fi

echo "==> Health check: backend (http://localhost:8000/admin/login/)..."
RETRIES=10
until curl -sf http://localhost:8000/admin/login/ > /dev/null 2>&1; do
  RETRIES=$((RETRIES - 1))
  if [ "$RETRIES" -le 0 ]; then
    echo "ERROR: backend health check failed."
    exit 1
  fi
  sleep 2
done
echo "    backend is healthy."

echo "==> Health check: frontend (http://localhost:4321/)..."
RETRIES=15
until curl -sf http://localhost:4321/ > /dev/null 2>&1; do
  RETRIES=$((RETRIES - 1))
  if [ "$RETRIES" -le 0 ]; then
    echo "ERROR: frontend health check failed."
    exit 1
  fi
  sleep 2
done
echo "    frontend is healthy."

echo ""
echo "✅ All services are up and healthy!"
echo "   Backend:  http://localhost:8000"
echo "   Frontend: http://localhost:4321"
echo "   Postgres: localhost:5432"
