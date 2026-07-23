# Seguridad

- Sesiones opacas rotables en cookie HTTP-only, `SameSite=Lax`; nunca `localStorage`.
- Contraseñas Argon2id; el hash jamás sale de la API.
- Bloqueo temporal tras intentos fallidos y registro de cada intento.
- Contexto de tenant/empresa derivado de la sesión; nunca se acepta desde el navegador.
- Guard global y permisos por endpoint. RLS en PostgreSQL agrega defensa en profundidad.
- Auditoría append-only y redacción de claves sensibles.
- Documentos privados en almacenamiento S3, con descarga autorizada temporal.
- Secretos únicamente en `.env` ignorado; `pnpm check:secrets` inspecciona el árbol.

En producción active `COOKIE_SECURE=true`, TLS, secretos aleatorios, rotación y una cuenta PostgreSQL sin privilegios de propietario. La API debe ejecutar `SET LOCAL app.tenant_id` y `app.company_id` dentro de cada transacción al adoptar un rol PostgreSQL sujeto a RLS.
