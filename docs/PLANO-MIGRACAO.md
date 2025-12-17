# 📋 Plano de Migração - Nuvem → HMASP

Plano completo para migrar o HMASP Chat da infraestrutura cloud para os servidores internos do hospital.

---

## 🎯 Objetivo

Migrar 100% do sistema da nuvem (Google Cloud + Firebase) para a infraestrutura interna do HMASP.

**Motivação:**
- ✅ Controle total sobre dados sensíveis (LGPD)
- ✅ Performance superior (rede interna)
- ✅ Sem dependência de terceiros
- ✅ Integração direta com AGHUse
- ✅ Segurança (não exposto à internet)

---

## 📊 Estado Atual vs Futuro

| Componente | Atual (Nuvem) | Futuro (HMASP) |
|------------|---------------|----------------|
| **Frontend** | Firebase Hosting | Nginx em VM1 (10.12.40.50) |
| **Backend WhatsApp** | Google Compute Engine | Node.js em VM2 (10.12.40.51) |
| **Backend AGHUse** | Electron app desktop | Node.js em VM3 (10.12.40.52) |
| **Banco de Dados** | Firebase Firestore (NoSQL) | PostgreSQL (10.12.40.60) |
| **Autenticação** | Firebase Auth (Google) | JWT ou AD/LDAP |
| **Custo** | $0/mês (Free Tier) | ~R$50/mês (energia) |

---

## 🗓️ Cronograma (3 semanas)

### **Semana 1: Preparação (Fase Local)**

| Dia | Atividade | Responsável | Duração |
|-----|-----------|-------------|---------|
| 1-2 | Instalar PostgreSQL localmente | Dev | 2 dias |
| 3-4 | Migrar dados Firestore → PostgreSQL | Dev | 2 dias |
| 5-7 | Ajustar backend para usar PostgreSQL | Dev | 3 dias |
| 8-9 | Implementar autenticação JWT local | Dev | 2 dias |
| 10 | Testes locais completos | Dev + QA | 1 dia |

**Entregável**: Sistema funcionando 100% localmente (localhost)

---

### **Semana 2: Infraestrutura HMASP**

| Dia | Atividade | Responsável | Duração |
|-----|-----------|-------------|---------|
| 1-2 | Provisionar VMs (VM1, VM2, VM3) | TI HMASP | 2 dias |
| 2-3 | Configurar rede (IPs fixos, firewall) | TI HMASP | 2 dias |
| 3-4 | Instalar PostgreSQL no servidor BD | TI + Dev | 2 dias |
| 4-5 | Instalar software nas VMs | TI + Dev | 2 dias |

**Entregável**: Infraestrutura pronta (VMs ligadas, rede configurada)

**Guias de Instalação**:
- [INSTALACAO-VM-FRONTEND.md](INSTALACAO-VM-FRONTEND.md)
- [INSTALACAO-VM-WHATSAPP.md](INSTALACAO-VM-WHATSAPP.md)
- [INSTALACAO-VM-AGHUSE.md](INSTALACAO-VM-AGHUSE.md)
- [INSTALACAO-POSTGRESQL.md](INSTALACAO-POSTGRESQL.md)

---

### **Semana 3: Deploy e Validação**

| Dia | Atividade | Responsável | Duração |
|-----|-----------|-------------|---------|
| 1 | Deploy frontend (VM1) | Dev | 1 dia |
| 2 | Deploy backend WhatsApp (VM2) | Dev | 1 dia |
| 2 | Migrar sessão WhatsApp do GCE | Dev | 0.5 dia |
| 3 | Deploy backend AGHUse (VM3) | Dev | 1 dia |
| 3 | Importar dados no PostgreSQL | Dev | 0.5 dia |
| 4-5 | Testes integrados (todas as VMs) | Dev + QA + Usuários | 2 dias |
| 6-7 | Ajustes e correções | Dev | 2 dias |
| 8 | Treinamento da equipe | Dev + Gestor | 1 dia |
| 9 | Go-live (ativar produção) | Todos | 1 dia |
| 10 | Desativar serviços na nuvem | Dev | 1 dia |

**Entregável**: Sistema 100% em produção no HMASP

---

## 🛠️ Tarefas Detalhadas

