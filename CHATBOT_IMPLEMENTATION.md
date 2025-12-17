# Sistema de Chatbot - Central de Marcação HMASP

## 📋 Visão Geral

Sistema completo de chatbot para gerenciar confirmações de consultas e desmarcações via WhatsApp, com interpretação inteligente de respostas, prevenção de respostas cruzadas e integração com AGHUse.

## 🎯 Funcionalidades Principais

### 1. Confirmação de Presença (Aba Confirmação)
- Envio automático de mensagens de confirmação após marcação
- Lembrete 72h antes (mesma mensagem)
- Lembrete adicional se sem resposta (5 minutos após)
- 3 opções de resposta:
  - **1** - Confirmo presença → Card "Confirmados"
  - **2** - Não poderei comparecer → Card "Não poderá" + Badge VERMELHO "Desmarcar"
  - **3** - Não agendei essa consulta → Card "Não agendou"

### 2. Desmarcação de Consultas (Aba Desmarcação)
- Notificação automática quando consulta é desmarcada no AGHUse
- 3 opções de resposta:
  - **1** - Solicito reagendamento → Card "Solicitou Reagendamento" + Badge VERMELHO "Reagendar"
  - **2** - Fui eu quem solicitei → Card informativo
  - **3** - Não é necessário reagendar → Card informativo

### 3. Reagendamento Automático
- Quando operador cria nova consulta no AGHUse (janela de 24h)
- Sistema vincula automaticamente ao pedido de reagendamento
- Envia MARCACAO_CONFIRMACAO para nova consulta
- Badge muda de VERMELHO → VERDE "Reagendada"

### 4. Detecção Inteligente de Intenções
- **Prioridade 1**: Números diretos (1, 2, 3) - confidence 1.0
- **Prioridade 2**: Keywords (confirmo, sim, não, etc) - confidence 0.85-0.98
- **Prioridade 3**: NLP (padrões de linguagem) - confidence 0.55-0.75
- **Fallback**: Conversa livre ou baixa confiança

### 5. Prevenção de Respostas Cruzadas
- Última mensagem do sistema = fonte única de verdade
- Detecta múltiplas mensagens pendentes (ambiguidade)
- Reenvia mensagens uma a uma quando ambíguo
- Contexto por telefone armazenado em memória

### 6. Respostas Automáticas Humanizadas
- Typing delay de 3-6 segundos (aleatório)
- Variação de saudação ("Olá" ou "Oi")
- Fila com proteção anti-banimento (45-120s entre mensagens)
- Pausa de resfriamento a cada 20 mensagens (10-15 minutos)

## 🏗️ Arquitetura do Sistema

```
src/services/
├── intentClassifier.service.js       # Detecção de intenções (NLP + keywords)
├── conversationContext.service.js    # Gerenciamento de contexto por telefone
├── badgeManager.service.js           # Badges e transições de status
├── inboundMessageHandler.service.js  # Pipeline de processamento de mensagens
├── reminderScheduler.service.js      # Lembretes automáticos (72h e sem resposta)
├── reagendamentoLinker.service.js    # Vinculação de reagendamentos (24h)
├── chatAudit.service.js              # Logs e auditoria completa
├── whatsappTemplates.service.js      # Templates de mensagens
├── whatsappQueue.service.js          # Fila com anti-ban
├── confirmacao.service.js            # Serviço de confirmações
└── desmarcacao.service.js            # Serviço de desmarcações
```

## 📝 Templates de Mensagens

### MARCACAO_CONFIRMACAO (também usado para LEMBRETE_72H)
```
Olá, [Nome Paciente].
Aqui é a Central de Marcação de Consultas do HMASP.

📋 Detalhes da Consulta:
• Especialidade: [Especialidade]
• Data: [Data]
• Horário: [Hora]h
• Profissional: Dr(a) [Médico]

Por gentileza, confirme sua presença respondendo com o número:

1 - ✅ Confirmo presença
2 - ❌ Não poderei comparecer
3 - ⚠️ Não agendei essa consulta
```

