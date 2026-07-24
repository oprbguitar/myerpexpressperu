/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { RequirePermissions } from "./auth.guard.js";
import { DatabaseService } from "./database.service.js";
import type { ApiRequest } from "./http.js";
import { StorageService } from "./storage.service.js";

const allowedMimes = new Set(["application/pdf", "application/xml", "text/xml", "image/jpeg", "image/png"]);
const ownerEntityTypeSchema = z.enum([
  "company", "party", "product", "sale", "purchase", "expense",
  "supplier-invoice", "supplier-receipt", "identity-document", "contract",
  "purchase-order", "delivery-evidence"
]);
function detectedMime(bytes: Buffer): string | null {
  if (bytes.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes.subarray(1, 4).toString("ascii") === "PNG") return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  const prefix = bytes.subarray(0, Math.min(bytes.length, 256)).toString("utf8").trimStart();
  if (prefix.startsWith("<?xml") || prefix.startsWith("<")) return "application/xml";
  return null;
}
@ApiTags("documents")
@Controller("documents")
export class DocumentsController {
  constructor(private readonly database: DatabaseService, private readonly storage: StorageService) {}
  @Get()
  @RequirePermissions("documents.read")
  list(@Req() request: ApiRequest) {
    return this.database.query(
      `select id,original_filename as "filename",mime_type as "mimeType",size_bytes::text as "sizeBytes",
       owner_entity_type as "ownerEntityType",uploaded_at as "uploadedAt"
       from documents where tenant_id=$1 and company_id=$2 and deleted_at is null order by uploaded_at desc limit 100`,
      [request.auth!.tenantId, request.auth!.companyId]
    );
  }
  @Post()
  @RequirePermissions("documents.upload")
  async upload(@Req() request: ApiRequest, @Body() body: unknown) {
    const input = z.object({
      filename: z.string().min(1).max(200), mimeType: z.string(),
      base64: z.string().min(1), ownerEntityType: ownerEntityTypeSchema,
      ownerEntityId: z.uuid().optional()
    }).parse(body);
    if (!allowedMimes.has(input.mimeType)) throw new Error("DOCUMENT_TYPE_NOT_ALLOWED");
    const bytes = Buffer.from(input.base64, "base64");
    if (bytes.byteLength === 0 || bytes.byteLength > 25 * 1024 * 1024) throw new Error("DOCUMENT_SIZE_INVALID");
    const detected = detectedMime(bytes);
    const declared = input.mimeType === "text/xml" ? "application/xml" : input.mimeType;
    if (!detected || detected !== declared) throw new Error("DOCUMENT_CONTENT_TYPE_MISMATCH");
    const normalized = input.filename.normalize("NFKD").replace(/[^\w.-]+/g, "-").slice(0, 160);
    const id = randomUUID();
    const key = `${request.auth!.tenantId}/${request.auth!.companyId}/${id}/${normalized}`;
    const stored = await this.storage.put({ key, body: bytes, contentType: input.mimeType });
    await this.database.query(
      `insert into documents(id,tenant_id,company_id,storage_key,original_filename,normalized_filename,
       mime_type,size_bytes,sha256,owner_entity_type,owner_entity_id,uploaded_by)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [id, request.auth!.tenantId, request.auth!.companyId, key, input.filename, normalized,
       input.mimeType, stored.size, stored.sha256, input.ownerEntityType, input.ownerEntityId, request.auth!.userId]
    );
    return { id, filename: input.filename, sha256: stored.sha256 };
  }
  @Get(":id/download")
  @RequirePermissions("documents.read")
  async download(@Req() request: ApiRequest, @Param("id") id: string) {
    const [document] = await this.database.query<{ storage_key: string }>(
      `select storage_key from documents where id=$1 and tenant_id=$2 and company_id=$3 and deleted_at is null`,
      [z.uuid().parse(id), request.auth!.tenantId, request.auth!.companyId]
    );
    if (!document) throw new Error("DOCUMENT_NOT_FOUND");
    return { url: await this.storage.createAuthorizedDownloadUrl(document.storage_key, 60) };
  }
}
