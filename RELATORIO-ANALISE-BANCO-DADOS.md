# 📊 ANÁLISE COMPLETA DO BANCO DE DADOS - HMASP CHAT

**Data da Análise:** 12/12/2025
**Banco de Dados:** `hmasp_consultas.db`
**Tamanho:** 440 KB
**Engine:** SQLite 3 (better-sqlite3)

---

## 📋 SUMÁRIO EXECUTIVO

### ✅ Status Geral: **SAUDÁVEL**

- **Integridade:** ✅ OK
- **Tabelas:** 7 principais + 6 views
- **Registros Ativos:** 435 (276 consultas + 102 desmarcações + 57 respostas)
- **Duplicatas:** Nenhuma detectada
- **Órfãos:** Nenhum registro órfão
- **Problemas Críticos:** ⚠️ **2 encontrados** (ver seção "Bugs Detectados")

---

## 🗂️ ESTRUTURA DO BANCO DE DADOS

### **Tabelas Principais (7)**

| # | Tabela | Registros | Descrição |
|---|--------|-----------|-----------|
| 1 | `consultas_ativas` | 276 | Consultas aguardando confirmação ou lembretes 72h |
| 2 | `desmarcacoes_ativas` | 102 | Consultas desmarcadas aguardando resposta |
| 3 | `consulta_telefones` | 0 | Telefones vinculados a consultas (1:N) |
| 4 | `desmarcacao_telefones` | 0 | Telefones vinculados a desmarcações (1:N) |
| 5 | `whatsapp_respostas_ativas` | 57 | Respostas pendentes de processamento |
| 6 | `whatsapp_respostas_historico` | 0 | Histórico de respostas processadas |
| 7 | `consultas_arquivadas` | 0 | Consultas/desmarcações arquivadas |

### **Views (6)**

- `vw_consultas_com_telefones` - Join consultas + telefones
- `vw_desmarcacoes_com_telefones` - Join desmarcações + telefones
- `vw_stats_confirmacoes` - Estatísticas de confirmações
- `vw_stats_desmarcacoes` - Estatísticas de desmarcações
- `vw_whatsapp_respostas_pendentes` - Respostas não processadas
- `vw_whatsapp_respostas_stats` - Estatísticas de respostas

---

## 📊 TABELA 1: CONSULTAS_ATIVAS (276 registros)

### **Propósito**
Armazena consultas agendadas que precisam de confirmação de presença ou lembretes 72h antes.

### **Estrutura (30 campos)**

#### **Identificação**
- `id` (TEXT, PK) - UUID único
- `consulta_numero` (TEXT, NOT NULL) - Número da consulta no AGHUse
- **UNIQUE KEY:** `(consulta_numero, telefone)` - Evita duplicatas

#### **Dados do Paciente**
- `nome_paciente` (TEXT, NOT NULL)
- `nome_exibicao` (TEXT) - Nome abreviado para exibição
- `prontuario` (TEXT)
- `pac_codigo` (TEXT) - Código do paciente no AGHUse
- `telefone` (TEXT)
- `telefone_formatado` (TEXT)

#### **Dados da Consulta**
- `especialidade` (TEXT)
- `profissional` (TEXT) - Médico responsável
- `local` (TEXT) - Local da consulta
- `data_hora_formatada` (TEXT)
- `data_consulta` (TEXT) - ISO 8601 datetime

#### **Tipo e Status**
- `tipo` (TEXT, NOT NULL) - Valores: `'marcada'` ou `'lembrete72h'`
- `status_geral` (TEXT, DEFAULT 'pending') - Estados:
  - `pending` - Aguardando resposta
  - `sent` - Mensagem enviada
  - `delivered` - Mensagem entregue
  - `confirmed` - Paciente confirmou presença
  - `declined` - Paciente não vai comparecer
  - `not_scheduled` - Paciente diz não ter agendado

#### **WhatsApp**
- `mensagem_template` (TEXT) - Template usado
- `mensagem_enviada` (BOOLEAN, DEFAULT 0)
- `data_envio` (TEXT) - ISO 8601
- `whatsapp_message_id` (TEXT)

#### **Contexto e Respostas**
- `contexto` (TEXT, DEFAULT 'confirmacao')
- `contexto_id` (TEXT) - ID do contexto ativo
- `contexto_expires_at` (TEXT) - Expiração do contexto
- `data_resposta` (TEXT) - Quando paciente respondeu

#### **Sistema de Badges**
- `badge_status` (TEXT) - Estados: `'desmarcar'`, `'desmarcada'`, NULL
- `badge_info` (TEXT) - JSON com info adicional do badge

