[CmdletBinding()]
param()
$ErrorActionPreference = "Stop"
$demoDir = if (Test-Path -LiteralPath (Join-Path $PSScriptRoot "docker-compose.demo.yml")) {
  $PSScriptRoot
} else {
  [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\..\deployment\demo"))
}
$envFile = Join-Path $demoDir ".env.demo"
$template = Join-Path $demoDir ".env.demo.example"
$compose = Join-Path $demoDir "docker-compose.demo.yml"

function New-RandomHex([int]$Bytes) {
  $buffer = [byte[]]::new($Bytes)
  $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $generator.GetBytes($buffer)
  } finally {
    $generator.Dispose()
  }
  return [BitConverter]::ToString($buffer).Replace("-", "").ToLowerInvariant()
}

if (-not (Test-Path -LiteralPath $envFile)) {
  $content = [System.IO.File]::ReadAllText($template)
  foreach ($value in @(
    (New-RandomHex 24),
    (New-RandomHex 24),
    (New-RandomHex 24),
    (New-RandomHex 32),
    (New-RandomHex 12),
    (New-RandomHex 32),
    (New-RandomHex 16)
  )) {
    $index = $content.IndexOf("__GENERATED__", [StringComparison]::Ordinal)
    if ($index -lt 0) { throw "La plantilla demo no contiene todos los marcadores esperados." }
    $content = $content.Remove($index, "__GENERATED__".Length).Insert($index, $value)
  }
  [System.IO.File]::WriteAllText($envFile, $content, [System.Text.UTF8Encoding]::new($false))
  Write-Host "Se creó .env.demo con secretos locales aleatorios."
}

$settings = @{}
foreach ($line in [System.IO.File]::ReadAllLines($envFile)) {
  if ($line -match "^\s*([^#][^=]*)=(.*)$") { $settings[$matches[1].Trim()] = $matches[2].Trim() }
}
if ([System.IO.File]::ReadAllText($envFile).Contains("__GENERATED__")) { throw ".env.demo contiene marcadores sin reemplazar." }
if ($settings.APP_ENVIRONMENT -ne "demo" -or $settings.DEMO_MODE -ne "true") { throw "La identidad del entorno demo no es válida." }

docker compose --env-file $envFile -f $compose config --quiet
if ($LASTEXITCODE -ne 0) { throw "La configuración Docker Compose no es válida." }
docker compose --env-file $envFile -f $compose up -d --build
if ($LASTEXITCODE -ne 0) { throw "No se pudo iniciar la demostración." }

Write-Host ""
Write-Host "ERP Express Perú demo iniciado."
Write-Host "Entrada: http://localhost:$($settings.DEMO_WEB_PORT)/demo/"
Write-Host "Aplicación: http://localhost:$($settings.DEMO_WEB_PORT)/"
Write-Host "Usuario demo: $($settings.DEMO_ADMIN_EMAIL)"
Write-Host "Contraseña local generada: $($settings.DEMO_ADMIN_PASSWORD)"
Write-Host "No ingrese datos reales. Use .\demo-status.ps1 para comprobar salud."
