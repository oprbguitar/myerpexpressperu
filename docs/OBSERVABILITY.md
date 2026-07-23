# Observabilidad

`GET /api/v1/observability/health` entrega salud acotada a la empresa: base de
datos, último estado seguro de proveedores, eventos de seguridad de 24 horas y
trabajos pendientes. Requiere permiso administrativo y módulo habilitado.

Los logs usan identificadores de solicitud y mensajes seguros; no deben contener
contraseñas, tokens, claves, documentos personales ni contenido de prompts. Los
eventos de seguridad y auditoría se almacenan separados de los datos operativos.
