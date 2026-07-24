/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { PostgresDatabase } from "../../packages/database/src/index.js";

export default async function globalSetup() {
  if (!process.env.DATABASE_URL || !process.env.SEED_ADMIN_EMAIL) {
    throw new Error("DATABASE_URL y SEED_ADMIN_EMAIL son obligatorios para E2E autenticado.");
  }
  const database = new PostgresDatabase(process.env.DATABASE_URL);
  try {
    await database.query(
      `update users set force_password_change=false,failed_login_count=0,blocked_until=null
       where normalized_email=lower($1) and status='active'`,
      [process.env.SEED_ADMIN_EMAIL]
    );
  } finally {
    await database.close();
  }
}
