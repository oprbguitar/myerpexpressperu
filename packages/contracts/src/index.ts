export interface AuthenticatedContext {
  readonly userId: string;
  readonly tenantId: string;
  readonly companyId: string;
  readonly branchIds: readonly string[];
  readonly permissions: ReadonlySet<string>;
  readonly sessionId: string;
  readonly forcePasswordChange: boolean;
}

export interface AuthenticationProvider {
  verifyCredentials(email: string, password: string): Promise<{ userId: string } | null>;
  createSession(userId: string, context: { ipAddress?: string; userAgent?: string }): Promise<string>;
  revokeSession(sessionId: string): Promise<void>;
  revokeAllSessions(userId: string): Promise<void>;
}

export interface Transaction {
  query<T>(sql: string, values?: readonly unknown[]): Promise<readonly T[]>;
}

export interface TransactionManager {
  execute<T>(operation: (transaction: Transaction) => Promise<T>): Promise<T>;
}

export interface AuditWriter {
  append(event: {
    tenantId: string;
    companyId?: string;
    actorUserId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    previousValues?: unknown;
    newValues?: unknown;
    ipAddress?: string;
    userAgent?: string;
    requestId: string;
  }): Promise<void>;
}

export interface StoredDocument {
  readonly key: string;
  readonly size: number;
  readonly contentType: string;
  readonly sha256: string;
}

export interface DocumentStorage {
  put(input: { key: string; body: Uint8Array; contentType: string }): Promise<StoredDocument>;
  createAuthorizedDownloadUrl(key: string, expiresInSeconds: number): Promise<string>;
  delete(key: string): Promise<void>;
}

export interface EmailProvider {
  send(input: { to: string; subject: string; text: string }): Promise<void>;
}
export interface JobQueue {
  enqueue<T>(name: string, payload: T): Promise<string>;
}
export interface ProviderValidationResult {
  readonly valid: boolean;
  readonly mode: "MANUAL" | "MOCK";
  readonly messages: readonly string[];
}
export interface ElectronicDocumentPayload {
  readonly documentId: string;
  readonly documentType: string;
  readonly series: string;
  readonly number: number;
  readonly customer: Readonly<Record<string, unknown>>;
  readonly currency: string;
  readonly total: string;
  readonly contentHash: string;
}
export interface SubmissionResult {
  readonly status: "ACCEPTED" | "ACCEPTED_WITH_OBSERVATIONS" | "REJECTED" | "FAILED";
  readonly externalReference: string;
  readonly responseCode?: string;
  readonly responseMessage?: string;
}
export interface ProviderDocumentStatus {
  readonly status: SubmissionResult["status"] | "PENDING";
  readonly responseCode?: string;
  readonly responseMessage?: string;
}
export interface VoidDocumentRequest {
  readonly documentId: string;
  readonly externalReference: string;
  readonly reason: string;
}
export interface VoidSubmissionResult {
  readonly status: "VOID_PENDING" | "VOIDED" | "FAILED";
  readonly externalReference: string;
  readonly message?: string;
}
export interface CdrResult {
  readonly available: boolean;
  readonly content?: Uint8Array;
  readonly contentType?: string;
}
export interface ElectronicInvoicingProvider {
  validateConfiguration(): Promise<ProviderValidationResult>;
  submitDocument(document: ElectronicDocumentPayload, idempotencyKey: string): Promise<SubmissionResult>;
  queryStatus(externalReference: string): Promise<ProviderDocumentStatus>;
  requestVoid(request: VoidDocumentRequest): Promise<VoidSubmissionResult>;
  retrieveCdr(externalReference: string): Promise<CdrResult>;
}
export interface MapProvider {
  getPublicConfiguration(): Promise<Record<string, string>>;
}
export interface DigitalSignatureProvider {
  sign(document: Uint8Array): Promise<Uint8Array>;
}

export * from "./phase3/index.js";
