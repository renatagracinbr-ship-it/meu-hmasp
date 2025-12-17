#!/bin/bash

###############################################################################
# Script de Inicialização - Meu HMASP no Ubuntu/WSL
# Execute com: ./start-ubuntu.sh
###############################################################################

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}  Meu HMASP - Ubuntu/WSL${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""

# Verificar se está no WSL
if grep -qi microsoft /proc/version; then
    echo -e "${GREEN}✓${NC} Rodando no WSL"
else
    echo -e "${YELLOW}⚠${NC} Ambiente: Ubuntu nativo"
fi

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}✗${NC} Node.js não instalado!"
    echo -e "${YELLOW}Execute primeiro: ./setup-ubuntu.sh${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} Node.js: $(node --version)"
echo -e "${GREEN}✓${NC} npm: $(npm --version)"
echo ""

# Verificar se o arquivo .env existe
if [ ! -f .env ]; then
    echo -e "${RED}✗${NC} Arquivo .env não encontrado!"
    echo -e "${YELLOW}Execute: ./setup-ubuntu.sh${NC}"
    exit 1
fi

# Verificar se as dependências estão instaladas
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠${NC} Dependências não instaladas. Instalando..."
    npm install
    if [ $? -ne 0 ]; then
        echo -e "${RED}✗${NC} Erro ao instalar dependências"
        exit 1
    fi
fi

# ============================================================================
# LIMPEZA: Garantir que porta 3000 está livre
# ============================================================================
echo -e "${BLUE}🔄 Verificando porta 3000...${NC}"

# Matar processos Node.js antigos do servidor
KILLED_PROCESSES=0
if pgrep -f "node server.js" > /dev/null; then
    echo -e "${YELLOW}⚠${NC} Encontrado processo node server.js rodando. Parando..."
    pkill -f "node server.js" 2>/dev/null && KILLED_PROCESSES=1
    sleep 2
fi

# Liberar porta 3000 forçadamente
PORT_3000_PID=""
if command -v lsof &> /dev/null; then
    PORT_3000_PID=$(lsof -ti:3000 2>/dev/null)
elif command -v fuser &> /dev/null; then
    PORT_3000_PID=$(fuser 3000/tcp 2>/dev/null | awk '{print $1}')
fi

if [ ! -z "$PORT_3000_PID" ]; then
    echo -e "${YELLOW}⚠${NC} Porta 3000 ocupada pelo PID $PORT_3000_PID. Liberando..."
    kill -9 $PORT_3000_PID 2>/dev/null
    KILLED_PROCESSES=1
    sleep 1
fi

if [ $KILLED_PROCESSES -eq 1 ]; then
    echo -e "${GREEN}✓${NC} Porta 3000 liberada"
else
    echo -e "${GREEN}✓${NC} Porta 3000 já estava livre"
fi
echo ""

# Mostrar configuração
echo -e "${BLUE}Configuração:${NC}"
echo "  Porta: $(grep PORT .env | cut -d '=' -f2)"
echo "  Ambiente: $(grep NODE_ENV .env | cut -d '=' -f2)"
echo ""

# Perguntar modo de execução
echo "Como deseja executar o servidor?"
echo "  1) Foreground (terminal fica aberto, Ctrl+C para parar)"
echo "  2) Background (daemon, roda em segundo plano)"
echo ""
read -p "Escolha (1 ou 2): " MODE

case $MODE in
    1)
        echo ""
        echo -e "${GREEN}▶${NC} Iniciando servidor em modo foreground..."
        echo -e "${YELLOW}Pressione Ctrl+C para parar${NC}"
        echo ""
        node server.js
        ;;
    2)
        echo ""
        echo -e "${GREEN}▶${NC} Iniciando servidor em modo background..."
        nohup node server.js > server.log 2>&1 &
        SERVER_PID=$!
        sleep 2

        # Verificar se o processo está rodando
        if ps -p $SERVER_PID > /dev/null; then
            echo -e "${GREEN}✓${NC} Servidor iniciado! PID: $SERVER_PID"
            echo ""
            echo "📋 Comandos úteis:"
            echo "  Ver logs:      tail -f server.log"
            echo "  Parar:         pkill -f 'node server.js'"
            echo "  Status:        ps aux | grep 'node server.js'"
            echo ""
            echo "🌐 Acesse:"
            echo "  http://localhost:3000"
            echo ""

            # Tentar descobrir IP do WSL
            if grep -qi microsoft /proc/version; then
                WSL_IP=$(ip addr show eth0 | grep 'inet ' | awk '{print $2}' | cut -d'/' -f1)
                if [ ! -z "$WSL_IP" ]; then
                    echo "  Do Windows: http://$WSL_IP:3000"
                fi
            fi
        else
            echo -e "${RED}✗${NC} Erro ao iniciar servidor!"
            echo "Verifique os logs: cat server.log"
            exit 1
        fi
        ;;
    *)
        echo -e "${RED}Opção inválida!${NC}"
        exit 1
        ;;
esac