### **FASE 1: Preparação Local (Máquina do Desenvolvedor)**

#### 1.1 Instalar PostgreSQL Local

```bash
# Windows: Docker
docker run --name postgres-hmasp \
  -e POSTGRES_PASSWORD=admin123 \
  -e POSTGRES_DB=hmasp_chat_local \
  -p 5432:5432 \
  -d postgres:15

# Linux/Mac
sudo apt-get install postgresql-15
```

#### 1.2 Migrar Dados do Firestore

**Script**: `scripts/migrate-firestore-to-postgres.js`

```javascript
// 1. Exportar dados do Firestore (JSON)
// 2. Transformar estrutura (NoSQL → SQL)
// 3. Inserir no PostgreSQL local
```

**Collections a migrar**:
- `usuarios` → tabela `usuarios`
- `pacientes` → tabelas `pacientes` + `pacientes_telefones`
- `agenda_contatos` → tabela `agenda_contatos`
- `audit_logs` → tabela `audit_logs`
- `configuracoes` → tabela `configuracoes`
- `templates` → tabela `templates`

#### 1.3 Ajustar Backend

**Substituir Firestore por PostgreSQL:**

```javascript
// ANTES (Firestore)
const usuarios = await db.collection('usuarios').get();

// DEPOIS (PostgreSQL)
const usuarios = await pool.query('SELECT * FROM usuarios');
```

**Arquivos a modificar**:
- `src/services/*.service.js` - Todos os serviços
- `src/main.js` - Chamadas ao banco

#### 1.4 Implementar Autenticação JWT

**ANTES**: Firebase Authentication (Google OAuth)
**DEPOIS**: JWT com bcrypt

```javascript
// POST /api/login
// - Valida email/senha
// - Gera token JWT
// - Retorna token + dados do usuário
```

#### 1.5 Testes Locais

**Checklist**:
- [ ] Login com usuário local
- [ ] Enviar mensagem WhatsApp
- [ ] Buscar consultas AGHUse
- [ ] Listar pacientes
- [ ] Criar usuário
- [ ] Logs de auditoria funcionando

---

### **FASE 2: Infraestrutura HMASP**

#### 2.1 Provisionar VMs (TI HMASP)

**Requisitos**:

| VM | Specs | IP | Hostname |
|----|-------|-----|----------|
| VM1 - Frontend | 2 vCPU, 2GB RAM, 20GB | 10.12.40.50 | hmasp-chat-frontend.local |
| VM2 - WhatsApp | 2 vCPU, 2GB RAM, 20GB | 10.12.40.51 | hmasp-chat-whatsapp.local |
| VM3 - AGHUse | 2 vCPU, 2GB RAM, 10GB | 10.12.40.52 | hmasp-chat-aghuse.local |
| Servidor BD | 4 vCPU, 4GB RAM, 100GB | 10.12.40.60 | hmasp-chat-db.local |

**SO**: Ubuntu Server 22.04 LTS

#### 2.2 Configurar Rede e Firewall

**Ver guia completo**: [CONFIGURACAO-REDE.md](CONFIGURACAO-REDE.md)

**Regras UFW**:
```bash
# VM1 - Frontend
sudo ufw allow from 10.12.40.0/24 to any port 80
sudo ufw allow from 10.12.40.0/24 to any port 443

# VM2 - WhatsApp
sudo ufw allow from 10.12.40.50 to any port 3000

# VM3 - AGHUse
sudo ufw allow from 10.12.40.50 to any port 3001

# Servidor BD
sudo ufw allow from 10.12.40.51 to any port 5432
sudo ufw allow from 10.12.40.52 to any port 5432
```

#### 2.3 Instalar PostgreSQL

**Ver guia completo**: [INSTALACAO-POSTGRESQL.md](INSTALACAO-POSTGRESQL.md)

**Resumo**:
```bash
sudo apt-get install postgresql-15
sudo -u postgres createdb hmasp_chat_producao
sudo -u postgres psql -d hmasp_chat_producao -f schema.sql
```

#### 2.4 Instalar Software nas VMs

