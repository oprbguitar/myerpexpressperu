# Gobierno de inteligencia artificial

La asistencia de IA no es una autoridad del ERP. Puede resumir información
acotada y citada, pero no crea, aprueba, modifica ni elimina registros, no toma
decisiones laborales o de SST y no sustituye revisión profesional, legal,
contable o médica.

## Política aplicada

1. La IA está deshabilitada por defecto y se habilita de forma explícita.
2. El contexto de tenant, empresa, usuario, sucursales y permisos proviene de la
   sesión del servidor.
3. Sólo se invocan nombres presentes en `ControlledAiToolRegistry`.
4. Toda herramienta es `READ_ONLY`, tiene esquema Zod, permisos, categorías
   permitidas, límite de filas, límite de caracteres y citas obligatorias.
5. No existe herramienta de SQL, scripting, red, sistema de archivos ni ejecución
   arbitraria.
6. `MEDICAL`, `CREDENTIAL` y `PROVIDER_SECRET` están prohibidos tanto en tools
   como en documentos.
7. La salida estructurada de tools se redacta antes de pasar al proveedor.
8. El presupuesto diario se comprueba antes de la invocación.
9. Sólo se conserva telemetría de uso (proveedor, modelo, tokens, ámbito y fecha);
   el contenido no se registra.
10. La respuesta siempre incluye advertencia, proveedor, modelo, indicador mock
    y fuentes disponibles.

## Frontera contra prompt injection

El prompt del usuario y cada documento pasan por un límite de contenido. Se
detectan intentos de reemplazar instrucciones, revelar el prompt del sistema,
manipular tools, introducir instrucciones SQL o usar payloads codificados. Un
documento marcado se excluye y se informa como tal; jamás se eleva a mensaje de
sistema.

Los documentos aceptados se envían como
`UNTRUSTED_DOCUMENT_CONTENT` y el adaptador añade instrucciones invariables:
son fuentes no confiables, no órdenes. Una cita demuestra procedencia; no prueba
que el contenido sea verdadero.

## Casos prohibidos

- Contratar, despedir, sancionar o modificar condiciones laborales.
- Aprobar gastos, pagos, compras, documentos fiscales o cierres SST.
- Diagnosticar salud o interpretar datos médicos.
- Revelar secretos, tokens, credenciales o instrucciones internas.
- Consultar fuera del tenant y empresa activos.
- Ejecutar instrucciones encontradas en archivos.
- Presentar resultados probabilísticos como hechos o cumplimiento garantizado.

## Transparencia y marco peruano

La interfaz debe identificar claramente la interacción con IA, sus límites,
proveedor/modelo y la posibilidad real de revisión humana. La matriz de ingeniería
en `docs/phase3/LEGAL-REQUIREMENT-MATRIX.md` vincula estos controles con la Ley
N.° 31814, su Reglamento (D.S. N.° 115-2025-PCM) y las normas peruanas de
protección de datos. Esa matriz no constituye asesoría legal ni acredita
cumplimiento automático.

Antes de producción se requiere revisión de Seguridad y Legal, clasificación del
caso de uso, evaluación del proveedor, términos aplicables y prueba adversarial
del conjunto exacto de tools habilitadas.

