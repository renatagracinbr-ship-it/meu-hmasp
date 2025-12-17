# Problemas Corrigidos e Pendentes

## ✅ Problema 1: Badge não aparece (CORRIGIDO)

### Causa Raiz
Quando usamos WhatsApp Business, cada conversa tem um **chat ID único** diferente do número de telefone:
- **Enviamos para**: `5511974878925@c.us` (número do paciente)
- **Resposta vem de**: `145809928667197@lid` (chat ID único do WhatsApp Business)

O sistema não estava mapeando corretamente o `confirmacaoId` para o chat ID real.

### Solução Implementada (commit d31be05)
Após enviar a mensagem, capturamos o chat ID real de `sentMessage.from` e:
1. Atualizamos o contexto com o chat ID correto
2. Adicionamos mapeamento adicional pelo chat ID real
3. Mantemos o número original para referência

```javascript
// server.js linha ~1090
if (metadata && metadata.confirmacaoId && sentMessage.from) {
    const realChatId = sentMessage.from; // Chat ID real do WhatsApp

    // Atualiza o contexto existente
    if (global.chatContextos[metadata.confirmacaoId]) {
        global.chatContextos[metadata.confirmacaoId].chatId = realChatId;

        // Adiciona mapeamento adicional pelo chat ID real
        if (!global.phoneToConfirmacoes[realChatId]) {
            global.phoneToConfirmacoes[realChatId] = [];
        }
        if (!global.phoneToConfirmacoes[realChatId].includes(metadata.confirmacaoId)) {
            global.phoneToConfirmacoes[realChatId].push(metadata.confirmacaoId);
        }
    }
}
```

### Como Testar
1. Limpe localStorage e reinicie o servidor
2. Marque uma consulta no AGHUse
3. Aguarde mensagem de confirmação
4. Responda com "2" (não poderei ir)
5. Verifique se o badge vermelho "Desmarcar" aparece

---

## ⚠️ Problema 2: Duplicação de Consultas (PENDENTE)

### Sintoma
A consulta `736145` aparece múltiplas vezes:
```
11 confirmações → 12 → 13 → 14 → 15 → 16...
```

### Logs do Problema
```
[AGHUse] ✅ 1 consultas marcadas encontradas (offset: 0, limit: 100)
[MonitoramentoLog] 1 consultas não processadas de 1 total
[Confirmação] 1 novas consultas encontradas
```

Isso se repete **a cada 30 segundos** (intervalo do monitoramento).

### Causa Provável
O servidor PostgreSQL (`http://localhost:3000/api/database/monitoramento`) não está marcando a consulta como `processada = true` após o primeiro envio.

### Verificações Necessárias
1. ✅ Consulta foi registrada como enviada (log mostra: `[Database] Consulta 736145 registrada como enviado`)
2. ❌ Consulta continua aparecendo como "não processada" nas buscas seguintes

### Fluxo Esperado
```
1. AGHUse detecta consulta 736145
2. Sistema envia mensagem WhatsApp
3. MonitoramentoLog registra: UPDATE consultas SET processada = true WHERE numero = 736145
4. Próxima verificação: consulta não aparece mais (já processada)
```

### Fluxo Atual (Incorreto)
```
1. AGHUse detecta consulta 736145
2. Sistema envia mensagem WhatsApp
3. MonitoramentoLog registra como enviada ❓
4. Próxima verificação: consulta AINDA aparece como não processada ❌
5. Loop infinito de duplicação
```

### Solução Proposta
Investigar o endpoint `/api/database/monitoramento/consulta/:numero` e verificar:

1. **Se a consulta está sendo marcada como processada**:
```sql
UPDATE consultas_marcadas
SET processada = true,
    status = 'enviado',
    data_envio = CURRENT_TIMESTAMP
WHERE numero_consulta = '736145'
```

2. **Se o filtro de consultas não processadas está correto**:
```sql
SELECT * FROM consultas_marcadas
WHERE processada = false OR processada IS NULL
  AND data_marcacao >= NOW() - INTERVAL '60 minutes'
```

### Arquivos Relacionados
- `src/services/monitoramentoLog.service.js` - Lógica de filtragem
- Servidor PostgreSQL (porta 3000) - Endpoints de database
- `server/aghuse-server.js` - Busca consultas do AGHUse

### Como Corrigir (Próximos Passos)
1. Localizar servidor de database PostgreSQL
2. Verificar endpoint `POST /api/database/monitoramento/consulta/:numero`
3. Garantir que UPDATE está sendo executado
4. Adicionar logs para confirmar execução do UPDATE
5. Verificar se a transação está sendo commitada

---

## Resumo de Status

| Problema | Status | Commit | Observações |
|----------|--------|--------|-------------|
| Badge não aparece | ✅ CORRIGIDO | d31be05 | Testar com novo envio |
| Duplicação de consultas | ⚠️ PENDENTE | - | Requer investigação no DB |
| Remoção de gerenciamento de usuários | ✅ CONCLUÍDO | 164cdfd | Funcionalidade removida |

---

## Próxima Ação Recomendada

**TESTAR A CORREÇÃO DO BADGE:**
1. Pare o servidor Node
2. Limpe localStorage do navegador (F12 → Application → Clear storage)
3. Reinicie o servidor
4. Envie nova mensagem de confirmação
5. Responda com opção 2 ou 3
6. Verifique se badge aparece

Se o badge funcionar, podemos focar 100% no problema da duplicação.
