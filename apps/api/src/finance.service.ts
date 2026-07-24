/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { ConflictException, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  PaymentDirection,
  PaymentMethod,
  applyBalance,
  closeCashSession,
  formatDecimal,
  parseDecimal
} from "@erp/domain";
import { DatabaseService } from "./database.service.js";
import type { ApiRequest } from "./http.js";
import {
  appendAudit, appendOutboxEvent, beginIdempotentOperation, completeIdempotentOperation
} from "./operations.js";

@Injectable()
export class FinanceService {
  constructor(private readonly database: DatabaseService) {}

  receivables(request: ApiRequest, input: { status?: string | undefined; limit: number }) {
    return this.database.query(
      `select ar.id,ar.sale_id as "saleId",ar.currency,ar.principal::text,
       ar.applied_amount::text as "appliedAmount",ar.outstanding_amount::text as "outstandingAmount",
       ar.due_date as "dueDate",
       case when ar.status in ('OPEN','PARTIALLY_PAID') and ar.due_date<current_date then 'OVERDUE' else ar.status end status,
       coalesce(p.legal_name,concat_ws(' ',p.first_name,p.last_name),p.commercial_name) as "customerName"
       from accounts_receivable ar join parties p on p.id=ar.customer_party_id
       where ar.tenant_id=$1 and ar.company_id=$2
         and ($3::text is null or (case when ar.status in ('OPEN','PARTIALLY_PAID') and ar.due_date<current_date then 'OVERDUE' else ar.status end)=$3)
       order by ar.due_date,ar.id limit $4`,
      [request.auth!.tenantId, request.auth!.companyId, input.status ?? null, input.limit]
    );
  }

  payables(request: ApiRequest, input: { status?: string | undefined; limit: number }) {
    return this.database.query(
      `select ap.id,ap.purchase_id as "purchaseId",ap.expense_id as "expenseId",ap.currency,ap.principal::text,
       ap.applied_amount::text as "appliedAmount",ap.outstanding_amount::text as "outstandingAmount",
       ap.due_date as "dueDate",
       case when ap.status in ('OPEN','PARTIALLY_PAID') and ap.due_date<current_date then 'OVERDUE' else ap.status end status,
       coalesce(p.legal_name,concat_ws(' ',p.first_name,p.last_name),p.commercial_name,'Sin identificar') as "supplierName"
       from accounts_payable ap left join parties p on p.id=ap.supplier_party_id
       where ap.tenant_id=$1 and ap.company_id=$2
         and ($3::text is null or (case when ap.status in ('OPEN','PARTIALLY_PAID') and ap.due_date<current_date then 'OVERDUE' else ap.status end)=$3)
       order by ap.due_date,ap.id limit $4`,
      [request.auth!.tenantId, request.auth!.companyId, input.status ?? null, input.limit]
    );
  }

  payments(request: ApiRequest, limit: number) {
    return this.database.query(
      `select py.id,py.direction,py.payment_method as "paymentMethod",py.currency,py.amount::text,
       py.payment_date as "paymentDate",py.reference,py.status,
       coalesce(p.legal_name,concat_ws(' ',p.first_name,p.last_name),p.commercial_name) as "partyName"
       from payments py left join parties p on p.id=py.party_id
       where py.tenant_id=$1 and py.company_id=$2 order by py.payment_date desc,py.id desc limit $3`,
      [request.auth!.tenantId, request.auth!.companyId, limit]
    );
  }

