@echo off
cls

echo ========================================
echo   HMASP Chat - Iniciando Servidor
echo ========================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: Node.js nao instalado!
    echo.
    echo Instale em: https://nodejs.org
    pause
    exit /b 1
)

echo OK - Node.js instalado
node --version
echo.

echo Iniciando servidor...
echo.
start "HMASP Chat - Servidor" cmd /k "node server.js"

echo.
echo ========================================
echo   SERVIDOR INICIADO!
echo ========================================
echo.
echo O servidor abrira 3 abas automaticamente:
echo   1 - Interface Principal (Usuarios - Visualizacao)
echo   2 - Interface Admin (VM - Envio Automatico)
echo   3 - WhatsApp Admin (Status/QR Code)
echo.
echo Para parar: Feche a janela do servidor
echo.
echo ========================================
echo.
pause
