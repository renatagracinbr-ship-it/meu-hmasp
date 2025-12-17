# 📱 Instalação VM2 - Backend WhatsApp API

Guia passo a passo para instalar e configurar o backend WhatsApp na VM do HMASP.

---

## 📋 Pré-requisitos

- VM Ubuntu Server 22.04 LTS instalado
- IP fixo configurado: `10.12.40.51` (exemplo)
- Acesso SSH como usuário com sudo
- Acesso à internet (para conectar no WhatsApp Web)
- Celular com WhatsApp instalado (para QR Code)

---

## 🚀 Instalação

### Passo 1: Atualizar Sistema

```bash
# Conectar na VM via SSH
ssh usuario@10.12.40.51

# Atualizar pacotes
sudo apt-get update
sudo apt-get upgrade -y
sudo apt-get autoremove -y
```

### Passo 2: Instalar Node.js 20.x

```bash
# Adicionar repositório oficial do Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Instalar Node.js e npm
sudo apt-get install -y nodejs

# Verificar instalação
node --version  # Deve mostrar v20.x.x
npm --version   # Deve mostrar 10.x.x
```

### Passo 3: Instalar Chromium (necessário para WhatsApp Web)

```bash
# Instalar Chromium e dependências
sudo apt-get install -y chromium-browser ca-certificates fonts-liberation \
  libappindicator3-1 libasound2 libatk-bridge2.0-0 libatk1.0-0 libc6 \
  libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 libgbm1 \
  libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 \
  libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 \
  libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 \
  libxrandr2 libxrender1 libxss1 libxtst6 lsb-release wget xdg-utils

# Verificar instalação
chromium-browser --version
```

### Passo 4: Criar Usuário para o Serviço

```bash
# Criar usuário sem shell (mais seguro)
sudo useradd -r -s /bin/false hmasp-whatsapp

# Criar diretório home
sudo mkdir -p /opt/hmasp-whatsapp
sudo chown hmasp-whatsapp:hmasp-whatsapp /opt/hmasp-whatsapp
```

### Passo 5: Instalar Aplicação

```bash
# Entrar no diretório
cd /opt/hmasp-whatsapp

# Criar package.json
sudo tee package.json > /dev/null <<'EOF'
{
  "name": "hmasp-whatsapp-backend",
  "version": "1.0.0",
  "description": "Backend WhatsApp API para HMASP Chat",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "whatsapp-web.js": "^1.23.0",
    "qrcode": "^1.5.3",
    "pg": "^8.11.3"
  }
}
EOF

# Instalar dependências
sudo npm install --production

# Ajustar permissões
sudo chown -R hmasp-whatsapp:hmasp-whatsapp /opt/hmasp-whatsapp
```

### Passo 6: Copiar Código do Servidor

**Opção A: Copiar via SCP (da sua máquina local)**

```bash
# Na sua máquina local (Windows)
scp server.js usuario@10.12.40.51:/tmp/

# Na VM (SSH)
sudo mv /tmp/server.js /opt/hmasp-whatsapp/
sudo chown hmasp-whatsapp:hmasp-whatsapp /opt/hmasp-whatsapp/server.js
```

**Opção B: Criar manualmente (colar o código)**

```bash
sudo nano /opt/hmasp-whatsapp/server.js
# (Colar o conteúdo do arquivo server.js do projeto)
# Ctrl+O para salvar, Ctrl+X para sair

sudo chown hmasp-whatsapp:hmasp-whatsapp /opt/hmasp-whatsapp/server.js
```

### Passo 7: Criar Variáveis de Ambiente

```bash
sudo tee /opt/hmasp-whatsapp/.env > /dev/null <<'EOF'
PORT=3000
NODE_ENV=production
POSTGRES_HOST=10.12.40.60
POSTGRES_PORT=5432
POSTGRES_DB=hmasp_chat_producao
POSTGRES_USER=hmasp_app
POSTGRES_PASSWORD=SuaSenhaSegura123!
EOF

# Proteger arquivo de credenciais
sudo chmod 600 /opt/hmasp-whatsapp/.env
sudo chown hmasp-whatsapp:hmasp-whatsapp /opt/hmasp-whatsapp/.env
```

### Passo 8: Configurar Systemd Service

