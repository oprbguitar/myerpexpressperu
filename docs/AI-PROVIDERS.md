# Proveedores de IA — Fase 3

## Estado operativo

La IA es opcional y arranca en `DISABLED` mediante `NoAiProvider`. El arranque de
la API no depende de red, credenciales ni modelos. `Phase3IntelligenceModule`
encapsula los controladores, el registro de herramientas y el centro de
proveedores; el coordinador de arquitectura debe montarlo en `AppModule` después
de las revisiones de Seguridad y Legal.

## Adaptadores disponibles

| Adaptador | Modo | Red | Uso |
| --- | --- | --- | --- |
| `NoAiProvider` | `DISABLED` | No | Valor inicial seguro; toda invocación falla con `AI_DISABLED`. |
| `MockAiProvider` | `MOCK` | No | Pruebas/demo. Toda salida incluye `DEMO MOCK AI` y `mock: true`. |
| `LocalOpenAiCompatibleProvider` | `LOCAL` | Loopback | Endpoint compatible bajo `localhost`, `127.0.0.1` o `::1`. |
| `OllamaProvider` | `LOCAL` | Loopback | Generación local mediante `/api/generate`. |
| `CustomOpenAiCompatibleProvider` | `CLOUD` | HTTPS allowlist | Integración externa explícita, con origen permitido y credencial resuelta sólo en servidor. |

OpenAI, Gemini, Anthropic, Mistral, Groq y OpenRouter son posibles implementaciones
del puerto `ArtificialIntelligenceProvider`; no se presentan como configurados ni
probados en esta fase. El adaptador compatible no garantiza compatibilidad con un
servicio concreto: cada proveedor requiere pruebas contractuales y revisión de
términos, privacidad, residencia, costos y límites.

## Seguridad de configuración

- La configuración pública sólo indica si existe una referencia a secreto.
- Una referencia (`secret://...`) nunca se exporta como valor ni se registra en
  logs.
- El resolvedor de credenciales se inyecta en servidor y su resultado sólo se
  usa para la cabecera de la solicitud.
- Los endpoints locales se limitan a loopback.
- Los endpoints externos requieren HTTPS y una allowlist exacta de orígenes.
- Los timeouts y circuit breaker limitan fallos repetidos.
- La respuesta externa se limita a 1 MB y se valida con Zod.
- Un proveedor `CLOUD` no se activa en producción sin confirmación explícita.

No se creó, solicitó ni almacenó ninguna API key. Tampoco se realizó una llamada
externa en las verificaciones de esta entrega.

## Gestión

`/api/v1/admin/providers` permite listar, probar, activar, desactivar y exportar
configuración no secreta, sujeto a permisos granulares. El registro actual es
volátil y sirve como adaptador de aplicación; la persistencia versionada y la
rotación real de referencias pertenecen al repositorio de configuración de Fase
3 y deben integrarse con la migración aprobada.

## Variables propuestas para integración

Estas claves deben añadirse al esquema central sólo durante la ventana de
integración:

```text
AI_ENABLED=false
AI_PROVIDER=disabled
AI_BASE_URL=
AI_MODEL=
AI_DAILY_BUDGET=0
AI_MONTHLY_BUDGET=0
AI_DATA_RETENTION=metadata-only
AI_LOG_CONTENT=false
PROVIDER_SECRET_STORE=
```

`AI_LOG_CONTENT=false` es el valor seguro. Ninguna variable contiene un secreto;
las credenciales se resuelven por referencia.

