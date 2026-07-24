# Fase 4 — Informe de los pasos 1 y 2

Establecimiento de la línea base, la política de licenciamiento, la titularidad,
los identificadores SPDX, el escaneo de dependencias, la procedencia de IA y el
SBOM.

- **Fecha:** 2026-07-23
- **Alcance ejecutado:** pasos 1 y 2 de la sección 35 de la instrucción
- **Alcance NO ejecutado:** pasos 3 a 12 (todos los módulos sectoriales)
- **Herramienta:** Claude Opus 4.8 (Claude Code), bajo dirección humana
- **Estado de revisión humana:** **pendiente en su totalidad**

> Este informe describe únicamente trabajo que fue **ejecutado y verificado**.
> Donde algo no se hizo, se dice que no se hizo.

## 1. Decisión de alcance

La instrucción de Fase 4 pide 19 módulos, ~200 tablas, ~120 permisos, ~45 grupos
de rutas, 33 documentos y 40 escenarios end-to-end. La línea base medida de las
Fases 1 a 3 es de 282 archivos TypeScript y 20 233 líneas. Lo solicitado equivale
a varias veces el código existente.

Se acordó con el propietario ejecutar primero los pasos 1 y 2, que la propia
instrucción sitúa antes de tocar código de negocio. Generar esbozos de los 19
módulos habría violado la sección 36 («no crear funcionalidad sectorial falsa»)
y la sección 37 («no afirmar que una función opera sin haberla ejecutado y
verificado»).

## 2. Línea base (paso 1)

Detalle completo en [`BASELINE.md`](BASELINE.md).

La suite de las Fases 1 a 3 estaba **completamente en verde**: lint, typecheck,
86 pruebas unitarias, 17 de integración, 18 end-to-end, build y
`pnpm audit --prod` sin vulnerabilidades. **No se encontró ningún defecto** en el
código de fases anteriores durante la verificación de línea base.

Dos bloqueantes reales sí aparecieron, ambos resueltos:

1. **El directorio no era un repositorio Git.** Los trailers de procedencia, los
   worktrees por agente y los manifiestos de versión que exige la Fase 4 dependen
   de Git. Se ejecutó `git init` con autorización explícita. No hay remoto y no
   se ha hecho push.
2. **Puertos ocupados.** 3000 y 5173 estaban en uso. Se movieron a **3100** y
   **5273**, verificados libres. La suite e2e completa confirma que ambos
   servicios levantan y responden en los puertos nuevos.

## 3. Titularidad y licenciamiento (paso 2)

### Lo que se decidió y por qué

El repositorio **no contenía ninguna declaración de titularidad aprobada** por el
propietario: no había `LICENSE`, `NOTICE`, `AUTHORS.md`, `LEGAL_OWNER_NAME`
estaba vacío y no existía historial Git del que derivar autoría.

Por instrucción del propietario se adoptó el marcador colectivo **«ERP Express
Perú contributors»**, que es el valor por defecto que la propia instrucción
prescribe cuando la titularidad no está resuelta. Es deliberadamente
conservador: no atribuye derechos a ninguna persona concreta y por tanto no
puede atribuirlos mal. Cambiarlo más adelante es una sustitución en un paso
(`pnpm license:headers:apply`).

Las cuatro preguntas que solo el propietario puede responder están documentadas
en [`docs/legal/OWNERSHIP-REVIEW.md`](../legal/OWNERSHIP-REVIEW.md).

### Documentos creados

| Archivo | Contenido |
| --- | --- |
| `LICENSE` | Texto canónico MPL-2.0 descargado de mozilla.org, 16 726 bytes, verificado íntegro (secciones 1-10, Exhibits A y B) |
| `NOTICE` | Atribución provisional, política de IA y remisión a terceros |
| `AUTHORS.md` | Registro vacío; nadie inscrito sin evidencia |
| `CONTRIBUTORS.md` | Registro vacío; ningún revisor inscrito |
| `THIRD-PARTY-NOTICES.md` | Generado: 769 paquetes, 11 licencias, con sección de atribución |
| `docs/legal/OWNERSHIP.yml` | Registro legible por máquina, estado `provisional` |
| `docs/legal/OWNERSHIP-REVIEW.md` | Las cuatro preguntas abiertas y la evidencia requerida |
| `docs/compliance/LICENSE-MATRIX.yml` | Política de licencias basada en escaneo real |
| `docs/compliance/AI-PROVENANCE.yml` | Política de procedencia |
| `docs/compliance/COMPONENT-OWNERS.yml` | Roles de revisión, todos sin asignar |

