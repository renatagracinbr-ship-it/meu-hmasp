# 🗂️ DIAGRAMA DO BANCO DE DADOS - HMASP CHAT

## 📊 VISÃO GERAL DA ARQUITETURA

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        HMASP_CONSULTAS.DB                                │
│                         (SQLite 3 - 440KB)                               │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐         ┌──────────────────┐       ┌──────────────────┐
│   CONSULTAS   │         │  DESMARCAÇÕES    │       │    RESPOSTAS     │
│    ATIVAS     │         │     ATIVAS       │       │    WHATSAPP      │
│  (276 regs)   │         │   (102 regs)     │       │   (57 regs)      │
└───────────────┘         └──────────────────┘       └──────────────────┘
        │                           │
        │ 1:N                       │ 1:N
        ▼                           ▼
┌───────────────┐         ┌──────────────────┐
│   CONSULTA    │         │  DESMARCACAO     │
│   TELEFONES   │         │   TELEFONES      │
│   (0 regs)⚠️  │         │   (0 regs)⚠️     │
└───────────────┘         └──────────────────┘

        │                           │
        └───────────────┬───────────┘
                        ▼
              ┌──────────────────┐
              │    CONSULTAS     │
              │   ARQUIVADAS     │
              │    (0 regs)      │
              └──────────────────┘
