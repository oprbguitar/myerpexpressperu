# Decisión de preparación para Fase 4

- **Fecha:** 2026-07-23
- **Método:** verificación independiente por ejecución
- **Revisión humana:** pendiente

## Decisión

```text
PHASE_4_NOT_READY
```

> **Actualización 2026-07-24 (estabilización S0/S1/S2/S3).** El veredicto se
> mantiene, pero varias condiciones han avanzado:
> - Gate A (Arquitectura): FAIL → **CONDITIONAL_PASS** — C-2 cerrado por S2
>   (enforcement de módulos en API/worker/frontend, fail-closed); queda H-1
>   (dominio muerto, decisión D-7) y unificación de estructura (S8).
> - Gate B (Base de datos): FAIL → **CONDITIONAL_PASS** — RLS efectiva (S1);
>   faltan checksums de migración (S5).
> - Gate E (Calidad): FAIL → **CONDITIONAL_PASS** — integración en cerrado + CI
>   + cobertura medible (S3); faltan pruebas HTTP de la superficie y e2e en CI.
> - Gates C (Seguridad), D (Fiabilidad) y F (Gobernanza) sin cambios.
>
> El veredicto global **`PHASE_4_NOT_READY`** no cambia hasta que **todas** las
> puertas técnicas obligatorias pasen. Detalle por etapa en `docs/stabilization/`.

## Clasificación de puertas (§20)

| Puerta | Criterio | Estado | Fundamento |
| --- | --- | --- | --- |
| **A — Arquitectura** | Una convención de ubicación, grafo revisado, sin ciclos críticos, límites documentados, modelo de madurez | **FAIL** | Desactivación de módulos no aplicada en ~80 endpoints de Fase 1/2 y la API afirma lo contrario (C-2). Capa de dominio de Fase 3 es código muerto (H-1). Modelo de madurez sigue siendo booleano. 6 ciclos barril↔hoja en `packages/domain`. |
| **B — Base de datos** | Checksums de migración, matriz de aislamiento, pruebas entre tenants, instalación limpia, ruta de actualización segura | **FAIL** | Aplicación conecta como superusuario con `BYPASSRLS`: las 16 políticas están inertes (C-1). Sin checksums de migración. Sin ninguna prueba que ejerza aislamiento real. Instalación limpia y `reset` sí verificados. |
| **C — Seguridad** | Revocación de sesión verificada, desactivación invalida acceso, proxy clasificado, diseño IP documentado, plan MFA aprobado, sin IDOR crítico | **FAIL** | Proxy corregido y reclasificado a `REQUIRES_CONFIGURATION` (C-3, corregido). Pero: revocación administrativa de sesiones de terceros no existe; desactivación de usuario con sesión activa sin verificar; MFA ausente y sin plan aprobado; IDOR no probado en ninguna ruta. |
| **D — Fiabilidad** | Arquitectura de worker aprobada, modelo de reintentos definido, respaldo restaurado, plan de staging verificado | **FAIL** | Worker de 133 líneas sin reintentos, backoff, bloqueo, dead-letter ni programación; además ignora la activación de módulos (H-4). **Ninguna restauración de respaldo ejecutada.** **Ningún staging remoto desplegado.** |
| **E — Calidad** | Omitidas justificadas, e2e de flujos críticos, matriz requisito-prueba, línea base de cobertura, recorridos móviles | **FAIL** | Suite de integración sale 0 con 17/17 omitidas (C-4). RLS afirmada pero nunca ejercida (H-2). 73 archivos de API sin pruebas (H-3). Cobertura inmedible (H-6). Sin CI (H-7). Las 6 omisiones e2e están justificadas pero 2 de 3 razones son excesivamente amplias. |
| **F — Gobernanza** | Titularidad documentada o bloqueando distribución, licencias documentadas, revisores asignados, procedencia listada, propietarios de componente asignados | **CONDITIONAL_PASS** | Licenciamiento, SPDX, SBOM y procedencia verificados y operativos. Pero titularidad legal sin resolver, MPL-2.0 sin aprobación, 6 registros de procedencia sin revisión humana, y `COMPONENT-OWNERS.yml` con todos los propietarios en `null`. |

