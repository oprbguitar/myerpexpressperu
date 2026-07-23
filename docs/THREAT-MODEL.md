# Modelo de amenazas — Fase 3

**Alcance:** monolito modular de ERP Express Perú, incluyendo web/PWA, API,
worker, PostgreSQL, almacenamiento documental y proveedores reemplazables de
correo, SUNAT, OCR, IA y mapas.

Este documento describe controles de ingeniería. No certifica el despliegue ni
reemplaza una evaluación sobre infraestructura, configuración, contratos y
operación reales.

## Activos y límites de confianza

Activos prioritarios:

- sesión, identidad, roles, permisos y asociaciones tenant–empresa;
- datos personales de CRM y RR. HH., con tratamiento reforzado de salud y SST;
- comprobantes, documentos originales, extracciones OCR y evidencias;
- secretos y configuración de proveedores;
- auditoría, aprobaciones, legal holds e historial de configuración;
- datos, credenciales y capacidad destructiva de entornos demo.

Los límites de confianza están entre navegador–API, API–PostgreSQL,
API/worker–proveedores, almacenamiento–descarga autorizada, tenant–tenant,
empresa–empresa y operación demo–producción. El contenido de usuarios,
documentos, resultados OCR y respuestas de proveedores siempre es no confiable.

## Amenazas y controles requeridos

| Amenaza | Impacto | Controles de prevención y detección |
|---|---|---|
| IDOR o cambio de `tenant_id`/`company_id` desde el navegador | Lectura o modificación cruzada | Ámbito derivado de sesión; autorización en caso de uso; consulta parametrizada; RLS con rol no propietario; prueba negativa cross-tenant/company |
| Escalación de privilegios o asignación de rol | Toma de control | Permisos en API; reautenticación, MFA y aprobación independiente; evento depurado; concurrencia optimista |
| Robo o fijación de sesión | Suplantación | Cookie HttpOnly/Secure en producción, rotación, expiración, revocación y registro de fallos; no usar `localStorage` |
| Exposición de secretos | Compromiso de proveedor | Referencias opacas, resolución solo servidor, máscara fija, rotación, mínimo privilegio y escaneo de repositorio/artefactos |
| Datos médicos en vistas, logs o prompts generales | Daño al titular y exposición legal | Repositorio y permiso separados; clasificación restringida; denegación de proveedor genérico; redacción; eventos mínimos |
| Archivo hostil o extracción OCR engañosa | Malware, fraude o asiento incorrecto | Límite de tamaño/tipo, análisis, aislamiento, hash, OCR como borrador, confianza visible y confirmación humana |
| Prompt injection o manipulación de herramienta | Exfiltración o acción no autorizada | Contenido tratado como datos; detección y bloqueo; lista cerrada de herramientas; sin SQL irrestricto; autorización independiente; salida no consecuencial |
| Proveedor comprometido o indisponible | Fuga, demora o datos incorrectos | Allowlist, contrato/configuración, timeout, circuit breaker, kill switch, minimización, telemetría sin contenido y fallback explícito |
| Alteración o borrado de auditoría | Pérdida de evidencia | Escritura append-only, permisos separados, integridad/backup, redacción previa y alerta de intento de alteración |
| Eliminación bajo legal hold | Destrucción indebida | Vista previa, exclusión por hold y conservación explícita, doble aprobación y job idempotente posterior; nunca borrar desde la función de cálculo |
| Reinicio demo contra producción | Pérdida masiva | Prohibición por modo, bandera dedicada, marca de tenant demo, coincidencia exacta de tenant, frase exacta, reautenticación, MFA y dos aprobadores independientes |
| Uso de datos demo no sintéticos | Fuga de terceros | Fixtures deterministas y rotulados; revisión de procedencia/licencia; escaneo antes de empaquetar |

## Supuestos que deben verificarse en cada despliegue

- La API usa una cuenta PostgreSQL sujeta a RLS; el propietario de tablas no se
  usa para tráfico normal.
- TLS, `COOKIE_SECURE`, rotación de secretos, backups y restauración están
  configurados fuera del código.
- El proveedor y la región habilitados han sido aprobados para la finalidad y
  categorías de datos concretas.
- Las rutas sensibles aplican la política, no solo ocultan controles en UI.

## Casos adversariales mínimos

1. Cambiar IDs de ámbito, objeto y propietario en cada lectura y mutación.
2. Repetir solicitudes idempotentes con otra sesión, tenant o payload.
3. Intentar leer salud/SST con un permiso general de RR. HH.
4. Inyectar instrucciones en PDF, nombre de archivo, campo CRM y respuesta OCR.
5. Solicitar herramientas no registradas, SQL y acciones laborales/SST.
6. Forzar logs con bearer tokens, correo, DNI/RUC, IP, secretos y objetos
   circulares o gigantes.
7. Ejecutar retención sobre registros con legal hold o fecha futura.
8. Simular producción, tenant incorrecto, confirmación parcial y aprobadores
   duplicados en demo reset.

## Riesgos residuales

Las políticas puras no sustituyen su montaje en endpoints, transacciones,
workers y almacenamiento. Quedan como pruebas de integración obligatorias RLS
real, permisos por ruta, malware scanning, cifrado/gestión de claves, integridad
de auditoría, restauración y respuesta con proveedores reales.
