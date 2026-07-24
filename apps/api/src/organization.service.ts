/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { Injectable, NotFoundException } from "@nestjs/common";
import { CompanyName, EmailAddress, Ruc, Ubigeo } from "@erp/domain";
import { redactSensitive } from "@erp/security";
import { DatabaseService } from "./database.service.js";
import type { ApiRequest } from "./http.js";

export interface CompanyInput {
  legalName: string; commercialName?: string | undefined; ruc: string; fiscalAddress?: string | undefined;
  ubigeo?: string | undefined; email?: string | undefined; phone?: string | undefined; mainCurrency: string; timeZone: string;
  classification: "private_company" | "public_company" | "public_entity"; economicActivityCode?: string | undefined;
}
export interface CompanyRow {
  id: string; legalName: string; commercialName: string | null; ruc: string;
  fiscalAddress: string | null; ubigeo: string | null; email: string | null; phone: string | null;
  mainCurrency: string; timeZone: string; classification: string; economicActivityCode: string | null;
  status: string; updatedAt: Date; version: number;
}
export interface BranchRow {
  id: string; code: string; name: string; address: string | null; ubigeo: string | null;
  isDefault: boolean; status: string; version: number;
}

@Injectable()
export class OrganizationService {
  constructor(private readonly database: DatabaseService) {}
  async getCompany(request: ApiRequest) {
    const [row] = await this.database.query<CompanyRow>(
      `select id,"legal_name" as "legalName","commercial_name" as "commercialName",ruc,
       "fiscal_address" as "fiscalAddress",ubigeo,email::text,phone,"main_currency" as "mainCurrency",
       "time_zone" as "timeZone",classification,"economic_activity_code" as "economicActivityCode",
       status,updated_at as "updatedAt",version from companies where id=$1 and tenant_id=$2`,
      [request.auth!.companyId, request.auth!.tenantId]
    );
    if (!row) throw new NotFoundException("Empresa no encontrada.");
    return row;
  }
  async updateCompany(request: ApiRequest, input: CompanyInput & { version: number }) {
    const values = {
      legalName: CompanyName.create(input.legalName).toString(),
      commercialName: input.commercialName?.trim() || null,
      ruc: Ruc.create(input.ruc).toString(),
      fiscalAddress: input.fiscalAddress?.trim() || null,
      ubigeo: input.ubigeo ? Ubigeo.create(input.ubigeo).toString() : null,
      email: input.email ? EmailAddress.create(input.email).toString() : null,
      phone: input.phone?.trim() || null,
      mainCurrency: input.mainCurrency.toUpperCase(),
      timeZone: input.timeZone,
      classification: input.classification,
      economicActivityCode: input.economicActivityCode?.trim() || null
    };
    return this.database.transaction(async (client) => {
      const before = await client.query("select * from companies where id=$1 and tenant_id=$2", [
        request.auth!.companyId, request.auth!.tenantId
      ]);
      const updated = await client.query(
        `update companies set legal_name=$3,commercial_name=$4,ruc=$5,fiscal_address=$6,ubigeo=$7,
          email=$8,phone=$9,main_currency=$10,time_zone=$11,classification=$12,
          economic_activity_code=$13,updated_by=$14,updated_at=now(),version=version+1
         where id=$1 and tenant_id=$2 and version=$15
         returning id,legal_name as "legalName",commercial_name as "commercialName",ruc,
          fiscal_address as "fiscalAddress",ubigeo,email::text,phone,main_currency as "mainCurrency",
          time_zone as "timeZone",classification,economic_activity_code as "economicActivityCode",
          status,updated_at as "updatedAt",version`,
        [
          request.auth!.companyId, request.auth!.tenantId, values.legalName, values.commercialName,
          values.ruc, values.fiscalAddress, values.ubigeo, values.email, values.phone,
          values.mainCurrency, values.timeZone, values.classification, values.economicActivityCode,
          request.auth!.userId, input.version
        ]
      );
      if (!updated.rows[0]) throw new Error("OPTIMISTIC_CONCURRENCY_CONFLICT");
      await client.query(
        `insert into audit_events(tenant_id,company_id,actor_user_id,action,entity_type,entity_id,
          previous_values,new_values,ip_address,user_agent,request_id)
         values($1,$2,$3,'company.updated','company',$2,$4,$5,$6,$7,$8)`,
        [
          request.auth!.tenantId, request.auth!.companyId, request.auth!.userId,
          JSON.stringify(redactSensitive(before.rows[0])), JSON.stringify(redactSensitive(updated.rows[0])),
          request.ip, request.headers["user-agent"], request.requestId
        ]
      );
      return updated.rows[0] as Record<string, unknown>;
    });
  }
  async listBranches(request: ApiRequest) {
    return this.database.query<BranchRow>(
      `select id,code,name,address,ubigeo,is_default as "isDefault",status,version
       from branches where tenant_id=$1 and company_id=$2 order by is_default desc,name`,
      [request.auth!.tenantId, request.auth!.companyId]
    );
  }
}