```

---

## 📋 TABELA: CONSULTAS_ATIVAS

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CONSULTAS_ATIVAS                                │
│                           (276 registros)                                │
│                         Chave: (consulta_numero, telefone)               │
├─────────────────────────────────────────────────────────────────────────┤
│ IDENTIFICAÇÃO                                                            │
│  ● id [PK] (TEXT, UUID)          - Identificador único                  │
│  ● consulta_numero (TEXT)        - Número da consulta no AGHUse         │
├─────────────────────────────────────────────────────────────────────────┤
│ PACIENTE                                                                 │
│  ○ nome_paciente (TEXT)          - Nome completo                        │
│  ○ nome_exibicao (TEXT)          - Nome abreviado (João S.)             │
│  ○ pac_codigo (TEXT)             - Código no AGHUse                     │
│  ○ prontuario (TEXT)             - Número do prontuário                 │
│  ○ telefone (TEXT)               - Telefone normalizado                 │
│  ○ telefone_formatado (TEXT)     - (11) 98765-4321                      │
├─────────────────────────────────────────────────────────────────────────┤
│ CONSULTA                                                                 │
│  ○ especialidade (TEXT)          - Cardiologia, Ortopedia...            │
│  ○ profissional (TEXT)           - Dr. Nome do Médico                   │
│  ○ local (TEXT)                  - Sala, andar, prédio                  │
│  ○ data_hora_formatada (TEXT)    - "15/12/2025 às 14:30"                │
│  ○ data_consulta (TEXT)          - ISO 8601: 2025-12-15T14:30:00        │
├─────────────────────────────────────────────────────────────────────────┤
│ STATUS & TIPO                                                            │
│  ● tipo (TEXT)                   - 'marcada' | 'lembrete72h'            │
│  ● status_geral (TEXT)           - pending | confirmed | declined...    │
│  ○ badge_status (TEXT)           - 'desmarcar' | 'desmarcada' | NULL    │
│  ○ badge_info (TEXT/JSON)        - Informações extras do badge          │
├─────────────────────────────────────────────────────────────────────────┤
│ WHATSAPP                                                                 │
│  ○ mensagem_template (TEXT)      - Template usado                       │
│  ○ mensagem_enviada (BOOL)       - 0 | 1                                │
│  ○ data_envio (TEXT/ISO)         - Quando foi enviada                   │
│  ○ whatsapp_message_id (TEXT)    - ID da mensagem no WhatsApp           │
├─────────────────────────────────────────────────────────────────────────┤
│ CONTEXTO & RESPOSTAS                                                     │
│  ○ contexto (TEXT)               - 'confirmacao' (padrão)               │
│  ○ contexto_id (TEXT)            - ID do contexto ativo                 │
│  ○ contexto_expires_at (TEXT)    - Quando expira                        │
│  ○ data_resposta (TEXT/ISO)      - Quando paciente respondeu            │
├─────────────────────────────────────────────────────────────────────────┤
│ MONITORAMENTO                                                            │
│  ○ data_marcacao (TEXT/ISO)      - Marcada no AGHUse                    │
│  ○ data_apareceu_dashboard (TEXT)- Apareceu no dashboard                │
├─────────────────────────────────────────────────────────────────────────┤
│ METADADOS                                                                │
│  ○ criado_em (TEXT/TIMESTAMP)    - Criação do registro                  │
│  ○ atualizado_em (TEXT/TIMESTAMP)- Última atualização                   │
│  ○ criado_por (TEXT)             - 'sistema' | 'operador:nome'          │
└─────────────────────────────────────────────────────────────────────────┘
            │
            │ 1:N (ON DELETE CASCADE)
            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         CONSULTA_TELEFONES                               │
│                            (0 registros) ⚠️                              │
│                         FK: consulta_id → consultas_ativas.id           │
├─────────────────────────────────────────────────────────────────────────┤
│ IDENTIFICAÇÃO                                                            │
│  ● id [PK] (INTEGER AUTOINCREMENT)                                      │
│  ● consulta_id [FK] (TEXT)       - Link para consulta                   │
│  ● telefone (TEXT)               - Normalizado: 5511987654321           │
├─────────────────────────────────────────────────────────────────────────┤
│ DADOS DO TELEFONE                                                        │
│  ○ telefone_formatado (TEXT)     - Display: (11) 98765-4321             │
│  ○ telefone_type (TEXT)          - 'mobile' | 'fixo' | 'recado'         │
│  ○ telefone_origem (TEXT)        - Original do AGHUse                   │
│  ○ chat_id (TEXT)                - WhatsApp: 5511987654321@c.us         │
├─────────────────────────────────────────────────────────────────────────┤
│ STATUS & CONTROLE                                                        │
│  ○ status (TEXT)                 - pending | sent | delivered...        │
│  ○ prioridade (INTEGER)          - 1 (principal), 2, 3...               │
│  ○ tentativas (INTEGER)          - Número de tentativas de envio        │
├─────────────────────────────────────────────────────────────────────────┤
│ MENSAGEM                                                                 │
│  ○ mensagem_texto (TEXT)         - Texto enviado                        │
│  ○ mensagem_template_id (TEXT)   - ID do template usado                 │
├─────────────────────────────────────────────────────────────────────────┤
│ WHATSAPP                                                                 │
│  ○ whatsapp_message_id (TEXT)    - ID da mensagem                       │
│  ○ data_envio (TEXT/ISO)         - Enviada                              │
│  ○ data_entrega (TEXT/ISO)       - Entregue                             │
│  ○ data_leitura (TEXT/ISO)       - Lida                                 │
├─────────────────────────────────────────────────────────────────────────┤
│ LOGS & ERROS                                                             │
│  ○ logs (TEXT/JSON)              - Array de logs                        │
│  ○ ultimo_erro (TEXT)            - Última mensagem de erro              │
├─────────────────────────────────────────────────────────────────────────┤
│ METADADOS                                                                │
│  ○ criado_em (TEXT/TIMESTAMP)                                           │
│  ○ atualizado_em (TEXT/TIMESTAMP)                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 TABELA: DESMARCACOES_ATIVAS

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DESMARCACOES_ATIVAS                               │
│                           (102 registros)                                │
│                    Chave: (consulta_numero, telefone)                    │
├─────────────────────────────────────────────────────────────────────────┤
│ IDENTIFICAÇÃO                                                            │
│  ● id [PK] (TEXT, UUID)                                                 │
│  ● consulta_numero (TEXT)        - Consulta desmarcada                  │
├─────────────────────────────────────────────────────────────────────────┤
│ PACIENTE (mesmos campos de consultas_ativas)                            │
│  ○ nome_paciente, nome_exibicao, pac_codigo, prontuario                 │
│  ○ telefone, telefone_formatado                                         │
├─────────────────────────────────────────────────────────────────────────┤
│ CONSULTA (mesmos + adicionais)                                          │
│  ○ especialidade, profissional, local                                   │
│  ○ data_hora_formatada, data_consulta                                   │
├─────────────────────────────────────────────────────────────────────────┤
│ DESMARCAÇÃO - STATUS                                                     │
│  ○ status (TEXT)                 - Status atual                         │
│  ○ tipo_desmarcacao (TEXT)       - 'reagendamento' |                    │
│                                    'sem_reagendamento' |                 │
│                                    'paciente_solicitou'                  │
│  ○ status_geral (TEXT)           - pending | ...                        │
│  ○ veio_de_confirmacao (BOOL)    - Se veio do badge "Desmarcar"         │
│  ○ confirmacao_id (TEXT)         - ID da confirmação original           │
├─────────────────────────────────────────────────────────────────────────┤
│ WHATSAPP                                                                 │
│  ○ mensagem_template (TEXT)                                             │
│  ○ mensagem_enviada (BOOL)                                              │
│  ○ enviar_mensagem (BOOL)        - Se deve enviar (0 se veio de badge)  │
│  ○ data_envio (TEXT/ISO)                                                │
│  ○ whatsapp_message_id (TEXT)                                           │
├─────────────────────────────────────────────────────────────────────────┤
│ CONTEXTO & RESPOSTAS                                                     │
│  ○ contexto (TEXT)               - 'desmarcacao' (padrão)               │
│  ○ contexto_id (TEXT)                                                   │
│  ○ contexto_expires_at (TEXT)                                           │
│  ○ resposta_em (TEXT/ISO)        - Quando paciente respondeu            │
├─────────────────────────────────────────────────────────────────────────┤
│ MONITORAMENTO                                                            │
│  ○ data_desmarcacao (TEXT/ISO)   - Desmarcada no AGHUse                 │
│  ○ data_desmarcacao_formatada    - dd/mm/yyyy hh:mm                     │
│  ○ data_apareceu_dashboard (TEXT)                                       │
│  ○ data_marcacao (TEXT/ISO)      - Data original de marcação            │
├─────────────────────────────────────────────────────────────────────────┤
│ REAGENDAMENTO                                                            │
│  ○ reagendada (BOOL)             - 0 | 1                                │
│  ○ reagendada_em (TEXT/ISO)      - Quando foi reagendada                │
│  ○ nova_consulta_numero (TEXT)   - Nova consulta criada                 │
│  ○ reagendamento_comunicado (BOOL) - Paciente foi avisado?              │
├─────────────────────────────────────────────────────────────────────────┤
│ METADADOS                                                                │
│  ○ criado_em, atualizado_em, criado_por                                 │
└─────────────────────────────────────────────────────────────────────────┘
            │
            │ 1:N (ON DELETE CASCADE)
            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       DESMARCACAO_TELEFONES                              │
│                           (0 registros) ⚠️                               │
│                   FK: desmarcacao_id → desmarcacoes_ativas.id           │
├─────────────────────────────────────────────────────────────────────────┤
│ (Mesma estrutura de consulta_telefones, mas com desmarcacao_id)         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 TABELA: WHATSAPP_RESPOSTAS_ATIVAS

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     WHATSAPP_RESPOSTAS_ATIVAS                            │
│                           (57 registros)                                 │
│          Chave Única: (confirmacao_id, telefone, timestamp)              │
├─────────────────────────────────────────────────────────────────────────┤
│ IDENTIFICAÇÃO                                                            │
│  ● id [PK] (INTEGER AUTOINCREMENT)                                      │
│  ○ confirmacao_id (TEXT)         - ID da consulta/desmarcação           │
│  ● telefone (TEXT)               - Quem respondeu                       │
│  ○ telefone_chat (TEXT)          - Chat ID WhatsApp                     │
├─────────────────────────────────────────────────────────────────────────┤
│ RESPOSTA                                                                 │
│  ○ status (TEXT)                 - Status da resposta                   │
│  ○ tipo_desmarcacao (TEXT)       - Se for resposta de desmarcação       │
│  ○ contexto (TEXT)               - 'confirmacao' | 'desmarcacao'        │
│  ○ message_body (TEXT)           - Conteúdo da mensagem                 │
├─────────────────────────────────────────────────────────────────────────┤
│ PROCESSAMENTO                                                            │
│  ● timestamp (TEXT/ISO)          - Quando foi recebida                  │
│  ○ processada (BOOL)             - 0 (pendente) | 1 (processada)        │
│  ○ processada_em (TEXT/ISO)      - Quando foi processada                │
│  ○ criado_em (TEXT/TIMESTAMP)                                           │
└─────────────────────────────────────────────────────────────────────────┘
            │
            │ Após processamento
            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                   WHATSAPP_RESPOSTAS_HISTORICO                           │
│                            (0 registros)                                 │
│               FK: resposta_id → whatsapp_respostas_ativas.id            │
├─────────────────────────────────────────────────────────────────────────┤
│ (Mesma estrutura + campos de auditoria)                                 │
│  ● resposta_id [FK] (INTEGER)    - Link para resposta original          │
│  ○ motivo_arquivamento (TEXT)    - Por que foi arquivada                │
│  ○ arquivado_em (TEXT/TIMESTAMP) - Quando foi arquivada                 │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 TABELA: CONSULTAS_ARQUIVADAS

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       CONSULTAS_ARQUIVADAS                               │
│                            (0 registros)                                 │
│                        Histórico de Consultas                            │
├─────────────────────────────────────────────────────────────────────────┤
│ IDENTIFICAÇÃO                                                            │
│  ● id [PK] (TEXT)                - Mesmo ID da consulta original        │
│  ○ consulta_numero (TEXT)        - Número da consulta                   │
├─────────────────────────────────────────────────────────────────────────┤
│ TIPO & DADOS                                                             │
│  ● tipo_original (TEXT)          - 'consulta_ativa' |                   │
│                                    'desmarcacao_ativa'                   │
│  ● dados_completos (TEXT/JSON)   - JSON completo do registro            │
├─────────────────────────────────────────────────────────────────────────┤
│ ARQUIVAMENTO                                                             │
│  ○ motivo_arquivamento (TEXT)    - 'manual' | 'automatico' |            │
│                                    'consulta_realizada' | ...            │
│  ○ arquivado_por (TEXT)          - 'sistema' | 'operador:nome'          │
├─────────────────────────────────────────────────────────────────────────┤
│ TIMESTAMPS                                                               │
│  ○ data_original (TEXT/ISO)      - Data da consulta original            │
│  ○ criado_em (TEXT/TIMESTAMP)    - Quando foi criado originalmente      │
│  ○ arquivado_em (TEXT/TIMESTAMP) - Quando foi arquivado                 │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔗 RELACIONAMENTOS E FLUXOS

### **FLUXO 1: Consulta Marcada → Confirmação**

```
┌─────────────┐
│   AGHUse    │  Consulta marcada
│   Sistema   │
└──────┬──────┘
       │ Importação
       ▼
