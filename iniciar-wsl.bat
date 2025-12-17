@echo off
REM ============================================================================
REM Script Windows para iniciar o Meu HMASP no Ubuntu/WSL
REM Execute este arquivo clicando duas vezes nele
REM ============================================================================

echo =========================================
echo   Meu HMASP - Iniciar no Ubuntu/WSL
echo =========================================
echo.

REM Verificar se WSL está instalado
wsl --status >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERRO] WSL nao encontrado!
    echo.
    echo Instale o WSL primeiro:
    echo   wsl --install
    echo.
    pause
    exit /b 1
)

echo [OK] WSL detectado
echo.

REM Navegar para o diretório e executar o script de start
echo Iniciando servidor no Ubuntu...
echo.

wsl bash -c "cd '/mnt/c/Users/user/Projetos VS Code/Meu HMASP' && chmod +x start-ubuntu.sh && ./start-ubuntu.sh"

echo.
echo =========================================
echo Pressione qualquer tecla para sair...
pause >nul
