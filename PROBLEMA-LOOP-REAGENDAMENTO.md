# 🚨 PROBLEMA CRÍTICO: Loop Infinito de Mensagens no Reagendamento

## ⚠️ Problema Identificado

### Cenário Atual (ERRADO):

```
1. Consulta desmarcada no AGHUse
2. Sistema envia DESMARCACAO_NOTIFICACAO (com 3 opções)
3. Paciente responde "1 - Solicito reagendamento"
4. Sistema registra pedido de reagendamento
5. Operador marca nova consulta no AGHUse
6. Sistema detecta reagendamento vinculado
7. 🔴 Sistema envia MARCACAO_CONFIRMACAO (com 3 opções novamente!)
   ├── "1 - Confirmo presença"
   ├── "2 - Não poderei comparecer" ← 💣 PERIGO!
   └── "3 - Não agendei essa consulta"
8. Se paciente clicar "2 - Não poderei" → Badge DESMARCAR
9. Operador desmarca novamente...
10. Sistema envia DESMARCACAO_NOTIFICACAO novamente...
11. 🔁 LOOP INFINITO!
```

---

## 🎯 Código Problemático

### badgeManager.service.js - linha 308-334

```javascript
export async function processOperatorReagendamento(consultaOriginalId, novaConsulta, telefone) {
    console.log(`[BadgeManager] Reagendamento: ${consultaOriginalId} → Nova consulta ${novaConsulta.consultaNumero}`);

    try {
        // 🔴 PROBLEMA: Usa template MARCACAO_CONFIRMACAO
        // Isso envia novamente as 3 opções, incluindo "Não poderei comparecer"
        const mensagem = WhatsAppTemplates.generateMessage('marcacao_confirmacao', {
            nomePaciente: novaConsulta.nomePaciente,
            especialidade: novaConsulta.especialidade,
            dataHora: novaConsulta.dataHoraFormatada,
            medico: novaConsulta.profissional
        });

        // Envia via fila
        await WhatsAppQueue.addToQueue({
            chatId,
            texto: mensagem.texto,
            botoes: mensagem.botoes,  // ← 🔴 Envia botões novamente!
            metadata: {
                type: 'reagendamento_confirmacao',
                consultaOriginalId,
                novaConsultaId: novaConsulta.consultaNumero,
                telefone
            }
        });
        // ...
    }
}
```

---

## ✅ Solução: Novo Template "REAGENDAMENTO_CONFIRMACAO"

### 1. Criar Novo Template (whatsappTemplates.service.js)

```javascript
export const TEMPLATES = {
    // ... templates existentes ...

    /**
     * Template 7: Confirmação de Reagendamento
     * Categoria: UTILITY
     *
     * IMPORTANTE: SEM botões de resposta!
     * Motivo: Evitar loop infinito de desmarcações/reagendamentos
     * Apenas informa que a consulta foi reagendada conforme solicitado
     */
    REAGENDAMENTO_CONFIRMACAO: {
        id: 'reagendamento_confirmacao',
        categoria: 'UTILITY',
        idioma: 'pt_BR',
        texto: (nomeCompleto, especialidade, dataHora, medico) => {
            const partes = dataHora.split(' ');
            const data = partes[0];
            const hora = partes[1];

            return `Olá, *${nomeCompleto}*.\nAqui é a Central de Marcação de Consultas do HMASP.\n\n` +
                   `✅ *Sua consulta foi reagendada!*\n\n` +
                   `Conforme solicitado, sua consulta foi reagendada para:\n\n` +
                   `📋 *Detalhes da Nova Consulta:*\n` +
                   `• Especialidade: *${especialidade}*\n` +
                   `• Data: *${data}*\n` +
                   `• Horário: *${hora}h*\n` +
                   `• Profissional: Dr(a) *${medico}*\n\n` +
                   `Por favor, compareça com 15 minutos de antecedência.\n\n` +
                   `Em caso de imprevistos, entre em contato com a Central de Marcação de Consultas.\n\n` +
                   `_HMASP - Central de Marcação de Consultas_`;
        },
        botoes: []  // ← 🔑 SEM BOTÕES! Apenas informativo
    }
};
```

