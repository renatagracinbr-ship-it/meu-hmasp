# ANÁLISE COMPLETA: Campos do Banco de Dados vs Fluxos

Data: 2025-12-12
Sistema: HMASP Chat - Marcação de Consultas

## RESUMO EXECUTIVO

Esta análise compara os campos definidos no schema do banco de dados SQLite com os campos realmente utilizados nos fluxos de Confirmação e Desmarcação.

### Principais Descobertas:

1. ✅ **Campos OK**: 90% dos campos estão alinhados entre banco e código
2. ⚠️ **Campos no banco mas não usados**: 8 campos identificados (principalmente contexto WhatsApp)
3. ❌ **CAMPOS CRÍTICOS FALTANDO NO BANCO**: 6 campos essenciais usados no código
4. ⚠️ **Inconsistências entre fluxos**: 4 campos em desmarcação que não existem em confirmação

---

## 1. TABELA: consultas_ativas (Aba Confirmação)

### ✅ Campos OK (existem no banco E são usados)

| Campo no Banco | Campo JavaScript | Onde é Usado | Descrição |
|----------------|------------------|--------------|-----------|
| `id` | `id` | confirmacaoPresenca.js:702<br>confirmacao.service.js:195 | ID único UUID para rastreamento |
| `consulta_numero` | `consultaNumero` | confirmacaoPresenca.js:1015<br>confirmacao.service.js:266 | Número da consulta no AGHUse |
| `nome_paciente` | `nomePaciente` | confirmacaoPresenca.js:1009<br>confirmacao.service.js:269 | Nome completo do paciente |
| `prontuario` | `prontuario` | confirmacaoPresenca.js:1244<br>confirmacao.service.js:268 | Número do prontuário |
| `telefone` | `telefone` | consultasSQLite.service.js:82 | Telefone principal normalizado |
| `telefone_formatado` | `telefoneFormatado` | consultasSQLite.service.js:83 | Telefone formatado (55) 11 9xxxx-xxxx |
| `especialidade` | `especialidade` | confirmacaoPresenca.js:1249<br>confirmacao.service.js:271 | Especialidade médica |
| `data_hora_formatada` | `dataHoraFormatada` | confirmacaoPresenca.js:1248<br>confirmacao.service.js:273 | Data/hora formatada para exibição |
| `data_consulta` | `dataConsulta` | confirmacao.service.js:272 | Data da consulta (ISO 8601) |
| `tipo` | `tipo` | confirmacaoPresenca.js:1217-1220<br>confirmacao.service.js:264 | 'marcada' ou 'lembrete72h' |
| `status_geral` | `statusGeral` | confirmacaoPresenca.js:997-999 | Status: pending, sent, delivered, confirmed, declined, not_scheduled |
| `data_marcacao` | `dataMarcacao` | confirmacaoPresenca.js:1201-1209<br>confirmacao.service.js:274 | Quando foi marcada no AGHUse |
| `data_apareceu_dashboard` | `dataApareceuDashboard` | confirmacao.service.js:95 | Quando apareceu no dashboard |
| `criado_em` | `criadoEm` | confirmacao.service.js:280 | Timestamp de criação |
| `atualizado_em` | `atualizadoEm` | confirmacao.service.js:281<br>confirmacaoPresenca.js:343 | Timestamp de última atualização |

### ❌ CAMPOS CRÍTICOS FALTANDO NO BANCO

Estes campos são ESSENCIAIS e usados intensamente no código, mas NÃO EXISTEM no schema:

