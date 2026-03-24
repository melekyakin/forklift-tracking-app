Write-Host "Grafana başlatılıyor..." -ForegroundColor Green
Set-Location $PSScriptRoot
docker-compose up -d
Write-Host ""
Write-Host "Grafana http://localhost:3001 adresinde çalışıyor" -ForegroundColor Cyan
Write-Host "Kullanıcı adı: admin" -ForegroundColor Yellow
Write-Host "Şifre: admin" -ForegroundColor Yellow
Write-Host ""
Write-Host "Grafana'yı durdurmak için: docker-compose down" -ForegroundColor Gray

