import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { ItemType, PartyType, normalizePartyDocument, normalizePartySearchName } from "@erp/domain";
import { DatabaseService } from "./database.service.js";
import { parseCsv, serializeCsv } from "./csv.js";
import type { ApiRequest } from "./http.js";
import {
  appendAudit, beginIdempotentOperation, completeIdempotentOperation
} from "./operations.js";

type ImportType = "CUSTOMERS" | "SUPPLIERS" | "PRODUCTS" | "SERVICES" | "OPENING_STOCK" | "PRICE_LISTS";

const headersByType: Readonly<Record<ImportType, readonly string[]>> = {
  CUSTOMERS: ["party_type", "document_type", "document_number", "legal_name", "commercial_name", "first_name", "last_name", "email", "phone"],
  SUPPLIERS: ["party_type", "document_type", "document_number", "legal_name", "commercial_name", "first_name", "last_name", "email", "phone"],
  PRODUCTS: ["code", "name", "description", "unit_code", "purchase_price", "sale_price", "tax_code", "manages_stock", "minimum_stock", "barcode"],
  SERVICES: ["code", "name", "description", "unit_code", "purchase_price", "sale_price", "tax_code", "manages_stock", "minimum_stock", "barcode"],
  OPENING_STOCK: ["warehouse_code", "item_code", "quantity", "unit_cost"],
  PRICE_LISTS: ["price_list_code", "price_list_name", "currency", "item_code", "minimum_quantity", "unit_price", "maximum_discount_rate", "valid_from", "valid_until", "is_default"]
};

function rowObject(headers: readonly string[], values: readonly string[]): Record<string, string> {
  return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
}

function validateRow(type: ImportType, row: Record<string, string>): string[] {
  const errors: string[] = [];
  if (type === "CUSTOMERS" || type === "SUPPLIERS") {
    if (!["NATURAL_PERSON", "LEGAL_ENTITY"].includes(row.party_type ?? "")) errors.push("party_type inválido");
    if (!["RUC", "DNI", "FOREIGN", "NONE"].includes(row.document_type ?? "")) errors.push("document_type inválido");
    if (row.document_type === "RUC" && !/^\d{11}$/.test(row.document_number ?? "")) errors.push("RUC inválido");
    if (row.document_type === "DNI" && !/^\d{8}$/.test(row.document_number ?? "")) errors.push("DNI inválido");
    if (row.party_type === "LEGAL_ENTITY" && !row.legal_name?.trim()) errors.push("legal_name obligatorio");
    if (row.party_type === "NATURAL_PERSON" && !row.first_name?.trim() && !row.last_name?.trim()) errors.push("nombre obligatorio");
  } else if (type === "PRODUCTS" || type === "SERVICES") {
    if (!row.code?.trim()) errors.push("code obligatorio");
    if (!row.name?.trim()) errors.push("name obligatorio");
    for (const field of ["purchase_price", "sale_price", "minimum_stock"] as const) {
      if (!/^\d{1,16}(?:\.\d{1,6})?$/.test(row[field] ?? "")) errors.push(`${field} inválido`);
    }
    if (!["true", "false"].includes((row.manages_stock ?? "").toLowerCase())) errors.push("manages_stock inválido");
    if (type === "SERVICES" && row.manages_stock?.toLowerCase() === "true") errors.push("un servicio no administra stock");
  } else if (type === "OPENING_STOCK") {
    if (!row.warehouse_code?.trim() || !row.item_code?.trim()) errors.push("almacén e ítem obligatorios");
    if (!/^\d{1,16}(?:\.\d{1,6})?$/.test(row.quantity ?? "") || Number(row.quantity) <= 0) errors.push("quantity inválida");
  } else {
    if (!row.price_list_code?.trim() || !row.item_code?.trim()) errors.push("lista e ítem obligatorios");
    if (!/^\d{1,16}(?:\.\d{1,6})?$/.test(row.unit_price ?? "")) errors.push("unit_price inválido");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.valid_from ?? "")) errors.push("valid_from inválido");
  }
  return errors;
}

@Injectable()
export class ImportsService {
  constructor(private readonly database: DatabaseService) {}

  template(type: ImportType): string {
    return serializeCsv(headersByType[type], []);
  }

