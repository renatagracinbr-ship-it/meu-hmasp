# 🗄️ Instalação PostgreSQL - Banco de Dados HMASP Chat

Guia completo para instalar e configurar o servidor PostgreSQL.

---

## 📋 Pré-requisitos

- Servidor Ubuntu 22.04 LTS (pode ser VM ou servidor físico)
- IP fixo: `10.12.40.60` (exemplo)
- 4 vCPU, 4GB RAM, 100GB disco
- Acesso SSH como root ou sudo

---

## 🚀 Instalação

### Passo 1: Atualizar Sistema

```bash
sudo apt-get update
sudo apt-get upgrade -y
```

### Passo 2: Instalar PostgreSQL 15

```bash
# Instalar PostgreSQL
sudo apt-get install -y postgresql-15 postgresql-contrib-15

# Verificar instalação
sudo systemctl status postgresql

# Verificar versão
sudo -u postgres psql --version
```

### Passo 3: Configurar Acesso Remoto

Por padrão, PostgreSQL só aceita conexões locais. Vamos permitir conexões das VMs.

```bash
# Editar postgresql.conf
sudo nano /etc/postgresql/15/main/postgresql.conf
```

**Encontrar e alterar:**
```conf
# ANTES:
#listen_addresses = 'localhost'

# DEPOIS:
listen_addresses = '*'

# Otimizações de performance (ajustar conforme hardware)
shared_buffers = 1GB                    # 25% da RAM
effective_cache_size = 3GB              # 75% da RAM
maintenance_work_mem = 256MB
work_mem = 16MB
max_connections = 100
```

Salvar e fechar (Ctrl+O, Enter, Ctrl+X).

### Passo 4: Configurar Autenticação

```bash
# Editar pg_hba.conf
sudo nano /etc/postgresql/15/main/pg_hba.conf
```

**Adicionar no final do arquivo:**
```conf
# Conexões das VMs do HMASP Chat
host    hmasp_chat_producao    hmasp_app    10.12.40.51/32    md5    # VM WhatsApp
host    hmasp_chat_producao    hmasp_app    10.12.40.52/32    md5    # VM AGHUse
host    hmasp_chat_producao    postgres     10.12.40.0/24     md5    # Admin rede interna
```

Salvar e fechar.

### Passo 5: Reiniciar PostgreSQL

```bash
sudo systemctl restart postgresql
sudo systemctl status postgresql
```

### Passo 6: Criar Usuário e Database

```bash
# Entrar como usuário postgres
sudo -u postgres psql

# No prompt do PostgreSQL:
```

```sql
-- Criar database
CREATE DATABASE hmasp_chat_producao
  WITH ENCODING='UTF8'
       LC_COLLATE='pt_BR.UTF-8'
       LC_CTYPE='pt_BR.UTF-8'
       TEMPLATE=template0;

-- Criar usuário da aplicação
CREATE USER hmasp_app WITH PASSWORD 'SuaSenhaSegura123!';

-- Conceder permissões
GRANT ALL PRIVILEGES ON DATABASE hmasp_chat_producao TO hmasp_app;

-- Conectar no database
\c hmasp_chat_producao

-- Dar permissões no schema public
GRANT ALL ON SCHEMA public TO hmasp_app;
GRANT ALL ON ALL TABLES IN SCHEMA public TO hmasp_app;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO hmasp_app;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO hmasp_app;

-- Configurar permissões padrão para objetos futuros
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO hmasp_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO hmasp_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO hmasp_app;

-- Sair
\q
```

---

## 📊 Criar Estrutura do Banco

### Passo 7: Importar Schema

**Copiar arquivo schema.sql para o servidor:**

```bash
# Na sua máquina local
scp database/schema.sql usuario@10.12.40.60:/tmp/

# No servidor PostgreSQL
sudo -u postgres psql -d hmasp_chat_producao -f /tmp/schema.sql
```

**Ou criar manualmente:**

```bash
sudo -u postgres psql -d hmasp_chat_producao
```

