import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { DefaultPriceResolver, ItemType, assertItemInvariant } from "@erp/domain";
import { DatabaseService } from "./database.service.js";
import type { ApiRequest } from "./http.js";
import { appendAudit, appendOutboxEvent } from "./operations.js";

export interface ItemInput {
  code: string;
  name: string;
  description?: string | undefined;
  itemType: ItemType;
  categoryId?: string | undefined;
  unitId?: string | undefined;
  taxProfileId: string;
  purchasePrice: string;
  salePrice: string;
  currency: string;
  managesStock: boolean;
  minimumStock: string;
  barcode?: string | undefined;
}

@Injectable()
export class CatalogService {
  constructor(private readonly database: DatabaseService) {}

  async listItems(request: ApiRequest, input: { search?: string | undefined; type?: ItemType | undefined; cursor?: string | undefined; limit: number }) {
    const values: unknown[] = [request.auth!.tenantId, request.auth!.companyId, input.limit + 1];
    const conditions = ["i.tenant_id=$1", "i.company_id=$2"];
    if (input.search) {
      values.push(`%${input.search.trim().toLocaleLowerCase("es-PE")}%`);
      conditions.push(`(lower(i.name) like $${values.length} or lower(i.code) like $${values.length})`);
    }
    if (input.type) {
      values.push(input.type);
      conditions.push(`i.item_type=$${values.length}`);
    }
    if (input.cursor) {
      values.push(input.cursor);
      conditions.push(`i.id > $${values.length}::uuid`);
    }
    const rows = await this.database.query<Record<string, unknown>>(
      `select i.id,i.code,i.name,i.description,i.item_type as "itemType",i.purchase_price::text as "purchasePrice",
       i.sale_price::text as "salePrice",i.currency,i.manages_stock as "managesStock",
       i.minimum_stock::text as "minimumStock",i.status,i.version,c.name as category,u.code as unit,
       tp.tax_category as "taxCategory",ib.barcode,coalesce(sum(sb.quantity),0)::text as stock
       from items i left join item_categories c on c.id=i.category_id left join units_of_measure u on u.id=i.unit_id
       join tax_profiles tp on tp.id=i.tax_profile_id
       left join item_barcodes ib on ib.item_id=i.id and ib.is_primary
       left join stock_balances sb on sb.item_id=i.id
       where ${conditions.join(" and ")}
       group by i.id,c.name,u.code,tp.tax_category,ib.barcode order by i.id limit $3`,
      values
    );
    const hasMore = rows.length > input.limit;
    const data = hasMore ? rows.slice(0, input.limit) : rows;
    return { data, meta: { limit: input.limit, nextCursor: hasMore ? String(data.at(-1)?.id) : null } };
  }

  catalogs(request: ApiRequest) {
    return Promise.all([
      this.database.query(
        `select id,code,name from item_categories where tenant_id=$1 and company_id=$2 and status='active' order by name`,
        [request.auth!.tenantId, request.auth!.companyId]
      ),
      this.database.query(
        `select id,code,name,sunat_code as "sunatCode",allows_decimals as "allowsDecimals"
         from units_of_measure where tenant_id=$1 and company_id=$2 and status='active' order by name`,
        [request.auth!.tenantId, request.auth!.companyId]
      ),
      this.database.query(
        `select tp.id,tp.code,tp.name,tp.tax_category as "taxCategory",
          tr.rate::text,tr.effective_from as "effectiveFrom",tr.effective_until as "effectiveUntil"
         from tax_profiles tp left join lateral(
           select rate,effective_from,effective_until from tax_rates
           where tax_profile_id=tp.id and effective_from<=current_date
             and (effective_until is null or effective_until>=current_date)
           order by effective_from desc limit 1
         ) tr on true where tp.tenant_id=$1 and tp.company_id=$2 and tp.status='active' order by tp.name`,
        [request.auth!.tenantId, request.auth!.companyId]
      )
    ]).then(([categories, units, taxProfiles]) => ({ categories, units, taxProfiles }));
  }