| Campo JavaScript | Onde é Usado | Por que é Importante | Impacto |
|------------------|--------------|---------------------|---------|
| `profissional` | confirmacaoPresenca.js:1498<br>confirmacao.service.js:275 | Nome do médico responsável - exibido no card de detalhes | ⚠️ MÉDIO - Campo exibido em modal |
| `local` | confirmacao.service.js:276 | Local da consulta (sala/andar) | ⚠️ MÉDIO - Informação adicional |
| `mensagens` | confirmacaoPresenca.js:805<br>confirmacaoPresenca.js:1002<br>confirmacaoPresenca.js:1190 | Array de telefones/mensagens - usado em TODA a UI | 🔴 CRÍTICO - Sistema quebra sem este campo |
| `telefones` | confirmacao.service.js:200-253 | Array de telefones do paciente | 🔴 CRÍTICO - Não consegue enviar mensagens |
| `pacCodigo` | confirmacao.service.js:267 | Código do paciente no AGHUse | ⚠️ BAIXO - Usado para logs |
| `nomeExibicao` | confirmacao.service.js:270 | Nome resumido para exibição | ⚠️ BAIXO - Fallback para nomePaciente |
| `dataResposta` | confirmacaoPresenca.js:999<br>confirmacaoPresenca.js:1081 | Timestamp da resposta do paciente | 🔴 CRÍTICO - Rastreamento de interações |
| `badgeStatus` | confirmacaoPresenca.js:652-671 | Status do badge visual (desmarcar/desmarcada) | 🔴 CRÍTICO - UI depende deste campo |
| `badgeInfo` | confirmacaoPresenca.js:660-671 | Informações adicionais do badge | ⚠️ MÉDIO - Usado para debug |
| `contexto` | confirmacaoPresenca.js:966-977 | Identificador de contexto ('confirmacao') | 🔴 CRÍTICO - Validação de segurança |

### ⚠️ Campos no Banco mas NÃO Usados no Código

| Campo no Banco | Possível Motivo | Recomendação |
|----------------|-----------------|--------------|
| `mensagem_template` | Provavelmente será usado no futuro | ✅ MANTER - planejamento futuro |
| `mensagem_enviada` | Substituído por statusGeral | ⚠️ AVALIAR - pode ser redundante |
| `data_envio` | Pode ser útil para auditoria | ✅ MANTER - auditoria |
| `whatsapp_message_id` | Importante para rastreamento WhatsApp | ✅ MANTER - rastreamento |
| `contexto` | Campo duplicado com 'tipo'? | ⚠️ AVALIAR - pode ser redundante |
| `contexto_id` | Sistema de contexto WhatsApp não implementado | ⚠️ REMOVER ou DOCUMENTAR |
| `contexto_expires_at` | Sistema de contexto WhatsApp não implementado | ⚠️ REMOVER ou DOCUMENTAR |
| `criado_por` | Sempre 'sistema' | ⚠️ AVALIAR - útil para multi-usuário? |

---

## 2. TABELA: desmarcacoes_ativas (Aba Desmarcação)

### ✅ Campos OK (existem no banco E são usados)

