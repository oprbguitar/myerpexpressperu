# Informe coordinado — producto, diseño y frontend de residuos

**Fecha:** 2026-07-27
**Rama:** `codex/waste-operations-redesign`
**Alcance:** demo interna de seguimiento operativo

## Resultado

La auditoría confirmó que el ERP no tenía dominio de residuos. Se evitó un
reskin ficticio y se implementó un vertical slice real:

- dominio y transiciones;
- persistencia con RLS;
- API protegida;
- interfaz `/residuos`;
- registro, cola, rail, libro, inspector, timeline y excepciones;
- pruebas unitarias, integración y E2E.

La dirección elegida fue A, `Cadena de custodia operativa`, con 74/80. Se
conservaron la identidad, React Query, Lucide y los componentes del ERP; no se
añadieron dependencias.

## Decisiones de confianza

- peligrosidad se presenta como marca preliminar;
- no se inventan operadores, autorizaciones, responsables, documentos, métricas
  ni base legal;
- el cierre interno está bloqueado;
- los nombres genéricos ficticios del shell se sustituyeron por contexto
  derivado de sesión;
- filtros, búsqueda, exportación y paginación solo se muestran cuando existe
  comportamiento real.

## Evidencia

- conceptos: `docs/design-system/concepts/`;
- auditoría: `docs/design-audit/`;
- dirección y tokens: `docs/design-system/`;
- capturas finales: `docs/design/waste-operations-final-*.png`;
- QA: `docs/quality/`;
- guía del módulo: `docs/WASTE-MANAGEMENT.md`.

## Límites

No aprobado para producción, cierre regulatorio o cumplimiento ambiental. Falta
catálogo técnico, responsables por rol, ubicaciones/contenedores, evidencia
documental por evento, resolución de excepciones, aprobación segregada y
revisión legal basada en fuentes oficiales aplicables a cada empresa.
