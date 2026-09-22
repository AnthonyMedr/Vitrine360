$ErrorActionPreference = "Continue"

$Root = Resolve-Path (Join-Path $PSScriptRoot "..")
$StartedAt = Get-Date

function Invoke-CommandStep {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$Command,
    [bool]$Required = $true
  )

  Write-Host ""
  Write-Host "== $Name =="
  Push-Location $Root
  try {
    cmd.exe /c $Command
    $code = $LASTEXITCODE
  } finally {
    Pop-Location
  }

  $status = if ($code -eq 0) { "PASS" } elseif ($Required) { "FAIL" } else { "BLOCKED_EXPECTED" }
  [pscustomobject]@{
    phase = $script:CurrentPhase
    name = $Name
    command = $Command
    required = $Required
    exitCode = $code
    status = $status
  }
}

function Invoke-ParallelPhase {
  param(
    [Parameter(Mandatory = $true)][string]$Phase,
    [Parameter(Mandatory = $true)][array]$Steps
  )

  Write-Host ""
  Write-Host "########################################"
  Write-Host "# $Phase"
  Write-Host "########################################"

  $jobs = @()
  foreach ($step in $Steps) {
    $jobs += Start-Job -Name $step.Name -ArgumentList $Root, $Phase, $step.Name, $step.Command, $step.Required -ScriptBlock {
      param($Root, $Phase, $Name, $Command, $Required)
      Set-Location $Root
      Write-Output ""
      Write-Output "== $Name =="
      cmd.exe /c $Command
      $code = $LASTEXITCODE
      $status = if ($code -eq 0) { "PASS" } elseif ($Required) { "FAIL" } else { "BLOCKED_EXPECTED" }
      [pscustomobject]@{
        phase = $Phase
        name = $Name
        command = $Command
        required = $Required
        exitCode = $code
        status = $status
      }
    }
  }

  $output = Receive-Job -Job $jobs -Wait -AutoRemoveJob
  $output | ForEach-Object {
    if ($_ -is [pscustomobject] -and $_.PSObject.Properties["status"]) {
      $_
    } else {
      Write-Host $_
    }
  }
}

$results = @()

$script:CurrentPhase = "fase-0-local-baseline"
$results += Invoke-ParallelPhase "Fase 0 - Baseline local em paralelo" @(
  @{ Name = "Lint"; Command = "npm run lint"; Required = $true },
  @{ Name = "Typecheck"; Command = "npm run typecheck"; Required = $true },
  @{ Name = "Operations check"; Command = "npm run operations:check"; Required = $true }
)

$script:CurrentPhase = "fase-1-fiscal"
$results += Invoke-CommandStep "Validar close pack fiscal" "npm run fiscal:close-pack:validate -- docs/reports/fiscal-close-pack-minimal.csv" $true
$results += Invoke-CommandStep "Aplicar close pack fiscal" "npm run fiscal:close-pack:apply -- docs/reports/fiscal-close-pack-minimal.csv" $false
$results += Invoke-CommandStep "Fiscal minimo" "npm run fiscal:check:minimal" $false

$script:CurrentPhase = "fase-2-infra-seguranca"
$results += Invoke-ParallelPhase "Fase 2 - Infra e seguranca em paralelo" @(
  @{ Name = "Phase 1 infra check"; Command = "npm run phase1:check"; Required = $false },
  @{ Name = "Security check"; Command = "npm run security:check"; Required = $false },
  @{ Name = "Health readiness"; Command = "npm run health:readiness"; Required = $true }
)

$script:CurrentPhase = "fase-2-backup"
$results += Invoke-CommandStep "Exportar backup runtime" "npm run backup:export:latest" $true
$results += Invoke-CommandStep "Validar backup runtime" "npm run backup:validate -- docs/reports/runtime-backups/runtime-backup-latest.json" $true
$results += Invoke-CommandStep "Exportar super relatorio nacional" "npm run report:national" $true
$results += Invoke-CommandStep "Exportar pacote de homologacao nacional" "npm run homologation:pack" $true

$script:CurrentPhase = "fase-3-provedores"
$results += Invoke-CommandStep "Phase 2 providers check" "npm run phase2:check" $false
$results += Invoke-CommandStep "Freight catalog readiness" "npm run freight:catalog:check" $false

$script:CurrentPhase = "fase-4-qualidade-release"
$results += Invoke-ParallelPhase "Fase 4 - Qualidade em paralelo" @(
  @{ Name = "Tests"; Command = "npm test"; Required = $true },
  @{ Name = "Build"; Command = "npm run build"; Required = $true }
)
$results += Invoke-CommandStep "Release check" "npm run release:check" $false
$results += Invoke-CommandStep "Go-live check" "npm run go-live:check" $false
$results += Invoke-CommandStep "Smoke release" "npm run smoke:release" $true
$results += Invoke-CommandStep "Smoke phase 2" "npm run smoke:phase2" $false
$results += Invoke-CommandStep "Operations check pos-testes" "npm run operations:check" $false

$FinishedAt = Get-Date

Write-Host ""
Write-Host "########################################"
Write-Host "# Resumo"
Write-Host "########################################"
$results | Where-Object { $_ -is [pscustomobject] -and $_.PSObject.Properties["status"] } | Format-Table phase, name, status, exitCode, required -AutoSize

$requiredFailures = @($results | Where-Object { $_ -is [pscustomobject] -and $_.required -eq $true -and $_.exitCode -ne 0 })
$blockedExpected = @($results | Where-Object { $_ -is [pscustomobject] -and $_.required -eq $false -and $_.exitCode -ne 0 })

Write-Host ""
Write-Host "Inicio: $StartedAt"
Write-Host "Fim:    $FinishedAt"
Write-Host "Falhas obrigatorias: $($requiredFailures.Count)"
Write-Host "Bloqueios esperados por insumos reais: $($blockedExpected.Count)"

if ($requiredFailures.Count -gt 0) {
  Write-Host "Resultado: FALHA LOCAL. Corrigir comandos obrigatorios antes de seguir."
  exit 1
}

if ($blockedExpected.Count -gt 0) {
  Write-Host "Resultado: BASE LOCAL OK, GO-LIVE BLOQUEADO POR INSUMOS REAIS."
  Write-Host "Use release:check e go-live:check como gates estritos depois de aplicar os insumos reais."
  exit 0
}

Write-Host "Resultado: GO TECNICO LIBERADO PELOS GATES EXECUTADOS."
exit 0
