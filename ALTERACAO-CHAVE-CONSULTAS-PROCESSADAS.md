# 🔑 ALTERAÇÃO: CHAVE COMPOSTA PARA CONSULTAS PROCESSADAS

**Data:** 12/12/2024
**Versão:** 2.0
**Autor:** Sistema HMASP Chat

---

## 📋 PROBLEMA IDENTIFICADO

### **Situação Anterior:**

O sistema usava apenas `consultaNumero` para identificar se uma consulta já foi processada no log PostgreSQL.

**Problema:** Quando uma consulta é **reagendada**, ela mantém o mesmo `consultaNumero` mas muda a data/hora. O sistema não detectava essa mudança e **não processava a consulta reagendada**.

### **Exemplo do Problema:**

```javascript
// Consulta original
consultaNumero: "12345"
dataConsulta: "2024-12-15T14:00:00" // Sexta-feira 14h
→ Processada ✅
→ Marcada no PostgreSQL: "12345"

// Paciente reagenda para outro dia
consultaNumero: "12345" (MESMO número!)
dataConsulta: "2024-12-20T16:00:00" // Quarta-feira 16h
→ ❌ NÃO PROCESSADA (PostgreSQL já tem "12345" marcado)
→ ❌ NÃO APARECE NO DASHBOARD
```

---

## ✅ SOLUÇÃO IMPLEMENTADA

### **Nova Chave Composta:**

```
consultaNumero + dataConsulta
```

**Formato:** `{consultaNumero}_{dataConsulta-ISO8601}`

**Exemplo:** `12345_2024-12-15T14:00:00.000Z`

---

## 🔧 IMPLEMENTAÇÃO FRONTEND

### **Arquivo Modificado:**

`src/services/monitoramentoLog.service.js`

### **Nova Função:**

```javascript
/**
 * Gera chave única para identificar consulta
 * Usa consultaNumero + dataConsulta (quando vai acontecer)
 *
 * IMPORTANTE: dataConsulta muda quando consulta é reagendada,
 * então mesma consultaNumero com data diferente = consulta diferente
 *
 * @param {Object} consulta - Objeto da consulta
 * @returns {string} - Chave única (ex: "12345_2024-12-15T14:00:00")
 */
function gerarChaveUnica(consulta) {
    const numero = consulta.consultaNumero || consulta.consulta_numero;
    const data = consulta.dataConsulta || consulta.data_consulta || consulta.dataHoraFormatada;

    if (!numero) {
        console.error('[MonitoramentoLog] Consulta sem consultaNumero:', consulta);
        return null;
    }

    if (!data) {
        console.warn('[MonitoramentoLog] Consulta sem dataConsulta, usando apenas consultaNumero:', numero);
        return numero; // Fallback: usa apenas número
    }

    // Normaliza data para ISO 8601 (se ainda não estiver)
    let dataISO = data;
    if (data instanceof Date) {
        dataISO = data.toISOString();
    } else if (typeof data === 'string' && !data.includes('T')) {
        // Se for string sem 'T', tenta parsear
        const parsed = new Date(data);
        if (!isNaN(parsed.getTime())) {
            dataISO = parsed.toISOString();
        }
    }

    return `${numero}_${dataISO}`;
}
```

### **Funções Atualizadas:**

**1. `getConsultasNaoProcessadas()`** - Adiciona `chaveUnica` a cada consulta antes de enviar ao backend:

```javascript
const consultasComChave = consultasRecentes.map(c => {
    const chave = gerarChaveUnica(c);
    return {
        ...c,
        chaveUnica: chave, // Nova propriedade
        consultaNumero: c.consultaNumero,
        dataConsulta: c.dataConsulta
    };
}).filter(c => c.chaveUnica !== null);
```

**2. `marcarConsultasProcessadas()`** - Adiciona `chaveUnica` antes de marcar:

```javascript
const consultasComChave = consultas.map(c => {
    const chave = gerarChaveUnica(c);
    return {
        ...c,
        chaveUnica: chave,
        consultaNumero: c.consultaNumero,
        dataConsulta: c.dataConsulta
    };
}).filter(c => c.chaveUnica !== null);
```

---

## 🎯 IMPLEMENTAÇÃO BACKEND (PostgreSQL)

### **⚠️ ATENÇÃO: BACKEND DEVE SER ATUALIZADO**

