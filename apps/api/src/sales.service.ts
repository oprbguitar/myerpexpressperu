import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import {
  DefaultPriceResolver,
  PeruvianTaxCalculator,
  QuotationStatus,
  TaxCategory,
  confirmSale,
  confirmSalesOrder,
  transitionQuotation
} from "@erp/domain";
import { DatabaseService } from "./database.service.js";
import type { ApiRequest } from "./http.js";
import {
  appendAudit,
  appendOutboxEvent,
  beginIdempotentOperation,
  completeIdempotentOperation
} from "./operations.js";

export interface CommercialLineInput {
  itemId: string;
  quantity: string;
  discountRate: string;
  manualUnitPrice?: string | undefined;
}

interface PricedLine {
  itemId: string;
  itemCode: string;
  description: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  discountRate: string;
  taxCategory: TaxCategory;
  taxRate: string;
  stockManaged: boolean;
  subtotal: string;
  discountAmount: string;
  taxAmount: string;
  total: string;
}

interface Totals {
  subtotal: string;
  discountTotal: string;
  taxableAmount: string;
  exemptAmount: string;
  unaffectedAmount: string;
  igvAmount: string;
  total: string;
}

@Injectable()
export class SalesService {
  private readonly taxCalculator = new PeruvianTaxCalculator();
  private readonly priceResolver = new DefaultPriceResolver();
  constructor(private readonly database: DatabaseService) {}

  private async customerSnapshot(client: PoolClient, request: ApiRequest, customerId: string) {
    const result = await client.query<{
      id: string; name: string; document_type: string | null; document_number: string | null; address: string | null;
    }>(
      `select p.id,coalesce(p.legal_name,concat_ws(' ',p.first_name,p.last_name),p.commercial_name) name,
       p.document_type,p.document_number,pa.line1 address
       from parties p join party_roles pr on pr.party_id=p.id and pr.role_code='CUSTOMER' and pr.status='active'
       left join lateral(select line1 from party_addresses where party_id=p.id and status='active' order by is_primary desc limit 1) pa on true
       where p.id=$1 and p.tenant_id=$2 and p.company_id=$3 and p.status='active'`,
      [customerId, request.auth!.tenantId, request.auth!.companyId]
    );
    const row = result.rows[0];
    if (!row) throw new NotFoundException("El cliente no existe o está inactivo.");
    return {
      id: row.id, name: row.name, documentType: row.document_type,
      documentNumber: row.document_number, address: row.address
    };
  }

