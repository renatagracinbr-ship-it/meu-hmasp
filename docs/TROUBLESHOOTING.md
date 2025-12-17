# 🔧 Troubleshooting - HMASP Chat

Guia rápido para resolução de problemas comuns.

---

## 📋 Problemas Comuns

### 1. WhatsApp Desconectado

**Sintoma**: "WhatsApp não está conectado" no frontend

**Verificar**:
```bash
# Na VM2 (WhatsApp)
curl http://localhost:3000/api/status

# Resposta esperada:
{"authenticated": true, "ready": true}
```

**Soluções**:

**A) Serviço parado**
```bash
sudo systemctl status hmasp-whatsapp
sudo systemctl start hmasp-whatsapp
```

**B) Sessão expirou (precisa escanear QR Code novamente)**
```bash
# Acessar no navegador
http://10.12.40.51:3000

# Escanear QR Code com WhatsApp do celular
# Menu > Aparelhos Conectados > Conectar um aparelho
```

**C) Chromium travado**
```bash
# Matar processos do Chromium
sudo pkill -f chromium

# Reiniciar serviço
sudo systemctl restart hmasp-whatsapp
```

---

### 2. Erro ao Enviar Mensagem

**Sintoma**: "Erro ao enviar mensagem" ou timeout

**Verificar**:
```bash
# Ver logs
sudo journalctl -u hmasp-whatsapp -n 50

# Procurar por erros
```

**Causas comuns**:

**A) Número inválido**
- Verificar se número está no formato E.164: `+5511999999999`
- Verificar se tem WhatsApp ativo

**B) WhatsApp Web desconectou**
- Seguir solução do problema 1

**C) Rate limit do WhatsApp**
- WhatsApp limita envios (anti-spam)
- Aguardar alguns minutos
- Enviar em lotes menores

---

### 3. Banco de Dados Inacessível

**Sintoma**: "Error connecting to database" ou timeout

**Verificar conectividade**:
```bash
# Da VM2 ou VM3
psql -h 10.12.40.60 -U hmasp_app -d hmasp_chat_producao -c "SELECT NOW();"
```

**Soluções**:

**A) PostgreSQL parado**
```bash
# No servidor BD (10.12.40.60)
sudo systemctl status postgresql
sudo systemctl start postgresql
```

**B) Firewall bloqueando**
```bash
# No servidor BD
sudo ufw status | grep 5432

# Permitir VMs
sudo ufw allow from 10.12.40.51 to any port 5432
sudo ufw allow from 10.12.40.52 to any port 5432
```

**C) Credenciais incorretas**
```bash
# Resetar senha do usuário
sudo -u postgres psql -c "ALTER USER hmasp_app PASSWORD 'NovaSenha123!';"

# Atualizar .env nas VMs
sudo nano /opt/hmasp-whatsapp/.env
# POSTGRES_PASSWORD=NovaSenha123!
```

**D) pg_hba.conf não permite conexão**
```bash
# No servidor BD
sudo nano /etc/postgresql/15/main/pg_hba.conf

# Adicionar/verificar:
host    hmasp_chat_producao    hmasp_app    10.12.40.51/32    md5
host    hmasp_chat_producao    hmasp_app    10.12.40.52/32    md5

# Reiniciar
sudo systemctl restart postgresql
```

---

### 4. Frontend Não Carrega

**Sintoma**: Página em branco ou erro 502/504

**Verificar**:
```bash
# Na VM1
sudo systemctl status nginx
curl http://localhost
```

**Soluções**:

**A) Nginx parado**
```bash
sudo systemctl start nginx
```

**B) Arquivos não existem**
```bash
ls -la /var/www/hmasp-chat/
# Deve ter: index.html, assets/, etc

# Se vazio, fazer deploy novamente
```

**C) Nginx configuração incorreta**
```bash
# Testar configuração
sudo nginx -t

# Ver logs de erro
sudo tail -f /var/log/nginx/error.log
```