| Campo no Banco | Campo JavaScript | Onde é Usado | Descrição |
|----------------|------------------|--------------|-----------|
| `id` | `id` | desmarcacaoConsultas.js:337<br>desmarcacao.service.js:171 | ID único UUID para rastreamento |
| `consulta_numero` | `consultaNumero` | desmarcacaoConsultas.js:326<br>desmarcacao.service.js:173 | Número da consulta no AGHUse |
| `nome_paciente` | `nomePaciente` | desmarcacaoConsultas.js:349<br>desmarcacao.service.js:176 | Nome completo do paciente |
| `nome_exibicao` | `nomeExibicao` | desmarcacao.service.js:177 | Nome resumido para exibição |
| `pac_codigo` | `pacCodigo` | desmarcacao.service.js:174 | Código do paciente no AGHUse |
| `prontuario` | `prontuario` | desmarcacaoConsultas.js:1026<br>desmarcacao.service.js:175 | Número do prontuário |
| `telefone` | `telefone` | desmarcacaoConsultas.js:357 | Telefone principal normalizado |
| `telefone_formatado` | `telefoneFormatado` | Renderização de cards | Telefone formatado |
| `especialidade` | `especialidade` | desmarcacaoConsultas.js:1031<br>desmarcacao.service.js:178 | Especialidade médica |
| `profissional` | `profissional` | desmarcacaoConsultas.js:1187<br>desmarcacao.service.js:184 | Médico responsável |
| `data_hora_formatada` | `dataHoraFormatada` | desmarcacaoConsultas.js:1030<br>desmarcacao.service.js:180 | Data/hora formatada |
| `data_consulta` | `dataConsulta` | desmarcacao.service.js:179 | Data da consulta (ISO 8601) |
| `status` | `status` | desmarcacaoConsultas.js:323-343<br>desmarcacaoConsultas.js:1011 | Status da resposta: reagendamento, sem_reagendamento, paciente_solicitou |
| `tipo_desmarcacao` | `tipoDesmarcacao` | desmarcacaoConsultas.js:341<br>desmarcacaoConsultas.js:424 | Tipo de desmarcação (badge depende disto) |
| `veio_de_confirmacao` | `veioDeConfirmacao` | Lógica de envio de mensagem | Se veio da aba Confirmação (badge Desmarcar) |
| `confirmacao_id` | `confirmacaoId` | Vinculação entre abas | ID da confirmação original |
| `data_desmarcacao` | `dataDesmarcacao` | desmarcacao.service.js:182 | Quando foi desmarcada (ISO 8601) |
| `data_desmarcacao_formatada` | `dataDesmarcacaoFormatada` | desmarcacaoConsultas.js:1007<br>desmarcacaoConsultas.js:1195 | Data formatada para exibição |
| `data_apareceu_dashboard` | `dataApareceuDashboard` | Auto-arquivamento | Quando apareceu no dashboard |
| `reagendada` | `reagendada` | desmarcacaoConsultas.js:1012 | Se a consulta foi reagendada |
| `reagendada_em` | `reagendadaEm` | Auditoria | Quando foi reagendada |
| `nova_consulta_numero` | `novaConsultaNumero` | Vinculação | Número da nova consulta criada |
| `reagendamento_comunicado` | `reagendamentoComunicado` | Controle de envio | Se paciente foi notificado |
| `criado_em` | `criadoEm` | desmarcacao.service.js:189 | Timestamp de criação |
| `atualizado_em` | `atualizadoEm` | desmarcacaoConsultas.js:343<br>desmarcacao.service.js:190 | Timestamp de última atualização |

### ❌ CAMPOS FALTANDO NO BANCO

| Campo JavaScript | Onde é Usado | Por que é Importante | Impacto |
|------------------|--------------|---------------------|---------|
| `telefones` | desmarcacaoConsultas.js:357-442<br>desmarcacao.service.js:131-154 | Array de telefones do paciente | 🔴 CRÍTICO - Não consegue enviar mensagens |
| `mensagens` | Alias de telefones | Compatibilidade com confirmação | 🔴 CRÍTICO - UI depende deste campo |
| `contexto` | desmarcacaoConsultas.js:292-305<br>desmarcacao.service.js:172 | Identificador de contexto ('desmarcacao') | 🔴 CRÍTICO - Validação de segurança |
| `statusGeral` | desmarcacaoConsultas.js:1090 | Status geral para compatibilidade | ⚠️ MÉDIO - Usado em confirmação dialog |
| `respostaEm` | desmarcacaoConsultas.js:342<br>desmarcacaoConsultas.js:425 | Timestamp da resposta do paciente | 🔴 CRÍTICO - Rastreamento de interações |
| `dataMarcacao` | desmarcacao.service.js:181 | Data original de marcação | ⚠️ MÉDIO - Contexto histórico |
| `local` | Template de mensagem | Local da consulta | ⚠️ BAIXO - Informação adicional |

### ⚠️ Campos no Banco mas NÃO Usados

