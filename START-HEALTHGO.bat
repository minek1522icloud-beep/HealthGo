@echo off
cd /d "C:\Users\Marcel\Desktop\HealthGo"

start "HealthGo AI" cmd /k node healthgo-ai-server.mjs

timeout /t 3 /nobreak >nul

start "" "http://127.0.0.1:5500/www/index.html"

exit