**Ver guias específicos**:
- [INSTALACAO-VM-FRONTEND.md](INSTALACAO-VM-FRONTEND.md)
- [INSTALACAO-VM-WHATSAPP.md](INSTALACAO-VM-WHATSAPP.md)
- [INSTALACAO-VM-AGHUSE.md](INSTALACAO-VM-AGHUSE.md)

---

### **FASE 3: Deploy e Produção**

#### 3.1 Deploy Frontend (VM1)

```bash
# Copiar build
npm run build
scp -r dist/* usuario@10.12.40.50:/var/www/hmasp-chat/

# Configurar Nginx
sudo systemctl restart nginx

# Testar
curl http://10.12.40.50
```

#### 3.2 Deploy Backend WhatsApp (VM2)

```bash
# Copiar arquivos
scp server.js package.json usuario@10.12.40.51:/opt/hmasp-whatsapp/

# Instalar dependências
ssh usuario@10.12.40.51
cd /opt/hmasp-whatsapp
npm install --production

# Iniciar serviço
sudo systemctl start hmasp-whatsapp
```

**IMPORTANTE**: Migrar sessão WhatsApp!

```bash
# Baixar .wwebjs_auth do Google Cloud
scp -r centralderegulacaohmasp@136.118.10.24:~/hmasp-chat/.wwebjs_auth .

# Copiar para VM do HMASP
scp -r .wwebjs_auth usuario@10.12.40.51:/opt/hmasp-whatsapp/

# Ajustar permissões
sudo chown -R hmasp-whatsapp:hmasp-whatsapp /opt/hmasp-whatsapp/.wwebjs_auth
```

#### 3.3 Deploy Backend AGHUse (VM3)

```bash
# Copiar servidor
scp server-aghuse.js usuario@10.12.40.52:/opt/hmasp-aghuse/

# Instalar dependências
npm install express pg cors

# Iniciar serviço
sudo systemctl start hmasp-aghuse
```

#### 3.4 Importar Dados no PostgreSQL

```bash
# Exportar dados do desenvolvimento local
pg_dump -h localhost -U postgres -d hmasp_chat_local -f dump.sql

# Copiar para servidor BD
scp dump.sql usuario@10.12.40.60:/tmp/

# Importar
sudo -u postgres psql -d hmasp_chat_producao -f /tmp/dump.sql
```

#### 3.5 Testes Integrados

**Checklist**:
- [ ] Acessar frontend: http://10.12.40.50
- [ ] Login funciona
- [ ] WhatsApp conectado (verificar status)
- [ ] Enviar mensagem de teste
- [ ] Buscar consultas no AGHUse
- [ ] Listar pacientes
- [ ] Criar novo usuário
- [ ] Logs de auditoria sendo gravados
- [ ] Backup automático configurado

#### 3.6 Configurar Cron Jobs (Envio Automático)

**VM1**:
```bash
sudo crontab -e

# Confirmações imediatas - a cada hora
0 * * * * /usr/bin/node /opt/hmasp-chat-cron/envio-confirmacoes.js

# Lembretes 72h - 1x por dia às 8h
0 8 * * * /usr/bin/node /opt/hmasp-chat-cron/lembrete-72h.js

# Notificar faltas - 1x por dia às 20h
0 20 * * * /usr/bin/node /opt/hmasp-chat-cron/notificar-faltas.js
```

#### 3.7 Treinamento da Equipe

**Duração**: 2-3 horas

**Conteúdo**:
1. Visão geral do sistema
2. Como fazer login
3. Como enviar mensagens
4. Como consultar pacientes
5. Como confirmar presença
6. Resolução de problemas básicos

**Material**:
- [MANUAL-USUARIO.md](MANUAL-USUARIO.md)
- Apresentação em slides
- Sessão prática (hands-on)

---

### **FASE 4: Desativação da Nuvem**

#### 4.1 Backup Final

```bash
# Firestore
firebase firestore:export gs://hmasp-chat-backup
gsutil -m cp -r gs://hmasp-chat-backup .

# Servidor GCE (sessão WhatsApp)
scp -r centralderegulacaohmasp@136.118.10.24:~/hmasp-chat/.wwebjs_auth backup-whatsapp-session/
```

#### 4.2 Validação Paralela (5 dias)

- Sistema HMASP em produção
- Sistema nuvem ainda ativo (fallback)
- Monitorar ambos
- Comparar resultados

