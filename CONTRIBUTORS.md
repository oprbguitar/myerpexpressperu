# Contribuyentes — ERP Express Perú

Registro de quienes han aportado código, documentación, revisión o pruebas.
Ser contribuyente no implica por sí mismo titularidad de derechos de autor;
la titularidad se trata en [`AUTHORS.md`](AUTHORS.md) y en
[`docs/legal/OWNERSHIP.yml`](docs/legal/OWNERSHIP.yml).

## Estado

El repositorio se puso bajo control de versiones al inicio de la Fase 4
(commit `4df34c4`). El historial anterior a ese punto no existe en Git, por lo
que **la autoría de las Fases 1 a 3 no puede derivarse automáticamente del
historial**. Debe ser declarada por el propietario del proyecto.

No se inscribe aquí a ninguna persona sin evidencia. En particular, no se
registra a nadie como revisor a partir de suposiciones.

## Contribuyentes

| Persona | Aportes | Periodo |
| --- | --- | --- |
| _(pendiente de declaración)_ | — | — |

## Revisores

La política de Fase 4 exige que todo cambio asistido por IA sea revisado por
una persona antes de considerarse aceptado. Los revisores se registran en cada
archivo de `docs/compliance/ai-provenance/`.

| Revisor | Registros revisados | Fecha |
| --- | --- | --- |
| _(ninguno — sin revisión humana registrada)_ | — | — |

## Herramientas asistidas por IA

| Herramienta | Uso | Registro |
| --- | --- | --- |
| Claude Opus 4.8 (Claude Code) | Línea base de Fase 4, andamiaje de licenciamiento y procedencia | [`AIP-2026-0001`](docs/compliance/ai-provenance/AIP-2026-0001.yml) |

Estas herramientas actúan como instrumentos bajo dirección humana. No son
contribuyentes en sentido legal ni titulares de derechos.

## Cómo contribuir

Antes de enviar cambios, revise [`AGENTS.md`](AGENTS.md) y ejecute la suite
obligatoria descrita allí. Todo archivo fuente original nuevo debe llevar
encabezado SPDX; verifíquelo con `pnpm license:headers`.
