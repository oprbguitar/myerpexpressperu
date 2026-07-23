# Conservación, eliminación y legal hold

## Regla central

No existe un plazo universal codificado. Cada política se versiona por tenant,
empresa, categoría, finalidad, jurisdicción y tipo documental tras validación
legal/tributaria. Un cambio de política no elimina registros de forma inmediata.

## Flujo seguro

1. Calcular una **vista previa** reproducible con fecha de corte.
2. Separar registros elegibles, protegidos e inválidos.
3. Excluir legal holds y fechas explícitas de conservación vigentes.
4. Revisar dependencias, evidencias, obligaciones fiscales/SST y solicitudes en
   curso.
5. Exigir reautenticación, MFA y aprobación independiente para aprobar la
   ejecución.
6. Ejecutar un job idempotente, acotado por tenant/empresa, con límite de lote.
7. Verificar borrado/anonimización en base, objetos, índices, cachés y réplicas
   según el diseño aprobado.
8. Registrar conteos, política/versión y errores sin copiar el contenido.

La función `previewRetention` en `packages/security/src/phase3/retention.ts`
realiza únicamente los pasos 1–3; no contiene operación destructiva.

## Legal hold

Un hold identifica alcance, motivo, autoridad solicitante, responsable,
instante, estado y criterio de liberación. Su creación, modificación y
liberación son acciones críticas con historial inmutable y aprobación
independiente. El hold prevalece sobre la política ordinaria hasta su liberación
válida.

## Categorías que requieren política diferenciada

- identidad, acceso, sesiones y eventos de seguridad;
- CRM, postulantes, trabajadores y ex trabajadores;
- salud ocupacional y SST;
- documentos comerciales, XML/CDR y evidencia tributaria;
- contratos, firma/aceptación y auditoría;
- originales OCR, extracciones y correcciones;
- prompts, respuestas y telemetría AI;
- backups, objetos, correos y archivos temporales.

Las duraciones concretas quedan **sin fijar** hasta validar el perfil del cliente,
la finalidad y la norma aplicable. La evaluación de impacto de IA de alto riesgo,
cuando corresponda, también requiere revisar el periodo normativo indicado en la
matriz legal.

## Verificaciones negativas

- Un registro bajo hold nunca aparece como elegible.
- Una fecha explícita futura protege el registro.
- Fechas inválidas o futuras no se procesan.
- El job no acepta tenant/empresa desde el navegador.
- Preview, aprobación y ejecución no se confunden en una sola operación.
- Fallo parcial se reanuda idempotentemente y no amplía el alcance.
