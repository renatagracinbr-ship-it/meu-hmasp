# HMASP Chat - Guia Completo de Deploy Linux/Ubuntu

## 📋 Pré-requisitos

- Ubuntu 20.04 LTS ou superior (ou Debian 11+)
- Acesso root (sudo)
- Conexão com internet
- Acesso à rede interna do HMASP (para banco de dados AGHUse)

---

## 🚀 Instalação Rápida (Recomendada)

### Método 1: Script Automático

```bash
# 1. Clonar ou transferir o projeto para o servidor
git clone https://github.com/renatagracinbr-ship-it/HMASP-Chat.git
cd HMASP-Chat

# 2. Executar script de instalação
bash install-linux.sh

# 3. Editar configurações
nano .env

# 4. Iniciar
bash start.sh
```

**Pronto!** O script `install-linux.sh` instala tudo automaticamente:
- ✅ Node.js 20 LTS
- ✅ Dependências do Chrome/Puppeteer
- ✅ Dependências do projeto
- ✅ Estrutura de pastas
- ✅ Build do frontend
- ✅ Configurações iniciais

---

## 🔧 Instalação Manual (Passo a Passo)

### 1. Atualizar Sistema

```bash
sudo apt update
sudo apt upgrade -y
```

### 2. Instalar Node.js 20 LTS

```bash
# Adicionar repositório NodeSource
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Instalar Node.js
sudo apt install -y nodejs

# Verificar instalação
node --version  # deve mostrar v20.x.x
npm --version
```

### 3. Instalar Dependências do Chrome/Puppeteer

```bash
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
    wget \
    xdg-utils \
    ca-certificates \
    gnupg
```

### 4. Clonar Projeto

```bash
# Via Git
git clone https://github.com/renatagracinbr-ship-it/HMASP-Chat.git
cd HMASP-Chat

# OU via transferência de arquivos (scp/rsync)
# scp -r /caminho/local/HMASP-Chat usuario@servidor:/home/usuario/
```

### 5. Instalar Dependências do Projeto

```bash
# Instalar pacotes npm
npm install

# Instalar Chrome para Puppeteer
npx puppeteer browsers install chrome
```

### 6. Configurar Ambiente

```bash
# Copiar arquivo de exemplo
cp .env.example .env

# Editar configurações
nano .env
```

**Configurações importantes no .env:**

```env
# Servidor
PORT=3000
NODE_ENV=production

# Banco de dados AGHUse - AJUSTAR PARA SEU AMBIENTE
DB_HOST=10.12.40.219
DB_PORT=5432
DB_NAME=dbaghu
DB_USER=birm_read
DB_PASSWORD=birm@read

# WhatsApp
WHATSAPP_SESSION_NAME=hmasp-chat

# Auto-login (deixar true para VM)
AUTO_LOGIN_ENABLED=true
```

### 7. Criar Estrutura de Pastas

```bash
mkdir -p logs
mkdir -p .wwebjs_auth
mkdir -p .wwebjs_cache
mkdir -p server/data

# Criar arquivos de dados iniciais se não existirem
cat > server/data/users.json << 'EOF'
{
  "users": [
    {
      "id": "1",
      "username": "admin",
      "password": "admin123",
      "name": "Administrador",
      "role": "admin",
      "status": "active",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "lastLogin": null
    }
  ],
  "pendingApprovals": []
}
EOF

echo '{"sessions":[]}' > server/data/sessions.json

cat > server/data/auto-login.json << 'EOF'
{
  "enabled": true,
  "username": "admin",
  "lastLogin": null
}
EOF

# Definir permissões
chmod -R 755 server/
chmod -R 755 logs/
chmod +x start.sh
```

### 8. Build do Frontend

```bash
npm run build
```

### 9. Iniciar Servidor

```bash
# Teste primeiro em foreground
bash start.sh

# Se funcionar, instalar PM2 para produção (ver seção abaixo)
```

---

## 🔄 Inicialização Automática (Produção)

### Opção 1: PM2 (Recomendado)

PM2 é um gerenciador de processos Node.js com monitoramento e restart automático.

```bash
# Instalar PM2 globalmente
sudo npm install -g pm2

# Iniciar aplicação
pm2 start server.js --name hmasp-chat

# Configurar para iniciar com o sistema
pm2 startup systemd
# COPIE E EXECUTE O COMANDO QUE APARECER

# Salvar configuração
pm2 save

# Comandos úteis
pm2 status              # Ver status
pm2 logs hmasp-chat     # Ver logs
pm2 restart hmasp-chat  # Reiniciar
pm2 stop hmasp-chat     # Parar
pm2 delete hmasp-chat   # Remover
```

### Opção 2: Systemd Service

Usar o arquivo `hmasp-whatsapp.service` já existente no projeto:

```bash
# Editar o arquivo se necessário
nano hmasp-whatsapp.service

# Copiar para systemd
sudo cp hmasp-whatsapp.service /etc/systemd/system/

# Recarregar systemd
sudo systemctl daemon-reload

# Habilitar para iniciar com o sistema
sudo systemctl enable hmasp-whatsapp

# Iniciar serviço
sudo systemctl start hmasp-whatsapp

# Verificar status
sudo systemctl status hmasp-whatsapp

# Ver logs
sudo journalctl -u hmasp-whatsapp -f
```

