import { ProviderUnavailableError } from "./provider-errors.js";

export interface CircuitBreakerOptions {
  readonly failureThreshold: number;
  readonly resetAfterMs: number;
}

export class ProviderCircuitBreaker {
  private failures = 0;
  private openedAt: number | undefined;

  constructor(private readonly options: CircuitBreakerOptions) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.openedAt !== undefined) {
      if (Date.now() - this.openedAt < this.options.resetAfterMs) {
        throw new ProviderUnavailableError("PROVIDER_CIRCUIT_OPEN", "El proveedor no está disponible temporalmente.");
      }
      this.openedAt = undefined;
      this.failures = 0;
    }
    try {
      const result = await operation();
      this.failures = 0;
      return result;
    } catch (error) {
      this.failures += 1;
      if (this.failures >= this.options.failureThreshold) this.openedAt = Date.now();
      throw error;
    }
  }
}

export async function withTimeout<T>(
  timeoutMs: number,
  signal: AbortSignal | undefined,
  operation: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abort = (): void => controller.abort();
  signal?.addEventListener("abort", abort, { once: true });
  if (signal?.aborted) controller.abort();
  try {
    return await operation(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new ProviderUnavailableError("PROVIDER_TIMEOUT", "El proveedor excedió el tiempo permitido.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

export function assertLocalEndpoint(value: string): URL {
  const endpoint = new URL(value);
  const allowedHosts = new Set(["127.0.0.1", "localhost", "::1"]);
  if (!allowedHosts.has(endpoint.hostname)) {
    throw new Error("LOCAL_PROVIDER_REQUIRES_LOOPBACK_ENDPOINT");
  }
  if (!["http:", "https:"].includes(endpoint.protocol)) {
    throw new Error("PROVIDER_ENDPOINT_PROTOCOL_NOT_ALLOWED");
  }
  endpoint.username = "";
  endpoint.password = "";
  endpoint.hash = "";
  return endpoint;
}

export function assertAllowedExternalEndpoint(value: string, allowedOrigins: ReadonlySet<string>): URL {
  const endpoint = new URL(value);
  if (endpoint.protocol !== "https:" || !allowedOrigins.has(endpoint.origin)) {
    throw new Error("EXTERNAL_PROVIDER_ENDPOINT_NOT_ALLOWED");
  }
  endpoint.username = "";
  endpoint.password = "";
  endpoint.hash = "";
  return endpoint;
}

export async function readBoundedJson(response: Response, maximumBytes = 1_000_000): Promise<unknown> {
  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new ProviderUnavailableError("PROVIDER_RESPONSE_TOO_LARGE", "La respuesta del proveedor excede el límite.");
  }
  if (!response.ok) {
    throw new ProviderUnavailableError("PROVIDER_REQUEST_FAILED", "El proveedor rechazó la solicitud.");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new ProviderUnavailableError("PROVIDER_RESPONSE_INVALID", "El proveedor no devolvió contenido.");
  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let text = "";
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    receivedBytes += chunk.value.byteLength;
    if (receivedBytes > maximumBytes) {
      await reader.cancel();
      throw new ProviderUnavailableError("PROVIDER_RESPONSE_TOO_LARGE", "La respuesta del proveedor excede el límite.");
    }
    text += decoder.decode(chunk.value, { stream: true });
  }
  text += decoder.decode();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ProviderUnavailableError("PROVIDER_RESPONSE_INVALID", "El proveedor devolvió una respuesta inválida.");
  }
}
