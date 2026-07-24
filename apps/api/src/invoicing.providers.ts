/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { randomUUID } from "node:crypto";
import type {
  CdrResult,
  ElectronicDocumentPayload,
  ElectronicInvoicingProvider,
  ProviderDocumentStatus,
  ProviderValidationResult,
  SubmissionResult,
  VoidDocumentRequest,
  VoidSubmissionResult
} from "@erp/contracts";

export class ManualElectronicInvoicingProvider implements ElectronicInvoicingProvider {
  validateConfiguration(): Promise<ProviderValidationResult> {
    return Promise.resolve({
      valid: true, mode: "MANUAL",
      messages: ["Flujo manual habilitado. No existe conexión directa con SUNAT."]
    });
  }
  submitDocument(): Promise<SubmissionResult> {
    return Promise.reject(new Error("MANUAL_PROVIDER_REQUIRES_USER_ACTION"));
  }
  queryStatus(): Promise<ProviderDocumentStatus> { return Promise.resolve({ status: "PENDING" }); }
  requestVoid(request: VoidDocumentRequest): Promise<VoidSubmissionResult> {
    return Promise.resolve({ status: "VOID_PENDING", externalReference: request.externalReference, message: request.reason });
  }
  retrieveCdr(): Promise<CdrResult> { return Promise.resolve({ available: false }); }
}

export type MockScenario = "ACCEPT" | "ACCEPT_WITH_OBSERVATIONS" | "REJECT" | "TIMEOUT" | "TEMPORARY_FAILURE";

export class MockElectronicInvoicingProvider implements ElectronicInvoicingProvider {
  constructor(private readonly scenario: MockScenario) {}
  validateConfiguration(): Promise<ProviderValidationResult> {
    return Promise.resolve({
      valid: true, mode: "MOCK",
      messages: [`Proveedor de demostración activo. Escenario: ${this.scenario}. No usar en producción.`]
    });
  }
  submitDocument(document: ElectronicDocumentPayload, idempotencyKey: string): Promise<SubmissionResult> {
    const externalReference = `MOCK-${document.series}-${document.number}-${idempotencyKey.slice(0, 8)}`;
    if (this.scenario === "TIMEOUT") return Promise.reject(new Error("MOCK_PROVIDER_TIMEOUT"));
    if (this.scenario === "TEMPORARY_FAILURE") {
      return Promise.resolve({ status: "FAILED", externalReference, responseCode: "TEMP", responseMessage: "Falla temporal simulada." });
    }
    if (this.scenario === "REJECT") {
      return Promise.resolve({ status: "REJECTED", externalReference, responseCode: "MOCK-2001", responseMessage: "Rechazo simulado." });
    }
    if (this.scenario === "ACCEPT_WITH_OBSERVATIONS") {
      return Promise.resolve({
        status: "ACCEPTED_WITH_OBSERVATIONS", externalReference,
        responseCode: "MOCK-OBS", responseMessage: "Aceptación con observaciones simulada."
      });
    }
    return Promise.resolve({ status: "ACCEPTED", externalReference, responseCode: "0", responseMessage: "Aceptación simulada." });
  }
  queryStatus(externalReference: string): Promise<ProviderDocumentStatus> {
    return Promise.resolve({ status: this.scenario === "REJECT" ? "REJECTED" : "ACCEPTED", responseMessage: externalReference });
  }
  requestVoid(request: VoidDocumentRequest): Promise<VoidSubmissionResult> {
    return Promise.resolve({ status: "VOIDED", externalReference: request.externalReference, message: "Anulación simulada." });
  }
  retrieveCdr(): Promise<CdrResult> {
    return Promise.resolve({ available: true, content: new TextEncoder().encode(`<cdr mock="${randomUUID()}"/>`), contentType: "application/xml" });
  }
}
