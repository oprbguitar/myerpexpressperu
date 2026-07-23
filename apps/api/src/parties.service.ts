import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  PartyType,
  assertPartyInvariant,
  normalizePartyDocument,
  normalizePartySearchName
} from "@erp/domain";
import { DatabaseService } from "./database.service.js";
import type { ApiRequest } from "./http.js";
import { appendAudit, appendOutboxEvent } from "./operations.js";

export interface PartyInput {
  partyType: PartyType;
  documentType?: "RUC" | "DNI" | "FOREIGN" | "NONE" | undefined;
  documentNumber?: string | undefined;
  legalName?: string | undefined;
  commercialName?: string | undefined;
  firstName?: string | undefined;
  lastName?: string | undefined;
  email?: string | undefined;
  phone?: string | undefined;
  notes?: string | undefined;
  roles: Array<"CUSTOMER" | "SUPPLIER" | "TRANSPORT_PROVIDER" | "CONTACT">;
}

@Injectable()
export class PartiesService {
  constructor(private readonly database: DatabaseService) {}

  async list(
    request: ApiRequest,
    input: { role?: string | undefined; search?: string | undefined; status?: string | undefined; cursor?: string | undefined; limit: number }
  ) {
    const values: unknown[] = [request.auth!.tenantId, request.auth!.companyId, input.limit + 1];
    const conditions = ["p.tenant_id=$1", "p.company_id=$2"];
    if (input.role) {
      values.push(input.role);
      conditions.push(`exists(select 1 from party_roles pr where pr.party_id=p.id and pr.role_code=$${values.length} and pr.status='active')`);
    }
    if (input.search) {
      values.push(`%${input.search.trim().toLocaleLowerCase("es-PE")}%`);
      conditions.push(`(p.normalized_name like $${values.length} or p.normalized_document like regexp_replace(upper($${values.length}),'[^A-Z0-9]','','g'))`);
    }
    if (input.status) {
      values.push(input.status);
      conditions.push(`p.status=$${values.length}`);
    }
    if (input.cursor) {
      values.push(input.cursor);
      conditions.push(`p.id > $${values.length}::uuid`);
    }
    const rows = await this.database.query<Record<string, unknown>>(
      `select p.id,p.party_type as "partyType",p.document_type as "documentType",
       p.document_number as "documentNumber",p.legal_name as "legalName",p.commercial_name as "commercialName",
       p.first_name as "firstName",p.last_name as "lastName",p.email::text,p.phone,p.status,p.version,
       coalesce(array_agg(pr.role_code order by pr.role_code) filter(where pr.status='active'),'{}') roles
       from parties p left join party_roles pr on pr.party_id=p.id
       where ${conditions.join(" and ")}
       group by p.id order by p.id limit $3`,
      values
    );
    const hasMore = rows.length > input.limit;
    const data = hasMore ? rows.slice(0, input.limit) : rows;
    return { data, meta: { limit: input.limit, nextCursor: hasMore ? String(data.at(-1)?.id) : null } };
  }

  async get(request: ApiRequest, id: string) {
    const [party] = await this.database.query<Record<string, unknown>>(
      `select p.*,coalesce(array_agg(pr.role_code) filter(where pr.status='active'),'{}') roles
       from parties p left join party_roles pr on pr.party_id=p.id
       where p.id=$1 and p.tenant_id=$2 and p.company_id=$3 group by p.id`,
      [id, request.auth!.tenantId, request.auth!.companyId]
    );
    if (!party) throw new NotFoundException("La parte comercial no existe.");
    const [addresses, contacts] = await Promise.all([
      this.database.query("select * from party_addresses where party_id=$1 and status='active' order by is_primary desc,created_at", [id]),
      this.database.query("select * from party_contacts where party_id=$1 and status='active' order by is_primary desc,created_at", [id])
    ]);
    return { ...party, addresses, contacts };
  }

