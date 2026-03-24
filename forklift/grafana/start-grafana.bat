@echo off
echo Grafana baslatiliyor...
cd /d %~dp0
docker-compose up -d
echo.
echo Grafana http://localhost:3001 adresinde calisiyor
echo Kullanici adi: admin
echo Sifre: admin
echo.
pause

