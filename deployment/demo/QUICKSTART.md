# Inicio rápido

## Requisitos

- Docker Desktop, Podman Desktop con compatibilidad Compose, Rancher Desktop u
  otro runtime compatible con `docker compose`.
- Al menos 4 GB libres para imágenes/volúmenes y puertos locales
  `18080`, `18081`, `19000` y `19001`.
- Conexión para descargar las imágenes la primera vez.

No necesita Node.js ni pnpm para ejecutar el ZIP.

## Windows PowerShell

```powershell
Expand-Archive .\erp-express-peru-demo-v0.4.0.zip
Set-Location .\erp-express-peru-demo-portable-v0.4.0
.\demo-start.ps1
.\demo-status.ps1
```

Abra `http://localhost:18080/demo/`. El inicio imprime el usuario y la contraseña
local generada. La contraseña también queda en `.env.demo`, un archivo local que
no debe compartirse.

Reset y detención:

```powershell
.\demo-reset.ps1
.\demo-stop.ps1
```

## Linux o macOS

```bash
unzip erp-express-peru-demo-v0.4.0.zip
cd erp-express-peru-demo-portable-v0.4.0
chmod +x demo-*.sh
./demo-start.sh
./demo-status.sh
```

Abra `http://localhost:18080/demo/`.

Reset y detención:

```bash
./demo-reset.sh
./demo-stop.sh
```

## Seleccionar un escenario

La página `/demo/` describe los escenarios A, B y C. La semilla instala los tres
en el mismo tenant ficticio para poder recorrerlos sin reiniciar. Los códigos y
capacidades están en `scenarios.json`.

## Cambiar puertos

Después del primer arranque, detenga la demo, edite exclusivamente estos valores en
`.env.demo` y vuelva a iniciar:

```text
DEMO_WEB_PORT
DEMO_API_PORT
DEMO_STORAGE_PORT
DEMO_STORAGE_CONSOLE_PORT
```

No cambie tenant, base ni fingerprint: son guardas del reset.

## Solución de problemas

```text
docker compose --env-file .env.demo -f docker-compose.demo.yml ps
docker compose --env-file .env.demo -f docker-compose.demo.yml logs api
docker compose --env-file .env.demo -f docker-compose.demo.yml logs migrate seed
```

Si un puerto está ocupado, cambie los cuatro puertos como se indicó. `demo-stop`
conserva volúmenes. No use `down -v` salvo que quiera borrar de forma irreversible
la evaluación local completa.

## Límites

- La demo no envía correos ni comprobantes fiscales reales.
- No configure certificados, API keys ni URLs productivas.
- OCR mock exige revisión humana y sólo prepara borradores cuando la funcionalidad
  correspondiente está integrada.
- IA externa permanece deshabilitada.
- Los límites configurados son 25 usuarios, 10 000 registros y archivos de 5 MiB.
- La verificación del paquete no equivale a una certificación productiva.
