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

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "Docker nao encontrado no PATH. Instale/abra Docker Desktop antes de iniciar a Fase 1."
}

docker info *> $null
if ($LASTEXITCODE -ne 0) {
  throw "Docker Desktop nao esta pronto. Abra o Docker Desktop e tente novamente."
}

Write-Host "Subindo PostgreSQL + Redis da Fase 1..."
docker compose -f $composeFile up -d

$env:DB_PROVIDER = "postgres"
$env:DATABASE_URL = if ($env:DATABASE_URL) { $env:DATABASE_URL } else { "postgresql://postgres:postgres@127.0.0.1:5432/gamel_digital" }
$env:QUEUE_PROVIDER = "redis"
$env:REDIS_URL = if ($env:REDIS_URL) { $env:REDIS_URL } else { "redis://127.0.0.1:6379" }
$env:APP_BASE_URL = if ($env:APP_BASE_URL) { $env:APP_BASE_URL } else { "http://127.0.0.1:8080" }
$env:API_PORT = if ($env:API_PORT) { $env:API_PORT } else { "3001" }

Write-Host "Sincronizando PostgreSQL antes do dev server..."
npm.cmd run db:sync:postgres

Write-Host "Iniciando app em Fase 1: http://localhost:8080"
npm.cmd run dev
