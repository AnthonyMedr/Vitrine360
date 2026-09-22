$ErrorActionPreference = "Stop"

Write-Host "== Fase 1 Cutover =="

$dockerAvailable = $null -ne (Get-Command docker -ErrorAction SilentlyContinue)
$psqlAvailable = $null -ne (Get-Command psql -ErrorAction SilentlyContinue)
$redisCliAvailable = $null -ne (Get-Command redis-cli -ErrorAction SilentlyContinue)

if ($dockerAvailable) {
  Write-Host "Docker encontrado. Subindo Postgres + Redis..."
  docker compose -f docker-compose.phase1.yml up -d
} else {
  Write-Host "Docker nao encontrado."
}

if (-not $dockerAvailable -and -not $psqlAvailable) {
  Write-Error "Nem Docker nem PostgreSQL local estao disponiveis. A fase 1 continua bloqueada por infraestrutura."
}

if (-not $dockerAvailable -and -not $redisCliAvailable) {
  Write-Error "Nem Docker nem Redis local estao disponiveis. A fase 1 continua bloqueada por infraestrutura."
}

$env:DB_PROVIDER = "postgres"
$env:DATABASE_URL = if ($env:DATABASE_URL) { $env:DATABASE_URL } else { "postgresql://postgres:postgres@127.0.0.1:5432/gamel_digital" }
$env:QUEUE_PROVIDER = "redis"
$env:REDIS_URL = if ($env:REDIS_URL) { $env:REDIS_URL } else { "redis://127.0.0.1:6379" }

Write-Host "Sincronizando snapshot para PostgreSQL..."
npm run db:sync:postgres

Write-Host "Validando cutover..."
npm run phase1:check
npm run health:readiness
npm run smoke:release

Write-Host "Fase 1 cutover concluida no ambiente atual."