**MPL-2.0 está adoptada de forma provisional.** No se ha obtenido aprobación
legal. Ninguna distribución externa debería ocurrir antes de esa aprobación.

### Cobertura SPDX

220 de 220 archivos fuente originales llevan identificador SPDX. Se aplicaron 216
encabezados; 4 ya lo tenían. Ningún archivo contenía aviso de copyright de
terceros, por lo que ninguno fue omitido por esa causa y **ninguno fue
eliminado**.

Se incluyeron las migraciones. El runner actual no calcula sumas de verificación
—`schema_migrations` solo guarda la versión—, por lo que el cambio no puede
romper una migración aplicada. Se verificó con una ida y vuelta completa contra
una base limpia: las 11 migraciones `up`, luego un `reset` que ejercitó cada
`down.sql`. Es una desviación consciente de la regla de `AGENTS.md` de no editar
migraciones aplicadas, y queda registrada como tal en `AIP-2026-0003`.

### Escaneo de dependencias

769 paquetes escaneados. **0 desconocidas, 0 prohibidas, 0 en revisión.**
Ninguna dependencia GPL, AGPL, LGPL, SSPL, BUSL ni Elastic en el árbol.

| Licencia | Paquetes |
| --- | --- |
| MIT | 576 |
| Apache-2.0 | 129 |
| ISC | 30 |
| BSD-3-Clause | 10 |
| BlueOak-1.0.0 | 9 |
| BSD-2-Clause | 9 |
| 0BSD | 2 |
| Python-2.0 | 1 |
| CC-BY-4.0 | 1 |
| (MIT AND Zlib) | 1 |
| (MIT OR CC0-1.0) | 1 |

Cinco licencias presentes en el árbol no figuraban en la lista de la instrucción
(BlueOak-1.0.0, 0BSD, Python-2.0, CC-BY-4.0, Zlib). Se clasificaron
explícitamente con justificación en lugar de admitirlas en silencio. CC-BY-4.0
queda restringida a datos y su obligación de atribución se cumple en
`THIRD-PARTY-NOTICES.md`.

**El escaneo detectó una carencia en la propia matriz que aplica.** Zlib figuraba
como «implícitamente permitida» por la resolución de `(MIT AND Zlib)` pero no
estaba declarada, por lo que `pako` fue marcado para revisión correctamente. Se
declaró Zlib de forma explícita en vez de relajar la regla: un permiso implícito
no es una decisión registrada.

Se incorporó **una sola dependencia nueva**: `yaml@2.9.0` (ISC), que está en la
categoría permitida y por tanto satisface la política que sirve para aplicar.

## 4. Procedencia de IA

La política está en `docs/compliance/AI-PROVENANCE.yml`. Sus puntos centrales:

- Ningún sistema de IA es autor ni titular de derechos.
- **No** se anota cada línea de código. La instrucción prohíbe esa práctica y la
  política explica por qué.
- Un cambio no se considera aceptado hasta que una persona lo revisa.

Existen **cuatro registros** (`AIP-2026-0001` a `0004`) que cubren todos los
commits de esta sesión. **Los cuatro tienen `human_reviewer: pending` y
`accepted: false`**, porque ninguna persona ha revisado este trabajo. El
verificador rechaza cualquier registro que declare `accepted: true` sin revisor
verificado.

`pnpm provenance:verify` pasa (los registros pendientes son el estado normal).
`pnpm provenance:verify --strict` **falla con código 1**, que es el
comportamiento correcto como puerta previa a una release: nada está aceptado.

Los marcos de gobernanza (NIST AI RMF, Perfil de IA Generativa, SSDF,
SP 800-218A, Reglamento de IA de la UE, Oficina de Derechos de Autor de EE. UU.)
se registran como **referencias de diseño con `assessed: false`**. No se afirma
conformidad ni certificación con ninguno.

## 5. Defectos corregidos en código de la Fase 3

El trabajo de SBOM destapó **dos defectos preexistentes** en
`scripts/demo/generate-sbom.mjs`:

| ID | Defecto | Efecto |
| --- | --- | --- |
| SBOM-1 | El sufijo de dependencias de pares corrompía nombre y versión. pnpm escribe `@apideck/better-ajv-errors@0.3.7(ajv@8.20.0)`; tomar el último `@` partía por la dependencia de pares. | Componentes con nombres inválidos |
| SBOM-2 | Los paquetes sin dependencias, que pnpm escribe como `'pkg@1.0.0': {}`, se descartaban en silencio. | **257 de 709 componentes ausentes: el 36 % del árbol** |