  private async priceLines(
    client: PoolClient,
    request: ApiRequest,
    customerId: string,
    inputLines: readonly CommercialLineInput[],
    at: string
  ): Promise<{ lines: PricedLine[]; totals: Totals }> {
    const itemIds = [...new Set(inputLines.map((line) => line.itemId))];
    const itemRows = await client.query<{
      id: string; code: string; name: string; sale_price: string; currency: string; status: string;
      tax_category: TaxCategory; tax_rate: string | null; unit: string | null; manages_stock: boolean;
    }>(
      `select i.id,i.code,i.name,i.sale_price::text,i.currency,i.status,tp.tax_category,
       tr.rate::text tax_rate,u.code unit,i.manages_stock
       from items i join tax_profiles tp on tp.id=i.tax_profile_id
       left join units_of_measure u on u.id=i.unit_id
       left join lateral(
         select rate from tax_rates where tax_profile_id=tp.id and effective_from<=$2::date
           and (effective_until is null or effective_until>=$2::date)
         order by effective_from desc limit 1
       ) tr on true
       where i.id=any($1::uuid[]) and i.tenant_id=$3 and i.company_id=$4`,
      [itemIds, at, request.auth!.tenantId, request.auth!.companyId]
    );
    if (itemRows.rows.length !== itemIds.length) throw new NotFoundException("Uno o más productos no existen.");
    const candidateRows = await client.query<{
      item_id: string; price_list_id: string; unit_price: string; currency: string;
      minimum_quantity: string; maximum_discount_rate: string; valid_from: string;
      valid_until: string | null; customer_specific: boolean; company_default: boolean;
    }>(
      `select pli.item_id,pl.id price_list_id,pli.unit_price::text,pl.currency,
       pli.minimum_quantity::text,pli.maximum_discount_rate::text,pli.valid_from::text,
       pli.valid_until::text,
       exists(select 1 from customer_price_lists cpl where cpl.price_list_id=pl.id
         and cpl.customer_party_id=$2 and cpl.valid_from<=$3::date
         and (cpl.valid_until is null or cpl.valid_until>=$3::date)) customer_specific,
       pl.is_default company_default
       from price_list_items pli join price_lists pl on pl.id=pli.price_list_id
       where pli.item_id=any($1::uuid[]) and pl.company_id=$4 and pl.status='active'`,
      [itemIds, customerId, at, request.auth!.companyId]
    );
    const candidateRecords = candidateRows.rows;
    const itemsById = new Map(itemRows.rows.map((item) => [item.id, item]));
    const candidatesByItem = new Map<string, typeof candidateRecords>();
    for (const candidate of candidateRecords) {
      candidatesByItem.set(candidate.item_id, [...(candidatesByItem.get(candidate.item_id) ?? []), candidate]);
    }
    const resolvedLines = inputLines.map((line) => {
      const item = itemsById.get(line.itemId)!;
      if (item.status !== "active") throw new ConflictException(`El ítem ${item.code} está inactivo.`);
      const candidates = candidatesByItem.get(item.id) ?? [];
      const mapCandidate = (row: typeof candidateRecords[number]) => ({
        priceListId: row.price_list_id, price: row.unit_price, currency: row.currency,
        minimumQuantity: row.minimum_quantity, maximumDiscountRate: row.maximum_discount_rate,
        validFrom: row.valid_from, ...(row.valid_until ? { validUntil: row.valid_until } : {})
      });
      const resolved = this.priceResolver.resolve({
        quantity: line.quantity, itemDefaultPrice: item.sale_price, currency: item.currency,
        customerPrices: candidates.filter((candidate) => candidate.customer_specific).map(mapCandidate),
        defaultPrices: candidates.filter((candidate) => candidate.company_default).map(mapCandidate),
        ...(line.manualUnitPrice !== undefined ? { manualPrice: line.manualUnitPrice } : {}),
        allowManualPrice: request.auth!.permissions.has("sales.price.override"), at
      });
      const discount = Number(line.discountRate);
      const allowedDiscount = Number(resolved.maximumDiscountRate);
      if (discount > allowedDiscount && !request.auth!.permissions.has("sales.discount.override")) {
        throw new ConflictException(`El descuento del ítem ${item.code} supera el límite permitido.`);
      }
      return {
        itemId: item.id, itemCode: item.code, description: item.name, unit: item.unit ?? "ZZ",
        quantity: line.quantity, unitPrice: resolved.price, discountRate: line.discountRate,
        taxCategory: item.tax_category, taxRate: item.tax_rate ?? "0", stockManaged: item.manages_stock
      };
    });
    const calculated = this.taxCalculator.calculate(resolvedLines.map((line) => ({
      quantity: line.quantity, unitPrice: line.unitPrice, discountRate: line.discountRate,
      taxRate: line.taxRate, taxCategory: line.taxCategory
    })));
    const lines = resolvedLines.map((line, index) => ({
      ...line,
      subtotal: calculated.lines[index]!.subtotal,
      discountAmount: calculated.lines[index]!.discount,
      taxAmount: calculated.lines[index]!.taxAmount,
      total: calculated.lines[index]!.total
    }));
    return {
      lines,
      totals: {
        subtotal: calculated.subtotal, discountTotal: calculated.discount,
        taxableAmount: calculated.taxableAmount, exemptAmount: calculated.exemptAmount,
        unaffectedAmount: calculated.unaffectedAmount, igvAmount: calculated.igv, total: calculated.total
      }
    };
  }

  private async nextNumber(client: PoolClient, request: ApiRequest, type: string): Promise<{ series: string; number: number; formatted: string }> {
    const result = await client.query<{ series: string; current_number: string }>(
      `update document_series set current_number=current_number+1,updated_by=$3,updated_at=now(),version=version+1
       where id=(
         select id from document_series where company_id=$1 and document_type=$2 and status='active'
         order by series limit 1 for update
       ) returning series,current_number::text`,
      [request.auth!.companyId, type, request.auth!.userId]
    );
    const row = result.rows[0];
    if (!row) throw new ConflictException(`No existe una serie activa para ${type}.`);
    const number = Number(row.current_number);
    return { series: row.series, number, formatted: `${row.series}-${String(number).padStart(8, "0")}` };
  }

