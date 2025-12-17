# Estudo: Sistema de Badges Inteligentes - Vinculação entre Abas

## 📋 Resumo Executivo

Este documento analisa a implementação do sistema de badges inteligentes que vincula automaticamente ações entre as abas de **Confirmação de Presença** e **Desmarcação de Consultas**.

---

## 🎯 Requisitos do Sistema

### 1️⃣ Aba Confirmação → Aba Desmarcação

**Cenário:**
1. Paciente responde "2 - Não poderei comparecer" na aba de Confirmação
2. Badge vermelho "Desmarcar" aparece
3. Operador desmarca consulta no AGHUse
4. **Consulta desmarcada aparece na Aba Desmarcação**
5. Sistema identifica que é a mesma consulta (origem: Confirmação)
6. Badge muda de vermelho "Desmarcar" → verde "Desmarcada"
7. **NÃO envia mensagem de desmarcação** (paciente já sabe)

**Critérios de Identificação:**
- Número da consulta (ID) - chave primária
- Prontuário do paciente - validação
- Especialidade - validação
- Data/hora da consulta - validação

---

### 2️⃣ Aba Desmarcação → Aba Confirmação

**Cenário:**
1. Consulta desmarcada aparece na Aba Desmarcação
2. Paciente responde "1 - Solicito reagendamento"
3. Badge vermelho "Reagendar" aparece
4. Operador marca nova consulta no AGHUse
5. **Nova consulta aparece na Aba Confirmação**
6. Sistema identifica que é reagendamento (janela de 24h)
7. Badge muda de vermelho "Reagendar" → verde "Reagendada"
8. **Envia mensagem especial de reagendamento**

**Critérios de Identificação:**
- Nome do paciente - match
- Prontuário do paciente - match
- Especialidade - match
- **ID da consulta DIFERENTE** (nova consulta tem novo ID)
- Pedido de reagendamento nas últimas 24h

---

## ✅ O Que Já Está Implementado

### 1. Sistema de Badges (badgeManager.service.js)

✅ **IMPLEMENTADO COMPLETAMENTE**

```javascript
export const BADGES = {
    // Confirmação
    DESMARCAR: { label: 'Desmarcar', color: 'red', action: 'desmarcar_aghuse' },
    DESMARCADA: { label: 'Desmarcada', color: 'green', action: null },

    // Desmarcação
    REAGENDAR: { label: 'Reagendar', color: 'red', action: 'reagendar_aghuse' },
    REAGENDADA: { label: 'Reagendada', color: 'green', action: null }
};
```

**Funcionalidades:**
- ✅ `processConfirmacaoResponse()` - processa resposta do paciente
- ✅ `processDesmarcacaoResponse()` - processa resposta de desmarcação
- ✅ `processOperatorDesmarcacao()` - quando operador desmarca (badge vermelho → verde)
- ✅ `processOperatorReagendamento()` - quando operador reagenda (badge vermelho → verde + mensagem)
- ✅ `canTransitionBadge()` - valida transições de badge

---

### 2. Sistema de Reagendamento (reagendamentoLinker.service.js)

✅ **IMPLEMENTADO COMPLETAMENTE**

**Funcionalidades:**
- ✅ `tryLinkNovaConsulta()` - tenta vincular nova consulta a pedido de reagendamento
- ✅ `findMatchingPedido()` - heurística de match (prontuário + especialidade + 24h)
- ✅ `startMonitoring()` - monitora novas consultas do AGHUse (30s)
- ✅ `getPendingReagendamentoRequests()` - busca pedidos pendentes por telefone/especialidade

**Lógica de Vinculação:**
```javascript
// Critérios de match:
1. Mesmo prontuário OU mesmo pacCodigo
2. Mesma especialidade
3. Pedido nas últimas 24h
→ Então vincular e enviar mensagem de reagendamento
```

---

### 3. Sistema de ID Único (idGenerator.js)

✅ **IMPLEMENTADO COMPLETAMENTE**

```javascript
// Formato: {prefix}-{consultaNumero}-{timestamp}-{uuid}
// Exemplo: conf-123456-1699999999999-a1b2c3d4
generateConfirmacaoId(consultaNumero, 'confirmacao')
generateConfirmacaoId(consultaNumero, 'desmarcacao')
```

**Benefícios:**
- ✅ Rastreamento fim-a-fim
- ✅ Vinculação por consultaNumero
- ✅ Evita duplicações

---

### 4. Stores de Confirmação e Desmarcação

✅ **IMPLEMENTADO COMPLETAMENTE**

**confirmacao.service.js:**
- ✅ `confirmationsStore` - Map de confirmações
- ✅ `getAllConfirmations()` - retorna todas confirmações
- ✅ `getConfirmation(id)` - busca por ID

