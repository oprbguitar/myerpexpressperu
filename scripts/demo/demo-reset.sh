#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [ -f "$SCRIPT_DIR/docker-compose.demo.yml" ]; then DEMO_DIR=$SCRIPT_DIR; else DEMO_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/../../deployment/demo" && pwd); fi
ENV_FILE="$DEMO_DIR/.env.demo"
COMPOSE="$DEMO_DIR/docker-compose.demo.yml"

if [ ! -f "$ENV_FILE" ]; then
  printf '%s\n' "ERROR: no existe .env.demo; inicie la demostración primero." >&2
  exit 1
fi
grep -q '^APP_ENVIRONMENT=demo$' "$ENV_FILE" || { printf '%s\n' "ERROR: APP_ENVIRONMENT no es demo." >&2; exit 1; }
grep -q '^DEMO_RESET_ENABLED=true$' "$ENV_FILE" || { printf '%s\n' "ERROR: DEMO_RESET_ENABLED no es true." >&2; exit 1; }
grep -q '^DEMO_TENANT_ID=30000000-0000-4000-8000-000000000001$' "$ENV_FILE" || { printf '%s\n' "ERROR: tenant demo inesperado." >&2; exit 1; }
grep -q '^DEMO_DATABASE_NAME=erp_express_demo$' "$ENV_FILE" || { printf '%s\n' "ERROR: base demo inesperada." >&2; exit 1; }
grep -q '^DEMO_DATABASE_FINGERPRINT=erp-express-peru-demo-db-v0.3.0$' "$ENV_FILE" || { printf '%s\n' "ERROR: fingerprint demo inesperado." >&2; exit 1; }

docker compose --env-file "$ENV_FILE" -f "$COMPOSE" --profile tools run --rm demo-reset
docker compose --env-file "$ENV_FILE" -f "$COMPOSE" --profile tools run --rm storage-reset
printf '%s\n' "Reset demo completado con semilla sintética determinista."
