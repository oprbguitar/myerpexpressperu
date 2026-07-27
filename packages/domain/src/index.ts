/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
export class DomainValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details: ReadonlyArray<Record<string, string>> = []
  ) {
    super(message);
    this.name = "DomainValidationError";
  }
}

abstract class StringValueObject {
  protected constructor(protected readonly value: string) {}
  toString(): string {
    return this.value;
  }
  equals(other: StringValueObject): boolean {
    return this.constructor === other.constructor && this.value === other.value;
  }
}

export class Ruc extends StringValueObject {
  private constructor(value: string) {
    super(value);
  }
  static create(raw: string): Ruc {
    const value = raw.trim();
    if (!/^\d{11}$/.test(value)) {
      throw new DomainValidationError("RUC_INVALID", "El RUC debe contener exactamente 11 dígitos.");
    }
    return new Ruc(value);
  }
}

export class Dni extends StringValueObject {
  private constructor(value: string) {
    super(value);
  }
  static create(raw: string): Dni {
    const value = raw.trim();
    if (!/^\d{8}$/.test(value)) {
      throw new DomainValidationError("DNI_INVALID", "El DNI debe contener exactamente 8 dígitos.");
    }
    return new Dni(value);
  }
}

export class EmailAddress extends StringValueObject {
  private constructor(value: string) {
    super(value);
  }
  static create(raw: string): EmailAddress {
    const value = raw.trim().toLowerCase();
    if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      throw new DomainValidationError("EMAIL_INVALID", "El correo electrónico no es válido.");
    }
    return new EmailAddress(value);
  }
}

export class PhoneNumber extends StringValueObject {
  private constructor(value: string) {
    super(value);
  }
  static create(raw: string): PhoneNumber {
    const value = raw.trim().replace(/[\s()-]/g, "");
    if (!/^\+?\d{6,15}$/.test(value)) {
      throw new DomainValidationError("PHONE_INVALID", "El teléfono debe contener entre 6 y 15 dígitos.");
    }
    return new PhoneNumber(value);
  }
}

export class Ubigeo extends StringValueObject {
  private constructor(value: string) {
    super(value);
  }
  static create(raw: string): Ubigeo {
    const value = raw.trim();
    if (!/^\d{6}$/.test(value)) {
      throw new DomainValidationError("UBIGEO_INVALID", "El ubigeo debe contener 6 dígitos.");
    }
    return new Ubigeo(value);
  }
}

export class CompanyName extends StringValueObject {
  private constructor(value: string) {
    super(value);
  }
  static create(raw: string): CompanyName {
    const value = raw.trim().replace(/\s+/g, " ");
    if (value.length < 2 || value.length > 200) {
      throw new DomainValidationError("COMPANY_NAME_INVALID", "La razón social debe tener entre 2 y 200 caracteres.");
    }
    return new CompanyName(value);
  }
}

const stableCodePattern = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;

export class ModuleCode extends StringValueObject {
  private constructor(value: string) {
    super(value);
  }
  static create(raw: string): ModuleCode {
    const value = raw.trim().toLowerCase();
    if (!stableCodePattern.test(value)) {
      throw new DomainValidationError("MODULE_CODE_INVALID", "El código de módulo no es válido.");
    }
    return new ModuleCode(value);
  }
}

export class PermissionCode extends StringValueObject {
  private constructor(value: string) {
    super(value);
  }
  static create(raw: string): PermissionCode {
    const value = raw.trim().toLowerCase();
    if (!/^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/.test(value)) {
      throw new DomainValidationError("PERMISSION_CODE_INVALID", "El código de permiso no es válido.");
    }
    return new PermissionCode(value);
  }
}

export class Money {
  private constructor(
    public readonly minorUnits: bigint,
    public readonly currency: string
  ) {}
  static fromMinorUnits(minorUnits: bigint, currency: string): Money {
    const normalizedCurrency = currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
      throw new DomainValidationError("CURRENCY_INVALID", "La moneda debe usar un código ISO de 3 letras.");
    }
    return new Money(minorUnits, normalizedCurrency);
  }
  add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new DomainValidationError("CURRENCY_MISMATCH", "No se pueden sumar monedas diferentes.");
    }
    return Money.fromMinorUnits(this.minorUnits + other.minorUnits, this.currency);
  }
}

export class Percentage {
  private constructor(public readonly basisPoints: number) {}
  static fromBasisPoints(value: number): Percentage {
    if (!Number.isInteger(value) || value < 0 || value > 10000) {
      throw new DomainValidationError("PERCENTAGE_INVALID", "El porcentaje debe estar entre 0 y 100.");
    }
    return new Percentage(value);
  }
}