---

## 🔥 Configuração de Firewall

### Ubuntu (UFW)

```bash
# Permitir porta 3000
sudo ufw allow 3000/tcp

# Se for acessar via SSH
sudo ufw allow 22/tcp

# Habilitar firewall
sudo ufw enable

# Verificar status
sudo ufw status
```

### CentOS/RHEL (firewalld)

```bash
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

---

## 📊 Monitoramento e Logs

### Ver Logs da Aplicação

```bash
# Logs do sistema
tail -f logs/app.log

# Com PM2
pm2 logs hmasp-chat

# Com systemd
sudo journalctl -u hmasp-whatsapp -f
```

### Monitorar Recursos

```bash
# Com PM2
pm2 monit

# Manual
htop
```

---

## 🔄 Atualização da Aplicação

```bash
# 1. Parar servidor
pm2 stop hmasp-chat
# OU
sudo systemctl stop hmasp-whatsapp

# 2. Fazer backup (importante!)
cp -r server/data server/data.backup
cp .env .env.backup

# 3. Atualizar código
git pull origin main
# OU copiar novos arquivos via scp

# 4. Instalar novas dependências (se houver)
npm install

# 5. Rebuild frontend
npm run build

# 6. Reiniciar servidor
pm2 start hmasp-chat
# OU
sudo systemctl start hmasp-whatsapp
```

---

## 🐛 Troubleshooting

### Problema: Chrome/Puppeteer não funciona

```bash
# Verificar se Chrome foi instalado pelo Puppeteer
npx puppeteer browsers list

# Se não, instalar manualmente
npx puppeteer browsers install chrome

# Verificar dependências do sistema
ldd ~/.cache/puppeteer/chrome/*/chrome-linux64/chrome | grep "not found"
```

### Problema: Porta 3000 já em uso

```bash
# Verificar o que está usando a porta
sudo lsof -i :3000

# Ou
sudo netstat -tulpn | grep :3000

# Matar processo
sudo kill -9 <PID>
```

### Problema: WhatsApp não conecta

```bash
# Limpar sessão antiga
rm -rf .wwebjs_auth/
rm -rf .wwebjs_cache/

# Reiniciar servidor
pm2 restart hmasp-chat

# Acessar http://SERVIDOR:3000/whatsapp-admin.html
# Escanear QR Code novamente
```

### Problema: Erro de conexão com banco de dados

```bash
# Testar conexão com PostgreSQL
psql -h 10.12.40.219 -p 5432 -U birm_read -d dbaghu

# Verificar se o IP está correto no .env
cat .env | grep DB_HOST

# Verificar se o servidor consegue alcançar o banco
ping 10.12.40.219
telnet 10.12.40.219 5432
```

---

## 📱 Acessando as Interfaces

Após iniciar o servidor, acesse:

- **Interface Principal (Usuários):**
  `http://SERVIDOR:3000/`

- **WhatsApp Admin (QR Code/Status):**
  `http://SERVIDOR:3000/whatsapp-admin.html`

- **Interface Admin (Envio Automático):**
  `http://SERVIDOR:3000/admin.html`

*Sistema usa auto-login automático - sem necessidade de login manual*

---

## 🔐 Segurança

### Firewall para acesso interno

Se o servidor deve ser acessado apenas internamente:

```bash
# Permitir apenas rede interna (exemplo: 10.12.40.0/24)
sudo ufw deny 3000/tcp
sudo ufw allow from 10.12.40.0/24 to any port 3000
```

### Backup automático

```bash
# Criar script de backup
cat > /home/usuario/backup-hmasp.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/home/usuario/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

# Backup dos dados
tar -czf "$BACKUP_DIR/hmasp-data-$DATE.tar.gz" \
    /home/usuario/HMASP-Chat/server/data \
    /home/usuario/HMASP-Chat/.env \
    /home/usuario/HMASP-Chat/.wwebjs_auth

# Manter apenas últimos 7 dias
find "$BACKUP_DIR" -name "hmasp-data-*.tar.gz" -mtime +7 -delete

echo "Backup concluído: $BACKUP_DIR/hmasp-data-$DATE.tar.gz"
EOF

chmod +x /home/usuario/backup-hmasp.sh

# Agendar no crontab (todo dia às 2h da manhã)
crontab -e
# Adicionar linha:
# 0 2 * * * /home/usuario/backup-hmasp.sh
```

---

## 📞 Suporte

Em caso de problemas:

1. Verificar logs: `tail -f logs/app.log`
2. Verificar status: `pm2 status` ou `sudo systemctl status hmasp-whatsapp`
3. Reiniciar servidor: `pm2 restart hmasp-chat` ou `sudo systemctl restart hmasp-whatsapp`

---

**Desenvolvido para HMASP São Paulo**
**Última atualização**: Dezembro 2024
