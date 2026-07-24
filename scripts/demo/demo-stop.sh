#!/usr/bin/env sh
# SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
# SPDX-License-Identifier: MPL-2.0
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
if [ -f "$SCRIPT_DIR/docker-compose.demo.yml" ]; then DEMO_DIR=$SCRIPT_DIR; else DEMO_DIR=$(CDPATH= cd -- "$SCRIPT_DIR/../../deployment/demo" && pwd); fi
ENV_FILE="$DEMO_DIR/.env.demo"
COMPOSE="$DEMO_DIR/docker-compose.demo.yml"

if [ ! -f "$ENV_FILE" ]; then
  printf '%s\n' "La demostración ya está detenida o no fue iniciada."
  exit 0
fi
docker compose --env-file "$ENV_FILE" -f "$COMPOSE" down --remove-orphans
printf '%s\n' "Servicios demo detenidos. Los volúmenes demo se conservaron."
