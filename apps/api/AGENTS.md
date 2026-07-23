# Alcance API

- Rutas nuevas bajo `/api/v1`, con guard global, permiso granular, request ID y errores estructurados.
- Usar `DatabaseService.scopedTransaction` para datos tenant/company.
- Validar payloads, tamaños, MIME y nombres; parametrizar todo SQL.
- Redactar secretos y datos restringidos en respuestas y logs.
- Mantener controladores delgados y lógica de estado en dominio/servicios.