### DESMARCACAO_NOTIFICACAO
```
Olá, [Nome Paciente].
Aqui é a Central de Marcação de Consultas do HMASP.

⚠️ Informativo de Desmarcação:

Informamos que sua consulta foi desmarcada em nosso sistema:

• Especialidade: [Especialidade]
• Data: [Data]
• Horário: [Hora]h
• Profissional: Dr(a) [Médico]

Motivo: Indisponibilidade do profissional ou solicitação do paciente.

Por favor, nos informe a situação para darmos o encaminhamento correto:

1 - 📅 Solicito reagendamento, pois preciso da consulta
2 - ✋ Fui eu (paciente) quem solicitei a desmarcação
3 - ❌ Não é necessário reagendar
```

### LEMBRETE_SEM_RESPOSTA
```
Olá, [Nome Paciente]. Ainda não recebemos sua confirmação.
Lembramos que sua consulta de [Especialidade] está marcada
para [Data/Hora]. Por favor, confirme sua presença respondendo:
1 (Confirmo) / 2 (Não poderei) / 3 (Não agendei).
```

## 🔄 Fluxo de Processamento de Mensagens

```
┌─────────────────────────────────────┐
│  1. Mensagem recebida do WhatsApp   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  2. Normaliza telefone (E.164)      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  3. Obtém contexto (lastSystemMsg)  │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  4. Verifica ambiguidade            │
│     (múltiplas mensagens pendentes) │
└──────────┬──────────────┬───────────┘
           │              │
      SIM  │              │ NÃO
           │              │
           ▼              ▼
   ┌───────────────┐  ┌─────────────────────────┐
   │ Envia         │  │ 5. Classifica intenção  │
   │ clarificação  │  │    (números/keywords/NLP)│
   │ + reenvia 1x1 │  └──────────┬──────────────┘
   └───────────────┘             │
                                 ▼
                    ┌────────────────────────────┐
                    │ 6. Valida compatibilidade  │
                    │    com contexto            │
                    └─────────┬──────────────────┘
                              │
                              ▼
                    ┌────────────────────────────┐
                    │ 7. Verifica confidence     │
                    └─┬────────┬────────┬────────┘
                      │        │        │
                 ≥0.75│  0.55  │  <0.55 │
                      │        │        │
                      ▼        ▼        ▼
             ┌────────────┐ ┌──────────┐ ┌─────────┐
             │ Processa   │ │ Pede     │ │Fallback │
             │automatica- │ │confirma- │ │         │
             │mente       │ │ção       │ │         │
             └─────┬──────┘ └──────────┘ └─────────┘
                   │
                   ▼
        ┌──────────────────────────┐
        │ 8. BadgeManager processa │
        │    (confirmacao/desmarc) │
        └─────────┬────────────────┘
                  │
                  ▼
        ┌──────────────────────────┐
        │ 9. Envia resposta auto   │
        │    (com typing delay)    │
        └─────────┬────────────────┘
                  │
                  ▼
        ┌──────────────────────────┐
        │ 10. Registra logs        │
        │     (ChatAudit)          │
        └──────────────────────────┘
```

## 🎨 Badges e Transições

### Aba Confirmação

| Resposta | Status | Card | Badge Inicial | Ação Operador | Badge Final | Mensagem |
|----------|--------|------|---------------|---------------|-------------|----------|
| 1 - Confirmo | `confirmed` | Confirmados | - | - | - | ✅ Sim |
| 2 - Não poderei | `declined` | Não poderá | 🔴 Desmarcar | Desmarca AGHUse | 🟢 Desmarcada | ✅ Sim (mas NÃO envia desmarcação) |
| 3 - Não agendei | `not_scheduled` | Não agendou | - | - | - | ✅ Sim |

### Aba Desmarcação

| Resposta | Status | Card | Badge Inicial | Ação Operador | Badge Final | Mensagem |
|----------|--------|------|---------------|---------------|-------------|----------|
| 1 - Reagendar | `reagendamento` | Solicitou Reagend. | 🔴 Reagendar | Cria nova consulta | 🟢 Reagendada | ✅ Sim + Nova confirmação |
| 2 - Eu solicitei | `paciente_solicitou` | Pac. Solicitou | - | - | - | ✅ Sim |
| 3 - Sem reagend. | `sem_reagendamento` | Sem Reagend. | - | - | - | ✅ Sim |

