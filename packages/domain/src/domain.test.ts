import { describe, expect, it } from "vitest";
import {
  DomainValidationError,
  EmailAddress,
  Money,
  Ruc,
  assertNoCircularArea,
  resolveEffectivePermissions,
  validateModuleEnablement
} from "./index.js";

describe("objetos de valor", () => {
  it("normaliza correo y valida RUC", () => {
    expect(EmailAddress.create(" ADMIN@Example.COM ").toString()).toBe("admin@example.com");
    expect(Ruc.create("20123456789").toString()).toBe("20123456789");
    expect(() => Ruc.create("123")).toThrowError(DomainValidationError);
  });
  it("evita mezclar monedas", () => {
    expect(Money.fromMinorUnits(100n, "pen").add(Money.fromMinorUnits(50n, "PEN")).minorUnits).toBe(150n);
    expect(() => Money.fromMinorUnits(100n, "PEN").add(Money.fromMinorUnits(1n, "USD"))).toThrow();
  });
});

describe("reglas transversales", () => {
  it("resuelve unión de permisos", () => {
    expect([...resolveEffectivePermissions([["users.read"], ["users.read", "users.create"]])]).toEqual([
      "users.read",
      "users.create"
    ]);
  });
  it("valida dependencias e implementación de módulos", () => {
    expect(() => validateModuleEnablement("documents", new Set(["organization"]))).not.toThrow();
    expect(() => validateModuleEnablement("sales", new Set(["parties", "products"]))).toThrowError("pricing");
    expect(() => validateModuleEnablement("manufacturing", new Set(["organization"]))).toThrowError("fase futura");
  });
  it("impide áreas circulares", () => {
    const parents = new Map<string, string | null>([
      ["ventas", "comercial"],
      ["comercial", "direccion"],
      ["direccion", null]
    ]);
    expect(() => assertNoCircularArea("direccion", "ventas", parents)).toThrowError("circular");
  });
});
