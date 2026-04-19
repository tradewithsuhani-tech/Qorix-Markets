#!/usr/bin/env bash
set -e

echo "[start.sh] Starting Redis..."
redis-server --daemonize yes --logfile /tmp/redis.log --save ""

echo "[start.sh] Waiting for Redis to be ready..."
for i in $(seq 1 20); do
  if redis-cli ping > /dev/null 2>&1; then
    echo "[start.sh] Redis is ready."
    break
  fi
  sleep 0.5
done

echo "[start.sh] Starting API server..."
exec pnpm --filter @workspace/api-server run dev
