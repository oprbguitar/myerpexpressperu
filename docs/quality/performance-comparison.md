# Comparación de rendimiento y bundle

## Método

Comparación de `vite build` antes y después en la misma estación local. Los
valores son tamaños de artefacto; no equivalen a Web Vitals ni a una prueba de
carga.

| Artefacto | Línea base | Final | Delta |
| --- | ---: | ---: | ---: |
| JS inicial raw | 290.34 kB | 299.35 kB | +9.01 kB |
| JS inicial gzip | 91.44 kB | 92.97 kB | +1.53 kB |
| CSS inicial raw | 22.17 kB | 22.41 kB | +0.24 kB |
| PWA precache | 1422.36 KiB | 1461.47 KiB | +39.11 KiB |

El módulo de residuos queda fuera del JS inicial:

- `WasteWorkspacePage`: 19.67 kB raw / 5.73 kB gzip;
- CSS del módulo: 11.13 kB raw / 2.60 kB gzip.

El incremento inicial incluye la actualización de seguridad de React
19.1.1→19.2.7 y React Router 7.18.0→8.3.0. La ruta mantiene lazy loading y
`pnpm check:bundle` pasa.

## Observaciones

- la vista limita la consulta a 100 registros y declara el límite;
- móvil todavía renderiza tabla y tarjetas en el DOM, aunque CSS muestra solo
  una representación;
- no se ejecutaron Lighthouse, WebPageTest, CPU throttling, memoria, carga o
  backend profiling;
- una siguiente fase debe medir datos grandes antes de incorporar
  virtualización o una librería de tabla.