```bash
sudo tee /etc/systemd/system/hmasp-whatsapp.service > /dev/null <<'EOF'
[Unit]
Description=HMASP WhatsApp Backend API
Documentation=https://github.com/hmasp/chat
After=network.target

[Service]
Type=simple
User=hmasp-whatsapp
WorkingDirectory=/opt/hmasp-whatsapp
Environment=NODE_ENV=production
EnvironmentFile=/opt/hmasp-whatsapp/.env
ExecStart=/usr/bin/node /opt/hmasp-whatsapp/server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=hmasp-whatsapp

# Segurança
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/hmasp-whatsapp

[Install]
WantedBy=multi-user.target
EOF

# Recarregar systemd
sudo systemctl daemon-reload

# Habilitar auto-start
sudo systemctl enable hmasp-whatsapp
```

### Passo 9: Configurar Firewall

```bash
# Instalar UFW se não estiver instalado
sudo apt-get install -y ufw

# Permitir SSH (IMPORTANTE: fazer isso primeiro!)
sudo ufw allow from 10.12.40.0/24 to any port 22

# Permitir porta 3000 apenas de VM1 (frontend)
sudo ufw allow from 10.12.40.50 to any port 3000

# Permitir tráfego HTTPS para WhatsApp Web
sudo ufw allow out 443/tcp

# Ativar firewall
sudo ufw enable

# Verificar regras
sudo ufw status verbose
```

### Passo 10: Iniciar Serviço

```bash
# Iniciar serviço
sudo systemctl start hmasp-whatsapp

# Verificar status
sudo systemctl status hmasp-whatsapp

# Ver logs em tempo real
sudo journalctl -u hmasp-whatsapp -f
```

---

## 📱 Autenticação WhatsApp (QR Code)

### Passo 1: Acessar Interface de Autenticação

```bash
# Na VM, descobrir se o servidor está rodando
curl http://localhost:3000/api/status

# Resposta esperada:
# {"authenticated": false, "ready": false}
```

### Passo 2: Obter QR Code

**Opção A: Pelo navegador (recomendado)**

1. Abrir navegador em qualquer computador da rede interna
2. Acessar: `http://10.12.40.51:3000`
3. QR Code será exibido automaticamente

**Opção B: Pela linha de comando**

```bash
# Ver QR Code no terminal (ASCII art)
curl http://localhost:3000/api/qr

# Copiar URL do QR Code
# Abrir em navegador para escanear
```

### Passo 3: Escanear com WhatsApp

1. Abrir WhatsApp no celular
2. Menu (⋮) → **Aparelhos Conectados**
3. **Conectar um aparelho**
4. Escanear QR Code exibido
5. Aguardar mensagem "Autenticado com sucesso!"

### Passo 4: Verificar Conexão

```bash
# Verificar status
curl http://localhost:3000/api/status

# Resposta esperada:
# {"authenticated": true, "ready": true}

# Listar conversas
curl http://localhost:3000/api/chats

# Deve retornar array com conversas
```

**IMPORTANTE**: A sessão fica salva em `/opt/hmasp-whatsapp/.wwebjs_auth/`. **NUNCA deletar esse diretório!**

---

## 🔧 Manutenção

### Ver Logs

```bash
# Últimas 50 linhas
sudo journalctl -u hmasp-whatsapp -n 50

# Logs em tempo real
sudo journalctl -u hmasp-whatsapp -f

# Logs de hoje
sudo journalctl -u hmasp-whatsapp --since today

# Logs com erros
sudo journalctl -u hmasp-whatsapp -p err
```

### Reiniciar Serviço

```bash
sudo systemctl restart hmasp-whatsapp
```

### Parar Serviço

```bash
sudo systemctl stop hmasp-whatsapp
```

### Verificar Status

```bash
sudo systemctl status hmasp-whatsapp
```

### Atualizar Código

```bash
# Parar serviço
sudo systemctl stop hmasp-whatsapp

# Fazer backup da sessão WhatsApp (importante!)
sudo cp -r /opt/hmasp-whatsapp/.wwebjs_auth /tmp/backup-wwebjs-auth

# Copiar novo server.js
scp server.js usuario@10.12.40.51:/tmp/
sudo mv /tmp/server.js /opt/hmasp-whatsapp/
sudo chown hmasp-whatsapp:hmasp-whatsapp /opt/hmasp-whatsapp/server.js

# Reiniciar
sudo systemctl start hmasp-whatsapp

# Verificar
sudo systemctl status hmasp-whatsapp
```

---

## 🛠️ Troubleshooting

### Problema: Serviço não inicia

**Verificar logs:**
```bash
sudo journalctl -u hmasp-whatsapp -n 100
```

**Causas comuns:**
- Porta 3000 já em uso
- Permissões incorretas
- Chromium não instalado
- Node.js não instalado

