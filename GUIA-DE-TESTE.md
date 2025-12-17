# 🧪 GUIA DE TESTE - SISTEMA DE ID ÚNICO

## ⚡ TESTE RÁPIDO (5 minutos)

### 1. Preparação
```bash
# Inicie o servidor
npm run server
```

### 2. Teste Básico - Confirmar Presença

**Passo 1:** Marcar consulta no AGHUse
- Abra o AGHUse
- Marque uma consulta para qualquer paciente

**Passo 2:** Verificar logs do sistema
```
[Confirmação] ID único gerado: conf-12345-1733849845000-a1b2c3d4
[Confirmação] Novas consultas encontradas
```

**Passo 3:** Enviar mensagem
- Abra a interface admin
- Clique em "Enviar" na consulta
- Verifique logs:
```
[API] 💾 Contexto salvo: ID: conf-12345-...
[API] IDs ativos neste telefone: 1
```

**Passo 4:** Simular resposta do paciente
- Abra WhatsApp Web
- Responda "1" (confirmar presença)

**Passo 5:** Verificar logs de recebimento
```
[WhatsApp] 📨 MENSAGEM RECEBIDA de 5511999999999@c.us: 1
[WhatsApp] 🔍 IDs ativos para 5511999999999@c.us: ["conf-12345-..."]
[WhatsApp] ✅ Contexto encontrado por TIMESTAMP MATCHING
[WhatsApp] 💾 Salvando resposta: { confirmacaoId: "conf-12345-..." }
```

**Passo 6:** Verificar interface
- Badge verde "✅ Confirmada" deve aparecer
- Status deve mudar para "confirmed"

**✅ SUCESSO:** ID único funcionando!

---

## 🔬 TESTE AVANÇADO (15 minutos)

### 3. Teste de Múltiplas Consultas

**Objetivo:** Verificar se o sistema identifica a consulta correta quando paciente tem 2+ consultas

**Passo 1:** Marcar 2 consultas para o **mesmo paciente**
- Consulta A: Cardiologia (14/12 10:00)
- Consulta B: Dermatologia (15/12 14:00)

**Passo 2:** Enviar ambas mensagens
- Enviar mensagem da Consulta A
- **AGUARDAR 30 segundos** (importante!)
- Enviar mensagem da Consulta B

**Passo 3:** Verificar logs
```
[API] IDs ativos neste telefone: 2
[WhatsApp] 🔍 IDs ativos para telefone: [
  "conf-12345-1733849845000-a1b2c3d4",
  "conf-67890-1733850000000-e5f6g7h8"
]
```

**Passo 4:** Paciente responde
- Responda "2" (não poderei ir)

**Passo 5:** Verificar matching de timestamp
```
[WhatsApp] 🔍 Comparando timestamps - ID: conf-67890-..., Diff: 2000ms
[WhatsApp] 🔍 Comparando timestamps - ID: conf-12345-..., Diff: 45000ms
[WhatsApp] ✅ Contexto encontrado por TIMESTAMP MATCHING: {
  id: "conf-67890-...",
  contexto: "confirmacao",
  consultaNumero: "67890",
  diferencaMs: 2000
}
```

**Passo 6:** Verificar interface
- **APENAS** a Consulta B deve ter badge vermelho "Desmarcar"
- Consulta A deve continuar "Pendente"

**✅ SUCESSO:** Sistema identificou consulta correta usando timestamp!

---

### 4. Teste de Validação Cruzada

**Objetivo:** Verificar se o sistema bloqueia classificação errada

**Passo 1:** Abra DevTools do navegador
- F12 → Console

**Passo 2:** Simule resposta com contexto errado
```javascript
// Pega uma confirmação existente
const conf = JSON.parse(localStorage.getItem('confirmations'))[0];

// Simula resposta de DESMARCAÇÃO para uma CONFIRMAÇÃO
fetch('http://localhost:3000/api/whatsapp/responses/mock', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    confirmacaoId: conf.id,
    contexto: 'desmarcacao', // ERRADO! Deveria ser 'confirmacao'
    status: 'reagendamento',
    timestamp: new Date().toISOString()
  })
});
```

**Passo 3:** Verificar logs
```
[Confirmação] ❌ ERRO DE SEGURANÇA: Contexto não corresponde!
{
  esperado: 'confirmacao',
  recebido: 'desmarcacao',
  confirmacaoId: 'conf-12345-...'
}
```

**Passo 4:** Verificar interface
- Toast de ERRO deve aparecer
- Status NÃO deve ser atualizado
- Console mostra erro de segurança

**✅ SUCESSO:** Validação cruzada bloqueou atualização indevida!

---

### 5. Teste de Desmarcação

**Passo 1:** Desmarcar consulta no AGHUse
- Acesse uma consulta marcada
- Clique em "Desmarcar"

**Passo 2:** Verificar logs
```
[Desmarcação] ID único gerado: desm-12345-1733849845000-a1b2c3d4
[Desmarcação] Novas consultas desmarcadas: 1
```

**Passo 3:** Enviar mensagem
- Aba "Desmarcação"
- Clique em "Enviar"

**Passo 4:** Paciente responde
- Responda "1" (quero reagendar)

**Passo 5:** Verificar logs
```
[WhatsApp] ✅ Contexto encontrado por TIMESTAMP MATCHING: {
  id: "desm-12345-...",
  contexto: "desmarcacao"
}
[Desmarcação] ✅ Status atualizado: { statusNovo: "reagendamento" }
```