  async preview(request: ApiRequest, type: ImportType, csv: string) {
    if (Buffer.byteLength(csv, "utf8") > 5 * 1024 * 1024) throw new ConflictException("El CSV supera 5 MB.");
    const parsed = parseCsv(csv);
    if (parsed.length < 2) throw new ConflictException("El CSV no contiene filas de datos.");
    if (parsed.length > 5001) throw new ConflictException("El CSV supera el máximo de 5,000 filas.");
    const expected = headersByType[type];
    const headers = parsed[0]!.map((value) => value.toLowerCase());
    if (expected.length !== headers.length || expected.some((header, index) => headers[index] !== header)) {
      throw new ConflictException(`Cabeceras inválidas. Se requiere: ${expected.join(", ")}.`);
    }
    const seen = new Set<string>();
    const rows = parsed.slice(1).map((values, index) => {
      const normalized = rowObject(expected, values);
      const key = type === "CUSTOMERS" || type === "SUPPLIERS"
        ? `${normalized.document_type}:${normalizePartyDocument(normalized.document_number)}`
        : type === "PRODUCTS" || type === "SERVICES" ? normalized.code!.toUpperCase()
        : type === "OPENING_STOCK" ? `${normalized.warehouse_code}:${normalized.item_code}`
        : `${normalized.price_list_code}:${normalized.item_code}:${normalized.minimum_quantity}`;
      const errors = validateRow(type, normalized);
      if (seen.has(key)) errors.push("fila duplicada dentro del archivo");
      seen.add(key);
      return { rowNumber: index + 2, normalized, errors };
    });
    const existingKeys = await this.existingKeys(request, type, rows.map((row) => row.normalized));
    for (const row of rows) {
      const key = type === "CUSTOMERS" || type === "SUPPLIERS"
        ? normalizePartyDocument(row.normalized.document_number)
        : type === "PRODUCTS" || type === "SERVICES" ? row.normalized.code!.toUpperCase()
        : null;
      if (key && existingKeys.has(key)) row.errors.push("ya existe en la empresa");
    }
    const id = randomUUID();
    await this.database.scopedTransaction(request.auth!, async (client) => {
      await client.query(
        `insert into import_jobs(id,tenant_id,company_id,import_type,status,headers,total_rows,valid_rows,
          invalid_rows,created_by)
         values($1,$2,$3,$4,'PREVIEWED',$5::jsonb,$6,$7,$8,$9)`,
        [
          id, request.auth!.tenantId, request.auth!.companyId, type, JSON.stringify(headers), rows.length,
          rows.filter((row) => row.errors.length === 0).length,
          rows.filter((row) => row.errors.length > 0).length, request.auth!.userId
        ]
      );
      for (const row of rows) {
        await client.query(
          `insert into import_job_rows(tenant_id,company_id,import_job_id,row_number,normalized_data,errors,status)
           values($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7)`,
          [
            request.auth!.tenantId, request.auth!.companyId, id, row.rowNumber,
            JSON.stringify(row.normalized), JSON.stringify(row.errors), row.errors.length ? "INVALID" : "VALID"
          ]
        );
      }
    });
    return {
      id, type, totalRows: rows.length,
      validRows: rows.filter((row) => row.errors.length === 0).length,
      invalidRows: rows.filter((row) => row.errors.length > 0).length,
      rows: rows.slice(0, 200)
    };
  }

  private async existingKeys(request: ApiRequest, type: ImportType, rows: Array<Record<string, string>>) {
    if (type === "CUSTOMERS" || type === "SUPPLIERS") {
      const documents = rows.map((row) => normalizePartyDocument(row.document_number)).filter(Boolean);
      const existing = await this.database.query<{ normalized_document: string }>(
        `select normalized_document from parties where tenant_id=$1 and company_id=$2
         and normalized_document=any($3::text[]) and status<>'deleted'`,
        [request.auth!.tenantId, request.auth!.companyId, documents]
      );
      return new Set(existing.map((row) => row.normalized_document));
    }
    if (type === "PRODUCTS" || type === "SERVICES") {
      const codes = rows.map((row) => row.code!.toUpperCase());
      const existing = await this.database.query<{ code: string }>(
        `select code from items where tenant_id=$1 and company_id=$2 and code=any($3::text[])`,
        [request.auth!.tenantId, request.auth!.companyId, codes]
      );
      return new Set(existing.map((row) => row.code));
    }
    return new Set<string>();
  }

