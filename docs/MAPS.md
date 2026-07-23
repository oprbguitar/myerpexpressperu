# Mapas y geocodificación

La geocodificación es reemplazable y opcional. El modo inicial es manual; ningún
servicio externo es necesario para operar el ERP.

## Implementaciones

- `ManualGeocodingProvider` devuelve una lista vacía para que el usuario ingrese
  y confirme coordenadas.
- `MockGeocodingProvider` produce coordenadas sintéticas, las rotula
  `[DEMO MOCK]`, asigna confianza cero y exige confirmación.
- El contrato `GeocodingProvider` admite geocodificación, reverse geocoding
  opcional, fuente, fecha, confianza y precisión.

## Privacidad

- Toda sugerencia requiere confirmación humana.
- Una solicitud de coordenadas exactas de domicilio de trabajador se reduce
  automáticamente a precisión de distrito.
- El tenant y la empresa provienen de la sesión.
- Las pantallas generales no deben mostrar domicilios precisos ni ubicaciones
  sensibles.
- La fuente y la fecha deben conservarse al persistir una corrección.
- Un adaptador externo futuro debe usar HTTPS allowlist, rate limits y respetar
  términos del proveedor.

El endpoint implementado es `/api/v1/maps/geocode`. Los agregados geográficos y
la persistencia autoritativa se conectarán al repositorio de datos de Fase 3;
esta entrega no inventa agregados vacíos ni resultados productivos.

