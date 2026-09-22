$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

$env:NVM_HOME = if ($env:NVM_HOME) { $env:NVM_HOME } else { "C:\Users\kelma\AppData\Local\nvm" }
$env:NVM_SYMLINK = if ($env:NVM_SYMLINK) { $env:NVM_SYMLINK } else { "C:\nvm4w\nodejs" }
$env:Path = "C:\Program Files\Git\cmd;$env:NVM_HOME;$env:NVM_SYMLINK;$env:Path"

$composeFile = Join-Path $root "infra\docker-compose.phase1.yml"
if (-not (Test-Path $composeFile)) {
  $composeFile = Join-Path $root "docker-compose.phase1.yml"
}

$env:DB_PROVIDER = "postgres"
$env:DATABASE_URL = if ($env:DATABASE_URL) { $env:DATABASE_URL } else { "postgresql://postgres:postgres@127.0.0.1:5432/gamel_digital" }
$env:QUEUE_PROVIDER = "redis"
$env:REDIS_URL = if ($env:REDIS_URL) { $env:REDIS_URL } else { "redis://127.0.0.1:6379" }

if (Get-Command docker -ErrorAction SilentlyContinue) {
  docker info *> $null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "Garantindo PostgreSQL + Redis da Fase 1..."
    docker compose -f $composeFile up -d
  }
}

Write-Host "Validando Fase 1 com PostgreSQL + Redis..."
npm.cmd run db:sync:postgres
npm.cmd run db:postgres:status
npm.cmd run phase1:check
npm.cmd run security:check
npm.cmd run operations:check
npm.cmd run smoke:release

Write-Host "Validacao Fase 1 concluida."
