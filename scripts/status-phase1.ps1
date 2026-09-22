$ErrorActionPreference = "Stop"

$nvmHome = "C:\Users\kelma\AppData\Local\nvm"
$nvmSymlink = "C:\nvm4w\nodejs"
$gitCmd = "C:\Program Files\Git\cmd"

$env:NVM_HOME = $nvmHome
$env:NVM_SYMLINK = $nvmSymlink
$env:Path = "$gitCmd;$nvmHome;$nvmSymlink;$env:Path"

$env:DB_PROVIDER = "postgres"
$env:DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:5432/gamel_digital"
$env:QUEUE_PROVIDER = "redis"
$env:REDIS_URL = "redis://127.0.0.1:6379"

Write-Host "Executando status executivo em modo Fase 1 local..."
Write-Host "Banco: PostgreSQL em 127.0.0.1:5432"
Write-Host "Fila: Redis em 127.0.0.1:6379"
Write-Host ""

npm.cmd run status:executive
exit $LASTEXITCODE
