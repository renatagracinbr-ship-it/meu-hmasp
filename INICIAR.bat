@echo off
cls

echo ========================================
echo   Meu HMASP - Iniciando Projeto
echo ========================================
echo.
echo  ARQUITETURA:
echo  - Mobile: Firebase Hosting (producao)
echo  - Desktop: Intranet HMASP
echo  - Backend: API + Banco de Dados
echo.
echo ========================================
echo.

REM Verifica Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: Node.js nao instalado!
    echo.
    echo Instale em: https://nodejs.org
    pause
    exit /b 1
)

echo [OK] Node.js instalado
node --version
echo.

REM Verifica dependencias raiz (backend)
echo Verificando dependencias do backend...
if not exist "node_modules" (
    echo Instalando dependencias do backend...
    call npm install
    echo.
)

REM Verifica dependencias mobile
echo Verificando dependencias do mobile...
if not exist "mobile\node_modules" (
    echo Instalando dependencias do mobile...
    cd mobile
    call npm install
    cd ..
    echo.
)

REM Verifica dependencias desktop (se houver package.json)
if exist "desktop\package.json" (
    echo Verificando dependencias do desktop...
    if not exist "desktop\node_modules" (
        echo Instalando dependencias do desktop...
        cd desktop
        call npm install
        cd ..
        echo.
    )
)

echo.
echo ========================================
echo   ESCOLHA O MODO DE EXECUCAO
echo ========================================
echo.
echo  1. Backend + Desktop (Operador - Intranet)
echo  2. Mobile Dev (Desenvolvimento Local)
echo  3. Ambos (Backend + Desktop Dev + Mobile Dev)
echo  4. Apenas Backend (API)
echo.
set /p escolha="Escolha uma opcao (1-4): "

if "%escolha%"=="1" goto backend_desktop
if "%escolha%"=="2" goto mobile_dev
if "%escolha%"=="3" goto ambos
if "%escolha%"=="4" goto apenas_backend

echo Opcao invalida!
pause
exit /b 1

:backend_desktop
cls
echo ========================================
echo   MODO: Backend + Desktop (Operador)
echo ========================================
echo.
echo Iniciando servidor backend...
start "HMASP - Backend" cmd /k "node server.js"

timeout /t 3 /nobreak >nul

echo Iniciando Desktop Dev Server...
start "HMASP - Desktop Dev" cmd /k "cd desktop && npm run dev"

timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo   SERVIDORES INICIADOS!
echo ========================================
echo.
echo  Backend (API):
echo    http://localhost:3000
echo    http://localhost:3000/api/status
echo.
echo  Desktop (Operador - Dev):
echo    http://localhost:5174
echo    - Interface do operador (desenvolvimento)
echo    - Hot reload ativado
echo.
echo  Desktop (Producao):
echo    http://localhost:3000/desktop
echo    - Servido pelo backend
echo.
echo Para parar: Feche as janelas dos servidores
echo.
goto fim

:mobile_dev
cls
echo ========================================
echo   MODO: Mobile Development
echo ========================================
echo.
echo NOTA: Mobile em producao esta no Firebase!
echo Este modo e apenas para desenvolvimento local.
echo.
echo Iniciando Mobile Dev Server...
start "HMASP - Mobile Dev" cmd /k "cd mobile && npm run dev"

timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo   MOBILE DEV INICIADO!
echo ========================================
echo.
echo  Mobile (Desenvolvimento):
echo    http://localhost:5173
echo    - App do paciente (desenvolvimento)
echo    - Hot reload ativado
echo.
echo  IMPORTANTE:
echo    - API deve estar rodando em localhost:3000
echo    - Execute Backend separadamente se necessario
echo.
echo  Deploy Producao:
echo    cd mobile
echo    npm run build
echo    firebase deploy --only hosting
echo.
goto fim

:ambos
cls
echo ========================================
echo   MODO: Desenvolvimento Completo
echo ========================================
echo.
echo Iniciando Backend...
start "HMASP - Backend" cmd /k "node server.js"

timeout /t 3 /nobreak >nul

echo Iniciando Desktop Dev...
start "HMASP - Desktop Dev" cmd /k "cd desktop && npm run dev"

timeout /t 2 /nobreak >nul

echo Iniciando Mobile Dev...
start "HMASP - Mobile Dev" cmd /k "cd mobile && npm run dev"

timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo   TODOS OS SERVIDORES INICIADOS!
echo ========================================
echo.
echo  Backend (API):
echo    http://localhost:3000/api/status
echo.
echo  Desktop Dev (Operador):
echo    http://localhost:5174
echo    - Interface do operador
echo.
echo  Mobile Dev (Paciente):
echo    http://localhost:5173
echo    - App do paciente
echo.
echo Para parar: Feche todas as janelas dos servidores
echo.
goto fim

:apenas_backend
cls
echo ========================================
echo   MODO: Apenas Backend (API)
echo ========================================
echo.
echo Iniciando servidor backend...
start "HMASP - Backend API" cmd /k "node server.js"

timeout /t 3 /nobreak >nul

echo.
echo ========================================
echo   BACKEND INICIADO!
echo ========================================
echo.
echo  Backend (API):
echo    http://localhost:3000
echo    http://localhost:3000/api/status
echo.
echo  Desktop (Producao):
echo    http://localhost:3000/desktop
echo    http://localhost:3000/
echo.
echo  NOTA: Mobile esta no Firebase Hosting
echo    (nao e servido pelo backend)
echo.
goto fim

:fim
echo ========================================
echo.
pause