export class DateRange {
  private constructor(
    public readonly start: Date,
    public readonly end: Date | null
  ) {}
  static create(start: Date, end: Date | null): DateRange {
    if (Number.isNaN(start.getTime()) || (end && Number.isNaN(end.getTime()))) {
      throw new DomainValidationError("DATE_INVALID", "El rango contiene una fecha no válida.");
    }
    if (end && end < start) {
      throw new DomainValidationError("DATE_RANGE_INVALID", "La fecha final no puede ser anterior a la inicial.");
    }
    return new DateRange(new Date(start), end ? new Date(end) : null);
  }
}

export interface DomainEvent<T = unknown> {
  readonly type: string;
  readonly occurredAt: Date;
  readonly payload: T;
}

export interface ModuleDefinition {
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly version: string;
  readonly dependencies: readonly string[];
  readonly requiredPermissions: readonly string[];
  readonly defaultEnabled: boolean;
  readonly implemented: boolean;
}

export const moduleRegistry: readonly ModuleDefinition[] = [
  ["organization", "Organización", "Empresas, sedes y estructura organizacional", [], ["organization.read"], true, true],
  ["identity", "Identidad", "Usuarios y sesiones", [], ["users.read"], true, true],
  ["authorization", "Autorización", "Roles y permisos", ["identity"], ["roles.read"], true, true],
  ["module-management", "Módulos", "Activación progresiva de capacidades", ["authorization"], ["modules.read"], true, true],
  ["catalogs", "Catálogos", "Catálogos transversales", ["organization"], ["settings.read"], true, true],
  ["audit", "Auditoría", "Trazabilidad de acciones sensibles", ["identity"], ["audit.read"], true, true],
  ["documents", "Documentos", "Documentos privados y metadatos", ["organization"], ["documents.read"], true, true],
  ["parties", "Clientes y proveedores", "Modelo unificado de partes comerciales", ["organization"], ["parties.read"], true, true],
  ["products", "Productos y servicios", "Catálogo unificado de ítems", ["catalogs"], ["products.read"], true, true],
  ["pricing", "Listas de precios", "Resolución y vigencia de precios", ["products"], ["pricing.read"], true, true],
  ["warehouses", "Almacenes", "Almacenes básicos por sede", ["organization"], ["warehouses.read"], false, true],
  ["inventory-basic", "Inventario básico", "Movimientos y saldos reconciliables", ["products", "warehouses"], ["inventory.read"], false, true],
  ["sales", "Ventas", "Cotizaciones, pedidos y ventas", ["parties", "products", "pricing"], ["sales.read"], true, true],
  ["purchases", "Compras", "Compras operativas", ["parties", "products"], ["purchases.read"], true, true],
  ["expenses", "Gastos", "Registro controlado de gastos", ["parties"], ["expenses.read"], true, true],
  ["receivables", "Cuentas por cobrar", "Saldos y aplicaciones de clientes", ["sales"], ["receivables.read"], true, true],
  ["payables", "Cuentas por pagar", "Saldos y aplicaciones de proveedores", [], ["payables.read"], true, true],
  ["payments", "Pagos", "Cobros, pagos y reversiones", ["receivables", "payables"], ["payments.read"], true, true],
  ["cash", "Caja", "Cuentas, sesiones y movimientos de caja", ["payments"], ["cash.read"], true, true],
  ["commercial-documents", "Comprobantes", "Documentos comerciales y numeración", ["sales"], ["commercial-documents.read"], true, true],
  ["dashboard", "Inicio", "Resumen operativo con datos reales", ["sales", "purchases", "cash"], ["dashboard.read"], true, true],
  ["imports", "Importaciones", "Previsualización y ejecución CSV", ["parties", "products"], ["imports.read"], true, true],
  ["exports", "Exportaciones", "Exportación filtrada y auditada", ["parties"], ["exports.execute"], true, true],
  ["sunat-basic", "SUNAT básico", "Flujo manual y proveedor de demostración", ["commercial-documents"], ["sunat.read"], true, true],
  ["admin-control-plane", "Centro de administración", "Configuración, aprobaciones y gobierno", ["module-management", "audit"], ["admin.settings.read"], true, true],
  ["business-profiles", "Perfiles de negocio", "Plantillas configurables por actividad", ["admin-control-plane"], ["admin.business-profiles.read"], true, true],
  ["crm", "CRM", "Leads, oportunidades y actividades comerciales", ["parties", "identity"], ["crm.read"], true, true],
  ["projects", "Proyectos", "Proyectos, tareas, hitos y entregables", ["parties", "identity", "documents"], ["projects.read"], true, true],
  ["time-and-expenses", "Tiempo y gastos de proyecto", "Registro y aprobación de tiempo y gastos", ["projects", "expenses"], ["projects.read"], true, true],
  ["human-resources", "Recursos humanos", "Gestión ligera de personas y contratos", ["parties", "identity", "documents"], ["hr.read"], false, true],
  ["occupational-safety", "SST", "Seguridad y salud en el trabajo", ["human-resources", "documents"], ["sst.read"], false, true],
  ["assets", "Activos", "Registro, asignación y ciclo de vida de activos", ["organization", "documents"], ["assets.read"], false, true],
  ["maintenance", "Mantenimiento", "Planes y órdenes de mantenimiento", ["assets", "identity", "purchases"], ["maintenance.read"], false, true],
  ["workflow-rules", "Reglas de negocio", "Automatización controlada y versionada", ["module-management", "notifications-advanced"], ["admin.settings.read"], false, true],
  ["notifications-advanced", "Notificaciones avanzadas", "Preferencias, digest y escalamiento", ["identity"], ["dashboard.read"], true, true],
  ["legal-compliance", "Centro legal", "Documentos legales y evidencia de aceptación", ["documents", "audit", "organization"], ["legal.read"], true, true],
  ["privacy-governance", "Privacidad", "Consentimientos, solicitudes, retención y legal holds", ["identity", "audit", "documents"], ["privacy.read"], true, true],
  ["waste-management", "Gestión de residuos", "Registro y trazabilidad operativa del ciclo de residuos", ["organization", "documents", "audit"], ["waste.read"], true, true],
  ["provider-management", "Proveedores", "Configuración y salud de proveedores reemplazables", ["admin-control-plane"], ["admin.providers.read"], true, true],
  ["demo-management", "Demostración", "Escenarios, aislamiento y reset seguro", ["module-management", "imports"], ["demo.read"], false, true],
  ["observability", "Observabilidad", "Salud, métricas y eventos operativos", ["audit"], ["admin.settings.read"], true, true],
  ["manufacturing", "Manufactura", "Producción", ["products", "inventory", "purchases"], [], false, false],
  ["transport", "Transporte", "Operaciones de transporte", ["organization"], [], false, false],
  ["public-sector", "Sector público", "Flujos administrativos públicos", ["organization"], [], false, false],
  ["sunat", "SUNAT producción", "Conectividad directa reservada para una fase futura", ["sunat-basic"], [], false, false],
  ["maps", "Mapas", "Información geográfica con proveedor manual", [], ["maps.read"], false, true],
  ["ocr", "OCR", "Extracción documental con revisión humana", ["documents"], ["ocr.read"], false, true],
  ["artificial-intelligence", "Inteligencia artificial", "Asistencia opcional mediante herramientas controladas", ["provider-management", "audit"], ["ai.use"], false, true]
].map(([code, name, description, dependencies, requiredPermissions, defaultEnabled, implemented]) => ({
  code: code as string,
  name: name as string,
  description: description as string,
  version: "1.0.0",
  dependencies: dependencies as string[],
  requiredPermissions: requiredPermissions as string[],
  defaultEnabled: defaultEnabled as boolean,
  implemented: implemented as boolean
}));