**D) Frontend não consegue conectar nos backends**
- Abrir console do navegador (F12)
- Ver erros de rede
- Verificar se backends estão rodando:
```bash
curl http://10.12.40.51:3000/api/status  # WhatsApp
curl http://10.12.40.52:3001/api/health  # AGHUse
```

---

### 5. AGHUse Não Responde

**Sintoma**: "Erro ao buscar consultas" na aba Confirmação de Presença

**Verificar**:
```bash
# Na VM3
sudo systemctl status hmasp-aghuse
curl http://localhost:3001/api/health
```

**Soluções**:

**A) Serviço parado**
```bash
sudo systemctl start hmasp-aghuse
```

**B) Não consegue conectar no banco AGHUse**
```bash
# Testar conexão
psql -h 10.12.40.219 -U birm_read -d dbaghu -c "SELECT NOW();"

# Se falhar:
# - Verificar se está na VPN/intranet
# - Verificar credenciais
# - Verificar firewall do AGHUse
```

**C) Query SQL incorreta**
```bash
# Ver logs
sudo journalctl -u hmasp-aghuse -n 100
```

---

### 6. Usuário Não Consegue Fazer Login

**Sintoma**: "Credenciais inválidas" ou "Usuário não autorizado"

**Verificar**:
```bash
# No servidor BD
sudo -u postgres psql -d hmasp_chat_producao -c "SELECT uid, email, role, ativo FROM usuarios WHERE email = 'usuario@exemplo.com';"
```

**Soluções**:

**A) Usuário não existe**
```sql
-- Criar usuário
INSERT INTO usuarios (uid, email, display_name, role, ativo)
VALUES (uuid_generate_v4(), 'usuario@exemplo.com', 'Nome do Usuário', 'user', true);
```

**B) Usuário não ativo**
```sql
-- Ativar usuário
UPDATE usuarios SET ativo = true WHERE email = 'usuario@exemplo.com';
```

**C) Role incorreto (pending)**
```sql
-- Promover para user ou admin
UPDATE usuarios SET role = 'user' WHERE email = 'usuario@exemplo.com';
```

**D) Senha incorreta (se usando JWT)**
```bash
# Resetar senha
# Ver backend de autenticação para procedimento específico
```

---

### 7. Alto Uso de CPU/Memória

**Verificar recursos**:
```bash
# Ver processos
top
htop

# Ver uso de cada serviço
systemctl status hmasp-whatsapp
systemctl status hmasp-aghuse
```

**Soluções**:

**A) Chromium usando muita RAM (normal até 500MB)**
```bash
# Se > 1GB, reiniciar serviço
sudo systemctl restart hmasp-whatsapp
```

**B) PostgreSQL usando muita RAM**
```bash
# Verificar queries lentas
sudo -u postgres psql -c "
SELECT pid, now() - query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active' AND now() - query_start > interval '5 seconds';
"

# Matar query travada (substituir PID)
sudo -u postgres psql -c "SELECT pg_terminate_backend(12345);"
```

**C) Node.js com memory leak**
```bash
# Reiniciar serviço
sudo systemctl restart hmasp-whatsapp
sudo systemctl restart hmasp-aghuse

# Agendar reinício diário (workaround)
sudo crontab -e
# 0 3 * * * /bin/systemctl restart hmasp-whatsapp
```

---

### 8. Backup Não Está Rodando

**Verificar cron jobs**:
```bash
# No servidor BD
sudo crontab -l | grep backup

# Ver última execução
ls -lht /var/backups/postgresql/ | head

# Ver logs
tail -f /var/log/backup-hmasp-db.log
```

**Soluções**:

**A) Cron não configurado**
```bash
sudo crontab -e
# 0 2 * * * /usr/local/bin/backup-hmasp-db.sh >> /var/log/backup-hmasp-db.log 2>&1
```

**B) Script com erro**
```bash
# Executar manualmente
sudo /usr/local/bin/backup-hmasp-db.sh

# Ver erro e corrigir
```

