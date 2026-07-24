/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { Injectable, NotFoundException } from "@nestjs/common";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { randomUUID } from "node:crypto";
import { DatabaseService } from "./database.service.js";
import type { ApiRequest } from "./http.js";
import { appendAudit } from "./operations.js";
import { StorageService } from "./storage.service.js";

export type PdfDocumentType =
  "quotation" | "sales-order" | "sale" | "purchase" |
  "customer-statement" | "supplier-statement" | "cash-closure";

interface CompanyInfo { legal_name: string; commercial_name: string | null; ruc: string; fiscal_address: string | null; }
interface Header {
  id: string; number: string | null; date: string; currency: string; subtotal: string; igv: string;
  total: string; status: string; party: string; payment_condition: string | null; notes: string | null;
}
interface Line { code: string; description: string; unit: string; quantity: string; unit_price: string; tax_amount: string; total: string; }

const money = (value: string, currency: string) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency }).format(Number(value));
const clean = (value: string) =>
  [...value].map((character) => character.charCodeAt(0) < 32 ? " " : character).join("").slice(0, 220);

@Injectable()
export class PdfService {
  constructor(
    private readonly database: DatabaseService,
    private readonly storage: StorageService
  ) {}

  private queries(type: PdfDocumentType): { header: string; lines?: string } {
    const definitions: Record<PdfDocumentType, { header: string; lines?: string }> = {
      quotation: {
        header: `select q.id,q.quotation_number number,q.issue_date::text date,q.currency,
          q.subtotal::text,q.igv_amount::text igv,q.total::text,q.status,
          coalesce(p.legal_name,concat_ws(' ',p.first_name,p.last_name),p.commercial_name) party,
          pt.name payment_condition,q.notes
          from quotations q join parties p on p.id=q.customer_party_id
          left join payment_terms pt on pt.id=q.payment_term_id
          where q.id=$1 and q.tenant_id=$2 and q.company_id=$3`,
        lines: `select item_code_snapshot code,description_snapshot description,unit_snapshot unit,
          quantity::text,unit_price::text,tax_amount::text,total::text
          from quotation_lines where quotation_id=$1 order by line_number`
      },
      "sales-order": {
        header: `select so.id,so.order_number number,so.order_date::text date,so.currency,
          so.subtotal::text,so.igv_amount::text igv,so.total::text,so.status,
          coalesce(p.legal_name,concat_ws(' ',p.first_name,p.last_name),p.commercial_name) party,
          null::text payment_condition,null::text notes
          from sales_orders so join parties p on p.id=so.customer_party_id
          where so.id=$1 and so.tenant_id=$2 and so.company_id=$3`,
        lines: `select item_code_snapshot code,description_snapshot description,unit_snapshot unit,
          quantity::text,unit_price::text,tax_amount::text,total::text
          from sales_order_lines where sales_order_id=$1 order by line_number`
      },
      sale: {
        header: `select s.id,s.sale_number number,s.sale_date::date::text date,s.currency,
          s.subtotal::text,s.igv_amount::text igv,s.total::text,s.status,
          coalesce(p.legal_name,concat_ws(' ',p.first_name,p.last_name),p.commercial_name) party,
          s.payment_condition,null::text notes
          from sales s join parties p on p.id=s.customer_party_id
          where s.id=$1 and s.tenant_id=$2 and s.company_id=$3`,
        lines: `select item_code_snapshot code,description_snapshot description,unit_snapshot unit,
          quantity::text,unit_price::text,tax_amount::text,total::text
          from sale_lines where sale_id=$1 order by line_number`
      },
      purchase: {
        header: `select p.id,p.purchase_number number,p.issue_date::text date,p.currency,
          p.subtotal::text,p.igv_amount::text igv,p.total::text,p.status,
          coalesce(pa.legal_name,concat_ws(' ',pa.first_name,pa.last_name),pa.commercial_name) party,
          p.payment_condition,null::text notes
          from purchases p join parties pa on pa.id=p.supplier_party_id
          where p.id=$1 and p.tenant_id=$2 and p.company_id=$3`,
        lines: `select item_code_snapshot code,description_snapshot description,unit_snapshot unit,
          quantity::text,unit_cost::text unit_price,tax_amount::text,total::text
          from purchase_lines where purchase_id=$1 order by line_number`
      },
      "customer-statement": {
        header: `select ar.id,('CC-'||left(ar.id::text,8)) number,current_date::text date,ar.currency,
          ar.applied_amount::text subtotal,0::text igv,ar.outstanding_amount::text total,ar.status,
          coalesce(p.legal_name,concat_ws(' ',p.first_name,p.last_name),p.commercial_name) party,
          ('Vence '||ar.due_date::text) payment_condition,'Estado de cuenta no fiscal' notes
          from accounts_receivable ar join parties p on p.id=ar.customer_party_id
          where ar.id=$1 and ar.tenant_id=$2 and ar.company_id=$3`
      },
      "supplier-statement": {
        header: `select ap.id,('CP-'||left(ap.id::text,8)) number,current_date::text date,ap.currency,
          ap.applied_amount::text subtotal,0::text igv,ap.outstanding_amount::text total,ap.status,
          coalesce(p.legal_name,concat_ws(' ',p.first_name,p.last_name),p.commercial_name,'Sin identificar') party,
          ('Vence '||ap.due_date::text) payment_condition,'Estado de cuenta no fiscal' notes
          from accounts_payable ap left join parties p on p.id=ap.supplier_party_id
          where ap.id=$1 and ap.tenant_id=$2 and ap.company_id=$3`
      },
      "cash-closure": {
        header: `select cs.id,('CAJA-'||left(cs.id::text,8)) number,coalesce(cs.closed_at,now())::date::text date,
          ca.currency,cs.opening_balance::text subtotal,coalesce(cs.difference,0)::text igv,
          coalesce(cs.counted_balance,cs.opening_balance)::text total,cs.status,
          ca.name party,('Esperado '||coalesce(cs.expected_balance,cs.opening_balance)::text) payment_condition,
          coalesce(cs.difference_reason,'Cierre de caja no fiscal') notes
          from cash_sessions cs join cash_accounts ca on ca.id=cs.cash_account_id
          where cs.id=$1 and cs.tenant_id=$2 and cs.company_id=$3`
      }
    };
    return definitions[type];
  }