  listQuotations(request: ApiRequest, input: { status?: string | undefined; limit: number }) {
    return this.database.query(
      `select q.id,q.quotation_number as "number",q.issue_date as "issueDate",q.valid_until as "validUntil",
       q.status,q.currency,q.total::text,q.version,p.legal_name as "customerName"
       from quotations q join parties p on p.id=q.customer_party_id
       where q.tenant_id=$1 and q.company_id=$2 and ($3::text is null or q.status=$3)
       order by q.issue_date desc,q.id desc limit $4`,
      [request.auth!.tenantId, request.auth!.companyId, input.status ?? null, input.limit]
    );
  }

  async createQuotation(request: ApiRequest, input: {
    customerPartyId: string; validUntil: string; currency: string; paymentTermId?: string | undefined;
    notes?: string | undefined; lines: CommercialLineInput[];
  }) {
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const customer = await this.customerSnapshot(client, request, input.customerPartyId);
      const priced = await this.priceLines(client, request, input.customerPartyId, input.lines, new Date().toISOString().slice(0, 10));
      const number = await this.nextNumber(client, request, "QUOTATION");
      const id = randomUUID();
      await client.query(
        `insert into quotations(id,tenant_id,company_id,branch_id,customer_party_id,quotation_number,
          issue_date,valid_until,currency,payment_term_id,customer_snapshot,subtotal,discount_total,
          taxable_amount,exempt_amount,unaffected_amount,igv_amount,total,notes,status,created_by)
         values($1,$2,$3,$4,$5,$6,current_date,$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15,$16,$17,$18,'DRAFT',$19)`,
        [
          id, request.auth!.tenantId, request.auth!.companyId, request.auth!.branchIds[0] ?? null,
          input.customerPartyId, number.formatted, input.validUntil, input.currency.toUpperCase(),
          input.paymentTermId ?? null, JSON.stringify(customer), priced.totals.subtotal,
          priced.totals.discountTotal, priced.totals.taxableAmount, priced.totals.exemptAmount,
          priced.totals.unaffectedAmount, priced.totals.igvAmount, priced.totals.total,
          input.notes?.trim() || null, request.auth!.userId
        ]
      );
      await this.insertLines(client, "quotation_lines", "quotation_id", id, request, priced.lines);
      await appendAudit(client, request, {
        action: "quotation.created", entityType: "quotation", entityId: id,
        newValues: { number: number.formatted, customer, totals: priced.totals }
      });
      await appendOutboxEvent(client, request, {
        aggregateType: "Quotation", aggregateId: id, eventType: "QuotationCreated",
        payload: { quotationId: id, number: number.formatted }
      });
      return { id, number: number.formatted, status: "DRAFT", ...priced.totals };
    });
  }

  private async insertLines(
    client: PoolClient,
    table: "quotation_lines" | "sales_order_lines" | "sale_lines",
    parentColumn: "quotation_id" | "sales_order_id" | "sale_id",
    parentId: string,
    request: ApiRequest,
    lines: readonly PricedLine[]
  ): Promise<void> {
    for (const [index, line] of lines.entries()) {
      const stockColumn = table === "sale_lines" ? ",stock_managed" : "";
      const stockValue = table === "sale_lines" ? `,${line.stockManaged}` : "";
      await client.query(
        `insert into ${table}(tenant_id,company_id,${parentColumn},line_number,item_id,item_code_snapshot,
          description_snapshot,unit_snapshot,quantity,unit_price,discount_rate,tax_category,tax_rate,
          subtotal,discount_amount,tax_amount,total${stockColumn})
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17${stockValue})`,
        [
          request.auth!.tenantId, request.auth!.companyId, parentId, index + 1, line.itemId,
          line.itemCode, line.description, line.unit, line.quantity, line.unitPrice, line.discountRate,
          line.taxCategory, line.taxRate, line.subtotal, line.discountAmount, line.taxAmount, line.total
        ]
      );
    }
  }

  async transitionQuotation(request: ApiRequest, id: string, target: QuotationStatus, comment?: string) {
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const result = await client.query<{ status: QuotationStatus; valid_until: string }>(
        `select status,valid_until::text from quotations where id=$1 and tenant_id=$2 and company_id=$3 for update`,
        [id, request.auth!.tenantId, request.auth!.companyId]
      );
      const current = result.rows[0];
      if (!current) throw new NotFoundException("La cotización no existe.");
      if (target === QuotationStatus.ACCEPTED && current.valid_until < new Date().toISOString().slice(0, 10)) {
        throw new ConflictException("La cotización venció y no puede aceptarse sin autorización especial.");
      }
      transitionQuotation(current.status, target);
      await client.query(
        "update quotations set status=$2,updated_by=$3,updated_at=now(),version=version+1 where id=$1",
        [id, target, request.auth!.userId]
      );
      await appendAudit(client, request, {
        action: `quotation.${target.toLowerCase()}`, entityType: "quotation", entityId: id,
        previousValues: { status: current.status }, newValues: { status: target, comment }
      });
      await appendOutboxEvent(client, request, {
        aggregateType: "Quotation", aggregateId: id,
        eventType: `Quotation${target.charAt(0)}${target.slice(1).toLowerCase()}`,
        payload: { quotationId: id, status: target }
      });
      return { id, status: target };
    });
  }

  async convertQuotation(request: ApiRequest, id: string) {
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const quotation = await client.query<Record<string, unknown> & { status: QuotationStatus }>(
        `select * from quotations where id=$1 and tenant_id=$2 and company_id=$3 for update`,
        [id, request.auth!.tenantId, request.auth!.companyId]
      );
      const row = quotation.rows[0];
      if (!row) throw new NotFoundException("La cotización no existe.");
      transitionQuotation(row.status, QuotationStatus.CONVERTED);
      const number = await this.nextNumber(client, request, "SALES_ORDER");
      const orderId = randomUUID();
      await client.query(
        `insert into sales_orders(id,tenant_id,company_id,branch_id,quotation_id,customer_party_id,
          order_number,order_date,currency,exchange_rate,customer_snapshot,subtotal,discount_total,
          igv_amount,total,status,created_by)
         values($1,$2,$3,$4,$5,$6,$7,current_date,$8,$9,$10,$11,$12,$13,$14,'DRAFT',$15)`,
        [
          orderId, request.auth!.tenantId, request.auth!.companyId, row.branch_id, id, row.customer_party_id,
          number.formatted, row.currency, row.exchange_rate, row.customer_snapshot,
          row.subtotal, row.discount_total, row.igv_amount, row.total, request.auth!.userId
        ]
      );
      await client.query(
        `insert into sales_order_lines(tenant_id,company_id,sales_order_id,line_number,item_id,
          item_code_snapshot,description_snapshot,unit_snapshot,quantity,unit_price,discount_rate,
          tax_category,tax_rate,subtotal,discount_amount,tax_amount,total)
         select tenant_id,company_id,$2,line_number,item_id,item_code_snapshot,description_snapshot,
          unit_snapshot,quantity,unit_price,discount_rate,tax_category,tax_rate,subtotal,discount_amount,
          tax_amount,total from quotation_lines where quotation_id=$1`,
        [id, orderId]
      );
      await client.query(
        `update quotations set status='CONVERTED',converted_sales_order_id=$2,updated_by=$3,
          updated_at=now(),version=version+1 where id=$1`,
        [id, orderId, request.auth!.userId]
      );
      await appendAudit(client, request, {
        action: "quotation.converted", entityType: "quotation", entityId: id,
        newValues: { salesOrderId: orderId, number: number.formatted }
      });
      return { id: orderId, number: number.formatted, status: "DRAFT", quotationId: id };
    });
  }

  listOrders(request: ApiRequest, limit: number) {
    return this.database.query(
      `select so.id,so.order_number as "number",so.order_date as "orderDate",so.status,
       so.currency,so.total::text,p.legal_name as "customerName"
       from sales_orders so join parties p on p.id=so.customer_party_id
       where so.tenant_id=$1 and so.company_id=$2 order by so.order_date desc,so.id desc limit $3`,
      [request.auth!.tenantId, request.auth!.companyId, limit]
    );
  }

  async confirmOrder(request: ApiRequest, id: string, key: string) {
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const idempotency = await beginIdempotentOperation(client, request, "ConfirmSalesOrder", key, { id });
      if (idempotency.replay) return idempotency.replay;
      const result = await client.query<{ status: Parameters<typeof confirmSalesOrder>[0] }>(
        `select status from sales_orders where id=$1 and tenant_id=$2 and company_id=$3 for update`,
        [id, request.auth!.tenantId, request.auth!.companyId]
      );
      const row = result.rows[0];
      if (!row) throw new NotFoundException("El pedido no existe.");
      const status = confirmSalesOrder(row.status);
      await client.query(
        `update sales_orders set status=$2,confirmed_at=now(),updated_by=$3,updated_at=now(),
         version=version+1 where id=$1`,
        [id, status, request.auth!.userId]
      );
      const response = { id, status };
      await appendAudit(client, request, {
        action: "sales-order.confirmed", entityType: "sales-order", entityId: id, newValues: response
      });
      await appendOutboxEvent(client, request, {
        aggregateType: "SalesOrder", aggregateId: id, eventType: "SalesOrderConfirmed", payload: response
      });
      await completeIdempotentOperation(client, idempotency.id, response);
      return response;
    });
  }

  listSales(request: ApiRequest, limit: number) {
    return this.database.query(
      `select s.id,s.sale_number as "number",s.sale_date as "saleDate",s.status,s.payment_condition as "paymentCondition",
       s.currency,s.total::text,s.paid_amount::text as "paidAmount",p.legal_name as "customerName"
       from sales s join parties p on p.id=s.customer_party_id
       where s.tenant_id=$1 and s.company_id=$2 order by s.sale_date desc,s.id desc limit $3`,
      [request.auth!.tenantId, request.auth!.companyId, limit]
    );
  }

  async createDirectSale(request: ApiRequest, input: {
    customerPartyId: string; warehouseId?: string | undefined; paymentCondition: "CASH" | "CREDIT";
    dueDate?: string | undefined; currency: string; lines: CommercialLineInput[];
  }) {
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const customer = await this.customerSnapshot(client, request, input.customerPartyId);
      const priced = await this.priceLines(client, request, input.customerPartyId, input.lines, new Date().toISOString().slice(0, 10));
      const id = randomUUID();
      await client.query(
        `insert into sales(id,tenant_id,company_id,branch_id,warehouse_id,customer_party_id,sale_date,
          currency,payment_condition,due_date,customer_snapshot,subtotal,discount_total,taxable_amount,
          exempt_amount,unaffected_amount,igv_amount,total,status,created_by)
         values($1,$2,$3,$4,$5,$6,now(),$7,$8,$9,$10::jsonb,$11,$12,$13,$14,$15,$16,$17,'DRAFT',$18)`,
        [
          id, request.auth!.tenantId, request.auth!.companyId, request.auth!.branchIds[0] ?? null,
          input.warehouseId ?? null, input.customerPartyId, input.currency.toUpperCase(),
          input.paymentCondition, input.dueDate ?? null, JSON.stringify(customer), priced.totals.subtotal,
          priced.totals.discountTotal, priced.totals.taxableAmount, priced.totals.exemptAmount,
          priced.totals.unaffectedAmount, priced.totals.igvAmount, priced.totals.total, request.auth!.userId
        ]
      );
      await this.insertLines(client, "sale_lines", "sale_id", id, request, priced.lines);
      await appendAudit(client, request, {
        action: "sale.created", entityType: "sale", entityId: id, newValues: { customer, totals: priced.totals }
      });
      return { id, status: "DRAFT", ...priced.totals };
    });
  }

  async confirmSale(request: ApiRequest, id: string, key: string) {
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const idempotency = await beginIdempotentOperation(client, request, "ConfirmSale", key, { id });
      if (idempotency.replay) return idempotency.replay;
      const saleResult = await client.query<{
        status: Parameters<typeof confirmSale>[0]; warehouse_id: string | null; payment_condition: string;
        due_date: string | null; total: string; customer_party_id: string;
      }>(
        `select status,warehouse_id,payment_condition,due_date::text,total::text,customer_party_id
         from sales where id=$1 and tenant_id=$2 and company_id=$3 for update`,
        [id, request.auth!.tenantId, request.auth!.companyId]
      );
      const sale = saleResult.rows[0];
      if (!sale) throw new NotFoundException("La venta no existe.");
      const status = confirmSale(sale.status);
      const stockLines = await client.query<{ item_id: string; quantity: string; stock_managed: boolean }>(
        "select item_id,quantity::text,stock_managed from sale_lines where sale_id=$1 order by item_id",
        [id]
      );
      if (stockLines.rows.some((line) => line.stock_managed) && !sale.warehouse_id) {
        throw new ConflictException("La venta contiene productos con stock y requiere almacén.");
      }
      for (const line of stockLines.rows.filter((candidate) => candidate.stock_managed)) {
        await client.query(
          `insert into stock_balances(tenant_id,company_id,warehouse_id,item_id,quantity)
           values($1,$2,$3,$4,0) on conflict(warehouse_id,item_id) do nothing`,
          [request.auth!.tenantId, request.auth!.companyId, sale.warehouse_id, line.item_id]
        );
      }
      const lockIds = stockLines.rows.filter((line) => line.stock_managed).map((line) => line.item_id).sort();
      if (lockIds.length > 0) {
        const balances = await client.query<{ item_id: string; quantity: string; allow_negative_stock: boolean }>(
          `select sb.item_id,sb.quantity::text,w.allow_negative_stock
           from stock_balances sb join warehouses w on w.id=sb.warehouse_id
           where sb.warehouse_id=$1 and sb.item_id=any($2::uuid[]) order by sb.item_id for update`,
          [sale.warehouse_id, lockIds]
        );
        const balanceMap = new Map(balances.rows.map((balance) => [balance.item_id, balance]));
        for (const line of stockLines.rows.filter((candidate) => candidate.stock_managed)) {
          const balance = balanceMap.get(line.item_id);
          if (!balance || Number(balance.quantity) < Number(line.quantity)) {
            if (!balance?.allow_negative_stock) throw new ConflictException("Stock insuficiente para confirmar la venta.");
          }
        }
        const movementId = randomUUID();
        await client.query(
          `insert into stock_movements(id,tenant_id,company_id,branch_id,warehouse_id,movement_type,
            source_entity_type,source_entity_id,reason,idempotency_key,created_by)
           values($1,$2,$3,$4,$5,'SALE_ISSUE','sale',$6,'Confirmación de venta',$7,$8)`,
          [
            movementId, request.auth!.tenantId, request.auth!.companyId, request.auth!.branchIds[0] ?? null,
            sale.warehouse_id, id, `sale:${id}`, request.auth!.userId
          ]
        );
        for (const line of stockLines.rows.filter((candidate) => candidate.stock_managed)) {
          await client.query(
            `insert into stock_movement_lines(tenant_id,company_id,stock_movement_id,item_id,quantity,signed_quantity)
             values($1,$2,$3,$4,$5,-$5)`,
            [request.auth!.tenantId, request.auth!.companyId, movementId, line.item_id, line.quantity]
          );
          await client.query(
            `update stock_balances set quantity=quantity-$3,updated_at=now(),version=version+1
             where warehouse_id=$1 and item_id=$2`,
            [sale.warehouse_id, line.item_id, line.quantity]
          );
        }
      }
      let receivableId: string | null = null;
      if (sale.payment_condition === "CREDIT") {
        receivableId = randomUUID();
        await client.query(
          `insert into accounts_receivable(id,tenant_id,company_id,customer_party_id,sale_id,currency,
            principal,applied_amount,outstanding_amount,due_date,status,created_by)
           select $1,tenant_id,company_id,customer_party_id,id,currency,total,0,total,due_date,'OPEN',$2
           from sales where id=$3`,
          [receivableId, request.auth!.userId, id]
        );
        await appendOutboxEvent(client, request, {
          aggregateType: "AccountReceivable", aggregateId: receivableId,
          eventType: "ReceivableCreated", payload: { receivableId, saleId: id }
        });
      }
      const number = await this.nextNumber(client, request, "INTERNAL_SALE");
      await client.query(
        `update sales set sale_number=$2,status=$3,confirmed_at=now(),updated_by=$4,updated_at=now(),
          version=version+1 where id=$1`,
        [id, number.formatted, status, request.auth!.userId]
      );
      const response = { id, number: number.formatted, status, receivableId };
      await appendAudit(client, request, {
        action: "sale.confirmed", entityType: "sale", entityId: id, newValues: response
      });
      await appendOutboxEvent(client, request, {
        aggregateType: "Sale", aggregateId: id, eventType: "SaleConfirmed", payload: response
      });
      await completeIdempotentOperation(client, idempotency.id, response);
      return response;
    });
  }

  async issueDocument(request: ApiRequest, saleId: string, documentType: string, key: string) {
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const idempotency = await beginIdempotentOperation(
        client, request, "IssueCommercialDocument", key, { saleId, documentType }
      );
      if (idempotency.replay) return idempotency.replay;
      const saleResult = await client.query<Record<string, unknown> & {
        status: string; customer_snapshot: Record<string, unknown>; total: string;
      }>(
        `select * from sales where id=$1 and tenant_id=$2 and company_id=$3 for update`,
        [saleId, request.auth!.tenantId, request.auth!.companyId]
      );
      const sale = saleResult.rows[0];
      if (!sale || !["CONFIRMED", "PARTIALLY_PAID", "PAID"].includes(sale.status)) {
        throw new ConflictException("Sólo una venta confirmada puede emitir un documento.");
      }
      const existing = await client.query<{ id: string; series: string; sequential_number: string; status: string }>(
        `select id,series,sequential_number::text,status from commercial_documents
         where sale_id=$1 and status<>'CANCELLED_INTERNAL' order by created_at desc limit 1`,
        [saleId]
      );
      if (existing.rows[0]) throw new ConflictException("La venta ya tiene un documento comercial activo.");
      const number = await this.nextNumber(client, request, documentType);
      const id = randomUUID();
      await client.query(
        `insert into commercial_documents(id,tenant_id,company_id,branch_id,establishment_id,sale_id,
          document_type,series,sequential_number,issue_date,customer_snapshot,customer_document,
          customer_address,currency,exchange_rate,taxable_amount,exempt_amount,unaffected_amount,
          igv_amount,total,payment_condition,due_date,sunat_provider,sunat_environment,status,created_by)
         select $1,tenant_id,company_id,branch_id,ds.establishment_id,id,$2,$3,$4,now(),customer_snapshot,
          customer_snapshot->>'documentNumber',customer_snapshot->>'address',currency,exchange_rate,
          taxable_amount,exempt_amount,unaffected_amount,igv_amount,total,payment_condition,due_date,
          'MANUAL','MANUAL','ISSUED',$5
         from sales cross join lateral(
           select establishment_id from document_series
           where company_id=sales.company_id and document_type=$2 and series=$3 limit 1
         ) ds where sales.id=$6`,
        [id, documentType, number.series, number.number, request.auth!.userId, saleId]
      );
      await client.query(
        `insert into commercial_document_lines(tenant_id,company_id,commercial_document_id,line_number,
          item_id,item_code_snapshot,description_snapshot,unit_snapshot,quantity,unit_price,discount_amount,
          tax_category,tax_rate,tax_amount,total)
         select tenant_id,company_id,$2,line_number,item_id,item_code_snapshot,description_snapshot,
          unit_snapshot,quantity,unit_price,discount_amount,tax_category,tax_rate,tax_amount,total
         from sale_lines where sale_id=$1`,
        [saleId, id]
      );
      await client.query(
        `insert into commercial_document_events(tenant_id,company_id,commercial_document_id,
          previous_status,new_status,comment,actor_user_id)
         values($1,$2,$3,'DRAFT','ISSUED','Emisión interna autoritativa',$4)`,
        [request.auth!.tenantId, request.auth!.companyId, id, request.auth!.userId]
      );
      const response = { id, documentType, series: number.series, number: number.number, formatted: number.formatted, status: "ISSUED" };
      await appendAudit(client, request, {
        action: "commercial-document.issued", entityType: "commercial-document", entityId: id, newValues: response
      });
      await appendOutboxEvent(client, request, {
        aggregateType: "CommercialDocument", aggregateId: id,
        eventType: "CommercialDocumentIssued", payload: response
      });
      await completeIdempotentOperation(client, idempotency.id, response);
      return response;
    });
  }

  async cancelSale(request: ApiRequest, id: string, reason: string, key: string) {
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const idempotency = await beginIdempotentOperation(client, request, "CancelSale", key, { id, reason });
      if (idempotency.replay) return idempotency.replay;
      const result = await client.query<{ status: string; warehouse_id: string | null }>(
        `select status,warehouse_id from sales
         where id=$1 and tenant_id=$2 and company_id=$3 for update`,
        [id, request.auth!.tenantId, request.auth!.companyId]
      );
      const sale = result.rows[0];
      if (!sale || !["DRAFT", "CONFIRMED"].includes(sale.status)) {
        throw new ConflictException("La venta no admite cancelación en su estado actual.");
      }
      const activeDocument = await client.query<{ id: string }>(
        `select id from commercial_documents where sale_id=$1
         and status not in ('VOIDED','CANCELLED_INTERNAL') limit 1`,
        [id]
      );
      if (activeDocument.rows[0]) {
        throw new ConflictException("Anule primero el documento comercial asociado.");
      }
      const receivable = await client.query<{ id: string; applied_amount: string }>(
        "select id,applied_amount::text from accounts_receivable where sale_id=$1 for update",
        [id]
      );
      if (Number(receivable.rows[0]?.applied_amount ?? "0") !== 0) {
        throw new ConflictException("Revierta primero los cobros aplicados.");
      }
      if (sale.status === "CONFIRMED" && sale.warehouse_id) {
        const lines = await client.query<{ item_id: string; quantity: string }>(
          `select item_id,quantity::text from sale_lines
           where sale_id=$1 and stock_managed order by item_id`,
          [id]
        );
        if (lines.rows.length) {
          const movementId = randomUUID();
          await client.query(
            `insert into stock_movements(id,tenant_id,company_id,branch_id,warehouse_id,movement_type,
              source_entity_type,source_entity_id,reason,idempotency_key,created_by)
             values($1,$2,$3,$4,$5,'CUSTOMER_RETURN','sale-cancellation',$6,$7,$8,$9)`,
            [
              movementId, request.auth!.tenantId, request.auth!.companyId,
              request.auth!.branchIds[0] ?? null, sale.warehouse_id, id, reason.trim(),
              `sale-cancel:${id}`, request.auth!.userId
            ]
          );
          for (const line of lines.rows) {
            await client.query(
              `insert into stock_movement_lines(tenant_id,company_id,stock_movement_id,item_id,quantity,signed_quantity)
               values($1,$2,$3,$4,$5,$5)`,
              [request.auth!.tenantId, request.auth!.companyId, movementId, line.item_id, line.quantity]
            );
            await client.query(
              `update stock_balances set quantity=quantity+$3,updated_at=now(),version=version+1
               where warehouse_id=$1 and item_id=$2`,
              [sale.warehouse_id, line.item_id, line.quantity]
            );
          }
        }
      }
      await client.query(
        "update accounts_receivable set status='CANCELLED',outstanding_amount=0,updated_by=$2,updated_at=now(),version=version+1 where sale_id=$1",
        [id, request.auth!.userId]
      );
      await client.query(
        `update sales set status='CANCELLED',cancelled_at=now(),updated_by=$2,updated_at=now(),version=version+1
         where id=$1`,
        [id, request.auth!.userId]
      );
      const response = { id, status: "CANCELLED" };
      await appendAudit(client, request, {
        action: "sale.cancelled", entityType: "sale", entityId: id,
        previousValues: sale, newValues: { ...response, reason }
      });
      await appendOutboxEvent(client, request, {
        aggregateType: "Sale", aggregateId: id, eventType: "SaleCancelled", payload: { ...response, reason }
      });
      await completeIdempotentOperation(client, idempotency.id, response);
      return response;
    });
  }
}
