$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $root ".env"

if (-not (Test-Path $envPath)) {
  Set-Content -Path $envPath -Value "SUPABASE_DB_URL=" -Encoding UTF8
}

$current = Get-Content -Path $envPath -Raw
$currentUrl = ""
if ($current -match "SUPABASE_DB_URL=(.*)") {
  $currentUrl = $Matches[1].Trim()
}

Write-Host ""
Write-Host "Configure a URL de conexao Postgres do Supabase" -ForegroundColor Cyan
Write-Host "Exemplo: postgresql://postgres.xxxxx:[PASSWORD]@aws-0-...pooler.supabase.com:6543/postgres"
Write-Host ""

if ($currentUrl) {
  Write-Host "URL atual encontrada no .env." -ForegroundColor Yellow
}

$newUrl = Read-Host "Cole a SUPABASE_DB_URL"
if (-not $newUrl) {
  throw "SUPABASE_DB_URL nao informada."
}

$lines = @()
if (Test-Path $envPath) {
  $lines = Get-Content -Path $envPath
}

$updated = $false
for ($i = 0; $i -lt $lines.Count; $i++) {
  if ($lines[$i] -match "^SUPABASE_DB_URL=") {
    $lines[$i] = "SUPABASE_DB_URL=$newUrl"
    $updated = $true
  }
}

if (-not $updated) {
  $lines += "SUPABASE_DB_URL=$newUrl"
}

Set-Content -Path $envPath -Value $lines -Encoding UTF8

Write-Host ""
Write-Host "Executando npm run schema:pull..." -ForegroundColor Cyan
Push-Location $root
try {
  npm run schema:pull
} finally {
  Pop-Location
}