**desmarcacao.service.js:**
- ✅ `desmarcacoesStore` - Map de desmarcações
- ✅ `getAllDesmarcacoes()` - retorna todas desmarcações
- ✅ `prepareDesmarcacao()` - prepara desmarcação com ID único

---

### 5. Contexto de Conversa (conversationContext.service.js)

✅ **IMPLEMENTADO COMPLETAMENTE**

**Funcionalidades:**
- ✅ `registerReagendamentoRequest()` - registra pedido de reagendamento
- ✅ `getPendingReagendamentoRequests()` - busca pedidos pendentes (janela 24h)
- ✅ `fulfillReagendamentoRequest()` - marca pedido como atendido

---

## ❌ O Que FALTA Implementar

### ⚠️ CRÍTICO: Vinculação Confirmação → Desmarcação

**PROBLEMA:**
Não existe lógica para detectar quando uma consulta desmarcada veio da aba de Confirmação com badge "Desmarcar".

**O que precisa ser implementado:**

#### 1. Novo Serviço: `desmarcacaoLinker.service.js`

Espelhando a lógica do `reagendamentoLinker.service.js`, criar:

```javascript
/**
 * Serviço de Vinculação de Desmarcações (Confirmação → Desmarcação)
 *
 * Responsável por:
 * - Monitorar consultas desmarcadas que aparecem na Aba Desmarcação
 * - Verificar se vieram de badge "Desmarcar" da Aba Confirmação
 * - Atualizar badge VERMELHO → VERDE "Desmarcada"
 * - NÃO enviar mensagem de desmarcação
 */

export async function tryLinkDesmarcacao(consultaDesmarcada) {
    // 1. Buscar todas as confirmações com status 'declined' ou 'not_scheduled'
    const confirmacoes = getAllConfirmations();

    const confirmacoesComBadgeDesmarcar = confirmacoes.filter(c =>
        c.statusGeral === 'declined' || c.statusGeral === 'not_scheduled'
    );

    // 2. Procurar match por consultaNumero (ID da consulta)
    const matchedConfirmacao = confirmacoesComBadgeDesmarcar.find(c =>
        c.consultaNumero === consultaDesmarcada.consultaNumero
    );

    if (!matchedConfirmacao) {
        // Não veio da aba de Confirmação, é desmarcação normal
        return { linked: false, sendMessage: true };
    }

    // 3. MATCH! Veio da aba de Confirmação
    console.log(`[DesmarcacaoLinker] Match encontrado: ${consultaDesmarcada.consultaNumero}`);

    // 4. Atualizar badge na confirmação
    await updateBadgeConfirmacao(matchedConfirmacao.id, BADGES.DESMARCADA);

    // 5. Marcar desmarcação como "origem: confirmacao"
    consultaDesmarcada.origemConfirmacao = true;
    consultaDesmarcada.confirmacaoLinkedId = matchedConfirmacao.id;

    // 6. Retornar para NÃO enviar mensagem
    return {
        linked: true,
        sendMessage: false,  // CRÍTICO: não enviar mensagem
        confirmacaoId: matchedConfirmacao.id
    };
}
```

---

#### 2. Integração com desmarcacao.service.js

Modificar o serviço de desmarcação para chamar o linker:

```javascript
// Em checkCanceledAppointments():
for (const appointment of appointments) {
    const desmarcacao = prepareDesmarcacao(appointment);

    // 🆕 NOVO: Verificar se veio da aba de Confirmação
    const linkResult = await DesmarcacaoLinker.tryLinkDesmarcacao(desmarcacao);

    if (linkResult.linked) {
        console.log(`[Desmarcação] Consulta veio da aba Confirmação, NÃO enviar mensagem`);
        desmarcacao.origemConfirmacao = true;
        desmarcacao.badgeStatus = 'desmarcada'; // Verde
    } else {
        console.log(`[Desmarcação] Consulta desmarcada normal, enviar mensagem`);
        desmarcacao.origemConfirmacao = false;
        // Enviar mensagem de desmarcação normalmente
        await sendDesmarcacaoMessage(desmarcacao);
    }

    newDesmarcacoes.push(desmarcacao);
}
```

---

#### 3. Atualização do Frontend (confirmacaoPresenca.js)

Adicionar lógica para exibir badge verde "Desmarcada":

```javascript
function renderConfirmationCardCompact(confirmation) {
    // Badge "Desmarcar" ou "Desmarcada"
    let badgeDesmarcar = '';

    if (confirmation.statusGeral === 'declined' || confirmation.statusGeral === 'not_scheduled') {
        // Verificar se já foi desmarcada
        if (confirmation.badgeStatus === 'desmarcada') {
            badgeDesmarcar = '<div class="badge-desmarcada">Desmarcada</div>'; // Verde
        } else {
            badgeDesmarcar = '<div class="badge-desmarcar">Desmarcar</div>'; // Vermelho
        }
    }

    return `
        <div class="confirmation-card-compact">
            ${badgeDesmarcar}
            <!-- resto do card -->
        </div>
    `;
}
```

