#!/bin/bash
################################################################################
# HMASP CHAT - SCRIPT DE INICIALIZAÇÃO ÚNICO
# Execute: bash start.sh
################################################################################

set -e  # Para em caso de erro

echo "========================================"
echo "  HMASP Chat - Iniciando Aplicação"
echo "========================================"
echo ""

# Verificar se estamos no diretório correto
if [ ! -f "package.json" ]; then
    echo "❌ ERRO: Execute este script no diretório raiz do projeto!"
    exit 1
fi

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não instalado!"
    echo "Execute: sudo apt install -y nodejs npm"
    exit 1
fi

echo "✅ Node.js: $(node --version)"
echo "✅ NPM: $(npm --version)"
echo ""

# Instalar dependências (se necessário)
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
    echo ""
fi

# Verificar se precisa fazer build do frontend
if [ ! -f "dist/index.html" ]; then
    echo "🔨 Frontend não compilado. Fazendo build..."
    npm run build
    echo ""
fi

# Parar processos antigos (se existirem)
echo "🔄 Verificando processos antigos..."

# Tentar matar processos Node.js do servidor
pkill -f "node server.js" 2>/dev/null || true

# Verificar se porta 3000 está ocupada e liberar
if command -v fuser &> /dev/null; then
    echo "   Liberando porta 3000..."
    fuser -k 3000/tcp 2>/dev/null || true
elif command -v lsof &> /dev/null; then
    echo "   Verificando porta 3000..."
    PID=$(lsof -ti:3000 2>/dev/null)
    if [ ! -z "$PID" ]; then
        echo "   Matando processo na porta 3000 (PID: $PID)"
        kill -9 $PID 2>/dev/null || true
    fi
fi

# Aguardar um momento para garantir que a porta foi liberada
sleep 2
echo ""

# Iniciar servidor em background
echo "🚀 Iniciando servidor na porta 3000..."
node server.js &
SERVER_PID=$!
echo "   PID do servidor: $SERVER_PID"
echo ""

# Aguardar servidor iniciar
echo "⏳ Aguardando servidor inicializar..."
sleep 3

# Verificar se servidor está rodando
if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "❌ ERRO: Servidor falhou ao iniciar!"
    exit 1
fi

# Testar se servidor está respondendo
for i in {1..10}; do
    if curl -s http://localhost:3000/api/status > /dev/null 2>&1; then
        echo "✅ Servidor está respondendo!"
        break
    fi
    if [ $i -eq 10 ]; then
        echo "⚠️  Servidor demorou para responder, mas continuando..."
    fi
    sleep 1
done
echo ""

# Detectar ambiente (WSL ou Linux puro)
IS_WSL=false
if grep -qi microsoft /proc/version 2>/dev/null; then
    IS_WSL=true
fi

echo "========================================"
echo "  ✅ SERVIDOR RODANDO!"
echo "========================================"
echo ""
echo "🏥 Interface Principal (Usuários):         http://localhost:3000/"
echo "⚙️  Interface Admin (VM - Envio Auto):     http://localhost:3000/admin.html"
echo "📱 WhatsApp Admin (Status/QR):             http://localhost:3000/whatsapp-admin.html"
echo ""

# Abrir navegador automaticamente
if [ "$IS_WSL" = true ]; then
    echo "🌐 Abrindo navegador automaticamente no Windows..."
    echo ""

    # Abrir navegador do Windows via WSL
    # Aguarda entre as abas para não sobrecarregar
    cmd.exe /c start http://localhost:3000/ 2>/dev/null &
    sleep 1
    cmd.exe /c start http://localhost:3000/admin.html 2>/dev/null &
    sleep 1
    cmd.exe /c start http://localhost:3000/whatsapp-admin.html 2>/dev/null &

    echo "✅ Navegador aberto com 3 abas:"
    echo "   1️⃣  Interface Principal (Usuários)"
    echo "   2️⃣  Interface Admin (VM - Envio Automático)"
    echo "   3️⃣  WhatsApp Admin (Status/QR)"
else
    echo "ℹ️  Abra manualmente no navegador as URLs acima"
    echo ""

    # Tentar abrir navegador no Linux (se disponível)
    if command -v xdg-open &> /dev/null; then
        echo "🌐 Tentando abrir navegador..."
        xdg-open "http://localhost:3000/" 2>/dev/null &
        sleep 1
        xdg-open "http://localhost:3000/admin.html" 2>/dev/null &
        sleep 1
        xdg-open "http://localhost:3000/whatsapp-admin.html" 2>/dev/null &
    fi
fi

echo ""
echo "========================================"
echo "  ⌨️  COMANDOS ÚTEIS"
echo "========================================"
echo ""
echo "  Ver logs:    tail -f logs/app.log"
echo "  Parar:       Ctrl+C"
echo "  Status:      curl http://localhost:3000/api/status"
echo ""
echo "========================================"
echo ""
echo "⏸️  Pressione Ctrl+C para parar o servidor"
echo ""

# Manter processo rodando e exibir logs
wait $SERVER_PID
