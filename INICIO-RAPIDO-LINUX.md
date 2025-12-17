# 🚀 INÍCIO RÁPIDO - HMASP Chat no Linux

## Para sua máquina Linux (teste)

```bash
# 1. Clonar projeto
git clone https://github.com/renatagracinbr-ship-it/HMASP-Chat.git
cd HMASP-Chat

# 2. Instalar tudo automaticamente
bash install-linux.sh

# 3. Editar configurações do banco (IMPORTANTE!)
nano .env
# Ajustar DB_HOST, DB_USER, DB_PASSWORD conforme seu ambiente

# 4. Iniciar
bash start.sh
```

**Pronto!** Acesse: http://localhost:3000

---

## Para VM do HMASP (produção)

### Via transferência de arquivos

```bash
# No seu Windows, criar zip do projeto (sem node_modules!)
# Já está pronto em: hmasp-chat-deploy-CORRETO.zip

# 1. Conectar na VM via SSH
ssh usuario@IP_DA_VM

# 2. Transferir arquivo (de outra janela/terminal)
scp hmasp-chat-deploy-CORRETO.zip usuario@IP_DA_VM:~/

# 3. Na VM, descompactar
cd ~
unzip hmasp-chat-deploy-CORRETO.zip
cd HMASP-Chat

# 4. Executar instalação
bash install-linux.sh

# 5. Editar .env com credenciais do HMASP
nano .env

# 6. Iniciar
bash start.sh
```

### Via Git (se VM tem acesso)

```bash
# 1. Conectar na VM
ssh usuario@IP_DA_VM

# 2. Clonar repositório
git clone https://github.com/renatagracinbr-ship-it/HMASP-Chat.git
cd HMASP-Chat

# 3. Executar instalação
bash install-linux.sh

# 4. Configurar
nano .env

# 5. Iniciar
bash start.sh
```

---

## Interfaces Disponíveis

Após iniciar, acesse:

- 🏥 **Interface Principal:** http://IP_DA_VM:3000/
- 📱 **WhatsApp QR Code:** http://IP_DA_VM:3000/whatsapp-admin.html
- ⚙️ **Admin (envio auto):** http://IP_DA_VM:3000/admin.html

---

## Para rodar em produção (PM2)

```bash
# Instalar PM2
sudo npm install -g pm2

# Iniciar com PM2
pm2 start server.js --name hmasp-chat

# Auto-start ao reiniciar servidor
pm2 startup systemd
# COPIAR E EXECUTAR O COMANDO QUE APARECER

pm2 save

# Ver status
pm2 status

# Ver logs
pm2 logs hmasp-chat
```

---

## Comandos Úteis

```bash
# Ver logs
tail -f logs/app.log

# Parar servidor (se rodando manualmente)
Ctrl+C

# Reiniciar com PM2
pm2 restart hmasp-chat

# Ver status
pm2 status

# Verificar porta
sudo netstat -tulpn | grep :3000
```

---

## Troubleshooting Rápido

### WhatsApp não conecta

```bash
rm -rf .wwebjs_auth/
pm2 restart hmasp-chat
# Acesse whatsapp-admin.html e escaneie QR Code novamente
```

### Erro de banco de dados

```bash
# Verificar se consegue conectar no banco
ping 10.12.40.219
telnet 10.12.40.219 5432

# Verificar credenciais no .env
cat .env | grep DB_
```

### Porta 3000 ocupada

```bash
sudo lsof -i :3000
sudo kill -9 <PID>
```

---

**Dúvidas?** Veja documentação completa em [DEPLOY-LINUX.md](DEPLOY-LINUX.md)
