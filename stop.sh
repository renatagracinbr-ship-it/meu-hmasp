#!/bin/bash
################################################################################
# HMASP CHAT - SCRIPT PARA PARAR O SERVIDOR
# Execute: bash stop.sh
################################################################################

echo "========================================"
echo "  Parando HMASP Chat"
echo "========================================"
echo ""

# Matar todos os processos Node.js do servidor
echo "🛑 Parando processos Node.js..."
pkill -f "node server.js" 2>/dev/null && echo "   ✅ Processos node server.js parados" || echo "   ℹ️  Nenhum processo node server.js encontrado"
pkill -f "node.*server.js" 2>/dev/null || true

# Liberar porta 3000
echo ""
echo "🔓 Liberando porta 3000..."

# Tentar com fuser (mais comum no Ubuntu)
if command -v fuser &> /dev/null; then
    fuser -k 3000/tcp 2>/dev/null && echo "   ✅ Porta 3000 liberada (fuser)" || echo "   ℹ️  Porta 3000 já estava livre"
fi

# Tentar com lsof (alternativa)
if command -v lsof &> /dev/null; then
    PID=$(lsof -ti:3000 2>/dev/null)
    if [ ! -z "$PID" ]; then
        echo "   Matando processo na porta 3000 (PID: $PID)"
        kill -9 $PID 2>/dev/null
        echo "   ✅ Porta 3000 liberada (lsof)"
    fi
fi

# Verificar se ainda há algo na porta 3000
echo ""
echo "📊 Verificando porta 3000..."
if command -v lsof &> /dev/null; then
    RESULT=$(lsof -ti:3000 2>/dev/null)
    if [ -z "$RESULT" ]; then
        echo "   ✅ Porta 3000 está livre"
    else
        echo "   ⚠️  Ainda há processo na porta 3000 (PID: $RESULT)"
        echo "   Execute manualmente: sudo kill -9 $RESULT"
    fi
elif command -v netstat &> /dev/null; then
    RESULT=$(netstat -tuln | grep :3000)
    if [ -z "$RESULT" ]; then
        echo "   ✅ Porta 3000 está livre"
    else
        echo "   ⚠️  Ainda há algo na porta 3000:"
        echo "$RESULT"
    fi
fi

echo ""
echo "✅ Servidor parado!"
echo ""
