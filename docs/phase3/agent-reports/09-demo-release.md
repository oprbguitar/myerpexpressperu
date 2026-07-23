# Reporte 09 — Demo and Release

Fecha: 2026-07-23.
Versión del paquete: `0.3.0`.

## Resultado

Se implementó un paquete portable local de demostración con:

- Compose separado para web/PWA, API, worker, PostgreSQL y MinIO;
- runtime Docker propio que incluye migraciones `0001`–`0011` y seed demo;
- configuración sin secretos y generación local CSPRNG en primer inicio;
- ocho roles e identidades ficticias;
- tres escenarios sintéticos A/B/C;
- facturación mock, OCR mock, geocodificación manual, correo/firma deshabilitados
  e IA externa deshabilitada;
- watermark y página de entrada con avisos;
- reset con guardas de entorno, flag, tenant, marcador persistido, base,
  fingerprint, perfil y trigger PostgreSQL;
- credenciales separadas para administración, runtime sujeto a RLS y
  mantenimiento; sólo el rol de reset puede cambiar temporalmente el replication role;
- seed/reset determinista, snapshot lógico y `DemoResetHistory`;
- scripts POSIX y Windows para start/status/health/reset/stop;
- SBOM CycloneDX, inventario de licencias, manifest, checksums y ZIP;
- smoke estático y validación real mediante Docker local.

No se hizo push, publicación remota ni despliegue online.

## Archivos principales

### Distribución

- `deployment/demo/docker-compose.demo.yml`
- `deployment/demo/.env.demo.example`
- `deployment/demo/runtime.Dockerfile`
- `deployment/demo/web.Dockerfile`
- `deployment/demo/demo-nginx.conf`
- `deployment/demo/demo-entry.html`
- `deployment/demo/demo-profile.json`
- `deployment/demo/README-DEMO.md`
- `deployment/demo/QUICKSTART.md`
- `deployment/demo/LICENSE.txt`
- `deployment/demo/THIRD-PARTY-NOTICES.txt`

### Datos y guardas

- `packages/database/src/phase3/demo-seed.ts`
- `packages/database/src/phase3/demo-scenarios.ts`
- `packages/database/src/phase3/demo-guards.ts`
- `packages/database/src/phase3/demo-guards.test.ts`

### Operación y release

- `scripts/demo/demo-{start,status,health,reset,stop}.sh`
- `scripts/demo/demo-{start,status,health,reset,stop}.ps1`
- `scripts/demo/demo-command.mjs`
- `scripts/demo/verify-config.mjs`
- `scripts/demo/check-secrets.mjs`
- `scripts/demo/generate-sbom.mjs`
- `scripts/demo/generate-licenses.mjs`
- `scripts/demo/build-package.mjs`
- `scripts/demo/demo-smoke.mjs`
- `scripts/demo/scenarios.json`

### Documentación

- `docs/DEMO-ENVIRONMENT.md`
- `docs/PORTABLE-DEMO.md`
- este reporte.

`package.json` recibió aliases para `security:scan`, `sbom:generate`,
`licenses:check`, `demo:verify`, `demo:build`, `demo:smoke`, `demo:start`,
`demo:status`, `demo:health`, `demo:reset` y `demo:stop`. Se preservó el override
existente de `find-my-way`.

## Guardas verificadas

Las pruebas unitarias rechazan:

- entorno `production`;
- reset deshabilitado;
- tenant distinto;
- base distinta;
- fingerprint distinto;
- tenant sin prefijo demo.

El flujo real añade:

- nombre exacto `erp_express_demo`;
- perfil `portable-local` activo;
- trigger de `demo_reset_jobs` con settings transaccionales;
- limpieza de `BASE TABLE` exclusivamente, sin intentar borrar vistas;
- rechazo de tenants con más de una empresa y bitácora durable de intentos fallidos;
- preservación explícita de auditoría e historiales legales/privacidad;
- borrado de almacenamiento fail-closed, verificado vacío y ejecutado sólo después del reset DB;
- bucket exacto `erp-demo-private`.