```sql
-- Tabela de usuários
CREATE TABLE usuarios (
    uid VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    photo_url TEXT,
    role VARCHAR(20) CHECK (role IN ('admin', 'user', 'pending')) DEFAULT 'pending',
    ativo BOOLEAN DEFAULT false,
    data_criacao TIMESTAMP DEFAULT NOW(),
    ultimo_acesso TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabela de pacientes
CREATE TABLE pacientes (
    cpf VARCHAR(11) PRIMARY KEY,
    nome_completo VARCHAR(255) NOT NULL,
    primeiro_nome VARCHAR(100),
    ultimo_nome VARCHAR(100),
    prontuario VARCHAR(50),
    data_criacao TIMESTAMP DEFAULT NOW(),
    ultima_atualizacao TIMESTAMP DEFAULT NOW()
);

-- Telefones dos pacientes
CREATE TABLE pacientes_telefones (
    id SERIAL PRIMARY KEY,
    cpf VARCHAR(11) REFERENCES pacientes(cpf) ON DELETE CASCADE,
    tipo VARCHAR(50),
    numero VARCHAR(20),
    normalized VARCHAR(20),
    phone_type VARCHAR(20) CHECK (phone_type IN ('mobile', 'landline')),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(cpf, numero)
);

-- Agenda de contatos
CREATE TABLE agenda_contatos (
    cpf VARCHAR(11) PRIMARY KEY REFERENCES pacientes(cpf) ON DELETE CASCADE,
    observacoes TEXT,
    ultima_atualizacao TIMESTAMP DEFAULT NOW()
);

-- Logs de auditoria (LGPD)
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT NOW(),
    user_id VARCHAR(255),
    user_email VARCHAR(255),
    action VARCHAR(50),
    resource VARCHAR(50),
    resource_id VARCHAR(255),
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT
);

-- Templates de mensagens
CREATE TABLE templates (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL,
    tipo VARCHAR(50) CHECK (tipo IN ('confirmacao', 'lembrete', 'cancelamento', 'falta')),
    mensagem TEXT NOT NULL,
    variaveis TEXT[],
    ativo BOOLEAN DEFAULT true,
    data_criacao TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Configurações do sistema
CREATE TABLE configuracoes (
    chave VARCHAR(100) PRIMARY KEY,
    valor JSONB,
    descricao TEXT,
    ultima_atualizacao TIMESTAMP DEFAULT NOW()
);

-- Logs de monitoramento
CREATE TABLE monitoramento_logs (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT NOW(),
    tipo VARCHAR(50) CHECK (tipo IN ('envio', 'recebimento', 'erro', 'sistema')),
    mensagem TEXT,
    dados JSONB,
    severidade VARCHAR(20) CHECK (severidade IN ('info', 'warning', 'error'))
);

-- Conversas (cache local)
CREATE TABLE conversas (
    id VARCHAR(255) PRIMARY KEY,
    nome VARCHAR(255),
    telefone VARCHAR(50),
    is_group BOOLEAN DEFAULT false,
    ultima_mensagem TEXT,
    ultima_mensagem_timestamp TIMESTAMP,
    nao_lidas INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Mensagens (cache local - LGPD: reter apenas 30 dias)
CREATE TABLE mensagens (
    id VARCHAR(255) PRIMARY KEY,
    conversa_id VARCHAR(255) REFERENCES conversas(id) ON DELETE CASCADE,
    texto TEXT,
    enviado_por VARCHAR(50) CHECK (enviado_por IN ('usuario', 'paciente')),
    timestamp TIMESTAMP DEFAULT NOW(),
    status VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_pacientes_nome ON pacientes(nome_completo);
CREATE INDEX idx_pacientes_prontuario ON pacientes(prontuario);
CREATE INDEX idx_telefones_normalized ON pacientes_telefones(normalized);
CREATE INDEX idx_telefones_cpf ON pacientes_telefones(cpf);
CREATE INDEX idx_conversas_timestamp ON conversas(ultima_mensagem_timestamp DESC);
CREATE INDEX idx_mensagens_conversa ON mensagens(conversa_id, timestamp DESC);
CREATE INDEX idx_mensagens_timestamp ON mensagens(timestamp DESC);
CREATE INDEX idx_monitoramento_timestamp ON monitoramento_logs(timestamp DESC);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar updated_at
CREATE TRIGGER update_usuarios_updated_at BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversas_updated_at BEFORE UPDATE ON conversas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Inserir usuário admin inicial
INSERT INTO usuarios (uid, email, display_name, role, ativo)
VALUES ('admin-inicial', 'centralderegulacaohmasp@gmail.com', 'Administrador', 'admin', true)
ON CONFLICT (uid) DO NOTHING;

-- Inserir configurações padrão
INSERT INTO configuracoes (chave, valor, descricao) VALUES
('data_retention_days', '30', 'Dias de retenção de mensagens (LGPD)'),
('enable_audit', 'true', 'Habilitar logs de auditoria'),
('envio_automatico', 'true', 'Habilitar envio automático de confirmações'),
('intervalo_confirmacao', '60', 'Minutos após agendamento para enviar confirmação')
ON CONFLICT (chave) DO NOTHING;

-- Template padrão de confirmação
INSERT INTO templates (nome, tipo, mensagem, variaveis) VALUES
('Confirmação de Consulta', 'confirmacao',
'Olá, {{nome}}! Sua consulta foi agendada para {{data}} às {{hora}} com {{profissional}}. Confirma presença? Digite 1 para SIM ou 2 para NÃO.',
ARRAY['nome', 'data', 'hora', 'profissional'])
ON CONFLICT DO NOTHING;

\q
```

