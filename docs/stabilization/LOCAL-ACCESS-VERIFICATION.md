# Verificación de acceso local

- **Fecha:** 2026-07-24
- **Método:** arranque real + comprobación HTTP y de navegador + login por endpoint

## Perfiles de arranque soportados

| Perfil | Comando | Notas |
| --- | --- | --- |
| Desarrollo nativo | `pnpm docker:up` (infra) + `pnpm dev` (api/web/worker) | El usado en esta verificación |
| Docker completo | `docker compose up` | web en `:8080`, api en `:3100` (según compose) |
| Demo | paquete portable en `dist/demo/` | `DEMO_MODE=false` por defecto |
| Preview de build | `pnpm build` + preview de Vite | No es un modo de servicio permanente |

## Puerto 5273 — resuelto

**`5273` es el puerto oficial de desarrollo del frontend (Opción A).** Confirmado
por consistencia de configuración:

- `apps/web/vite.config.ts` → `server.port: 5273`
- `.env` → `APP_URL=http://localhost:5273`
- CORS de la API → `origin: config.APP_URL` (5273)

No existe otro puerto de frontend no documentado. El síntoma previo («no carga»)
era simplemente que el dev server no estaba corriendo.

## URLs verificadas por comportamiento

| Servicio | URL | Proceso | Auth | Estado | Verificación |
| --- | --- | --- | --- | --- | --- |
| Web | http://localhost:5273/ | web | Login ERP | PASS (200, login renderiza) | navegador |
| API | http://localhost:3100/api/v1 | api | sesión cookie | PASS | HTTP |
| Salud | http://localhost:3100/api/v1/health | api | ninguna | PASS (200 `{"status":"ok"}`) | HTTP |
| Readiness | http://localhost:3100/api/v1/health/readiness | api | ninguna | PASS (200 `{"status":"ready","database":"available"}`) | HTTP |
| OpenAPI | http://localhost:3100/api/docs | api | configurada | PASS (200) | navegador |
| Almacenamiento (MinIO) | http://localhost:9001/ | storage | cuenta local | PASS (200) | HTTP |
| Correo (Mailpit) | http://localhost:8025/ | mail | solo local | PASS (200) | HTTP |
| Documentación | — | — | — | `NOT_IMPLEMENTED` | centro de documentación no existe |
| Demo | — | — | — | `NOT_STARTED` | `DEMO_MODE=false` |

## Verificación de cuentas (por el endpoint real de login)

| Cuenta | Rol | Resultado | Evidencia |
| --- | --- | --- | --- |
| `admin@erp-express.test` | company-admin | ✅ login 201 | endpoint |
| usuario creado (read-only) | read-only | ✅ login 201 (con `forcePasswordChange`) | creado vía API, login verificado |
| ese usuario tras desactivarlo | read-only (inactivo) | ✅ login **401** (bloqueado) | endpoint |

- La semilla estándar crea **solo el administrador**. El usuario de solo lectura
  se creó a través de la API (existe realmente; no es inventado) para verificar
  los criterios de acceso no-admin y de usuario deshabilitado. `pnpm db:reset`
  lo elimina y deja de nuevo solo al admin.
- No se extrajo ninguna contraseña de un hash. La contraseña temporal del usuario
  creado la devolvió el propio endpoint de creación.

## Criterios de aceptación (§5.7)

| Criterio | Estado |
| --- | --- |
| La URL web principal abre | ✅ |
| La pantalla de login renderiza | ✅ |
| La salud de la API responde | ✅ |
| Los puertos reales están listados | ✅ |
| Se corrigen supuestos de puerto incorrectos | ✅ (5273 confirmado oficial) |
| Login de administrador verificado | ✅ 201 |
| Login de no-administrador verificado | ✅ 201 |
| Usuario deshabilitado no puede entrar | ✅ 401 |
| Archivo de credenciales ignorado por Git | ✅ (`git check-ignore`) |
| Sin errores críticos inexplicados en consola | ✅ (verificado en sesión previa) |
| La guía sobrevive a un reinicio limpio | ✅ (arranque desde cero verificado en S0) |