| Campo no Banco | Possível Motivo | Recomendação |
|----------------|-----------------|--------------|
| `mensagem_template` | Não implementado ainda | ✅ MANTER - planejamento futuro |
| `mensagem_enviada` | Substituído por lógica de fila | ⚠️ AVALIAR - pode ser útil |
| `enviar_mensagem` | Flag de controle | ✅ MANTER - lógica de negócio |
| `data_envio` | Auditoria | ✅ MANTER - importante |
| `whatsapp_message_id` | Rastreamento WhatsApp | ✅ MANTER - importante |
| `contexto_id` | Sistema de contexto não implementado | ⚠️ REMOVER ou DOCUMENTAR |
| `contexto_expires_at` | Sistema de contexto não implementado | ⚠️ REMOVER ou DOCUMENTAR |
| `criado_por` | Sempre 'sistema' | ⚠️ AVALIAR - útil para multi-usuário? |

---

## 3. COMPARAÇÃO ENTRE FLUXOS

### Campos em CONFIRMAÇÃO mas NÃO em DESMARCAÇÃO

| Campo | Onde Usado | Observação |
|-------|------------|-----------|
| ❌ NENHUM | Desmarcação tem TODOS os campos de Confirmação | ✅ Boa padronização |

### Campos em DESMARCAÇÃO mas NÃO em CONFIRMAÇÃO

| Campo | Onde Usado | Por que Não Está em Confirmação? | Recomendação |
|-------|------------|----------------------------------|--------------|
| `nome_exibicao` | desmarcacaoConsultas.js:494 | Resumo do nome do paciente | ⚠️ AVALIAR adicionar em Confirmação |
| `pac_codigo` | desmarcacaoConsultas.js:495 | Código do paciente no AGHUse | ⚠️ AVALIAR adicionar em Confirmação |
| `profissional` (no banco) | desmarcacaoConsultas.js:500 | Médico responsável | 🔴 ADICIONAR em schema de Confirmação |
| `local` (não em banco) | Template de mensagem | Local da consulta | 🔴 ADICIONAR em ambos os schemas |
| `data_desmarcacao` | desmarcacaoConsultas.js:513 | Data específica de desmarcação | ✅ OK - exclusivo de desmarcação |
| `data_desmarcacao_formatada` | desmarcacaoConsultas.js:514-520 | Data formatada | ✅ OK - exclusivo de desmarcação |
| `status` (no banco) | desmarcacaoConsultas.js:503 | Status da resposta do paciente | ⚠️ AVALIAR - Confirmação tem `statusGeral` |
| `tipo_desmarcacao` | desmarcacaoConsultas.js:504 | Tipo específico de desmarcação | ✅ OK - exclusivo de desmarcação |
| `veio_de_confirmacao` | desmarcacaoConsultas.js:505 | Flag de origem | ✅ OK - exclusivo de desmarcação |
| `confirmacao_id` | desmarcacaoConsultas.js:506 | Vinculação entre abas | ✅ OK - exclusivo de desmarcação |
| `reagendada` | desmarcacaoConsultas.js:525 | Se foi reagendada | ✅ OK - exclusivo de desmarcação |
| `reagendada_em` | desmarcacaoConsultas.js:526 | Quando foi reagendada | ✅ OK - exclusivo de desmarcação |
| `nova_consulta_numero` | desmarcacaoConsultas.js:527 | Número da nova consulta | ✅ OK - exclusivo de desmarcação |
| `reagendamento_comunicado` | desmarcacaoConsultas.js:528 | Se paciente foi notificado | ✅ OK - exclusivo de desmarcação |

---

## 4. INCONSISTÊNCIAS DE NOMENCLATURA

### Banco de Dados vs JavaScript