---

#### 4. CSS para Badge Verde

Adicionar estilo para badge verde "Desmarcada":

```css
.badge-desmarcada {
    background-color: #4CAF50;  /* Verde */
    color: white;
    padding: 4px 12px;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    position: absolute;
    top: 8px;
    right: 8px;
}
```

---

## 🔄 Fluxo Completo Implementado vs Necessário

### Fluxo 1: Confirmação → Desmarcação (❌ FALTA)

| Etapa | Status | Implementação |
|-------|--------|---------------|
| 1. Paciente responde "2" | ✅ | `inboundMessageHandler.service.js` |
| 2. Badge vermelho "Desmarcar" | ✅ | `badgeManager.service.js` |
| 3. Operador desmarca no AGHUse | ✅ | Manual |
| 4. Consulta aparece na Aba Desmarcação | ✅ | `desmarcacao.service.js` |
| 5. **Sistema identifica origem** | ❌ FALTA | **Precisa criar `desmarcacaoLinker.service.js`** |
| 6. **Badge muda para verde** | ❌ FALTA | **Precisa atualizar confirmação** |
| 7. **NÃO envia mensagem** | ❌ FALTA | **Precisa lógica condicional** |

---

### Fluxo 2: Desmarcação → Confirmação (✅ COMPLETO)

| Etapa | Status | Implementação |
|-------|--------|---------------|
| 1. Consulta desmarcada | ✅ | `desmarcacao.service.js` |
| 2. Paciente responde "1" | ✅ | `inboundMessageHandler.service.js` |
| 3. Badge vermelho "Reagendar" | ✅ | `badgeManager.service.js` |
| 4. Operador marca nova consulta | ✅ | Manual |
| 5. Nova consulta aparece | ✅ | `confirmacao.service.js` |
| 6. Sistema identifica reagendamento | ✅ | `reagendamentoLinker.service.js` |
| 7. Badge muda para verde | ✅ | `badgeManager.service.js` |
| 8. Envia mensagem especial | ✅ | `whatsappTemplates.service.js` |

---

## 📊 Comparação: Reagendamento vs Desmarcação

| Aspecto | Reagendamento (Desmarcação→Confirmação) | Desmarcação (Confirmação→Desmarcação) |
|---------|----------------------------------------|--------------------------------------|
| **Serviço** | ✅ reagendamentoLinker.service.js | ❌ **FALTA** desmarcacaoLinker.service.js |
| **ID Match** | Prontuário + Especialidade + 24h | consultaNumero (ID exato) |
| **Badge Origem** | REAGENDAR (vermelho) | DESMARCAR (vermelho) |
| **Badge Destino** | REAGENDADA (verde) | DESMARCADA (verde) |
| **Envia Mensagem?** | ✅ SIM (reagendamento) | ❌ NÃO (paciente já sabe) |
| **Janela de Tempo** | 24 horas | Imediato (mesmo ID) |

---

## 🛠️ Arquivos que Precisam ser Criados/Modificados

### Criar:
1. ✏️ `src/services/desmarcacaoLinker.service.js` - serviço de vinculação

### Modificar:
1. ✏️ `src/services/desmarcacao.service.js` - integrar linker
2. ✏️ `src/components/confirmacaoPresenca.js` - renderizar badge verde
3. ✏️ `index.html` ou `src/styles.css` - CSS do badge verde
4. ✏️ `src/services/badgeManager.service.js` - função para atualizar badge

---

## 📝 Prioridade de Implementação

### 🔴 Prioridade ALTA
1. **desmarcacaoLinker.service.js** - lógica de vinculação
2. **Integração com desmarcacao.service.js** - chamar linker

### 🟡 Prioridade MÉDIA
3. **Frontend - badge verde** - visual feedback
4. **Testes de integração** - garantir fluxo completo

### 🟢 Prioridade BAIXA
5. **Logs e auditoria** - rastreamento
6. **Estatísticas** - métricas de vinculação

---

## ✅ Conclusão

**Resumo:**
- ✅ **50% implementado**: Reagendamento (Desmarcação → Confirmação) está COMPLETO
- ❌ **50% faltando**: Desmarcação (Confirmação → Desmarcação) precisa ser implementado

**Próximos Passos:**
1. Criar `desmarcacaoLinker.service.js` espelhando `reagendamentoLinker.service.js`
2. Integrar no fluxo de desmarcação
3. Atualizar frontend para mostrar badge verde
4. Testar fluxo completo

**Estimativa:**
- Desenvolvimento: ~4-6 horas
- Testes: ~2-3 horas
- **Total: ~1 dia de trabalho**