┌──────────────────┐
│ CONSULTAS_ATIVAS │  tipo='marcada'
│  status='pending'│  mensagem_enviada=0
└────────┬─────────┘
         │ Deveria criar →  ┌────────────────────┐
         │                   │ CONSULTA_TELEFONES │  ⚠️ NÃO CRIADO
         │                   │  prioridade=1,2,3  │
         │                   └────────────────────┘
         │
         │ Envio WhatsApp
         ▼
┌──────────────────┐
│  WhatsApp API    │  Mensagem: "1-Confirmo | 2-Não vou | 3-Não agendei"
└────────┬─────────┘
         │ Resposta do paciente
         ▼
┌─────────────────────────┐
│ WHATSAPP_RESPOSTAS_     │  message_body="1"
│      ATIVAS             │  processada=0
└───────────┬─────────────┘
            │ Processamento
            ▼
┌──────────────────┐              ┌─────────────────────────┐
│ CONSULTAS_ATIVAS │  ───────────>│ WHATSAPP_RESPOSTAS_     │
│ status='confirmed'│  Atualiza    │      HISTORICO          │
│ data_resposta=NOW │              │ motivo='resposta_1_ok'  │
└──────────────────┘              └─────────────────────────┘
```

### **FLUXO 2: Desmarcação → Reagendamento**

```
┌─────────────┐
│   AGHUse    │  Consulta desmarcada
│   Sistema   │
└──────┬──────┘
       │ Importação
       ▼
