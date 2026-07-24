# Guía de acceso local

Solo lista servicios locales **verificados** el 2026-07-23 con la infraestructura
levantada. No contiene contraseñas; para credenciales locales ver el archivo
gitignored `LOCAL-ACCESS-CREDENTIALS.local.md` en la raíz.

## Servicios

| Servicio | URL verificada | Propósito | Estado |
| --- | --- | --- | --- |
| Aplicación web | http://localhost:5273/ | Interfaz principal | En ejecución cuando se lanza el dev server |
| API | http://localhost:3100/api/v1 | API REST | En ejecución |
| Salud API | http://localhost:3100/api/v1/health | Comprobación de salud | PASS (200) |
| Readiness API | http://localhost:3100/api/v1/health/readiness | Preparación de dependencias | PASS (200) |
| OpenAPI/Swagger | http://localhost:3100/api/docs | Documentación de la API | Disponible (200) |
| Consola de almacenamiento (MinIO) | http://localhost:9001/ | Archivos locales | Disponible (200) |
| Correo de pruebas (Mailpit) | http://localhost:8025/ | Inspección de correo local | Disponible (200) |
| Documentación | — | Manuales internos | No disponible: el centro de documentación (Fase 4 §24) no existe |
| Demo | — | Entrada demo | No disponible: `DEMO_MODE=false`; el demo se empaqueta aparte (`dist/demo/`) |

Puertos de infraestructura adicionales: PostgreSQL `5432`, API de MinIO `9000`,
SMTP de Mailpit `1025`.

## Iniciar el sistema

1. Levantar la infraestructura (PostgreSQL, MinIO, Mailpit):

```bash
pnpm docker:up
```

2. Aplicar migraciones y sembrar datos locales (solo la primera vez o tras reset):

```bash
pnpm db:migrate
pnpm db:seed
```

3. Arrancar API, web y worker en paralelo:

```bash
pnpm dev
```

La web queda en http://localhost:5273/ y la API en http://localhost:3100/api/v1.

> **Nota importante.** El síntoma «`localhost:5273` no muestra la aplicación» casi
> siempre significa que **el dev server web no está corriendo**. Verifíquelo antes
> de buscar otra causa (ver `docs/stabilization/LOCALHOST-DIAGNOSIS.md`).

## Detener el sistema

```bash
pnpm docker:down          # detiene la infraestructura
```

Los procesos de `pnpm dev` se detienen con Ctrl+C en su terminal.

## Ver logs

```bash
pnpm docker:logs          # logs de la infraestructura
```

Los logs de API/web/worker aparecen en la terminal de `pnpm dev`.

## Reiniciar datos locales

```bash
pnpm db:reset             # revierte, reaplica migraciones y vuelve a sembrar
```

Destruye los datos locales y recrea el administrador sembrado. Nunca ejecutar
contra datos valiosos.

## Comprobar salud

```bash
curl http://localhost:3100/api/v1/health
curl http://localhost:3100/api/v1/health/readiness
```

## Abrir desde otro dispositivo de la LAN

El dev server escucha en `0.0.0.0`, por lo que es accesible desde la red local en
`http://<IP-de-la-máquina>:5273/` (Vite muestra la IP al arrancar). No exponga el
dev server a Internet.

## Variables de credenciales (valores en el archivo local, no aquí)

| Variable | Uso |
| --- | --- |
| `SEED_ADMIN_EMAIL` | Correo del administrador sembrado |
| `SEED_ADMIN_PASSWORD` | Contraseña del administrador sembrado (solo local) |
| `DEMO_ADMIN_EMAIL` | Admin del paquete demo (cuando aplica) |
| `DEMO_ADMIN_PASSWORD` | Contraseña del admin demo (cuando aplica) |

Los valores viven en `.env` (gitignored) y se resumen en
`LOCAL-ACCESS-CREDENTIALS.local.md` (también gitignored). **Nunca** se commitean.

## Errores de acceso comunes

| Síntoma | Causa probable | Solución |
| --- | --- | --- |
| `localhost:5273` no carga | Dev server web no arrancado | `pnpm dev` |
| Login falla con 401 | Contraseña incorrecta o base sin sembrar | `pnpm db:seed` o `pnpm db:reset` |
| API responde HTML en vez de JSON | Service worker obsoleto interceptando | Desregistrar el SW (ver LOCALHOST-DIAGNOSIS.md) |
| `ECONNREFUSED :5432` en pruebas | Infraestructura no levantada | `pnpm docker:up` |
| Puerto 3100/5273 ocupado | Un proceso previo sigue vivo | Terminar el proceso o reiniciar |
