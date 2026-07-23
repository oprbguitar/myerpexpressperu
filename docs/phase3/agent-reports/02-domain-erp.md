# Informe del Agente 2 — Domain and ERP

Fecha de ejecución: 2026-07-23.

## Alcance

Se añadieron modelos de dominio puros bajo `packages/domain/src/phase3` para:

- CRM: leads, oportunidades, pipelines, decisiones finales y eventos de etapa.
- Proyectos: estados, progreso ponderado, presupuestos y cambios de alcance.
- Tiempo y gastos: aprobación, autoaprobación y reversión.
- Recursos humanos: ciclo de vida, versiones contractuales, salida y campos
  restringidos.
- SST: riesgo, acciones correctivas, incidentes y frontera de detalle médico.
- Activos y mantenimiento: transferencias, retiro, medidores y cierre con
  evidencia.

No se modificaron migraciones, API, frontend ni `packages/domain/src/index.ts`.
El archivo `packages/domain/src/phase3/index.ts` está listo para que el
coordinador raíz lo exporte.

## Decisiones e invariantes

- Las decisiones consecuenciales de CRM sólo pueden provenir de usuario.
- Ganar exige cliente o conversión; perder exige motivo.
- El avance de proyecto se deriva de componentes ponderados.
- Presupuesto y contrato son secuencias versionadas.
- Gasto y cambio de alcance separan solicitante y aprobador.
- Tiempo aprobado requiere reversión para editarse.
- Los cierres de proyecto, SST y mantenimiento requieren evidencia.
- El detalle médico queda fuera del modelo general y exige permiso, auditoría,
  propósito y autorización independiente para IA.
- Los historiales de empleado y asignación se producen como nuevos valores y no
  se eliminan.

## Pruebas ejecutadas

```text
pnpm --filter @erp/domain test
Resultado: 7 archivos aprobados, 41 pruebas aprobadas.

pnpm --filter @erp/domain typecheck
Resultado: aprobado, sin errores.

pnpm exec eslint packages/domain/src/phase3 --max-warnings=0
Resultado: aprobado, sin advertencias.
```

Las 24 pruebas nuevas cubren transiciones CRM, conversión, progreso, versiones,
aprobaciones, ciclo de empleado, cierre SST, restricciones médicas,
transferencias y mantenimiento.

## Riesgos y trabajo de integración

- El coordinador debe exportar `./phase3/index.js` desde el índice principal.
- Persistencia, autorización contextual, auditoría duradera y transacciones
  pertenecen a los agentes de base de datos, seguridad y aplicación.
- La vista médica resumida no sustituye un repositorio restringido para detalle
  clínico.
- Los eventos incorporan `Date` de ejecución; persistencia debe asignar una
  fuente temporal consistente si el caso de uso necesita determinismo externo.
