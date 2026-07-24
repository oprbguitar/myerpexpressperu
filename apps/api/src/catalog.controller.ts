/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { Body, Controller, Get, Param, Patch, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { ItemType } from "@erp/domain";
import { RequirePermissions } from "./auth.guard.js";
import { CatalogService } from "./catalog.service.js";
import type { ApiRequest } from "./http.js";

const decimal = z.string().regex(/^\d{1,16}(?:\.\d{1,6})?$/);
const itemSchema = z.object({
  code: z.string().min(1).max(60), name: z.string().min(2).max(200),
  description: z.string().max(2000).optional(), itemType: z.nativeEnum(ItemType),
  categoryId: z.uuid().optional(), unitId: z.uuid().optional(), taxProfileId: z.uuid(),
  purchasePrice: decimal, salePrice: decimal, currency: z.string().length(3),
  managesStock: z.boolean(), minimumStock: decimal, barcode: z.string().max(80).optional()
});

@ApiTags("catalog")
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get("items")
  @RequirePermissions("products.read")
  list(@Req() request: ApiRequest, @Query() query: unknown) {
    const input = z.object({
      search: z.string().max(120).optional(), type: z.nativeEnum(ItemType).optional(),
      cursor: z.uuid().optional(), limit: z.coerce.number().int().min(1).max(100).default(25)
    }).parse(query);
    return this.catalog.listItems(request, input);
  }
  @Post("items")
  @RequirePermissions("products.create")
  create(@Req() request: ApiRequest, @Body() body: unknown) {
    return this.catalog.createItem(request, itemSchema.parse(body));
  }
  @Patch("items/:id")
  @RequirePermissions("products.update")
  update(@Req() request: ApiRequest, @Param("id") id: string, @Body() body: unknown) {
    return this.catalog.updateItem(request, z.uuid().parse(id), itemSchema.extend({
      version: z.number().int().positive()
    }).parse(body));
  }
  @Post("items/:id/deactivate")
  @RequirePermissions("products.deactivate")
  deactivate(@Req() request: ApiRequest, @Param("id") id: string) {
    return this.catalog.deactivateItem(request, z.uuid().parse(id));
  }
  @Get("item-categories")
  @RequirePermissions("products.read")
  catalogs(@Req() request: ApiRequest) { return this.catalog.catalogs(request); }
  @Get("units")
  @RequirePermissions("products.read")
  units(@Req() request: ApiRequest) { return this.catalog.catalogs(request).then((result) => result.units); }
  @Get("price-lists")
  @RequirePermissions("pricing.read")
  priceLists(@Req() request: ApiRequest) { return this.catalog.listPriceLists(request); }
  @Post("price-lists")
  @RequirePermissions("pricing.manage")
  createPriceList(@Req() request: ApiRequest, @Body() body: unknown) {
    const input = z.object({
      code: z.string().min(2).max(60), name: z.string().min(2).max(160), currency: z.string().length(3),
      validFrom: z.iso.date(), validUntil: z.iso.date().optional(), isDefault: z.boolean().default(false),
      items: z.array(z.object({
        itemId: z.uuid(), minimumQuantity: decimal, unitPrice: decimal,
        maximumDiscountRate: z.string().regex(/^0(?:\.\d{1,6})?$|^1(?:\.0{1,6})?$/)
      })).min(1).max(500)
    }).parse(body);
    return this.catalog.createPriceList(request, input);
  }
  @Post("price-lists/resolve")
  @RequirePermissions("pricing.read")
  resolve(@Req() request: ApiRequest, @Body() body: unknown) {
    const input = z.object({
      itemId: z.uuid(), customerPartyId: z.uuid().optional(), quantity: decimal,
      at: z.iso.date(), manualPrice: decimal.optional()
    }).parse(body);
    return this.catalog.resolvePrice(request, input);
  }
}
