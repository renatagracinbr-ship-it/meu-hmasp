# INSTRUÇÕES: Página Admin - Envio Automático de Mensagens

**Data de criação:** 2025-12-14
**Propósito:** Criar uma página Admin dedicada que será a ÚNICA responsável pelo envio automático de mensagens WhatsApp

---

## 📋 CONTEXTO

### Problema a Resolver
- O sistema possui monitoramento de consultas que detecta novas consultas do AGHUse
- Atualmente, o envio de mensagens é 100% manual (operador precisa clicar "Enviar Mensagem")
- Queremos que as mensagens sejam enviadas automaticamente, mas sem duplicação

### Solução
- Criar uma página/janela especial chamada **"Admin"**
- Essa janela ficará aberta na VM onde o sistema está hospedado
- Será a **ÚNICA** janela que envia mensagens automaticamente
- Outras janelas (operadores) continuam sem envio automático

### Arquitetura
```
┌─────────────────────────────────────────┐
│  VM (Servidor)                           │
│  ┌─────────────────────────────────┐    │
│  │ JANELA ADMIN (única)            │    │
│  │ ✅ Envio automático ATIVADO     │    │
│  │ → Notificações iniciais         │    │
│  │ → Lembretes 72h                 │    │
│  │ → Reagendamentos                │    │
│  │ → Desmarcações                  │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Operadores AGHUse (múltiplas janelas)   │
│  ❌ Envio automático DESATIVADO         │
│  → Apenas visualização                   │
│  → Operações manuais                     │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│  Backend (server.js)                     │
│  ✅ Respostas automáticas (sempre)      │
│  → Quando paciente responde 1, 2, 3     │
│  → Sem duplicação                        │
└─────────────────────────────────────────┘
```

---

## 🎯 REQUISITOS DA PÁGINA ADMIN

### 1. Arquivo HTML
- **Nome:** `admin.html`
- **Localização:** Raiz do projeto (mesmo nível do `index.html`)
- **Base:** Copiar do `index.html` existente

### 2. Diferenças em Relação ao `index.html`

#### A) Título da Página
```html
<title>HMASP - Admin (Envio Automático)</title>
```

#### B) Indicador Visual
Adicionar um banner/indicador na página para identificar que é a página Admin:
```html
<!-- Logo após <body>, antes do conteúdo principal -->
<div style="background: #ff6b6b; color: white; padding: 10px; text-align: center; font-weight: bold;">
    🤖 MODO ADMIN - ENVIO AUTOMÁTICO ATIVADO
</div>
```

#### C) Modificação no JavaScript
**Arquivo a modificar:** O código JS que é incluído (pode ser inline ou externo)

**Localização da mudança:** `src/components/confirmacaoPresenca.js`

**Função a modificar:** `handleNewConfirmations`

**Linha aproximada:** 841

**MUDANÇA ESPECÍFICA:**

**ANTES (index.html - operadores):**
```javascript
// ✅ ENVIO MANUAL APENAS - Interface Admin será configurada futuramente
console.log('[Confirmação] ⏸️ Envio manual - aguardando operador clicar em "Enviar Mensagem"');
Toast.info('Novas consultas', `${msg}. Clique em "Enviar Mensagem" para notificar os pacientes.`, 5000);
```

**DEPOIS (admin.html - envio automático):**
```javascript
// ✅ ENVIO AUTOMÁTICO ATIVADO - Página Admin
console.log('[Confirmação] 🤖 Modo Admin - enviando mensagens automaticamente');
Toast.success('Novas consultas', `${msg}. Enviando mensagens automaticamente...`, 5000);
await autoSendMessages(reallyNew);
```

### 3. Como Implementar a Diferença

**Opção 1: Arquivo JS Separado (RECOMENDADO)**
1. Criar `src/main-admin.js` (cópia de `src/main.js`)
2. No `admin.html`, importar `main-admin.js` ao invés de `main.js`
3. Modificar apenas a função `handleNewConfirmations` no `main-admin.js`

**Opção 2: Flag Global**
1. No `admin.html`, definir uma flag antes de importar os scripts:
```html
<script>
    window.IS_ADMIN_MODE = true;
</script>
<script type="module" src="src/main.js"></script>
```
2. No `confirmacaoPresenca.js`, verificar a flag:
```javascript
if (window.IS_ADMIN_MODE) {
    await autoSendMessages(reallyNew);
} else {
    Toast.info('Novas consultas', `${msg}. Clique em "Enviar Mensagem"...`, 5000);
}
```

