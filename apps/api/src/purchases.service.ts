import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import {
  PeruvianTaxCalculator, PurchaseStatus, TaxCategory, confirmPurchase, formatDecimal, parseDecimal
} from "@erp/domain";
import { DatabaseService } from "./database.service.js";
import type { ApiRequest } from "./http.js";
import {
  appendAudit, appendOutboxEvent, beginIdempotentOperation, completeIdempotentOperation
} from "./operations.js";

interface PurchaseLineInput {
  itemId: string;
  quantity: string;
  unitCost: string;
}

@Injectable()
export class PurchasesService {
  private readonly taxCalculator = new PeruvianTaxCalculator();
  constructor(private readonly database: DatabaseService) {}

  private async supplierSnapshot(client: PoolClient, request: ApiRequest, supplierId: string) {
    const result = await client.query<{ id: string; name: string; document_type: string; document_number: string }>(
      `select p.id,coalesce(p.legal_name,concat_ws(' ',p.first_name,p.last_name),p.commercial_name) name,
       p.document_type,p.document_number from parties p
       join party_roles pr on pr.party_id=p.id and pr.role_code='SUPPLIER' and pr.status='active'
       where p.id=$1 and p.tenant_id=$2 and p.company_id=$3 and p.status='active'`,
      [supplierId, request.auth!.tenantId, request.auth!.companyId]
    );
    const supplier = result.rows[0];
    if (!supplier) throw new NotFoundException("El proveedor no existe o está inactivo.");
    return {
      id: supplier.id, name: supplier.name,
      documentType: supplier.document_type, documentNumber: supplier.document_number
    };
  }

  list(request: ApiRequest, limit: number) {
    return this.database.query(
      `select p.id,p.purchase_number as "number",p.purchase_date as "purchaseDate",p.issue_date as "issueDate",
       p.status,p.payment_condition as "paymentCondition",p.currency,p.total::text,p.paid_amount::text as "paidAmount",
       pa.legal_name as "supplierName"
       from purchases p join parties pa on pa.id=p.supplier_party_id
       where p.tenant_id=$1 and p.company_id=$2 order by p.purchase_date desc,p.id desc limit $3`,
      [request.auth!.tenantId, request.auth!.companyId, limit]
    );
  }

