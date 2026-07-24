/*
 * SPDX-FileCopyrightText: 2026 ERP Express Perú contributors
 * SPDX-License-Identifier: MPL-2.0
 *
 * Registros de asistencia de IA, cuando corresponda:
 * docs/compliance/ai-provenance/
 */
import { PostgresDatabase } from "@erp/database";

// El worker es hoy un escáner de sistema entre tenants: recorre las cuentas,
// stock y documentos de TODOS los tenants y genera notificaciones. Ese diseño
// es incompatible con RLS por tenant sin el rediseño de la etapa S7 (reclamar
// trabajos por tenant y fijar contexto por evento). Hasta entonces usa un rol
// privilegiado. No tiene superficie HTTP ni entrada de usuario, por lo que el
// riesgo de escalado por inyección —el hallazgo C-1 de la API— no aplica aquí.
// La API, superficie expuesta, sí corre con el rol restringido erp_app.
const workerConnection =
  process.env.DATABASE_WORKER_URL ?? process.env.DATABASE_MIGRATION_URL ?? process.env.DATABASE_URL;
if (!workerConnection) throw new Error("DATABASE_MIGRATION_URL o DATABASE_URL es obligatorio para el worker.");
const database = new PostgresDatabase(workerConnection);
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
  // Cada generador de notificaciones pertenece a un módulo (H-4). Solo se ejecuta
  // para las empresas donde ese módulo está implementado y habilitado. El filtro
  // se inyecta como una condición EXISTS sobre `company_modules`, usando el alias
  // de la tabla base de cada consulta. Si el módulo está deshabilitado para una
  // empresa, no se generan sus notificaciones (se cuenta como bloqueado).
  const moduleGuard = (alias: string, moduleCode: string) =>
    `exists(select 1 from company_modules cm join modules m on m.id=cm.module_id
       where cm.company_id=${alias}.company_id and m.code='${moduleCode}'
         and m.implemented and cm.status='enabled')`;
  const generators: Array<{ handler: string; module: string; sql: string }> = [
    { handler: "receivable-overdue", module: "receivables", sql:
      `insert into notifications(tenant_id,company_id,notification_type,title,message,entity_type,entity_id)
       select ar.tenant_id,ar.company_id,'RECEIVABLE_OVERDUE','Cuenta por cobrar vencida',
         'Existe un saldo vencido que requiere seguimiento.','account-receivable',ar.id
       from accounts_receivable ar
       where ar.status in ('OPEN','PARTIALLY_PAID','OVERDUE') and ar.due_date<current_date
         and ${moduleGuard("ar", "receivables")}
         and not exists(select 1 from notifications n where n.entity_id=ar.id
           and n.notification_type='RECEIVABLE_OVERDUE' and n.read_at is null)` },
    { handler: "payable-due-soon", module: "payables", sql:
      `insert into notifications(tenant_id,company_id,notification_type,title,message,entity_type,entity_id)
       select ap.tenant_id,ap.company_id,'PAYABLE_DUE_SOON','Pago próximo a vencer',
         'Existe una cuenta por pagar con vencimiento durante los próximos siete días.','account-payable',ap.id
       from accounts_payable ap
       where ap.status in ('OPEN','PARTIALLY_PAID') and ap.due_date between current_date and current_date+7
         and ${moduleGuard("ap", "payables")}
         and not exists(select 1 from notifications n where n.entity_id=ap.id
           and n.notification_type='PAYABLE_DUE_SOON' and n.read_at is null)` },
    { handler: "low-stock", module: "inventory-basic", sql:
      `insert into notifications(tenant_id,company_id,notification_type,title,message,entity_type,entity_id)
       select sb.tenant_id,sb.company_id,'LOW_STOCK','Stock por debajo del mínimo',
         'El saldo disponible está por debajo del stock mínimo configurado.','item',sb.item_id
       from stock_balances sb join items i on i.id=sb.item_id
       where sb.quantity<i.minimum_stock
         and ${moduleGuard("sb", "inventory-basic")}
         and not exists(select 1 from notifications n where n.entity_id=sb.item_id
           and n.notification_type='LOW_STOCK' and n.read_at is null)` },
    { handler: "commercial-document-rejected", module: "commercial-documents", sql:
      `insert into notifications(tenant_id,company_id,notification_type,title,message,entity_type,entity_id)
       select cd.tenant_id,cd.company_id,'COMMERCIAL_DOCUMENT_REJECTED','Comprobante rechazado',
         'Un documento comercial fue marcado como rechazado.','commercial-document',cd.id
       from commercial_documents cd where cd.status='REJECTED'
         and ${moduleGuard("cd", "commercial-documents")}
         and not exists(select 1 from notifications n where n.entity_id=cd.id
           and n.notification_type='COMMERCIAL_DOCUMENT_REJECTED' and n.read_at is null)` },
    { handler: "project-task-overdue", module: "projects", sql:
      `insert into notifications(tenant_id,company_id,notification_type,title,message,entity_type,entity_id)
       select pt.tenant_id,pt.company_id,'PROJECT_TASK_OVERDUE','Tarea de proyecto vencida',
         'Una tarea de proyecto superó su fecha planificada y requiere seguimiento.','project-task',pt.id
       from project_tasks pt
       where pt.status not in ('done','cancelled') and pt.planned_end<current_date
         and ${moduleGuard("pt", "projects")}
         and not exists(select 1 from notifications n where n.entity_id=pt.id
           and n.notification_type='PROJECT_TASK_OVERDUE' and n.read_at is null)` },
    { handler: "sst-action-overdue", module: "occupational-safety", sql:
      `insert into notifications(tenant_id,company_id,notification_type,title,message,entity_type,entity_id)
       select ca.tenant_id,ca.company_id,'SST_ACTION_OVERDUE','Acción correctiva SST vencida',
         'Una acción correctiva de SST venció y requiere escalamiento.','sst-corrective-action',ca.id
       from sst_corrective_actions ca
       where ca.status not in ('completed','verified','cancelled') and ca.due_date<current_date
         and ${moduleGuard("ca", "occupational-safety")}
         and not exists(select 1 from notifications n where n.entity_id=ca.id
           and n.notification_type='SST_ACTION_OVERDUE' and n.read_at is null)` },
    { handler: "maintenance-due", module: "maintenance", sql:
      `insert into notifications(tenant_id,company_id,notification_type,title,message,entity_type,entity_id)
       select ms.tenant_id,ms.company_id,'MAINTENANCE_DUE','Mantenimiento próximo o vencido',
         'Un mantenimiento por fecha requiere programación o ejecución.','maintenance-schedule',ms.id
       from maintenance_schedules ms
       where ms.status in ('scheduled','due') and ms.due_date<=current_date+7
         and ${moduleGuard("ms", "maintenance")}
         and not exists(select 1 from notifications n where n.entity_id=ms.id
           and n.notification_type='MAINTENANCE_DUE' and n.read_at is null)` },
    { handler: "ocr-review-required", module: "ocr", sql:
      `insert into notifications(tenant_id,company_id,notification_type,title,message,entity_type,entity_id)
       select oj.tenant_id,oj.company_id,'OCR_REVIEW_REQUIRED','Revisión OCR pendiente',
         'Una extracción OCR requiere revisión humana antes de crear registros.','ocr-job',oj.id
       from ocr_jobs oj where oj.status='review_required'
         and ${moduleGuard("oj", "ocr")}
         and not exists(select 1 from notifications n where n.entity_id=oj.id
           and n.notification_type='OCR_REVIEW_REQUIRED' and n.read_at is null)` },
    { handler: "provider-unavailable", module: "provider-management", sql:
      `insert into notifications(tenant_id,company_id,notification_type,title,message,entity_type,entity_id)
       select ph.tenant_id,ph.company_id,'PROVIDER_UNAVAILABLE','Proveedor no disponible',
         'La última comprobación del proveedor reportó indisponibilidad.','provider-configuration',ph.provider_configuration_id
       from provider_health_checks ph
       where ph.status='unavailable'
         and ${moduleGuard("ph", "provider-management")}
         and ph.checked_at=(select max(latest.checked_at) from provider_health_checks latest
           where latest.provider_configuration_id=ph.provider_configuration_id)
         and not exists(select 1 from notifications n where n.entity_id=ph.provider_configuration_id
           and n.notification_type='PROVIDER_UNAVAILABLE' and n.read_at is null)` }
  ];
  const generated: Record<string, number> = {};
  await database.transaction(async (client) => {
    for (const generator of generators) {
      const result = await client.query(generator.sql);
      generated[generator.handler] = result.rowCount ?? 0;
    }
  });
  console.log(JSON.stringify({
    level: "info", event: "worker.cycle", activeModules: rows,
    processedOutboxEvents: processedEvents.length, notificationsByHandler: generated,
    at: new Date().toISOString()
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
