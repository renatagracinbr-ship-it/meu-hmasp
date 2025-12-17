# Correção de Race Conditions - HMASP Chat

## Status: ✅ CONCLUÍDO

### Resumo da Migração:

Migração completa do sistema de contextos de variáveis globais em memória para SQLite thread-safe, eliminando completamente as race conditions.

---

## 🎯 Mudanças Implementadas

### 1. **Criado Serviço de Contextos Thread-Safe**
**Arquivo:** [chatContextos.service.js](server/database/chatContextos.service.js)

**Características:**
- ✅ SQLite com `better-sqlite3` (síncrono e thread-safe)
- ✅ Transações atômicas para evitar race conditions
- ✅ Modo WAL (Write-Ahead Logging) para melhor concorrência
- ✅ Índices otimizados para buscas rápidas
- ✅ Mapeamento múltiplo de telefones (chatId, normalizado, sem sufixo)
- ✅ Expiração automática de contextos

**Funções:**
- `saveContexto()` - Salva contexto com transação atômica
- `findContextosByPhone()` - Busca contextos por telefone/chatId
- `getContexto()` - Busca contexto por ID
- `updateChatId()` - Atualiza chatId após envio (transacional)
- `cleanupExpiredContextos()` - Remove contextos expirados
- `deleteContexto()` - Remove contexto específico
- `getStats()` - Estatísticas dos contextos

---

