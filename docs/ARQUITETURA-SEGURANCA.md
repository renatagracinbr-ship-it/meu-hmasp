# 🔒 Arquitetura de Segurança - HMASP Chat

**Isolamento de Rede e Princípios de Segurança**

---

## 🎯 Objetivo

Garantir que dados sensíveis do hospital (AGHUse, pacientes) **nunca** sejam acessíveis por sistemas expostos à internet.

**Princípio fundamental**: **WhatsApp isolado da intranet**

---

## 🎨 Diagrama Completo da Arquitetura

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

---

## 🛡️ Princípios de Segurança

### 1. **Isolamento de Rede (Zero Trust)**

#### ✅ O que está implementado:

- **VM2 (WhatsApp)** está completamente isolada:
  - ❌ NÃO tem acesso à intranet (10.12.40.0/24)
  - ❌ NÃO conecta em PostgreSQL
  - ❌ NÃO conecta em AGHUse
  - ✅ Apenas envia mensagens via WhatsApp Web

- **VM3 (AGHUse)** está isolada da internet:
  - ❌ NÃO tem acesso à internet
  - ✅ Apenas acessa PostgreSQL e AGHUse (intranet)

- **PostgreSQL** aceita conexões apenas de VM3:
  - ❌ NÃO aceita de VM2
  - ❌ NÃO aceita da internet

#### 🔐 Por que isso é importante?

Se VM2 for comprometida (invasão, malware), o atacante:
- ❌ NÃO consegue acessar dados de pacientes
- ❌ NÃO consegue acessar AGHUse
- ❌ NÃO consegue acessar PostgreSQL
- ✅ Pode apenas enviar mensagens WhatsApp (impacto limitado)

---

### 2. **Separação de Responsabilidades**

Cada VM tem **apenas uma função**:

| VM | Função | Dados Sensíveis | Acesso Internet |
|----|--------|-----------------|-----------------|
| **VM1** | Servir HTML/CSS/JS | ❌ Não | ❌ Não |
| **VM2** | Enviar WhatsApp | ❌ Não | ✅ Sim (apenas saída) |
| **VM3** | Processar AGHUse | ✅ Sim | ❌ Não |
| **BD** | Armazenar dados | ✅ Sim | ❌ Não |

**Frontend (JavaScript no navegador)** orquestra tudo:
- Busca dados do AGHUse (VM3)
- Envia mensagem WhatsApp (VM2)
- Nunca mistura os dois!

---

### 3. **Menor Privilégio**

Cada componente tem **apenas** as permissões necessárias:

#### VM2 (WhatsApp)
```javascript
// server.js - SIMPLES E SEGURO

// ❌ SEM conexão com banco de dados
// ❌ SEM acesso a dados de pacientes

app.post('/api/send', async (req, res) => {
  const { to, message } = req.body;

  // Apenas envia mensagem
  const result = await whatsappClient.sendMessage(to, message);

  res.json({ success: true, messageId: result.id });
});
```

#### VM3 (AGHUse)
```javascript
// server-aghuse.js - ACESSA DADOS SENSÍVEIS

const pool = new Pool({
  host: '10.12.40.60',      // PostgreSQL HMASP
  database: 'hmasp_chat_producao'
});

const poolAGHUse = new Pool({
  host: '10.12.40.219',     // AGHUse (read-only)
  database: 'dbaghu'
});

app.get('/api/consultas', async (req, res) => {
  // Consulta dados sensíveis
  const consultas = await poolAGHUse.query('SELECT ...');
  res.json(consultas.rows);
});
```

---

## 🔥 Configuração de Firewall

### VM1 - Frontend (Intranet)

```bash
#!/bin/bash
# Firewall VM1 - Frontend

# Aceita HTTP/HTTPS da intranet
sudo ufw allow from 10.12.40.0/24 to any port 80
sudo ufw allow from 10.12.40.0/24 to any port 443

# Bloqueia todo o resto
sudo ufw default deny incoming
sudo ufw default deny outgoing

# SSH admin
sudo ufw allow from 10.12.40.0/24 to any port 22

sudo ufw enable
sudo ufw status verbose
```

---

### VM2 - WhatsApp (Internet/DMZ) ⚠️ CRÍTICO

