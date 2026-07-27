# Informe profesional — Fase 3

Fecha de cierre técnico: 2026-07-23.

## Resultado

La Fase 3 amplía el monolito modular de ERP Express Perú con centro de
administración, perfiles de negocio, CRM, proyectos, RR. HH. ligero, SST, activos
y mantenimiento, privacidad, documentos legales, proveedores reemplazables,
mapas, OCR asistido, IA gobernada, observabilidad y distribución demo portable.

Se añadieron migraciones `0007`–`0011`, contratos y dominio, rutas API protegidas,
pantallas React lazy, borradores móviles, jobs del worker, semillas incrementales,
pruebas y documentación. La base existente fue actualizada sin reset destructivo
ni cambio de contraseña.

## Controles de seguridad

- El ámbito tenant/empresa proviene de la sesión y RLS se aplica en PostgreSQL.
- `0011` impide referencias sensibles cross-company y añade revocaciones legales
  y retiros de consentimiento append-only con vistas `security_invoker`.
- Proveedores configurables tienen ownership tenant/empresa; list, test, export y
  activación respetan el mismo ámbito.
- IA bloquea categorías prohibidas, redacta contexto, limita herramientas a
  registros de solo lectura con citas y valida su clasificación antes de ejecutar.
- OCR valida firma, MIME, hash, metadatos persistidos, allowlist de tipo de
  documento, permiso de identidad, idempotencia y confirmación humana.
- Proveedores cloud de IA y OCR permanecen deshabilitados en Fase 3. Los modos
  mock se rotulan inequívocamente y no constituyen una integración productiva.
- Los resets demo exigen entorno, fingerprint y tenant reservado, usan un rol
  de mantenimiento separado del runtime sujeto a RLS, conservan evidencia de
  fallos y no se exponen como endpoint remoto.

## Verificación ejecutada

- Dominio: 41 pruebas.
- Seguridad: 17 pruebas.
- API IA/OCR/mapas/proveedores: 12 pruebas.
- Web Fase 3: 9 pruebas.
- Guards demo: 7 pruebas.
- Integración de base y RLS: 17 pruebas.
- E2E específico de Fase 3: 4/4 en Chromium desktop y móvil.
- Lint, typecheck, build PWA/API/worker, auditoría de secretos y presupuesto de
  bundle: PASS.
- `pnpm audit --prod`: sin vulnerabilidades conocidas al cierre.
- Instalación limpia `0001`–`0011`, rollback/reaplicación de `0011`, backup y
  restore: PASS.
- Demo Docker: build, salud web/API y reset: PASS; una solicitud de privacidad
  con su acción asociada permaneció `1/1` después del reset final.

La implementación del centro administrativo fue inspeccionada en escritorio y
móvil sin overflow y con datos de API reales; el estado vacío es explícito y no
se reemplaza por datos inventados.

## Cumplimiento y límites

La matriz legal es trazable a fuentes oficiales y exige revisión jurídica por
empresa. Referencias principales:

- Reglamento peruano de IA: [DS 115-2025-PCM](https://www.gob.pe/institucion/pcm/normas-legales/7133522-115-2025-pcm).
- Protección de datos: [DS 016-2024-JUS](https://www.gob.pe/institucion/anpd/normas-legales/6554453-16-2024-jus).
- Firma digital: [IOFE](https://www.gob.pe/firmadigital).
- Comprobantes electrónicos: [SUNAT CPE](https://cpe.sunat.gob.pe/informacion_general/obligados_cpe).
- Libro de Reclamaciones: [Indecopi](https://www.gob.pe/institucion/indecopi/campa%C3%B1as/65149-libro-de-reclamaciones-todo-lo-que-debe-saber-antes-de-solicitarlo).

El sistema no declara cumplimiento automático. No incluye SUNAT productivo,
firma digital IOFE, planillas, contabilidad completa, diagnóstico médico ni
decisiones laborales automatizadas. Reglas de workflow, RR. HH., SST, activos,
mantenimiento, OCR, mapas e IA conservan habilitación modular y varios permanecen
apagados por defecto hasta que el administrador complete su configuración.

No se realizó despliegue remoto: el entregable verificable es local y portable.
La activación productiva requiere infraestructura, secretos server-side, revisión
legal, pruebas de carga/recuperación y autorización expresa.

## Adenda 2026-07-27 — gestión operativa de residuos

Se añadió un módulo de seguimiento interno con dominio, permisos, migraciones,
RLS, API, interfaz adaptable, auditoría, outbox, idempotencia y control de
concurrencia. La revisión de Base de Datos validó aplicación/reversión y ACL; la
revisión de Seguridad emitió PASS limitado al seguimiento interno; Legal aprobó
solo demo interna controlada.

El cierre interno permanece bloqueado. La marca de peligrosidad es preliminar.
No se afirma clasificación legal, cumplimiento ambiental, expediente
regulatorio, SIGERSOL, destino autorizado ni producción.

Comandos ejecutados durante la implementación:

- `pnpm db:migrate` y `pnpm db:seed`: PASS;
- `pnpm typecheck`, `pnpm lint` y `pnpm test`: PASS;
- `pnpm test:integration`: PASS, 27/27 en la última ejecución registrada antes
  del cierre de esta adenda;
- E2E específico de residuos: PASS 2/2 en Chromium escritorio, Chromium móvil
  y WebKit; batería completa PASS, 26 pasadas y 10 omisiones condicionales;
- `pnpm build`: PASS; el módulo se entrega como chunk lazy separado.
- `pnpm phase3:verify`: PASS;
- `pnpm audit --prod`: sin vulnerabilidades conocidas tras actualizar React,
  React Router, `@fastify/static` y `js-yaml`;
- `pnpm check:bundle`, `pnpm check:secrets`, `pnpm security:scan`,
  `pnpm licenses:check`, `pnpm sbom:generate` y `pnpm demo:verify`: PASS.

Riesgos residuales y siguiente fase:

- permiso de transición amplio hasta destino final;
- backdating sin política específica;
- sin asignación de responsables, evidencia estructurada o ámbito obligatorio
  por sede;
- sin resolución de excepciones ni cierre aprobado;
- pruebas de carga, WCAG completa y despliegue remoto no ejecutados.

## Evidencia

Los nueve informes especializados están en `docs/phase3/agent-reports/`. La
matriz de requisitos está en `docs/phase3/LEGAL-REQUIREMENT-MATRIX.md`; amenazas,
privacidad, retención e incidentes se documentan en sus archivos raíz. El paquete
demo, SBOM, licencias, checksums y guía de inicio se generan bajo `dist/demo/`.