#### 4.3 Desativar Serviços Cloud

```bash
# Parar servidor GCE
gcloud compute instances stop hmasp-whatsapp-server --zone=us-west1-b

# Desativar Firebase Hosting
firebase hosting:disable

# Após 30 dias de validação: deletar projeto (opcional)
gcloud projects delete hmasp-chat
```

#### 4.4 Comunicação

- Atualizar bookmarks/favoritos dos usuários
- Novo acesso: `http://10.12.40.50` ou `http://hmasp-chat.local`
- Comunicar mudança por email/reunião

---

## ✅ Checklist Geral

### Antes de Começar
- [ ] Aprovação da chefia
- [ ] TI do HMASP alinhado
- [ ] Recursos (VMs) confirmados
- [ ] Backup da nuvem realizado

### Fase 1 - Local
- [ ] PostgreSQL local instalado
- [ ] Dados migrados do Firestore
- [ ] Backend ajustado (SQL)
- [ ] Autenticação JWT implementada
- [ ] Testes locais OK

### Fase 2 - Infraestrutura
- [ ] VMs provisionadas
- [ ] IPs fixos configurados
- [ ] Firewall configurado
- [ ] PostgreSQL servidor instalado
- [ ] Software instalado em todas as VMs

### Fase 3 - Deploy
- [ ] Frontend deployado (VM1)
- [ ] Backend WhatsApp deployado (VM2)
- [ ] Sessão WhatsApp migrada
- [ ] Backend AGHUse deployado (VM3)
- [ ] Dados importados no PostgreSQL
- [ ] Cron jobs configurados
- [ ] Testes integrados OK
- [ ] Treinamento realizado

### Fase 4 - Go-Live
- [ ] Sistema em produção no HMASP
- [ ] Validação paralela (5 dias)
- [ ] Equipe treinada
- [ ] Documentação entregue
- [ ] Serviços cloud desativados

---

## 🚨 Riscos e Mitigações

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Sessão WhatsApp desconectar | Média | Alto | Backup da sessão + QR Code pronto |
| Falha na migração de dados | Baixa | Alto | Backup completo antes + testes |
| Problemas de rede/firewall | Média | Médio | Testes de conectividade prévios |
| Resistência dos usuários | Baixa | Médio | Treinamento adequado |
| Downtime prolongado | Baixa | Alto | Validação paralela (nuvem ativa) |

---

## 📞 Equipe e Responsabilidades

| Papel | Nome | Email | Responsabilidade |
|-------|------|-------|------------------|
| **Desenvolvedor** | [A DEFINIR] | centralderegulacaohmasp@gmail.com | Código, deploy, testes |
| **TI HMASP** | [A DEFINIR] | [A DEFINIR] | Infraestrutura, VMs, rede |
| **DBA** | [A DEFINIR] | [A DEFINIR] | PostgreSQL, backups |
| **Gestor** | [A DEFINIR] | [A DEFINIR] | Aprovações, comunicação |
| **QA** | [A DEFINIR] | [A DEFINIR] | Testes, validação |

---

## 📚 Documentação de Referência

1. [INFRAESTRUTURA-HMASP.md](INFRAESTRUTURA-HMASP.md) - **Documento principal para TI**
2. [INSTALACAO-VM-WHATSAPP.md](INSTALACAO-VM-WHATSAPP.md)
3. [INSTALACAO-POSTGRESQL.md](INSTALACAO-POSTGRESQL.md)
4. [CONFIGURACAO-REDE.md](CONFIGURACAO-REDE.md)
5. [MANUTENCAO-BACKUP.md](MANUTENCAO-BACKUP.md)
6. [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
7. [MANUAL-USUARIO.md](MANUAL-USUARIO.md)

---

## 🎯 Conclusão

**Prazo total**: 3 semanas (15 dias úteis)
**Custo**: R$ 0,00 (infraestrutura existente)
**Resultado esperado**: Sistema 100% hospedado internamente, seguro, conforme LGPD

**Próximo passo**: Agendar reunião de kickoff com TI HMASP

---

**Última atualização**: Dezembro 2025
**Versão**: 1.0
**Status**: Aguardando aprovação
