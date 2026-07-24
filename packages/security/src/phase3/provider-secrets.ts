/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
const referencePart = /^[a-z][a-z0-9-]{1,62}$/;
const secretReference = /^secretref:v1:([a-z][a-z0-9-]{1,62}):([a-z][a-z0-9-]{1,62}):([a-z0-9][a-z0-9.-]{0,31})$/;

export interface ProviderSecretReference {
  readonly provider: string;
  readonly name: string;
  readonly version: string;
  readonly reference: string;
}

function assertReferencePart(value: string, label: string): void {
  if (!referencePart.test(value)) throw new Error(`INVALID_SECRET_REFERENCE_${label}`);
}

export function createProviderSecretReference(
  provider: string,
  name: string,
  version: string
): ProviderSecretReference {
  assertReferencePart(provider, "PROVIDER");
  assertReferencePart(name, "NAME");
  if (!/^[a-z0-9][a-z0-9.-]{0,31}$/.test(version)) throw new Error("INVALID_SECRET_REFERENCE_VERSION");
  return {
    provider,
    name,
    version,
    reference: `secretref:v1:${provider}:${name}:${version}`
  };
}

export function parseProviderSecretReference(value: string): ProviderSecretReference | null {
  const match = secretReference.exec(value);
  const provider = match?.[1];
  const name = match?.[2];
  const version = match?.[3];
  if (!provider || !name || !version) return null;
  return { provider, name, version, reference: value };
}

export function maskProviderSecretReference(value: string): string {
  const parsed = parseProviderSecretReference(value);
  return parsed ? `secretref:${parsed.provider}:${parsed.name}:***` : "[INVALID_SECRET_REFERENCE]";
}

export function maskSecretValue(value: string): "[REDACTED_SECRET]" {
  void value;
  return "[REDACTED_SECRET]";
}