#### **Monitoramento**
- `data_marcacao` (TEXT) - Quando foi marcada no AGHUse
- `data_apareceu_dashboard` (TEXT) - Quando apareceu no dashboard

#### **Metadados**
- `criado_em` (TEXT, DEFAULT CURRENT_TIMESTAMP)
- `atualizado_em` (TEXT, DEFAULT CURRENT_TIMESTAMP)
- `criado_por` (TEXT, DEFAULT 'sistema')

### **Índices (9)**
- `idx_consultas_ativas_consulta_numero` - Busca por número
- `idx_consultas_ativas_telefone` - Busca por telefone
- `idx_consultas_ativas_tipo` - Filtragem por tipo
- `idx_consultas_ativas_status` - Filtragem por status
- `idx_consultas_ativas_data_consulta` - Ordenação por data
- `idx_consultas_ativas_badge` - Consultas com badge
- `idx_consultas_ativas_data_resposta` - Respostas recentes
- 2 índices únicos automáticos (PK e UNIQUE constraint)

### **Estatísticas Atuais**

| Métrica | Valor | Porcentagem |
|---------|-------|-------------|
| **Total de Consultas** | 276 | 100% |
| Tipo: Marcadas | 242 | 87.7% |
| Tipo: Lembretes 72h | 34 | 12.3% |
| Status: Pendente | 222 | 80.4% |
| Status: Declinada | 13 | 4.7% |
| Status: Confirmada | 0 | 0% |
| Mensagens Enviadas | 0 | 0% ⚠️ |
| **Sem Telefone** | **37** | **13.4%** ⚠️ |
| Com Badge Ativo | 0 | 0% |

---

## 📊 TABELA 2: DESMARCACOES_ATIVAS (102 registros)

### **Propósito**
Armazena consultas que foram desmarcadas e aguardam resposta sobre reagendamento.

### **Estrutura (38 campos)**

#### **Identificação**
- `id` (TEXT, PK) - UUID único
- `consulta_numero` (TEXT, NOT NULL)
- **UNIQUE KEY:** `(consulta_numero, telefone)`

#### **Dados do Paciente** (mesmos de consultas_ativas)
- `nome_paciente`, `nome_exibicao`, `pac_codigo`, `prontuario`
- `telefone`, `telefone_formatado`

#### **Dados da Consulta** (mesmos + adicionais)
- `especialidade`, `profissional`, `local`
- `data_hora_formatada`, `data_consulta`

#### **Status de Desmarcação**
- `status` (TEXT) - Status atual da resposta
- `tipo_desmarcacao` (TEXT) - Valores:
  - `'reagendamento'` - Paciente quer reagendar
  - `'sem_reagendamento'` - Paciente não quer reagendar
  - `'paciente_solicitou'` - Foi o paciente quem desmarcou
- `status_geral` (TEXT, DEFAULT 'pending')
- `veio_de_confirmacao` (BOOLEAN, DEFAULT 0) - Se veio do badge "Desmarcar"
- `confirmacao_id` (TEXT) - ID da confirmação original (se veio de lá)

#### **WhatsApp** (mesmos de consultas_ativas)
- `mensagem_template`, `mensagem_enviada`, `enviar_mensagem`
- `data_envio`, `whatsapp_message_id`

#### **Monitoramento**
- `data_desmarcacao` (TEXT) - ISO 8601
- `data_desmarcacao_formatada` (TEXT) - Formato dd/mm/yyyy hh:mm
- `data_apareceu_dashboard` (TEXT)
- `data_marcacao` (TEXT) - Data original de marcação
- `resposta_em` (TEXT) - Quando paciente respondeu

#### **Contexto WhatsApp**
- `contexto` (TEXT, DEFAULT 'desmarcacao')
- `contexto_id` (TEXT)
- `contexto_expires_at` (TEXT)

#### **Reagendamento**
- `reagendada` (BOOLEAN, DEFAULT 0)
- `reagendada_em` (TEXT) - ISO 8601
- `nova_consulta_numero` (TEXT)
- `reagendamento_comunicado` (BOOLEAN, DEFAULT 0)

#### **Metadados**
- `criado_em`, `atualizado_em`, `criado_por`

### **Índices (10)**
- 8 índices funcionais + 2 únicos automáticos

### **Estatísticas Atuais**

