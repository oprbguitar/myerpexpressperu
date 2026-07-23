# Gestión de proveedores

IA, OCR y geocodificación usan adaptadores reemplazables. La selección activa se
mantiene por tenant y empresa; nunca es global. Los modos seguros iniciales son IA
y OCR deshabilitados y geocodificación manual.

Un proveedor cloud sólo puede activarse tras una prueba de salud, validación de
origen permitido y confirmación explícita en producción. Las exportaciones de
configuración excluyen referencias y valores secretos.

IA aplica presupuesto, categorías permitidas, redacción, defensa ante contenido
no confiable, herramientas registradas de solo lectura y citas. OCR comprueba
hash, firma real del archivo, tipo documental derivado en servidor, permiso
restringido para identidad, idempotencia y revisión humana.
