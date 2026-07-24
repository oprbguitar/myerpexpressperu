/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { Body, Controller, Get, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { StockMovementType } from "@erp/domain";
import { RequirePermissions } from "./auth.guard.js";
import type { ApiRequest } from "./http.js";
import { InventoryService } from "./inventory.service.js";
import { requireIdempotencyKey } from "./operations.js";
import { OwnedByModule } from "./module-ownership.js";

const decimal = z.string().regex(/^\d{1,16}(?:\.\d{1,6})?$/);
const line = z.object({ itemId: z.uuid(), quantity: decimal, unitCost: decimal.optional() });

@ApiTags("inventory")
@OwnedByModule("inventory-basic")
@Controller()
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}
  @Get("warehouses")
  @RequirePermissions("warehouses.read")
  warehouses(@Req() request: ApiRequest) { return this.inventory.warehouses(request); }
  @Get("inventory")
  @RequirePermissions("inventory.read")
  balances(@Req() request: ApiRequest, @Query("warehouseId") warehouseId: unknown) {
    return this.inventory.balances(request, z.uuid().optional().parse(warehouseId));
  }
  @Get("inventory/movements")
  @RequirePermissions("inventory.read")
  movements(@Req() request: ApiRequest, @Query() query: unknown) {
    return this.inventory.movements(request, z.object({
      warehouseId: z.uuid().optional(), itemId: z.uuid().optional(),
      limit: z.coerce.number().int().min(1).max(100).default(50)
    }).parse(query));
  }
  @Post("inventory/movements")
  @RequirePermissions("inventory.receive")
  movement(@Req() request: ApiRequest, @Body() body: unknown) {
    const input = z.object({
      warehouseId: z.uuid(), movementType: z.nativeEnum(StockMovementType),
      lines: z.array(line).min(1).max(200), reason: z.string().max(1000).optional(),
      movementDate: z.iso.datetime().optional()
    }).parse(body);
    return this.inventory.createMovement(request, input, requireIdempotencyKey(request));
  }
  @Post("inventory/transfers")
  @RequirePermissions("inventory.transfer")
  transfer(@Req() request: ApiRequest, @Body() body: unknown) {
    const input = z.object({
      sourceWarehouseId: z.uuid(), targetWarehouseId: z.uuid(),
      lines: z.array(line).min(1).max(200), reason: z.string().min(5).max(1000)
    }).parse(body);
    return this.inventory.transfer(request, input, requireIdempotencyKey(request));
  }
  @Post("inventory/adjustments")
  @RequirePermissions("inventory.adjust")
  adjustment(@Req() request: ApiRequest, @Body() body: unknown) {
    const input = z.object({
      warehouseId: z.uuid(),
      movementType: z.enum([StockMovementType.POSITIVE_ADJUSTMENT, StockMovementType.NEGATIVE_ADJUSTMENT]),
      lines: z.array(line).min(1).max(200), reason: z.string().min(5).max(1000),
      movementDate: z.iso.datetime().optional()
    }).parse(body);
    return this.inventory.createMovement(request, input, requireIdempotencyKey(request));
  }
}
