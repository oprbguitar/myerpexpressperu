#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [ -f "$SCRIPT_DIR/docker-compose.demo.yml" ]; then DEMO_DIR=$SCRIPT_DIR; else DEMO_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/../../deployment/demo" && pwd); fi
ENV_FILE="$DEMO_DIR/.env.demo"
COMPOSE="$DEMO_DIR/docker-compose.demo.yml"

if [ ! -f "$ENV_FILE" ]; then
  printf '%s\n' "La demostración todavía no fue iniciada." >&2
  exit 1
fi

docker compose --env-file "$ENV_FILE" -f "$COMPOSE" ps
web_port=$(sed -n 's/^DEMO_WEB_PORT=//p' "$ENV_FILE")
api_port=$(sed -n 's/^DEMO_API_PORT=//p' "$ENV_FILE")

check_url() {
  label=$1
  url=$2
  if command -v curl >/dev/null 2>&1; then
    curl --fail --silent --show-error --max-time 5 "$url" >/dev/null
  elif command -v wget >/dev/null 2>&1; then
    wget -qO- -T 5 "$url" >/dev/null
  else
    printf '%s\n' "ERROR: curl o wget es necesario para el health check." >&2
    return 1
  fi
  printf '%s\n' "$label: OK"
}

check_url "Web demo" "http://localhost:${web_port}/demo-health"
check_url "API demo" "http://localhost:${api_port}/api/v1/health/readiness"
