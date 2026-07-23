[CmdletBinding()]
param()
$ErrorActionPreference = "Stop"
$demoDir = if (Test-Path -LiteralPath (Join-Path $PSScriptRoot "docker-compose.demo.yml")) {
  $PSScriptRoot
} else {
  [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\..\deployment\demo"))
}
$envFile = Join-Path $demoDir ".env.demo"
$compose = Join-Path $demoDir "docker-compose.demo.yml"
if (-not (Test-Path -LiteralPath $envFile)) { throw "No existe .env.demo; inicie la demostración primero." }

$settings = @{}
foreach ($line in [System.IO.File]::ReadAllLines($envFile)) {
  if ($line -match "^\s*([^#][^=]*)=(.*)$") { $settings[$matches[1].Trim()] = $matches[2].Trim() }
}
if ($settings.APP_ENVIRONMENT -ne "demo") { throw "APP_ENVIRONMENT no es demo." }
if ($settings.DEMO_RESET_ENABLED -ne "true") { throw "DEMO_RESET_ENABLED no es true." }
if ($settings.DEMO_TENANT_ID -ne "30000000-0000-4000-8000-000000000001") { throw "Tenant demo inesperado." }
if ($settings.DEMO_DATABASE_NAME -ne "erp_express_demo") { throw "Base demo inesperada." }
if ($settings.DEMO_DATABASE_FINGERPRINT -ne "erp-express-peru-demo-db-v0.3.0") { throw "Fingerprint demo inesperado." }

docker compose --env-file $envFile -f $compose --profile tools run --rm demo-reset
if ($LASTEXITCODE -ne 0) { throw "No se pudo restablecer la base demo." }
docker compose --env-file $envFile -f $compose --profile tools run --rm storage-reset
if ($LASTEXITCODE -ne 0) { throw "La base fue restablecida, pero no se pudo vaciar el almacenamiento demo; reintente el reset." }
Write-Host "Reset demo completado con semilla sintética determinista."
