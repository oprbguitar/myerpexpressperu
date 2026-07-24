# Revisión de titularidad — cuestiones abiertas

Este documento existe porque la titularidad legal de ERP Express Perú **no
está resuelta**. La instrucción de Fase 4 exige registrar aquí ese hecho en
lugar de inventar un titular.

- **Abierto desde:** 2026-07-23
- **Estado:** pendiente de decisión del propietario del proyecto
- **Bloquea:** encabezados SPDX definitivos, `AUTHORS.md`, manifiestos de
  versión firmados, y cualquier distribución externa del software

## Por qué está abierto

Al establecer la línea base de Fase 4 se inspeccionó el repositorio en busca de
una declaración de titularidad aprobada por el propietario. **No se encontró
ninguna.** Concretamente:

- No existían `LICENSE`, `NOTICE`, `AUTHORS.md` ni `CONTRIBUTORS.md`.
- `LEGAL_OWNER_NAME` está vacío en `.env.example`.
- El directorio no estaba bajo control de versiones, por lo que no hay
  historial de commits del que derivar autoría de las Fases 1 a 3.
- Ningún documento de las Fases 1 a 3 nombra un titular de derechos.

La política de Fase 4 (§2, reglas 3 y 4) exige verificar una declaración
explícita antes de identificar a AndesNova Solutions o a una persona natural
como titular. Sin esa verificación, se aplica el valor colectivo por defecto
**«ERP Express Perú contributors»**, que es lo que hoy figura en `LICENSE`,
`NOTICE`, `docs/legal/OWNERSHIP.yml` y en todos los encabezados SPDX.

Ese valor es deliberadamente conservador: no atribuye derechos a nadie en
particular y, por tanto, no puede atribuirlos incorrectamente.

## Preguntas que debe responder el propietario

### 1. ¿Quién es el titular de los derechos de autor?

Opciones y sus consecuencias:

| Opción | Consecuencia |
| --- | --- |
| Persona natural (p. ej. Pierre R.) | Los derechos nacen en la persona. Simple si el desarrollo fue individual y no bajo relación laboral ni contrato de obra por encargo. |
| Persona jurídica (p. ej. AndesNova Solutions) | Requiere que exista cesión, relación laboral o contrato que transfiera los derechos a la empresa. Debe existir el documento. |
| Cotitularidad | Requiere acuerdo escrito sobre porcentajes y facultades de explotación. |

**Evidencia requerida antes de inscribir a cualquiera:** documento de
constitución de la empresa, contrato laboral o de servicios con cláusula de
propiedad intelectual, o acuerdo de cesión firmado.

### 2. ¿Hubo terceros involucrados?

Debe confirmarse si en las Fases 1 a 3 participaron empleados, practicantes,
contratistas o terceros. En el Perú, la titularidad sobre obras creadas bajo
relación laboral o por encargo depende del régimen contractual aplicable y no
puede presumirse. Si hubo terceros sin cesión escrita, pueden conservar
derechos.

### 3. ¿Se aprueba MPL-2.0 como licencia por defecto?

MPL-2.0 está adoptada **provisionalmente**. Antes de cualquier distribución
externa se requiere aprobación explícita, considerando que MPL-2.0 obliga a
publicar el código fuente de los archivos cubiertos que se modifiquen y
distribuyan. Si el plan de negocio contempla una versión propietaria, esa
decisión debe tomarse ahora y no después de distribuir.

### 4. ¿Qué régimen aplica a las partes asistidas por IA?

Partes de este software se produjeron con asistencia de herramientas de IA bajo
dirección humana. La Oficina de Derechos de Autor de Estados Unidos y otras
autoridades han señalado que el material generado por IA sin autoría humana
suficiente puede no ser registrable, y que al registrar una obra que contenga
material generado por IA debe divulgarse ese material.

Esto **no** es una determinación legal sobre este proyecto. Es una cuestión
que un abogado debe evaluar si se pretende registrar la obra. Los insumos para
esa evaluación están en `docs/compliance/ai-provenance/`.

## Cómo cerrar esta revisión

1. Obtener asesoría legal sobre las cuatro preguntas anteriores.
2. Registrar la decisión en `docs/legal/OWNERSHIP.yml`: cambiar
   `copyright.status` a `declared`, completar `holder`, `declared_by`,
   `declared_on` y `evidence`; y hacer lo propio con `license`.
3. Completar `AUTHORS.md` y `CONTRIBUTORS.md`.
4. Ejecutar `pnpm license:headers --apply` para propagar el titular definitivo
   a todos los archivos fuente.
5. Ejecutar `pnpm license:notices` para regenerar `THIRD-PARTY-NOTICES.md`.
6. Marcar este documento como cerrado, conservando el historial de la decisión.

## Lo que este documento no hace

No constituye asesoría legal. No determina la titularidad. No afirma que la
elección de MPL-2.0 sea correcta para el modelo de negocio del propietario. Su
única función es dejar constancia de que la cuestión está abierta, de modo que
nadie asuma que fue resuelta.
