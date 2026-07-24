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
import { RequirePermissions } from "./auth.guard.js";
import type { ApiRequest } from "./http.js";
import { requireIdempotencyKey } from "./operations.js";
import { PurchasesService } from "./purchases.service.js";
import { OwnedByModule } from "./module-ownership.js";

const decimal = z.string().regex(/^\d{1,16}(?:\.\d{1,6})?$/);

@ApiTags("purchases")
@OwnedByModule("purchases")
@Controller()
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}
  @Get("purchases")
  @RequirePermissions("purchases.read")
  list(@Req() request: ApiRequest, @Query("limit") limit: unknown) {
    return this.purchases.list(request, z.coerce.number().int().min(1).max(100).default(25).parse(limit));
  }
  @Post("purchases")
  @RequirePermissions("purchases.create")
  create(@Req() request: ApiRequest, @Body() body: unknown) {
    const input = z.object({
      supplierPartyId: z.uuid(), warehouseId: z.uuid().optional(), issueDate: z.iso.date(),
      dueDate: z.iso.date().optional(), currency: z.string().length(3),
      paymentCondition: z.enum(["CASH", "CREDIT"]),
      lines: z.array(z.object({ itemId: z.uuid(), quantity: decimal, unitCost: decimal })).min(1).max(100),
      supplierDocument: z.object({
        documentType: z.string().min(1).max(30), series: z.string().min(1).max(20),
        number: z.string().min(1).max(30), amount: decimal, overrideReason: z.string().min(10).max(1000).optional()
      }).optional()
    }).superRefine((value, context) => {
      if (value.paymentCondition === "CREDIT" && !value.dueDate) {
        context.addIssue({ code: "custom", path: ["dueDate"], message: "La compra a crédito requiere vencimiento." });
      }
    }).parse(body);
    return this.purchases.create(request, input);
  }
  @Post("purchases/:id/confirm")
  @RequirePermissions("purchases.confirm")
  confirm(@Req() request: ApiRequest, @Param("id") id: string) {
    return this.purchases.confirm(request, z.uuid().parse(id), requireIdempotencyKey(request));
  }
  @Post("purchases/:id/cancel")
  @RequirePermissions("purchases.cancel")
  cancel(@Req() request: ApiRequest, @Param("id") id: string, @Body() body: unknown) {
    const input = z.object({ reason: z.string().min(10).max(1000) }).parse(body);
    return this.purchases.cancelPurchase(request, z.uuid().parse(id), input.reason, requireIdempotencyKey(request));
  }
  @Get("expenses")
  @RequirePermissions("expenses.read")
  expenses(@Req() request: ApiRequest, @Query("limit") limit: unknown) {
    return this.purchases.listExpenses(request, z.coerce.number().int().min(1).max(100).default(25).parse(limit));
  }
  @Get("expense-categories")
  @RequirePermissions("expenses.read")
  categories(@Req() request: ApiRequest) { return this.purchases.categories(request); }
  @Post("expenses")
  @RequirePermissions("expenses.create")
  createExpense(@Req() request: ApiRequest, @Body() body: unknown) {
    const input = z.object({
      supplierPartyId: z.uuid().optional(), categoryId: z.uuid(), description: z.string().min(2).max(1000),
      expenseDate: z.iso.date(), currency: z.string().length(3), amount: decimal, taxAmount: decimal,
      paymentCondition: z.enum(["CASH", "CREDIT"]), dueDate: z.iso.date().optional(),
      paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "CARD", "DIGITAL_WALLET", "CHECK", "OTHER"]).optional(),
      costCenterId: z.uuid().optional()
    }).superRefine((value, context) => {
      if (value.paymentCondition === "CREDIT" && !value.dueDate) {
        context.addIssue({ code: "custom", path: ["dueDate"], message: "El gasto a crédito requiere vencimiento." });
      }
    }).parse(body);
    return this.purchases.createExpense(request, input);
  }
  @Post("expenses/:id/register")
  @RequirePermissions("expenses.register")
  registerExpense(@Req() request: ApiRequest, @Param("id") id: string) {
    return this.purchases.registerExpense(request, z.uuid().parse(id), requireIdempotencyKey(request));
  }
  @Post("expenses/:id/cancel")
  @RequirePermissions("expenses.cancel")
  cancelExpense(@Req() request: ApiRequest, @Param("id") id: string, @Body() body: unknown) {
    const input = z.object({ reason: z.string().min(10).max(1000) }).parse(body);
    return this.purchases.cancelExpense(request, z.uuid().parse(id), input.reason, requireIdempotencyKey(request));
  }
}
