# Respuesta a incidentes

## Objetivo

Contener el incidente, proteger a las personas, preservar evidencia y cumplir
las obligaciones aplicables sin exponer más datos. Este runbook necesita
responsables, contactos y simulacros definidos por cada organización.

## Severidad inicial

| Nivel | Ejemplo | Respuesta |
|---|---|---|
| SEV-1 | Exposición cross-tenant, secreto productivo, datos médicos, borrado o control administrativo | Activación inmediata, contención prioritaria y dirección/legal/privacidad |
| SEV-2 | Acceso indebido acotado, proveedor comprometido o pérdida parcial de integridad/disponibilidad | Activación urgente y evaluación de alcance |
| SEV-3 | Intento bloqueado, fallo sin evidencia de acceso o degradación menor | Registrar, corregir y vigilar escalamiento |

La severidad puede subir al descubrir categorías sensibles, múltiples titulares,
persistencia, exfiltración, falta de logs o riesgo material.

## Flujo

1. **Detectar y abrir expediente:** identificador, hora de conocimiento, fuente,
   responsable, sistemas, categorías y severidad provisional.
2. **Contener:** revocar sesiones/tokens, deshabilitar proveedor o herramienta,
   aislar job/tenant y bloquear la vía sin destruir evidencia.
3. **Preservar:** snapshots y logs con acceso restringido, hashes, zona horaria,
   cadena de custodia y legal hold.
4. **Analizar:** vector, periodo, tenants/empresas, titulares, datos, acciones,
   proveedores, integridad, disponibilidad y exfiltración.
5. **Erradicar y recuperar:** corregir, rotar, restaurar, verificar aislamiento,
   monitorear recurrencia y documentar pruebas.
6. **Notificar y comunicar:** legal/privacidad determina destinatarios, contenido
   y plazo; soporte conserva la evidencia de envío y actualización.
7. **Cerrar:** causa raíz, controles, responsables, fechas y seguimiento.

## Reloj de datos personales

Al confirmar que un incidente involucra datos personales se conserva la hora de
conocimiento y se activa un reloj interno de **48 horas** para preparar la
evaluación y eventual notificación inicial a la ANPD, conforme al requisito
identificado en la matriz legal. Legal/privacidad debe validar aplicabilidad,
afectación, destinatarios y comunicaciones a titulares; el reloj del software no
decide por sí solo que una notificación sea o no obligatoria.

## Evidencia mínima

- línea de tiempo en UTC y hora Lima;
- actor/sistema que detectó, autorizó contención y restauró;
- IDs técnicos y conteos, no documentos completos en el expediente general;
- configuración, versión, proveedor/modelo y cambios relevantes;
- sesiones, secretos y herramientas revocadas;
- queries, artefactos y hashes preservados;
- evaluación de titulares/categorías/impacto y decisiones legales;
- pruebas de corrección, aislamiento y no recurrencia.

## Simulacros mínimos

- lectura cross-tenant;
- secreto de proveedor expuesto;
- documento médico enviado a proveedor;
- prompt injection que solicita herramienta o SQL;
- OCR fraudulento confirmado por error;
- intento de demo reset en producción;
- eliminación que alcanza un registro bajo legal hold.

Cada simulacro verifica activación, reloj, roles, evidencia, comunicaciones y
restauración. Nunca se usan datos reales de personas en el ejercicio.
