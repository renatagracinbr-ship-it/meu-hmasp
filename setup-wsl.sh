#!/bin/bash

echo "========================================"
echo "  HMASP Chat - Configuração WSL/Ubuntu"
echo "========================================"
echo ""

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Função para mensagens
print_step() {
    echo -e "${GREEN}[STEP]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 1. Atualizar sistema
print_step "Atualizando sistema Ubuntu..."
sudo apt update -qq

# 2. Instalar dependências do sistema
print_step "Instalando dependências do sistema..."
sudo apt install -y \
    git \
    curl \
    wget \
    ca-certificates \
    gnupg \
    build-essential \
    libgbm-dev \
    libnss3 \
    libatk1.0-0t64 libatk1.0-0 \
    libatk-bridge2.0-0t64 libatk-bridge2.0-0 \
    libgtk-3-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxi6 \
    libxtst6 \
    libasound2t64 libasound2 \
    libpangocairo-1.0-0 \
    libatspi2.0-0 \
    libxrandr2 \
    libxkbcommon0 \
    libxfixes3 \
    libxshmfence1 \
    libdrm2 \
    libcups2t64 libcups2 \
    fonts-liberation \
    2>/dev/null || true

# 3. Verificar Node.js
print_step "Verificando Node.js..."
if ! command -v node &> /dev/null; then
    print_warning "Node.js não encontrado. Instalando Node.js 20.x LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - > /dev/null 2>&1
    sudo apt install -y nodejs > /dev/null 2>&1
else
    NODE_VERSION=$(node -v)
    print_step "Node.js já instalado: $NODE_VERSION"
fi

NPM_VERSION=$(npm -v)
echo "   └─ NPM: $NPM_VERSION"

# 4. Ir para o diretório do projeto
PROJETO_DIR="/mnt/c/Users/user/Projetos VS Code/HMASPChat - Marcação de Consultas"
print_step "Navegando para o projeto..."
cd "$PROJETO_DIR" || {
    print_error "Não foi possível acessar o diretório do projeto!"
    exit 1
}

# 5. Limpar node_modules do Windows (incompatível)
if [ -d "node_modules" ]; then
    print_warning "Removendo node_modules do Windows (incompatível com WSL)..."
    rm -rf node_modules
    rm -f package-lock.json
fi

# 6. Instalar dependências do projeto
print_step "Instalando dependências do Node.js..."
echo "   └─ Isso vai demorar ~2-3 minutos (inclui download do Chromium ~300MB)"
npm install

# 7. Instalar Puppeteer (Chromium para WhatsApp)
print_step "Instalando Puppeteer/Chromium..."
npm install puppeteer

# 8. Recompilar módulos nativos para Linux
print_step "Recompilando módulos nativos para Linux..."
npm rebuild better-sqlite3 2>/dev/null || true
echo "   └─ Módulos nativos recompilados"

# 9. Verificar instalação
print_step "Verificando instalação..."
if [ ! -d "node_modules" ]; then
    print_error "Falha ao instalar dependências!"
    exit 1
fi

if [ ! -f "node_modules/puppeteer/package.json" ]; then
    print_warning "Puppeteer não foi instalado corretamente. Tentando novamente..."
    npm install puppeteer --force
fi

# 9. Criar .env se não existir
if [ ! -f ".env" ]; then
    print_step "Criando arquivo .env..."
    cp .env.example .env
    print_warning "Arquivo .env criado. Configure as credenciais do banco se necessário."
else
    print_step "Arquivo .env já existe."
fi

# 10. Verificar permissões do start.sh
if [ -f "start.sh" ]; then
    chmod +x start.sh
    print_step "Permissões do start.sh configuradas."
fi

echo ""
echo "========================================"
echo -e "  ${GREEN}✅ CONFIGURAÇÃO CONCLUÍDA!${NC}"
echo "========================================"
echo ""
echo "📋 Resumo:"
echo "   • Node.js: $(node -v)"
echo "   • NPM: $(npm -v)"
echo "   • Dependências: Instaladas"
echo "   • Chromium: Instalado"
echo "   • Diretório: $PROJETO_DIR"
echo ""
echo "🚀 Para iniciar o servidor:"
echo "   bash start.sh"
echo ""
echo "📝 Notas:"
echo "   • O banco PostgreSQL (AGHUse) só funciona na rede do HMASP"
echo "   • O sistema funciona mesmo sem conexão com o banco"
echo "   • O WhatsApp será inicializado e pedirá QR Code"
echo ""
echo "========================================"