  private drawHeader(page: PDFPage, font: PDFFont, bold: PDFFont, company: CompanyInfo, title: string, number: string) {
    page.drawRectangle({ x: 40, y: 770, width: 22, height: 8, color: rgb(0.02, 0.55, 0.38) });
    page.drawText(company.commercial_name || company.legal_name, { x: 70, y: 765, size: 16, font: bold, color: rgb(0.03, 0.18, 0.32) });
    page.drawText(company.legal_name, { x: 40, y: 742, size: 9, font });
    page.drawText(`RUC ${company.ruc}`, { x: 40, y: 728, size: 9, font });
    page.drawText(clean(company.fiscal_address || "Dirección no registrada"), { x: 40, y: 714, size: 8, font });
    page.drawRectangle({ x: 390, y: 714, width: 165, height: 66, borderColor: rgb(0.16, 0.32, 0.48), borderWidth: 1 });
    page.drawText(title, { x: 405, y: 752, size: 12, font: bold, color: rgb(0.03, 0.18, 0.32) });
    page.drawText(clean(number || "Pendiente"), { x: 405, y: 730, size: 11, font });
  }

  private async render(company: CompanyInfo, type: PdfDocumentType, header: Header, lines: readonly Line[]): Promise<Uint8Array> {
    const document = await PDFDocument.create();
    const font = await document.embedFont(StandardFonts.Helvetica);
    const bold = await document.embedFont(StandardFonts.HelveticaBold);
    const titles: Record<PdfDocumentType, string> = {
      quotation: "COTIZACIÓN", "sales-order": "PEDIDO DE VENTA", sale: "RESUMEN DE VENTA",
      purchase: "RESUMEN DE COMPRA", "customer-statement": "ESTADO DE CUENTA CLIENTE",
      "supplier-statement": "ESTADO DE CUENTA PROVEEDOR", "cash-closure": "CIERRE DE CAJA"
    };
    let page = document.addPage([595, 842]);
    this.drawHeader(page, font, bold, company, titles[type], header.number || "");
    page.drawText(`Fecha: ${header.date}`, { x: 40, y: 680, size: 9, font });
    page.drawText(`Tercero / cuenta: ${clean(header.party)}`, { x: 40, y: 662, size: 9, font: bold });
    page.drawText(`Estado: ${header.status}`, { x: 40, y: 644, size: 9, font });
    page.drawText(`Condición: ${clean(header.payment_condition || "No aplica")}`, { x: 300, y: 644, size: 9, font });
    let y = 610;
    if (lines.length) {
      page.drawRectangle({ x: 40, y, width: 515, height: 22, color: rgb(0.94, 0.96, 0.98) });
      page.drawText("Código / descripción", { x: 46, y: y + 7, size: 8, font: bold });
      page.drawText("Cant.", { x: 340, y: y + 7, size: 8, font: bold });
      page.drawText("P. unit.", { x: 400, y: y + 7, size: 8, font: bold });
      page.drawText("Total", { x: 500, y: y + 7, size: 8, font: bold });
      y -= 18;
      for (const line of lines) {
        if (y < 110) {
          page = document.addPage([595, 842]);
          this.drawHeader(page, font, bold, company, `${titles[type]} · continuación`, header.number || "");
          y = 690;
        }
        page.drawText(clean(`${line.code} · ${line.description}`).slice(0, 54), { x: 46, y, size: 8, font });
        page.drawText(line.quantity, { x: 340, y, size: 8, font });
        page.drawText(money(line.unit_price, header.currency), { x: 400, y, size: 8, font });
        page.drawText(money(line.total, header.currency), { x: 490, y, size: 8, font });
        y -= 19;
      }
    }
    y = Math.max(120, y - 24);
    page.drawText(`Subtotal: ${money(header.subtotal, header.currency)}`, { x: 390, y, size: 9, font });
    page.drawText(`Impuesto: ${money(header.igv, header.currency)}`, { x: 390, y: y - 18, size: 9, font });
    page.drawText(`Total: ${money(header.total, header.currency)}`, { x: 390, y: y - 39, size: 12, font: bold });
    if (header.notes) page.drawText(`Notas: ${clean(header.notes)}`, { x: 40, y: y - 62, size: 8, font });
    if (!["quotation", "sales-order"].includes(type)) {
      page.drawText("Documento interno / no fiscal, salvo comprobante electrónico emitido por separado.", { x: 40, y: 58, size: 8, font, color: rgb(0.42, 0.47, 0.55) });
    }
    const pages = document.getPages();
    pages.forEach((current, index) => {
      current.drawText(`Generado ${new Date().toLocaleString("es-PE")} · Página ${index + 1} de ${pages.length}`, {
        x: 350, y: 34, size: 7, font, color: rgb(0.42, 0.47, 0.55)
      });
    });
    return document.save();
  }