  async create(request: ApiRequest, input: PartyInput) {
    assertPartyInvariant(input);
    const id = randomUUID();
    const normalizedDocument = normalizePartyDocument(input.documentNumber);
    const normalizedName = normalizePartySearchName(input);
    try {
      return await this.database.scopedTransaction(request.auth!, async (client) => {
        await client.query(
          `insert into parties(id,tenant_id,company_id,party_type,document_type,document_number,
            normalized_document,legal_name,commercial_name,first_name,last_name,normalized_name,
            email,phone,notes,created_by)
           values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
          [
            id, request.auth!.tenantId, request.auth!.companyId, input.partyType,
            input.documentType ?? "NONE", input.documentNumber?.trim() || null, normalizedDocument,
            input.legalName?.trim() || null, input.commercialName?.trim() || null,
            input.firstName?.trim() || null, input.lastName?.trim() || null, normalizedName,
            input.email?.trim().toLowerCase() || null, input.phone?.trim() || null,
            input.notes?.trim() || null, request.auth!.userId
          ]
        );
        for (const role of new Set(input.roles)) {
          await client.query(
            `insert into party_roles(tenant_id,company_id,party_id,role_code,created_by)
             values($1,$2,$3,$4,$5)`,
            [request.auth!.tenantId, request.auth!.companyId, id, role, request.auth!.userId]
          );
          if (role === "CUSTOMER") {
            await client.query(
              `insert into customer_profiles(party_id,tenant_id,company_id,updated_by)
               values($1,$2,$3,$4) on conflict(party_id) do update set status='active',updated_by=$4`,
              [id, request.auth!.tenantId, request.auth!.companyId, request.auth!.userId]
            );
          }
          if (role === "SUPPLIER") {
            await client.query(
              `insert into supplier_profiles(party_id,tenant_id,company_id,updated_by)
               values($1,$2,$3,$4) on conflict(party_id) do update set status='active',updated_by=$4`,
              [id, request.auth!.tenantId, request.auth!.companyId, request.auth!.userId]
            );
          }
        }
        await appendAudit(client, request, {
          action: "party.created", entityType: "party", entityId: id,
          newValues: { ...input, normalizedDocument }
        });
        await appendOutboxEvent(client, request, {
          aggregateType: "Party", aggregateId: id, eventType: "PartyCreated",
          payload: { partyId: id, roles: input.roles }
        });
        return { id, ...input, status: "active", version: 1 };
      });
    } catch (error) {
      if (String(error).includes("parties_document_unique")) {
        throw new ConflictException("Ya existe una parte con ese documento dentro del tenant.");
      }
      throw error;
    }
  }

  async update(request: ApiRequest, id: string, input: PartyInput & { version: number }) {
    assertPartyInvariant(input);
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const before = await client.query<Record<string, unknown>>("select * from parties where id=$1 and tenant_id=$2 and company_id=$3 for update", [
        id, request.auth!.tenantId, request.auth!.companyId
      ]);
      if (!before.rows[0]) throw new NotFoundException("La parte comercial no existe.");
      const updated = await client.query<{ id: string; status: string; version: number }>(
        `update parties set party_type=$4,document_type=$5,document_number=$6,normalized_document=$7,
          legal_name=$8,commercial_name=$9,first_name=$10,last_name=$11,normalized_name=$12,
          email=$13,phone=$14,notes=$15,updated_by=$16,updated_at=now(),version=version+1
         where id=$1 and tenant_id=$2 and company_id=$3 and version=$17 returning id,status,version`,
        [
          id, request.auth!.tenantId, request.auth!.companyId, input.partyType, input.documentType ?? "NONE",
          input.documentNumber?.trim() || null, normalizePartyDocument(input.documentNumber),
          input.legalName?.trim() || null, input.commercialName?.trim() || null,
          input.firstName?.trim() || null, input.lastName?.trim() || null, normalizePartySearchName(input),
          input.email?.trim().toLowerCase() || null, input.phone?.trim() || null, input.notes?.trim() || null,
          request.auth!.userId, input.version
        ]
      );
      if (!updated.rows[0]) throw new ConflictException("La parte fue modificada por otro usuario.");
      await appendAudit(client, request, {
        action: "party.updated", entityType: "party", entityId: id,
        previousValues: before.rows[0], newValues: input
      });
      return updated.rows[0];
    });
  }

  async setRole(request: ApiRequest, id: string, role: PartyInput["roles"][number], active: boolean) {
    return this.database.scopedTransaction(request.auth!, async (client) => {
      if (active) {
        await client.query(
          `insert into party_roles(tenant_id,company_id,party_id,role_code,status,created_by)
           select $2,$3,id,$4,'active',$5 from parties where id=$1 and tenant_id=$2 and company_id=$3
           on conflict(company_id,party_id,role_code) do update set status='active',deactivated_at=null`,
          [id, request.auth!.tenantId, request.auth!.companyId, role, request.auth!.userId]
        );
      } else {
        await client.query(
          `update party_roles set status='inactive',deactivated_at=now()
           where party_id=$1 and company_id=$2 and role_code=$3`,
          [id, request.auth!.companyId, role]
        );
      }
      await appendAudit(client, request, {
        action: active ? "party.role.assigned" : "party.role.removed",
        entityType: "party", entityId: id, newValues: { role, active }
      });
      return { success: true };
    });
  }

  async setCredit(request: ApiRequest, id: string, input: {
    allowCredit: boolean; creditLimit: string; currency: string; paymentTermId?: string | undefined;
  }) {
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const before = await client.query("select * from customer_profiles where party_id=$1 and company_id=$2 for update", [
        id, request.auth!.companyId
      ]);
      if (!before.rows[0]) throw new NotFoundException("La parte no tiene perfil de cliente.");
      await client.query(
        `update customer_profiles set allow_credit=$3,credit_limit=$4,credit_currency=$5,
          payment_term_id=$6,updated_by=$7,updated_at=now(),version=version+1
         where party_id=$1 and company_id=$2`,
        [
          id, request.auth!.companyId, input.allowCredit, input.creditLimit, input.currency.toUpperCase(),
          input.paymentTermId ?? null, request.auth!.userId
        ]
      );
      await appendAudit(client, request, {
        action: "customer.credit.updated", entityType: "party", entityId: id,
        previousValues: before.rows[0], newValues: input
      });
      return { success: true };
    });
  }

  async deactivate(request: ApiRequest, id: string) {
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const result = await client.query(
        `update parties set status='inactive',updated_by=$4,updated_at=now(),version=version+1
         where id=$1 and tenant_id=$2 and company_id=$3 and status='active' returning id`,
        [id, request.auth!.tenantId, request.auth!.companyId, request.auth!.userId]
      );
      if (!result.rows[0]) throw new NotFoundException("La parte no está activa.");
      await appendAudit(client, request, {
        action: "party.deactivated", entityType: "party", entityId: id, newValues: { status: "inactive" }
      });
      return { success: true };
    });
  }
}
