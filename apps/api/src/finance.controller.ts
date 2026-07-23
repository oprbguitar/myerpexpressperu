import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { PaymentDirection, PaymentMethod } from "@erp/domain";
import { RequirePermissions } from "./auth.guard.js";
import type { ApiRequest } from "./http.js";
import { FinanceService } from "./finance.service.js";
import { requireIdempotencyKey } from "./operations.js";

const amount = z.string().regex(/^\d{1,16}(?:\.\d{1,2})?$/);

@ApiTags("finance")
@Controller()
export class FinanceController {
  constructor(private readonly finance: FinanceService) {}
  @Get("receivables")
  @RequirePermissions("receivables.read")
  receivables(@Req() request: ApiRequest, @Query() query: unknown) {
    return this.finance.receivables(request, z.object({
      status: z.enum(["OPEN", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"]).optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50)
    }).parse(query));
  }
  @Get("payables")
  @RequirePermissions("payables.read")
  payables(@Req() request: ApiRequest, @Query() query: unknown) {
    return this.finance.payables(request, z.object({
      status: z.enum(["OPEN", "PARTIALLY_PAID", "PAID", "OVERDUE", "CANCELLED"]).optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50)
    }).parse(query));
  }
  @Get("payments")
  @RequirePermissions("payments.read")
  payments(@Req() request: ApiRequest, @Query("limit") limit: unknown) {
    return this.finance.payments(request, z.coerce.number().int().min(1).max(100).default(50).parse(limit));
  }
  @Post("payments")
  @RequirePermissions("payments.create")
  register(@Req() request: ApiRequest, @Body() body: unknown) {
    const input = z.object({
      direction: z.nativeEnum(PaymentDirection), paymentMethod: z.nativeEnum(PaymentMethod),
      currency: z.string().length(3), amount, receivableId: z.uuid().optional(), payableId: z.uuid().optional(),
      cashAccountId: z.uuid().optional(), cashSessionId: z.uuid().optional(),
      reference: z.string().max(120).optional(), notes: z.string().max(1000).optional()
    }).parse(body);
    return this.finance.registerPayment(request, input, requireIdempotencyKey(request));
  }
  @Post("payments/:id/reverse")
  @RequirePermissions("payments.reverse")
  reverse(@Req() request: ApiRequest, @Param("id") id: string, @Body() body: unknown) {
    const input = z.object({ reason: z.string().min(10).max(1000) }).parse(body);
    return this.finance.reversePayment(request, z.uuid().parse(id), input.reason, requireIdempotencyKey(request));
  }
  @Get("cash-accounts")
  @RequirePermissions("cash.read")
  cashAccounts(@Req() request: ApiRequest) { return this.finance.cashAccounts(request); }
  @Get("cash-sessions")
  @RequirePermissions("cash.read")
  cashSessions(@Req() request: ApiRequest, @Query("status") status: unknown) {
    return this.finance.cashSessions(request, z.enum(["OPEN", "CLOSED", "CANCELLED"]).optional().parse(status));
  }
  @Post("cash-sessions")
  @RequirePermissions("cash.open")
  open(@Req() request: ApiRequest, @Body() body: unknown) {
    const input = z.object({ cashAccountId: z.uuid(), openingBalance: amount }).parse(body);
    return this.finance.openCashSession(request, input, requireIdempotencyKey(request));
  }
  @Post("cash-sessions/:id/close")
  @RequirePermissions("cash.close")
  close(@Req() request: ApiRequest, @Param("id") id: string, @Body() body: unknown) {
    const input = z.object({
      countedBalance: amount, differenceReason: z.string().min(5).max(1000).optional()
    }).parse(body);
    return this.finance.closeCashSession(request, z.uuid().parse(id), input, requireIdempotencyKey(request));
  }
}
