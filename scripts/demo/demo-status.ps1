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
if (-not (Test-Path -LiteralPath $envFile)) { throw "La demostración todavía no fue iniciada." }

$settings = @{}
foreach ($line in [System.IO.File]::ReadAllLines($envFile)) {
  if ($line -match "^\s*([^#][^=]*)=(.*)$") { $settings[$matches[1].Trim()] = $matches[2].Trim() }
}
docker compose --env-file $envFile -f $compose ps
if ($LASTEXITCODE -ne 0) { throw "No se pudo consultar Docker Compose." }

$web = Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 "http://localhost:$($settings.DEMO_WEB_PORT)/demo-health"
$api = Invoke-RestMethod -TimeoutSec 5 "http://localhost:$($settings.DEMO_API_PORT)/api/v1/health/readiness"
if ($web.StatusCode -ne 200 -or $api.status -ne "ready") { throw "La demostración no está saludable." }
Write-Host "Web demo: OK"
Write-Host "API demo: OK"