export function resolveEffectivePermissions(rolePermissions: ReadonlyArray<ReadonlyArray<string>>): ReadonlySet<string> {
  return new Set(rolePermissions.flat());
}

export function validateModuleEnablement(code: string, enabledCodes: ReadonlySet<string>): void {
  const definition = moduleRegistry.find((module) => module.code === code);
  if (!definition) throw new DomainValidationError("MODULE_UNKNOWN", "El módulo no existe.");
  if (!definition.implemented) {
    throw new DomainValidationError("MODULE_NOT_IMPLEMENTED", "El módulo estará disponible en una fase futura.");
  }
  if (code === "payables" && !enabledCodes.has("purchases") && !enabledCodes.has("expenses")) {
    throw new DomainValidationError("MODULE_DEPENDENCY_MISSING", "Dependencias pendientes: purchases o expenses.");
  }
  if (code === "maps" && !enabledCodes.has("parties") && !enabledCodes.has("projects") && !enabledCodes.has("organization")) {
    throw new DomainValidationError("MODULE_DEPENDENCY_MISSING", "Dependencias pendientes: parties, projects u organization.");
  }
  const missing = definition.dependencies.filter((dependency) => !enabledCodes.has(dependency));
  if (missing.length > 0) {
    throw new DomainValidationError("MODULE_DEPENDENCY_MISSING", `Dependencias pendientes: ${missing.join(", ")}.`);
  }
}

export function assertNoCircularArea(areaId: string, parentId: string | null, parentById: ReadonlyMap<string, string | null>): void {
  let cursor = parentId;
  const visited = new Set([areaId]);
  while (cursor) {
    if (visited.has(cursor)) {
      throw new DomainValidationError("AREA_CYCLE", "La jerarquía de áreas no puede ser circular.");
    }
    visited.add(cursor);
    cursor = parentById.get(cursor) ?? null;
  }
}

export * from "./phase2.js";
export * from "./phase3/index.js";
export * from "./waste-management.js";
