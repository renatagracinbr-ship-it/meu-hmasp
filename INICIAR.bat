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

echo.
echo Iniciando servidor...
start "Meu HMASP - Servidor" cmd /k "node server.js"

echo Aguardando servidor iniciar...
timeout /t 3 /nobreak >nul

echo Abrindo App Mobile (Paciente)...
start http://localhost:3000/mobile

timeout /t 1 /nobreak >nul

echo Abrindo Interface do Operador (Desktop)...
start http://localhost:3000

echo.
echo ========================================
echo   SERVIDOR INICIADO!
echo ========================================
echo.
echo URLs disponiveis:
echo.
echo   App Mobile (Paciente):
echo     http://localhost:3000/mobile
echo     - Login com CPF e Prontuario
echo     - Chat com a Central de Atendimento
echo     - Confirmacao de presenca
echo     - Consultas agendadas
echo.
echo   Interface do Operador (Desktop):
echo     http://localhost:3000
echo     - Chat com pacientes
echo     - Gerenciamento de confirmacoes
echo     - Desmarcacao de consultas
echo     - Configuracoes
echo.
echo Para parar: Feche a janela "Meu HMASP - Servidor"
echo.
echo ========================================
echo.
pause