```bash
#!/bin/bash
# Firewall VM2 - WhatsApp (ISOLAMENTO TOTAL)

# Aceita API de qualquer lugar
sudo ufw allow 3000/tcp

# Permite saída para WhatsApp Web
sudo ufw allow out 443/tcp
sudo ufw allow out 80/tcp

# ⚠️ BLOQUEAR INTRANET (CRÍTICO!)
sudo ufw deny out to 10.12.40.0/24
sudo ufw deny in from 10.12.40.0/24

# SSH apenas de IP específico do admin
sudo ufw allow from <IP_ADMIN_EXTERNO> to any port 22

# Bloqueia todo o resto
sudo ufw default deny incoming

sudo ufw enable
sudo ufw status verbose

# VALIDAR BLOQUEIO
echo "Testando bloqueio da intranet..."
ping -c 3 10.12.40.50 && echo "❌ ERRO: Ainda acessa intranet!" || echo "✅ OK: Intranet bloqueada"
ping -c 3 10.12.40.60 && echo "❌ ERRO: Ainda acessa BD!" || echo "✅ OK: BD bloqueado"
```

**IMPORTANTE**: Executar o script de validação após configurar!

---

### VM3 - AGHUse (Intranet)

```bash
#!/bin/bash
# Firewall VM3 - AGHUse

# Aceita API da intranet
sudo ufw allow from 10.12.40.0/24 to any port 3001

# BLOQUEIA internet (exceto DNS)
sudo ufw default deny outgoing

# Permite acesso aos bancos de dados
sudo ufw allow out to 10.12.40.60 port 5432      # PostgreSQL HMASP
sudo ufw allow out to 10.12.40.219 port 5432     # AGHUse

# Permite DNS (necessário)
sudo ufw allow out 53/udp

# SSH admin
sudo ufw allow from 10.12.40.0/24 to any port 22

sudo ufw enable
sudo ufw status verbose
```

---

### Servidor BD (PostgreSQL)

```bash
#!/bin/bash
# Firewall PostgreSQL - Acesso APENAS de VM3

# Aceita PostgreSQL APENAS de VM3
sudo ufw allow from 10.12.40.52 to any port 5432

# SSH admin
sudo ufw allow from 10.12.40.0/24 to any port 22

# Bloqueia TODO O RESTO
sudo ufw default deny incoming
sudo ufw default deny outgoing

sudo ufw enable
sudo ufw status verbose
```

---

## 📊 Fluxo de Dados Seguro

### Cenário 1: Confirmação de Consulta

```
1. USUÁRIO acessa frontend
   └─> http://10.12.40.50
   └─> VM1 serve index.html

2. FRONTEND busca consultas (JavaScript no navegador)
   └─> fetch('http://10.12.40.52:3001/api/consultas')
   └─> VM3 consulta AGHUse
   └─> Retorna: [{nome, telefone, data, hora}]

3. FRONTEND envia mensagem WhatsApp
   └─> fetch('https://vm2-whatsapp.com:3000/api/send', {
         method: 'POST',
         body: JSON.stringify({
           to: '+5511999999999',
           message: 'Olá João! Sua consulta...'
         })
       })
   └─> VM2 envia via WhatsApp Web
   └─> ⚠️ VM2 NUNCA vê os dados do AGHUse!

4. FRONTEND registra auditoria
   └─> fetch('http://10.12.40.52:3001/api/audit', {...})
   └─> VM3 salva em audit_logs
```

**🔐 Segurança:**
- Dados do AGHUse: VM3 → Frontend (intranet)
- Mensagem WhatsApp: Frontend → VM2 (internet)
- **Nunca há comunicação direta VM2 ↔ VM3**

---

### Cenário 2: Tentativa de Invasão em VM2

**Suponha que VM2 seja comprometida:**

```
1. Atacante ganha acesso à VM2
   └─> Executa comandos na VM2

2. Atacante tenta acessar intranet
   └─> ping 10.12.40.50
   └─> ❌ BLOQUEADO pelo firewall

3. Atacante tenta acessar PostgreSQL
   └─> psql -h 10.12.40.60 -U hmasp_app
   └─> ❌ BLOQUEADO pelo firewall

4. Atacante tenta acessar AGHUse
   └─> psql -h 10.12.40.219 -U birm_read
   └─> ❌ BLOQUEADO pelo firewall

5. O que o atacante PODE fazer?
   └─> Enviar mensagens WhatsApp
   └─> Impacto: LIMITADO (apenas spam)
```

**Resultado**: Dados sensíveis protegidos! ✅