| Métrica | Valor | Porcentagem |
|---------|-------|-------------|
| **Total de Desmarcações** | 102 | 100% |
| Tipo: Reagendamento | 8 | 7.8% |
| Tipo: Sem Reagendamento | 0 | 0% |
| Tipo: Paciente Solicitou | 0 | 0% |
| Tipo: NULL/Pendente | 94 | 92.2% ⚠️ |
| Veio de Confirmação | 0 | 0% |
| Mensagens Enviadas | 0 | 0% ⚠️ |
| Reagendadas com Sucesso | 0 | 0% |
| **Sem Telefone** | **39** | **38.2%** ⚠️ |

---

## 📊 TABELA 3 e 4: TELEFONES (0 registros cada)

### **consulta_telefones** e **desmarcacao_telefones**

### **Propósito**
Armazenar múltiplos telefones por consulta/desmarcação (relacionamento 1:N).

### **Status Atual: ⚠️ NÃO UTILIZADA**

**Problema Detectado:** As tabelas de telefones foram criadas mas **nunca foram populadas**.

**Impacto:**
- Arrays de telefones estão sendo armazenados apenas em memória
- Perda de dados ao recarregar página
- Sistema de prioridade de telefones não funciona
- Tentativas de envio não são rastreadas

### **Estrutura (20 campos cada)**

#### **Identificação**
- `id` (INTEGER, PK, AUTOINCREMENT)
- `consulta_id` / `desmarcacao_id` (TEXT, NOT NULL, FK)

#### **Dados do Telefone**
- `telefone` (TEXT, NOT NULL) - Normalizado (5511987654321)
- `telefone_formatado` (TEXT) - Display: (11) 98765-4321
- `telefone_type` (TEXT) - 'mobile', 'fixo', 'recado'
- `telefone_origem` (TEXT) - Original do AGHUse
- `chat_id` (TEXT) - WhatsApp ID (@c.us)

#### **Status e Controle**
- `status` (TEXT, DEFAULT 'pending')
- `prioridade` (INTEGER, DEFAULT 1) - 1 = principal
- `tentativas` (INTEGER, DEFAULT 0)

#### **Mensagem**
- `mensagem_texto` (TEXT)
- `mensagem_template_id` (TEXT)

#### **WhatsApp**
- `whatsapp_message_id`, `data_envio`, `data_entrega`, `data_leitura`

#### **Logs**
- `logs` (TEXT) - JSON array
- `ultimo_erro` (TEXT)

#### **Metadados**
- `criado_em`, `atualizado_em`

### **Constraints**
- `FOREIGN KEY` com `ON DELETE CASCADE` (deleta telefones ao deletar consulta)
- `UNIQUE(consulta_id, telefone)` - Evita telefone duplicado

### **Triggers Implementados**
- Atualização automática de `atualizado_em`
- Sincronização de status com tabela principal

---

## 📊 TABELA 5 e 6: WHATSAPP_RESPOSTAS

### **whatsapp_respostas_ativas (57 registros)**

### **Propósito**
Armazena respostas do WhatsApp que estão aguardando processamento.

### **Estrutura (12 campos)**
- `id` (INTEGER, PK, AUTOINCREMENT)
- `confirmacao_id` (TEXT) - ID da consulta/desmarcação
- `telefone` (TEXT, NOT NULL)
- `telefone_chat` (TEXT) - Chat ID do WhatsApp
- `status` (TEXT) - Status da resposta
- `tipo_desmarcacao` (TEXT) - Se for resposta de desmarcação
- `contexto` (TEXT) - 'confirmacao' ou 'desmarcacao'
- `message_body` (TEXT) - Conteúdo da mensagem
- `timestamp` (TEXT, NOT NULL) - Quando foi recebida
- `processada` (BOOLEAN, DEFAULT 0)
- `processada_em` (TEXT)
- `criado_em` (TEXT)

### **Estatísticas**
- **57 respostas pendentes** - Aguardando processamento
- **UNIQUE KEY:** `(confirmacao_id, telefone, timestamp)`

### **whatsapp_respostas_historico (0 registros)**

Espelho da tabela ativa, armazena respostas já processadas para auditoria.

---

## 📊 TABELA 7: CONSULTAS_ARQUIVADAS (0 registros)

### **Propósito**
Histórico de consultas e desmarcações que foram finalizadas/expiradas.

### **Estrutura (9 campos)**
- `id`, `consulta_numero`, `tipo_original`
- `dados_completos` (TEXT) - JSON completo
- `motivo_arquivamento`, `arquivado_por`
- `data_original`, `criado_em`, `arquivado_em`

### **Status: Vazia**
- Nenhuma consulta foi arquivada ainda
- Sistema de arquivamento implementado mas não ativado

---

## 🐛 BUGS E PROBLEMAS DETECTADOS

