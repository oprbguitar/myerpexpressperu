# Reporte del Agente 5 — Legal and Compliance

**Fase:** 3 — Intelligent Operations  
**Fecha:** 23 de julio de 2026  
**Alcance ejecutado:** verificación de fuentes oficiales peruanas y traducción de requisitos mínimos a controles de producto.  
**Archivos modificados:** únicamente este reporte y `docs/phase3/LEGAL-REQUIREMENT-MATRIX.md`.

## Resultado

Se creó una matriz normativa trazable con institución, fecha, estado de aplicabilidad, fuente oficial y control recomendado para:

- Ley N.° 29733 y D.S. N.° 016-2024-JUS;
- Ley N.° 31814 y D.S. N.° 115-2025-PCM;
- D. Leg. N.° 1412 y D.S. N.° 029-2021-PCM con modificatorias identificadas;
- Ley N.° 27269;
- Ley N.° 29571 y D.S. N.° 011-2011-PCM;
- D. Leg. N.° 822;
- Ley N.° 29783 y D.S. N.° 005-2012-TR;
- normativa SUNAT relevante para CPE.

Todas las fuentes registradas son portales oficiales del Estado peruano: Congreso, PCM, MINJUSDH/ANPD, Indecopi, Presidencia y SUNAT. No se usaron blogs, estudios jurídicos ni resúmenes comerciales como autoridad.

## Hallazgos críticos

### 1. IA en RR. HH. es un límite de alto riesgo

El D.S. N.° 115-2025-PCM clasifica como alto riesgo el uso de IA para determinar selección, evaluación, contratación, cese y condiciones laborales. Por ello, el ERP no debe permitir que una salida de IA cause automáticamente esos efectos. Se requieren clasificación previa, transparencia, evidencia, supervisión humana efectiva y capacidad de detener, corregir o invalidar.

### 2. IA y SST requieren una prohibición funcional, no solo un aviso

La norma incluye usos de salud y determinadas inferencias en categorías de alto riesgo. Para esta fase se recomienda impedir diagnóstico, priorización clínica, inferencia emocional y decisión laboral autónoma. Un texto de descargo no compensa una arquitectura que permita la acción automática.

### 3. El nuevo Reglamento de datos personales ya está vigente

La ANPD indica que el D.S. N.° 016-2024-JUS entró en vigencia el 31 de marzo de 2025. Deben contemplarse inscripción de bancos, derechos del titular, privacidad por diseño, gobierno de proveedores, transferencias, evaluación de impacto y un flujo de incidentes capaz de preparar la notificación inicial a la ANPD dentro de 48 horas desde el conocimiento, sin asumir que el software decide por sí solo qué o a quién notificar.

### 4. Datos médicos no deben heredar permisos generales de RR. HH.

Accidentes, restricciones, aptitud y vigilancia ocupacional pueden revelar salud. Se recomienda autorización separada, vistas minimizadas, auditoría sin contenido clínico excesivo y prohibición de enviar esos datos a OCR/IA externos por defecto.

### 5. Aceptación electrónica no equivale automáticamente a firma digital

La Ley N.° 27269 y la orientación oficial distinguen la firma digital generada dentro de la IOFE. La interfaz debe evitar esa denominación si solo existe nombre digitado, imagen, OTP o casilla. Se requiere proveedor acreditado, certificado, validación, integridad y evidencia.

### 6. Demo fiscal no significa integración SUNAT

La normativa CPE es dinámica y depende del RUC y operación. Los adaptadores mock/manual deben indicar “No enviado a SUNAT”. Solo se puede afirmar aceptación cuando exista respuesta real verificable del sistema correspondiente.

### 7. Gobierno digital es principalmente condicional para este SaaS

El D. Leg. N.° 1412 y su Reglamento se dirigen a entidades de la Administración Pública. Son directamente relevantes si el ERP sirve a una entidad pública o se integra a sus procedimientos, pero no deben convertirse en una declaración genérica de obligación idéntica para toda MYPE privada.

### 8. La relación de consumo debe determinarse por caso

La Ley N.° 29571 y el Libro de Reclamaciones no se aplican de forma idéntica a toda operación empresarial. Si ERP Express Perú actúa como proveedor dentro del alcance, el canal debe ser visible, conservar correlativos y atender en el plazo vigente de 15 días hábiles.

## Controles que deben tratarse como criterios de aceptación

1. Bloqueo de decisiones laborales automáticas basadas en IA.
2. Registro de sistema IA, proveedor/modelo/versión, finalidad, riesgo y aprobación.
3. Etiqueta y explicación accesible de IA cuando corresponda.
4. Supervisión humana con botón real de detener, corregir o invalidar.
5. Prohibición de SQL irrestricto y lista cerrada de herramientas.
6. Separación de permisos para salud ocupacional.
7. Flujo de incidentes de datos personales con reloj y evidencia.
8. Registro versionado de avisos, consentimiento, revocación y derechos.
9. Diferenciación visible entre aceptación electrónica y firma digital IOFE.
10. Diferenciación visible entre mock/manual y transmisión SUNAT real.
11. Procedencia/licencia de código, activos, documentos y datos demo.
12. Libro de Reclamaciones separado del help desk interno, cuando aplique.

## Observaciones sobre vigencia

- El portal oficial del D.S. N.° 029-2021-PCM identifica modificaciones por D.S. N.° 075-2023-PCM y D.S. N.° 098-2025-PCM.
- El D.S. N.° 115-2025-PCM contiene vigencia general diferida y cronogramas graduales por sector y tamaño. La matriz evita fijar una fecha universal para cada cliente; esa fecha debe calcularse durante el onboarding jurídico.
- SUNAT actualizó en 2026 su orientación y normativa de emisores electrónicos. La implementación debe usar reglas versionadas por fecha y no una constante global.
- Los portales de Gob.pe a veces muestran la fecha de incorporación del archivo al portal en vez de la fecha original de publicación. Donde era material, se contrastó con la ficha del Congreso o la publicación oficial.

## Limitaciones y dictamen

No se realizó una opinión legal para una empresa, RUC, contrato, actividad o tratamiento específico. Tampoco se verificó homologación SUNAT, acreditación IOFE de un proveedor, inscripción efectiva de bancos de datos ni cumplimiento operativo de un cliente.

**Dictamen de ingeniería:** la Fase 3 puede continuar si los controles bloqueantes de la matriz se incorporan como requisitos verificables. No debe anunciarse “cumplimiento legal”, “IA conforme”, “firma digital válida” o “integración SUNAT certificada” basándose solo en esta documentación o en una demo.

