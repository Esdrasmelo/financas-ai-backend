#!/bin/sh
set -e

# Aplica as migrations pendentes antes de subir a API.
# RUN_MIGRATIONS=false pula a etapa (útil quando outro processo já migrou).
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] aplicando migrations..."
  node_modules/.bin/prisma migrate deploy
fi

exec "$@"
