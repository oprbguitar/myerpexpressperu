/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { PostgresDatabase } from "@erp/database";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL es obligatorio.");
const database = new PostgresDatabase(process.env.DATABASE_URL);
let stopping = false;

async function runCycle(): Promise<void> {
  const rows = await database.query<{ code: string; companies: string }>(
    `select m.code,count(*)::text companies from modules m
     join company_modules cm on cm.module_id=m.id and cm.status='enabled'
     where m.implemented group by m.code order by m.code`
  );
  const processedEvents = await database.transaction(async (client) => {
    const pending = await client.query<{ id: string; event_type: string; aggregate_id: string }>(
      `select id,event_type,aggregate_id from outbox_events
       where processed_at is null and available_at<=now()
       order by available_at,id for update skip locked limit 100`
    );
    for (const event of pending.rows) {
      await client.query(
        "update outbox_events set processed_at=now(),attempts=attempts+1,last_error=null where id=$1",
        [event.id]
      );
    }
    return pending.rows;
  });
  await database.transaction(async (client) => {
    await client.query(
      `insert into notifications(tenant_id,company_id,notification_type,title,message,entity_type,entity_id)
       select ar.tenant_id,ar.company_id,'RECEIVABLE_OVERDUE','Cuenta por cobrar vencida',
         'Existe un saldo vencido que requiere seguimiento.','account-receivable',ar.id
       from accounts_receivable ar
       where ar.status in ('OPEN','PARTIALLY_PAID','OVERDUE') and ar.due_date<current_date
         and not exists(select 1 from notifications n where n.entity_id=ar.id
           and n.notification_type='RECEIVABLE_OVERDUE' and n.read_at is null)`
    );
    await client.query(
      `insert into notifications(tenant_id,company_id,notification_type,title,message,entity_type,entity_id)
       select ap.tenant_id,ap.company_id,'PAYABLE_DUE_SOON','Pago próximo a vencer',
         'Existe una cuenta por pagar con vencimiento durante los próximos siete días.','account-payable',ap.id
       from accounts_payable ap
       where ap.status in ('OPEN','PARTIALLY_PAID') and ap.due_date between current_date and current_date+7
         and not exists(select 1 from notifications n where n.entity_id=ap.id
           and n.notification_type='PAYABLE_DUE_SOON' and n.read_at is null)`
    );
    await client.query(
      `insert into notifications(tenant_id,company_id,notification_type,title,message,entity_type,entity_id)
       select sb.tenant_id,sb.company_id,'LOW_STOCK','Stock por debajo del mínimo',
         'El saldo disponible está por debajo del stock mínimo configurado.','item',sb.item_id
       from stock_balances sb join items i on i.id=sb.item_id
       where sb.quantity<i.minimum_stock
         and not exists(select 1 from notifications n where n.entity_id=sb.item_id
           and n.notification_type='LOW_STOCK' and n.read_at is null)`
    );
    await client.query(
      `insert into notifications(tenant_id,company_id,notification_type,title,message,entity_type,entity_id)
       select cd.tenant_id,cd.company_id,'COMMERCIAL_DOCUMENT_REJECTED','Comprobante rechazado',
         'Un documento comercial fue marcado como rechazado.','commercial-document',cd.id
       from commercial_documents cd where cd.status='REJECTED'
         and not exists(select 1 from notifications n where n.entity_id=cd.id
           and n.notification_type='COMMERCIAL_DOCUMENT_REJECTED' and n.read_at is null)`
    );
    await client.query(
      `insert into notifications(tenant_id,company_id,notification_type,title,message,entity_type,entity_id)
       select pt.tenant_id,pt.company_id,'PROJECT_TASK_OVERDUE','Tarea de proyecto vencida',
         'Una tarea de proyecto superó su fecha planificada y requiere seguimiento.','project-task',pt.id
       from project_tasks pt
       where pt.status not in ('done','cancelled') and pt.planned_end<current_date
         and not exists(select 1 from notifications n where n.entity_id=pt.id
           and n.notification_type='PROJECT_TASK_OVERDUE' and n.read_at is null)`
    );
    await client.query(
      `insert into notifications(tenant_id,company_id,notification_type,title,message,entity_type,entity_id)
       select ca.tenant_id,ca.company_id,'SST_ACTION_OVERDUE','Acción correctiva SST vencida',
         'Una acción correctiva de SST venció y requiere escalamiento.','sst-corrective-action',ca.id
       from sst_corrective_actions ca
       where ca.status not in ('completed','verified','cancelled') and ca.due_date<current_date
         and not exists(select 1 from notifications n where n.entity_id=ca.id
           and n.notification_type='SST_ACTION_OVERDUE' and n.read_at is null)`
    );
    await client.query(
      `insert into notifications(tenant_id,company_id,notification_type,title,message,entity_type,entity_id)
       select ms.tenant_id,ms.company_id,'MAINTENANCE_DUE','Mantenimiento próximo o vencido',
         'Un mantenimiento por fecha requiere programación o ejecución.','maintenance-schedule',ms.id
       from maintenance_schedules ms
       where ms.status in ('scheduled','due') and ms.due_date<=current_date+7
         and not exists(select 1 from notifications n where n.entity_id=ms.id
           and n.notification_type='MAINTENANCE_DUE' and n.read_at is null)`
    );
    await client.query(
      `insert into notifications(tenant_id,company_id,notification_type,title,message,entity_type,entity_id)
       select oj.tenant_id,oj.company_id,'OCR_REVIEW_REQUIRED','Revisión OCR pendiente',
         'Una extracción OCR requiere revisión humana antes de crear registros.','ocr-job',oj.id
       from ocr_jobs oj where oj.status='review_required'
         and not exists(select 1 from notifications n where n.entity_id=oj.id
           and n.notification_type='OCR_REVIEW_REQUIRED' and n.read_at is null)`
    );
    await client.query(
      `insert into notifications(tenant_id,company_id,notification_type,title,message,entity_type,entity_id)
       select ph.tenant_id,ph.company_id,'PROVIDER_UNAVAILABLE','Proveedor no disponible',
         'La última comprobación del proveedor reportó indisponibilidad.','provider-configuration',ph.provider_configuration_id
       from provider_health_checks ph
       where ph.status='unavailable'
         and ph.checked_at=(select max(latest.checked_at) from provider_health_checks latest
           where latest.provider_configuration_id=ph.provider_configuration_id)
         and not exists(select 1 from notifications n where n.entity_id=ph.provider_configuration_id
           and n.notification_type='PROVIDER_UNAVAILABLE' and n.read_at is null)`
    );
  });
  console.log(JSON.stringify({
    level: "info", event: "worker.cycle", activeModules: rows,
    processedOutboxEvents: processedEvents.length, at: new Date().toISOString()
  }));
}

async function loop(): Promise<void> {
  while (!stopping) {
    await runCycle().catch((error: unknown) => console.error(JSON.stringify({ level: "error", event: "worker.error", message: String(error) })));
    await new Promise((resolve) => setTimeout(resolve, 60_000));
  }
}
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => { stopping = true; void database.close(); });
}
void loop();