  async generate(request: ApiRequest, type: PdfDocumentType, entityId: string) {
    const auth = request.auth!;
    const [company] = await this.database.query<CompanyInfo>(
      `select legal_name,commercial_name,ruc,fiscal_address from companies
       where id=$1 and tenant_id=$2 and status='active'`,
      [auth.companyId, auth.tenantId]
    );
    if (!company) throw new NotFoundException("La empresa no existe.");
    const definition = this.queries(type);
    const [header] = await this.database.query<Header>(definition.header, [entityId, auth.tenantId, auth.companyId]);
    if (!header) throw new NotFoundException("El registro no existe en la empresa activa.");
    const lines = definition.lines ? await this.database.query<Line>(definition.lines, [entityId]) : [];
    const bytes = await this.render(company, type, header, lines);
    const documentId = randomUUID();
    const filename = `${type}-${(header.number || entityId.slice(0, 8)).replace(/[^a-zA-Z0-9-]/g, "-")}.pdf`;
    const key = `${auth.tenantId}/${auth.companyId}/${documentId}/${filename}`;
    const stored = await this.storage.put({ key, body: bytes, contentType: "application/pdf" });
    await this.database.scopedTransaction(auth, async (client) => {
      await client.query(
        `insert into documents(id,tenant_id,company_id,storage_key,original_filename,normalized_filename,
         mime_type,size_bytes,sha256,owner_entity_type,owner_entity_id,uploaded_by)
         values($1,$2,$3,$4,$5,$5,'application/pdf',$6,$7,$8,$9,$10)`,
        [documentId, auth.tenantId, auth.companyId, key, filename, stored.size, stored.sha256, type, entityId, auth.userId]
      );
      await appendAudit(client, request, {
        action: "pdf.generated", entityType: type, entityId,
        newValues: { documentId, filename, sha256: stored.sha256 }
      });
    });
    return {
      documentId, filename,
      url: await this.storage.createAuthorizedDownloadUrl(key, 60)
    };
  }
}