**Resultado: 5 puertas en FAIL, 1 en CONDITIONAL_PASS. Ninguna en PASS.**

## Respuestas a las 14 preguntas de §23

| # | Pregunta | Respuesta |
| --- | --- | --- |
| 1 | ¿Es el sistema arquitectónicamente coherente? | **Parcialmente.** La dirección de dependencias y la disciplina de controladores son buenas. Pero dos afirmaciones arquitectónicas centrales son falsas en código. |
| 2 | ¿Son reales los límites de módulo? | **No.** Reales en Fase 3 vía `@RequireModule`; inexistentes en Fase 1/2 y en el worker. |
| 3 | ¿Está el aislamiento de tenant verificado sistemáticamente? | **No.** Funciona por filtrado de aplicación, no por RLS. Ninguna prueba lo ejerce. |
| 4 | ¿Son las migraciones seguras y detectables ante manipulación? | **Seguras sí** (instalación limpia e ida y vuelta verificadas). **Detectables no**: sin checksums. |
| 5 | ¿Es la autenticación suficiente para alfa interna? | **Sí, con condiciones.** Argon2, bloqueo por usuario, TTL y reset funcionan. Falta revocación administrativa y MFA. |
| 6 | ¿Es seguro para un piloto controlado? | **No todavía.** Requiere C-1, C-2 y las condiciones obligatorias de abajo. |
| 7 | ¿Es seguro para producción? | **No.** Sin despliegue remoto, sin restauración de respaldo verificada, sin MFA, sin RLS efectiva, sin revisión humana. |
| 8 | ¿Está el worker listo para Fase 4? | **No.** Es un bucle de outbox de 133 líneas. |
| 9 | ¿Está verificada la restauración de respaldo? | **No. Nunca se ejecutó.** |
| 10 | ¿Se ha verificado staging remoto? | **No. Nunca se desplegó.** |
| 11 | ¿Son usables los flujos principales? | **No verificado en esta revisión.** Los 5 recorridos de §13 no se ejecutaron. |
| 12 | ¿Están resueltas la titularidad y el licenciamiento? | **Licenciamiento sí. Titularidad no.** |
| 13 | ¿Debe continuar la Fase 4? | **Sí, pero empezando por estabilización, no por módulos sectoriales.** |
| 14 | ¿Qué subfase debe empezar primero? | **4A — cimientos de arquitectura y base de datos.** |

## Condiciones obligatorias

Deben cerrarse **antes** de escribir cualquier módulo de negocio de Fase 4.

### Bloqueantes de seguridad

1. **Crear un rol de aplicación restringido en PostgreSQL** sin `SUPERUSER` ni
   `BYPASSRLS`, con `GRANT` mínimo, y apuntar `DATABASE_URL` a él. Aplicar
   `FORCE ROW LEVEL SECURITY` a todas las tablas con ámbito de tenant. Migraciones
   y semillas conservan un rol de mantenimiento separado.
2. **Añadir una prueba de comportamiento de RLS** que conecte con el rol de
   aplicación, fije el GUC de tenant, e imponga que una lectura cruzada devuelva
   **0 filas**. Sin esta prueba, la corrección anterior puede revertirse sin que
   nadie lo note.
3. **Aplicar `@RequireModule` a todo endpoint de Fase 1/2 asociado a un módulo
   desactivable**, o bien impedir en `modules.service.disable` la desactivación de
   códigos sin punto de aplicación. **Corregir el texto de `consequences`** para
   que describa lo realmente aplicado.
4. **Documentar `TRUSTED_PROXIES`** en la guía de despliegue y exigir su
   configuración explícita en cualquier entorno tras proxy inverso.

### Bloqueantes de calidad

5. **Hacer que `test:integration` FALLE cuando falte `DATABASE_URL`**, replicando
   el patrón de `tests/e2e/global-setup.ts`.