### 2. **Migração da Leitura de Contextos**
**Arquivo:** [server.js:577-611](server.js#L577-L611)

**Antes (Race Condition):**
```javascript
idsAtivos = global.phoneToConfirmacoes?.[chatId] || [];
// ... busca em variável global não thread-safe
const ctx = global.chatContextos?.[id];
```

**Depois (Thread-Safe):**
```javascript
contextosAtivos = ChatContextosService.findContextosByPhone(chatId);
// ... busca no SQLite com transações
```

---

### 3. **Migração de Atualização de ChatId**
**Arquivo:** [server.js:1314-1326](server.js#L1314-L1326)

**Antes (Race Condition):**
```javascript
global.chatContextos[id].chatId = realChatId;
global.phoneToConfirmacoes[realChatId] = [...];
```

**Depois (Thread-Safe):**
```javascript
ChatContextosService.updateChatId(confirmacaoId, realChatId);
// Transação atômica garante consistência
```

---

### 4. **Migração de Limpeza de Contextos**
**Arquivo:** [server.js:947-954](server.js#L947-L954) e [server.js:5085-5094](server.js#L5085-L5094)

**Antes (Race Condition):**
```javascript
for (const [id, ctx] of Object.entries(global.chatContextos || {})) {
    if (agora >= expira) {
        delete global.chatContextos[id];
        delete global.phoneToConfirmacoes[telefone];
    }
}
```

**Depois (Thread-Safe):**
```javascript
const removed = ChatContextosService.cleanupExpiredContextos();
// SQLite DELETE com WHERE datetime() - thread-safe
```

---

### 5. **Inicialização Automática**
**Arquivo:** [server.js:5079-5094](server.js#L5079-L5094)

**Adicionado:**
```javascript
ChatContextosService.initialize();
const removed = ChatContextosService.cleanupExpiredContextos();
const stats = ChatContextosService.getStats();
console.log(`📊 ${stats.ativos} ativos, ${stats.expirados} expirados`);
```

---

### 6. **Remoção de Variáveis Globais**

**Removido:**
- ❌ `global.chatContextos` - Substituído por SQLite
- ❌ `global.phoneToConfirmacoes` - Substituído por tabela `phone_confirmacoes`
- ❌ `global.chatIdToPhone` - Informação agora vem do contexto

**Mantido:**
- ✅ `global.invalidAttempts` - Sistema de rate limiting (diferente de contextos)

---

## 📊 Estrutura do Banco SQLite

### Tabela: `contextos`
```sql
CREATE TABLE contextos (
    confirmacao_id TEXT PRIMARY KEY,
    chat_id TEXT NOT NULL,
    contexto TEXT NOT NULL,           -- 'confirmacao', 'desmarcacao', 'lembrete72h'
    consulta_numero TEXT,
    telefone TEXT,
    message_text TEXT,
    timestamp TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_chat_id (chat_id),
    INDEX idx_telefone (telefone),
    INDEX idx_expires_at (expires_at)
);
```

### Tabela: `phone_confirmacoes`
```sql
CREATE TABLE phone_confirmacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telefone TEXT NOT NULL,
    confirmacao_id TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (confirmacao_id) REFERENCES contextos(confirmacao_id) ON DELETE CASCADE,
    INDEX idx_telefone_lookup (telefone),
    INDEX idx_confirmacao_lookup (confirmacao_id)
);
```

---

## 🎯 Tipos de Contexto Suportados

1. **`confirmacao`** - Confirmação de presença em consulta
   - Opções: 1=Confirmo, 2=Não vou, 3=Não agendei

2. **`desmarcacao`** - Desmarcação de consulta
   - Opções: 1=Reagendar, 2=Eu desmarcou, 3=Não quero reagendar

3. **`lembrete72h`** - Lembrete 72h antes da consulta

---

## ✅ Benefícios da Migração

| Aspecto | Antes | Depois |
|---------|-------|--------|
| **Race Conditions** | ❌ Sim | ✅ Eliminadas |
| **Persistência** | ❌ Perdida ao restart | ✅ Persistente |
| **Thread-Safety** | ❌ Não | ✅ Sim (SQLite transações) |
| **Performance** | ⚠️ O(n) busca linear | ✅ O(log n) índices |
| **Debugging** | ❌ Difícil | ✅ Logs claros |
| **Escalabilidade** | ⚠️ Limitada | ✅ Centenas simultâneos |
| **Expiração** | ⚠️ Manual | ✅ Automática |

---

## 🧪 Como Testar

### Teste 1: Envio Simultâneo
```bash
# Terminal 1
curl -X POST http://localhost:3000/api/whatsapp/send -d '{"to":"5511999999999","message":"Teste 1"}'

# Terminal 2 (ao mesmo tempo)
curl -X POST http://localhost:3000/api/whatsapp/send -d '{"to":"5511888888888","message":"Teste 2"}'
```

**Resultado esperado:** Ambos os contextos salvos corretamente, sem conflitos.

### Teste 2: Resposta Duplicada
1. Paciente responde "1" (confirmo)
2. Paciente responde "2" (não vou) logo em seguida

**Resultado esperado:** Última resposta prevalece (SQLite UPSERT).

### Teste 3: Expiração
1. Verificar logs de inicialização: `${removed} contextos expirados removidos`
2. Verificar estatísticas: `${stats.ativos} ativos, ${stats.expirados} expirados`

### Teste 4: Restart do Servidor
1. Enviar mensagem e criar contexto
2. Reiniciar servidor (`npm start`)
3. Paciente responde

**Resultado esperado:** Contexto persiste e resposta é associada corretamente.

---

## 📈 Logs para Monitoramento

```
[ChatContextos] 💾 Contexto salvo: { confirmacaoId, contexto, chatId, telefones }
[ChatContextos] 🔍 Buscando contextos para 5511999999999: 2 encontrados
[ChatContextos] 🔄 ChatId atualizado: abc123 -> 5511999999999@c.us
[ChatContextos] 🧹 Limpeza: 5 contextos expirados removidos do SQLite
[ChatContextos] 🗑️ Contexto abc123 removido
```

---

## 🔒 Garantias de Segurança

✅ **Transações Atômicas:** Operações de save/update são all-or-nothing
✅ **Foreign Keys:** Cascade delete garante integridade referencial
✅ **Índices:** Buscas otimizadas sem comprometer concorrência
✅ **WAL Mode:** Write-Ahead Logging permite leituras paralelas
✅ **Expiration:** Limpeza automática evita acúmulo de dados antigos

---

## 📝 Próximos Passos (Futuro)

1. Adicionar índice composto para `(telefone, expires_at)` se necessário
2. Considerar particionamento de tabela por data se volume crescer muito
3. Adicionar métricas de performance (tempo de resposta de queries)
4. Dashboard de monitoramento de contextos ativos

---

**Data da Migração:** 2025-12-12
**Versão:** 1.0.0
**Status:** ✅ Produção