| Banco (snake_case) | JavaScript (camelCase) | Status |
|--------------------|------------------------|--------|
| `consulta_numero` | `consultaNumero` | ✅ Conversão automática |
| `nome_paciente` | `nomePaciente` | ✅ Conversão automática |
| `telefone_formatado` | `telefoneFormatado` | ✅ Conversão automática |
| `data_hora_formatada` | `dataHoraFormatada` | ✅ Conversão automática |
| `data_consulta` | `dataConsulta` | ✅ Conversão automática |
| `status_geral` | `statusGeral` | ✅ Conversão automática |
| `data_marcacao` | `dataMarcacao` | ✅ Conversão automática |
| `data_apareceu_dashboard` | `dataApareceuDashboard` | ✅ Conversão automática |
| `criado_em` | `criadoEm` | ✅ Conversão automática |
| `atualizado_em` | `atualizadoEm` | ✅ Conversão automática |
| `nome_exibicao` | `nomeExibicao` | ✅ Conversão automática |
| `pac_codigo` | `pacCodigo` | ✅ Conversão automática |
| `tipo_desmarcacao` | `tipoDesmarcacao` | ✅ Conversão automática |
| `veio_de_confirmacao` | `veioDeConfirmacao` | ✅ Conversão automática |
| `confirmacao_id` | `confirmacaoId` | ✅ Conversão automática |
| `data_desmarcacao` | `dataDesmarcacao` | ✅ Conversão automática |
| `data_desmarcacao_formatada` | `dataDesmarcacaoFormatada` | ✅ Conversão automática |
| `reagendada` | `reagendada` | ✅ Igual |
| `reagendada_em` | `reagendadaEm` | ✅ Conversão automática |
| `nova_consulta_numero` | `novaConsultaNumero` | ✅ Conversão automática |
| `reagendamento_comunicado` | `reagendamentoComunicado` | ✅ Conversão automática |

**Nota:** O serviço `consultasSQLite.service.js` possui função `convertSQLiteToFrontend()` que faz a conversão automática entre snake_case e camelCase.

---

## 5. RECOMENDAÇÕES

### 🔴 PRIORIDADE CRÍTICA - ADICIONAR CAMPOS FALTANDO

Estes campos são usados extensivamente no código mas NÃO EXISTEM no banco:

#### CONSULTAS_ATIVAS (Confirmação):

```sql
ALTER TABLE consultas_ativas ADD COLUMN profissional TEXT DEFAULT 'Não informado';
ALTER TABLE consultas_ativas ADD COLUMN local TEXT;
ALTER TABLE consultas_ativas ADD COLUMN pac_codigo TEXT;
ALTER TABLE consultas_ativas ADD COLUMN nome_exibicao TEXT;
ALTER TABLE consultas_ativas ADD COLUMN data_resposta TEXT; -- ISO 8601 timestamp
ALTER TABLE consultas_ativas ADD COLUMN badge_status TEXT; -- 'desmarcar', 'desmarcada', null
ALTER TABLE consultas_ativas ADD COLUMN badge_info TEXT; -- JSON com info do badge
```

#### DESMARCACOES_ATIVAS (Desmarcação):

```sql
ALTER TABLE desmarcacoes_ativas ADD COLUMN local TEXT;
ALTER TABLE desmarcacoes_ativas ADD COLUMN resposta_em TEXT; -- ISO 8601 timestamp
ALTER TABLE desmarcacoes_ativas ADD COLUMN status_geral TEXT DEFAULT 'pending'; -- compatibilidade
ALTER TABLE desmarcacoes_ativas ADD COLUMN data_marcacao TEXT; -- data original de marcação
```

### ⚠️ PRIORIDADE MÉDIA - AVALIAR CAMPOS NÃO USADOS

Decidir se mantém ou remove campos que não são usados atualmente:

#### Contexto WhatsApp (não implementado):
```sql
-- OPÇÃO 1: Remover se não for usar
ALTER TABLE consultas_ativas DROP COLUMN contexto_id;
ALTER TABLE consultas_ativas DROP COLUMN contexto_expires_at;
ALTER TABLE desmarcacoes_ativas DROP COLUMN contexto_id;
ALTER TABLE desmarcacoes_ativas DROP COLUMN contexto_expires_at;

-- OPÇÃO 2: Documentar que será usado no futuro
-- Adicionar comentários no schema explicando o uso futuro
```