### 2. Atualizar badgeManager.service.js

```javascript
export async function processOperatorReagendamento(consultaOriginalId, novaConsulta, telefone) {
    console.log(`[BadgeManager] Reagendamento: ${consultaOriginalId} → Nova consulta ${novaConsulta.consultaNumero}`);

    try {
        // ✅ CORRIGIDO: Usa template REAGENDAMENTO_CONFIRMACAO (sem botões)
        const mensagem = WhatsAppTemplates.generateMessage('reagendamento_confirmacao', {
            nomePaciente: novaConsulta.nomePaciente,
            especialidade: novaConsulta.especialidade,
            dataHora: novaConsulta.dataHoraFormatada,
            medico: novaConsulta.profissional
        });

        // Formata chatId
        const chatId = WhatsAppTemplates.formatWhatsAppChatId(telefone);

        // Envia via fila
        await WhatsAppQueue.addToQueue({
            chatId,
            texto: mensagem.texto,
            botoes: mensagem.botoes,  // ← ✅ Agora é array vazio []
            metadata: {
                type: 'reagendamento_confirmacao',
                consultaOriginalId,
                novaConsultaId: novaConsulta.consultaNumero,
                telefone
            }
        });

        console.log(`[BadgeManager] ✅ Mensagem de reagendamento (SEM botões) enviada para ${telefone}`);

        return {
            success: true,
            consultaOriginalId,
            novaConsultaId: novaConsulta.consultaNumero,
            newBadge: BADGES.REAGENDADA,
            messageSent: true,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('[BadgeManager] Erro ao processar reagendamento:', error);

        return {
            success: false,
            error: error.message,
            consultaOriginalId,
            novaConsultaId: novaConsulta.consultaNumero
        };
    }
}
```

---

## 🔄 Fluxo Corrigido

### ✅ Cenário CORRETO (Com Novo Template):

```
1. Consulta desmarcada no AGHUse
2. Sistema envia DESMARCACAO_NOTIFICACAO (com 3 opções)
3. Paciente responde "1 - Solicito reagendamento"
4. Sistema registra pedido de reagendamento
5. Operador marca nova consulta no AGHUse
6. Sistema detecta reagendamento vinculado
7. ✅ Sistema envia REAGENDAMENTO_CONFIRMACAO (SEM botões!)
   └── Mensagem apenas informativa
8. ✅ Paciente NÃO pode responder com botões
9. ✅ Não gera loop infinito
10. ✅ Fluxo encerrado com sucesso
```

---

## 📊 Comparação: Antes vs Depois

| Aspecto | ANTES (MARCACAO_CONFIRMACAO) | DEPOIS (REAGENDAMENTO_CONFIRMACAO) |
|---------|------------------------------|-------------------------------------|
| **Botões** | ✅ 3 botões (Confirmo / Não poderei / Não agendei) | ❌ SEM botões |
| **Risco de Loop** | 🔴 ALTO - paciente pode clicar "Não poderei" | ✅ ZERO - mensagem apenas informativa |
| **Contexto** | ⚠️ Genérico (para qualquer marcação) | ✅ Específico (reagendamento solicitado) |
| **Tom** | Neutro | Confirmativo ("conforme solicitado") |
| **Call-to-Action** | "Confirme sua presença" | "Compareça com 15min antecedência" |

---

## 🎨 Exemplo de Mensagem