### Passo 8: Verificar Estrutura

```bash
# Conectar e listar tabelas
sudo -u postgres psql -d hmasp_chat_producao -c "\dt"

# Verificar índices
sudo -u postgres psql -d hmasp_chat_producao -c "\di"

# Ver usuários
sudo -u postgres psql -d hmasp_chat_producao -c "SELECT * FROM usuarios;"
```

---

## 🔒 Configurar Firewall

```bash
# Instalar UFW
sudo apt-get install -y ufw

# Permitir SSH
sudo ufw allow from 10.12.40.0/24 to any port 22

# Permitir PostgreSQL apenas das VMs
sudo ufw allow from 10.12.40.51 to any port 5432  # VM WhatsApp
sudo ufw allow from 10.12.40.52 to any port 5432  # VM AGHUse

# Ativar firewall
sudo ufw enable

# Verificar
sudo ufw status verbose
```

---

## 🧪 Testar Conexão

### Da VM WhatsApp (10.12.40.51)

```bash
# Instalar cliente PostgreSQL
sudo apt-get install -y postgresql-client

# Testar conexão
psql -h 10.12.40.60 -U hmasp_app -d hmasp_chat_producao -c "SELECT NOW();"

# Senha: SuaSenhaSegura123!

# Se funcionar, conexão OK!
```

### Da VM AGHUse (10.12.40.52)

```bash
# Mesmo teste
psql -h 10.12.40.60 -U hmasp_app -d hmasp_chat_producao -c "SELECT version();"
```

---

## 💾 Configurar Backup Automático

### Script de Backup

```bash
# Criar diretório de backups
sudo mkdir -p /var/backups/postgresql

# Criar script de backup
sudo tee /usr/local/bin/backup-hmasp-db.sh > /dev/null <<'EOF'
#!/bin/bash
BACKUP_DIR="/var/backups/postgresql"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DATABASE="hmasp_chat_producao"
BACKUP_FILE="$BACKUP_DIR/hmasp_chat_$TIMESTAMP.sql.gz"

# Fazer backup compactado
sudo -u postgres pg_dump $DATABASE | gzip > $BACKUP_FILE

# Deletar backups com mais de 30 dias
find $BACKUP_DIR -name "hmasp_chat_*.sql.gz" -mtime +30 -delete

echo "Backup concluído: $BACKUP_FILE"
EOF

# Tornar executável
sudo chmod +x /usr/local/bin/backup-hmasp-db.sh

# Testar
sudo /usr/local/bin/backup-hmasp-db.sh
```

### Agendar Backup Diário

```bash
# Editar crontab do root
sudo crontab -e

# Adicionar linha (backup diário às 2h da manhã)
0 2 * * * /usr/local/bin/backup-hmasp-db.sh >> /var/log/backup-hmasp-db.log 2>&1
```

### Verificar Backups

```bash
ls -lh /var/backups/postgresql/
```

---

## 🗑️ Limpeza Automática (LGPD)

### Script de Limpeza de Mensagens Antigas

