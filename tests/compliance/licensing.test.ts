/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */

import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse } from "yaml";

// @ts-expect-error — utilidades en JavaScript sin tipos declarados.
import { classifyPackage } from "../../scripts/license/scan.mjs";
// @ts-expect-error — utilidades en JavaScript sin tipos declarados.
import { buildHeader, hasSpdxIdentifier, hasForeignCopyright, insertHeader } from "../../scripts/license/policy.mjs";
// @ts-expect-error — utilidades en JavaScript sin tipos declarados.
import { verifyProvenance } from "../../scripts/provenance/verify.mjs";

const root = resolve(__dirname, "../..");

async function loadMatrix(): Promise<Record<string, unknown>> {
  return parse(await readFile(resolve(root, "docs/compliance/LICENSE-MATRIX.yml"), "utf8"));
}

describe("clasificación de licencias de dependencias", () => {
  it("acepta las licencias permisivas declaradas", async () => {
    const matrix = await loadMatrix();
    for (const license of ["MIT", "Apache-2.0", "ISC", "BSD-3-Clause", "MPL-2.0"]) {
      expect(classifyPackage({ name: "x", version: "1.0.0", license }, matrix)).toBe("allowed");
    }
  });

  it("marca copyleft fuerte para revisión y nunca lo permite en silencio", async () => {
    const matrix = await loadMatrix();
    for (const license of ["GPL-3.0", "AGPL-3.0", "SSPL-1.0", "BUSL-1.1"]) {
      expect(classifyPackage({ name: "x", version: "1.0.0", license }, matrix)).not.toBe("allowed");
    }
  });

  it("exige revisión ante una licencia desconocida o no declarada", async () => {
    const matrix = await loadMatrix();
    expect(classifyPackage({ name: "x", version: "1.0.0", license: "UNKNOWN" }, matrix)).toBe("review");
    expect(
      classifyPackage({ name: "x", version: "1.0.0", license: "Licencia-Inventada-9.9" }, matrix)
    ).toBe("review");
  });

  it("resuelve expresiones compuestas exigiendo que ambas ramas estén permitidas", async () => {
    const matrix = await loadMatrix();
    // Conjunción: hay que cumplir las dos licencias.
    expect(classifyPackage({ name: "pako", version: "1.0.11", license: "(MIT AND Zlib)" }, matrix)).toBe(
      "allowed"
    );
    // Una conjunción con una rama no permitida no puede quedar permitida.
    expect(
      classifyPackage({ name: "x", version: "1.0.0", license: "(MIT AND GPL-3.0)" }, matrix)
    ).not.toBe("allowed");
  });

  it("no deja ninguna licencia prohibida clasificada como permitida", async () => {
    const matrix = await loadMatrix();
    const prohibited = (matrix as { prohibited?: { id: string }[] }).prohibited ?? [];
    for (const entry of prohibited) {
      expect(classifyPackage({ name: "x", version: "1.0.0", license: entry.id }, matrix)).toBe(
        "prohibited"
      );
    }
  });
});

describe("encabezados SPDX", () => {
  it("genera la sintaxis de comentario correcta por tipo de archivo", () => {
    expect(buildHeader("block", "Titular", 2026, "MPL-2.0")).toContain("/*");
    expect(buildHeader("block", "Titular", 2026, "MPL-2.0")).toContain(" * SPDX-License-Identifier: MPL-2.0");
    expect(buildHeader("sql", "Titular", 2026, "MPL-2.0")).toContain("-- SPDX-License-Identifier: MPL-2.0");
    expect(buildHeader("hash", "Titular", 2026, "MPL-2.0")).toContain("# SPDX-License-Identifier: MPL-2.0");
  });

  it("detecta un identificador SPDX ya presente", () => {
    expect(hasSpdxIdentifier("/* SPDX-License-Identifier: MPL-2.0 */")).toBe(true);
    expect(hasSpdxIdentifier("const a = 1;")).toBe(false);
  });

  it("reconoce avisos de copyright de terceros para no sobrescribirlos", () => {
    expect(hasForeignCopyright("// Copyright 2019 Otra Empresa S.A.", "ERP Express Perú contributors")).toBe(
      true
    );
    expect(hasForeignCopyright("// Copyright 2026 ERP Express Perú contributors", "ERP Express Perú contributors")).toBe(
      false
    );
  });

  it("preserva el shebang al insertar el encabezado", () => {
    const result = insertHeader("#!/usr/bin/env node\nconsole.log(1);\n", "# HEADER\n");
    expect(result.startsWith("#!/usr/bin/env node")).toBe(true);
    expect(result).toContain("# HEADER");
  });
});

describe("procedencia de desarrollo asistido por IA", () => {
  it("todos los registros son estructuralmente válidos", async () => {
    const result = await verifyProvenance(root);
    expect(result.errors).toEqual([]);
    expect(result.structurally_valid).toBe(true);
    expect(result.records_found).toBeGreaterThan(0);
  });

  it("ningún registro se declara aceptado sin revisor humano verificado", async () => {
    const result = await verifyProvenance(root);
    // Este es el control central: aceptar sin revisión humana invalidaría
    // toda la política de procedencia.
    for (const id of result.accepted) {
      expect(result.awaiting_human_review).not.toContain(id);
    }
    expect(result.structurally_valid).toBe(true);
  });

  it("la política prohíbe explícitamente que la IA sea titular de derechos", async () => {
    const policy = parse(
      await readFile(resolve(root, "docs/compliance/AI-PROVENANCE.yml"), "utf8")
    );
    expect(policy.principles.ai_is_not_an_author).toBe(true);
    expect(policy.principles.ai_is_not_a_copyright_holder).toBe(true);
    expect(policy.reviewer_integrity.never_record_unverified_reviewer).toBe(true);
  });

  it("no se afirma conformidad ni certificación con ningún marco de gobernanza", async () => {
    const policy = parse(
      await readFile(resolve(root, "docs/compliance/AI-PROVENANCE.yml"), "utf8")
    );
    for (const framework of policy.governance_mappings.frameworks) {
      expect(framework.assessed).toBe(false);
      expect(framework.status).toBe("referencia_de_diseño");
    }
  });
});

describe("titularidad", () => {
  it("no inscribe un titular concreto mientras la revisión legal siga abierta", async () => {
    const ownership = parse(await readFile(resolve(root, "docs/legal/OWNERSHIP.yml"), "utf8"));
    if (ownership.copyright.status === "provisional") {
      expect(ownership.copyright.holder).toBe("ERP Express Perú contributors");
      expect(ownership.copyright.declared_by).toBeNull();
    } else {
      // Si se declaró titularidad, debe existir evidencia y declarante.
      expect(ownership.copyright.declared_by).toBeTruthy();
      expect(ownership.copyright.evidence).toBeTruthy();
    }
  });

  it("declara que ningún sistema de IA puede ser titular", async () => {
    const ownership = parse(await readFile(resolve(root, "docs/legal/OWNERSHIP.yml"), "utf8"));
    expect(ownership.ai_policy.ai_may_hold_copyright).toBe(false);
    expect(ownership.ai_policy.human_review_required).toBe(true);
  });
});
