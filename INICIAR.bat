@echo off
cls

echo ========================================
echo   Meu HMASP - Iniciando Projeto
echo ========================================
echo.
echo  ARQUITETURA:
echo  - Desktop: http://localhost:3000/desktop/
echo  - Mobile:  http://localhost:5173
echo  - Backend: http://localhost:3000/api/
echo.
echo ========================================
echo.

REM Verifica Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: Node.js nao instalado!
    echo Instale em: https://nodejs.org
    pause
    exit /b 1
)

echo [OK] Node.js instalado:
node --version
echo.

REM Verifica dependencias do backend (raiz)
if not exist "node_modules" (
    echo Instalando dependencias do backend...
    call npm install
    echo.
)

REM Verifica dependencias do mobile
if not exist "mobile\node_modules" (
    echo Instalando dependencias do mobile...
    cd mobile
    call npm install
    cd ..
    echo.
)

echo.
echo ========================================
echo   INICIANDO SERVIDORES
echo ========================================
echo.

REM Inicia Backend (porta 3000) - serve tambem o Desktop
echo [1/2] Iniciando Backend + Desktop...
start "HMASP - Backend" cmd /k "cd /d %~dp0 && node server.js"

timeout /t 3 /nobreak >nul

REM Inicia Mobile Dev Server (porta 5173)
echo [2/2] Iniciando Mobile Dev Server...
start "HMASP - Mobile Dev" cmd /k "cd /d %~dp0mobile && npm run dev"

timeout /t 4 /nobreak >nul

REM Abre navegadores
echo.
echo Abrindo navegadores...
start http://localhost:3000/desktop/
start http://localhost:5173

echo.
echo ========================================
echo   PRONTO!
echo ========================================
echo.
echo  Desktop (Operador):
echo    http://localhost:3000/desktop/
echo.
echo  Mobile (Paciente):
echo    http://localhost:5173
echo.
echo  API Backend:
echo    http://localhost:3000/api/status
echo.
echo ========================================
echo.
echo  Janelas abertas:
echo    - HMASP - Backend (node server.js)
echo    - HMASP - Mobile Dev (vite)
echo.
echo  Para parar: Feche as 2 janelas pretas
echo.
echo ========================================
pause