---

## 📝 PASSO A PASSO PARA CRIAR A PÁGINA ADMIN

### Passo 1: Criar o arquivo HTML
```bash
cp index.html admin.html
```

### Passo 2: Modificar o título
Abrir `admin.html` e alterar:
```html
<title>HMASP - Admin (Envio Automático)</title>
```

### Passo 3: Adicionar banner de identificação
Logo após `<body>`:
```html
<div id="admin-banner" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px; text-align: center; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.2); z-index: 9999; position: relative;">
    🤖 MODO ADMINISTRADOR - ENVIO AUTOMÁTICO DE MENSAGENS ATIVADO
</div>
```

### Passo 4: Implementar flag de modo admin

**Em `admin.html`, antes de importar os scripts:**
```html
<script>
    // Define modo admin ANTES de carregar os módulos
    window.IS_ADMIN_MODE = true;
    console.log('🤖 [ADMIN] Modo administrador ativado - Envio automático de mensagens habilitado');
</script>
<script type="module" src="src/main.js"></script>
```

### Passo 5: Modificar confirmacaoPresenca.js

**Arquivo:** `src/components/confirmacaoPresenca.js`

**Localizar a função `handleNewConfirmations` (linha ~841)**

**Substituir o bloco:**
```javascript
// ✅ ENVIO MANUAL APENAS - Interface Admin será configurada futuramente
console.log('[Confirmação] ⏸️ Envio manual - aguardando operador clicar em "Enviar Mensagem"');
Toast.info('Novas consultas', `${msg}. Clique em "Enviar Mensagem" para notificar os pacientes.`, 5000);
```

**Por:**
```javascript
// Verifica se está em modo admin
if (window.IS_ADMIN_MODE) {
    // ✅ ENVIO AUTOMÁTICO - Modo Admin
    console.log('[Confirmação] 🤖 MODO ADMIN - Enviando mensagens automaticamente');
    Toast.success('Admin: Envio automático', `${msg}. Enviando automaticamente...`, 5000);

    // Envia mensagens automaticamente
    await autoSendMessages(reallyNew);
} else {
    // ✅ ENVIO MANUAL - Modo Operador
    console.log('[Confirmação] ⏸️ Envio manual - aguardando operador clicar em "Enviar Mensagem"');
    Toast.info('Novas consultas', `${msg}. Clique em "Enviar Mensagem" para notificar os pacientes.`, 5000);
}
```

---

## 🔒 PROTEÇÕES E VALIDAÇÕES

### 1. Evitar Múltiplas Páginas Admin Abertas
Adicionar no `admin.html`, logo após definir `IS_ADMIN_MODE`:

```html
<script>
    // Proteção: Apenas uma instância Admin ativa
    const ADMIN_LOCK_KEY = 'hmasp_admin_lock';
    const ADMIN_HEARTBEAT_KEY = 'hmasp_admin_heartbeat';

    function checkAdminLock() {
        const lock = localStorage.getItem(ADMIN_LOCK_KEY);
        const heartbeat = localStorage.getItem(ADMIN_HEARTBEAT_KEY);
        const now = Date.now();

        // Se existe lock ativo (heartbeat recente)
        if (lock && heartbeat && (now - parseInt(heartbeat)) < 10000) {
            alert('⚠️ ATENÇÃO: Já existe uma página Admin ativa!\n\nFeche a outra janela Admin antes de abrir uma nova.\n\nEsta página será fechada automaticamente.');
            window.close();
            return false;
        }

        return true;
    }

    function setAdminLock() {
        localStorage.setItem(ADMIN_LOCK_KEY, 'active');
        localStorage.setItem(ADMIN_HEARTBEAT_KEY, Date.now().toString());

        // Atualiza heartbeat a cada 5 segundos
        setInterval(() => {
            localStorage.setItem(ADMIN_HEARTBEAT_KEY, Date.now().toString());
        }, 5000);
    }

    function removeAdminLock() {
        localStorage.removeItem(ADMIN_LOCK_KEY);
        localStorage.removeItem(ADMIN_HEARTBEAT_KEY);
    }

    // Verifica e ativa lock
    if (checkAdminLock()) {
        setAdminLock();

        // Remove lock ao fechar
        window.addEventListener('beforeunload', removeAdminLock);
    }
</script>
```