  async create(request: ApiRequest, input: {
    supplierPartyId: string; warehouseId?: string | undefined; issueDate: string; dueDate?: string | undefined;
    currency: string; paymentCondition: "CASH" | "CREDIT"; lines: PurchaseLineInput[];
    supplierDocument?: {
      documentType: string; series: string; number: string; amount: string; overrideReason?: string | undefined;
    } | undefined;
  }) {
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const supplier = await this.supplierSnapshot(client, request, input.supplierPartyId);
      const itemIds = [...new Set(input.lines.map((line) => line.itemId))];
      const items = await client.query<{
        id: string; code: string; name: string; unit: string | null; manages_stock: boolean;
        tax_category: TaxCategory; tax_rate: string | null; status: string;
      }>(
        `select i.id,i.code,i.name,u.code unit,i.manages_stock,i.status,tp.tax_category,tr.rate::text tax_rate
         from items i join tax_profiles tp on tp.id=i.tax_profile_id
         left join units_of_measure u on u.id=i.unit_id
         left join lateral(
           select rate from tax_rates where tax_profile_id=tp.id and effective_from<=$2::date
             and (effective_until is null or effective_until>=$2::date)
           order by effective_from desc limit 1
         ) tr on true where i.id=any($1::uuid[]) and i.tenant_id=$3 and i.company_id=$4`,
        [itemIds, input.issueDate, request.auth!.tenantId, request.auth!.companyId]
      );
      if (items.rows.length !== itemIds.length || items.rows.some((item) => item.status !== "active")) {
        throw new ConflictException("Uno o más productos no existen o están inactivos.");
      }
      const itemMap = new Map(items.rows.map((item) => [item.id, item]));
      const tax = this.taxCalculator.calculate(input.lines.map((line) => {
        const item = itemMap.get(line.itemId)!;
        return {
          quantity: line.quantity, unitPrice: line.unitCost, discountRate: "0",
          taxRate: item.tax_rate ?? "0", taxCategory: item.tax_category
        };
      }));
      if (input.supplierDocument) {
        const duplicate = await client.query<{ id: string }>(
          `select id from supplier_documents where company_id=$1 and supplier_party_id=$2 and document_type=$3
           and upper(series)=upper($4) and upper(number)=upper($5) limit 1`,
          [
            request.auth!.companyId, input.supplierPartyId, input.supplierDocument.documentType,
            input.supplierDocument.series, input.supplierDocument.number
          ]
        );
        if (duplicate.rows[0] && !input.supplierDocument.overrideReason) {
          throw new ConflictException(`Documento proveedor duplicado: ${duplicate.rows[0].id}.`);
        }
        if (duplicate.rows[0] && !request.auth!.permissions.has("supplier-document.duplicate-override")) {
          throw new ConflictException("No tiene permiso para autorizar un posible duplicado.");
        }
      }
      const id = randomUUID();
      await client.query(
        `insert into purchases(id,tenant_id,company_id,branch_id,warehouse_id,supplier_party_id,
          purchase_date,issue_date,due_date,currency,payment_condition,supplier_snapshot,subtotal,
          taxable_amount,exempt_amount,unaffected_amount,igv_amount,total,status,created_by)
         values($1,$2,$3,$4,$5,$6,current_date,$7,$8,$9,$10,$11::jsonb,$12,$13,$14,$15,$16,$17,'DRAFT',$18)`,
        [
          id, request.auth!.tenantId, request.auth!.companyId, request.auth!.branchIds[0] ?? null,
          input.warehouseId ?? null, input.supplierPartyId, input.issueDate, input.dueDate ?? null,
          input.currency.toUpperCase(), input.paymentCondition, JSON.stringify(supplier), tax.subtotal,
          tax.taxableAmount, tax.exemptAmount, tax.unaffectedAmount, tax.igv, tax.total, request.auth!.userId
        ]
      );
      for (const [index, line] of input.lines.entries()) {
        const item = itemMap.get(line.itemId)!;
        const calculated = tax.lines[index]!;
        await client.query(
          `insert into purchase_lines(tenant_id,company_id,purchase_id,line_number,item_id,item_code_snapshot,
            description_snapshot,unit_snapshot,quantity,unit_cost,tax_category,tax_rate,tax_amount,total,stock_managed)
           values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
          [
            request.auth!.tenantId, request.auth!.companyId, id, index + 1, item.id, item.code,
            item.name, item.unit ?? "ZZ", line.quantity, line.unitCost, item.tax_category,
            item.tax_rate ?? "0", calculated.taxAmount, calculated.total, item.manages_stock
          ]
        );
      }
      if (input.supplierDocument) {
        await client.query(
          `insert into supplier_documents(tenant_id,company_id,supplier_party_id,purchase_id,document_type,
            series,number,issue_date,amount,currency,duplicate_override_token,duplicate_override_reason,
            duplicate_override_by,created_by)
           values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
          [
            request.auth!.tenantId, request.auth!.companyId, input.supplierPartyId, id,
            input.supplierDocument.documentType, input.supplierDocument.series.trim().toUpperCase(),
            input.supplierDocument.number.trim().toUpperCase(), input.issueDate,
            input.supplierDocument.amount, input.currency.toUpperCase(),
            input.supplierDocument.overrideReason ? randomUUID() : "",
            input.supplierDocument.overrideReason ?? null,
            input.supplierDocument.overrideReason ? request.auth!.userId : null, request.auth!.userId
          ]
        );
      }
      await appendAudit(client, request, {
        action: "purchase.created", entityType: "purchase", entityId: id,
        newValues: { supplier, totals: tax, duplicateOverride: input.supplierDocument?.overrideReason }
      });
      return { id, status: "DRAFT", total: tax.total };
    });
  }

  async confirm(request: ApiRequest, id: string, key: string) {
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const idempotency = await beginIdempotentOperation(client, request, "ConfirmPurchase", key, { id });
      if (idempotency.replay) return idempotency.replay;
      const result = await client.query<{
        status: PurchaseStatus; warehouse_id: string | null; payment_condition: string;
        supplier_party_id: string; total: string; currency: string; due_date: string | null;
      }>(
        `select status,warehouse_id,payment_condition,supplier_party_id,total::text,currency,due_date::text
         from purchases where id=$1 and tenant_id=$2 and company_id=$3 for update`,
        [id, request.auth!.tenantId, request.auth!.companyId]
      );
      const purchase = result.rows[0];
      if (!purchase) throw new NotFoundException("La compra no existe.");
      const status = confirmPurchase(purchase.status);
      const lines = await client.query<{ item_id: string; quantity: string; unit_cost: string; stock_managed: boolean }>(
        "select item_id,quantity::text,unit_cost::text,stock_managed from purchase_lines where purchase_id=$1 order by item_id",
        [id]
      );
      if (lines.rows.some((line) => line.stock_managed) && !purchase.warehouse_id) {
        throw new ConflictException("La compra contiene productos con stock y requiere almacén.");
      }
      if (lines.rows.some((line) => line.stock_managed)) {
        const movementId = randomUUID();
        await client.query(
          `insert into stock_movements(id,tenant_id,company_id,branch_id,warehouse_id,movement_type,
            source_entity_type,source_entity_id,reason,idempotency_key,created_by)
           values($1,$2,$3,$4,$5,'PURCHASE_RECEIPT','purchase',$6,'Confirmación de compra',$7,$8)`,
          [
            movementId, request.auth!.tenantId, request.auth!.companyId, request.auth!.branchIds[0] ?? null,
            purchase.warehouse_id, id, `purchase:${id}`, request.auth!.userId
          ]
        );
        for (const line of lines.rows.filter((candidate) => candidate.stock_managed)) {
          await client.query(
            `insert into stock_movement_lines(tenant_id,company_id,stock_movement_id,item_id,quantity,
              signed_quantity,unit_cost) values($1,$2,$3,$4,$5,$5,$6)`,
            [request.auth!.tenantId, request.auth!.companyId, movementId, line.item_id, line.quantity, line.unit_cost]
          );
          await client.query(
            `insert into stock_balances(tenant_id,company_id,warehouse_id,item_id,quantity)
             values($1,$2,$3,$4,$5)
             on conflict(warehouse_id,item_id) do update set quantity=stock_balances.quantity+excluded.quantity,
              updated_at=now(),version=stock_balances.version+1`,
            [request.auth!.tenantId, request.auth!.companyId, purchase.warehouse_id, line.item_id, line.quantity]
          );
        }
        await appendOutboxEvent(client, request, {
          aggregateType: "StockMovement", aggregateId: movementId,
          eventType: "StockReceived", payload: { movementId, purchaseId: id }
        });
      }
      let payableId: string | null = null;
      if (purchase.payment_condition === "CREDIT") {
        payableId = randomUUID();
        await client.query(
          `insert into accounts_payable(id,tenant_id,company_id,supplier_party_id,purchase_id,currency,
            principal,applied_amount,outstanding_amount,due_date,status,created_by)
           values($1,$2,$3,$4,$5,$6,$7,0,$7,$8,'OPEN',$9)`,
          [
            payableId, request.auth!.tenantId, request.auth!.companyId, purchase.supplier_party_id,
            id, purchase.currency, purchase.total, purchase.due_date, request.auth!.userId
          ]
        );
        await appendOutboxEvent(client, request, {
          aggregateType: "AccountPayable", aggregateId: payableId,
          eventType: "PayableCreated", payload: { payableId, purchaseId: id }
        });
      }
      await client.query(
        `update purchases set status=$2,confirmed_at=now(),updated_by=$3,updated_at=now(),
          version=version+1 where id=$1`,
        [id, status, request.auth!.userId]
      );
      const response = { id, status, payableId };
      await appendAudit(client, request, {
        action: "purchase.confirmed", entityType: "purchase", entityId: id, newValues: response
      });
      await appendOutboxEvent(client, request, {
        aggregateType: "Purchase", aggregateId: id, eventType: "PurchaseConfirmed", payload: response
      });
      await completeIdempotentOperation(client, idempotency.id, response);
      return response;
    });
  }

  listExpenses(request: ApiRequest, limit: number) {
    return this.database.query(
      `select e.id,e.description,e.expense_date as "expenseDate",e.currency,e.total::text,e.status,
       ec.name as category,coalesce(p.legal_name,concat_ws(' ',p.first_name,p.last_name),'Sin identificar') as "supplierName"
       from expenses e join expense_categories ec on ec.id=e.category_id
       left join parties p on p.id=e.supplier_party_id
       where e.tenant_id=$1 and e.company_id=$2 order by e.expense_date desc,e.id desc limit $3`,
      [request.auth!.tenantId, request.auth!.companyId, limit]
    );
  }

  categories(request: ApiRequest) {
    return this.database.query(
      `select id,code,name from expense_categories where tenant_id=$1 and company_id=$2 and status='active' order by name`,
      [request.auth!.tenantId, request.auth!.companyId]
    );
  }

  async createExpense(request: ApiRequest, input: {
    supplierPartyId?: string | undefined; categoryId: string; description: string; expenseDate: string;
    currency: string; amount: string; taxAmount: string; paymentCondition: "CASH" | "CREDIT";
    dueDate?: string | undefined; paymentMethod?: string | undefined; costCenterId?: string | undefined;
  }) {
    const total = formatDecimal(parseDecimal(input.amount, 2) + parseDecimal(input.taxAmount, 2), 2);
    const id = randomUUID();
    return this.database.scopedTransaction(request.auth!, async (client) => {
      await client.query(
        `insert into expenses(id,tenant_id,company_id,branch_id,cost_center_id,supplier_party_id,category_id,
          description,expense_date,currency,amount,tax_amount,total,payment_condition,due_date,payment_method,
          status,created_by)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'DRAFT',$17)`,
        [
          id, request.auth!.tenantId, request.auth!.companyId, request.auth!.branchIds[0] ?? null,
          input.costCenterId ?? null, input.supplierPartyId ?? null, input.categoryId, input.description.trim(),
          input.expenseDate, input.currency.toUpperCase(), input.amount, input.taxAmount, total,
          input.paymentCondition, input.dueDate ?? null, input.paymentMethod ?? null, request.auth!.userId
        ]
      );
      await appendAudit(client, request, {
        action: "expense.created", entityType: "expense", entityId: id, newValues: { ...input, total }
      });
      return { id, status: "DRAFT", total };
    });
  }

  async registerExpense(request: ApiRequest, id: string, key: string) {
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const idempotency = await beginIdempotentOperation(client, request, "RegisterExpense", key, { id });
      if (idempotency.replay) return idempotency.replay;
      const result = await client.query<{
        status: string; payment_condition: string; supplier_party_id: string | null;
        currency: string; total: string; due_date: string | null;
      }>(
        `select status,payment_condition,supplier_party_id,currency,total::text,due_date::text
         from expenses where id=$1 and tenant_id=$2 and company_id=$3 for update`,
        [id, request.auth!.tenantId, request.auth!.companyId]
      );
      const expense = result.rows[0];
      if (!expense) throw new NotFoundException("El gasto no existe.");
      if (expense.status !== "DRAFT") throw new ConflictException("Sólo un gasto en borrador puede registrarse.");
      let payableId: string | null = null;
      if (expense.payment_condition === "CREDIT") {
        payableId = randomUUID();
        await client.query(
          `insert into accounts_payable(id,tenant_id,company_id,supplier_party_id,expense_id,currency,
            principal,applied_amount,outstanding_amount,due_date,status,created_by)
           values($1,$2,$3,$4,$5,$6,$7,0,$7,$8,'OPEN',$9)`,
          [
            payableId, request.auth!.tenantId, request.auth!.companyId, expense.supplier_party_id,
            id, expense.currency, expense.total, expense.due_date, request.auth!.userId
          ]
        );
      }
      await client.query(
        `update expenses set status='REGISTERED',registered_at=now(),updated_by=$2,updated_at=now(),
         version=version+1 where id=$1`,
        [id, request.auth!.userId]
      );
      const response = { id, status: "REGISTERED", payableId };
      await appendAudit(client, request, {
        action: "expense.registered", entityType: "expense", entityId: id, newValues: response
      });
      await appendOutboxEvent(client, request, {
        aggregateType: "Expense", aggregateId: id, eventType: "ExpenseRegistered", payload: response
      });
      await completeIdempotentOperation(client, idempotency.id, response);
      return response;
    });
  }

  async cancelPurchase(request: ApiRequest, id: string, reason: string, key: string) {
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const idempotency = await beginIdempotentOperation(client, request, "CancelPurchase", key, { id, reason });
      if (idempotency.replay) return idempotency.replay;
      const result = await client.query<{ status: string; warehouse_id: string | null }>(
        `select status,warehouse_id from purchases
         where id=$1 and tenant_id=$2 and company_id=$3 for update`,
        [id, request.auth!.tenantId, request.auth!.companyId]
      );
      const purchase = result.rows[0];
      if (!purchase || !["DRAFT", "CONFIRMED"].includes(purchase.status)) {
        throw new ConflictException("La compra no admite cancelación en su estado actual.");
      }
      const payable = await client.query<{ id: string; applied_amount: string }>(
        "select id,applied_amount::text from accounts_payable where purchase_id=$1 for update",
        [id]
      );
      if (Number(payable.rows[0]?.applied_amount ?? "0") !== 0) {
        throw new ConflictException("Revierta primero los pagos aplicados.");
      }
      if (purchase.status === "CONFIRMED" && purchase.warehouse_id) {
        const lines = await client.query<{ item_id: string; quantity: string; unit_cost: string }>(
          `select item_id,quantity::text,unit_cost::text from purchase_lines
           where purchase_id=$1 and stock_managed order by item_id`,
          [id]
        );
        if (lines.rows.length) {
          const balances = await client.query<{ item_id: string; quantity: string }>(
            `select item_id,quantity::text from stock_balances
             where warehouse_id=$1 and item_id=any($2::uuid[]) order by item_id for update`,
            [purchase.warehouse_id, lines.rows.map((line) => line.item_id)]
          );
          const byItem = new Map(balances.rows.map((balance) => [balance.item_id, balance.quantity]));
          if (lines.rows.some((line) => Number(byItem.get(line.item_id) ?? "0") < Number(line.quantity))) {
            throw new ConflictException("No hay stock suficiente para devolver la compra.");
          }
          const movementId = randomUUID();
          await client.query(
            `insert into stock_movements(id,tenant_id,company_id,branch_id,warehouse_id,movement_type,
              source_entity_type,source_entity_id,reason,idempotency_key,created_by)
             values($1,$2,$3,$4,$5,'SUPPLIER_RETURN','purchase-cancellation',$6,$7,$8,$9)`,
            [
              movementId, request.auth!.tenantId, request.auth!.companyId,
              request.auth!.branchIds[0] ?? null, purchase.warehouse_id, id, reason.trim(),
              `purchase-cancel:${id}`, request.auth!.userId
            ]
          );
          for (const line of lines.rows) {
            await client.query(
              `insert into stock_movement_lines(tenant_id,company_id,stock_movement_id,item_id,quantity,
                signed_quantity,unit_cost) values($1,$2,$3,$4,$5,-$5,$6)`,
              [request.auth!.tenantId, request.auth!.companyId, movementId, line.item_id, line.quantity, line.unit_cost]
            );
            await client.query(
              `update stock_balances set quantity=quantity-$3,updated_at=now(),version=version+1
               where warehouse_id=$1 and item_id=$2`,
              [purchase.warehouse_id, line.item_id, line.quantity]
            );
          }
        }
      }
      await client.query(
        "update accounts_payable set status='CANCELLED',outstanding_amount=0,updated_by=$2,updated_at=now(),version=version+1 where purchase_id=$1",
        [id, request.auth!.userId]
      );
      await client.query(
        `update purchases set status='CANCELLED',cancelled_at=now(),updated_by=$2,updated_at=now(),version=version+1
         where id=$1`,
        [id, request.auth!.userId]
      );
      const response = { id, status: "CANCELLED" };
      await appendAudit(client, request, {
        action: "purchase.cancelled", entityType: "purchase", entityId: id,
        previousValues: purchase, newValues: { ...response, reason }
      });
      await appendOutboxEvent(client, request, {
        aggregateType: "Purchase", aggregateId: id, eventType: "PurchaseCancelled", payload: { ...response, reason }
      });
      await completeIdempotentOperation(client, idempotency.id, response);
      return response;
    });
  }

  async cancelExpense(request: ApiRequest, id: string, reason: string, key: string) {
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const idempotency = await beginIdempotentOperation(client, request, "CancelExpense", key, { id, reason });
      if (idempotency.replay) return idempotency.replay;
      const result = await client.query<{ status: string }>(
        `select status from expenses where id=$1 and tenant_id=$2 and company_id=$3 for update`,
        [id, request.auth!.tenantId, request.auth!.companyId]
      );
      const expense = result.rows[0];
      if (!expense || !["DRAFT", "REGISTERED"].includes(expense.status)) {
        throw new ConflictException("El gasto no admite cancelación en su estado actual.");
      }
      const payable = await client.query<{ applied_amount: string }>(
        "select applied_amount::text from accounts_payable where expense_id=$1 for update",
        [id]
      );
      if (Number(payable.rows[0]?.applied_amount ?? "0") !== 0) {
        throw new ConflictException("Revierta primero los pagos aplicados.");
      }
      await client.query(
        "update accounts_payable set status='CANCELLED',outstanding_amount=0,updated_by=$2,updated_at=now(),version=version+1 where expense_id=$1",
        [id, request.auth!.userId]
      );
      await client.query(
        `update expenses set status='CANCELLED',cancelled_at=now(),updated_by=$2,updated_at=now(),version=version+1
         where id=$1`,
        [id, request.auth!.userId]
      );
      const response = { id, status: "CANCELLED" };
      await appendAudit(client, request, {
        action: "expense.cancelled", entityType: "expense", entityId: id,
        previousValues: expense, newValues: { ...response, reason }
      });
      await appendOutboxEvent(client, request, {
        aggregateType: "Expense", aggregateId: id, eventType: "ExpenseCancelled", payload: { ...response, reason }
      });
      await completeIdempotentOperation(client, idempotency.id, response);
      return response;
    });
  }
}
