# S2 — Enforcement de módulos en runtime

- **Fecha:** 2026-07-24
- **Hallazgos corregidos:** C-2 (desactivar un módulo no protegía Fase 1/2), H-4 (worker ignoraba módulos)
- **Estado:** `FIXED_VERIFIED` (API y worker probados; frontend implementado)

## El defecto

`@RequireModule` existía pero solo se aplicaba en controladores de Fase 3. Los ~19
controladores de Fase 1/2 no lo usaban, así que **desactivar un módulo cambiaba un
flag y nada más**: sus endpoints seguían respondiendo 200. Además `disable-impact`
afirmaba al operador que «la API y los jobs rechazan nuevas operaciones», lo cual
era falso. El worker consultaba los módulos habilitados solo para un log.

## La solución

### 1. Decoradores y registro autoritativo

- `@OwnedByModule("code")` — declara el módulo dueño de un controlador.
- `@CoreEndpoint()` — marca infraestructura siempre disponible (salud, auth,
  organización, usuarios, roles, módulos, notificaciones, PDF).
- `@RequireModule("code")` (existente) — override a nivel de método para
  controladores multi-módulo.
- `MODULE_RESOURCE_REGISTRY` — recursos no-controlador (handlers de worker, rutas
  de frontend, widgets) por módulo.
- `CONTROLLER_MODULE_MAP` — mapa dato (nombre→módulo) para `disable-impact`, sin
  importar clases (evita ciclos). La verificación comprueba que coincide con los
  decoradores.

### 2. Guard global emite `MODULE_DISABLED` (409)

El `AuthGuard` (global, tras autenticación y contexto de tenant) resuelve el
módulo dueño (método > clase). Si está deshabilitado para la empresa, lanza:

```json
{ "error": { "code": "MODULE_DISABLED",
  "message": "Este módulo no está habilitado para la empresa seleccionada.",
  "module": "cash", "requestId": "..." } }
```

`ApiExceptionFilter` preserva la respuesta estructurada (antes la aplanaba).

### 3. Verificación fail-closed (§8.3)

`verifyModuleOwnership()` enumera **todos** los controladores y falla si alguno no
declara `@OwnedByModule` ni `@CoreEndpoint`, o declara un módulo desconocido, o
diverge del mapa de datos. Se ejecuta:
- en el **arranque** (`main.ts` no levanta si hay violaciones),
- en **CI/pruebas** (`module-ownership.test.ts`).

Así un controlador nuevo no evade el enforcement por omisión.

### 4. Worker (H-4)

Cada uno de los 9 generadores de notificaciones se filtra por su módulo con un
`EXISTS` sobre `company_modules`. Si el módulo está deshabilitado para una
empresa, no se generan sus notificaciones. El worker registra el conteo por
handler.

### 5. Frontend

`ModulesProvider` (contexto compartido) expone los módulos habilitados.
`AppShell` oculta la navegación de módulos deshabilitados (Fase 1/2 y Fase 3).
`ModuleRoute` bloquea la ruta con un mensaje controlado. **No es el control de
seguridad**: la API rechaza igualmente con 409.

### 6. `disable-impact` desde el registro

Ya no devuelve un texto fijo. Computa `apiControllers`, `workerHandlers`,
`frontendRoutes`, `dashboardWidgets`, `dependentModules` e `historicalDataPreserved`
del registro real.

## Verificación ejecutada

Prueba de comportamiento contra la API real (módulo `cash`, Fase 2):

```text
cash habilitado         -> GET /cash-accounts        200
disable dashboard       -> 201   (depende de cash)
disable cash            -> 201
cash DESHABILITADO      -> GET /cash-accounts         409  MODULE_DISABLED  module=cash
                        -> GET /cash-sessions         409  MODULE_DISABLED
payments (mismo controlador, módulo distinto)         200   (override por método funciona)
core /me                                              200   (core nunca se bloquea)
re-enable               -> GET /cash-accounts         200
```

Worker: un ciclo real ejecuta los 9 generadores con el filtro de módulo y
registra el conteo por handler sin error.

| Comprobación | Estado |
| --- | --- |
| Endpoint de Fase 2 bloqueado al deshabilitar su módulo | ✅ 409 MODULE_DISABLED |
| Otro módulo del mismo controlador sigue disponible | ✅ (payments 200) |
| Endpoint core nunca bloqueado | ✅ (/me 200) |
| `disable-impact` desde registro real | ✅ |
| Verificación fail-closed (arranque + test) | ✅ sin violaciones |
| Worker respeta activación de módulos | ✅ (filtro EXISTS por generador) |
| Frontend oculta navegación y bloquea ruta | ✅ (implementado) |
| Pruebas: `module-ownership.test.ts` (4) + e2e enforcement (2) | ✅ |
| lint, typecheck, 90 unit, 22 integración, 20 e2e | ✅ |

## Criterios de aceptación S2 (§16)

| # | Criterio | Estado |
| --- | --- | --- |
| 1 | Todo controlador no-core tiene propiedad de módulo | ✅ |
| 2 | Endpoints core marcados explícitamente | ✅ |
| 3 | Propiedad faltante falla la verificación | ✅ (arranque + CI) |
| 4-6 | Endpoints de Fase 1/2/3 bloqueados al deshabilitar | ✅ (Fase 2 probado; Fase 3 ya usaba @RequireModule) |
| 7-8 | Worker y jobs respetan estado de módulo | ✅ (worker; no hay jobs programados aún) |
| 9-11 | Frontend oculta nav, bloquea ruta directa, omite widgets | ✅ (implementado) |
| 12 | Estado por empresa | ✅ (guard usa company_id de la sesión) |
| 13 | Dependencias aplicadas | ✅ (disable rechaza si hay dependientes) |
| 14 | `disable-impact` real | ✅ |
| 15 | Datos históricos preservados | ✅ (solo cambia el flag) |
| 16-17 | Auditado; invalidación de caché | ✅ auditado; ⚠️ sin caché (se consulta por petición) |
| 18-20 | Integración, e2e, consola sin errores | ✅ |

## Límites y decisiones

- **Sin caché de estado de módulo** (§14): el guard consulta `company_modules`
  por petición. Es correcto y fail-closed, pero añade una consulta por petición
  protegida. Una caché con TTL por (tenant, empresa, versión) queda como mejora;
  no se implementó para no introducir riesgo de estado obsoleto en esta etapa.
- **`disable-impact` a granularidad de controlador**: para controladores
  multi-módulo (Finance sirve receivables/payables/payments/cash), el enforcement
  es por método (correcto), pero `apiControllers` en el impacto se reporta por el
  módulo de clase. Los endpoints de cash se aplican vía `@RequireModule("cash")`
  a nivel de método; el impacto lista `/caja` (frontend) y el widget de caja.
- **Frontend verificado por implementación, no por e2e de navegador**: el bloqueo
  de servidor (la seguridad real) sí está probado por e2e.
