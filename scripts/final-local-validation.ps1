param(
  [switch]$Full
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $root

$env:NVM_HOME = if ($env:NVM_HOME) { $env:NVM_HOME } else { "C:\Users\kelma\AppData\Local\nvm" }
$env:NVM_SYMLINK = if ($env:NVM_SYMLINK) { $env:NVM_SYMLINK } else { "C:\nvm4w\nodejs" }
$env:Path = "C:\Program Files\Git\cmd;$env:NVM_HOME;$env:NVM_SYMLINK;$env:Path"

$env:DB_PROVIDER = "postgres"
$env:DATABASE_URL = if ($env:DATABASE_URL) { $env:DATABASE_URL } else { "postgresql://postgres:postgres@127.0.0.1:5432/gamel_digital" }
$env:QUEUE_PROVIDER = "redis"
$env:REDIS_URL = if ($env:REDIS_URL) { $env:REDIS_URL } else { "redis://127.0.0.1:6379" }

function Invoke-Step {
  param(
    [string]$Label,
    [string[]]$Command
  )

  Write-Host ""
  Write-Host "==> $Label"
  & $Command[0] $Command[1..($Command.Length - 1)]
  if ($LASTEXITCODE -ne 0) {
    throw "Etapa falhou: $Label"
  }
}

function Invoke-IsolatedTests {
  Write-Host ""
  Write-Host "==> Testes automatizados completos"

  $previousDbProvider = $env:DB_PROVIDER
  $previousDatabaseUrl = $env:DATABASE_URL
  $previousQueueProvider = $env:QUEUE_PROVIDER
  $previousRedisUrl = $env:REDIS_URL

  try {
    $env:DB_PROVIDER = "sqlite"
    Remove-Item Env:\DATABASE_URL -ErrorAction SilentlyContinue
    $env:QUEUE_PROVIDER = "auto"
    Remove-Item Env:\REDIS_URL -ErrorAction SilentlyContinue
    npm.cmd test
    if ($LASTEXITCODE -ne 0) {
      throw "Etapa falhou: Testes automatizados completos"
    }
  } finally {
    $env:DB_PROVIDER = $previousDbProvider
    if ($previousDatabaseUrl) { $env:DATABASE_URL = $previousDatabaseUrl } else { Remove-Item Env:\DATABASE_URL -ErrorAction SilentlyContinue }
    $env:QUEUE_PROVIDER = $previousQueueProvider
    if ($previousRedisUrl) { $env:REDIS_URL = $previousRedisUrl } else { Remove-Item Env:\REDIS_URL -ErrorAction SilentlyContinue }
  }
}

$completedSteps = New-Object System.Collections.Generic.List[string]

Write-Host "Validacao final local do Lojao do PVC"
Write-Host "Modo: $(if ($Full) { 'full' } else { 'local' })"
Write-Host "DB_PROVIDER=$env:DB_PROVIDER"
Write-Host "QUEUE_PROVIDER=$env:QUEUE_PROVIDER"

Invoke-Step "Typecheck" @("npm.cmd", "run", "typecheck")
$completedSteps.Add("typecheck")
Invoke-Step "Lint" @("npm.cmd", "run", "lint")
$completedSteps.Add("lint")
Invoke-Step "Build" @("npm.cmd", "run", "build")
$completedSteps.Add("build")

if ($Full) {
  Invoke-IsolatedTests
  $completedSteps.Add("test")
}

Invoke-Step "Validacao Fase 1" @("npm.cmd", "run", "phase1:validate")
$completedSteps.Add("phase1:validate")
Invoke-Step "Handoff final" @("npm.cmd", "run", "go-live:handoff")
$completedSteps.Add("go-live:handoff")
Invoke-Step "Status executivo em relatorio" @("npm.cmd", "run", "status:executive:report")
$completedSteps.Add("status:executive:report")

$reportsDir = Join-Path $root "docs\reports"
New-Item -ItemType Directory -Force -Path $reportsDir | Out-Null
$generatedAt = (Get-Date).ToUniversalTime().ToString("o")
$mode = if ($Full) { "full" } else { "local" }
$jsonPath = Join-Path $reportsDir "final-validation-latest.json"
$mdPath = Join-Path $reportsDir "final-validation-latest.md"

$summary = [ordered]@{
  ok = $true
  generated_at = $generatedAt
  mode = $mode
  db_provider = $env:DB_PROVIDER
  queue_provider = $env:QUEUE_PROVIDER
  completed_steps = $completedSteps.ToArray()
  ecommerce_status = "PRONTO para homologacao local/Fase 1; BLOQUEADO_EXTERNO para producao aberta."
  executive_panel_status = "PRONTO para operacao interna; production_open=BLOQUEADO_EXTERNO."
  main_blocker = "fiscal_minimo_contador"
  reports = [ordered]@{
    executive_status = "docs/reports/executive-status-latest.md"
    external_handoff = "docs/reports/go-live-external-handoff-latest.md"
    homologation_pack = "docs/reports/homologation-pack-latest.md"
    national_readiness = "docs/reports/national-readiness-report-latest.md"
  }
}

$summary | ConvertTo-Json -Depth 6 | Set-Content -Path $jsonPath -Encoding UTF8

$markdown = @(
  "# Validacao Final Local",
  "",
  "Gerado em: $generatedAt",
  "",
  "- Modo: ``$mode``",
  "- DB provider: ``$env:DB_PROVIDER``",
  "- Queue provider: ``$env:QUEUE_PROVIDER``",
  "- Resultado: ``PASS``",
  "- Ecommerce: PRONTO para homologacao local/Fase 1; BLOQUEADO_EXTERNO para producao aberta.",
  "- Painel executivo: PRONTO para operacao interna; ``production_open=BLOQUEADO_EXTERNO``.",
  "- Bloqueio principal: ``fiscal_minimo_contador``",
  "",
  "## Etapas concluidas",
  ""
)

foreach ($step in $completedSteps) {
  $markdown += "- ``$step``"
}

$markdown += @(
  "",
  "## Relatorios relacionados",
  "",
  "- ``docs/reports/executive-status-latest.md``",
  "- ``docs/reports/go-live-external-handoff-latest.md``",
  "- ``docs/reports/homologation-pack-latest.md``",
  "- ``docs/reports/national-readiness-report-latest.md``",
  "",
  "Observacao: ``BLOQUEADO_EXTERNO`` indica dependencia real de contador, credencial, provider ou ambiente produtivo. Nao usar dado falso para liberar gate.",
  ""
)

$markdown | Set-Content -Path $mdPath -Encoding UTF8

Write-Host ""
Write-Host "Validacao final local concluida."
Write-Host "Relatorio: $mdPath"
Write-Host "Observacao: producao aberta pode continuar BLOQUEADO_EXTERNO por contador/provedores reais; isso nao e falha desta validacao."