### ANTES (Problemático):
```
Olá, João Silva.
Aqui é a Central de Marcação de Consultas do HMASP.

📋 Detalhes da Consulta:
• Especialidade: Endocrinologia
• Data: 20/12/2025
• Horário: 14:00h
• Profissional: Dr(a) Maria Santos

Por gentileza, confirme sua presença respondendo com o número:

1 - ✅ Confirmo presença
2 - ❌ Não poderei comparecer  ← 💣 PERIGO!
3 - ⚠️ Não agendei essa consulta
```

### DEPOIS (Correto):
```
Olá, João Silva.
Aqui é a Central de Marcação de Consultas do HMASP.

✅ Sua consulta foi reagendada!

Conforme solicitado, sua consulta foi reagendada para:

📋 Detalhes da Nova Consulta:
• Especialidade: Endocrinologia
• Data: 20/12/2025
• Horário: 14:00h
• Profissional: Dr(a) Maria Santos

Por favor, compareça com 15 minutos de antecedência.

Em caso de imprevistos, entre em contato com a Central de Marcação de Consultas.

_HMASP - Central de Marcação de Consultas_
```

---

## 🛡️ Proteções Adicionais Sugeridas

### 1. Marcar Consulta Reagendada no Contexto

```javascript
// conversationContext.service.js
export function markConsultaAsReagendamento(telefone, consultaId) {
    const context = getContext(telefone);
    if (context) {
        context.consultasReagendadas = context.consultasReagendadas || [];
        context.consultasReagendadas.push({
            consultaId,
            timestamp: new Date().toISOString()
        });
    }
}
```

### 2. Validar Antes de Criar Badge DESMARCAR

```javascript
// badgeManager.service.js - processConfirmacaoResponse()
case 'declined':
    // Verificar se é reagendamento recente
    const isReagendamento = ConversationContext.isRecentReagendamento(
        telefone,
        confirmation.consultaNumero
    );

    if (isReagendamento) {
        console.warn(`[Badge] ⚠️ Consulta ${confirmation.consultaNumero} é reagendamento recente, não criar badge DESMARCAR`);
        // Não criar badge, apenas registrar
        result.newStatus = 'declined_reagendamento';
        result.badge = null;  // Sem badge
    } else {
        // Fluxo normal
        result.badge = BADGES.DESMARCAR;
    }
    break;
```

---

## ✅ Checklist de Implementação

### Prioridade CRÍTICA (Evitar Loop):
- [ ] Criar template `REAGENDAMENTO_CONFIRMACAO` sem botões
- [ ] Modificar `processOperatorReagendamento()` para usar novo template
- [ ] Testar fluxo completo: desmarcação → reagendamento → confirmação
- [ ] Verificar que NÃO aparecem botões na mensagem de reagendamento

### Prioridade ALTA (Proteção Adicional):
- [ ] Adicionar `markConsultaAsReagendamento()` em conversationContext
- [ ] Modificar `processConfirmacaoResponse()` para validar reagendamentos
- [ ] Adicionar logs para rastrear reagendamentos

### Prioridade MÉDIA (Melhorias):
- [ ] Adicionar métricas de reagendamentos bem-sucedidos
- [ ] Criar dashboard de reagendamentos
- [ ] Documentar fluxo no README

---

## 🎓 Conclusão

**Sua observação está 100% CORRETA!**

O sistema atual tem um **risco ALTO de loop infinito** porque:
1. ❌ Envia `MARCACAO_CONFIRMACAO` após reagendamento
2. ❌ Essa mensagem tem botão "Não poderei comparecer"
3. ❌ Se paciente clicar, gera badge DESMARCAR
4. ❌ Operador desmarca → envia DESMARCACAO_NOTIFICACAO
5. ❌ Loop infinito!

**Solução:**
- ✅ Criar template `REAGENDAMENTO_CONFIRMACAO` SEM botões
- ✅ Apenas informativo, sem possibilidade de resposta
- ✅ Tom confirmativo ("conforme solicitado")

**Esforço:** ~1-2 horas
**Impacto:** CRÍTICO (evita loop infinito)
**Prioridade:** 🔴 URGENTE