6. **Introducir CI** que ejecute lint, typecheck, test, test:integration y build.
   Sin CI, todas las demás condiciones son reversibles en silencio.
7. **Instalar cobertura** con umbral y eliminar `--passWithNoTests` de los
   workspaces que ya tienen pruebas.
8. **Endurecer `expectRejected`** para afirmar SQLSTATE o nombre de restricción.

### Bloqueantes de integridad de datos

9. **Implementar checksums de migración** con detección de archivos históricos
   modificados y anulación auditada explícita.

### Bloqueantes de gobernanza

10. **Resolver la titularidad legal** (`docs/legal/OWNERSHIP-REVIEW.md`).
11. **Revisar los 6 registros de procedencia** y aceptarlos o rechazarlos.
12. **Asignar propietarios** en `docs/compliance/COMPONENT-OWNERS.yml`.

### Decisión pendiente sobre el dominio de Fase 3

13. **Cablear `packages/domain/src/phase3/*` al runtime, o eliminarlo.** Dejarlo
    como está es peor que cualquiera de las dos opciones: 869 líneas y 25 pruebas
    verdes que no prueban nada del sistema. Requiere decisión humana porque
    implica o construir los endpoints de transición ausentes, o descartar trabajo.

## No bloqueantes, pero requeridos antes de piloto

- Restauración de respaldo ejecutada con éxito en entorno aislado.
- Un perfil de staging remoto desplegado y verificado.
- Los 5 recorridos de usuario de §13 ejecutados en escritorio y móvil.
- Línea base de rendimiento con datos representativos.
- Revocación administrativa de sesiones de terceros.
- Plan de endurecimiento de identidad aprobado (MFA, passkeys, dispositivos).

## Secuencia recomendada para Fase 4

Revisada respecto a §21 a la luz de los hallazgos:

```text
4A — Cimientos de arquitectura y base de datos   [BLOQUEANTE]
     rol restringido + FORCE RLS + prueba de comportamiento
     @RequireModule en Fase 1/2 + corrección del texto de consecuencias
     checksums de migración
     integración que falla sin base + CI + cobertura
     decisión sobre el dominio muerto de Fase 3
     modelo de madurez explícito sustituyendo el booleano

4B — Endurecimiento de identidad y sesión
     revocación administrativa, MFA/TOTP, códigos de recuperación,
     passkeys, dispositivos, perfiles de autenticación

4C — Trabajos en segundo plano y fiabilidad
     rediseño del worker: bloqueo, reintentos, backoff, dead-letter,
     idempotencia, programación, apagado ordenado, métricas

4D — Autoauditoría y verificación de instalación

4E — Manufactura y calidad          [primer vertical sectorial]

4F — Auditoría interna y controles continuos

4G — Un segundo vertical sectorial

4H — Documentación y candidata a release
```

La diferencia respecto a la propuesta anterior es que **4A ya no es solo
contratos**: es estabilización de seguridad y calidad. Construir 19 módulos
sectoriales sobre RLS inerte, límites de módulo no aplicados y una suite de
integración que puede pasar sin ejecutarse multiplicaría los tres defectos por
cada módulo nuevo.

## Lo que esta revisión no verificó

Se declara explícitamente para que nadie infiera cobertura inexistente:

- Despliegue remoto o staging (§14) — **no ejecutado**
- Restauración de respaldo (§15) — **no ejecutado**
- Rendimiento y carga (§16) — **no ejecutado**
- Los 5 recorridos de usuario (§13) — **no ejecutados**
- Inventario de base de datos columna por columna (§7.1) — **no producido**
- Matriz de aislamiento tabla por tabla para las 208 tablas (§7.2) — **no producida**
- Pruebas sistemáticas de IDOR por endpoint (§8) — **no ejecutadas**
- Accesibilidad — **no evaluada**

Ninguno de estos ejercicios habría cambiado el veredicto: los hallazgos C-1 a C-4
bastan por sí solos para bloquear la Fase 4.
