/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { DomainValidationError } from "@erp/domain";

export class ProviderUnavailableError extends DomainValidationError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "ProviderUnavailableError";
  }
}

export class ProviderPolicyError extends DomainValidationError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "ProviderPolicyError";
  }
}