O backend PostgreSQL precisa ser modificado para usar `chaveUnica` ao invés de `consultaNumero`.

### **Tabela Sugerida:**

```sql
CREATE TABLE IF NOT EXISTS consultas_processadas (
    id SERIAL PRIMARY KEY,
    chave_unica TEXT UNIQUE NOT NULL,  -- Nova coluna: "12345_2024-12-15T14:00:00"
    consulta_numero TEXT NOT NULL,      -- Mantém para referência
    data_consulta TIMESTAMP,            -- Mantém para referência
    processado_em TIMESTAMP DEFAULT NOW(),
    dados_completos JSONB               -- Consulta completa em JSON
);

CREATE INDEX idx_consultas_processadas_chave ON consultas_processadas(chave_unica);
CREATE INDEX idx_consultas_processadas_numero ON consultas_processadas(consulta_numero);
```

### **Endpoint `/consultas/filtrar` (POST):**

```javascript
// ANTES (errado):
const processadas = await db.query(
    'SELECT consulta_numero FROM consultas_processadas WHERE consulta_numero = ANY($1)',
    [consultas.map(c => c.consultaNumero)]
);

// DEPOIS (correto):
const processadas = await db.query(
    'SELECT chave_unica FROM consultas_processadas WHERE chave_unica = ANY($1)',
    [consultas.map(c => c.chaveUnica)]
);

const chavesProcessadas = new Set(processadas.rows.map(r => r.chave_unica));

const naoProcessadas = consultas.filter(c => !chavesProcessadas.has(c.chaveUnica));
```

### **Endpoint `/consultas/marcar` (POST):**

```javascript
// ANTES (errado):
await db.query(
    'INSERT INTO consultas_processadas (consulta_numero, dados_completos) VALUES ($1, $2) ON CONFLICT DO NOTHING',
    [consulta.consultaNumero, JSON.stringify(consulta)]
);

// DEPOIS (correto):
await db.query(
    'INSERT INTO consultas_processadas (chave_unica, consulta_numero, data_consulta, dados_completos) VALUES ($1, $2, $3, $4) ON CONFLICT (chave_unica) DO NOTHING',
    [consulta.chaveUnica, consulta.consultaNumero, consulta.dataConsulta, JSON.stringify(consulta)]
);
```

---

## 📊 EXEMPLOS PRÁTICOS

### **Exemplo 1: Consulta Normal**

```javascript
// Input do AGHUse
{
    consultaNumero: "12345",
    dataConsulta: "2024-12-15T14:00:00.000Z",
    nomePaciente: "João Silva",
    // ...
}

// Chave gerada
chaveUnica: "12345_2024-12-15T14:00:00.000Z"

// PostgreSQL salva
chave_unica: "12345_2024-12-15T14:00:00.000Z"
```

### **Exemplo 2: Consulta Reagendada**

```javascript
// Consulta original (já processada)
chaveUnica: "12345_2024-12-15T14:00:00.000Z" ✅ Marcada

// Consulta reagendada (nova data/hora)
{
    consultaNumero: "12345",  // MESMO número
    dataConsulta: "2024-12-20T16:00:00.000Z",  // NOVA data
    // ...
}

// Chave gerada
chaveUnica: "12345_2024-12-20T16:00:00.000Z"  // DIFERENTE! ✅

// PostgreSQL verifica
SELECT * FROM consultas_processadas WHERE chave_unica = '12345_2024-12-20T16:00:00.000Z'
→ NÃO ENCONTRADA ✅
→ Consulta é PROCESSADA novamente ✅
→ Aparece no dashboard ✅
```

### **Exemplo 3: Consulta Desmarcada e Remarcada**

```javascript
// Situação 1: Consulta marcada
chaveUnica: "12345_2024-12-15T14:00:00.000Z" ✅ Processada

// Situação 2: Paciente desmarca
→ Consulta arquivada

// Situação 3: Paciente remarca (mesmo dia/hora)
{
    consultaNumero: "12345",
    dataConsulta: "2024-12-15T14:00:00.000Z",  // MESMA data!
    // ...
}

// Chave gerada
chaveUnica: "12345_2024-12-15T14:00:00.000Z"  // MESMA chave

// PostgreSQL verifica
→ JÁ EXISTE ⚠️
→ Consulta NÃO é processada novamente ❌

// SOLUÇÃO: Limpar registros antigos (> 7 dias) ou adicionar flag de "ativa"
```