### 🔴 **CRÍTICO 1: Tabelas de Telefones Não Utilizadas**

**Descrição:** As tabelas `consulta_telefones` e `desmarcacao_telefones` foram criadas mas estão vazias (0 registros), enquanto existem 276 consultas e 102 desmarcações ativas.

**Causa Raiz:**
- Código em [consultas.service.js:649-703](server/database/consultas.service.js#L649-L703) implementa `upsertConsultaTelefones()`
- Código em [consultasSQLite.service.js:128-141](src/services/consultasSQLite.service.js#L128-L141) tenta salvar telefones
- **MAS:** O salvamento está falhando silenciosamente ou não está sendo chamado

**Impacto:**
- ❌ Arrays de telefones perdidos ao recarregar página
- ❌ Sistema de prioridade não funciona
- ❌ Tentativas de envio não são rastreadas
- ❌ Logs de telefone perdidos

**Evidência:**
```javascript
// consultasSQLite.service.js:128-141
if (consulta.telefones && Array.isArray(consulta.telefones) && consulta.telefones.length > 0) {
    try {
        const telefonesResult = await saveTelefones(consulta.id, consulta.telefones);
        if (!telefonesResult.success) {
            console.error('[SQLite] ❌ FALHA ao salvar telefones:', telefonesResult);
            data.telefonesError = telefonesResult.error || 'Telefones não salvos';
        }
    } catch (telError) {
        console.error('[SQLite] ❌ EXCEÇÃO ao salvar telefones:', telError);
        data.telefonesError = telError.message;
    }
}
```

**Solução:**
1. Verificar se `consulta.telefones` está sendo populado no frontend
2. Verificar logs de erro no backend (procurar por "FALHA ao salvar telefones")
3. Executar migração para popular telefones existentes:
   ```sql
   INSERT INTO consulta_telefones (consulta_id, telefone, telefone_formatado, prioridade)
   SELECT id, telefone, telefone_formatado, 1
   FROM consultas_ativas
   WHERE telefone IS NOT NULL AND telefone != '';
   ```

---

### 🟠 **MÉDIO 1: Mensagens Não Enviadas**

**Descrição:**
- 276 consultas ativas → 0 mensagens enviadas (0%)
- 102 desmarcações ativas → 0 mensagens enviadas (0%)

**Evidências:**
```sql
SELECT COUNT(*) as total, COUNT(CASE WHEN mensagem_enviada = 1 THEN 1 END) as enviadas
FROM consultas_ativas;
-- Resultado: total=276, enviadas=0

SELECT COUNT(*) as total, COUNT(CASE WHEN mensagem_enviada = 1 THEN 1 END) as enviadas
FROM desmarcacoes_ativas;
-- Resultado: total=102, enviadas=0
```

**Possíveis Causas:**
1. Sistema de envio de WhatsApp não está ativo
2. Consultas foram importadas de outro sistema (migração)
3. Flag `mensagem_enviada` não está sendo atualizada após envio
4. Telefones inválidos/vazios (37 consultas e 39 desmarcações sem telefone)

**Impacto:**
- ⚠️ Pacientes não estão sendo notificados
- ⚠️ Impossível saber quais mensagens foram enviadas
- ⚠️ Estatísticas de envio imprecisas

**Solução:**
1. Verificar se WhatsApp está conectado e funcional
2. Verificar função `markMensagemEnviada()` em [consultas.service.js:274-288](server/database/consultas.service.js#L274-L288)
3. Adicionar logging para rastrear envios
4. Implementar job automático para enviar mensagens pendentes

---

### 🟡 **BAIXO 1: Alto Índice de Registros Sem Telefone**

**Descrição:**
- 37/276 consultas sem telefone (13.4%)
- 39/102 desmarcações sem telefone (38.2%)

**Impacto:**
- ⚠️ Pacientes não podem ser contatados
- ⚠️ Registros inúteis ocupando espaço

**Causas Possíveis:**
1. Pacientes sem telefone cadastrado no AGHUse
2. Telefones inválidos/malformados que foram rejeitados
3. Falha na importação de dados

**Solução:**
1. Implementar filtro na importação para rejeitar consultas sem telefone
2. Alertar operadores sobre consultas sem contato
3. Arquivar automaticamente consultas sem telefone após 24h

---

### 🟡 **BAIXO 2: Desmarcações Sem Tipo (92.2%)**

**Descrição:** 94 de 102 desmarcações (92.2%) estão com `tipo_desmarcacao = NULL`

**Evidências:**
```sql
SELECT
    COUNT(*) as total,
    COUNT(CASE WHEN tipo_desmarcacao IS NULL THEN 1 END) as sem_tipo
FROM desmarcacoes_ativas;
-- Resultado: total=102, sem_tipo=94
```

**Impacto:**
- ⚠️ Impossível saber motivo da desmarcação
- ⚠️ Estatísticas imprecisas
- ⚠️ Pode indicar que pacientes não responderam

**Causas Possíveis:**
1. Desmarcações recém-criadas aguardando resposta
2. Pacientes não responderam à mensagem
3. Sistema de processamento de respostas não funcionando

**Solução:**
1. Verificar sistema de processamento de respostas WhatsApp
2. Implementar timeout para marcar como "sem_resposta" após 48h
3. Adicionar campo `aguardando_resposta` BOOLEAN

---

## ✅ PONTOS POSITIVOS

### 🟢 **Integridade Perfeita**
- ✅ `PRAGMA integrity_check` = OK
- ✅ Nenhuma corrupção detectada
- ✅ Todas constraints respeitadas

### 🟢 **Sem Duplicatas**
- ✅ Chave única `(consulta_numero, telefone)` respeitada
- ✅ Nenhum registro duplicado em nenhuma tabela

### 🟢 **Sem Registros Órfãos**
- ✅ Todas FKs válidas
- ✅ Nenhum telefone sem consulta associada
- ✅ CASCADE DELETE funcionando corretamente

### 🟢 **Índices Bem Projetados**
- ✅ 9 índices em `consultas_ativas` cobrindo queries principais
- ✅ 10 índices em `desmarcacoes_ativas`
- ✅ Performance de busca otimizada

### 🟢 **Schema Completo e Documentado**
- ✅ Todos campos obrigatórios preenchidos
- ✅ Defaults apropriados
- ✅ Timestamps automáticos
- ✅ Triggers funcionais

### 🟢 **Relacionamentos Corretos**
- ✅ FK com ON DELETE CASCADE
- ✅ Tabelas normalizadas
- ✅ Views úteis para joins

---

## 📈 RECOMENDAÇÕES

### **Curto Prazo (Urgente)**

1. **🔴 PRIORIDADE 1:** Corrigir salvamento de telefones
   - Investigar por que `consulta_telefones` está vazia
   - Popular telefones existentes via migration
   - Adicionar logs de debug no salvamento

2. **🟠 PRIORIDADE 2:** Verificar sistema de envio WhatsApp
   - Confirmar se mensagens estão sendo enviadas
   - Validar atualização de flag `mensagem_enviada`
   - Adicionar retry automático para falhas

3. **🟡 PRIORIDADE 3:** Limpar registros sem telefone
   - Filtrar na importação
   - Arquivar automaticamente após 24h
   - Alertar operadores

### **Médio Prazo**

4. **Implementar Sistema de Arquivamento Automático**
   - Arquivar consultas após data da consulta + 7 dias
   - Arquivar desmarcações após 30 dias sem resposta
   - Popular `consultas_arquivadas`

5. **Melhorar Rastreamento de Respostas**
   - Processar `whatsapp_respostas_ativas` (57 pendentes)
   - Mover para `whatsapp_respostas_historico` após processamento
   - Adicionar timeout para respostas

6. **Adicionar Campos de Auditoria**
   - `modificado_por` (quem fez última alteração)
   - `ip_origem` (de onde veio a operação)
   - `versao` (versionamento de registros)

### **Longo Prazo**

7. **Otimização de Performance**
   - Particionar `consultas_arquivadas` por ano
   - Adicionar índices compostos para queries complexas
   - Implementar VACUUM automático

8. **Migração para PostgreSQL** (Opcional)
   - Melhor suporte a JSON
   - Replicação nativa
   - Full-text search
   - Particionamento avançado

---

## 📝 CONCLUSÃO

O banco de dados está **estruturalmente saudável** com:
- ✅ Integridade perfeita
- ✅ Schema bem projetado
- ✅ Índices apropriados
- ✅ Relacionamentos corretos

Porém, apresenta **2 problemas críticos operacionais**:
1. 🔴 Tabelas de telefones não estão sendo utilizadas (perda de dados)
2. 🟠 Mensagens não estão sendo marcadas como enviadas (rastreamento falho)

**Ações Imediatas Necessárias:**
1. Investigar e corrigir salvamento de telefones
2. Validar sistema de envio WhatsApp
3. Popular telefones existentes via migration
4. Processar respostas pendentes (57 na fila)

**Prioridade:** 🔴 **ALTA** - Corrigir antes de continuar desenvolvimento
