export interface DemoResetEnvironment {
  readonly APP_ENVIRONMENT: string | undefined;
  readonly DEMO_RESET_ENABLED: string | undefined;
  readonly DEMO_TENANT_ID: string | undefined;
  readonly DEMO_DATABASE_NAME: string | undefined;
  readonly DEMO_DATABASE_FINGERPRINT: string | undefined;
}

export interface ObservedDemoIdentity {
  readonly databaseName: string;
  readonly tenantId: string;
  readonly tenantCode: string;
  readonly profileStatus: string;
  readonly profileResetEnabled: boolean;
  readonly profileFingerprint: string;
}

export class DemoGuardError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "DemoGuardError";
  }
}

export function assertDemoResetAllowed(
  environment: DemoResetEnvironment,
  observed: ObservedDemoIdentity
): void {
  if (environment.APP_ENVIRONMENT !== "demo") {
    throw new DemoGuardError("DEMO_RESET_ENVIRONMENT_GUARD", "El reset sólo está permitido en APP_ENVIRONMENT=demo.");
  }
  if (environment.DEMO_RESET_ENABLED !== "true") {
    throw new DemoGuardError("DEMO_RESET_RUNTIME_GUARD", "DEMO_RESET_ENABLED debe ser true.");
  }
  if (!environment.DEMO_TENANT_ID || environment.DEMO_TENANT_ID !== observed.tenantId) {
    throw new DemoGuardError("DEMO_RESET_TENANT_GUARD", "El tenant observado no coincide con DEMO_TENANT_ID.");
  }
  if (!observed.tenantCode.startsWith("demo-")) {
    throw new DemoGuardError("DEMO_RESET_TENANT_MARKER_GUARD", "El tenant no está marcado como demostración.");
  }
  if (
    !environment.DEMO_DATABASE_NAME ||
    environment.DEMO_DATABASE_NAME !== "erp_express_demo" ||
    observed.databaseName !== environment.DEMO_DATABASE_NAME
  ) {
    throw new DemoGuardError("DEMO_RESET_DATABASE_GUARD", "La base observada no es la base demo dedicada.");
  }
  if (
    !environment.DEMO_DATABASE_FINGERPRINT ||
    environment.DEMO_DATABASE_FINGERPRINT.length < 16 ||
    environment.DEMO_DATABASE_FINGERPRINT !== observed.profileFingerprint
  ) {
    throw new DemoGuardError("DEMO_RESET_FINGERPRINT_GUARD", "El fingerprint no coincide con el perfil persistido.");
  }
  if (observed.profileStatus !== "active" || !observed.profileResetEnabled) {
    throw new DemoGuardError("DEMO_RESET_PROFILE_GUARD", "El perfil demo no autoriza el reset.");
  }
}

export function assertDemoSeedAllowed(environment: DemoResetEnvironment, databaseName: string): void {
  if (environment.APP_ENVIRONMENT !== "demo") {
    throw new DemoGuardError("DEMO_SEED_ENVIRONMENT_GUARD", "La semilla demo exige APP_ENVIRONMENT=demo.");
  }
  if (
    !environment.DEMO_TENANT_ID ||
    !environment.DEMO_DATABASE_FINGERPRINT ||
    environment.DEMO_DATABASE_FINGERPRINT.length < 16
  ) {
    throw new DemoGuardError("DEMO_SEED_IDENTITY_GUARD", "Tenant y fingerprint demo son obligatorios.");
  }
  if (
    environment.DEMO_DATABASE_NAME !== "erp_express_demo" ||
    databaseName !== environment.DEMO_DATABASE_NAME
  ) {
    throw new DemoGuardError("DEMO_SEED_DATABASE_GUARD", "La semilla sólo puede ejecutarse en erp_express_demo.");
  }
}
