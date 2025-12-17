# Instalação na VM do HMASP (Ubuntu)

Guia completo para instalar o HMASP Chat na VM de produção do hospital.

## 📋 Pré-requisitos

- VM Ubuntu (16.04 ou superior)
- Acesso SSH à VM
- Usuário com permissões sudo
- Porta 3000 liberada no firewall

## 🚀 Instalação Passo a Passo

### 1. Conectar na VM

```bash
ssh usuario@IP_DA_VM
```

### 2. Criar Diretório do Projeto

```bash
cd /home/usuario
mkdir -p hmasp-chat
cd hmasp-chat
```

### 3. Transferir Arquivos

**Do seu computador Windows**, use um dos métodos:

#### Opção A: Usando SCP (PowerShell)
```powershell
# Navegar até a pasta do projeto
cd "C:\Users\user\Projetos VS Code\HMASPChat - Marcação de Consultas"

# Transferir arquivos
scp -r * usuario@IP_DA_VM:/home/usuario/hmasp-chat/
```

#### Opção B: Usando WinSCP
1. Baixe e instale o WinSCP
2. Conecte na VM
3. Arraste todos os arquivos do projeto para `/home/usuario/hmasp-chat/`

#### Opção C: Usando Git (se tiver repositório)
```bash
# Na VM
git clone https://github.com/seu-usuario/hmasp-chat.git
cd hmasp-chat
```

### 4. Executar Setup na VM

```bash
# Dar permissão de execução
chmod +x setup-ubuntu.sh

# Executar setup
./setup-ubuntu.sh
```

O script irá instalar:
- Node.js 20.x LTS (versão recomendada, suporte até 2026)
- Dependências do sistema (chromium, build-essential)
- Dependências do Node.js (npm install)
- Criar estrutura de diretórios

### 5. Configurar Variáveis de Ambiente

Edite o arquivo `.env`:

```bash
nano .env
```

Configure as variáveis para o ambiente do HMASP:

```env
# Porta do servidor
PORT=3000

# Ambiente
NODE_ENV=production

# URLs do HMASP
AGHUSE_URL=http://IP_AGHUSE:PORTA

# Banco de dados (se usar PostgreSQL)
DB_USER=postgres
DB_HOST=localhost
DB_NAME=hmasp_chat
DB_PASSWORD=SENHA_SEGURA_AQUI
DB_PORT=5432

# WhatsApp
WHATSAPP_SESSION_PATH=./.wwebjs_auth
```

Salvar: `Ctrl+X`, depois `Y`, depois `Enter`

### 6. Testar Execução

Primeiro, teste em modo normal:

```bash
node server.js
```

Você deve ver:
```
Servidor rodando na porta 3000
Aguardando conexão WhatsApp...
```

Pressione `Ctrl+C` para parar.

### 7. Configurar como Serviço Systemd

Para que o servidor inicie automaticamente e rode em background:

```bash
sudo nano /etc/systemd/system/hmasp-chat.service
```

Cole o conteúdo:

```ini
[Unit]
Description=HMASP Chat - WhatsApp Bot
After=network.target

[Service]
Type=simple
User=usuario
WorkingDirectory=/home/usuario/hmasp-chat
ExecStart=/usr/bin/node /home/usuario/hmasp-chat/server.js
Restart=always
RestartSec=10
StandardOutput=append:/home/usuario/hmasp-chat/logs/output.log
StandardError=append:/home/usuario/hmasp-chat/logs/error.log

Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

**IMPORTANTE**: Substitua `usuario` pelo nome do usuário real da VM!

### 8. Criar Diretório de Logs

```bash
mkdir -p /home/usuario/hmasp-chat/logs
```

### 9. Ativar e Iniciar o Serviço

```bash
# Recarregar configurações do systemd
sudo systemctl daemon-reload

# Ativar para iniciar no boot
sudo systemctl enable hmasp-chat

# Iniciar o serviço
sudo systemctl start hmasp-chat

# Verificar status
sudo systemctl status hmasp-chat
```

Você deve ver: **Active: active (running)**

### 10. Verificar Logs

```bash
# Ver logs em tempo real
sudo journalctl -u hmasp-chat -f

# Ver últimas 50 linhas
sudo journalctl -u hmasp-chat -n 50

# Ver logs do arquivo
tail -f /home/usuario/hmasp-chat/logs/output.log
```

## 🔧 Comandos de Gerenciamento

```bash
# Iniciar serviço
sudo systemctl start hmasp-chat

# Parar serviço
sudo systemctl stop hmasp-chat

# Reiniciar serviço
sudo systemctl restart hmasp-chat

# Ver status
sudo systemctl status hmasp-chat

# Ver logs
sudo journalctl -u hmasp-chat -f

# Desativar inicialização automática
sudo systemctl disable hmasp-chat
```

## 🔒 Configurar Firewall

Se o firewall estiver ativo:

```bash
# Verificar firewall
sudo ufw status

# Liberar porta 3000
sudo ufw allow 3000/tcp