---

## ⚙️ CONFIGURAÇÃO NECESSÁRIA

### **1. Frontend (✅ JÁ IMPLEMENTADO)**

Nenhuma configuração adicional necessária.

### **2. Backend PostgreSQL (⚠️ REQUER ATUALIZAÇÃO)**

**Passos:**

1. **Migração do banco:**
   ```sql
   ALTER TABLE consultas_processadas ADD COLUMN chave_unica TEXT;
   ALTER TABLE consultas_processadas ADD COLUMN data_consulta TIMESTAMP;

   -- Preenche chaves antigas (se existirem dados)
   UPDATE consultas_processadas SET chave_unica = consulta_numero WHERE chave_unica IS NULL;

   -- Adiciona UNIQUE constraint
   ALTER TABLE consultas_processadas ADD CONSTRAINT unique_chave_unica UNIQUE (chave_unica);
   ```

2. **Atualizar endpoints:**
   - `/consultas/filtrar` → Usar `chaveUnica`
   - `/consultas/marcar` → Salvar `chaveUnica`

3. **Limpar registros antigos (opcional):**
   ```sql
   DELETE FROM consultas_processadas WHERE processado_em < NOW() - INTERVAL '7 days';
   ```

---

## 🧪 TESTES

### **Teste 1: Consulta Normal**

```
1. Marcar consulta 12345 para 15/12 14h
2. Sistema processa ✅
3. Tentar processar novamente
4. ❌ Bloqueado (já processada)
```

### **Teste 2: Reagendamento**

```
1. Marcar consulta 12345 para 15/12 14h ✅
2. Paciente reagenda para 20/12 16h
3. Sistema processa novamente ✅ (chave diferente)
4. Dashboard mostra nova consulta ✅
```

### **Teste 3: Desmarcação + Remarcação Mesmo Horário**

```
1. Marcar consulta 12345 para 15/12 14h ✅
2. Paciente desmarca
3. Paciente remarca para 15/12 14h (mesmo horário)
4. ⚠️ Sistema pode bloquear (mesma chave)
5. Solução: Limpar registros antigos ou usar flag "ativa"
```

---

## 📝 CAMPOS DISPONÍVEIS

### **Objeto Consulta (do AGHUse):**

```javascript
{
    consultaNumero: "12345",           // Número da consulta
    dataConsulta: "2024-12-15T14:00:00", // Quando vai acontecer (ISO 8601)
    dataHoraFormatada: "15/12/2024 14:00", // Formatada para exibição
    dataMarcacao: "2024-12-10T10:00:00",   // Quando foi marcada
    nomePaciente: "João Silva",
    prontuario: "987654",
    especialidade: "Cardiologia",
    profissional: "Dr. João",
    telefones: [...]
}
```

### **Por que `dataConsulta` e não `dataMarcacao`?**

| Campo | O que é | Muda no reagendamento? |
|-------|---------|------------------------|
| `dataMarcacao` | Quando paciente marcou | ❌ NÃO |
| `dataConsulta` | Quando consulta acontece | ✅ SIM |

**Exemplo:**
- Marcou dia 10/12 às 10h (`dataMarcacao`)
- Para consulta dia 15/12 às 14h (`dataConsulta`)
- Reagendou para dia 20/12 às 16h → `dataConsulta` muda ✅

---

## 🎯 RESUMO

### ✅ **O que mudou:**
- Frontend agora envia `chaveUnica` em todas as chamadas
- Chave formato: `{consultaNumero}_{dataConsulta-ISO}`
- Consultas reagendadas são detectadas e processadas

### ⚠️ **O que falta:**
- Backend PostgreSQL precisa ser atualizado para usar `chaveUnica`
- Migração do banco de dados
- Testes completos

### 🚀 **Benefícios:**
- Reagendamentos aparecem no dashboard
- Não perde nenhuma consulta
- Mantém histórico completo

---

## 📧 CONTATO

Para dúvidas sobre esta implementação, consulte:
- Arquivo: `src/services/monitoramentoLog.service.js`
- Função: `gerarChaveUnica()`
- Documentação: Este arquivo

---

**Versão:** 2.0
**Última atualização:** 12/12/2024
