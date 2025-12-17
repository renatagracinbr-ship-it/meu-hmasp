#!/bin/bash

# HMASP Chat - Script de Instalação para Ubuntu
# Execute com: bash install-ubuntu.sh

set -e  # Para em caso de erro

echo "======================================"
echo "HMASP Chat - Instalação Ubuntu"
echo "======================================"
echo ""

# 1. Instalar Node.js 18.x (se não estiver instalado)
if ! command -v node &> /dev/null; then
    echo "📦 Instalando Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "✅ Node.js já instalado: $(node -v)"
fi

# 2. Instalar dependências do sistema
echo ""
echo "📦 Instalando dependências do sistema..."
sudo apt-get update
sudo apt-get install -y \
    chromium-browser \
    ca-certificates \
    fonts-liberation \
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
    wget \
    xdg-utils

# 3. Instalar dependências npm
echo ""
echo "📦 Instalando dependências npm..."
npm install

# 4. Criar diretório para banco de dados
echo ""
echo "📁 Criando estrutura de diretórios..."
mkdir -p server/database

# 5. Inicializar banco de dados
echo ""
echo "🗄️ Inicializando banco de dados..."
node -e "
const ConsultasService = require('./server/database/consultas.service.js');
const WhatsAppRespostasService = require('./server/database/whatsappRespostas.service.js');
console.log('Inicializando consultas...');
ConsultasService.init();
console.log('Inicializando respostas WhatsApp...');
WhatsAppRespostasService.init();
console.log('✅ Banco de dados inicializado!');
"

# 6. Build do frontend
echo ""
echo "🔨 Compilando frontend..."
npm run build

# 7. Criar arquivo .env se não existir
if [ ! -f .env ]; then
    echo ""
    echo "📝 Criando arquivo .env..."
    cat > .env << 'ENVFILE'
NODE_ENV=production
PORT=3000
ENVFILE
fi

# 8. Criar systemd service
echo ""
echo "🔧 Criando serviço systemd..."
sudo tee /etc/systemd/system/hmasp-chat.service > /dev/null << 'SERVICEEOF'
[Unit]
Description=HMASP Chat - Sistema de Marcação de Consultas
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/hmasp-chat
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
SERVICEEOF

# 9. Ativar e iniciar serviço
echo ""
echo "🚀 Ativando serviço..."
sudo systemctl daemon-reload
sudo systemctl enable hmasp-chat
sudo systemctl start hmasp-chat

echo ""
echo "======================================"
echo "✅ Instalação concluída!"
echo "======================================"
echo ""
echo "📊 Status do serviço:"
sudo systemctl status hmasp-chat --no-pager
echo ""
echo "📝 Comandos úteis:"
echo "  Ver logs:        sudo journalctl -u hmasp-chat -f"
echo "  Parar serviço:   sudo systemctl stop hmasp-chat"
echo "  Iniciar serviço: sudo systemctl start hmasp-chat"
echo "  Restart:         sudo systemctl restart hmasp-chat"
echo ""
echo "🌐 Acesse: http://localhost:3000"
echo ""