## ⚙️ Regras Importantes

### ❌ NÃO Enviar Mensagem de Desmarcação
Quando paciente responde "2 - Não poderei comparecer", o sistema:
1. ✅ Envia resposta automática ("Entendido, sua consulta será desmarcada")
2. ✅ Cria badge VERMELHO "Desmarcar" para operador
3. ❌ **NÃO envia** mensagem de desmarcação quando operador desmarca no AGHUse
4. 🟢 Apenas atualiza badge para VERDE "Desmarcada"

**Motivo**: Evitar loop infinito e redundância. Paciente já sabe que será desmarcado.

### 🔗 Vinculação de Reagendamento (24h)
Quando paciente solicita reagendamento (resposta 1 na desmarcação):
1. Sistema registra pedido com timestamp
2. Quando operador cria **nova consulta no AGHUse** nas próximas 24h:
   - Mesmo prontuário OU mesmo paciente
   - Mesma especialidade
   - **Então**: Sistema vincula automaticamente
3. Envia MARCACAO_CONFIRMACAO da nova consulta
4. Badge muda de 🔴 Reagendar → 🟢 Reagendada

### 📱 Última Mensagem do Sistema = Fonte de Verdade
- Cada telefone tem `lastSystemMessage` armazenado
- Resposta do paciente SEMPRE se refere à última mensagem enviada
- Se múltiplas mensagens pendentes → Detecta ambiguidade → Reenvia uma a uma

## 📊 Logs e Auditoria

Todos os eventos são logados com:
- Texto original (raw) e normalizado
- Intent detectado + confidence
- Método de detecção (número/keyword/NLP)
- Última mensagem do sistema (ID e tipo)
- Ação realizada
- Consulta ID e Operador ID (quando aplicável)
- Timestamps completos

**Retenção**: 30 dias mínimo (seção 15 do prompt)

## 🔢 Métricas Disponíveis

```javascript
// Intent Detection
- Taxa de acerto por método (número/keyword/NLP/fallback)
- Distribuição de confidence (high/medium/low)

// Ambiguidade
- Total detectado
- Total resolvido
- Taxa de resolução

// Respostas
- Confirmed, Declined, Not Scheduled
- Reagendamento, Paciente Solicitou, Sem Reagendamento

// Tempo de Resposta
- Média de tempo simulado (typing delay)
```

## 🚀 Uso dos Serviços

### Processar mensagem recebida
```javascript
import * as InboundHandler from './services/inboundMessageHandler.service.js';

const result = await InboundHandler.processInboundMessage({
    from: '5511999999999@c.us',
    body: '1',
    timestamp: new Date().toISOString()
});

console.log(result);
// {
//   success: true,
//   telefone: '+5511999999999',
//   intent: { intent: 'confirmed', confidence: 1.0 },
//   action: 'auto_process',
//   response: { ... }
// }
```

### Iniciar lembretes automáticos
```javascript
import * as ReminderScheduler from './services/reminderScheduler.service.js';

// Verifica a cada 5 minutos
ReminderScheduler.startScheduler(5 * 60 * 1000);
```

### Iniciar monitoramento de reagendamentos
```javascript
import * as ReagendamentoLinker from './services/reagendamentoLinker.service.js';
import * as AghuseService from './services/aghuse.service.js';

// Verifica a cada 30 segundos
ReagendamentoLinker.startMonitoring(
    async () => await AghuseService.fetchRecentlyScheduledAppointments(5),
    30000
);
```

### Obter métricas
```javascript
import * as ChatAudit from './services/chatAudit.service.js';

const metrics = ChatAudit.getMetrics();
console.log(metrics);
```

## 🛠️ Configurações

