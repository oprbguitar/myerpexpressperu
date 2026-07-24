# Fase 4 — Línea base verificada

Estado del repositorio antes de introducir código sectorial de Fase 4.

- **Fecha de ejecución:** 2026-07-23
- **Commit de línea base:** `4df34c4` (importación inicial)
- **Entorno:** Windows 11 Pro 26200, Node/pnpm 10.31.0, PostgreSQL local en 5432
- **Herramienta de desarrollo:** Claude Opus 4.8 (Claude Code), bajo dirección humana
- **Registro de procedencia:** `AIP-2026-0001`

Todo lo que aparece abajo fue **ejecutado realmente** en esta sesión. No se
documenta ningún resultado inferido o esperado.

## 1. Inventario medido

| Métrica | Valor |
| --- | --- |
| Archivos TypeScript/TSX (sin `node_modules`) | 282 |
| Líneas de código en `apps/`, `packages/`, `modules/` | 20 233 |
| Pares de migración (`up.sql` / `down.sql`) | 11 |
| Líneas SQL en migraciones `up` | 2 971 |
| Módulos existentes | 8 |
| Archivos versionados en el commit inicial | 347 |

Módulos presentes al inicio de Fase 4: `artificial-intelligence`, `assets`,
`crm`, `human-resources`, `legal-compliance`, `occupational-safety`, `ocr`,
`projects`.

## 2. Resultados reales de la suite

| Comando | Resultado | Detalle |
| --- | --- | --- |
| `pnpm lint` | ✅ Pasa | `eslint . --max-warnings=0`, sin advertencias |
| `pnpm typecheck` | ✅ Pasa | 7 de 8 proyectos del workspace, sin errores |
| `pnpm test` | ✅ Pasa | 18 archivos, 86 pruebas |
| `pnpm test:integration` | ✅ Pasa | 4 archivos, 17 pruebas, contra PostgreSQL real |
| `pnpm test:e2e` | ✅ Pasa | 24 casos: 18 pasan, 6 omitidos por proyecto |
| `pnpm build` | ✅ Pasa | api, web (PWA, 37 entradas precache), worker, database |
| `pnpm audit --prod` | ✅ Pasa | «No known vulnerabilities found» |

Desglose de pruebas unitarias por paquete: `packages/domain` 41,
`packages/security` 17, `apps/api` 12, `apps/web` 9, `packages/database` 7,
`apps/worker` 0 (sin archivos de prueba).

Los 6 casos e2e omitidos son omisiones condicionales por proyecto ya presentes
en la suite —los escenarios de PDF y concurrencia solo corren en
`desktop-chromium`, y el flujo móvil solo en `mobile-chromium`—. No son fallos
ni pruebas deshabilitadas en Fase 4.

## 3. Defectos encontrados

**Ninguno.** La línea base de Fases 1–3 está completamente en verde. No hubo
que corregir nada antes de comenzar Fase 4.

## 4. Cambio de puertos aplicado

Los puertos de desarrollo 3000 (API) y 5173 (web) estaban ocupados en la máquina
de destino. Se movieron a **3100** y **5273**, verificados libres antes del
cambio.

Archivos modificados: `apps/api/src/config.ts`, `apps/web/vite.config.ts`,
`apps/web/src/api.ts`, `.env`, `.env.example`, `playwright.config.ts`,
`docker-compose.yml`, `tests/e2e/shell.spec.ts`, `tests/e2e/phase3.spec.ts`.

Verificación: `pnpm typecheck` pasa y la suite e2e completa levanta API y web en
los puertos nuevos y ejecuta sesiones reales de navegador contra ellos. Los
servicios de infraestructura (PostgreSQL 5432, MinIO 9000/9001, Mailpit
1025/8025) no se tocaron.

## 5. Estado del control de versiones

El directorio no era un repositorio Git al iniciar Fase 4. Se ejecutó
`git init` con autorización explícita del propietario. No hay remoto
configurado y no se ha hecho push.

Esto era un bloqueante real: los *trailers* de procedencia por commit, los
*worktrees* aislados por agente y los manifiestos de versión firmados que exige
Fase 4 dependen de Git y no podían implementarse sin él.

## 6. Limitaciones de esta línea base

- No se ejecutaron pruebas de carga ni de rendimiento.
- No se verificó recuperación ante desastres ni restauración de respaldos.
- Los proveedores externos (SUNAT, IA, OCR, mapas) siguen deshabilitados por
  configuración; su comportamiento real no fue ejercitado.
- La revisión humana de este trabajo está **pendiente**. Ningún resultado de
  esta sesión debe considerarse aceptado hasta que una persona lo revise.
