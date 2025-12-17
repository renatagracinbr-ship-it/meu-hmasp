# 📝 Comandos Essenciais - HMASP Chat

Referência rápida dos comandos mais usados.

---

## 🚀 Instalação e Início

```bash
# Instalação completa automática
bash install-linux.sh

# Editar configurações
nano .env

# Iniciar servidor
bash start.sh
```

---

## 🔄 PM2 (Produção)

```bash
# Instalar PM2
sudo npm install -g pm2

# Iniciar
pm2 start server.js --name hmasp-chat

# Parar
pm2 stop hmasp-chat

# Reiniciar
pm2 restart hmasp-chat

# Remover
pm2 delete hmasp-chat

# Ver status
pm2 status

# Ver logs em tempo real
pm2 logs hmasp-chat

# Monitorar recursos
pm2 monit

# Auto-start ao reiniciar servidor
pm2 startup systemd
# COPIAR E EXECUTAR O COMANDO QUE APARECER
pm2 save
```

---

## 📊 Logs

```bash
# Ver logs da aplicação
tail -f logs/app.log

# Ver últimas 100 linhas
tail -n 100 logs/app.log

# Buscar erro específico
grep "ERROR" logs/app.log

# Com PM2
pm2 logs hmasp-chat

# Com systemd
sudo journalctl -u hmasp-whatsapp -f
```

---

## 🔍 Diagnóstico

```bash
# Verificar se servidor está rodando
curl http://localhost:3000/api/status

# Verificar porta
sudo netstat -tulpn | grep :3000
# OU
sudo lsof -i :3000

# Verificar processos Node
ps aux | grep node

# Testar conexão com banco
ping 10.12.40.219
telnet 10.12.40.219 5432

# Ver variáveis de ambiente
cat .env
```

---

## 🛑 Parar/Matar Processos

```bash
# Parar servidor manual (Ctrl+C ou)
pkill -f "node server.js"

# Matar processo específico
sudo kill -9 <PID>

# Parar PM2
pm2 stop hmasp-chat
```

---

## 🔥 Firewall

```bash
# Ubuntu/Debian (UFW)
sudo ufw allow 3000/tcp
sudo ufw enable
sudo ufw status

# CentOS/RHEL (firewalld)
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

---

## 🔄 Atualização

```bash
# 1. Fazer backup
cp -r server/data server/data.backup
cp .env .env.backup

# 2. Parar servidor
pm2 stop hmasp-chat

# 3. Atualizar código
git pull origin main

# 4. Instalar dependências (se houver)
npm install

# 5. Rebuild frontend
npm run build

# 6. Reiniciar
pm2 start hmasp-chat
```

---

## 📱 WhatsApp

```bash
# Limpar sessão do WhatsApp
rm -rf .wwebjs_auth/
rm -rf .wwebjs_cache/

# Reiniciar servidor para gerar novo QR
pm2 restart hmasp-chat

# Acessar admin para ver QR
# http://SERVIDOR:3000/whatsapp-admin.html
```

---

## 🗄️ Backup

```bash
# Backup manual
tar -czf backup-hmasp-$(date +%Y%m%d).tar.gz \
    server/data/ \
    .env \
    .wwebjs_auth/

# Restaurar backup
tar -xzf backup-hmasp-YYYYMMDD.tar.gz
```

---

## 🧹 Limpeza

```bash
# Limpar node_modules
rm -rf node_modules/
npm install

# Limpar build anterior
rm -rf dist/
npm run build

# Limpar logs antigos (mais de 30 dias)
find logs/ -name "*.log" -mtime +30 -delete

# Limpar cache do Puppeteer
rm -rf .wwebjs_cache/
```

---

## 🔐 Segurança

```bash
# Alterar permissões do .env
chmod 600 .env

# Alterar permissões das pastas
chmod -R 755 server/
chmod -R 755 logs/

# Verificar configuração de auto-login
cat server/data/auto-login.json
```

---

## 📈 Monitoramento de Recursos

```bash
# CPU e Memória
htop

# Espaço em disco
df -h

# Uso de disco por pasta
du -sh *

# Memória disponível
free -h

# Ver conexões de rede
sudo netstat -an | grep :3000
```

---

## 🆘 Emergência

### Servidor não responde

```bash
pm2 restart hmasp-chat
# Se não resolver:
pm2 delete hmasp-chat
pm2 start server.js --name hmasp-chat
```

### Erro de porta ocupada

```bash
sudo lsof -i :3000
sudo kill -9 <PID>
pm2 start hmasp-chat
```

### WhatsApp desconectou

```bash
# Acessar: http://SERVIDOR:3000/whatsapp-admin.html
# Escanear QR Code novamente
```

### Banco de dados não conecta

```bash
# Verificar conectividade
ping 10.12.40.219
telnet 10.12.40.219 5432

# Verificar .env
cat .env | grep DB_

# Reiniciar servidor
pm2 restart hmasp-chat
```

### Logs ocupando muito espaço

```bash
# Ver tamanho
du -sh logs/

# Limpar logs antigos
find logs/ -name "*.log" -mtime +7 -delete

# Limpar PM2 logs
pm2 flush
```

---

## 🔗 URLs Importantes

```bash
# Interface Principal
http://SERVIDOR:3000/

# WhatsApp Admin (QR Code)
http://SERVIDOR:3000/whatsapp-admin.html

# Interface Admin (Envio Automático)
http://SERVIDOR:3000/admin.html

# Status da API
http://SERVIDOR:3000/api/status
```

---

## 📚 Documentação

- [README.md](README.md) - Visão geral do projeto
- [INICIO-RAPIDO-LINUX.md](INICIO-RAPIDO-LINUX.md) - Guia início rápido
- [DEPLOY-LINUX.md](DEPLOY-LINUX.md) - Guia completo de deploy
- [CHECKLIST-PRE-DEPLOY.md](CHECKLIST-PRE-DEPLOY.md) - Checklist antes de produção

---

**Desenvolvido para HMASP São Paulo**