**Passo 6:** Verificar interface
- Badge azul "Reagendar" deve aparecer

**✅ SUCESSO:** Desmarcação com ID único funcionando!

---

## 🐛 RESOLUÇÃO DE PROBLEMAS

### Problema 1: "Resposta sem ID único, usando método legado"

**Causa:** Resposta antiga (antes da implementação) ou erro no backend

**Solução:**
1. Verificar se UUID está instalado: `npm list uuid`
2. Verificar se backend está gerando IDs: buscar "ID único gerado" nos logs
3. Limpar respostas antigas: `localStorage.clear()` no navegador

---

### Problema 2: "Nenhum ID ativo para este telefone"

**Causa:** Contexto expirou (24h) ou foi limpo

**Solução:**
1. Reenviar mensagem
2. Verificar se contexto foi salvo: buscar "Contexto salvo: ID:" nos logs
3. Verificar estrutura global:
   ```javascript
   console.log(global.chatContextos);
   console.log(global.phoneToConfirmacoes);
   ```

---

### Problema 3: "Nenhum contexto válido encontrado por timestamp"

**Causa:** Diferença de timestamp > 5 minutos

**Solução:**
1. Verificar se mensagem foi enviada recentemente
2. Aumentar tolerância de tempo (se necessário):
   - server.js linha ~489: `menorDiferenca < 300000` (5 min)
   - Aumentar para 600000 (10 min) se necessário

---

### Problema 4: Badge não aparece

**Causa:** Frontend não está recebendo `confirmacaoId`

**Solução:**
1. Verificar logs do frontend:
   ```
   [Confirmação] 📱 Processando resposta: { confirmacaoId: "..." }
   ```
2. Verificar se resposta tem `confirmacaoId`:
   ```javascript
   fetch('http://localhost:3000/api/whatsapp/responses')
     .then(r => r.json())
     .then(console.log);
   ```
3. Verificar se confirmação existe com esse ID:
   ```javascript
   const confirmations = JSON.parse(localStorage.getItem('confirmations'));
   console.log(confirmations.find(c => c.id === 'conf-...'));
   ```

---

## 📊 LOGS IMPORTANTES

### ✅ Logs de Sucesso

**Backend - Geração de ID:**
```
[Confirmação] ID único gerado: conf-12345-1733849845000-a1b2c3d4
```

**Backend - Salvamento:**
```
[API] 💾 Contexto salvo: ID: conf-12345-...
[API] IDs ativos neste telefone: 1
```

**Backend - Recebimento:**
```
[WhatsApp] ✅ Contexto encontrado por TIMESTAMP MATCHING
[WhatsApp] 💾 Salvando resposta: { confirmacaoId: "conf-..." }
```

**Frontend - Processamento:**
```
[Confirmação] 📱 Processando resposta: { confirmacaoId: "conf-..." }
[Confirmação] ✅ Status atualizado: { paciente: "...", statusNovo: "confirmed" }
```

---

### ⚠️ Logs de Atenção

**Método Legado (não é erro, mas menos seguro):**
```
[WhatsApp] ⚠️ Resposta sem ID único, usando método legado (telefone)
[Confirmação] ⚠️ Resposta sem ID único, usando método legado
```

**Contexto Expirado:**
```
[WhatsApp] ⏰ ID conf-... expirado, ignorando
```

---

### ❌ Logs de Erro

**Erro de Segurança (CRÍTICO):**
```
[Confirmação] ❌ ERRO DE SEGURANÇA: Contexto não corresponde!
```

**ID Não Encontrado:**
```
[Confirmação] ❌ ERRO: Confirmação não existe no state!
```

**Status Inválido:**
```
[Confirmação] ❌ ERRO: Status inválido: xyz
```

---

## 🎯 CHECKLIST DE TESTE

### Teste Básico
- [ ] Consulta marcada aparece na interface
- [ ] ID único gerado nos logs
- [ ] Mensagem enviada com sucesso
- [ ] Contexto salvo no backend
- [ ] Paciente responde
- [ ] Resposta identificada pelo ID correto
- [ ] Badge aparece na interface
- [ ] Status atualizado corretamente

### Teste Avançado
- [ ] Múltiplas consultas para mesmo paciente
- [ ] Timestamp matching funciona
- [ ] Apenas consulta correta é atualizada
- [ ] Validação cruzada bloqueia contexto errado
- [ ] Validação de status funciona
- [ ] Desmarcação com ID único funciona
- [ ] Método legado ainda funciona (fallback)

### Teste de Logs
- [ ] Logs estruturados e legíveis
- [ ] IDs aparecem em todos os logs críticos
- [ ] Erros são claros e acionáveis
- [ ] Warnings indicam uso de fallback

---

## 📞 SUPORTE

Se encontrar problemas não listados aqui:

1. **Capture os logs completos** (backend + frontend)
2. **Salve estado global:**
   ```javascript
   console.log('chatContextos:', global.chatContextos);
   console.log('phoneToConfirmacoes:', global.phoneToConfirmacoes);
   console.log('whatsappResponses:', global.whatsappResponses);
   ```
3. **Salve estado local:**
   ```javascript
   console.log('confirmations:', localStorage.getItem('confirmations'));
   console.log('desmarcacoes:', localStorage.getItem('desmarcacoes'));
   ```

---

**Versão:** 1.0.0
**Data:** 2024-12-10
