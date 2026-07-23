# Reporte 07 — AI, OCR and Provider

**Fecha:** 23 de julio de 2026  
**Agente:** 7 — AI, OCR and Provider  
**Estado:** implementación especializada terminada; montaje y revisiones
independientes pendientes del coordinador.

## Alcance entregado

- Contratos provider-neutral de lifecycle/health, IA, OCR, geocodificación,
  métricas, trazas y reporte de errores.
- `NoAiProvider`, mock rotulado, OpenAI-compatible local/cloud y Ollama.
- OCR deshabilitado, mock, motor local inyectable y HTTP externo controlado.
- Geocodificación manual y mock con reducción de precisión.
- Timeouts, circuit breaker, allowlist, respuesta acotada y errores sin secretos.
- Centro de providers que exporta sólo configuración no secreta y exige
  confirmación para cloud en producción.
- Tool registry cerrado, sólo lectura, con Zod, permisos, scope de sesión,
  clasificación, límites, citas y redacción.
- Límite de prompt injection y exclusión de documentos hostiles.
- API autocontenida para `/api/v1/ai`, `/api/v1/ocr`,
  `/api/v1/maps/geocode` y `/api/v1/admin/providers`.
- OCR idempotente que requiere revisión humana y nunca crea registros finales.

## Decisiones de seguridad

- IA y OCR arrancan deshabilitados.
- Mock siempre se identifica en payload y texto.
- No hay API keys, secretos reales ni valores de credenciales en el repositorio.
- No hay SQL, shell, scripting o tools consecuenciales.
- Datos médicos, credenciales y secretos no se transmiten.
- Se conserva sólo metadata de uso AI; no prompts ni documentos.
- El registro en memoria no se presenta como persistencia productiva.

## Pruebas ejecutadas

```text
pnpm --filter @erp/contracts typecheck
RESULTADO: PASS

pnpm --filter @erp/api typecheck
RESULTADO inicial: FAIL por cuatro incompatibilidades exactOptionalPropertyTypes
en archivos de este agente; fueron corregidas.
RESULTADO final: PASS

pnpm --filter @erp/api test
RESULTADO: PASS — 4 archivos, 10 pruebas.

pnpm exec eslint apps/api/src/phase3/{ai,ocr,maps,providers} \
  apps/api/src/phase3/intelligence.module.ts apps/api/src/phase3/index.ts \
  packages/contracts/src/phase3 --max-warnings=0
RESULTADO: PASS
```

Cobertura focalizada:

- IA deshabilitada y mock rotulado.
- Bloqueo de endpoint local no-loopback y origen cloud no permitido.
- Confirmación productiva de provider cloud.
- Exportación sin referencia de secreto.
- Tool inexistente, permiso ausente, categoría médica prohibida.
- Documento con `ignore previous instructions` excluido.
- OCR idempotente, revisión y handoff sólo de borrador.
- Rechazo OCR médico.
- Reducción de precisión de domicilio de trabajador.

## Integración solicitada

El coordinador debe:

1. conservar el export de `packages/contracts/src/phase3/index.ts` en el índice
   compartido;
2. importar `Phase3IntelligenceModule` una sola vez en `AppModule`;
3. conectar providers y políticas con configuración versionada/secret store;
4. sustituir repositorios volátiles de jobs/uso por tablas RLS aprobadas;
5. registrar variables y health scripts en la ventana exclusiva de integración.

## Revisiones obligatorias

- **Seguridad/Privacidad (Agente 4):** clasificación, redacción, SSRF/allowlist,
  secreto write-only, prompt injection, ámbito y almacenamiento.
- **Legal (Agente 5):** avisos de IA, categorías, proveedor/transferencia,
  consentimiento y límites de interpretación OCR.
- **QA adversarial (Agente 8):** exfiltración, manipulación de tool, MIME/archivo
  hostil, cross-tenant, presupuesto, timeouts y montaje real.

No se afirma cumplimiento legal automático ni funcionamiento de un proveedor
externo real. No hubo push, despliegue remoto ni modificación destructiva.
