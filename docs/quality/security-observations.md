# Observaciones de seguridad — gestión de residuos

## Controles aplicados

- tenant, empresa y usuario derivados de la sesión;
- permisos en API, además de visibilidad condicional en la interfaz;
- módulo fail-closed mediante el registro de ownership;
- SQL parametrizado y transacciones con contexto RLS;
- RLS habilitado y forzado en las tres tablas;
- creación, avance y excepciones idempotentes;
- `version` y bloqueo de fila para transiciones concurrentes;
- eventos de ciclo sin `UPDATE` o `DELETE` para el rol runtime;
- rechazo de fechas futuras y hora de servidor para eventos;
- cierre interno bloqueado hasta contar con aprobación y evidencia vinculada.

## Riesgos residuales

- no existe todavía segregación de funciones ni reautenticación para cierre,
  razón por la que el cierre permanece inhabilitado;
- no hay vínculo documental tipado para destino final;
- el backdating válido queda registrado en auditoría, pero todavía no tiene un
  permiso específico ni una ventana configurable;
- las tablas base `users` y `companies` no aportan todas las claves compuestas
  de ámbito deseables para FKs; RLS y el servicio protegen el flujo runtime;
- `0012` conserva privilegios predeterminados amplios para tablas futuras; cada
  nueva migración sensible debe revocarlos explícitamente.

No se autoriza despliegue productivo ni afirmación de cumplimiento ambiental con
este módulo. El dictamen independiente está en
`docs/phase3/agent-reports/12-waste-security-review.md`.
