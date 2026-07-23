import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { StockMovementType, calculateStock, formatDecimal, parseDecimal } from "@erp/domain";
import { DatabaseService } from "./database.service.js";
import type { ApiRequest } from "./http.js";
import {
  appendAudit, appendOutboxEvent, beginIdempotentOperation, completeIdempotentOperation
} from "./operations.js";

interface MovementLine {
  itemId: string;
  quantity: string;
  unitCost?: string | undefined;
}

@Injectable()
export class InventoryService {
  constructor(private readonly database: DatabaseService) {}

  warehouses(request: ApiRequest) {
    return this.database.query(
      `select w.id,w.code,w.name,w.address,w.allow_negative_stock as "allowNegativeStock",w.status,
       b.name as branch from warehouses w left join branches b on b.id=w.branch_id
       where w.tenant_id=$1 and w.company_id=$2 order by w.name`,
      [request.auth!.tenantId, request.auth!.companyId]
    );
  }

  balances(request: ApiRequest, warehouseId?: string) {
    return this.database.query(
      `select sb.warehouse_id as "warehouseId",w.name as warehouse,sb.item_id as "itemId",
       i.code,i.name,u.code as unit,sb.quantity::text,i.minimum_stock::text as "minimumStock",
       (sb.quantity<i.minimum_stock) as "lowStock"
       from stock_balances sb join warehouses w on w.id=sb.warehouse_id
       join items i on i.id=sb.item_id left join units_of_measure u on u.id=i.unit_id
       where sb.tenant_id=$1 and sb.company_id=$2 and ($3::uuid is null or sb.warehouse_id=$3)
       order by w.name,i.name`,
      [request.auth!.tenantId, request.auth!.companyId, warehouseId ?? null]
    );
  }

  movements(request: ApiRequest, input: { warehouseId?: string | undefined; itemId?: string | undefined; limit: number }) {
    return this.database.query(
      `select sm.id,sm.movement_type as "movementType",sm.movement_date as "movementDate",
       sm.source_entity_type as "sourceEntityType",sm.source_entity_id as "sourceEntityId",
       sm.reason,sm.status,w.name as warehouse,count(sml.id)::int as "lineCount"
       from stock_movements sm join warehouses w on w.id=sm.warehouse_id
       join stock_movement_lines sml on sml.stock_movement_id=sm.id
       where sm.tenant_id=$1 and sm.company_id=$2
         and ($3::uuid is null or sm.warehouse_id=$3)
         and ($4::uuid is null or sml.item_id=$4)
       group by sm.id,w.name order by sm.movement_date desc,sm.id desc limit $5`,
      [request.auth!.tenantId, request.auth!.companyId, input.warehouseId ?? null, input.itemId ?? null, input.limit]
    );
  }

  private async validateLines(client: PoolClient, request: ApiRequest, lines: readonly MovementLine[]) {
    const itemIds = [...new Set(lines.map((line) => line.itemId))];
    const items = await client.query<{ id: string; manages_stock: boolean; status: string; item_type: string }>(
      `select id,manages_stock,status,item_type from items
       where id=any($1::uuid[]) and tenant_id=$2 and company_id=$3`,
      [itemIds, request.auth!.tenantId, request.auth!.companyId]
    );
    if (
      items.rows.length !== itemIds.length ||
      items.rows.some((item) => !item.manages_stock || item.item_type === "SERVICE" || item.status !== "active")
    ) {
      throw new ConflictException("Todos los ítems del movimiento deben estar activos y administrar stock.");
    }
  }

  private async postMovement(
    client: PoolClient,
    request: ApiRequest,
    input: {
      warehouseId: string; movementType: StockMovementType; lines: readonly MovementLine[];
      sourceEntityType: string; sourceEntityId: string; reason?: string | undefined;
      movementDate?: string | undefined; key: string; linkedMovementId?: string | undefined;
    }
  ): Promise<string> {
    await this.validateLines(client, request, input.lines);
    const direction = new Set<StockMovementType>([
      StockMovementType.PURCHASE_RECEIPT, StockMovementType.OPENING, StockMovementType.TRANSFER_IN,
      StockMovementType.CUSTOMER_RETURN, StockMovementType.POSITIVE_ADJUSTMENT
    ]).has(input.movementType) ? 1n : -1n;
    const itemIds = [...new Set(input.lines.map((line) => line.itemId))].sort();
    for (const itemId of itemIds) {
      await client.query(
        `insert into stock_balances(tenant_id,company_id,warehouse_id,item_id,quantity)
         values($1,$2,$3,$4,0) on conflict(warehouse_id,item_id) do nothing`,
        [request.auth!.tenantId, request.auth!.companyId, input.warehouseId, itemId]
      );
    }
    const balances = await client.query<{ item_id: string; quantity: string; allow_negative_stock: boolean }>(
      `select sb.item_id,sb.quantity::text,w.allow_negative_stock
       from stock_balances sb join warehouses w on w.id=sb.warehouse_id
       where sb.warehouse_id=$1 and sb.item_id=any($2::uuid[]) order by sb.item_id for update`,
      [input.warehouseId, itemIds]
    );
    const byItem = new Map(balances.rows.map((balance) => [balance.item_id, balance]));
    for (const line of input.lines) {
      const current = byItem.get(line.itemId);
      if (!current) throw new NotFoundException("No se pudo inicializar el saldo.");
      const allowNegative = current.allow_negative_stock && request.auth!.permissions.has("inventory.allow-negative");
      calculateStock(current.quantity, formatDecimal(direction * parseDecimal(line.quantity, 6), 6), allowNegative);
    }
    const movementId = randomUUID();
    await client.query(
      `insert into stock_movements(id,tenant_id,company_id,branch_id,warehouse_id,linked_movement_id,
        movement_type,movement_date,source_entity_type,source_entity_id,reason,idempotency_key,created_by)
       values($1,$2,$3,$4,$5,$6,$7,coalesce($8::timestamptz,now()),$9,$10,$11,$12,$13)`,
      [
        movementId, request.auth!.tenantId, request.auth!.companyId, request.auth!.branchIds[0] ?? null,
        input.warehouseId, input.linkedMovementId ?? null, input.movementType, input.movementDate ?? null,
        input.sourceEntityType, input.sourceEntityId, input.reason ?? null, input.key, request.auth!.userId
      ]
    );
    for (const line of input.lines) {
      const signed = formatDecimal(direction * parseDecimal(line.quantity, 6), 6);
      await client.query(
        `insert into stock_movement_lines(tenant_id,company_id,stock_movement_id,item_id,quantity,
          signed_quantity,unit_cost) values($1,$2,$3,$4,$5,$6,$7)`,
        [
          request.auth!.tenantId, request.auth!.companyId, movementId, line.itemId,
          line.quantity, signed, line.unitCost ?? null
        ]
      );
      await client.query(
        `update stock_balances set quantity=quantity+$3,updated_at=now(),version=version+1
         where warehouse_id=$1 and item_id=$2`,
        [input.warehouseId, line.itemId, signed]
      );
    }
    return movementId;
  }

