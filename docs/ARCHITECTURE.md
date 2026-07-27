# Arquitectura

ERP Express Perú es un monolito modular: una web React/PWA, una API NestJS/Fastify, un worker y PostgreSQL. Los límites de dominio comparten despliegue, pero se comunican mediante casos de uso, contratos y eventos; el dominio no importa proveedores.

```mermaid
flowchart LR
  Web[React PWA] --> API[NestJS API]
  API --> App[Casos de uso]
  App --> Domain[Dominio y objetos de valor]
  App --> Contracts[Contratos]
  Contracts --> PG[PostgreSQL]
  Contracts --> S3[MinIO o S3]
  Contracts --> Mail[Correo]
  Worker --> PG
```

Las capas son presentación (`apps`), aplicación/contratos (`packages`), dominio (`packages/domain`) e infraestructura (`packages/database`, adaptadores en API). Las rutas futuras se cargan dinámicamente y sus paquetes no entran al bundle inicial.

## Límite de gestión de residuos

`waste-management` es un módulo aditivo del mismo monolito. Su dominio define
las fases y transiciones; la API aplica sesión, permiso, idempotencia y
concurrencia; PostgreSQL conserva registros, eventos append-only y excepciones
con RLS forzado. La web se carga de forma diferida en `/residuos`.

El cierre interno no forma parte del caso de uso de transición ordinaria. Queda
bloqueado hasta disponer de un flujo separado de aprobación y evidencia
documental vinculada. Este límite evita que una capacidad visual se convierta en
una afirmación regulatoria no implementada.
