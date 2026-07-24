# Decisiones humanas requeridas

Ninguna de estas puede resolverla una herramienta de IA. Cada una bloquea algo
concreto.

## D-1 — Titular legal de los derechos de autor

| Campo | Contenido |
| --- | --- |
| Estado actual | Marcador provisional «ERP Express Perú contributors» en 220 archivos, `LICENSE`, `NOTICE` y `OWNERSHIP.yml` |
| Decisión requerida | Persona natural, persona jurídica o cotitularidad |
| Evidencia requerida | Constitución de la empresa, contrato laboral o de servicios con cláusula de PI, o acuerdo de cesión firmado |
| Impacto en distribución | **Bloquea toda distribución externa** |
| Plazo | Antes de cualquier entrega a terceros |

## D-2 — Aprobación final de MPL-2.0

| Campo | Contenido |
| --- | --- |
| Estado actual | Adoptada provisionalmente, sin aprobación legal |
| Decisión requerida | Confirmar MPL-2.0 o elegir otra licencia |
| Evidencia requerida | Dictamen legal que considere el modelo de negocio |
| Impacto en distribución | MPL-2.0 obliga a publicar el fuente de los archivos cubiertos que se modifiquen y distribuyan. Si se planea una edición propietaria, **debe decidirse antes de distribuir, no después** |
| Plazo | Antes de cualquier entrega a terceros |

## D-3 — Titularidad de las fases anteriores a Git

| Campo | Contenido |
| --- | --- |
| Estado actual | El repositorio no tuvo control de versiones hasta la Fase 4. La autoría de las Fases 1–3 no puede derivarse de commits |
| Decisión requerida | Declarar quién desarrolló las Fases 1–3 y bajo qué régimen |
| Evidencia requerida | Contratos de quienes participaron; en Perú la titularidad sobre obra bajo relación laboral o por encargo depende del régimen contractual y no puede presumirse |
| Impacto | Si participaron terceros sin cesión escrita, pueden conservar derechos |
| Plazo | Junto con D-1 |

## D-4 — Revisión de autoría asistida por IA

| Campo | Contenido |
| --- | --- |
| Estado actual | 6 registros de procedencia, **todos con `accepted: false` y `human_reviewer: pending`** |
| Decisión requerida | Revisar cada registro y aceptarlo o rechazarlo |
| Evidencia requerida | Revisión real por una persona nombrada; el verificador rechaza `accepted: true` sin revisor |
| Impacto | Bajo la política del propio proyecto, **nada de lo hecho en Fase 4 está aceptado**. `pnpm provenance:verify --strict` sale 1 |
| Plazo | Antes de cerrar la Fase 4 |

## D-5 — Asignación de revisores por componente

| Campo | Contenido |
| --- | --- |
| Estado actual | `docs/compliance/COMPONENT-OWNERS.yml` con **todos los propietarios en `null`** |
| Decisión requerida | Asignar responsables de arquitectura, base de datos, seguridad, licenciamiento, legal, documentación y QA |
| Evidencia requerida | Confirmación de las personas designadas |
| Impacto | Las reglas de «revisión independiente» y «nadie aprueba su propio trabajo de alto riesgo» son inoperantes sin personas asignadas |
| Plazo | Antes de la subfase 4A |

## D-6 — Intención de distribución comercial

| Campo | Contenido |
| --- | --- |
| Estado actual | No declarada |
| Decisión requerida | ¿Se distribuirá el producto a terceros? ¿SaaS, on-premise, o ambos? |
| Evidencia requerida | Decisión del propietario |
| Impacto | Determina D-2, la aplicabilidad de las obligaciones de MPL-2.0 y si hacen falta acuerdos de licencia comercial |
| Plazo | Antes de D-2 |

---

## D-7 — Destino de la capa de dominio muerta de Fase 3

Esta es **técnica pero requiere decisión humana** porque implica descartar trabajo
o construir código nuevo.

| Campo | Contenido |
| --- | --- |
| Estado actual | 869 líneas y 27 funciones exportadas en `packages/domain/src/phase3/*` sin ninguna referencia fuera de sus propias pruebas. El runtime de Fase 3 es CRUD genérico sobre tablas |
| Decisión requerida | **(a)** Cablearla al runtime, construyendo los endpoints de transición ausentes (calificar lead, ganar/perder oportunidad, ciclo de vida de empleado, transición de incidente), o **(b)** eliminarla |
| Por qué no puede decidirlo una herramienta | (a) es trabajo sustancial de producto; (b) descarta código y 25 pruebas |
| Impacto | Mientras siga como está, 25 pruebas verdes no prueban nada del comportamiento del sistema. Es falsa garantía, que es peor que cualquiera de las dos opciones |
| Plazo | Subfase 4A |

## D-8 — Alcance de la corrección de aislamiento

| Campo | Contenido |
| --- | --- |
| Estado actual | La aplicación conecta como superusuario con `BYPASSRLS`; las 16 políticas RLS están inertes |
| Decisión requerida | Confirmar el plan: rol de aplicación restringido + `FORCE ROW LEVEL SECURITY` + rol de mantenimiento separado para migraciones |
| Por qué requiere decisión | Cambiar el rol de conexión afecta a despliegue, respaldos, migraciones y al reinicio demo. Requiere una ventana de cambio coordinada |
| Impacto | Sin ello, la Fase 4 construiría ~200 tablas sobre una defensa en profundidad inexistente |
| Plazo | **Bloqueante de la subfase 4A** |

---

## Resumen de bloqueos

| Bloquea | Decisiones |
| --- | --- |
| Distribución externa | D-1, D-2, D-3, D-6 |
| Cierre de Fase 4 | D-4 |
| Inicio de subfase 4A | D-5, D-7, D-8 |

**Ninguna de estas decisiones debe registrarse como resuelta sin la evidencia
indicada.** En particular, no se debe fijar `accepted: true` en ningún registro de
procedencia sin un revisor nombrado y una revisión que efectivamente ocurrió.