**Solução:**
```bash
# Verificar porta
sudo netstat -tulpn | grep 3000

# Verificar permissões
sudo chown -R hmasp-whatsapp:hmasp-whatsapp /opt/hmasp-whatsapp

# Verificar Chromium
chromium-browser --version

# Verificar Node.js
node --version
```

### Problema: QR Code não aparece

**Verificar se serviço está rodando:**
```bash
curl http://localhost:3000/api/status
```

**Se não responder:**
```bash
sudo systemctl restart hmasp-whatsapp
sudo journalctl -u hmasp-whatsapp -f
```

### Problema: WhatsApp desconecta frequentemente

**Possíveis causas:**
- Celular sem internet
- WhatsApp atualizado no celular
- Sessão expirou

**Solução:**
1. Verificar se celular está online
2. Escanear QR Code novamente
3. Reiniciar serviço

### Problema: "Error: Protocol error (Page.navigate)"

**Causa**: Chromium não consegue abrir página do WhatsApp Web

**Solução:**
```bash
# Reinstalar Chromium
sudo apt-get remove --purge chromium-browser
sudo apt-get install -y chromium-browser

# Deletar cache
sudo rm -rf /opt/hmasp-whatsapp/.wwebjs_cache

# Reiniciar serviço
sudo systemctl restart hmasp-whatsapp
```

### Problema: Alto uso de CPU/RAM

**Verificar recursos:**
```bash
top
htop  # (se instalado)
```

**Se Chromium estiver usando muita RAM:**
- Normal: 300-500 MB
- Alto: > 1GB (pode indicar memory leak)

**Solução:**
```bash
# Reiniciar serviço diariamente (cron job)
sudo crontab -e

# Adicionar linha:
0 3 * * * /bin/systemctl restart hmasp-whatsapp
```

---

## 📊 Monitoramento

### Health Check

```bash
# Verificar se API está respondendo
curl http://localhost:3000/health

# Resposta esperada:
# {"status": "ok", "timestamp": "2025-12-01T12:00:00.000Z"}
```

### Métricas

```bash
# Ver uso de recursos
systemctl status hmasp-whatsapp

# Ver processos Node.js
ps aux | grep node

# Ver uso de disco
df -h /opt/hmasp-whatsapp
```

---

## 🔐 Segurança

### Checklist de Segurança

- [x] Serviço roda com usuário sem privilégios (`hmasp-whatsapp`)
- [x] Firewall configurado (porta 3000 apenas de VM1)
- [x] Arquivo `.env` protegido (chmod 600)
- [x] Systemd com restrições de segurança (`NoNewPrivileges`, `ProtectSystem`)
- [x] Logs centralizados (journalctl)

### Backup da Sessão WhatsApp

**CRÍTICO**: A sessão WhatsApp está em `.wwebjs_auth/`. Fazer backup regularmente!

```bash
# Backup manual
sudo tar -czf /tmp/whatsapp-session-$(date +%Y%m%d).tar.gz \
  -C /opt/hmasp-whatsapp .wwebjs_auth

# Copiar para local seguro
scp /tmp/whatsapp-session-*.tar.gz usuario@servidor-backup:/backups/
```

**Automatizar backup (cron):**
```bash
sudo crontab -e

# Backup diário às 2h
0 2 * * * tar -czf /tmp/whatsapp-session-$(date +\%Y\%m\%d).tar.gz -C /opt/hmasp-whatsapp .wwebjs_auth
```

---

## ✅ Checklist Pós-Instalação

- [ ] Node.js 20.x instalado e funcionando
- [ ] Chromium instalado
- [ ] Aplicação copiada para `/opt/hmasp-whatsapp`
- [ ] Dependências instaladas (`npm install`)
- [ ] Arquivo `.env` criado e protegido
- [ ] Systemd service configurado e habilitado
- [ ] Firewall configurado (porta 3000 apenas de VM1)
- [ ] Serviço iniciado (`systemctl start hmasp-whatsapp`)
- [ ] WhatsApp autenticado (QR Code escaneado)
- [ ] API respondendo (`curl http://localhost:3000/api/status`)
- [ ] Logs sendo gravados (`journalctl -u hmasp-whatsapp`)
- [ ] Backup da sessão configurado

---

## 📞 Suporte

Em caso de dúvidas ou problemas:

1. Consultar [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
2. Verificar logs: `sudo journalctl -u hmasp-whatsapp -n 100`
3. Contatar desenvolvedor: centralderegulacaohmasp@gmail.com

---

**Última atualização**: Dezembro 2025