  async execute(request: ApiRequest, jobId: string, key: string) {
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const idempotency = await beginIdempotentOperation(client, request, "ExecuteImport", key, { jobId });
      if (idempotency.replay) return idempotency.replay;
      const jobResult = await client.query<{ import_type: ImportType; status: string; invalid_rows: number }>(
        `select import_type,status,invalid_rows from import_jobs
         where id=$1 and tenant_id=$2 and company_id=$3 for update`,
        [jobId, request.auth!.tenantId, request.auth!.companyId]
      );
      const job = jobResult.rows[0];
      if (!job) throw new NotFoundException("La importación no existe.");
      if (job.status !== "PREVIEWED" || job.invalid_rows > 0) {
        throw new ConflictException("Sólo una previsualización sin errores puede ejecutarse.");
      }
      const rows = await client.query<{ id: string; normalized_data: Record<string, string> }>(
        `select id,normalized_data from import_job_rows where import_job_id=$1 and status='VALID' order by row_number`,
        [jobId]
      );
      await client.query("update import_jobs set status='EXECUTING',idempotency_key=$2 where id=$1", [jobId, key]);
      let executed = 0;
      for (const row of rows.rows) {
        const entityId = await this.executeRow(client, request, job.import_type, row.normalized_data, jobId);
        await client.query(
          `update import_job_rows set status='IMPORTED',created_entity_id=$2 where id=$1`,
          [row.id, entityId]
        );
        executed += 1;
      }
      await client.query(
        `update import_jobs set status='COMPLETED',executed_rows=$2,completed_at=now() where id=$1`,
        [jobId, executed]
      );
      const response = { id: jobId, status: "COMPLETED", executedRows: executed };
      await appendAudit(client, request, {
        action: "import.executed", entityType: "import-job", entityId: jobId,
        newValues: { type: job.import_type, executed }
      });
      await completeIdempotentOperation(client, idempotency.id, response);
      return response;
    });
  }

  private async executeRow(
    client: PoolClient, request: ApiRequest, type: ImportType,
    row: Record<string, string>, jobId: string
  ): Promise<string> {
    if (type === "CUSTOMERS" || type === "SUPPLIERS") {
      const id = randomUUID();
      const partyType = row.party_type as PartyType;
      await client.query(
        `insert into parties(id,tenant_id,company_id,party_type,document_type,document_number,normalized_document,
          legal_name,commercial_name,first_name,last_name,normalized_name,email,phone,notes,created_by)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
        [
          id, request.auth!.tenantId, request.auth!.companyId, partyType, row.document_type,
          row.document_number || null, normalizePartyDocument(row.document_number), row.legal_name || null,
          row.commercial_name || null, row.first_name || null, row.last_name || null,
          normalizePartySearchName({
            legalName: row.legal_name, commercialName: row.commercial_name,
            firstName: row.first_name, lastName: row.last_name
          }), row.email || null, row.phone || null, `Importación ${jobId}`, request.auth!.userId
        ]
      );
      const role = type === "CUSTOMERS" ? "CUSTOMER" : "SUPPLIER";
      await client.query(
        `insert into party_roles(tenant_id,company_id,party_id,role_code,created_by)
         values($1,$2,$3,$4,$5)`,
        [request.auth!.tenantId, request.auth!.companyId, id, role, request.auth!.userId]
      );
      if (role === "CUSTOMER") await client.query(
        `insert into customer_profiles(party_id,tenant_id,company_id,updated_by) values($1,$2,$3,$4)`,
        [id, request.auth!.tenantId, request.auth!.companyId, request.auth!.userId]
      );
      else await client.query(
        `insert into supplier_profiles(party_id,tenant_id,company_id,updated_by) values($1,$2,$3,$4)`,
        [id, request.auth!.tenantId, request.auth!.companyId, request.auth!.userId]
      );
      return id;
    }
    if (type === "PRODUCTS" || type === "SERVICES") {
      const catalog = await client.query<{ unit_id: string; tax_id: string }>(
        `select u.id unit_id,tp.id tax_id from units_of_measure u cross join tax_profiles tp
         where u.company_id=$1 and u.code=$2 and tp.company_id=$1 and tp.code=$3 limit 1`,
        [request.auth!.companyId, row.unit_code, row.tax_code]
      );
      if (!catalog.rows[0]) throw new ConflictException(`Catálogo no encontrado para ${row.code}.`);
      const id = randomUUID();
      await client.query(
        `insert into items(id,tenant_id,company_id,code,name,description,item_type,unit_id,tax_profile_id,
          purchase_price,sale_price,currency,manages_stock,minimum_stock,created_by)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'PEN',$12,$13,$14)`,
        [
          id, request.auth!.tenantId, request.auth!.companyId, row.code!.toUpperCase(), row.name,
          row.description || null, type === "SERVICES" ? ItemType.SERVICE : ItemType.PRODUCT,
          catalog.rows[0].unit_id, catalog.rows[0].tax_id, row.purchase_price, row.sale_price,
          row.manages_stock?.toLowerCase() === "true", row.minimum_stock, request.auth!.userId
        ]
      );
      if (row.barcode) await client.query(
        `insert into item_barcodes(tenant_id,company_id,item_id,barcode,is_primary) values($1,$2,$3,$4,true)`,
        [request.auth!.tenantId, request.auth!.companyId, id, row.barcode]
      );
      return id;
    }
    if (type === "OPENING_STOCK") {
      const refs = await client.query<{ warehouse_id: string; item_id: string }>(
        `select w.id warehouse_id,i.id item_id from warehouses w cross join items i
         where w.company_id=$1 and w.code=$2 and i.company_id=$1 and i.code=$3`,
        [request.auth!.companyId, row.warehouse_code, row.item_code]
      );
      if (!refs.rows[0]) throw new ConflictException("Almacén o ítem no encontrado.");
      const id = randomUUID();
      await client.query(
        `insert into stock_movements(id,tenant_id,company_id,warehouse_id,movement_type,source_entity_type,
          source_entity_id,reason,idempotency_key,created_by)
         values($1,$2,$3,$4,'OPENING','import-job',$5,'Importación de saldo inicial',$6,$7)`,
        [id, request.auth!.tenantId, request.auth!.companyId, refs.rows[0].warehouse_id, jobId, `${jobId}:${id}`, request.auth!.userId]
      );
      await client.query(
        `insert into stock_movement_lines(tenant_id,company_id,stock_movement_id,item_id,quantity,signed_quantity,unit_cost)
         values($1,$2,$3,$4,$5,$5,$6)`,
        [request.auth!.tenantId, request.auth!.companyId, id, refs.rows[0].item_id, row.quantity, row.unit_cost || null]
      );
      await client.query(
        `insert into stock_balances(tenant_id,company_id,warehouse_id,item_id,quantity)
         values($1,$2,$3,$4,$5) on conflict(warehouse_id,item_id) do update
         set quantity=stock_balances.quantity+excluded.quantity,updated_at=now(),version=stock_balances.version+1`,
        [request.auth!.tenantId, request.auth!.companyId, refs.rows[0].warehouse_id, refs.rows[0].item_id, row.quantity]
      );
      return id;
    }
    const itemResult = await client.query<{ id: string }>(
      "select id from items where company_id=$1 and code=$2",
      [request.auth!.companyId, row.item_code]
    );
    if (!itemResult.rows[0]) throw new ConflictException(`Ítem ${row.item_code} no encontrado.`);
    const listResult = await client.query<{ id: string }>(
      "select id from price_lists where company_id=$1 and code=$2",
      [request.auth!.companyId, row.price_list_code]
    );
    let priceListId = listResult.rows[0]?.id;
    if (!listResult.rows[0]) {
      priceListId = randomUUID();
      await client.query(
        `insert into price_lists(id,tenant_id,company_id,code,name,currency,valid_from,valid_until,is_default,created_by)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          priceListId, request.auth!.tenantId, request.auth!.companyId, row.price_list_code,
          row.price_list_name, row.currency, row.valid_from, row.valid_until || null,
          row.is_default?.toLowerCase() === "true", request.auth!.userId
        ]
      );
    }
    const id = randomUUID();
    await client.query(
      `insert into price_list_items(id,tenant_id,company_id,price_list_id,item_id,minimum_quantity,
        unit_price,maximum_discount_rate,valid_from,valid_until,created_by)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        id, request.auth!.tenantId, request.auth!.companyId, priceListId, itemResult.rows[0].id,
        row.minimum_quantity, row.unit_price, row.maximum_discount_rate, row.valid_from,
        row.valid_until || null, request.auth!.userId
      ]
    );
    return id;
  }

  async export(request: ApiRequest, type: string, limit: number) {
    const queries: Readonly<Record<string, { headers: string[]; sql: string }>> = {
      customers: {
        headers: ["document_type", "document_number", "name", "email", "phone", "status"],
        sql: `select p.document_type,p.document_number,coalesce(p.legal_name,concat_ws(' ',p.first_name,p.last_name),p.commercial_name) name,
          p.email::text,p.phone,p.status from parties p join party_roles pr on pr.party_id=p.id and pr.role_code='CUSTOMER'
          where p.tenant_id=$1 and p.company_id=$2 order by name limit $3`
      },
      suppliers: {
        headers: ["document_type", "document_number", "name", "email", "phone", "status"],
        sql: `select p.document_type,p.document_number,coalesce(p.legal_name,concat_ws(' ',p.first_name,p.last_name),p.commercial_name) name,
          p.email::text,p.phone,p.status from parties p join party_roles pr on pr.party_id=p.id and pr.role_code='SUPPLIER'
          where p.tenant_id=$1 and p.company_id=$2 order by name limit $3`
      },
      products: {
        headers: ["code", "name", "item_type", "sale_price", "currency", "status"],
        sql: `select code,name,item_type,sale_price::text,currency,status from items
          where tenant_id=$1 and company_id=$2 order by name limit $3`
      },
      sales: {
        headers: ["sale_number", "sale_date", "currency", "total", "status"],
        sql: `select sale_number,sale_date::text,currency,total::text,status from sales
          where tenant_id=$1 and company_id=$2 order by sale_date desc limit $3`
      },
      purchases: {
        headers: ["purchase_number", "purchase_date", "currency", "total", "status"],
        sql: `select purchase_number,purchase_date::text,currency,total::text,status from purchases
          where tenant_id=$1 and company_id=$2 order by purchase_date desc limit $3`
      },
      receivables: {
        headers: ["id", "currency", "principal", "outstanding_amount", "due_date", "status"],
        sql: `select id,currency,principal::text,outstanding_amount::text,due_date::text,status from accounts_receivable
          where tenant_id=$1 and company_id=$2 order by due_date limit $3`
      },
      payables: {
        headers: ["id", "currency", "principal", "outstanding_amount", "due_date", "status"],
        sql: `select id,currency,principal::text,outstanding_amount::text,due_date::text,status from accounts_payable
          where tenant_id=$1 and company_id=$2 order by due_date limit $3`
      },
      inventory: {
        headers: ["warehouse", "code", "name", "quantity"],
        sql: `select w.name warehouse,i.code,i.name,sb.quantity::text from stock_balances sb
          join warehouses w on w.id=sb.warehouse_id join items i on i.id=sb.item_id
          where sb.tenant_id=$1 and sb.company_id=$2 order by w.name,i.name limit $3`
      },
      cash: {
        headers: ["occurred_at", "account", "movement_type", "signed_amount", "currency", "description"],
        sql: `select cm.occurred_at::text,ca.name account,cm.movement_type,cm.signed_amount::text,cm.currency,cm.description
          from cash_movements cm join cash_accounts ca on ca.id=cm.cash_account_id
          where cm.tenant_id=$1 and cm.company_id=$2 order by cm.occurred_at desc limit $3`
      }
    };
    const definition = queries[type];
    if (!definition) throw new ConflictException("Tipo de exportación no soportado.");
    const rows = await this.database.query<Record<string, unknown>>(
      definition.sql, [request.auth!.tenantId, request.auth!.companyId, limit]
    );
    const id = randomUUID();
    await this.database.scopedTransaction(request.auth!, async (client) => {
      await client.query(
        `insert into export_jobs(id,tenant_id,company_id,export_type,status,row_count,created_by,completed_at)
         values($1,$2,$3,$4,'COMPLETED',$5,$6,now())`,
        [id, request.auth!.tenantId, request.auth!.companyId, type, rows.length, request.auth!.userId]
      );
      await appendAudit(client, request, {
        action: "export.executed", entityType: "export-job", entityId: id,
        newValues: { type, rowCount: rows.length, limit }
      });
    });
    return { id, filename: `${type}-${new Date().toISOString().slice(0, 10)}.csv`, csv: serializeCsv(definition.headers, rows) };
  }
}
