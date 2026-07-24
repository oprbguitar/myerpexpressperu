# Línea base de cobertura

- **Fecha:** 2026-07-24
- **Herramienta:** `@vitest/coverage-v8@3.2.4` (MIT), añadida en S3
- **Naturaleza:** línea base **medida**, no un umbral inventado (§10.4)

Antes de S3 no existía ninguna herramienta de cobertura: la cobertura no era baja,
era **inmedible** (hallazgo H-6). Estos son los primeros números reales.

## Cobertura medida por paquete

| Paquete | Sentencias | Ramas | Funciones | Líneas | Pruebas |
| --- | --- | --- | --- | --- | --- |
| `packages/domain` | 79.76% (1025/1285) | 68.91% (204/296) | 66.3% (61/92) | 79.76% | 41 |
| `packages/security` | 81.46% (233/286) | 69.81% (74/106) | 100% (20/20) | 81.46% | 17 |
| `apps/api` | **11.03% (740/6704)** | 69.45% (166/239) | 74.83% (113/151) | **11.03%** | 12 |

Paquetes no medidos aquí (cobertura efectiva baja o nula, sin pruebas propias
significativas): `apps/web`, `apps/worker`, `packages/contracts`,
`packages/database`. Se medirán al conectarles pruebas.

## Lectura honesta

- **Lo bien cubierto es la lógica de dominio pura** (`domain`, `security`): ~80%
  de sentencias, con aserciones reales sobre IGV, transiciones, topes de pago,
  clasificación de datos y denegaciones.
- **Lo mal cubierto es la superficie expuesta** (`apps/api`, 11%): confirma el
  hallazgo H-3. `auth.guard.ts`, `auth.service.ts`, `storage.service.ts`,
  `csv.ts` y la mayoría de servicios de Fase 1/2 no tienen pruebas directas. La
  cobertura de ramas (69%) es engañosamente alta porque solo cuenta el código
  que sí se ejecuta (los servicios de Fase 3).

## Umbrales

**No se fija todavía un umbral global**, conforme a §10.4 (no inventar un mínimo
arbitrario alto). La línea base anterior es el punto de partida.

Umbrales obligatorios recomendados para el código crítico de seguridad, a
establecer cuando existan sus pruebas (siguientes iteraciones de S3):

```text
auth.service.ts        auth.guard.ts
tenant-context (RLS)   module guard (S2)
database.service.ts    storage authorization
payment reversal       inventory confirmation
migration checksum (S5)
```

Hoy varias de estas rutas están a 0% de cobertura directa. Fijar un umbral antes
de escribir las pruebas solo rompería CI sin aportar señal.

## Cómo reproducir

```bash
cd packages/domain && node ../../node_modules/vitest/vitest.mjs run --coverage --coverage.provider=v8 --coverage.reporter=text-summary
```

(equivalente en `packages/security` y `apps/api`).

## Pendiente

- Configuración de cobertura unificada del workspace (no existe `vitest.config`
  raíz; cada paquete corre su propio vitest).
- Pruebas HTTP de autorización (401/403 por sesión ausente, tenant/empresa
  incorrectos, permiso insuficiente) contra `auth.guard.ts`.
- Umbrales por archivo crítico una vez cubiertos.