  async createItem(request: ApiRequest, input: ItemInput) {
    assertItemInvariant(input);
    const id = randomUUID();
    try {
      return await this.database.scopedTransaction(request.auth!, async (client) => {
        await client.query(
          `insert into items(id,tenant_id,company_id,code,name,description,item_type,category_id,unit_id,
            tax_profile_id,purchase_price,sale_price,currency,manages_stock,minimum_stock,created_by)
           values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
          [
            id, request.auth!.tenantId, request.auth!.companyId, input.code.trim().toUpperCase(),
            input.name.trim(), input.description?.trim() || null, input.itemType, input.categoryId ?? null,
            input.unitId ?? null, input.taxProfileId, input.purchasePrice, input.salePrice,
            input.currency.toUpperCase(), input.managesStock, input.minimumStock, request.auth!.userId
          ]
        );
        if (input.barcode?.trim()) {
          await client.query(
            `insert into item_barcodes(tenant_id,company_id,item_id,barcode,is_primary)
             values($1,$2,$3,$4,true)`,
            [request.auth!.tenantId, request.auth!.companyId, id, input.barcode.trim()]
          );
        }
        await appendAudit(client, request, {
          action: "item.created", entityType: "item", entityId: id, newValues: input
        });
        await appendOutboxEvent(client, request, {
          aggregateType: "Item", aggregateId: id, eventType: "ItemCreated", payload: { itemId: id, code: input.code }
        });
        return { id, ...input, code: input.code.toUpperCase(), status: "active", version: 1 };
      });
    } catch (error) {
      if (String(error).includes("items_company_id_code_key")) throw new ConflictException("El código del producto ya existe.");
      if (String(error).includes("item_barcodes_company_id_barcode_key")) throw new ConflictException("El código de barras ya existe.");
      throw error;
    }
  }

  async updateItem(request: ApiRequest, id: string, input: ItemInput & { version: number }) {
    assertItemInvariant(input);
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const before = await client.query<Record<string, unknown> & { sale_price: string }>("select * from items where id=$1 and tenant_id=$2 and company_id=$3 for update", [
        id, request.auth!.tenantId, request.auth!.companyId
      ]);
      if (!before.rows[0]) throw new NotFoundException("El producto o servicio no existe.");
      const updated = await client.query<{ id: string; version: number }>(
        `update items set code=$4,name=$5,description=$6,item_type=$7,category_id=$8,unit_id=$9,
          tax_profile_id=$10,purchase_price=$11,sale_price=$12,currency=$13,manages_stock=$14,
          minimum_stock=$15,updated_by=$16,updated_at=now(),version=version+1
         where id=$1 and tenant_id=$2 and company_id=$3 and version=$17 returning id,version`,
        [
          id, request.auth!.tenantId, request.auth!.companyId, input.code.trim().toUpperCase(),
          input.name.trim(), input.description?.trim() || null, input.itemType, input.categoryId ?? null,
          input.unitId ?? null, input.taxProfileId, input.purchasePrice, input.salePrice,
          input.currency.toUpperCase(), input.managesStock, input.minimumStock, request.auth!.userId, input.version
        ]
      );
      if (!updated.rows[0]) throw new ConflictException("El producto fue modificado por otro usuario.");
      await client.query("delete from item_barcodes where item_id=$1", [id]);
      if (input.barcode?.trim()) {
        await client.query(
          "insert into item_barcodes(tenant_id,company_id,item_id,barcode,is_primary) values($1,$2,$3,$4,true)",
          [request.auth!.tenantId, request.auth!.companyId, id, input.barcode.trim()]
        );
      }
      const priceChanged = before.rows[0].sale_price !== input.salePrice;
      await appendAudit(client, request, {
        action: priceChanged ? "item.price.updated" : "item.updated",
        entityType: "item", entityId: id, previousValues: before.rows[0], newValues: input
      });
      if (priceChanged) await appendOutboxEvent(client, request, {
        aggregateType: "Item", aggregateId: id, eventType: "ItemPriceChanged",
        payload: { itemId: id, previousPrice: before.rows[0].sale_price, price: input.salePrice }
      });
      return updated.rows[0];
    });
  }

  async deactivateItem(request: ApiRequest, id: string) {
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const updated = await client.query(
        `update items set status='inactive',updated_by=$4,updated_at=now(),version=version+1
         where id=$1 and tenant_id=$2 and company_id=$3 and status='active' returning id`,
        [id, request.auth!.tenantId, request.auth!.companyId, request.auth!.userId]
      );
      if (!updated.rows[0]) throw new NotFoundException("El producto no está activo.");
      await appendAudit(client, request, {
        action: "item.deactivated", entityType: "item", entityId: id, newValues: { status: "inactive" }
      });
      return { success: true };
    });
  }

  listPriceLists(request: ApiRequest) {
    return this.database.query(
      `select pl.id,pl.code,pl.name,pl.currency,pl.valid_from as "validFrom",pl.valid_until as "validUntil",
       pl.is_default as "isDefault",pl.status,pl.version,count(pli.id)::int as "itemCount"
       from price_lists pl left join price_list_items pli on pli.price_list_id=pl.id
       where pl.tenant_id=$1 and pl.company_id=$2 group by pl.id order by pl.is_default desc,pl.name`,
      [request.auth!.tenantId, request.auth!.companyId]
    );
  }

  async createPriceList(request: ApiRequest, input: {
    code: string; name: string; currency: string; validFrom: string; validUntil?: string | undefined;
    isDefault: boolean; items: Array<{ itemId: string; minimumQuantity: string; unitPrice: string; maximumDiscountRate: string }>;
  }) {
    const id = randomUUID();
    return this.database.scopedTransaction(request.auth!, async (client) => {
      await client.query(
        `insert into price_lists(id,tenant_id,company_id,code,name,currency,valid_from,valid_until,is_default,created_by)
         values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          id, request.auth!.tenantId, request.auth!.companyId, input.code.toUpperCase(), input.name.trim(),
          input.currency.toUpperCase(), input.validFrom, input.validUntil ?? null, input.isDefault, request.auth!.userId
        ]
      );
      for (const item of input.items) {
        await client.query(
          `insert into price_list_items(tenant_id,company_id,price_list_id,item_id,minimum_quantity,
            unit_price,maximum_discount_rate,valid_from,valid_until,created_by)
           values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            request.auth!.tenantId, request.auth!.companyId, id, item.itemId, item.minimumQuantity,
            item.unitPrice, item.maximumDiscountRate, input.validFrom, input.validUntil ?? null, request.auth!.userId
          ]
        );
      }
      await appendAudit(client, request, {
        action: "price-list.created", entityType: "price-list", entityId: id, newValues: input
      });
      return { id, ...input, version: 1 };
    });
  }

  async resolvePrice(request: ApiRequest, input: {
    itemId: string; customerPartyId?: string | undefined; quantity: string; at: string;
    manualPrice?: string | undefined;
  }) {
    const [item] = await this.database.query<{ sale_price: string; currency: string; status: string }>(
      "select sale_price::text,currency,status from items where id=$1 and tenant_id=$2 and company_id=$3",
      [input.itemId, request.auth!.tenantId, request.auth!.companyId]
    );
    if (!item || item.status !== "active") throw new NotFoundException("El producto no está activo.");
    const customerRows = input.customerPartyId ? await this.database.query<{
      price_list_id: string; unit_price: string; currency: string; minimum_quantity: string;
      maximum_discount_rate: string; valid_from: string; valid_until?: string;
    }>(
      `select pl.id price_list_id,pli.unit_price::text,pl.currency,pli.minimum_quantity::text,
       pli.maximum_discount_rate::text,pli.valid_from::text,pli.valid_until::text
       from customer_price_lists cpl join price_lists pl on pl.id=cpl.price_list_id
       join price_list_items pli on pli.price_list_id=pl.id and pli.item_id=$1
       where cpl.customer_party_id=$2 and cpl.company_id=$3 and pl.status='active'`,
      [input.itemId, input.customerPartyId, request.auth!.companyId]
    ) : [];
    const defaultRows = await this.database.query<{
      price_list_id: string; unit_price: string; currency: string; minimum_quantity: string;
      maximum_discount_rate: string; valid_from: string; valid_until?: string;
    }>(
      `select pl.id price_list_id,pli.unit_price::text,pl.currency,pli.minimum_quantity::text,
       pli.maximum_discount_rate::text,pli.valid_from::text,pli.valid_until::text
       from price_lists pl join price_list_items pli on pli.price_list_id=pl.id and pli.item_id=$1
       where pl.company_id=$2 and pl.is_default and pl.status='active'`,
      [input.itemId, request.auth!.companyId]
    );
    const mapCandidate = (row: typeof defaultRows[number]) => ({
      priceListId: row.price_list_id, price: row.unit_price, currency: row.currency,
      minimumQuantity: row.minimum_quantity, maximumDiscountRate: row.maximum_discount_rate,
      validFrom: row.valid_from, ...(row.valid_until ? { validUntil: row.valid_until } : {})
    });
    return new DefaultPriceResolver().resolve({
      quantity: input.quantity, itemDefaultPrice: item.sale_price, currency: item.currency,
      customerPrices: customerRows.map(mapCandidate), defaultPrices: defaultRows.map(mapCandidate),
      ...(input.manualPrice !== undefined ? { manualPrice: input.manualPrice } : {}),
      allowManualPrice: request.auth!.permissions.has("sales.price.override"), at: input.at
    });
  }
}
