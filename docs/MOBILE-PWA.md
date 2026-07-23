# Móvil y PWA

La misma aplicación React responde en teléfono, tableta y escritorio. Incluye manifiesto, service worker versionado, shell offline, actualización segura, estado de conexión, controles táctiles, captura de cámara y borradores IndexedDB versionados.

Offline se permite abrir el shell y retener borradores asociados a usuario y
empresa para partes, cotizaciones, compras, gastos y conteos de caja. La
sincronización exige revisión del usuario.

No se permite confirmar ventas, numerar o emitir documentos, registrar pagos,
mover stock, cerrar caja, cambiar SUNAT ni ejecutar importaciones sin servidor.
La API sigue siendo la fuente de verdad. El diseño evita almacenamiento de tokens
y queda preparado para Capacitor sin una segunda base de código.

## Ampliación de Fase 3

La inspección SST usa un formulario táctil de una columna, captura de imagen con
la cámara cuando el navegador la soporta, indicador de conexión y una barra de
acciones inferior. El usuario puede guardar antes de enviar; la API confirma la
creación y sigue siendo la fuente de verdad.

Los borradores nuevos viven en `erp-express-phase3-drafts`, con versión de
esquema `3` y clave por usuario, empresa, tipo y borrador. Se admiten borradores
de inspección SST, horas, gastos y revisión OCR. Una validación recursiva rechaza
claves asociadas a tokens, contraseñas, secretos, diagnósticos y detalle médico.
La evidencia binaria no se persiste en el borrador: se conserva únicamente el
nombre local hasta que exista una carga autorizada.

OCR, IA y mapas son rutas lazy independientes. Sin proveedor de mapas el usuario
puede capturar coordenadas manualmente. Sin conectividad, IA y OCR no simulan
resultados: muestran el error de la API y conservan únicamente los borradores
permitidos.

## Verificación

- Chromium de escritorio: `1536 × 1024`.
- Chromium emulando Pixel 7: primer viewport y controles inferiores.
- WebKit de escritorio: `1280 × 900`.
- Movimiento reducido: las transiciones de Fase 3 se desactivan con
  `prefers-reduced-motion`.

Las capturas están en `docs/phase3/screenshots`. La verificación se hizo con una
harness temporal retirada después de la prueba; la integración final debe volver
a recorrer estas rutas dentro del shell autenticado.
