#!/usr/bin/env sh
# SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
# SPDX-License-Identifier: MPL-2.0
set -eu
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
exec "$SCRIPT_DIR/demo-status.sh"

