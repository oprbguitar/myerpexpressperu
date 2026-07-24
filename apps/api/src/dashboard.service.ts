/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { Injectable } from "@nestjs/common";
import { DatabaseService } from "./database.service.js";
import type { ApiRequest } from "./http.js";

@Injectable()
export class DashboardService {
  constructor(private readonly database: DatabaseService) {}
  async get(request: ApiRequest) {
    const scope = [request.auth!.tenantId, request.auth!.companyId];
    const [
      sales,
      receivables,
      payables,
      cash,
      sessions,
      topItems,
      lowStock,
      documents,
      recentSales,
      recentExpenses
    ] = await Promise.all([
      this.database.query<{
        current: string; previous: string; comparison_percent: string | null;
      }>(
        `with periods as (
          select
            coalesce(sum(total) filter(where sale_date>=date_trunc('month',current_date)
              and sale_date<date_trunc('month',current_date)+interval '1 month'
              and status<>'CANCELLED'),0) current,
            coalesce(sum(total) filter(where sale_date>=date_trunc('month',current_date)-interval '1 month'
              and sale_date<date_trunc('month',current_date) and status<>'CANCELLED'),0) previous
          from sales where tenant_id=$1 and company_id=$2
        ) select current::text,previous::text,
          case when previous=0 then null else round(((current-previous)/previous)*100,2)::text end comparison_percent
        from periods`,
        scope
      ),
      this.database.query<{ outstanding: string; overdue: string }>(
        `select coalesce(sum(outstanding_amount) filter(where status in ('OPEN','PARTIALLY_PAID','OVERDUE')),0)::text outstanding,
         coalesce(sum(outstanding_amount) filter(where status in ('OPEN','PARTIALLY_PAID','OVERDUE') and due_date<current_date),0)::text overdue
         from accounts_receivable where tenant_id=$1 and company_id=$2`,
        scope
      ),
      this.database.query<{ outstanding: string; upcoming: string }>(
        `select coalesce(sum(outstanding_amount) filter(where status in ('OPEN','PARTIALLY_PAID','OVERDUE')),0)::text outstanding,
         coalesce(sum(outstanding_amount) filter(where status in ('OPEN','PARTIALLY_PAID') and due_date between current_date and current_date+7),0)::text upcoming
         from accounts_payable where tenant_id=$1 and company_id=$2`,
        scope
      ),
      this.database.query<{ balance: string }>(
        `select coalesce(sum(signed_amount),0)::text balance from cash_movements where tenant_id=$1 and company_id=$2`,
        scope
      ),
      this.database.query<{ open: number }>(
        `select count(*)::int open from cash_sessions where tenant_id=$1 and company_id=$2 and status='OPEN'`,
        scope
      ),
      this.database.query(
        `select sl.item_id as "itemId",sl.description_snapshot as name,
         sum(sl.quantity)::text quantity,sum(sl.total)::text total
         from sale_lines sl join sales s on s.id=sl.sale_id
         where sl.tenant_id=$1 and sl.company_id=$2 and s.status<>'CANCELLED'
           and s.sale_date>=date_trunc('month',current_date)
         group by sl.item_id,sl.description_snapshot order by sum(sl.total) desc limit 5`,
        scope
      ),
      this.database.query(
        `select sb.item_id as "itemId",i.code,i.name,w.name as warehouse,
         sb.quantity::text,i.minimum_stock::text as "minimumStock"
         from stock_balances sb join items i on i.id=sb.item_id join warehouses w on w.id=sb.warehouse_id
         where sb.tenant_id=$1 and sb.company_id=$2 and sb.quantity<i.minimum_stock
         order by (i.minimum_stock-sb.quantity) desc limit 10`,
        scope
      ),
      this.database.query<{ pending: number; rejected: number }>(
        `select count(*) filter(where status in ('ISSUED','PENDING_SUBMISSION','FAILED'))::int pending,
         count(*) filter(where status='REJECTED')::int rejected
         from commercial_documents where tenant_id=$1 and company_id=$2`,
        scope
      ),
      this.database.query(
        `select s.id,s.sale_number as number,s.sale_date as date,s.total::text,s.status,
         coalesce(p.legal_name,concat_ws(' ',p.first_name,p.last_name),p.commercial_name) party
         from sales s join parties p on p.id=s.customer_party_id
         where s.tenant_id=$1 and s.company_id=$2 order by s.sale_date desc limit 5`,
        scope
      ),
      this.database.query(
        `select e.id,e.expense_date as date,e.description,e.total::text,e.status
         from expenses e where e.tenant_id=$1 and e.company_id=$2 order by e.expense_date desc,e.id desc limit 5`,
        scope
      )
    ]);
    return {
      lastUpdatedAt: new Date().toISOString(),
      demonstrationData: process.env.NODE_ENV !== "production",
      metrics: {
        salesThisMonth: sales[0]?.current ?? "0",
        salesPreviousMonth: sales[0]?.previous ?? "0",
        salesComparisonPercent: sales[0]?.comparison_percent ?? null,
        receivablesOutstanding: receivables[0]?.outstanding ?? "0",
        receivablesOverdue: receivables[0]?.overdue ?? "0",
        payablesOutstanding: payables[0]?.outstanding ?? "0",
        payablesUpcoming: payables[0]?.upcoming ?? "0",
        cashBalance: cash[0]?.balance ?? "0",
        openCashSessions: sessions[0]?.open ?? 0,
        pendingDocuments: documents[0]?.pending ?? 0,
        rejectedDocuments: documents[0]?.rejected ?? 0
      },
      topItems, lowStock, recentSales, recentExpenses
    };
  }
}

