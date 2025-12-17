#!/bin/bash

###############################################################################
# Script para Parar o Servidor - HMASP Chat no Ubuntu/WSL
# Execute com: ./stop-ubuntu.sh
###############################################################################

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "========================================="
echo "  Parando HMASP Chat Server"
echo "========================================="
echo ""

# Verificar se há processos rodando
if pgrep -f "node server.js" > /dev/null; then
    echo -e "${YELLOW}Encontrados processos rodando:${NC}"
    ps aux | grep "node server.js" | grep -v grep
    echo ""

    # Parar processos
    pkill -f "node server.js"

    # Aguardar um momento
    sleep 2

    # Verificar se parou
    if pgrep -f "node server.js" > /dev/null; then
        echo -e "${RED}✗${NC} Processos ainda rodando. Tentando forçar..."
        pkill -9 -f "node server.js"
        sleep 1

        if pgrep -f "node server.js" > /dev/null; then
            echo -e "${RED}✗${NC} Não foi possível parar os processos!"
            exit 1
        else
            echo -e "${GREEN}✓${NC} Servidor parado (força)"
        fi
    else
        echo -e "${GREEN}✓${NC} Servidor parado com sucesso!"
    fi
else
    echo -e "${YELLOW}⚠${NC} Nenhum servidor rodando"
fi

echo ""
echo "Para iniciar novamente: ./start-ubuntu.sh"
echo "Ver logs: tail -f server.log"
