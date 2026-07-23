# Reporte 01 — Architecture Coordinator

Fecha: 2026-07-23.
Alcance: inspección y coordinación inicial de Fase 3.

## Trabajo realizado

Se inspeccionaron la estructura del repositorio y estos puntos de arquitectura:

- `docs/ARCHITECTURE.md`, `docs/DOMAIN-MODEL.md`, `docs/DATABASE.md`,
  `docs/SECURITY.md`, `docs/PERMISSIONS.md`, `docs/MODULE-SYSTEM.md` y
  `docs/PHASE-2-REPORT.md`.
- `package.json`, `pnpm-workspace.yaml` y `tsconfig.base.json`.
- Registro de módulos y exports de dominio en `packages/domain/src/index.ts`,
  además de la estructura inicial de `packages/domain/src/phase2.ts`.
- Contratos de infraestructura en `packages/contracts/src/index.ts`.
- Composición de API en `apps/api/src/app.module.ts`, guard global en
  `apps/api/src/auth.guard.ts`, transacción con contexto en
  `apps/api/src/database.service.ts` y utilidades de idempotencia/audit/outbox en
  `apps/api/src/operations.ts`.
- Nombres y tamaños de migraciones `0001`–`0006`.
- Secciones de la instrucción maestra relativas a agentes, módulos/dependencias,
  configuración, migraciones, API, pantallas, offline, observabilidad,
  rendimiento, pruebas, documentos, scripts, secuencia, prohibiciones y
  aceptación.

No se modificó código de producto.

## Estado observado

- La arquitectura declarada y el código inspeccionado siguen el modelo de monolito
  modular: React/PWA, NestJS/Fastify, worker, PostgreSQL y paquetes de dominio,
  contratos, seguridad y base de datos.
- TypeScript tiene `strict`, `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noImplicitOverride` y
  `useUnknownInCatchVariables`.
- La API dispone de guard global, permisos por metadata, cookie de sesión opaca,
  contexto autenticado y helper transaccional que configura tenant/company.
- Existen utilidades compartidas para idempotencia, auditoría redactada y outbox.
- Los providers AI/OCR/maps actuales son contratos mínimos y no satisfacen todavía
  las capacidades, gobernanza, health, timeouts ni trazabilidad exigidas por Fase
  3.
- El registro de módulos ya reserva `projects`, `human-resources`,
  `occupational-safety`, `maps`, `ocr` y `artificial-intelligence` como no
  implementados. Sus dependencias no coinciden todavía en todos los casos con el
  grafo requerido por Fase 3 y faltan los demás módulos nuevos.
- La composición de API es centralizada en `app.module.ts`; el dominio de Fase 2
  se concentra en un archivo grande. Ambos son hotspots de conflicto si varios
  agentes editan en paralelo.
- La migración operativa `0002` es grande y las migraciones posteriores endurecen
  índices/historial. Fase 3 debe dividir migraciones por bloques coherentes y
  conservar un único propietario de numeración.
- No había archivos `AGENTS.md` en el momento de esta inspección.
- La carpeta no es un repositorio Git. `git status --short --branch` devolvió
  `fatal: not a git repository (or any of the parent directories): .git`. No es
  posible usar worktrees ni ramas aisladas en el estado actual.

## Decisiones de coordinación propuestas

1. Mantener el monolito modular y crear archivos autocontenidos por feature; no
   introducir microservicios.
2. Reservar los archivos compartidos de composición/exports/manifests al
   Architecture Coordinator y modificarlos sólo en ventanas secuenciales.
3. Congelar primero doce contratos compartidos: identidad/scope, módulos,
   permisos, eventos/outbox, errores/API, configuración/approval, providers,
   clasificación, OCR handoff, AI tools, demo reset y observabilidad.
4. Asignar todas las migraciones a Agent 3 y hacer obligatoria la revisión de RLS
   y datos sensibles por Agent 4.
5. Mantener AI/OCR/maps detrás de contratos reemplazables y deshabilitables. OCR
   sólo entrega borradores revisados; AI no recibe SQL ni scripting irrestricto.
6. Separar datos médicos detallados de la información de aptitud/restricción
   operacional de HR/SST.
7. Integrar primero control administrativo/configuración; después módulos
   operativos; luego providers y legal/privacidad; finalmente demo y release.
8. Exigir evidencia de ejecución para cada afirmación de verificación.

La matriz operativa y los gates se encuentran en
`docs/phase3/AGENT-TASK-MATRIX.md`.

## Riesgos y conflictos

| Riesgo | Impacto | Mitigación |
| --- | --- | --- |
| Sin Git/worktrees | Colisiones y rollback manual | Propiedad exclusiva de rutas, archivos nuevos, integración secuencial y respaldo/verificación antes de hotspots. |
| `AppModule`, `App.tsx`, exports y manifests compartidos | Ediciones paralelas incompatibles | Único integrador temporal y ventanas exclusivas. |
| Redefinición independiente de contratos | Incompatibilidad entre dominio/API/UI/providers | Congelamiento y aprobación previa mediante ADR. |
| Esquema muy amplio | Migraciones frágiles, lentas o irreversibles | Bloques numerados, un escritor, `up/down`, constraints, índices y pruebas upgrade/rollback. |
| Datos HR/SST médicos | Exposición indebida | Separación física/lógica, permisos específicos, auditoría y revisión Security/Privacy. |
| AI/OCR con entrada no confiable | Inyección, exfiltración o acciones indebidas | Policy engine, tools tipadas, redacción, límites, provenance, revisión humana y pruebas adversariales. |
| Demo reutilizando caminos privilegiados | Reset productivo o fuga de secretos/datos | Tenant dedicado, doble guard de entorno, límites, datos sintéticos y análisis del artefacto. |
| Documentación legal presentada como garantía | Riesgo de afirmación engañosa | Fuentes oficiales fechadas, versionado, revisión legal y aviso expreso de no sustitución de asesoría. |

## ADR requeridos

Se proponen ADR-003 a ADR-011 para límites modulares, configuración versionada,
providers/secretos, datos HR/SST, OCR, AI tools, demo, observabilidad y
migraciones. La matriz contiene el propósito de cada uno. En este reporte no se
declaran aprobados: requieren revisión de los especialistas correspondientes.

## Verificación ejecutada

Se ejecutaron únicamente comandos de inspección:

- inventario de archivos/directorios con PowerShell y `rg --files`;
- búsqueda de `AGENTS.md` con `rg --files -g AGENTS.md`;
- lectura de documentos y archivos de código indicados;
- lectura focalizada de la instrucción maestra;
- `git status --short --branch`.

No se ejecutaron instalación, migraciones, pruebas, lint, typecheck, build, scan de
secretos ni verificación de navegador como parte de este subtrabajo. Por tanto,
este reporte no afirma que la línea base o Fase 3 estén aprobadas.

## Revisión requerida

- Agent 8 debe revisar que la matriz cubra los criterios y gates de pruebas.
- Agent 3 debe revisar ownership de migraciones, concurrencia y backup/restore.
- Agent 4 debe revisar todos los gates de seguridad/privacidad.
- Agent 5 debe revisar las superficies y afirmaciones legales.
- El Architecture Coordinator raíz debe aprobar o ajustar los contratos y ADR antes
  de comenzar trabajo dependiente.

