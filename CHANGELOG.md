# Historial de cambios

## 0.4.0 — 2026-07-27

### Añadido

- módulo real `waste-management` con dominio, permisos, API y pantalla
  `/residuos`;
- registros de generación, ciclo consecutivo, timeline y excepciones;
- migraciones `0014` y `0015` con RLS forzado y privilegios mínimos;
- dirección visual, sistema de diseño, auditorías y conceptos comparativos;
- pruebas unitarias, de integración y E2E del flujo de residuos.

### Seguridad y cumplimiento

- idempotencia en las tres mutaciones implementadas;
- control optimista de concurrencia;
- eventos operativos con hora del servidor;
- marca de peligrosidad expresada como evaluación preliminar;
- cierre interno bloqueado hasta disponer de evidencia vinculada, aprobación y
  segregación de funciones.
- React 19.2.7, React Router 8.3.0, `@fastify/static` 10.1.2 y `js-yaml` 5.2.2
  para resolver avisos de dependencias conocidos al cierre.

### Compatibilidad

- se preservaron rutas y módulos existentes;
- no se añadieron dependencias ni variables de entorno;
- se publicó una vitrina estática accesible mediante GitHub Pages;
- se añadió un paquete portable verificable distribuido como GitHub Release.