### Anti-Ban (whatsappQueue.service.js)
```javascript
const CONFIG = {
    MIN_INTERVAL: 45 * 1000,    // 45 segundos entre mensagens
    MAX_INTERVAL: 120 * 1000,   // 120 segundos
    MENSAGENS_ANTES_PAUSA: 20,  // Pausa a cada 20 mensagens
    MIN_PAUSA: 10 * 60 * 1000,  // 10 minutos de pausa
    MAX_PAUSA: 15 * 60 * 1000,  // 15 minutos
    MIN_TYPING_TIME: 3 * 1000,  // 3 segundos de "digitando..."
    MAX_TYPING_TIME: 6 * 1000   // 6 segundos (aleatório)
};
```

### Lembretes (reminderScheduler.service.js)
- LEMBRETE_72H: 72 horas antes da consulta
- LEMBRETE_SEM_RESPOSTA: 5 minutos após 72h
- Marca como `sem_resposta`: 10 minutos após segundo lembrete

### Reagendamento (reagendamentoLinker.service.js)
- Janela de vinculação: **24 horas**
- Critérios: prontuário OU paciente + especialidade + pedido recente

## 📞 Fallbacks e Conversas Iniciadas

### Paciente Inicia Conversa
```
Olá! Aqui é a Central de Marcação de Consultas do HMASP.

Nosso atendimento via WhatsApp está em fase de implantação e
hoje está focado nas funções de confirmação de presença,
notificações de desmarcação e reagendamentos. Em breve teremos
mais funcionalidades.

Se você recebeu uma mensagem de confirmação ou desmarcação,
por favor responda usando as opções numéricas enviadas.

Se quiser falar com um atendente, responda "humano".
```

### Baixa Confiança (< 0.55)
- 1ª tentativa: Pede para responder com número (1, 2 ou 3)
- 2ª tentativa: Pede novamente
- 3ª tentativa: Oferece atendente humano

### Atendente Humano
Keywords: `humano`, `atendente`, `pessoa`, `operador`, `falar com alguem`
→ Cria ticket para operadores revisarem

## 🧪 Testes e Validação

### Cenários de Teste

1. **Resposta Direta com Número**
   - Enviar: "1" → Deve detectar `confirmed` com confidence 1.0

2. **Resposta com Keyword**
   - Enviar: "confirmo presença" → Deve detectar `confirmed` com confidence 0.85+

3. **Resposta Ambígua**
   - Enviar 3 mensagens do sistema sem resposta
   - Paciente responde "2"
   - Deve detectar ambiguidade e pedir clarificação

4. **Reagendamento**
   - Paciente solicita reagendamento
   - Operador cria nova consulta em 12h
   - Deve vincular automaticamente e enviar confirmação

5. **Lembretes**
   - Consulta sem resposta → Envia 72h → Aguarda 5min → Envia sem_resposta → Aguarda 10min → Marca sem_resposta

## 📦 Dependências

```json
{
  "dependencies": {
    "whatsapp-web.js": "^1.x.x"  // Backend WhatsApp (server.js)
  }
}
```

## 🔐 Segurança e Privacidade

1. **Dados Sensíveis**: Apenas especialidade/data/hora/profissional
2. **Consentimento**: Registrado em logs de auditoria
3. **Retenção**: Mínimo 6 meses para auditoria (seção 15)
4. **Telefones**: Normalizados para E.164 antes de armazenamento

## 📈 Monitoramento

### Health Check
- Status do WhatsApp (conectado/desconectado)
- Tamanho da fila de mensagens
- Mensagens pendentes por telefone
- Taxa de sucesso de envios

### Alertas
- Consultas sem resposta após lembretes
- Ambiguidades não resolvidas
- Falhas de envio (> 3 tentativas)
- Pedidos de atendente humano

## 🎓 Referências

- Prompt original: Seções 1-18
- whatsapp-web.js: https://wwebjs.dev/
- PhoneNormalizer: `src/utils/phoneNormalizer.js`
- AGHUse Integration: `src/services/aghuse.service.js`

---

**Implementado em**: Dezembro 2025
**Autor**: Claude Code (Anthropic)
**Versão**: 1.0.0
