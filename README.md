# ERP Express Perú

ERP portable y modular para pequeñas empresas peruanas. La Fase 3 amplía la base
comercial con centro de administración, CRM, proyectos, RR. HH. ligero, SST,
activos y mantenimiento, privacidad y documentos legales, mapas manuales, OCR
asistido e IA gobernada mediante proveedores reemplazables.

No existe conexión productiva directa con SUNAT. OCR, IA y geocodificación
externa permanecen deshabilitados por defecto; los modos mock se rotulan como
demostración y OCR nunca crea registros definitivos sin confirmación humana.

## Inicio rápido

1. Copie `.env.example` a `.env` y cambie todos los valores marcados para reemplazo.
2. Defina `SEED_ADMIN_EMAIL` y una contraseña de desarrollo de al menos 12 caracteres.
3. Ejecute:

```bash
pnpm bootstrap
pnpm dev
```

Web: `http://localhost:5173` · API: `http://localhost:3000/api/v1` · OpenAPI: `http://localhost:3000/api/docs` · MinIO: `http://localhost:9001` · Mailpit: `http://localhost:8025`.

Para ejecutar toda la aplicación en contenedores:

```bash
docker compose up --build
```

La web queda en `http://localhost:8080`. Consulte [desarrollo local](docs/LOCAL-DEVELOPMENT.md),
[arquitectura](docs/ARCHITECTURE.md), [seguridad](docs/SECURITY.md) y el
[reporte profesional de Fase 3](docs/PHASE-3-REPORT.md).