┌───────────────────────┐
│ DESMARCACOES_ATIVAS   │  tipo_desmarcacao=NULL
│  status='pending'     │  veio_de_confirmacao=0
│  mensagem_enviada=0   │
└──────────┬────────────┘
           │ Deveria criar →  ┌────────────────────────┐
           │                   │ DESMARCACAO_TELEFONES  │  ⚠️ NÃO CRIADO
           │                   └────────────────────────┘
           │
           │ Envio WhatsApp
           ▼
┌──────────────────┐
│  WhatsApp API    │  "1-Reagendar | 2-Eu desmarcou | 3-Não reagendar"
└────────┬─────────┘
         │ Resposta "1" (reagendar)
         ▼
┌───────────────────────┐
│ DESMARCACOES_ATIVAS   │  tipo_desmarcacao='reagendamento'
│  status='reagendamento'│  reagendada=0 (aguardando)
└──────────┬────────────┘
           │ Operador reagenda
           ▼
┌───────────────────────┐              ┌──────────────────┐
│ DESMARCACOES_ATIVAS   │  ───────────>│ CONSULTAS_ATIVAS │
│  reagendada=1         │  Nova consulta│  tipo='marcada'  │
│  nova_consulta_numero │              └──────────────────┘
└───────────────────────┘
           │ Comunicação
           ▼
