#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [ -f "$SCRIPT_DIR/docker-compose.demo.yml" ]; then DEMO_DIR=$SCRIPT_DIR; else DEMO_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/../../deployment/demo" && pwd); fi
ENV_FILE="$DEMO_DIR/.env.demo"
TEMPLATE="$DEMO_DIR/.env.demo.example"
COMPOSE="$DEMO_DIR/docker-compose.demo.yml"

random_hex() {
  bytes=${1:-24}
  od -An -N"$bytes" -tx1 /dev/urandom | tr -d ' \n'
}

if [ ! -f "$ENV_FILE" ]; then
  umask 077
  db_admin_password=$(random_hex 24)
  db_runtime_password=$(random_hex 24)
  db_reset_password=$(random_hex 24)
  session_secret=$(random_hex 32)
  storage_access=$(random_hex 12)
  storage_secret=$(random_hex 32)
  admin_password=$(random_hex 16)
  sed \
    -e "0,/__GENERATED__/s//$db_admin_password/" \
    -e "0,/__GENERATED__/s//$db_runtime_password/" \
    -e "0,/__GENERATED__/s//$db_reset_password/" \
    -e "0,/__GENERATED__/s//$session_secret/" \
    -e "0,/__GENERATED__/s//$storage_access/" \
    -e "0,/__GENERATED__/s//$storage_secret/" \
    -e "0,/__GENERATED__/s//$admin_password/" \
    "$TEMPLATE" > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  printf '%s\n' "Se creó .env.demo con secretos locales aleatorios."
fi

if grep -q '__GENERATED__' "$ENV_FILE"; then
  printf '%s\n' "ERROR: .env.demo contiene marcadores sin reemplazar." >&2
  exit 1
fi
if ! grep -q '^APP_ENVIRONMENT=demo$' "$ENV_FILE" || ! grep -q '^DEMO_MODE=true$' "$ENV_FILE"; then
  printf '%s\n' "ERROR: la identidad del entorno demo no es válida." >&2
  exit 1
fi

docker compose --env-file "$ENV_FILE" -f "$COMPOSE" config --quiet
docker compose --env-file "$ENV_FILE" -f "$COMPOSE" up -d --build

web_port=$(sed -n 's/^DEMO_WEB_PORT=//p' "$ENV_FILE")
email=$(sed -n 's/^DEMO_ADMIN_EMAIL=//p' "$ENV_FILE")
password=$(sed -n 's/^DEMO_ADMIN_PASSWORD=//p' "$ENV_FILE")
printf '\n%s\n' "ERP Express Perú demo iniciado."
printf '%s\n' "Entrada: http://localhost:${web_port}/demo/"
printf '%s\n' "Aplicación: http://localhost:${web_port}/"
printf '%s\n' "Usuario demo: ${email}"
printf '%s\n' "Contraseña local generada: ${password}"
printf '%s\n' "No ingrese datos reales. Use ./demo-status.sh para comprobar salud."