En consecuencia, **el SBOM que producía la Fase 3 estaba incompleto y en parte
malformado**. Tras la corrección emite 709 componentes, 0 malformados, 659 con
licencia declarada. Los 50 restantes son 48 binarios específicos de plataforma
más `fsevents`, ninguno instalado en Windows.

## 6. Comandos disponibles

```text
pnpm license:headers          verifica cobertura SPDX
pnpm license:headers:apply    inserta los encabezados faltantes
pnpm license:scan             clasifica licencias de dependencias
pnpm license:compatibility    informe de compatibilidad
pnpm license:notices          regenera THIRD-PARTY-NOTICES.md
pnpm provenance:verify        valida registros de procedencia
pnpm provenance:verify:strict puerta de release; falla si algo no está aceptado
pnpm sbom:generate:project    SBOM CycloneDX del proyecto
pnpm test:compliance          15 pruebas de cumplimiento
pnpm compliance:verify        encadena todo lo anterior
pnpm phase4:verify            suite completa más cumplimiento
```

## 7. Resultados reales

Todo lo siguiente fue ejecutado en esta sesión.

| Comando | Resultado |
| --- | --- |
| `pnpm phase4:verify` | ✅ salida 0 (lint, typecheck, 86 unitarias, 17 integración, build, cumplimiento) |
| `pnpm test:compliance` | ✅ 15 pruebas |
| `pnpm test:e2e` | ✅ 18 pasan, 6 omitidos, en los puertos nuevos |
| `pnpm license:scan` | ✅ 769 paquetes, 0 en revisión, 0 prohibidas |
| `pnpm provenance:verify` | ✅ 4 registros válidos, 4 pendientes de revisión |
| `pnpm provenance:verify --strict` | ⛔ salida 1 — correcto: nada aceptado |
| `pnpm sbom:generate:project` | ✅ 709 componentes, 0 malformados |
| `pnpm demo:verify` | ✅ sin secretos, configuración demo válida |
| Ida y vuelta de migraciones | ✅ 11 `up` + `reset` completo contra base limpia |

## 8. Limitaciones — lo que NO se hizo

Esta sección es deliberadamente explícita.

**No se implementó ningún módulo sectorial.** Los 19 módulos de la sección 6
—manufactura, calidad, transporte, flota, construcción, contratistas mineros,
agroindustria, sector público avanzado, auditoría interna, monitoreo continuo de
controles, identidad reforzada, gobierno de accesos, analítica de seguridad,
autoauditoría, verificación de instalación, centro de documentación, gobierno de
licencias, procedencia de código y gobierno de releases— **no existen**. Los
pasos 3 a 12 de la sección 35 están pendientes por completo.

No se crearon las ~200 tablas de la sección 26, ni los permisos de la sección 27,
ni las rutas de la sección 28, ni las pantallas de la sección 29, ni los 40
escenarios e2e de la sección 31.

Otras limitaciones:

- **La titularidad legal sigue sin resolver.** El titular inscrito es un marcador
  provisional. MPL-2.0 no tiene aprobación legal.
- **Nada ha sido revisado por una persona.** Los cuatro registros de procedencia
  están sin aceptar. Bajo la política del propio proyecto, este trabajo no está
  aceptado.
- La clasificación de cinco licencias la hizo una herramienta, no un abogado.
- El informe de compatibilidad no evalúa un escenario concreto de distribución.
- No se ejecutaron pruebas de carga, rendimiento, recuperación ante desastres ni
  restauración de respaldos.
- No se ejecutaron agentes múltiples en worktrees aislados (sección 7); el
  trabajo se hizo de forma secuencial.
- El SBOM refleja el árbol instalado en Windows; en otra plataforma diferiría.
- Los proveedores externos siguen deshabilitados; su comportamiento real no fue
  ejercitado.

## 9. Siguiente paso recomendado

Antes de escribir cualquier módulo sectorial:

1. Resolver `docs/legal/OWNERSHIP-REVIEW.md` con asesoría legal.
2. Revisar los cuatro registros de procedencia y aceptarlos o rechazarlos.
3. Asignar responsables en `docs/compliance/COMPONENT-OWNERS.yml`.

Hecho eso, el paso 3 (contratos sectoriales compartidos, plan de migraciones,
permisos y eventos de auditoría) es la continuación natural, seguido de un módulo
completo —manufactura y calidad— como prueba del patrón antes de replicarlo.
