@echo off
REM ============================================================================
REM Script Windows para parar o HMASP Chat no Ubuntu/WSL
REM Execute este arquivo clicando duas vezes nele
REM ============================================================================

echo =========================================
echo   HMASP Chat - Parar Servidor WSL
echo =========================================
echo.

wsl bash -c "cd '/mnt/c/Users/user/Projetos VS Code/HMASPChat - Marcação de Consultas' && chmod +x stop-ubuntu.sh && ./stop-ubuntu.sh"

echo.
echo =========================================
echo Pressione qualquer tecla para sair...
pause >nul
