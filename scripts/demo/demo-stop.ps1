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
if (-not (Test-Path -LiteralPath $envFile)) {
  Write-Host "La demostración ya está detenida o no fue iniciada."
  exit 0
}
docker compose --env-file $envFile -f $compose down --remove-orphans
if ($LASTEXITCODE -ne 0) { throw "No se pudieron detener los servicios demo." }
Write-Host "Servicios demo detenidos. Los volúmenes demo se conservaron."