```bash
sudo tee /usr/local/bin/cleanup-old-messages.sh > /dev/null <<'EOF'
#!/bin/bash
# Remove mensagens com mais de 30 dias (LGPD)

sudo -u postgres psql -d hmasp_chat_producao <<SQL
DELETE FROM mensagens WHERE timestamp < NOW() - INTERVAL '30 days';
DELETE FROM audit_logs WHERE timestamp < NOW() - INTERVAL '365 days';
VACUUM ANALYZE mensagens;
VACUUM ANALYZE audit_logs;
SQL

echo "Limpeza concluída: $(date)"
EOF

sudo chmod +x /usr/local/bin/cleanup-old-messages.sh
```

### Agendar Limpeza Mensal

```bash
sudo crontab -e

# Adicionar (executa todo dia 1 às 3h)
0 3 1 * * /usr/local/bin/cleanup-old-messages.sh >> /var/log/cleanup-messages.log 2>&1
```

---

## 📊 Monitoramento

### Ver Conexões Ativas

```bash
sudo -u postgres psql -c "SELECT * FROM pg_stat_activity WHERE datname = 'hmasp_chat_producao';"
```

### Ver Tamanho do Banco

```bash
sudo -u postgres psql -c "SELECT pg_size_pretty(pg_database_size('hmasp_chat_producao'));"
```

### Ver Tamanho das Tabelas

```bash
sudo -u postgres psql -d hmasp_chat_producao -c "
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"
```

### Ver Queries Lentas

```bash
sudo -u postgres psql -c "
SELECT pid, now() - pg_stat_activity.query_start AS duration, query
FROM pg_stat_activity
WHERE state = 'active' AND now() - pg_stat_activity.query_start > interval '5 seconds';
"
```

---

## 🔧 Manutenção

### VACUUM e ANALYZE

```bash
# Executar mensalmente
sudo -u postgres vacuumdb --all --analyze --verbose
```

### Reindexar (se performance degradar)

```bash
sudo -u postgres reindexdb -d hmasp_chat_producao
```

### Verificar Integridade

```bash
sudo -u postgres pg_dump -d hmasp_chat_producao -f /tmp/test_backup.sql
# Se não der erro, banco está íntegro
rm /tmp/test_backup.sql
```

---

## 🛠️ Troubleshooting

### Problema: Não consegue conectar remotamente

**Verificar:**

```bash
# PostgreSQL está rodando?
sudo systemctl status postgresql

# Porta 5432 está aberta?
sudo netstat -tulpn | grep 5432

# Firewall permite?
sudo ufw status | grep 5432

# pg_hba.conf está correto?
sudo cat /etc/postgresql/15/main/pg_hba.conf | grep hmasp

# postgresql.conf escuta em todas as interfaces?
sudo grep listen_addresses /etc/postgresql/15/main/postgresql.conf
```

**Testar conexão localmente:**

```bash
psql -h localhost -U hmasp_app -d hmasp_chat_producao
```

### Problema: Senha incorreta

```bash
# Resetar senha
sudo -u postgres psql -c "ALTER USER hmasp_app PASSWORD 'NovaSenha123!';"
```

### Problema: Permissões negadas

```bash
# Verificar permissões
sudo -u postgres psql -d hmasp_chat_producao -c "\du hmasp_app"

# Conceder permissões novamente
sudo -u postgres psql -d hmasp_chat_producao <<SQL
GRANT ALL PRIVILEGES ON DATABASE hmasp_chat_producao TO hmasp_app;
GRANT ALL ON ALL TABLES IN SCHEMA public TO hmasp_app;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO hmasp_app;
SQL
```

---

## ✅ Checklist Pós-Instalação

- [ ] PostgreSQL 15 instalado
- [ ] Database `hmasp_chat_producao` criado
- [ ] Usuário `hmasp_app` criado com senha
- [ ] Schema (tabelas, índices) criado
- [ ] Acesso remoto configurado (`listen_addresses = '*'`)
- [ ] pg_hba.conf configurado (VMs autorizadas)
- [ ] Firewall configurado (porta 5432 apenas VMs)
- [ ] Conexão testada das VMs
- [ ] Backup automático configurado (cron)
- [ ] Limpeza LGPD configurada (cron)
- [ ] Monitoramento básico funcionando

---

## 📞 Suporte

Ver também:
- [MANUTENCAO-BACKUP.md](MANUTENCAO-BACKUP.md)
- [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

---

**Última atualização**: Dezembro 2025
