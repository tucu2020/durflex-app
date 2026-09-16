@echo off
cd /d "%~dp0"
echo.
echo ==========================================
echo   Durflex - Compilar version FINAL
echo   (archivo AAB para subir a Google Play)
echo ==========================================
echo.
echo Esto tarda entre 15 y 30 minutos.
echo Al terminar, descarga el archivo .aab desde el link que aparece.
echo.
pause
call eas build --platform android --profile production
echo.
echo Listo. Descarga el .aab y subilo a Google Play Console.
pause
