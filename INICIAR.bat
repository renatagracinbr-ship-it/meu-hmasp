@echo off
cls

echo ========================================
echo   Meu HMASP - Iniciando Servidor
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

echo Verificando dependencias...
if not exist "node_modules" (
    echo Instalando dependencias...
    npm install
    echo.
)

echo Iniciando servidor...
echo.
start "Meu HMASP - Servidor" cmd /k "node server.js"

echo Aguardando servidor iniciar...
timeout /t 3 /nobreak >nul

echo Abrindo navegador...
start http://localhost:3000

echo.
echo ========================================
echo   SERVIDOR INICIADO!
echo ========================================
echo.
echo Interface do Operador: http://localhost:3000
echo.
echo Abas disponiveis:
echo   - Chat (conversar com pacientes)
echo   - Confirmacao de Presenca
echo   - Desmarcacao de Consultas
echo   - Notificacao aos Faltantes
echo   - Configuracoes
echo.
echo Para parar: Feche a janela do servidor
echo.
echo ========================================
echo.
pause