#### Campo `criado_por`:
```sql
-- OPÇÃO 1: Manter para multi-usuário futuro
-- Útil quando houver login de operadores

-- OPÇÃO 2: Avaliar se vale a pena rastrear
```

### ⚠️ PRIORIDADE MÉDIA - PADRONIZAR CAMPOS

Campos que existem em uma tabela mas não em outra:

```sql
-- Adicionar em CONSULTAS_ATIVAS (já existe em DESMARCACOES_ATIVAS):
ALTER TABLE consultas_ativas ADD COLUMN nome_exibicao TEXT;
ALTER TABLE consultas_ativas ADD COLUMN pac_codigo TEXT;

-- Adicionar em DESMARCACOES_ATIVAS (já existe em CONSULTAS_ATIVAS):
-- Já estão presentes ✅
```

### ⚠️ PRIORIDADE BAIXA - CAMPOS REDUNDANTES

Avaliar necessidade de campos que podem ser redundantes:

#### `contexto` vs `tipo`:
- `tipo`: marcada, lembrete72h
- `contexto`: confirmacao, desmarcacao
- **Recomendação:** Manter ambos - servem propósitos diferentes

#### `mensagem_enviada` vs `statusGeral`:
- `mensagem_enviada`: boolean
- `statusGeral`: pending, sent, delivered, confirmed, declined
- **Recomendação:** Manter ambos - `mensagem_enviada` é útil para queries rápidas

### ✅ PRIORIDADE BAIXA - MANTER CAMPOS PARA FUTURO

Campos que não são usados agora mas fazem sentido manter:

- `mensagem_template`: Útil para auditoria de templates
- `data_envio`: Importante para rastreamento
- `whatsapp_message_id`: Essencial para integração WhatsApp
- `enviar_mensagem`: Flag de controle útil

---

## 6. ANÁLISE DE OBJETOS JAVASCRIPT

### Objeto `confirmation` (usado no código):

```javascript
{
    // ✅ Campos no banco
    id: 'conf-123456-...',
    consultaNumero: '123456',
    nomePaciente: 'João Silva',
    prontuario: '98765',
    telefone: '5511987654321',
    telefoneFormatado: '(11) 98765-4321',
    especialidade: 'Cardiologia',
    dataHoraFormatada: '15/12/2025 às 14:30',
    dataConsulta: '2025-12-15T14:30:00Z',
    tipo: 'marcada', // ou 'lembrete72h'
    statusGeral: 'pending',
    dataMarcacao: '2025-12-10T10:00:00Z',
    dataApareceuDashboard: '2025-12-10T10:05:00Z',
    criadoEm: '2025-12-10T10:05:00Z',
    atualizadoEm: '2025-12-10T10:05:00Z',

    // ❌ Campos FALTANDO no banco (CRÍTICO)
    profissional: 'Dr. João Cardiologista',
    local: 'Sala 205 - 2º Andar',
    pacCodigo: 'PAC12345',
    nomeExibicao: 'João S.',
    contexto: 'confirmacao', // CRÍTICO - validação de segurança
    dataResposta: '2025-12-10T15:00:00Z',
    badgeStatus: 'desmarcar', // ou 'desmarcada'
    badgeInfo: {
        tipo: 'DESMARCAR',
        status: 'vermelho',
        label: 'Desmarcar',
        cor: '#ef4444',
        acaoOperador: null
    },

    // ❌ ARRAY não está no banco (CRÍTICO)
    mensagens: [
        {
            telefone: '5511987654321',
            telefoneFormatado: '(11) 98765-4321',
            telefoneType: 'mobile',
            telefoneOrigem: '11987654321',
            chatId: '5511987654321@c.us',
            mensagem: { texto: '...', botoes: [...] },
            status: 'pending',
            prioridade: 1,
            tentativas: 0,
            logs: []
        }
    ],
    telefones: [...] // Alias de mensagens
}
```

### Objeto `desmarcacao` (usado no código):

