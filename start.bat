@echo off
title RIVER-WALL PRO
cd /d "%~dp0"
echo [RW] Instalando dependencias...
call npm install
if %errorlevel% neq 0 (
    echo [RW] Error al instalar dependencias.
    pause
    exit /b 1
)
echo [RW] Iniciando RIVER-WALL PRO...
npx electron .
pause
