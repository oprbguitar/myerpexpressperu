import { describe, expect, it } from "vitest";
import {
  authorizeExternalProcessing,
  classificationForDataKind,
  inferDataKind
} from "./data-classification.js";

describe("clasificación y salida a proveedores", () => {
  it("trata credenciales, secretos y datos médicos como restringidos", () => {
    expect(classificationForDataKind(inferDataKind("client_secret"))).toBe("restricted");
    expect(classificationForDataKind(inferDataKind("medical_diagnosis"))).toBe("restricted");
    expect(classificationForDataKind(inferDataKind("refresh_token"))).toBe("restricted");
  });

  it("bloquea datos restringidos incluso con proveedor aprobado", () => {
    expect(
      authorizeExternalProcessing({
        classification: "restricted",
        providerApproved: true,
        purposeApproved: true,
        minimised: true,
        redacted: true
      })
    ).toEqual({ allowed: false, reason: "RESTRICTED_DATA" });
  });

  it("exige redacción de datos confidenciales", () => {
    expect(
      authorizeExternalProcessing({
        classification: "confidential",
        providerApproved: true,
        purposeApproved: true,
        minimised: true,
        redacted: false
      })
    ).toEqual({ allowed: false, reason: "NOT_REDACTED" });
    expect(
      authorizeExternalProcessing({
        classification: "confidential",
        providerApproved: true,
        purposeApproved: true,
        minimised: true,
        redacted: true
      })
    ).toEqual({ allowed: true });
  });
});
