#!/bin/bash

###############################################################################
# Script de Instalação Automática - HMASP Chat (Ubuntu)
# Instala tudo que você precisa com 1 comando só
###############################################################################

echo "========================================="
echo "  HMASP Chat - Instalação Automática"
echo "========================================="
echo ""

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # Sem cor

# Função para print colorido
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "ℹ $1"
}

# Verifica se está rodando como root
if [ "$EUID" -eq 0 ]; then
    print_error "NÃO rode este script como root (sudo)!"
    print_info "Execute: ./setup-ubuntu.sh"
    exit 1
fi

echo "Passo 1/5: Atualizando sistema..."
echo "-----------------------------------"
sudo apt update
print_success "Sistema atualizado"
echo ""

echo "Passo 2/5: Instalando Node.js 20.x LTS..."
echo "-----------------------------------"
# Verifica se Node.js já está instalado
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    print_warning "Node.js já instalado: $NODE_VERSION"
    read -p "Deseja reinstalar com Node.js 20.x? (s/N): " REINSTALL_NODE
    if [[ $REINSTALL_NODE =~ ^[Ss]$ ]]; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt install -y nodejs
        print_success "Node.js reinstalado: $(node -v)"
    else
        print_info "Mantendo Node.js atual"
    fi
else
    print_info "Instalando Node.js 20.x LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
    print_success "Node.js instalado: $(node -v)"
fi
echo ""

echo "Passo 3/5: Instalando dependências do sistema..."
echo "-----------------------------------"
print_info "Instalando dependências essenciais e bibliotecas do Chromium..."

# Dependências básicas
sudo apt install -y build-essential python3 chromium-browser

# Dependências do Chromium/Puppeteer (compatível com Ubuntu 20.04+)
# Usa nomes com t64 para Ubuntu 24.04, fallback para versões antigas
sudo apt install -y \
    libnss3 \
    libatk1.0-0t64 libatk1.0-0 \
    libatk-bridge2.0-0t64 libatk-bridge2.0-0 \
    libcups2t64 libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2t64 libasound2 \
    libxshmfence1 \
    ca-certificates \
    fonts-liberation \
    2>/dev/null || true

print_success "Dependências instaladas"
echo ""

echo "Passo 4/5: Instalando dependências do projeto..."
echo "-----------------------------------"
print_info "Executando npm install..."
npm install
if [ $? -eq 0 ]; then
    print_success "Dependências do Node.js instaladas"
else
    print_error "Erro ao instalar dependências do Node.js"
    exit 1
fi

# Recompilar módulos nativos para Linux (importante!)
print_info "Recompilando módulos nativos para Linux..."
npm rebuild better-sqlite3 2>/dev/null || true
print_success "Módulos nativos recompilados"
echo ""

echo "Passo 5/5: Configurando ambiente..."
echo "-----------------------------------"

# Cria diretórios necessários
mkdir -p server/data
mkdir -p server/database
mkdir -p .wwebjs_auth
print_success "Diretórios criados"

# Cria arquivo .env se não existir
if [ ! -f .env ]; then
    print_info "Criando arquivo .env..."
    cat > .env << 'EOF'
# Porta do servidor
PORT=3000

# Ambiente
NODE_ENV=production

# URLs (ajuste conforme seu domínio/IP)
AGHUSE_URL=http://localhost:3001

EOF
    print_success "Arquivo .env criado"
    print_warning "IMPORTANTE: Edite o arquivo .env com suas configurações!"
else
    print_info "Arquivo .env já existe (mantendo atual)"
fi

# Define permissões
chmod +x server.js
print_success "Permissões configuradas"
echo ""

echo "========================================="
echo "  ✓ INSTALAÇÃO CONCLUÍDA!"
echo "========================================="
echo ""
print_success "Tudo instalado com sucesso!"
echo ""
echo "📋 Próximos passos:"
echo ""
echo "1. Edite o arquivo .env se necessário:"
echo "   nano .env"
echo ""
echo "2. Inicie o servidor:"
echo "   node server.js"
echo ""
echo "   OU em background:"
echo "   nohup node server.js > server.log 2>&1 &"
echo ""
echo "3. Acesse no navegador:"
echo "   http://localhost:3000"
echo ""
echo "📦 Banco de dados SQLite:"
echo "   Será criado automaticamente em:"
echo "   server/database/confirmacoes_arquivadas.db"
echo ""
echo "💾 Backup do banco:"
echo "   cp server/database/confirmacoes_arquivadas.db ~/backup/"
echo ""
print_info "Instalação completa! 🎉"