### 2. Indicador Visual no Título
Fazer o título piscar para identificar facilmente a janela Admin:

```html
<script>
    // Pisca o título para identificar Admin
    let titleOriginal = '🤖 ADMIN - Envio Automático';
    let titleBlink = '⚡ ADMIN ATIVO ⚡';
    let showBlink = false;

    setInterval(() => {
        document.title = showBlink ? titleBlink : titleOriginal;
        showBlink = !showBlink;
    }, 1000);
</script>
```

---

## 🧪 TESTES E VALIDAÇÃO

### Teste 1: Verificar Modo Admin Ativo
1. Abrir `admin.html`
2. Abrir console (F12)
3. Verificar log: `🤖 [ADMIN] Modo administrador ativado`
4. Verificar banner roxo no topo da página

### Teste 2: Verificar Envio Automático
1. Com `admin.html` aberto
2. Marcar uma consulta no AGHUse
3. Aguardar até 30 segundos (intervalo de monitoramento)
4. Verificar no console: `🤖 MODO ADMIN - Enviando mensagens automaticamente`
5. Verificar no WhatsApp se mensagem foi enviada

### Teste 3: Verificar Modo Operador
1. Abrir `index.html` (normal)
2. Marcar uma consulta no AGHUse
3. Verificar que mensagem NÃO é enviada automaticamente
4. Verificar botão "Enviar Mensagem" está disponível

### Teste 4: Proteção Contra Múltiplas Admins
1. Abrir `admin.html` na aba 1
2. Tentar abrir `admin.html` na aba 2
3. Verificar alerta de bloqueio
4. Aba 2 deve fechar automaticamente

---

## 📁 ESTRUTURA DE ARQUIVOS

```
HMASPChat/
├── index.html                    # Página normal (operadores)
├── admin.html                    # 🆕 Página Admin (envio automático)
├── ADMIN-AUTO-SEND.md           # 📄 Este documento
├── src/
│   ├── main.js                  # Script principal
│   └── components/
│       └── confirmacaoPresenca.js  # ⚠️ MODIFICADO (adicionar flag)
└── server.js                     # Backend (respostas automáticas)
```

---

## ⚠️ AVISOS IMPORTANTES

1. **NÃO duplicar templates de mensagens**
   - Todos os templates estão no banco de dados
   - Fonte única de verdade: `server/database/mensagens-whatsapp.db`

2. **NÃO modificar a lógica de envio**
   - A função `autoSendMessages()` já existe e funciona
   - Apenas ativar/desativar com a flag `IS_ADMIN_MODE`

3. **NÃO criar múltiplas páginas admin**
   - Sempre ter apenas UMA instância de `admin.html` aberta
   - Usar a proteção de lock para evitar duplicação

4. **Backend não muda**
   - Respostas automáticas continuam no `server.js`
   - Não mexer no event listener `whatsappClient.on('message')`

---

## 🔄 MANUTENÇÃO FUTURA

### Para Deletar e Recriar a Página Admin

1. **Deletar:**
   ```bash
   rm admin.html
   ```

2. **Recriar:**
   - Seguir os passos em "PASSO A PASSO PARA CRIAR A PÁGINA ADMIN"
   - Garantir que a flag `IS_ADMIN_MODE` está definida
   - Testar com os passos de validação

### Para Modificar Templates
- Não mexer no `admin.html`
- Editar apenas no banco de dados via interface ou SQL
- Templates são compartilhados entre admin e operadores

---

## ✅ CHECKLIST DE CRIAÇÃO

- [ ] Arquivo `admin.html` criado
- [ ] Título alterado para "HMASP - Admin (Envio Automático)"
- [ ] Banner de identificação adicionado
- [ ] Flag `window.IS_ADMIN_MODE = true` definida
- [ ] Função `handleNewConfirmations` modificada com verificação de flag
- [ ] Proteção contra múltiplas instâncias implementada
- [ ] Título piscante configurado
- [ ] Testado: envio automático funcionando
- [ ] Testado: operadores continuam manual
- [ ] Testado: proteção de lock funcionando

---

**FIM DO DOCUMENTO**
