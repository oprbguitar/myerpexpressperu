import { Body, Controller, Get, Param, Post, Query, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { RequirePermissions } from "./auth.guard.js";
import type { ApiRequest } from "./http.js";
import { ImportsService } from "./imports.service.js";
import { requireIdempotencyKey } from "./operations.js";

const importType = z.enum(["CUSTOMERS", "SUPPLIERS", "PRODUCTS", "SERVICES", "OPENING_STOCK", "PRICE_LISTS"]);

@ApiTags("imports-exports")
@Controller()
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}
  @Get("imports/template")
  @RequirePermissions("imports.read")
  template(@Query("type") type: unknown) {
    const parsed = importType.parse(type);
    return { type: parsed, filename: `${parsed.toLowerCase()}-template.csv`, csv: this.imports.template(parsed) };
  }
  @Post("imports/preview")
  @RequirePermissions("imports.read")
  preview(@Req() request: ApiRequest, @Body() body: unknown) {
    const input = z.object({ type: importType, csv: z.string().min(1).max(5_500_000) }).parse(body);
    return this.imports.preview(request, input.type, input.csv);
  }
  @Post("imports/:id/execute")
  @RequirePermissions("imports.execute")
  execute(@Req() request: ApiRequest, @Param("id") id: string) {
    return this.imports.execute(request, z.uuid().parse(id), requireIdempotencyKey(request));
  }
  @Get("exports")
  @RequirePermissions("exports.execute")
  export(@Req() request: ApiRequest, @Query() query: unknown) {
    const input = z.object({
      type: z.enum(["customers", "suppliers", "products", "sales", "purchases", "receivables", "payables", "inventory", "cash"]),
      limit: z.coerce.number().int().min(1).max(10_000).default(1_000)
    }).parse(query);
    return this.imports.export(request, input.type, input.limit);
  }
}
