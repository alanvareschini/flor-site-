@echo off
REM Script para matar processo na porta 3001 e iniciar dev server
REM Usar: start-dev.bat

setlocal enabledelayedexpansion

set PORT=3001

echo.
echo 🔍 Procurando por processo na porta %PORT%...
echo.

REM Tenta matar processo na porta usando netstat
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%PORT%') do (
    if not "%%a"=="" (
        echo ⚠️  Processo encontrado (PID: %%a)
        taskkill /PID %%a /F >nul 2>&1
        if errorlevel 1 (
            echo ⚠️  Erro ao matar processo
        ) else (
            echo ✅ Processo interrompido com sucesso!
            timeout /t 1 /nobreak >nul
        )
    )
)

echo.
echo 🚀 Iniciando Next.js dev server na porta %PORT%...
echo 📍 Acesse: http://localhost:%PORT%
echo.

npm run dev

pause
