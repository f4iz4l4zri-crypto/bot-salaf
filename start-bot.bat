@echo off
title Bot WhatsApp Salaf (Auto-Restart)
cd /d "C:\WS grup SALAF"

:loop
echo ========================================================
echo [%date% %time%] Memulakan Bot WhatsApp Salaf...
echo ========================================================
node src/index.js

echo.
echo ========================================================
echo [AMARAN] Bot terhenti atau terputus!
echo Memulakan semula secara automatik dalam masa 5 saat...
echo Tekan Ctrl+C jika ingin membatalkan.
echo ========================================================
timeout /t 5 /nobreak >nul
goto loop
