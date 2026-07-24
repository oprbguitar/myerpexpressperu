# S2 — Matriz de pruebas de enforcement

Fecha: 2026-07-24.

## Automatizadas

| Prueba | Tipo | Verifica |
| --- | --- | --- |
| `apps/api/src/module-ownership.test.ts` (4) | unit | fail-closed: verifyModuleOwnership() sin violaciones; mapas solo referencian módulos registrados |
| `tests/e2e/module-enforcement.spec.ts` (2) | e2e | cash deshabilitado → 409 MODULE_DISABLED; payments (mismo controlador) 200; core /me 200; disable-impact real |

## Verificado por comportamiento (ejecución manual registrada)

| Escenario | Resultado |
| --- | --- |
| API: módulo habilitado → endpoint 200 | ✅ |
| API: módulo deshabilitado → 409 MODULE_DISABLED con `module` | ✅ (cash) |
| API: otro módulo del mismo controlador sigue 200 | ✅ (payments) |
| API: core nunca bloqueado | ✅ (/me) |
| API: dependencia aplicada (no se puede deshabilitar con dependientes) | ✅ (dashboard→cash) |
| Worker: ciclo con filtro de módulo por generador | ✅ (9 handlers, conteo registrado) |
| Arranque: fail-closed si falta propiedad | ✅ (verifyModuleOwnership en main.ts) |

## Cobertura de módulos del §13 de la instrucción

Probados directamente: cash (Fase 2), payments (contraste). Fase 3 (crm,
projects, human-resources, sst/occupational-safety, assets, ai, ocr, maps) ya
usaban `@RequireModule` a nivel de método antes de S2 y siguen aplicándose por
el mismo guard. dashboard, sales, inventory, documents tienen propiedad de
módulo declarada y se aplican por el mismo mecanismo verificado con cash.

Límite: no se ejecutó una matriz e2e por cada módulo listado; se verificó el
mecanismo con un módulo de Fase 2 representativo y la verificación fail-closed
garantiza que todos están cubiertos por el guard.
