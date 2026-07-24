# Diagnóstico de acceso local — `http://localhost:5273/`

- **Fecha:** 2026-07-23
- **Síntoma reportado:** `http://localhost:5273/` no muestra la aplicación
- **Método:** inspección de puertos, configuración, arranque real y navegador real

## Conclusión

**Causa raíz: el servidor de desarrollo web no estaba en ejecución.** No es un
defecto de configuración, de puerto, de CORS ni de service worker.

- El puerto **5273 es el correcto** y estaba **libre** (nadie escuchando).
- Al iniciar `pnpm --filter @erp/web dev`, Vite arrancó en 600 ms y sirvió la
  aplicación en `http://localhost:5273/` correctamente.
- La pantalla de login **renderiza en un navegador real sin errores de consola**.

## Evidencia

### Puertos antes de arrancar el web

```text
LISTEN 3100  (API, de una sesión previa)
free   5273  (web — NADIE ESCUCHANDO)  ← causa del síntoma
LISTEN 5432  (PostgreSQL, Docker)
LISTEN 9000/9001 (MinIO)
LISTEN 1025/8025 (Mailpit)
```

### Tras `pnpm --filter @erp/web dev`

```text
VITE v7.0.6  ready in 600 ms
Local:   http://localhost:5273/
Network: http://192.168.0.232:5273/
```

### Verificación HTTP

| Comprobación | Resultado |
| --- | --- |
| `GET http://localhost:5273/` | HTTP 200, 980 bytes |
| `GET http://127.0.0.1:5273/` | HTTP 200 |
| HTML contiene `<div id="root">` y `<script type="module" src="/src/main.tsx">` | Sí |
| `GET /src/main.tsx` | HTTP 200 |
| `GET http://localhost:3100/api/v1/health` | HTTP 200 `{"status":"ok"}` |

### Verificación en navegador real

- La página carga con título «ERP Express Perú».
- Renderiza la pantalla de login completa: campos de correo y contraseña, botón
  «Ingresar», enlace «¿Olvidó su contraseña?».
- **Consola del navegador: sin errores.**

## Configuración confirmada correcta

| Parámetro | Valor | Estado |
| --- | --- | --- |
| Puerto web (`vite.config.ts`) | 5273 | ✅ correcto |
| Host de Vite | `--host 0.0.0.0` (accesible por LAN) | ✅ |
| `APP_URL` (`.env`) | `http://localhost:5273` | ✅ coincide |
| Puerto API (`config.ts`) | 3100 | ✅ |
| `VITE_API_URL` | `http://localhost:3100/api/v1` | ✅ coincide |
| CORS (`main.ts`) | `origin: APP_URL, credentials: true` | ✅ |

## Sobre el service worker (§6.3) — riesgo evaluado, NO era la causa

`vite.config.ts` tiene `VitePWA({ devOptions: { enabled: true }, ... })` con un
handler `NetworkFirst` para documentos. En teoría, un service worker activo en
desarrollo puede servir una versión cacheada tras un rebuild.

**Se investigó y se descartó como causa** del síntoma reportado: el problema era
simplemente que no había servidor. Se probó a deshabilitar `devOptions` de forma
proactiva, pero **eso introdujo una regresión** (la prueba e2e «manifiesto PWA
está disponible» dejó de encontrar el manifiesto en dev, devolviendo el shell
HTML). El cambio se **revirtió**; la configuración queda como estaba.

Lección: la instrucción §6.3 es condicional («si la página en blanco se debe a
un caché obsoleto»). No se debe modificar la estrategia PWA de forma especulativa
cuando la causa es otra.

### Cómo desregistrar un service worker obsoleto (si alguna vez interfiere)

En DevTools del navegador → pestaña **Application** → **Service Workers** →
**Unregister**; luego **Storage** → **Clear site data**. O en consola:

```js
navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()));
```

## Criterios de aceptación §6.4

| # | Criterio | Estado |
| --- | --- | --- |
| 1 | La aplicación web abre en el navegador | ✅ |
| 2 | La pantalla de login renderiza | ✅ |
| 3 | Los chunks de JavaScript cargan | ✅ (`main.tsx` 200) |
| 4 | La salud de la API responde | ✅ (200) |
| 5 | La petición de login llega a la API | ✅ (login 201 vía API) |
| 6 | Sin errores críticos inexplicados en consola | ✅ |
| 7 | La URL real está documentada | ✅ (`docs/local/LOCAL-ACCESS-GUIDE.md`) |
| 8 | La URL incorrecta u obsoleta se identifica | ✅ — no había URL incorrecta; el servidor no estaba arrancado |

**Gate A (acceso local): PASS**, con la condición operativa de que el servidor
web debe estar en ejecución (`pnpm dev` o `pnpm --filter @erp/web dev`).
