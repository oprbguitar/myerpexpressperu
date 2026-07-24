# S3 — Pruebas de integración fiables y CI

- **Fecha:** 2026-07-24
- **Hallazgos corregidos:** C-4 (integración que se autodesactiva), H-7 (sin CI), H-6 (cobertura inmedible)

## C-4 — Fallo en cerrado

**Antes:** `pnpm test:integration` salía **0 con las 17 pruebas omitidas** si
faltaba `DATABASE_URL`. En cualquier CI sin esa variable, reportaba éxito sin
verificar nada.

**Ahora:** `test:integration` ejecuta `scripts/test/run-integration.mjs`, que:

| Condición | Comportamiento |
| --- | --- |
| Falta `DATABASE_URL` | **FALLA** (exit 1) con mensaje claro |
| Falta `DATABASE_URL` + `ALLOW_INTEGRATION_TEST_SKIP=true` | Omite (exit 0), solo desarrollo local |
| `CI=true` + `ALLOW_INTEGRATION_TEST_SKIP=true` | **FALLA** (exit 1): la omisión está prohibida en CI |
| Base presente | Ejecuta y aplica la guarda de conteo |

### Guarda de conteo de ejecución (§10.2)

Tras ejecutar vitest con reporte JSON, verifica:

- Al menos una suite corrió.
- Al menos 15 pruebas corrieron (hoy son 22).
- **Cero pruebas omitidas cuando hay base** — ninguna suite crítica puede
  omitirse en silencio.

Falla si no se cumplen.

### Verificación ejecutada

```text
1) base presente           -> 22 pasadas, 0 omitidas, exit 0
2) sin DATABASE_URL         -> exit 1 (mensaje claro)
3) skip explícito local     -> exit 0 (aviso)
4) CI + skip                -> exit 1 (prohibido)
```

## H-7 — Integración continua

**Antes:** no existía `.github/`. Los scripts de verificación eran manuales y
opcionales, por lo que cualquier corrección era reversible en silencio.

**Ahora:** `.github/workflows/ci.yml` con seis trabajos:

| Trabajo | Contenido |
| --- | --- |
| `static-analysis` | `pnpm lint`, `pnpm typecheck` |
| `unit-tests` | `pnpm test` |
| `compliance` | `test:compliance`, `license:headers`, `license:scan`, `provenance:verify` |
| `build` | `pnpm build` |
| `integration-tests` | Levanta PostgreSQL 17, aplica migraciones con el rol de migración (que crea `erp_app`), siembra, y ejecuta la integración **con el rol de aplicación real** (S1). `CI=true` impide omitir. |

Usa `pnpm install --frozen-lockfile` y dependencias bloqueadas.

Nota: el trabajo de E2E no se incluye aún (requiere levantar API + web +
Playwright en CI, con navegadores); queda como ampliación. Se documenta la
ausencia en lugar de simularla.

## H-6 — Cobertura medible

**Antes:** ninguna herramienta de cobertura instalada; la cobertura era
inmedible.

**Ahora:** `@vitest/coverage-v8` (MIT) añadido. Línea base **medida** en
`COVERAGE-BASELINE.md`:

| Paquete | Sentencias |
| --- | --- |
| `packages/domain` | 79.76% |
| `packages/security` | 81.46% |
| `apps/api` | 11.03% |

No se fija umbral global todavía (§10.4): fijar un mínimo alto antes de escribir
las pruebas de la superficie expuesta solo rompería CI. El 11% de `apps/api`
confirma H-3 y marca el trabajo siguiente.

## Criterios de aceptación S3 (§10.6)

| Criterio | Estado |
| --- | --- |
| La integración falla sin base | ✅ |
| Existe CI que levanta PostgreSQL | ✅ |
| Las pruebas críticas no pueden omitirse en silencio | ✅ (guarda de conteo + CI prohíbe skip) |
| La cobertura es medible | ✅ (baseline real) |
| Las 6 e2e omitidas se ejecutan o se justifican | ⏳ justificadas en la revisión previa; e2e en CI pendiente |
| Estado de CI documentado | ✅ (este documento) |

## Límites

- El pipeline de CI está definido pero **no se ha ejecutado en GitHub Actions**
  desde esta sesión (no hay remoto configurado ni push autorizado). Su validez
  real se confirmará en el primer push. Localmente se verificó la lógica de
  fallo en cerrado y que todos los comandos que invoca pasan.
- E2E no está en CI todavía.
- Sin umbral de cobertura obligatorio aún.