  async createMovement(request: ApiRequest, input: {
    warehouseId: string; movementType: StockMovementType; lines: MovementLine[];
    reason?: string | undefined; movementDate?: string | undefined;
  }, key: string) {
    if ([StockMovementType.TRANSFER_IN, StockMovementType.TRANSFER_OUT].includes(input.movementType)) {
      throw new ConflictException("Use el flujo transaccional de transferencia.");
    }
    if ([StockMovementType.POSITIVE_ADJUSTMENT, StockMovementType.NEGATIVE_ADJUSTMENT].includes(input.movementType) && !input.reason?.trim()) {
      throw new ConflictException("Los ajustes requieren motivo.");
    }
    if (input.movementType === StockMovementType.NEGATIVE_ADJUSTMENT && !request.auth!.permissions.has("inventory.adjust")) {
      throw new ConflictException("El ajuste negativo requiere permiso.");
    }
    if (input.movementDate && input.movementDate.slice(0, 10) < new Date().toISOString().slice(0, 10) &&
      !request.auth!.permissions.has("inventory.adjust.backdate")) {
      throw new ConflictException("El movimiento retroactivo requiere permiso elevado.");
    }
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const idempotency = await beginIdempotentOperation(client, request, "CreateStockMovement", key, input);
      if (idempotency.replay) return idempotency.replay;
      const sourceId = randomUUID();
      const id = await this.postMovement(client, request, {
        ...input, sourceEntityType: "manual-inventory", sourceEntityId: sourceId, key
      });
      const response = { id, status: "POSTED", movementType: input.movementType };
      await appendAudit(client, request, {
        action: "inventory.movement.created", entityType: "stock-movement", entityId: id, newValues: input
      });
      await appendOutboxEvent(client, request, {
        aggregateType: "StockMovement", aggregateId: id,
        eventType: input.movementType === StockMovementType.POSITIVE_ADJUSTMENT ||
          input.movementType === StockMovementType.NEGATIVE_ADJUSTMENT ? "StockAdjusted" : "StockReceived",
        payload: response
      });
      await completeIdempotentOperation(client, idempotency.id, response);
      return response;
    });
  }

  async transfer(request: ApiRequest, input: {
    sourceWarehouseId: string; targetWarehouseId: string; lines: MovementLine[]; reason: string;
  }, key: string) {
    if (input.sourceWarehouseId === input.targetWarehouseId) throw new ConflictException("Los almacenes deben ser diferentes.");
    return this.database.scopedTransaction(request.auth!, async (client) => {
      const idempotency = await beginIdempotentOperation(client, request, "TransferStock", key, input);
      if (idempotency.replay) return idempotency.replay;
      const transferId = randomUUID();
      const warehouses = [input.sourceWarehouseId, input.targetWarehouseId].sort();
      const available = await client.query<{ id: string }>(
        `select id from warehouses where id=any($1::uuid[]) and tenant_id=$2 and company_id=$3
         and status='active' order by id for update`,
        [warehouses, request.auth!.tenantId, request.auth!.companyId]
      );
      if (available.rows.length !== 2) throw new NotFoundException("Uno de los almacenes no existe.");
      const outboundId = await this.postMovement(client, request, {
        warehouseId: input.sourceWarehouseId, movementType: StockMovementType.TRANSFER_OUT,
        lines: input.lines, sourceEntityType: "stock-transfer", sourceEntityId: transferId,
        reason: input.reason, key: `${key}:out`
      });
      const inboundId = await this.postMovement(client, request, {
        warehouseId: input.targetWarehouseId, movementType: StockMovementType.TRANSFER_IN,
        lines: input.lines, sourceEntityType: "stock-transfer", sourceEntityId: transferId,
        reason: input.reason, key: `${key}:in`, linkedMovementId: outboundId
      });
      await client.query("update stock_movements set linked_movement_id=$2 where id=$1", [outboundId, inboundId]);
      const response = { transferId, outboundId, inboundId, status: "POSTED" };
      await appendAudit(client, request, {
        action: "inventory.transferred", entityType: "stock-transfer", entityId: transferId, newValues: input
      });
      await appendOutboxEvent(client, request, {
        aggregateType: "StockTransfer", aggregateId: transferId, eventType: "StockTransferred", payload: response
      });
      await completeIdempotentOperation(client, idempotency.id, response);
      return response;
    });
  }
}

