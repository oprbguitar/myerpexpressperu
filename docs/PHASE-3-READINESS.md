# Preparación para Fase 3

Fecha de evaluación inicial: 2026-07-23.

## Base reutilizable

Fases 1 y 2 aportan una React PWA, API NestJS/Fastify, worker, PostgreSQL,
almacenamiento S3 compatible, sesiones opacas, permisos backend, ámbito
tenant/empresa, auditoría, documentos privados, outbox y módulos comerciales.
Los módulos se registran por código y las pantallas operativas se cargan por rutas
lazy. Esta base permite ampliar el monolito sin crear otra aplicación.

## Contratos existentes

Ya existen puertos para autenticación, transacciones, auditoría, documentos,
correo, cola, facturación electrónica, IA, OCR, geocodificación, mapas y firma
digital. Los contratos de IA, OCR y geocodificación son mínimos de preparación y
deben ampliarse de forma compatible para políticas, salud, confianza y proveedores.

## Límites que deben preservarse

- El contexto tenant/empresa proviene de la sesión y se establece en la transacción.
- El guard global exige permisos declarados por controlador.
- Operaciones fiscales, financieras y de inventario siguen siendo autoritativas
  en el servidor.
- La PWA usa una sola base React; IndexedDB contiene borradores, no sesiones.
- SUNAT productivo, IA externa, OCR externo y mapas externos son opcionales.

## Brechas iniciales de Fase 3

- No había archivos `AGENTS.md`; se añadieron reglas raíz y por alcance.
- Este documento requerido no existía al iniciar la fase.
- Los módulos `projects`, `human-resources`, `occupational-safety`, `maps`, `ocr`
  e `artificial-intelligence` estaban registrados como no implementados.
- No existían aún CRM, control administrativo versionado, privacidad, legal,
  activos/mantenimiento, demo aislada ni observabilidad de Fase 3.
- Los puertos de IA/OCR/geocodificación todavía no expresaban gobernanza ni salud.
- No existían scripts de SBOM, licencias, seguridad o distribución portable.

## Criterio de avance

La implementación debe ser aditiva, con migraciones nuevas, contratos compartidos
aprobados antes de sus consumidores, pruebas de regresión de Fases 1–2 y evidencia
por agente. Ningún módulo se declarará operativo hasta ejecutar su flujo y sus
controles de permiso/ámbito.
