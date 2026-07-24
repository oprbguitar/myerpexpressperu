/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { QuotationStatus } from "@erp/domain";
import { RequirePermissions } from "./auth.guard.js";
import type { ApiRequest } from "./http.js";
import { requireIdempotencyKey } from "./operations.js";
import { SalesService } from "./sales.service.js";
import { OwnedByModule } from "./module-ownership.js";

const decimal = z.string().regex(/^\d{1,16}(?:\.\d{1,6})?$/);
const rate = z.string().regex(/^0(?:\.\d{1,6})?$|^1(?:\.0{1,6})?$/);
const lineSchema = z.object({
  itemId: z.uuid(), quantity: decimal, discountRate: rate.default("0"),
  manualUnitPrice: decimal.optional()
});

@ApiTags("sales")
@OwnedByModule("sales")
@Controller()
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get("quotations")
  @RequirePermissions("quotations.read")
  quotations(@Req() request: ApiRequest, @Query() query: unknown) {
    const input = z.object({
      status: z.nativeEnum(QuotationStatus).optional(),
      limit: z.coerce.number().int().min(1).max(100).default(25)
    }).parse(query);
    return this.sales.listQuotations(request, input);
  }
  @Post("quotations")
  @RequirePermissions("quotations.create")
  createQuotation(@Req() request: ApiRequest, @Body() body: unknown) {
    const input = z.object({
      customerPartyId: z.uuid(), validUntil: z.iso.date(), currency: z.string().length(3),
      paymentTermId: z.uuid().optional(), notes: z.string().max(2000).optional(),
      lines: z.array(lineSchema).min(1).max(100)
    }).parse(body);
    return this.sales.createQuotation(request, input);
  }
  @Post("quotations/:id/status")
  @RequirePermissions("quotations.update")
  transition(@Req() request: ApiRequest, @Param("id") id: string, @Body() body: unknown) {
    const input = z.object({
      status: z.nativeEnum(QuotationStatus), comment: z.string().max(1000).optional()
    }).parse(body);
    return this.sales.transitionQuotation(request, z.uuid().parse(id), input.status, input.comment);
  }
  @Post("quotations/:id/convert")
  @RequirePermissions("sales-orders.create")
  convert(@Req() request: ApiRequest, @Param("id") id: string) {
    return this.sales.convertQuotation(request, z.uuid().parse(id));
  }
  @Get("sales-orders")
  @RequirePermissions("sales-orders.read")
  orders(@Req() request: ApiRequest, @Query("limit") limit: unknown) {
    return this.sales.listOrders(request, z.coerce.number().int().min(1).max(100).default(25).parse(limit));
  }
  @Post("sales-orders/:id/confirm")
  @RequirePermissions("sales-orders.confirm")
  confirmOrder(@Req() request: ApiRequest, @Param("id") id: string) {
    return this.sales.confirmOrder(request, z.uuid().parse(id), requireIdempotencyKey(request));
  }
  @Get("sales")
  @RequirePermissions("sales.read")
  listSales(@Req() request: ApiRequest, @Query("limit") limit: unknown) {
    return this.sales.listSales(request, z.coerce.number().int().min(1).max(100).default(25).parse(limit));
  }
  @Post("sales")
  @RequirePermissions("sales.create")
  createSale(@Req() request: ApiRequest, @Body() body: unknown) {
    const input = z.object({
      customerPartyId: z.uuid(), warehouseId: z.uuid().optional(),
      paymentCondition: z.enum(["CASH", "CREDIT"]), dueDate: z.iso.date().optional(),
      currency: z.string().length(3), lines: z.array(lineSchema).min(1).max(100)
    }).superRefine((value, context) => {
      if (value.paymentCondition === "CREDIT" && !value.dueDate) {
        context.addIssue({ code: "custom", path: ["dueDate"], message: "La venta a crédito requiere vencimiento." });
      }
    }).parse(body);
    return this.sales.createDirectSale(request, input);
  }
  @Post("sales/:id/confirm")
  @RequirePermissions("sales.confirm")
  confirmSale(@Req() request: ApiRequest, @Param("id") id: string) {
    return this.sales.confirmSale(request, z.uuid().parse(id), requireIdempotencyKey(request));
  }
  @Post("sales/:id/cancel")
  @RequirePermissions("sales.cancel")
  cancelSale(@Req() request: ApiRequest, @Param("id") id: string, @Body() body: unknown) {
    const input = z.object({ reason: z.string().min(10).max(1000) }).parse(body);
    return this.sales.cancelSale(request, z.uuid().parse(id), input.reason, requireIdempotencyKey(request));
  }
  @Post("sales/:id/commercial-documents")
  @RequirePermissions("commercial-documents.issue")
  issue(@Req() request: ApiRequest, @Param("id") id: string, @Body() body: unknown) {
    const input = z.object({
      documentType: z.enum(["INVOICE", "SALES_RECEIPT", "INTERNAL_SALE"])
    }).parse(body);
    return this.sales.issueDocument(
      request, z.uuid().parse(id), input.documentType, requireIdempotencyKey(request)
    );
  }
}
