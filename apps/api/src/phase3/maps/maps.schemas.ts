/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { z } from "zod";

export const geocodeSchema = z.object({
  address: z.object({
    countryCode: z.string().length(2).default("PE"),
    department: z.string().max(100).optional(),
    province: z.string().max(100).optional(),
    district: z.string().max(100).optional(),
    street: z.string().max(200).optional(),
    postalCode: z.string().max(20).optional(),
    freeForm: z.string().max(300).optional()
  }).strict(),
  precision: z.enum(["EXACT", "DISTRICT", "PROVINCE", "DEPARTMENT"]).default("DISTRICT"),
  locationKind: z.enum(["BUSINESS", "PROJECT", "ASSET", "SUPPLIER", "EMPLOYEE_HOME"])
}).strict();

export type GeocodeInput = z.infer<typeof geocodeSchema>;

