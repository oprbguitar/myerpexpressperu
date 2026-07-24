# Guía de acceso local

Solo servicios **verificados por comportamiento** el 2026-07-24. Sin contraseñas;
las credenciales locales están en el archivo gitignored
`LOCAL-ACCESS-CREDENTIALS.local.md`. Evidencia:
[`docs/stabilization/LOCAL-ACCESS-VERIFICATION.md`](../stabilization/LOCAL-ACCESS-VERIFICATION.md).

## 1. Prerrequisitos

Node 24, pnpm 10.31.0, Docker Desktop. `pnpm install` una vez.

## 2. Arranque nativo (recomendado en desarrollo)

```bash
pnpm docker:up      # PostgreSQL, MinIO, Mailpit
pnpm db:migrate     # aplica migraciones con el rol de migración (crea erp_app)
pnpm db:seed        # crea el administrador local
pnpm dev            # api (3100), web (5273), worker
```

## 3. Arranque con Docker completo

```bash
docker compose up
```

Web en `:8080`, API en `:3100` (según `docker-compose.yml`).

## 4. URLs verificadas

| Servicio | URL verificada | Proceso | Autenticación | Estado | Verificación |
| --- | --- | --- | --- | --- | --- |
| Web | http://localhost:5273/ | web | Login ERP | PASS | navegador |
| API | http://localhost:3100/api/v1 | api | sesión cookie | PASS | HTTP |
| Salud | http://localhost:3100/api/v1/health | api | ninguna | PASS | HTTP |
| Readiness | http://localhost:3100/api/v1/health/readiness | api | ninguna | PASS | HTTP |
| OpenAPI | http://localhost:3100/api/docs | api | configurada | PASS | navegador |
| Almacenamiento | http://localhost:9001/ | storage | cuenta local | PASS | HTTP |
| Correo | http://localhost:8025/ | mail | solo local | PASS | HTTP |
| Documentación | — | docs | — | `NOT_IMPLEMENTED` | — |
| Demo | — | demo | — | `NOT_STARTED` | — |

Infraestructura adicional: PostgreSQL `5432`, API MinIO `9000`, SMTP Mailpit `1025`.

**`5273` es el puerto oficial del frontend.** Si «no carga», casi siempre es que
el dev server no está corriendo (`pnpm dev`).

## 5. Roles de usuario local

La semilla estándar crea **solo el administrador** (`company-admin`). Los roles
disponibles en la semilla: platform-super-admin, company-admin, supervisor,
operator, auditor, read-only. Para probar un usuario no-admin, créelo desde la
interfaz de administración o la API; `pnpm db:reset` vuelve a dejar solo el admin.

## 6. Procedimiento de login

Abra http://localhost:5273/, ingrese el correo y la contraseña del admin (ver
archivo de credenciales local). El primer acceso exige cambio de contraseña.

## 7. Detener y reiniciar

```bash
# Ctrl+C en la terminal de pnpm dev
pnpm docker:down     # detiene la infraestructura
```

## 8. Reiniciar datos locales

```bash
pnpm db:reset        # revierte, reaplica migraciones y vuelve a sembrar
```

## 9. Ver logs

```bash
pnpm docker:logs     # infraestructura
```

API/web/worker: en la terminal de `pnpm dev`.

## 10. Comprobaciones de salud

```bash
curl http://localhost:3100/api/v1/health
curl http://localhost:3100/api/v1/health/readiness
```

## 11. Errores comunes

| Síntoma | Causa | Solución |
| --- | --- | --- |
| `localhost:5273` no carga | Dev server no arrancado | `pnpm dev` |
| Login 401 | Contraseña incorrecta o base sin sembrar | `pnpm db:seed` / `pnpm db:reset` |
| API responde HTML en vez de JSON | Service worker obsoleto | ver §13 |
| `ECONNREFUSED :5432` | Infraestructura caída | `pnpm docker:up` |
| Puerto 3100/5273 ocupado | Proceso previo vivo | terminarlo |

## 12. Acceso desde otro dispositivo de la LAN

El dev server escucha en `0.0.0.0`; accesible en `http://<IP-de-la-máquina>:5273/`
(Vite muestra la IP al arrancar). No exponer a Internet.

## 13. Reinicio de caché PWA

DevTools → Application → Service Workers → Unregister; luego Storage → Clear site
data. O en consola:

```js
navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
```

## 14. Advertencias de seguridad

- Las credenciales locales son **solo de desarrollo**; nunca de producción.
- El archivo de credenciales está en `.gitignore` (`*.local.md`). Nunca se
  commitea.
- La API usa el rol restringido `erp_app`; no ejecute el runtime como superusuario.

## Variables de credenciales (valores fuera de este archivo)

`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD` (en `.env`, gitignored). Resumen en
`LOCAL-ACCESS-CREDENTIALS.local.md`.
