# Decisiones de dependencias para gestión de residuos

No se añadió ninguna dependencia.

Se reutilizaron React Router, TanStack Query, Zod, `lucide-react`, los
componentes `Button`, `Field`, `TextInput`, estados asíncronos y la estrategia
CSS existente. Esto conserva el modelo de carga diferida y evita duplicar
primitives.

Se evaluaron y no se incorporaron en esta entrega:

- shadcn/ui o Radix: la superficie implementada usa controles nativos y no
  requiere primitives complejos;
- Tailwind: el producto ya tiene tokens y CSS organizado; introducir otro
  sistema aumentaría la duplicación;
- TanStack Table o virtualización: el endpoint limita a 100 filas y no existe
  evidencia de volumen que justifique esa complejidad;
- Storybook: sería útil para consolidar el sistema completo, pero no es una
  dependencia necesaria para entregar el flujo operativo;
- librerías de gráficos: no se mostraron métricas ambientales agregadas sin
  contratos de normalización por unidad.

La decisión debe revisarse si aparecen grandes volúmenes, edición compleja,
selección masiva o un catálogo de componentes compartido entre equipos.

## Actualizaciones de seguridad

La auditoría final detectó avisos publicados después de la línea base. Se
actualizaron React `19.2.7`, React Router `8.3.0`, `@fastify/static` `10.1.2` y
se fijó `js-yaml` `5.2.2`. `pnpm audit --prod` quedó sin vulnerabilidades
conocidas y la batería E2E pasó en Chromium y WebKit.

Riesgo residual: NestJS Platform Fastify 11.1.28 declara como peer opcional
`@fastify/static` 8 o 9. La versión 10.1.2 arranca y sirve los flujos verificados,
pero pnpm conserva una advertencia de peer hasta que NestJS amplíe oficialmente
su rango. Volver a 9.1.1 reintroduciría los avisos de seguridad y no se hizo.
