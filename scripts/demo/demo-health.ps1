[CmdletBinding()]
param()
& (Join-Path $PSScriptRoot "demo-status.ps1")
exit $LASTEXITCODE

