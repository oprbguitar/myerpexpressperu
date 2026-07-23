# OCR asistido — Fase 3

## Regla principal

OCR sólo genera una extracción revisable. La confirmación humana produce el
handoff `REVIEWED_DRAFT_ONLY` con `recordCreationExecuted: false`; nunca crea un
registro financiero, contractual o de identidad final automáticamente.

## Flujo implementado

```text
DTO estricto
→ tipo/MIME/nombre/tamaño
→ hash SHA-256
→ clasificación
→ idempotencia por tenant+empresa+clave
→ detección de duplicado por hash
→ provider
→ campos y confianza
→ revisión/correcciones
→ confirmación o rechazo humano
→ handoff de borrador (sin efecto consecuencial)
```

Se aceptan PDF, JPEG, PNG y HEIC hasta 10 MiB en el DTO de esta API. El documento
original se identifica mediante `documentId` y `contentSha256`; la preservación
binaria autoritativa corresponde al almacenamiento documental existente. El
montaje productivo debe ejecutar validación de archivo y malware antes del
servicio de extracción.

## Providers

- `DisabledOcrProvider`: valor inicial seguro.
- `MockOcrProvider`: salida sintética rotulada `DEMO MOCK OCR`.
- `LocalOcrAssistanceProvider`: motor local inyectable, sin dependencia
  obligatoria de Tesseract.
- `CustomHttpOcrProvider`: HTTPS allowlist, timeout, circuit breaker, límite de
  respuesta y credencial resuelta sólo en servidor.

Los datos médicos, credenciales y secretos de proveedor se rechazan antes de la
invocación. Los documentos de identidad requieren tipo explícito y autorización
expresa para un proveedor externo. La política de privacidad puede imponer
restricciones adicionales.

## Evidencia

Cada resultado incluye proveedor, motor, versión, fecha, tipo, texto, confianza
global y, por campo, valor, confianza, página y región cuando está disponible.
Las correcciones registran valor anterior, corregido, razón opcional, revisor y
fecha. Los archivos son contenido, no instrucciones para IA, OCR o el ERP.

## Limitaciones actuales

El repositorio de jobs es volátil dentro del servicio autocontenido hasta que el
coordinador lo conecte con las tablas de Fase 3. No se integró un motor OCR real,
un antivirus ni creación posterior de borradores de compras; por lo tanto no se
afirma operación productiva de esos componentes.

