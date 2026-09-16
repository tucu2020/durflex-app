@echo off
cd /d "%~dp0"
echo.
echo ==========================================
echo   Durflex - Compilar version de PRUEBA
echo   (archivo APK para instalar en el celu)
echo ==========================================
echo.
call eas build --platform android --profile preview-apk
pause
