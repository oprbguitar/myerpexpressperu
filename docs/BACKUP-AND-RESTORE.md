# Respaldo y restauración de PostgreSQL

## Alcance

Este runbook cubre PostgreSQL 17 para ERP Express Perú. Un respaldo no se
considera válido hasta restaurarlo en otra base y ejecutar verificaciones de
esquema, ámbito y aplicación. El almacenamiento de objetos (`documents`) se
respalda por separado y debe conservar correspondencia con `storage_key`.

## Preparación

1. Confirme la versión de PostgreSQL y espacio disponible.
2. Registre el nombre lógico de entorno, hora de corte y versión desplegada.
3. Use una cuenta de backup de solo lectura con acceso a las tablas necesarias.
4. No incluya `.env`, claves de cifrado ni secretos de proveedores en el
   artefacto o en su nombre.
5. Para restauración consistente con objetos, coordine una ventana o snapshot
   consistente entre PostgreSQL y el almacenamiento.

## Respaldo lógico

```bash
pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --file=erp-express-YYYYMMDD-HHMM.dump
```

Calcule un SHA-256 fuera de la base y almacene dump, checksum, manifiesto de
versión y registro de ejecución en un repositorio cifrado con acceso limitado.
Pruebe periódicamente la lectura del artefacto con `pg_restore --list`.

## Restauración

Cree una base vacía; nunca restaure sobre producción para una prueba:

```bash
createdb "$RESTORE_DATABASE_NAME"
pg_restore \
  --dbname="$RESTORE_DATABASE_URL" \
  --no-owner \
  --exit-on-error \
  erp-express-YYYYMMDD-HHMM.dump
```

Después de restaurar:

```sql
select version from schema_migrations order by version;
select count(*) from information_schema.tables where table_schema='public';
select count(*) from pg_policies where schemaname='public';
select count(*) from audit_integrity_checkpoints;
```

También se debe:

- ejecutar `pnpm test:integration` apuntando solo a la base restaurada;
- verificar que la cuenta de runtime no sea propietaria ni tenga `BYPASSRLS`;
- probar aislamiento entre dos empresas con `SET LOCAL app.tenant_id` y
  `SET LOCAL app.company_id`;
- comprobar referencias de documentos contra el backup de objetos;
- validar que secretos cifrados puedan resolverse con el gestor de secretos del
  entorno restaurado, sin imprimirlos;
- ejecutar un smoke test con proveedores externos deshabilitados.

## Recuperación puntual

`pg_dump` no ofrece recuperación a un instante. Para RPO/RTO que requiera PITR,
configure backup físico y archivo continuo de WAL en la plataforma elegida,
pruebe la restauración y documente retención. Esta capacidad no queda activada
por el repositorio.

## Rotación y eliminación

La política de retención debe contemplar backups antes de eliminar datos de la
base principal. Una eliminación lógica no borra automáticamente copias previas.
Al vencer el backup, elimínelo de forma verificable salvo que exista `legal_hold`;
registre la acción sin exponer datos personales.

## Evidencia de prueba local — 2026-07-23

Se ejecutó sobre una base temporal:

- migración limpia `0001` a `0010`;
- rollback de `0010`, `0009`, `0008` y `0007`, seguido de reaplicación;
- `pg_dump -Fc` y `pg_restore --no-owner --exit-on-error`;
- una restauración con dataset representativo verificó 207 tablas públicas, 10
  migraciones y 5.002 leads sintéticos;
- la repetición estructural final verificó 207 tablas, 10 migraciones y 187
  políticas RLS;
- eliminación posterior de la base restaurada y del dump temporal.

Esto valida el procedimiento local, no constituye evidencia de backup
productivo ni de los RPO/RTO de un proveedor.
