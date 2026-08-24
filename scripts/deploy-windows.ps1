param(
  [string]$EnvFile = ".env.deploy"
)

$ErrorActionPreference = 'Stop'
if (-not (Test-Path $EnvFile)) {
  Copy-Item '.env.deploy.example' $EnvFile
  throw "已创建 $EnvFile。请填写其中的强密码和 JWT_SECRET 后重新运行此脚本。"
}

docker compose --env-file $EnvFile up --build -d
docker compose --env-file $EnvFile ps
Write-Host "部署完成：请访问 http://localhost:8080"
