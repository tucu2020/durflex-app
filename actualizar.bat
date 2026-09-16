@echo off
cd /d "%~dp0"
title Actualizar Durflex (OTA)
echo ============================================
echo   Publicando actualizacion de Durflex...
echo ============================================
echo.
call eas update --branch preview --message "Actualizacion Durflex"
echo.
echo ============================================
echo   LISTO. En el telefono: cerra la app del
echo   todo y abrila DOS veces para ver el cambio.
echo ============================================
pause
