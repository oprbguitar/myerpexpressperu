# ERP Express Perú — reglas de contribución

## Arquitectura

- Mantener el monolito modular: `apps/web`, `apps/api`, `apps/worker`, paquetes compartidos y PostgreSQL.
- El dominio no importa NestJS, React, PostgreSQL ni proveedores externos.
- Los proveedores implementan contratos hexagonales; ningún proveedor opcional puede ser requisito de arranque.
- Toda operación de negocio usa el tenant y la empresa derivados de la sesión. Nunca confiar en IDs de ámbito enviados por el navegador.
- Mantener TypeScript estricto. Se prohíben `any`, SQL sin parámetros y secretos en cliente, logs o artefactos.

## Comandos obligatorios

```text
pnpm db:migrate
pnpm db:seed
pnpm typecheck
pnpm lint
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
pnpm check:bundle
pnpm check:secrets
```

Los cambios de Fase 3 también deben pasar `pnpm phase3:verify`, `pnpm security:scan`,
`pnpm licenses:check`, `pnpm sbom:generate` y `pnpm demo:verify` cuando existan.

## Migraciones y datos

- Cada migración tiene un `up.sql` y un `down.sql`, número único y ejecución transaccional.
- No editar migraciones ya aplicadas. No crear dos migraciones con el mismo número.
- Usar claves foráneas, restricciones de estado, índices de ámbito y `version` para concurrencia.
- Tablas de negocio incluyen `tenant_id` y `company_id` cuando corresponda y políticas RLS.
- Datos médicos, secretos de proveedor y auditoría sensible usan límites de repositorio separados.
- Semillas son sintéticas, deterministas y se rechazan en producción.

## Seguridad y revisión

- Autorización en API y casos de uso; ocultar UI no concede ni revoca acceso.
- Acciones sensibles requieren reautenticación o aprobación cuando el caso de uso lo indique.
- Nunca enviar datos médicos, secretos o documentos sin clasificación a IA/OCR externos.
- OCR solo crea borradores revisables. IA solo usa herramientas registradas y no ejecuta acciones consecuenciales.
- Reinicios demo requieren múltiples guardas independientes y jamás pueden operar en producción.
- Código de seguridad requiere revisión del agente de Seguridad; migraciones del agente de Base de Datos; pantallas legales del agente Legal; IA/OCR de ambos.

## Propiedad y documentación

- `packages/domain`: invariantes y estados; `packages/contracts`: puertos; `packages/database` y `migrations`: persistencia.
- `apps/api`: transporte, autorización y adaptadores; `apps/web`: presentación y borradores; `apps/worker`: jobs idempotentes.
- `modules/*` contiene límites y guías de los módulos, no un segundo runtime.
- Cada agente escribe un informe en `docs/phase3/agent-reports`.
- Documentar solo comportamiento implementado y ejecutado. No afirmar cumplimiento legal automático ni funcionamiento productivo no verificado.
- No hacer push, despliegue remoto ni cambios destructivos sin autorización explícita.

## Cierre

No integrar con pruebas fallidas. Registrar desviaciones, riesgos residuales, fuentes
legales consultadas, comandos y resultados reales en `docs/PHASE-3-REPORT.md`.