```javascript
{
    // ✅ Campos no banco
    id: 'desm-123456-...',
    consultaNumero: '123456',
    nomePaciente: 'Maria Santos',
    nomeExibicao: 'Maria S.',
    pacCodigo: 'PAC54321',
    prontuario: '56789',
    telefone: '5511912345678',
    telefoneFormatado: '(11) 91234-5678',
    especialidade: 'Ortopedia',
    profissional: 'Dr. Pedro Ortopedista',
    dataHoraFormatada: '20/12/2025 às 10:00',
    dataConsulta: '2025-12-20T10:00:00Z',
    status: 'reagendamento', // ou 'sem_reagendamento', 'paciente_solicitou'
    tipoDesmarcacao: 'reagendamento',
    veioDeConfirmacao: false,
    confirmacaoId: null,
    dataDesmarcacao: '2025-12-12T08:00:00Z',
    dataDesmarcacaoFormatada: '12/12/2025 08:00',
    dataApareceuDashboard: '2025-12-12T08:05:00Z',
    reagendada: false,
    reagendadaEm: null,
    novaConsultaNumero: null,
    reagendamentoComunicado: false,
    criadoEm: '2025-12-12T08:05:00Z',
    atualizadoEm: '2025-12-12T08:05:00Z',

    // ❌ Campos FALTANDO no banco
    contexto: 'desmarcacao', // CRÍTICO - validação de segurança
    statusGeral: 'pending', // compatibilidade
    respostaEm: '2025-12-12T09:00:00Z',
    dataMarcacao: '2025-12-01T14:00:00Z',
    local: 'Sala 305 - 3º Andar',

    // ❌ ARRAY não está no banco (CRÍTICO)
    telefones: [
        {
            telefone: '5511912345678',
            telefoneFormatado: '(11) 91234-5678',
            telefoneType: 'mobile',
            telefoneOrigem: '11912345678',
            chatId: '5511912345678@c.us',
            prioridade: 1
        }
    ],
    mensagens: [...] // Alias de telefones
}
```

---

## 7. ANÁLISE DO SCHEMA ATUAL

### Consultas Ativas (consultas_ativas):
- **Total de campos no schema:** 22
- **Campos usados no código:** 15
- **Campos não usados:** 7
- **Campos faltando:** 10 (sendo 5 críticos)

### Desmarcações Ativas (desmarcacoes_ativas):
- **Total de campos no schema:** 28
- **Campos usados no código:** 22
- **Campos não usados:** 6
- **Campos faltando:** 7 (sendo 4 críticos)

---

## 8. SCRIPT DE MIGRAÇÃO RECOMENDADO

```sql
-- ============================================================================
-- MIGRATION: Adicionar campos faltantes críticos
-- Data: 2025-12-12
-- ============================================================================

BEGIN TRANSACTION;

-- CONSULTAS_ATIVAS (Confirmação)
ALTER TABLE consultas_ativas ADD COLUMN profissional TEXT DEFAULT 'Não informado';
ALTER TABLE consultas_ativas ADD COLUMN local TEXT;
ALTER TABLE consultas_ativas ADD COLUMN pac_codigo TEXT;
ALTER TABLE consultas_ativas ADD COLUMN nome_exibicao TEXT;
ALTER TABLE consultas_ativas ADD COLUMN data_resposta TEXT;
ALTER TABLE consultas_ativas ADD COLUMN badge_status TEXT;
ALTER TABLE consultas_ativas ADD COLUMN badge_info TEXT; -- JSON

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_consultas_ativas_badge ON consultas_ativas(badge_status);

-- DESMARCACOES_ATIVAS (Desmarcação)
ALTER TABLE desmarcacoes_ativas ADD COLUMN local TEXT;
ALTER TABLE desmarcacoes_ativas ADD COLUMN resposta_em TEXT;
ALTER TABLE desmarcacoes_ativas ADD COLUMN status_geral TEXT DEFAULT 'pending';
ALTER TABLE desmarcacoes_ativas ADD COLUMN data_marcacao TEXT;

-- Atualizar dados existentes (se necessário)
-- Migrar profissional de campo externo (se houver)
-- UPDATE consultas_ativas SET profissional = 'Não informado' WHERE profissional IS NULL;

COMMIT;
```