┌──────────────────┐
│  WhatsApp API    │  "Consulta reagendada para 20/12 às 15h"
└──────────────────┘
```

### **FLUXO 3: Badge "Desmarcar" na Confirmação**

```
┌──────────────────┐
│ CONSULTAS_ATIVAS │  Paciente respondeu "2" (Não vou)
│ status='declined'│
└────────┬─────────┘
         │ Operador clica "Desmarcar"
         ▼
┌──────────────────┐
│ CONSULTAS_ATIVAS │  badge_status='desmarcar'
│ badge_info={...} │  Mostra badge vermelho
└────────┬─────────┘
         │ Operador confirma desmarcação
         ▼
┌───────────────────────┐
│ DESMARCACOES_ATIVAS   │  veio_de_confirmacao=1
│  confirmacao_id=xxx   │  enviar_mensagem=0 (não envia)
│  tipo_desmarcacao='paciente_solicitou'
└──────────┬────────────┘
           │
           ▼
┌──────────────────┐
│ CONSULTAS_ATIVAS │  badge_status='desmarcada'
│ (registro antigo)│  badge_info={desmarcacaoId:...}
└──────────────────┘
```

---

## 📊 ÍNDICES E PERFORMANCE

### **CONSULTAS_ATIVAS (9 índices)**

```
idx_consultas_ativas_consulta_numero     → WHERE consulta_numero = ?
idx_consultas_ativas_telefone            → WHERE telefone = ?
idx_consultas_ativas_tipo                → WHERE tipo = 'marcada'
idx_consultas_ativas_status              → WHERE status_geral = 'pending'
idx_consultas_ativas_data_consulta       → ORDER BY data_consulta
idx_consultas_ativas_badge               → WHERE badge_status IS NOT NULL
idx_consultas_ativas_data_resposta       → ORDER BY data_resposta DESC
sqlite_autoindex_consultas_ativas_1 [U]  → PRIMARY KEY (id)
sqlite_autoindex_consultas_ativas_2 [U]  → UNIQUE (consulta_numero, telefone)
```

### **DESMARCACOES_ATIVAS (10 índices)**

```
idx_desmarcacoes_ativas_consulta_numero  → WHERE consulta_numero = ?
idx_desmarcacoes_ativas_telefone         → WHERE telefone = ?
idx_desmarcacoes_ativas_tipo             → WHERE tipo_desmarcacao = ?
idx_desmarcacoes_ativas_confirmacao      → WHERE confirmacao_id = ?
idx_desmarcacoes_ativas_data             → ORDER BY data_desmarcacao
idx_desmarcacoes_ativas_reagendada       → WHERE reagendada = 1
idx_desmarcacoes_ativas_resposta_em      → ORDER BY resposta_em
idx_desmarcacoes_ativas_contexto         → WHERE contexto = 'desmarcacao'
sqlite_autoindex_desmarcacoes_ativas_1 [U] → PRIMARY KEY (id)
sqlite_autoindex_desmarcacoes_ativas_2 [U] → UNIQUE (consulta_numero, telefone)
```

---

## 🔍 VIEWS DISPONÍVEIS

### **vw_consultas_com_telefones**
```sql
SELECT
    c.*,
    GROUP_CONCAT(
        json_object(
            'telefone', t.telefone,
            'telefoneFormatado', t.telefone_formatado,
            'status', t.status,
            'prioridade', t.prioridade
        ), '|||'
    ) as telefones_json