**C) Disco cheio**
```bash
df -h /var/backups

# Deletar backups antigos manualmente
find /var/backups/postgresql -name "*.sql.gz" -mtime +30 -delete
```

---

### 9. Mensagens Não Estão Sendo Enviadas Automaticamente

**Sintoma**: Cron jobs não executam

**Verificar**:
```bash
# Na VM1
sudo crontab -l | grep hmasp

# Ver logs do cron
grep CRON /var/log/syslog | tail -20
```

**Soluções**:

**A) Cron não configurado**
```bash
sudo crontab -e
# Adicionar jobs conforme PLANO-MIGRACAO.md
```

**B) Script com erro**
```bash
# Executar manualmente
/usr/bin/node /opt/hmasp-chat-cron/envio-confirmacoes.js

# Ver erro
```

**C) Consultas não estão sendo detectadas**
- Verificar se AGHUse API está respondendo
- Verificar queries SQL
- Verificar dados de teste no AGHUse

---

### 10. Logs de Auditoria Não Aparecem

**Verificar**:
```bash
# No servidor BD
sudo -u postgres psql -d hmasp_chat_producao -c "SELECT COUNT(*) FROM audit_logs;"
```

**Soluções**:

**A) Tabela vazia (logs não estão sendo gravados)**
```bash
# Verificar se backend está gravando
# Ver código em src/services/auditService.js

# Testar inserção manual
sudo -u postgres psql -d hmasp_chat_producao <<SQL
INSERT INTO audit_logs (user_id, action, resource, details)
VALUES ('teste', 'test', 'system', '{"teste": true}');
SQL
```

**B) Frontend não está enviando logs**
- Verificar console do navegador (F12)
- Ver se há erros na chamada do auditService

---

## 🔍 Comandos Úteis de Diagnóstico

### Ver Status de Todos os Serviços

```bash
# VM1 - Frontend
ssh usuario@10.12.40.50
sudo systemctl status nginx

# VM2 - WhatsApp
ssh usuario@10.12.40.51
sudo systemctl status hmasp-whatsapp
curl http://localhost:3000/api/status

# VM3 - AGHUse
ssh usuario@10.12.40.52
sudo systemctl status hmasp-aghuse
curl http://localhost:3001/api/health

# Servidor BD
ssh usuario@10.12.40.60
sudo systemctl status postgresql
sudo -u postgres psql -c "SELECT version();"
```

### Ver Logs em Tempo Real

```bash
# WhatsApp
sudo journalctl -u hmasp-whatsapp -f

# AGHUse
sudo journalctl -u hmasp-aghuse -f

# Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-15-main.log
```

### Verificar Conectividade de Rede

```bash
# De qualquer VM, testar conexão com outras
ping 10.12.40.50  # Frontend
ping 10.12.40.51  # WhatsApp
ping 10.12.40.52  # AGHUse
ping 10.12.40.60  # BD

# Testar porta específica
telnet 10.12.40.60 5432  # PostgreSQL
telnet 10.12.40.51 3000  # WhatsApp API
telnet 10.12.40.52 3001  # AGHUse API
```

### Verificar Uso de Recursos

```bash
# CPU e RAM
top
htop  # (se instalado)

# Disco
df -h

# Rede
sudo netstat -tulpn | grep LISTEN
```

---

## 📞 Suporte

Se o problema persistir:

1. **Coletar informações**:
   - Logs relevantes
   - Mensagem de erro exata
   - Passos para reproduzir

2. **Consultar documentação**:
   - [INFRAESTRUTURA-HMASP.md](INFRAESTRUTURA-HMASP.md)
   - [PLANO-MIGRACAO.md](PLANO-MIGRACAO.md)

3. **Contatar desenvolvedor**:
   - Email: centralderegulacaohmasp@gmail.com
   - Fornecer logs e detalhes do problema

---

**Última atualização**: Dezembro 2025