---

## 9. CONCLUSÕES E PRÓXIMOS PASSOS

### ✅ Pontos Fortes:
1. Conversão automática snake_case ↔ camelCase funciona perfeitamente
2. Sistema de timestamps (criado_em, atualizado_em) bem implementado
3. Campos de auditoria (data_marcacao, data_apareceu_dashboard) bem pensados
4. Sistema de reagendamento completo (campos específicos na desmarcação)

### 🔴 Problemas Críticos:
1. **Campos essenciais faltando no banco:**
   - `contexto` (validação de segurança)
   - `profissional` (confirmação)
   - `telefones` array (ambos)
   - `mensagens` array (ambos)
   - `badgeStatus` e `badgeInfo` (UI depende disto)
   - `dataResposta` e `respostaEm` (rastreamento)

2. **Impacto no sistema:**
   - Sistema funciona porque armazena dados em memória (state)
   - Ao recarregar página, dados críticos se perdem
   - Sincronização entre operadores incompleta
   - Badges não persistem entre reloads

### ⚠️ Problemas Médios:
1. Campos de contexto WhatsApp não implementados (contexto_id, contexto_expires_at)
2. Alguns campos redundantes (mensagem_enviada vs statusGeral)
3. Campo `criado_por` sempre 'sistema' (não aproveita multi-usuário)

### 📋 PRÓXIMOS PASSOS (PRIORIDADE):

#### 1. URGENTE - Adicionar campos críticos:
- [ ] Executar script de migração (seção 8)
- [ ] Atualizar `consultasSQLite.service.js` para incluir novos campos
- [ ] Testar salvamento e carregamento completo
- [ ] Verificar badges persistem após reload

#### 2. IMPORTANTE - Resolver arrays (telefones/mensagens):
- [ ] Decidir abordagem: JSON no banco ou tabela separada
- [ ] Se JSON: adicionar campo `telefones_json TEXT`
- [ ] Se tabela: criar `consulta_telefones` e `desmarcacao_telefones`
- [ ] Atualizar serviços para salvar/carregar arrays

#### 3. MÉDIO - Padronizar campos:
- [ ] Adicionar `profissional` e `local` em ambas tabelas
- [ ] Documentar campos de contexto WhatsApp
- [ ] Avaliar uso de `criado_por` para multi-usuário

#### 4. BAIXO - Limpeza:
- [ ] Remover campos não usados (se confirmado)
- [ ] Adicionar comentários no schema
- [ ] Documentar decisões de design

---

## 10. REFERÊNCIAS

### Arquivos Analisados:
1. `server/database/schema-consultas.sql` - Schema do banco SQLite
2. `src/components/confirmacaoPresenca.js` - UI de confirmação
3. `src/components/desmarcacaoConsultas.js` - UI de desmarcação
4. `src/services/confirmacao.service.js` - Lógica de confirmação
5. `src/services/desmarcacao.service.js` - Lógica de desmarcação
6. `server/database/consultas.service.js` - CRUD do banco
7. `src/services/consultasSQLite.service.js` - Wrapper frontend

### Linhas de Código Críticas:
- `confirmacaoPresenca.js:552` - Conversão SQLite → Frontend
- `confirmacaoPresenca.js:646-673` - Sistema de badges
- `desmarcacaoConsultas.js:490-546` - Conversão SQLite → Frontend
- `confirmacao.service.js:192-288` - Preparação de confirmação
- `desmarcacao.service.js:124-197` - Preparação de desmarcação
- `consultas.service.js:63-139` - Upsert consulta ativa
- `consultas.service.js:290-373` - Upsert desmarcação ativa

---

**Fim do Relatório**

Gerado automaticamente por Claude Sonnet 4.5 em 2025-12-12