Durante la verificación se detectaron y corrigieron:

1. bits Unix con signo en el encabezado ZIP;
2. archivo `.env.demo` temporal requerido por `docker compose config`;
3. error externo temporal de tests OCR antes de su corrección por el propietario;
4. error oculto por un `finally` en reset;
5. inclusión accidental de una vista en la consulta de limpieza;
6. APIs criptográficas no disponibles en Windows PowerShell 5, reemplazadas por
   `RandomNumberGenerator.Create().GetBytes()` y `BitConverter`.

## Verificación ejecutada

| Comando/control | Resultado |
| --- | --- |
| `pnpm demo:verify` | Aprobado; 7 marcadores generados, perfil `demo` |
| `pnpm sbom:generate` | Aprobado |
| `pnpm licenses:check` | Aprobado; 768 manifests instalados inventariados |
| `pnpm demo:build` | Aprobado |
| `pnpm demo:smoke` | Aprobado; 18 archivos requeridos, Compose válido |
| `pnpm security:scan` | Aprobado; sin patrones de secretos |
| `pnpm --filter @erp/database test` | Aprobado; 7 pruebas |
| `pnpm --filter @erp/database typecheck` | Aprobado |
| `pnpm --filter @erp/api typecheck` | Aprobado |
| Build Docker runtime | Aprobado |
| Build Docker web/PWA | Aprobado |
| Migraciones en base demo limpia | Aprobado |
| Seed sintético | Aprobado |
| Health web/API | Aprobado |
| Página `/demo/` y aviso | HTTP 200; aviso visible |
| Login administrador generado | Aprobado; tenant demo esperado |
| Reset storage + DB | Aprobado |
| `DemoResetHistory` | 1 registro después del reset |
| Escenarios activos después del reset | `A,B,C` |
| Detención | Aprobada; sólo stack demo |

El stack real de prueba se detuvo y sus dos volúmenes sintéticos fueron eliminados.
No se detuvieron servicios preexistentes del usuario.

## Artefacto

El último ensamblado debe consultarse en:

```text
dist/demo/erp-express-peru-demo-v0.3.0.zip
dist/demo/erp-express-peru-demo-v0.3.0.zip.sha256
```

El ZIP contiene:

- 259 checksums internos;
- 452 componentes en el SBOM generado desde `pnpm-lock.yaml`;
- inventario de licencias generado desde manifests instalados;
- source mínimo sin `node_modules`, `.env`, `.env.demo`, backups ni volúmenes.

El SHA-256 exacto se toma del archivo `.zip.sha256` después del ensamblado final;
no se fija manualmente en este reporte para evitar que quede desactualizado ante
una regeneración legítima.

## Revisión requerida

- **Security Agent y Database Agent:** la primera revisión detectó credencial
  PostgreSQL compartida, borrado de storage fail-open y brechas de evidencia.
  Esos puntos fueron corregidos y revalidados en Docker; el dictamen final se
  conserva en sus reportes especializados.
- **Legal Agent:** revisar licencia, avisos, disclaimers y términos antes de una
  distribución pública.
- **QA Agent:** ejecutar el ZIP en una segunda máquina limpia y añadir el resultado
  al reporte final.

## Limitaciones

- No existe demo online desplegada ni verificada.
- No se implementó scheduler automático de reset; se documentó la expresión
  sugerida.
- Registro público, expiración automática de cuentas, rate limiting global y
  notificación externa de fallos quedan pendientes.
- El paquete construye imágenes localmente; no distribuye imágenes OCI prebuilt.
- MinIO se incluye porque los flujos documentales lo requieren; aumenta el tamaño
  de descarga inicial.
- La prueba real se ejecutó en Docker Desktop local, no en una segunda máquina
  limpia.
- El inventario de licencias puede contener entradas `UNKNOWN` y requiere revisión
  antes de redistribución.
- La demostración no garantiza cumplimiento legal o tributario, exactitud de IA u
  OCR, disponibilidad, homologación o certificación SUNAT.