  async registerPayment(request: ApiRequest, input: {
    direction: PaymentDirection; paymentMethod: PaymentMethod; currency: string; amount: string;
    receivableId?: string | undefined; payableId?: string | undefined; cashAccountId?: string | undefined;
    cashSessionId?: string | undefined; reference?: string | undefined; notes?: string | undefined;
  }, key: string) {
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const idempotency = await beginIdempotentOperation(client, request, "RegisterPayment", key, input);
      if (idempotency.replay) return idempotency.replay;
      if ((input.receivableId ? 1 : 0) + (input.payableId ? 1 : 0) > 1) {
        throw new ConflictException("Un pago no puede aplicarse simultáneamente a cobrar y pagar.");
      }
      if (input.receivableId && input.direction !== PaymentDirection.INBOUND) {
        throw new ConflictException("Un cobro de cliente debe ser entrante.");
      }
      if (input.payableId && input.direction !== PaymentDirection.OUTBOUND) {
        throw new ConflictException("Un pago a proveedor debe ser saliente.");
      }
      if (input.paymentMethod === PaymentMethod.CASH) {
        if (!input.cashAccountId || !input.cashSessionId) {
          throw new ConflictException("Un movimiento en efectivo requiere cuenta y sesión de caja.");
        }
        const session = await client.query<{ status: string; cash_account_id: string }>(
          `select status,cash_account_id from cash_sessions
           where id=$1 and company_id=$2 and user_id=$3 for update`,
          [input.cashSessionId, request.auth!.companyId, request.auth!.userId]
        );
        if (session.rows[0]?.status !== "OPEN" || session.rows[0].cash_account_id !== input.cashAccountId) {
          throw new ConflictException("La sesión de caja no está abierta para esta cuenta y usuario.");
        }
      }
      let partyId: string | null = null;
      let applicationStatus: string | null = null;
      if (input.receivableId) {
        const result = await client.query<{
          principal: string; applied_amount: string; customer_party_id: string; status: string; sale_id: string;
        }>(
          `select principal::text,applied_amount::text,customer_party_id,status,sale_id
           from accounts_receivable where id=$1 and tenant_id=$2 and company_id=$3 for update`,
          [input.receivableId, request.auth!.tenantId, request.auth!.companyId]
        );
        const receivable = result.rows[0];
        if (!receivable || !["OPEN", "PARTIALLY_PAID", "OVERDUE"].includes(receivable.status)) {
          throw new ConflictException("La cuenta por cobrar no admite pagos.");
        }
        const next = applyBalance(receivable.principal, receivable.applied_amount, input.amount);
        await client.query(
          `update accounts_receivable set applied_amount=$2,outstanding_amount=$3,status=$4,
            updated_by=$5,updated_at=now(),version=version+1 where id=$1`,
          [input.receivableId, next.applied, next.outstanding, next.status, request.auth!.userId]
        );
        await client.query(
          `update sales set paid_amount=$2,status=$3,updated_by=$4,updated_at=now(),version=version+1 where id=$1`,
          [receivable.sale_id, next.applied, next.status === "PAID" ? "PAID" : "PARTIALLY_PAID", request.auth!.userId]
        );
        partyId = receivable.customer_party_id;
        applicationStatus = next.status;
      }
      if (input.payableId) {
        const result = await client.query<{
          principal: string; applied_amount: string; supplier_party_id: string | null; status: string;
          purchase_id: string | null; expense_id: string | null;
        }>(
          `select principal::text,applied_amount::text,supplier_party_id,status,purchase_id,expense_id
           from accounts_payable where id=$1 and tenant_id=$2 and company_id=$3 for update`,
          [input.payableId, request.auth!.tenantId, request.auth!.companyId]
        );
        const payable = result.rows[0];
        if (!payable || !["OPEN", "PARTIALLY_PAID", "OVERDUE"].includes(payable.status)) {
          throw new ConflictException("La cuenta por pagar no admite pagos.");
        }
        const next = applyBalance(payable.principal, payable.applied_amount, input.amount);
        await client.query(
          `update accounts_payable set applied_amount=$2,outstanding_amount=$3,status=$4,
            updated_by=$5,updated_at=now(),version=version+1 where id=$1`,
          [input.payableId, next.applied, next.outstanding, next.status, request.auth!.userId]
        );
        if (payable.purchase_id) {
          await client.query(
            `update purchases set paid_amount=$2,status=$3,updated_by=$4,updated_at=now(),version=version+1 where id=$1`,
            [payable.purchase_id, next.applied, next.status === "PAID" ? "PAID" : "PARTIALLY_PAID", request.auth!.userId]
          );
        }
        if (payable.expense_id) {
          await client.query(
            `update expenses set status=$2,updated_by=$3,updated_at=now(),version=version+1 where id=$1`,
            [payable.expense_id, next.status === "PAID" ? "PAID" : "PARTIALLY_PAID", request.auth!.userId]
          );
        }
        partyId = payable.supplier_party_id;
        applicationStatus = next.status;
      }
      const paymentId = randomUUID();
      await client.query(
        `insert into payments(id,tenant_id,company_id,branch_id,direction,payment_method,currency,amount,
          party_id,cash_account_id,cash_session_id,reference,notes,idempotency_key,created_by)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          paymentId, request.auth!.tenantId, request.auth!.companyId, request.auth!.branchIds[0] ?? null,
          input.direction, input.paymentMethod, input.currency.toUpperCase(), input.amount, partyId,
          input.cashAccountId ?? null, input.cashSessionId ?? null, input.reference?.trim() || null,
          input.notes?.trim() || null, key, request.auth!.userId
        ]
      );
      if (input.receivableId || input.payableId) {
        await client.query(
          `insert into payment_applications(tenant_id,company_id,payment_id,receivable_id,payable_id,amount,created_by)
           values($1,$2,$3,$4,$5,$6,$7)`,
          [
            request.auth!.tenantId, request.auth!.companyId, paymentId,
            input.receivableId ?? null, input.payableId ?? null, input.amount, request.auth!.userId
          ]
        );
      }
      if (input.cashAccountId) {
        const signedAmount = input.direction === PaymentDirection.INBOUND ? input.amount : `-${input.amount}`;
        await client.query(
          `insert into cash_movements(tenant_id,company_id,cash_account_id,cash_session_id,payment_id,
            movement_type,signed_amount,currency,source_entity_type,source_entity_id,description,created_by)
           values($1,$2,$3,$4,$5,$6,$7,$8,'payment',$5,$9,$10)`,
          [
            request.auth!.tenantId, request.auth!.companyId, input.cashAccountId,
            input.cashSessionId ?? null, paymentId,
            input.direction === PaymentDirection.INBOUND ? "INCOME" : "EXPENSE",
            signedAmount, input.currency.toUpperCase(), input.notes?.trim() || "Pago registrado",
            request.auth!.userId
          ]
        );
      }
      const response = { id: paymentId, status: "POSTED", applicationStatus };
      await appendAudit(client, request, {
        action: "payment.registered", entityType: "payment", entityId: paymentId,
        newValues: { ...input, applicationStatus }
      });
      await appendOutboxEvent(client, request, {
        aggregateType: "Payment", aggregateId: paymentId, eventType: "PaymentRegistered", payload: response
      });
      await completeIdempotentOperation(client, idempotency.id, response);
      return response;
    });
  }

  async reversePayment(request: ApiRequest, id: string, reason: string, key: string) {
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const idempotency = await beginIdempotentOperation(client, request, "ReversePayment", key, { id, reason });
      if (idempotency.replay) return idempotency.replay;
      const result = await client.query<{
        direction: PaymentDirection; payment_method: PaymentMethod; currency: string; amount: string;
        party_id: string | null; cash_account_id: string | null; cash_session_id: string | null; status: string;
      }>(
        `select direction,payment_method,currency,amount::text,party_id,cash_account_id,cash_session_id,status
         from payments where id=$1 and tenant_id=$2 and company_id=$3 for update`,
        [id, request.auth!.tenantId, request.auth!.companyId]
      );
      const payment = result.rows[0];
      if (!payment || payment.status !== "POSTED") throw new ConflictException("El pago no admite reversión.");
      const applications = await client.query<{
        id: string; receivable_id: string | null; payable_id: string | null; amount: string;
        sale_id: string | null; purchase_id: string | null; expense_id: string | null;
      }>(
        `select pa.id,pa.receivable_id,pa.payable_id,pa.amount::text,
          ar.sale_id,ap.purchase_id,ap.expense_id
         from payment_applications pa
         left join accounts_receivable ar on ar.id=pa.receivable_id
         left join accounts_payable ap on ap.id=pa.payable_id
         where pa.payment_id=$1 and not pa.is_reversal order by pa.id for update`,
        [id]
      );
      for (const application of applications.rows) {
        if (application.receivable_id) {
          await client.query(
            `update accounts_receivable set applied_amount=applied_amount-$2,
              outstanding_amount=outstanding_amount+$2,
              status=case when applied_amount-$2=0 then 'OPEN' else 'PARTIALLY_PAID' end,
              updated_by=$3,updated_at=now(),version=version+1 where id=$1`,
            [application.receivable_id, application.amount, request.auth!.userId]
          );
          if (application.sale_id) {
            await client.query(
              `update sales set paid_amount=greatest(0,paid_amount-$2),
                status=case when paid_amount-$2<=0 then 'CONFIRMED' else 'PARTIALLY_PAID' end,
                updated_by=$3,updated_at=now(),version=version+1 where id=$1`,
              [application.sale_id, application.amount, request.auth!.userId]
            );
          }
        }
        if (application.payable_id) {
          await client.query(
            `update accounts_payable set applied_amount=applied_amount-$2,
              outstanding_amount=outstanding_amount+$2,
              status=case when applied_amount-$2=0 then 'OPEN' else 'PARTIALLY_PAID' end,
              updated_by=$3,updated_at=now(),version=version+1 where id=$1`,
            [application.payable_id, application.amount, request.auth!.userId]
          );
          if (application.purchase_id) {
            await client.query(
              `update purchases set paid_amount=greatest(0,paid_amount-$2),
                status=case when paid_amount-$2<=0 then 'CONFIRMED' else 'PARTIALLY_PAID' end,
                updated_by=$3,updated_at=now(),version=version+1 where id=$1`,
              [application.purchase_id, application.amount, request.auth!.userId]
            );
          }
          if (application.expense_id) {
            await client.query(
              `update expenses set status=case
                when (select applied_amount from accounts_payable where id=$2)<=0 then 'REGISTERED'
                else 'PARTIALLY_PAID' end,
                updated_by=$3,updated_at=now(),version=version+1 where id=$1`,
              [application.expense_id, application.payable_id, request.auth!.userId]
            );
          }
        }
      }
      const reversalId = randomUUID();
      await client.query(
        `insert into payments(id,tenant_id,company_id,branch_id,direction,payment_method,currency,amount,
          party_id,cash_account_id,cash_session_id,status,reversed_payment_id,reversal_reason,idempotency_key,created_by)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'POSTED',$12,$13,$14,$15)`,
        [
          reversalId, request.auth!.tenantId, request.auth!.companyId, request.auth!.branchIds[0] ?? null,
          payment.direction === PaymentDirection.INBOUND ? PaymentDirection.OUTBOUND : PaymentDirection.INBOUND,
          payment.payment_method, payment.currency, payment.amount, payment.party_id, payment.cash_account_id,
          payment.cash_session_id, id, reason.trim(), key, request.auth!.userId
        ]
      );
      for (const application of applications.rows) {
        await client.query(
          `insert into payment_applications(tenant_id,company_id,payment_id,receivable_id,payable_id,
            amount,is_reversal,reverses_application_id,created_by)
           values($1,$2,$3,$4,$5,$6,true,$7,$8)`,
          [
            request.auth!.tenantId, request.auth!.companyId, reversalId,
            application.receivable_id, application.payable_id, application.amount,
            application.id, request.auth!.userId
          ]
        );
      }
      await client.query("update payments set status='REVERSED' where id=$1", [id]);
      if (payment.cash_account_id) {
        const originalSigned = payment.direction === PaymentDirection.INBOUND
          ? parseDecimal(payment.amount, 2) : -parseDecimal(payment.amount, 2);
        await client.query(
          `insert into cash_movements(tenant_id,company_id,cash_account_id,cash_session_id,payment_id,
            movement_type,signed_amount,currency,source_entity_type,source_entity_id,description,created_by)
           values($1,$2,$3,$4,$5,'REVERSAL',$6,$7,'payment-reversal',$5,$8,$9)`,
          [
            request.auth!.tenantId, request.auth!.companyId, payment.cash_account_id,
            payment.cash_session_id, reversalId, formatDecimal(-originalSigned, 2), payment.currency,
            `Reversión: ${reason.trim()}`, request.auth!.userId
          ]
        );
      }
      const response = { id: reversalId, reversedPaymentId: id, status: "POSTED" };
      await appendAudit(client, request, {
        action: "payment.reversed", entityType: "payment", entityId: id,
        previousValues: payment, newValues: response
      });
      await appendOutboxEvent(client, request, {
        aggregateType: "Payment", aggregateId: id, eventType: "PaymentReversed", payload: response
      });
      await completeIdempotentOperation(client, idempotency.id, response);
      return response;
    });
  }

  cashAccounts(request: ApiRequest) {
    return this.database.query(
      `select ca.id,ca.code,ca.name,ca.currency,ca.account_type as "accountType",ca.status,
       coalesce(sum(cm.signed_amount),0)::text as balance
       from cash_accounts ca left join cash_movements cm on cm.cash_account_id=ca.id
       where ca.tenant_id=$1 and ca.company_id=$2 group by ca.id order by ca.name`,
      [request.auth!.tenantId, request.auth!.companyId]
    );
  }

  cashSessions(request: ApiRequest, status?: string) {
    return this.database.query(
      `select cs.id,cs.cash_account_id as "cashAccountId",ca.name as "cashAccount",cs.opened_at as "openedAt",
       cs.opening_balance::text as "openingBalance",cs.closed_at as "closedAt",
       cs.expected_balance::text as "expectedBalance",cs.counted_balance::text as "countedBalance",
       cs.difference::text,cs.difference_reason as "differenceReason",cs.status,
       coalesce(sum(cm.signed_amount),0)::text as "movementTotal"
       from cash_sessions cs join cash_accounts ca on ca.id=cs.cash_account_id
       left join cash_movements cm on cm.cash_session_id=cs.id
       where cs.tenant_id=$1 and cs.company_id=$2 and ($3::text is null or cs.status=$3)
       group by cs.id,ca.name order by cs.opened_at desc limit 100`,
      [request.auth!.tenantId, request.auth!.companyId, status ?? null]
    );
  }

  async openCashSession(request: ApiRequest, input: {
    cashAccountId: string; openingBalance: string;
  }, key: string) {
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const idempotency = await beginIdempotentOperation(client, request, "OpenCashSession", key, input);
      if (idempotency.replay) return idempotency.replay;
      const id = randomUUID();
      try {
        await client.query(
          `insert into cash_sessions(id,tenant_id,company_id,branch_id,cash_account_id,user_id,
            opening_balance,created_by)
           values($1,$2,$3,$4,$5,$6,$7,$6)`,
          [
            id, request.auth!.tenantId, request.auth!.companyId, request.auth!.branchIds[0] ?? null,
            input.cashAccountId, request.auth!.userId, input.openingBalance
          ]
        );
      } catch (error) {
        if (String(error).includes("cash_sessions_one_open")) {
          throw new ConflictException("Ya existe una sesión abierta para este usuario y cuenta.");
        }
        throw error;
      }
      if (parseDecimal(input.openingBalance, 2) !== 0n) {
        await client.query(
          `insert into cash_movements(tenant_id,company_id,cash_account_id,cash_session_id,movement_type,
            signed_amount,currency,source_entity_type,source_entity_id,description,created_by)
           select $1,$2,id,$3,'OPENING',$4,currency,'cash-session',$3,'Saldo inicial',$5
           from cash_accounts where id=$6 and company_id=$2`,
          [
            request.auth!.tenantId, request.auth!.companyId, id, input.openingBalance,
            request.auth!.userId, input.cashAccountId
          ]
        );
      }
      const response = { id, status: "OPEN", openingBalance: input.openingBalance };
      await appendAudit(client, request, {
        action: "cash-session.opened", entityType: "cash-session", entityId: id, newValues: response
      });
      await appendOutboxEvent(client, request, {
        aggregateType: "CashSession", aggregateId: id, eventType: "CashSessionOpened", payload: response
      });
      await completeIdempotentOperation(client, idempotency.id, response);
      return response;
    });
  }

  async closeCashSession(request: ApiRequest, id: string, input: {
    countedBalance: string; differenceReason?: string | undefined;
  }, key: string) {
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const idempotency = await beginIdempotentOperation(client, request, "CloseCashSession", key, { id, ...input });
      if (idempotency.replay) return idempotency.replay;
      const result = await client.query<{ opening_balance: string; status: string }>(
        `select opening_balance::text,status from cash_sessions
         where id=$1 and tenant_id=$2 and company_id=$3 and user_id=$4 for update`,
        [id, request.auth!.tenantId, request.auth!.companyId, request.auth!.userId]
      );
      const session = result.rows[0];
      if (!session || session.status !== "OPEN") throw new ConflictException("La sesión no está abierta.");
      const movementResult = await client.query<{ total: string }>(
        `select coalesce(sum(signed_amount),0)::text total from cash_movements
         where cash_session_id=$1 and movement_type<>'OPENING'`,
        [id]
      );
      const closure = closeCashSession({
        openingBalance: session.opening_balance, movementTotal: movementResult.rows[0]?.total ?? "0",
        countedBalance: input.countedBalance, differenceReason: input.differenceReason
      });
      await client.query(
        `update cash_sessions set status='CLOSED',closed_at=now(),expected_balance=$2,counted_balance=$3,
          difference=$4,difference_reason=$5,updated_by=$6,updated_at=now(),version=version+1 where id=$1`,
        [
          id, closure.expectedBalance, input.countedBalance, closure.difference,
          input.differenceReason?.trim() || null, request.auth!.userId
        ]
      );
      const response = { id, status: "CLOSED", ...closure, countedBalance: input.countedBalance };
      await appendAudit(client, request, {
        action: "cash-session.closed", entityType: "cash-session", entityId: id, newValues: response
      });
      await appendOutboxEvent(client, request, {
        aggregateType: "CashSession", aggregateId: id, eventType: "CashSessionClosed", payload: response
      });
      await completeIdempotentOperation(client, idempotency.id, response);
      return response;
    });
  }
}
