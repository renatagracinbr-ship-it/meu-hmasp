# 🏥 INFRAESTRUTURA HMASP - Documento para TI

**Documento Principal para Equipe de TI do Hospital**

Este documento descreve a infraestrutura necessária para hospedar o sistema HMASP Chat nos servidores internos do hospital.

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Requisitos de Infraestrutura](#requisitos-de-infraestrutura)
3. [Arquitetura de Segurança](#arquitetura-de-segurança)
4. [Especificações Técnicas](#especificações-técnicas)
5. [Cronograma de Implementação](#cronograma-de-implementação)
6. [Custos e Recursos](#custos-e-recursos)
7. [Próximos Passos](#próximos-passos)

---

## 🎯 Visão Geral

### O que é o HMASP Chat?

Sistema web para gerenciar comunicação via WhatsApp com pacientes:
- Confirmação de presença em consultas
- Notificação de cancelamentos
- Notificação de faltas
- Chat direto com pacientes
- Integração com banco de dados AGHUse

### Estado Atual

**Hospedado na nuvem (Google Cloud + Firebase)** apenas para demonstração:
- Custo: $0.00/mês (Free Tier)
- Acesso: https://hmasp-chat.web.app
- Objetivo: Validar funcionamento e apresentar para chefia

### Objetivo da Migração

**Hospedar 100% na infraestrutura interna do HMASP:**
- ✅ Controle total sobre os dados (conformidade LGPD)
- ✅ Melhor performance (rede interna)
- ✅ Sem dependência de provedores externos
- ✅ Integração direta com AGHUse (sem VPN)
- ✅ **Isolamento de segurança**: WhatsApp isolado da intranet

---

## 🖥️ Requisitos de Infraestrutura

### Opção Recomendada: 2 VMs Intranet + 1 VM Internet + 1 Servidor PostgreSQL

| Recurso | Função | Localização | Especificações |
|---------|--------|-------------|----------------|
| **VM1** | Frontend Web | Intranet | 2 vCPU, 2GB RAM, 20GB disco |
| **VM2** | Backend WhatsApp | **Internet (DMZ)** | 2 vCPU, 2GB RAM, 20GB disco |
| **VM3** | Backend AGHUse | Intranet | 2 vCPU, 2GB RAM, 10GB disco |
| **Servidor BD** | PostgreSQL | Intranet | 4 vCPU, 4GB RAM, 100GB disco |

**Total de Recursos Necessários:**
- **10 vCPUs** (ou 5 cores físicos)
- **10 GB RAM**
- **150 GB disco** (HDD suficiente, SSD recomendado para BD)

### Sistema Operacional

**Ubuntu Server 22.04 LTS** (recomendado)
- Suporte até 2027
- Compatível com todos os softwares necessários
- Fácil administração via SSH

**Alternativa**: Debian 12 ou CentOS Stream 9

---

## 🔒 Arquitetura de Segurança

### 🎨 **Diagrama Principal**

```
┌─────────────────────────────────────────────────────────────┐
│                    REDE INTERNA HMASP                       │
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  USUÁRIO (Navegador Chrome/Edge)                      │ │
│  │  - Lógica de negócio (JavaScript)                     │ │
│  │  - Orquestra WhatsApp + AGHUse                        │ │
│  └──────┬────────────────────────┬───────────────────────┘ │
│         │                        │                          │
│         │ HTTP (intranet)        │ HTTP (intranet)          │
│         ↓                        ↓                          │
│  ┌─────────────────┐      ┌─────────────────┐             │
│  │ VM1 - FRONTEND  │      │ VM3 - AGHUSE    │             │
│  │ (10.12.40.50)   │      │ (10.12.40.52)   │             │
│  │                 │      │                 │             │
│  │ - Nginx         │      │ - Node.js       │             │
│  │ - HTML/CSS/JS   │      │ - Express API   │             │
│  └─────────────────┘      │ - pg (driver)   │             │
│                           └────────┬────────┘             │
│                                    │                        │
│                           ┌────────▼────────┐              │
│                           │ PostgreSQL      │              │
│                           │ (10.12.40.60)   │              │
│                           └────────┬────────┘              │
│                                    │                        │
│                           ┌────────▼────────┐              │
│                           │ AGHUse DB       │              │
│                           │ (10.12.40.219)  │              │
│                           └─────────────────┘              │
└─────────────────────────────────────────────────────────────┘
                                   │
                                   │ Firewall/DMZ
                                   │
┌──────────────────────────────────▼──────────────────────────┐
│                          INTERNET                           │
│                                                             │
│  ┌─────────────────┐                                       │
│  │ VM2 - WHATSAPP  │  ← Isolada! Sem acesso à intranet    │
│  │ (IP Público)    │                                       │
│  │                 │                                       │
│  │ - Node.js       │                                       │
│  │ - whatsapp-web  │                                       │
│  │ - Chromium      │                                       │
│  └────────┬────────┘                                       │
│           │                                                 │
│           ↓                                                 │
│     WhatsApp Web                                           │
└─────────────────────────────────────────────────────────────┘
         ↑
         │ HTTPS (acesso do navegador do usuário)
         │
  ┌──────┴──────┐
  │  USUÁRIO    │  ← Acessa de dentro da intranet
  │ (Navegador) │
  └─────────────┘
```

### 🛡️ **Princípios de Segurança**

#### **1. Isolamento de Rede**
- ✅ **VM2 (WhatsApp)** está na **DMZ ou Internet**
- ✅ **VM2 NÃO tem acesso** à intranet (10.12.40.0/24)
- ✅ **VM3 (AGHUse) e PostgreSQL** ficam **isolados na intranet**
- ✅ Comunicação entre zonas **apenas via frontend** (navegador do usuário)

#### **2. Separação de Responsabilidades**
- **VM1**: Servir arquivos estáticos (HTML/CSS/JS)
- **VM2**: Apenas enviar mensagens WhatsApp (sem dados sensíveis)
- **VM3**: Processar dados do AGHUse (intranet pura)
- **Frontend**: Orquestrar a lógica de negócio

#### **3. Menor Privilégio**
- VM2 não tem acesso a bancos de dados
- VM3 não tem acesso à internet
- PostgreSQL aceita conexões apenas de VM3

---

## 📊 Fluxo de Dados Completo

### Cenário: Confirmar Consulta

```
1️⃣  Usuário acessa frontend
    └─> http://10.12.40.50 (VM1 - Nginx)

2️⃣  Frontend busca consultas do AGHUse
    └─> GET http://10.12.40.52:3001/api/consultas
    └─> VM3 consulta PostgreSQL + AGHUse
    └─> Retorna: [{cpf, nome, telefone, data, hora}]

3️⃣  Frontend envia mensagem WhatsApp
    └─> POST https://vm2-whatsapp.com:3000/api/send
    └─> Body: {to: "+5511999...", message: "Olá João..."}
    └─> VM2 envia via WhatsApp Web (internet)

4️⃣  Frontend registra auditoria
    └─> POST http://10.12.40.52:3001/api/audit
    └─> VM3 salva em audit_logs (PostgreSQL)
```

**🔐 Importante**: VM2 **nunca** acessa VM3, PostgreSQL ou AGHUse!

---

## ⚙️ Especificações Técnicas

### VM1 - Frontend (Intranet)

**Hardware:**
- 2 vCPU
- 2GB RAM
- 20GB disco

**Rede:**
- IP: `10.12.40.50` (intranet)
- Acesso: Rede interna (10.12.40.0/24)

**Software a instalar:**
- Ubuntu Server 22.04 LTS
- Nginx 1.22+
- Git (opcional)

**Portas:**
- 80 (HTTP) - obrigatório
- 443 (HTTPS) - opcional, se houver certificado

**Serviços:**
- `nginx.service` - Servidor web

**Acesso necessário:**
- Inbound: Porta 80/443 de qualquer IP da rede interna
- Outbound: Não necessário

**Firewall (UFW):**
```bash
sudo ufw allow from 10.12.40.0/24 to any port 80
sudo ufw allow from 10.12.40.0/24 to any port 443
sudo ufw default deny incoming
sudo ufw enable
```

---

### VM2 - Backend WhatsApp (Internet/DMZ) 🌐

**Hardware:**
- 2 vCPU
- 2GB RAM
- 20GB disco

**Rede:**
- **IP Público** ou **DMZ**: Acessível da internet
- **Exemplo**: `200.x.x.x` ou configurar proxy reverso
- **NÃO tem acesso** à intranet (10.12.40.0/24)

**Software a instalar:**
- Ubuntu Server 22.04 LTS
- Node.js 20.x
- Chromium Browser (necessário para whatsapp-web.js)
- Git

**Portas:**
- 3000 (API REST) - Acessível via HTTPS

**Serviços:**
- `hmasp-whatsapp.service` - Servidor WhatsApp

**Acesso necessário:**
- Inbound: Porta 3000 de qualquer IP (internet)
- Outbound: Internet (WhatsApp Web - porta 443)
- **Bloqueado**: Intranet (10.12.40.0/24)

**Firewall (UFW):**
```bash
# Permitir API WhatsApp (de qualquer lugar)
sudo ufw allow 3000/tcp

# Permitir saída para WhatsApp Web
sudo ufw allow out 443/tcp

# BLOQUEAR acesso à intranet
sudo ufw deny out to 10.12.40.0/24

# SSH apenas de IP admin
sudo ufw allow from <IP_ADMIN> to any port 22

sudo ufw enable
```

**IMPORTANTE:**
- ❌ **NÃO instalar PostgreSQL** nesta VM
- ❌ **NÃO conectar** em bancos de dados internos
- ✅ Apenas enviar mensagens WhatsApp

---

### VM3 - Backend AGHUse (Intranet)

**Hardware:**
- 2 vCPU
- 2GB RAM
- 10GB disco

**Rede:**
- IP: `10.12.40.52` (intranet)
- Acesso: Apenas rede interna

**Software a instalar:**
- Ubuntu Server 22.04 LTS
- Node.js 20.x
- Git

**Portas:**
- 3001 (API REST)

**Serviços:**
- `hmasp-aghuse.service` - Servidor AGHUse API

**Acesso necessário:**
- Inbound: Porta 3001 de qualquer IP da intranet (10.12.40.0/24)
- Outbound: Porta 5432 (PostgreSQL - 10.12.40.60)
- Outbound: Porta 5432 (AGHUse - 10.12.40.219)

**Firewall (UFW):**
```bash
# Permitir API de qualquer IP da intranet
sudo ufw allow from 10.12.40.0/24 to any port 3001

# BLOQUEAR acesso à internet
sudo ufw default deny outgoing

# Permitir acesso aos bancos de dados
sudo ufw allow out to 10.12.40.60 port 5432
sudo ufw allow out to 10.12.40.219 port 5432

# Permitir DNS (necessário)
sudo ufw allow out 53/udp

sudo ufw enable
```

---

### Servidor PostgreSQL (Intranet)

**Hardware:**
- 4 vCPU
- 4GB RAM
- 100GB disco (SSD recomendado)

**Rede:**
- IP: `10.12.40.60` (intranet)

**Software a instalar:**
- Ubuntu Server 22.04 LTS
- PostgreSQL 15

**Portas:**
- 5432 (PostgreSQL)

**Databases:**
- `hmasp_chat_producao` - Banco principal do sistema

**Acesso necessário:**
- Inbound: Porta 5432 **apenas** de VM3 (10.12.40.52)
- Outbound: Não necessário

**Firewall (UFW):**
```bash
# Permitir PostgreSQL APENAS de VM3
sudo ufw allow from 10.12.40.52 to any port 5432

# SSH apenas de rede interna
sudo ufw allow from 10.12.40.0/24 to any port 22

# Bloquear todo o resto
sudo ufw default deny incoming
sudo ufw default deny outgoing

sudo ufw enable
```

**Backup:**
- Backup diário automático (script fornecido)
- Retenção: 30 dias
- Armazenamento: ~500MB por backup

---

## 🔧 Configuração de Rede e Firewall

### Tabela Resumida de Firewall

| VM | Permite Entrada | Permite Saída | Bloqueia |
|----|----------------|---------------|----------|
| **VM1** | Intranet:80,443 | - | Internet |
| **VM2** | Internet:3000 | Internet:443 | **Intranet** ⚠️ |
| **VM3** | Intranet:3001 | PostgreSQL:5432, AGHUse:5432 | Internet |
| **BD** | VM3:5432 | - | Todos exceto VM3 |

### IPs Fixos Necessários

| Servidor | IP Sugerido | Hostname Sugerido |
|----------|-------------|-------------------|
| VM1 | 10.12.40.50 | hmasp-chat-frontend.local |
| VM2 | **IP Público** | hmasp-chat-whatsapp.com |
| VM3 | 10.12.40.52 | hmasp-chat-aghuse.local |
| Servidor BD | 10.12.40.60 | hmasp-chat-db.local |

**Configurar no DNS interno (opcional)**:
```
hmasp-chat.local → 10.12.40.50
```

---

## 📅 Cronograma de Implementação

### Fase 1: Provisionar Infraestrutura (1 semana)

**Responsável**: TI HMASP

- [ ] Criar VM1 (Frontend - intranet)
- [ ] Criar VM2 (WhatsApp - internet/DMZ)
- [ ] Criar VM3 (AGHUse - intranet)
- [ ] Provisionar Servidor PostgreSQL
- [ ] Atribuir IPs fixos
- [ ] Configurar firewall conforme especificações ⚠️
- [ ] Configurar DNS interno (opcional)
- [ ] Fornecer acesso SSH para desenvolvedor

### Fase 2: Instalação de Software (1 semana)

**Responsável**: Desenvolvedor + TI

- [ ] Instalar Ubuntu Server 22.04 em todas as VMs
- [ ] Instalar Nginx na VM1
- [ ] Instalar Node.js + Chromium na VM2
- [ ] Instalar Node.js na VM3
- [ ] Instalar PostgreSQL no Servidor BD
- [ ] Configurar systemd services
- [ ] Testar conectividade entre servidores
- [ ] **Validar isolamento de rede** (VM2 bloqueada)

**Guias de instalação detalhados:**
- [INSTALACAO-VM-WHATSAPP.md](INSTALACAO-VM-WHATSAPP.md)
- [INSTALACAO-POSTGRESQL.md](INSTALACAO-POSTGRESQL.md)

### Fase 3: Deploy da Aplicação (3 dias)

**Responsável**: Desenvolvedor

- [ ] Deploy do frontend (VM1)
- [ ] Deploy do backend WhatsApp (VM2)
- [ ] Deploy do backend AGHUse (VM3)
- [ ] Migrar dados do Firestore para PostgreSQL
- [ ] Migrar sessão WhatsApp do Google Cloud
- [ ] Ajustar URLs no frontend (VM2 via internet)

### Fase 4: Testes e Validação (1 semana)

**Responsável**: Desenvolvedor + Usuários

- [ ] Testes de conectividade
- [ ] **Teste de isolamento** (VM2 não acessa intranet)
- [ ] Testes de envio/recebimento WhatsApp
- [ ] Testes de integração AGHUse
- [ ] Testes de confirmação automática
- [ ] Testes de carga (simular múltiplos usuários)
- [ ] Ajustes e correções

### Fase 5: Produção (1 dia)

**Responsável**: Desenvolvedor + TI + Gestor

- [ ] Treinamento da equipe
- [ ] Documentação de operação
- [ ] Ativar monitoramento
- [ ] Configurar backups automáticos
- [ ] Desativar serviços na nuvem

**Total: ~3 semanas (15 dias úteis)**

---

## 💰 Custos e Recursos

### Investimento Inicial

| Item | Quantidade | Custo |
|------|------------|-------|
| VMs (usar infraestrutura existente) | 3 | R$ 0,00 |
| Servidor PostgreSQL (usar servidor existente) | 1 | R$ 0,00 |
| IP público para VM2 (se necessário) | 1 | Verificar com provedor |
| Licenças de software (tudo open-source) | - | R$ 0,00 |
| Horas de trabalho TI (estimativa) | 40h | Interno |
| Horas de trabalho Dev (estimativa) | 60h | Interno |
| **TOTAL** | - | **R$ 0,00** |

### Custos Recorrentes

| Item | Frequência | Custo |
|------|------------|-------|
| Manutenção de servidores | Mensal | R$ 0,00 (TI existente) |
| Energia elétrica (VMs) | Mensal | ~R$ 50,00 |
| IP público (se aplicável) | Mensal | Verificar com provedor |
| Backup storage (500MB/dia) | Mensal | R$ 0,00 (servidor existente) |
| **TOTAL** | **Mensal** | **~R$ 50,00** |

**Economia em relação à nuvem:**
- Atual: $0.00/mês (Free Tier, mas pode acabar)
- Futuro: R$ 50,00/mês (energia, mas sem risco de cobrança)

---

## 🔧 Manutenção e Suporte

### Responsabilidades

**TI do HMASP:**
- Gerenciar VMs (ligar/desligar, reiniciar)
- Monitorar recursos (CPU, RAM, disco)
- Executar backups
- Aplicar atualizações de segurança do SO
- Gerenciar firewall
- **Manter isolamento de VM2**

**Desenvolvedor:**
- Corrigir bugs da aplicação
- Implementar novas funcionalidades
- Atualizar dependências (Node.js, npm packages)
- Suporte técnico aos usuários
- Documentação

**Usuários (Central de Regulação):**
- Usar o sistema diariamente
- Reportar problemas
- Sugerir melhorias

### Monitoramento

**Ferramentas recomendadas (opcional):**
- Nagios / Zabbix - Monitoramento de uptime
- Grafana + Prometheus - Dashboards de performance
- Logs centralizados (rsyslog ou ELK stack)

**Mínimo requerido:**
- Verificação manual diária do status dos serviços
- Logs de cada serviço (`journalctl -u <service>`)
- **Validação periódica** do isolamento de VM2

---

## 📞 Suporte e Contatos

### Equipe do Projeto

**Desenvolvedor:**
- Nome: [A DEFINIR]
- Email: centralderegulacaohmasp@gmail.com
- Telefone: [A DEFINIR]

**TI HMASP:**
- Responsável: [A DEFINIR]
- Email: [A DEFINIR]
- Telefone: [A DEFINIR]

**Gestor do Projeto:**
- Nome: [A DEFINIR]
- Email: [A DEFINIR]
- Telefone: [A DEFINIR]

---

## ✅ Próximos Passos

### Para Iniciar o Projeto

1. **Reunião de Alinhamento**
   - Apresentar este documento para TI do HMASP
   - Esclarecer dúvidas técnicas sobre **isolamento de rede**
   - Definir responsáveis

2. **Aprovar Infraestrutura**
   - Validar especificações de VMs
   - Confirmar IPs disponíveis (VM1, VM3, BD)
   - **Definir estratégia para VM2** (IP público ou DMZ)
   - Verificar acesso ao AGHUse DB

3. **Provisionar Recursos**
   - Criar VMs conforme especificações
   - Configurar rede e **firewall com isolamento**
   - Fornecer acesso SSH

4. **Iniciar Instalação**
   - Seguir guias detalhados na pasta `docs/`
   - Executar testes de conectividade
   - **Validar isolamento de VM2**
   - Fazer deploy inicial

---

## 📚 Documentação Complementar

### Guias de Instalação (Passo a Passo)

1. [INSTALACAO-VM-WHATSAPP.md](INSTALACAO-VM-WHATSAPP.md) - **VM2 SEM PostgreSQL**
2. [INSTALACAO-POSTGRESQL.md](INSTALACAO-POSTGRESQL.md) - Servidor BD
3. [ARQUITETURA-SEGURANCA.md](ARQUITETURA-SEGURANCA.md) - **Detalhes de isolamento**

### Operação e Manutenção

4. [MANUTENCAO-BACKUP.md](MANUTENCAO-BACKUP.md)
5. [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

### Técnica

6. [PLANO-MIGRACAO.md](PLANO-MIGRACAO.md)

---

## ⚠️ PONTOS CRÍTICOS DE SEGURANÇA

### ✅ Checklist de Segurança

- [ ] VM2 (WhatsApp) **NÃO** tem acesso à intranet (10.12.40.0/24)
- [ ] VM2 **NÃO** conecta em PostgreSQL ou AGHUse
- [ ] VM3 (AGHUse) **NÃO** tem acesso à internet
- [ ] PostgreSQL aceita conexões **apenas** de VM3
- [ ] Frontend orquestra comunicação entre VM2 e VM3
- [ ] Firewall validado e testado
- [ ] Logs de auditoria habilitados
- [ ] Backup automático configurado

---

**Documento preparado em**: Dezembro 2025
**Versão**: 2.0 - Arquitetura de Segurança com Isolamento
**Status**: Aguardando aprovação da TI HMASP