# Recarregar firewall
sudo ufw reload
```

## 🌐 Configurar Nginx como Proxy Reverso (Opcional)

Para usar domínio ou HTTPS:

```bash
# Instalar Nginx
sudo apt install nginx

# Criar configuração
sudo nano /etc/nginx/sites-available/hmasp-chat
```

Cole:

```nginx
server {
    listen 80;
    server_name chat.hmasp.local;  # Ajuste conforme necessário

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Ativar:

```bash
# Criar link simbólico
sudo ln -s /etc/nginx/sites-available/hmasp-chat /etc/nginx/sites-enabled/

# Testar configuração
sudo nginx -t

# Reiniciar Nginx
sudo systemctl restart nginx
```

## 📊 Monitoramento

### Script de Monitoramento

Crie um script `monitor.sh`:

```bash
#!/bin/bash

while true; do
    clear
    echo "========================================="
    echo "  HMASP Chat - Monitor"
    echo "========================================="
    echo ""

    echo "Status do Serviço:"
    systemctl is-active hmasp-chat
    echo ""

    echo "Memória:"
    ps aux | grep "node server.js" | grep -v grep | awk '{print $6/1024 " MB"}'
    echo ""

    echo "CPU:"
    ps aux | grep "node server.js" | grep -v grep | awk '{print $3 "%"}'
    echo ""

    echo "Últimas 5 linhas do log:"
    tail -5 /home/usuario/hmasp-chat/logs/output.log
    echo ""

    echo "Atualizado: $(date)"

    sleep 5
done
```

Executar:
```bash
chmod +x monitor.sh
./monitor.sh
```

## 💾 Backup Automático

Criar script `backup.sh`:

```bash
#!/bin/bash

BACKUP_DIR="/home/usuario/backups/hmasp-chat"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup do banco SQLite
cp server/database/confirmacoes_arquivadas.db $BACKUP_DIR/db_$DATE.db

# Backup da sessão WhatsApp
tar -czf $BACKUP_DIR/session_$DATE.tar.gz .wwebjs_auth/

# Manter apenas últimos 7 backups
find $BACKUP_DIR -name "*.db" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup realizado: $DATE"
```

Agendar com cron:
```bash
crontab -e
```

Adicionar (backup diário às 2h):
```
0 2 * * * /home/usuario/hmasp-chat/backup.sh >> /home/usuario/hmasp-chat/logs/backup.log 2>&1
```

## 🔄 Atualização do Sistema

Quando precisar atualizar o código:

```bash
# Parar serviço
sudo systemctl stop hmasp-chat

# Fazer backup
./backup.sh

# Atualizar código (se usando git)
git pull

# Ou transferir arquivos novos via SCP

# Instalar novas dependências
npm install

# Iniciar serviço
sudo systemctl start hmasp-chat

# Verificar status
sudo systemctl status hmasp-chat
```

## 🐛 Solução de Problemas

### Serviço não inicia

```bash
# Ver erro detalhado
sudo journalctl -u hmasp-chat -n 100

# Verificar permissões
ls -la /home/usuario/hmasp-chat/

# Testar manualmente
cd /home/usuario/hmasp-chat
node server.js
```

### Porta em uso

```bash
# Ver processo usando porta 3000
sudo lsof -i :3000

# Matar processo
sudo kill -9 PID
```

### Erro de permissão

```bash
# Ajustar dono dos arquivos
sudo chown -R usuario:usuario /home/usuario/hmasp-chat

# Ajustar permissões
chmod -R 755 /home/usuario/hmasp-chat
```

### WhatsApp desconecta

```bash
# Limpar sessão
rm -rf .wwebjs_auth/
rm -rf .wwebjs_cache/

# Reiniciar serviço
sudo systemctl restart hmasp-chat

# Escanear QR code novamente
```

## 📞 Checklist de Instalação

- [ ] VM Ubuntu configurada e acessível
- [ ] Arquivos transferidos para a VM
- [ ] Setup executado com sucesso
- [ ] Arquivo .env configurado
- [ ] Teste manual funcionando
- [ ] Serviço systemd criado
- [ ] Serviço iniciado e ativo
- [ ] Firewall configurado
- [ ] Porta 3000 acessível
- [ ] WhatsApp conectado e funcionando
- [ ] Logs sendo gerados corretamente
- [ ] Backup automático configurado
- [ ] Monitoramento configurado

## 🎯 Informações Importantes

- **Diretório de instalação**: `/home/usuario/hmasp-chat`
- **Porta padrão**: `3000`
- **Logs**: `/home/usuario/hmasp-chat/logs/`
- **Banco de dados**: `server/database/confirmacoes_arquivadas.db`
- **Sessão WhatsApp**: `.wwebjs_auth/`
- **Usuário do serviço**: `usuario` (ajustar conforme sua VM)

## 📧 Suporte

Em caso de problemas, verifique:
1. Logs do serviço: `sudo journalctl -u hmasp-chat -f`
2. Logs de saída: `tail -f logs/output.log`
3. Logs de erro: `tail -f logs/error.log`

---

**Documento preparado para instalação em VM Ubuntu do HMASP**
**Versão**: 1.0
**Data**: Dezembro 2025
