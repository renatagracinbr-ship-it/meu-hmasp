#!/bin/bash
################################################################################
# HMASP CHAT - INSTALAÇÃO COMPLETA PARA LINUX/UBUNTU
# Script para instalação do zero (fresh install)
################################################################################

set -e  # Para em caso de erro

echo "================================================================"
echo "  HMASP CHAT - INSTALAÇÃO LINUX/UBUNTU"
echo "================================================================"
echo ""

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para printar com cor
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "ℹ️  $1"
}

# ============================================================================
# PASSO 1: VERIFICAR PRÉ-REQUISITOS
# ============================================================================

echo "PASSO 1/6: Verificando pré-requisitos..."
echo ""

# Verificar se é root (não deve ser)
if [ "$EUID" -eq 0 ]; then
    print_error "NÃO execute este script como root! Use seu usuário normal."
    print_info "O script pedirá senha quando necessário (sudo)"
    exit 1
fi

# Verificar Ubuntu/Debian
if ! command -v apt &> /dev/null; then
    print_error "Este script é para Ubuntu/Debian (usa apt)"
    exit 1
fi

print_success "Sistema compatível detectado"
echo ""

# ============================================================================
# PASSO 2: ATUALIZAR SISTEMA E INSTALAR DEPENDÊNCIAS
# ============================================================================

echo "PASSO 2/6: Instalando dependências do sistema..."
echo ""

print_info "Atualizando repositórios..."
sudo apt update

print_info "Instalando dependências essenciais..."
sudo apt install -y \
    curl \
    wget \
    git \
    build-essential \
    ca-certificates \
    gnupg

print_success "Dependências essenciais instaladas"
echo ""

# ============================================================================
# PASSO 3: INSTALAR NODE.JS 20 LTS
# ============================================================================

echo "PASSO 3/6: Instalando Node.js 20 LTS..."
echo ""

# Verificar se Node.js já está instalado
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_warning "Node.js já instalado: $NODE_VERSION"
    read -p "Deseja reinstalar? (s/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Ss]$ ]]; then
        print_info "Pulando instalação do Node.js"
    else
        # Remover versão antiga
        sudo apt remove -y nodejs npm
    fi
fi

if ! command -v node &> /dev/null; then
    print_info "Instalando Node.js 20 LTS via NodeSource..."

    # Adicionar repositório NodeSource
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

    # Instalar Node.js
    sudo apt install -y nodejs

    print_success "Node.js instalado: $(node --version)"
    print_success "NPM instalado: $(npm --version)"
fi

echo ""

# ============================================================================
# PASSO 4: INSTALAR DEPENDÊNCIAS DO PUPPETEER/CHROME
# ============================================================================

echo "PASSO 4/6: Instalando dependências do Puppeteer/Chrome..."
echo ""

print_info "Detectando versão do Ubuntu..."

# Detecta versão do Ubuntu
UBUNTU_VERSION=$(lsb_release -rs 2>/dev/null || echo "20.04")
UBUNTU_MAJOR=$(echo $UBUNTU_VERSION | cut -d. -f1)

print_info "Ubuntu $UBUNTU_VERSION detectado"

# Define pacotes baseado na versão
if [ "$UBUNTU_MAJOR" -ge 24 ]; then
    print_info "Instalando bibliotecas para Ubuntu 24.04+ (t64)..."

    sudo apt install -y \
        fonts-liberation \
        libappindicator3-1 \
        libasound2t64 \
        libatk-bridge2.0-0t64 \
        libatk1.0-0t64 \
        libc6 \
        libcairo2 \
        libcups2t64 \
        libdbus-1-3 \
        libexpat1 \
        libfontconfig1 \
        libgbm1 \
        libglib2.0-0t64 \
        libgtk-3-0t64 \
        libnspr4 \
        libnss3 \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libstdc++6 \
        libx11-6 \
        libx11-xcb1 \
        libxcb1 \
        libxcomposite1 \
        libxcursor1 \
        libxdamage1 \
        libxext6 \
        libxfixes3 \
        libxi6 \
        libxrandr2 \
        libxrender1 \
        libxss1 \
        libxtst6 \
        lsb-release \
        xdg-utils \
        2>/dev/null || {
        print_warning "Alguns pacotes t64 não disponíveis, tentando versões padrão..."
        sudo apt install -y \
            fonts-liberation \
            libappindicator3-1 \
            libasound2 \
            libatk-bridge2.0-0 \
            libatk1.0-0 \
            libcairo2 \
            libcups2 \
            libglib2.0-0 \
            libgtk-3-0 \
            xdg-utils || true
    }
else
    print_info "Instalando bibliotecas para Ubuntu $UBUNTU_VERSION..."

    sudo apt install -y \
        fonts-liberation \
        libappindicator3-1 \
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libc6 \
        libcairo2 \
        libcups2 \
        libdbus-1-3 \
        libexpat1 \
        libfontconfig1 \
        libgbm1 \
        libgcc1 \
        libglib2.0-0 \
        libgtk-3-0 \
        libnspr4 \
        libnss3 \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libstdc++6 \
        libx11-6 \
        libx11-xcb1 \
        libxcb1 \
        libxcomposite1 \
        libxcursor1 \
        libxdamage1 \
        libxext6 \
        libxfixes3 \
        libxi6 \
        libxrandr2 \
        libxrender1 \
        libxss1 \
        libxtst6 \
        lsb-release \
        xdg-utils
