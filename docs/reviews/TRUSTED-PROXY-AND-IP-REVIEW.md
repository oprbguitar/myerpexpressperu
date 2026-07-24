# Revisión de proxy de confianza e IP

- **Fecha:** 2026-07-23
- **Método:** inspección de configuración + pruebas HTTP contra la API en ejecución
- **Clasificación antes:** `UNSAFE`
- **Clasificación después de la corrección:** `REQUIRES_CONFIGURATION`

## Configuración encontrada

`apps/api/src/main.ts:18` (antes de la corrección):

```typescript
const adapter = new FastifyAdapter({ trustProxy: true, logger: { ... } });
```

`trustProxy: true` sin lista de proxies indica a Fastify que confíe en las
cabeceras de reenvío de **cualquier** origen, incluida una conexión directa.

No existía configuración de proxy inverso en el repositorio, ni variable de
entorno relacionada, ni validación de saltos.

## Dónde se consume la IP

| Uso | Ubicación | Impacto si es falsificable |
| --- | --- | --- |
| Clave del limitador de tasa | `http.ts:55` | Evasión total del límite |
| Registro de intentos de acceso | `auth.service.ts:40,47` | Forense de acceso no fiable |
| IP de sesión | `auth.service.ts:68` | Listado de sesiones engañoso |
| Auditoría | `operations.ts:88`, `organization.service.ts:86` | Rastro de auditoría falsificable |
| **Evidencia de aceptación legal** | `governance.service.ts:115,127` | **Evidencia de aceptación contractual falsificable** |

El último es el más grave: `legal_acceptances` almacena la IP como evidencia de
que un usuario aceptó un documento legal.

## Pruebas ejecutadas — antes de la corrección

Todas desde una conexión **directa** a `localhost:3100`, sin proxy alguno.

### Aceptación de cabeceras falsificadas

| `X-Forwarded-For` enviado | IP registrada en `login_attempts` |
| --- | --- |
| `203.0.113.99` (rango de documentación) | `203.0.113.99/32` |
| `8.8.8.8` | `8.8.8.8/32` |
| `2001:db8::dead:beef` (IPv6 documentación) | `2001:db8::dead:beef/128` |
| `::ffff:192.0.2.7` (IPv4 mapeada en IPv6) | `::ffff:192.0.2.7/128` |
| `1.1.1.1, 2.2.2.2, 3.3.3.3` (cadena) | `1.1.1.1/32` (el más a la izquierda) |

El servidor aceptó los cinco formatos sin validación. En el caso de la cadena
tomó el valor **más a la izquierda**, que es el íntegramente controlado por el
cliente.

### Evasión del limitador de tasa

150 peticiones a `/api/v1/health` en cada escenario. Límite configurado: 120/min.

| Escenario | Códigos obtenidos |
| --- | --- |
| IP falsificada **fija** (`198.51.100.1`) | `{"200": 120, "429": 30}` |
| IP falsificada **rotada** (`198.51.100.{i}`) | `{"200": 150, "429": 0}` |

Con rotación de cabecera, **el limitador de tasa quedó completamente anulado**.
Cualquier cliente no autenticado podía emitir peticiones ilimitadas.

**Nota metodológica:** una primera medición tras la corrección siguió mostrando
`{"200":150}`. La causa era que el proceso antiguo seguía ocupando el puerto 3100
y el nuevo binario había fallado con `EADDRINUSE`; se estaba midiendo el código
sin corregir. Se liberó el puerto y se repitió. Se documenta porque el error de
medición podría haber producido la conclusión contraria.

## Corrección aplicada

`apps/api/src/config.ts`:

```typescript
// Vacío = NO confiar en ninguna cabecera de reenvío.
TRUSTED_PROXIES: z.string().default(""),
```

`apps/api/src/main.ts`:

```typescript
const trustedProxies = config.TRUSTED_PROXIES.split(",")
  .map((entry) => entry.trim())
  .filter((entry) => entry.length > 0);

const adapter = new FastifyAdapter({
  trustProxy: trustedProxies.length > 0 ? trustedProxies : false,
  logger: { level: process.env.LOG_LEVEL ?? "info" }
});
```

Añadido `TRUSTED_PROXIES=` a `.env` y `.env.example`.

Por defecto vacío: se usa la dirección real del socket y las cabeceras de reenvío
se ignoran. Es el valor seguro.

## Pruebas ejecutadas — después de la corrección

| `X-Forwarded-For` enviado | IP registrada |
| --- | --- |
| `203.0.113.77` | `127.0.0.1/32` ← dirección real del socket |
| `9.9.9.9` | `127.0.0.1/32` ← dirección real del socket |

Limitador de tasa con IP rotada: `{"200": 117, "429": 33}` — restaurado.

Suite completa tras la corrección: `pnpm phase4:verify` salida 0;
`pnpm test:e2e` 18 pasadas, 6 omitidas.

## Clasificación resultante

```text
REQUIRES_CONFIGURATION
```

El sistema es ahora **seguro por defecto**, pero para desplegar tras un proxy
inverso —que es el despliegue esperado con HTTPS— hay que declarar
explícitamente los proxies en `TRUSTED_PROXIES`. Si no se hace, todas las IP
registradas serán la del proxy, no la del cliente.

## Pendiente

1. Documentar `TRUSTED_PROXIES` en la guía de despliegue con ejemplos de CIDR.
2. Añadir prueba automatizada que envíe un `X-Forwarded-For` falsificado con
   `TRUSTED_PROXIES` vacío y afirme que la IP registrada es la del socket.
   **Sin esta prueba, la corrección puede revertirse sin que nada falle.**
3. Añadir verificación de arranque que advierta si `NODE_ENV=production`,
   `COOKIE_SECURE=true` y `TRUSTED_PROXIES` está vacío — combinación que sugiere
   un proxy inverso no declarado.
4. No introducir listas de permitidos por IP (§19.4 de Fase 4) hasta que 1–3
   estén cerrados.

## Escenarios de §10 no probados

- Petición a través de un proxy aprobado real: **no probado** (no hay proxy inverso
  en el entorno local).
- Petición a través de un proxy no aprobado: **no probado** por la misma razón.
- Cabeceras `Forwarded` y `X-Real-IP`: **no probadas**; solo se ejercitó
  `X-Forwarded-For`.
- Tráfico interno de comprobación de salud: **no probado**.

Estos requieren un entorno con proxy inverso desplegado. Se declaran como no
verificados.
