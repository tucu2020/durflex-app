@echo off
cd /d "%~dp0"
title Compilar Durflex (APK)
echo ============================================
echo   Compilando el APK de Durflex...
echo   (tarda ~40 min, corre en la nube)
echo ============================================
echo.
call eas build -p android --profile preview
echo.
echo Cuando termine, descarga e instala el APK.
pause