fi

print_success "Dependências do Chrome instaladas"
echo ""

# ============================================================================
# PASSO 5: INSTALAR DEPENDÊNCIAS DO PROJETO
# ============================================================================

echo "PASSO 5/6: Instalando dependências do Node.js..."
echo ""

# Verificar se estamos no diretório correto
if [ ! -f "package.json" ]; then
    print_error "Arquivo package.json não encontrado!"
    print_info "Execute este script no diretório raiz do projeto"
    exit 1
fi

print_info "Instalando pacotes npm..."
npm install

# Instalar Puppeteer (baixa o Chrome automaticamente)
print_info "Configurando Puppeteer..."
npx puppeteer browsers install chrome

print_success "Dependências do projeto instaladas"
echo ""

# ============================================================================
# PASSO 6: CONFIGURAR AMBIENTE
# ============================================================================

echo "PASSO 6/6: Configurando ambiente..."
echo ""

# Criar .env se não existir
if [ ! -f ".env" ]; then
    print_warning ".env não encontrado, criando a partir de .env.example"

    if [ -f ".env.example" ]; then
        cp .env.example .env
        print_success ".env criado"
        print_warning "ATENÇÃO: Edite o arquivo .env com suas credenciais!"
        print_info "Execute: nano .env"
    else
        print_error ".env.example não encontrado!"
    fi
else
    print_success ".env já existe"
fi

# Criar pastas necessárias
print_info "Criando estrutura de pastas..."
mkdir -p logs
mkdir -p .wwebjs_auth
mkdir -p .wwebjs_cache
mkdir -p server/data

# Verificar se server/data tem os arquivos necessários
if [ ! -f "server/data/users.json" ]; then
    print_warning "Criando arquivo inicial users.json"
    cat > server/data/users.json << 'EOF'
{
  "users": [
    {
      "id": "1",
      "username": "hmasp-system",
      "password": "",
      "name": "Sistema HMASP",
      "role": "admin",
      "status": "active",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "lastLogin": null
    }
  ],
  "pendingApprovals": []
}
EOF
    print_success "users.json criado"
fi

if [ ! -f "server/data/sessions.json" ]; then
    echo '{"sessions":[]}' > server/data/sessions.json
    print_success "sessions.json criado"
fi

if [ ! -f "server/data/auto-login.json" ]; then
    cat > server/data/auto-login.json << 'EOF'
{
  "enabled": true,
  "username": "hmasp-system",
  "lastLogin": null
}
EOF
    print_success "auto-login.json criado (auto-login habilitado)"
fi

# Definir permissões corretas
print_info "Configurando permissões de execução..."
chmod -R 755 server/
chmod -R 755 logs/
chmod -R 755 .wwebjs_auth/
chmod -R 755 .wwebjs_cache/

# Dar permissão de execução para todos os scripts .sh
chmod +x *.sh 2>/dev/null || true
chmod +x start.sh stop-ubuntu.sh install-ubuntu.sh setup-ubuntu.sh 2>/dev/null || true

print_success "Estrutura de pastas criada"
print_success "Permissões de execução configuradas para scripts .sh"
echo ""

# ============================================================================
# PASSO 7: BUILD DO FRONTEND
# ============================================================================

echo "PASSO FINAL: Build do frontend..."
echo ""

if [ ! -d "dist" ] || [ -z "$(ls -A dist 2>/dev/null)" ]; then
    print_info "Compilando frontend com Vite..."
    npm run build
    print_success "Frontend compilado"
else
    print_success "Frontend já compilado (dist/ existe)"
fi

echo ""

# ============================================================================
# CONCLUSÃO
# ============================================================================

echo "================================================================"
echo -e "${GREEN}  ✅ INSTALAÇÃO CONCLUÍDA COM SUCESSO!${NC}"
echo "================================================================"
echo ""
echo -e "${YELLOW}PRÓXIMOS PASSOS:${NC}"
echo ""
echo "1. Editar configurações do banco de dados:"
echo "   ${GREEN}nano .env${NC}"
echo ""
echo "2. Iniciar o servidor:"
echo "   ${GREEN}bash start.sh${NC}"
echo ""
echo "3. Acessar as interfaces:"
echo "   - Interface Principal: ${GREEN}http://localhost:3000/${NC}"
echo "   - WhatsApp Admin: ${GREEN}http://localhost:3000/whatsapp-admin.html${NC}"
echo "   - Interface Admin: ${GREEN}http://localhost:3000/admin.html${NC}"
echo ""
echo "4. Fazer login com as credenciais padrão:"
echo "   - Usuário: ${GREEN}admin${NC}"
echo "   - Senha: ${GREEN}admin123${NC}"
echo "   ${RED}⚠️  ALTERE A SENHA APÓS PRIMEIRO LOGIN!${NC}"
echo ""
echo "================================================================"
echo ""

# Perguntar se deseja iniciar agora
read -p "Deseja iniciar o servidor agora? (S/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    echo ""
    print_info "Iniciando servidor..."
    bash start.sh
fi
