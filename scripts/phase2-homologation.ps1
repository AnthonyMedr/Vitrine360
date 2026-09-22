$ErrorActionPreference = "Stop"

Write-Host "== Fase 2 Homologacao =="

Write-Host "Validando readiness da Fase 1..."
npm run phase1:check

Write-Host "Validando readiness da Fase 2..."
npm run phase2:check

Write-Host "Validando health/readiness..."
npm run health:readiness

Write-Host "Executando smoke baseline..."
npm run smoke:release

Write-Host "Executando smoke da Fase 2..."
npm run smoke:phase2

Write-Host "Fase 2 homologada no ambiente atual."
