# Gestión operativa de residuos

## Alcance implementado

El módulo `waste-management` agrega una cadena de custodia operativa real al
monolito modular. Incluye:

- registro de generación con origen, descripción, cantidad, unidad, fecha y una
  marca preliminar de posible peligrosidad;
- nueve fases consecutivas desde generación hasta cierre interno;
- libro de registros, filtro por fase, inspector y timeline;
- excepciones con severidad, tipo, acciones y plazo;
- auditoría, outbox, idempotencia, concurrencia optimista y RLS por
  tenant/empresa;
- interfaz adaptable en `/residuos`.

La marca de peligrosidad es una declaración operativa inicial. No constituye
clasificación técnica o legal. El módulo tampoco acredita cumplimiento
ambiental, presentación ante autoridades ni destino final autorizado.

## Límite de cierre

Esta entrega permite avanzar hasta `FINAL_DESTINATION`, pero bloquea
`DOCUMENTARY_CLOSURE` tanto en la API como en la interfaz. Antes de habilitar el
cierre interno se debe implementar:

1. permiso separado y segregación de funciones;
2. aprobación o reautenticación;
3. documento no eliminado, tipado y ligado explícitamente al registro;
4. verificación del actor y trazabilidad de la aprobación;
5. revisión legal de la matriz ambiental aplicable.

No existe una ruta alternativa u oculta para saltar este límite.

## Arquitectura

- Dominio: `packages/domain/src/waste-management.ts`.
- Persistencia: migraciones `0014` y `0015`.
- API: `WasteController` y `WasteService`.
- Web: `apps/web/src/features/waste`.
- Pruebas: dominio, integración de esquema/RLS y E2E autenticado.

El navegador nunca envía `tenant_id` ni `company_id`; ambos se derivan de la
sesión. Las transiciones son consecutivas y usan `version`. Los eventos del
ciclo son append-only para el rol de aplicación.

## Permisos

| Permiso | Uso actual |
| --- | --- |
| `waste.read` | Consultar resumen, registros, detalle y excepciones. |
| `waste.create` | Crear generación. |
| `waste.transition` | Avanzar fases ordinarias hasta destino final. |
| `waste.exceptions.manage` | Registrar excepciones. |
| `waste.export` | Reservado; no hay control de exportación en esta entrega. |

El cierre no reutiliza `waste.transition`: permanece bloqueado hasta disponer de
un permiso y caso de uso separados.

## Entorno local

No se agregaron variables de entorno. Se usan las mismas conexiones, sesión y
almacenamiento documental del ERP.

En la configuración local verificada el 27 de julio de 2026:

- web: `http://localhost:5273/residuos`;
- API: `http://localhost:3100/api/v1/waste`;
- salud: `http://localhost:3100/api/v1/health`.

Las credenciales permanecen en `.env` y archivos locales ignorados. No deben
copiarse a documentación, cliente, logs ni artefactos.

## Migración y reversión

Aplicar:

```text
pnpm db:migrate
pnpm db:seed
```

`0014` crea las tres tablas y sus políticas RLS. `0015` reduce privilegios del
rol runtime. Para revertir, use el runner normal una migración por vez y
verifique antes que no existan registros que deban conservarse. La reversión de
`0014` elimina datos del módulo y requiere una decisión operativa explícita; no
se ejecuta como parte de un arranque normal.

## Próxima fase recomendada

- catálogos técnicos versionados y asignación de responsable;
- ubicaciones/contenedores y transferencias físicas;
- relación documental específica por evento;
- aprobación segregada de destino y cierre;
- resolución y verificación de excepciones;
- reportes/exportación respaldados por consultas reales;
- pruebas por rol y revisión legal con fuentes oficiales aplicables.
