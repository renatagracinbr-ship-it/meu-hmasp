@echo off
echo ====================================
echo HMASP Chat - Criando Pacote
echo ====================================
echo.

REM Remove pacote antigo se existir
if exist hmasp-chat.zip del hmasp-chat.zip

echo Criando arquivo ZIP...
powershell -Command "Compress-Archive -Path server,src,dist,public,*.js,*.json,*.sql,*.sh,package*.json,.env.example -DestinationPath hmasp-chat.zip -Force"

echo.
echo ====================================
echo Pacote criado: hmasp-chat.zip
echo ====================================
echo.
echo Instrucoes:
echo 1. Envie o arquivo hmasp-chat.zip para o Google Drive
echo 2. Na VM Ubuntu, baixe o arquivo
echo 3. Extraia: unzip hmasp-chat.zip -d hmasp-chat
echo 4. Entre no diretorio: cd hmasp-chat
echo 5. Execute: bash install-ubuntu.sh
echo.
pause