FROM consultas_ativas c
LEFT JOIN consulta_telefones t ON c.id = t.consulta_id
GROUP BY c.id;
```

### **vw_stats_confirmacoes**
```sql
SELECT
    COUNT(*) as total,
    SUM(CASE WHEN tipo = 'marcada' THEN 1 END) as marcadas,
    SUM(CASE WHEN tipo = 'lembrete72h' THEN 1 END) as lembretes,
    SUM(CASE WHEN status_geral = 'pending' THEN 1 END) as pendentes,
    SUM(CASE WHEN status_geral = 'confirmed' THEN 1 END) as confirmadas,
    SUM(CASE WHEN mensagem_enviada = 1 THEN 1 END) as enviadas
FROM consultas_ativas;
```

---

## ⚠️ PROBLEMAS DETECTADOS NO DIAGRAMA

### 🔴 **CRÍTICO: Tabelas de Telefones Vazias**

```
┌──────────────────┐       ┌────────────────────┐
│ CONSULTAS_ATIVAS │ 1:N   │ CONSULTA_TELEFONES │
│   276 registros  │──────>│   0 registros ⚠️   │
└──────────────────┘       └────────────────────┘
                           DEVERIA TER ~276+
```

**Consequência:** Telefones estão apenas no campo `telefone` da tabela principal, perdendo:
- Sistema de prioridade
- Múltiplos telefones por paciente
- Logs de tentativas
- Status individual por telefone

---

## 📐 NORMALIZAÇÃO DO BANCO

- ✅ **1NF:** Todos campos atômicos
- ✅ **2NF:** Não há dependências parciais
- ✅ **3NF:** Não há dependências transitivas
- ⚠️ **Problema:** Arrays de telefones desnormalizados (JSON no campo `badge_info`)

---

## 🎯 CONCLUSÃO DO DIAGRAMA

O banco está **bem estruturado** mas **subutilizado**:
- ✅ Relacionamentos corretos (1:N com CASCADE)
- ✅ Índices bem posicionados
- ✅ Views úteis implementadas
- ❌ Tabelas de telefones não sendo usadas
- ❌ Sistema de arquivamento não ativo
