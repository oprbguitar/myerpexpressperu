# Despliegue

La referencia local usa Docker Compose. Para producción construya imágenes inmutables, ejecute migraciones como tarea previa, mantenga API/worker en red privada y sirva web y API bajo TLS. PostgreSQL puede migrar a cualquier proveedor compatible; MinIO se reemplaza por S3 mediante el mismo contrato.

No publique `.env`. Configure secretos en el gestor del proveedor. Pruebe restauración, readiness, cookies seguras, CORS, límites de carga y copias de seguridad antes de exponer usuarios reales. Esta entrega no está desplegada en un proveedor remoto.