---

## ✅ Checklist de Segurança

### Antes de Ir para Produção

- [ ] **VM2 isolada**
  - [ ] Firewall bloqueia intranet (10.12.40.0/24)
  - [ ] Teste: `ping 10.12.40.50` deve falhar
  - [ ] Teste: `ping 10.12.40.60` deve falhar
  - [ ] Teste: `curl http://10.12.40.52:3001` deve falhar

- [ ] **VM3 isolada**
  - [ ] Firewall bloqueia internet
  - [ ] Teste: `ping google.com` deve falhar
  - [ ] Teste: `curl http://google.com` deve falhar
  - [ ] Teste: `psql -h 10.12.40.60 ...` deve funcionar ✅

- [ ] **PostgreSQL restrito**
  - [ ] Aceita apenas de 10.12.40.52 (VM3)
  - [ ] Teste de VM2: `psql -h 10.12.40.60 ...` deve falhar
  - [ ] Teste de VM3: `psql -h 10.12.40.60 ...` deve funcionar ✅

- [ ] **Frontend orquestra comunicação**
  - [ ] Frontend acessa VM2 (WhatsApp) ✅
  - [ ] Frontend acessa VM3 (AGHUse) ✅
  - [ ] VM2 e VM3 NÃO se comunicam diretamente ✅

- [ ] **Logs e auditoria**
  - [ ] Logs de todas as ações
  - [ ] Auditoria de acessos a dados sensíveis
  - [ ] Retenção de 30 dias (LGPD)

---

## 🧪 Scripts de Validação

### Script de Teste de Isolamento (executar em VM2)

```bash
#!/bin/bash
# test-isolation-vm2.sh
# Executar em VM2 para validar isolamento

echo "=== TESTE DE ISOLAMENTO VM2 ==="
echo ""

echo "1. Testando acesso à VM1 (Frontend)..."
if ping -c 3 -W 2 10.12.40.50 > /dev/null 2>&1; then
  echo "❌ FALHA: VM2 consegue acessar VM1!"
  exit 1
else
  echo "✅ OK: VM1 bloqueada"
fi

echo ""
echo "2. Testando acesso à VM3 (AGHUse)..."
if ping -c 3 -W 2 10.12.40.52 > /dev/null 2>&1; then
  echo "❌ FALHA: VM2 consegue acessar VM3!"
  exit 1
else
  echo "✅ OK: VM3 bloqueada"
fi

echo ""
echo "3. Testando acesso ao PostgreSQL..."
if timeout 3 bash -c "cat < /dev/null > /dev/tcp/10.12.40.60/5432" 2>/dev/null; then
  echo "❌ FALHA: VM2 consegue acessar PostgreSQL!"
  exit 1
else
  echo "✅ OK: PostgreSQL bloqueado"
fi

echo ""
echo "4. Testando acesso ao AGHUse DB..."
if timeout 3 bash -c "cat < /dev/null > /dev/tcp/10.12.40.219/5432" 2>/dev/null; then
  echo "❌ FALHA: VM2 consegue acessar AGHUse DB!"
  exit 1
else
  echo "✅ OK: AGHUse DB bloqueado"
fi

echo ""
echo "5. Testando acesso à internet (deve funcionar)..."
if ping -c 3 -W 2 8.8.8.8 > /dev/null 2>&1; then
  echo "✅ OK: Internet acessível"
else
  echo "❌ FALHA: Internet bloqueada (não deveria estar)!"
  exit 1
fi

echo ""
echo "========================================="
echo "✅ TODOS OS TESTES PASSARAM!"
echo "VM2 está corretamente isolada da intranet."
echo "========================================="
```

**Uso:**
```bash
# Copiar para VM2
scp test-isolation-vm2.sh usuario@vm2:/tmp/

# Executar em VM2
ssh usuario@vm2
chmod +x /tmp/test-isolation-vm2.sh
sudo /tmp/test-isolation-vm2.sh
```

---

## 📞 Suporte

Em caso de dúvidas sobre segurança:

1. Consultar [INFRAESTRUTURA-HMASP.md](INFRAESTRUTURA-HMASP.md)
2. Consultar [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
3. Contatar desenvolvedor: centralderegulacaohmasp@gmail.com

---

**Última atualização**: Dezembro 2025
**Versão**: 1.0
**Status**: Arquitetura de Segurança com Isolamento de Rede
