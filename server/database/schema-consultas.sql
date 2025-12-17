-- ============================================================================
-- SCHEMA: Consultas Ativas (Sistema Multi-Usuário)
-- ============================================================================
-- Substitui localStorage por SQLite para sincronização entre todos os operadores
--
-- Tabelas:
-- 1. consultas_ativas: Confirmações e Lembretes 72h (aba Confirmação)
-- 2. desmarcacoes_ativas: Desmarcações detectadas (aba Desmarcação)
-- 3. consultas_arquivadas: Histórico de consultas arquivadas
--
-- Benefícios:
-- - Multi-usuário: Todos operadores veem as MESMAS consultas
-- - Persistência: Não perde dados ao fechar navegador
-- - Sincronização: Atualizações aparecem para todos em tempo real
-- - Auditoria: Rastreamento completo de operações
-- ============================================================================

-- ============================================================================
-- CONSULTAS ATIVAS (Aba Confirmação)
-- ============================================================================

CREATE TABLE IF NOT EXISTS consultas_ativas (
    -- Identificação Única
    id TEXT PRIMARY KEY,                        -- ID único gerado pelo sistema (UUID)
    consulta_numero TEXT NOT NULL,              -- Número da consulta no AGHUse

    -- Dados do Paciente
    nome_paciente TEXT NOT NULL,
    nome_exibicao TEXT,                         -- Nome resumido para exibição
    pac_codigo TEXT,                            -- Código do paciente no AGHUse
    prontuario TEXT,
    telefone TEXT,
    telefone_formatado TEXT,

    -- Dados da Consulta
    especialidade TEXT,
    profissional TEXT,                          -- Médico responsável
    local TEXT,                                 -- Local da consulta
    data_hora_formatada TEXT,
    data_consulta TEXT,                         -- ISO 8601 datetime

    -- Tipo e Status
    tipo TEXT NOT NULL,                         -- 'marcada' ou 'lembrete72h'
    status_geral TEXT DEFAULT 'pending',        -- 'pending', 'sent', 'delivered', 'confirmed', 'declined', 'not_scheduled'

    -- WhatsApp
    mensagem_template TEXT,
    mensagem_enviada BOOLEAN DEFAULT 0,
    data_envio TEXT,                            -- ISO 8601 datetime
    whatsapp_message_id TEXT,

    -- Monitoramento
    data_marcacao TEXT,                         -- Quando foi marcada no AGHUse
    data_apareceu_dashboard TEXT,               -- Quando apareceu no dashboard

    -- Contexto WhatsApp (para receber respostas)
    contexto TEXT DEFAULT 'confirmacao',        -- 'confirmacao' ou 'desmarcacao'
    contexto_id TEXT,                           -- ID do contexto ativo
    contexto_expires_at TEXT,                   -- Quando expira o contexto

    -- Reagendamento (Sistema Anti-Loop)
    reagendamento_de TEXT,                      -- ID da desmarcação/confirmação original
    reagendamento_data TEXT,                    -- Timestamp do reagendamento
    reagendamento_tipo TEXT,                    -- 'desmarcacao' ou 'confirmacao'

    -- Badges e Respostas
    data_resposta TEXT,                         -- Quando paciente respondeu
    badge_status TEXT,                          -- Status do badge ('vermelho', 'verde', 'amarelo')
    badge_info TEXT,                            -- Informações adicionais do badge (JSON)

    -- Metadados
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP,
    criado_por TEXT DEFAULT 'sistema',

    -- Índices e Constraints
    UNIQUE(consulta_numero, telefone)           -- Evita duplicatas
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_consultas_ativas_consulta_numero ON consultas_ativas(consulta_numero);
CREATE INDEX IF NOT EXISTS idx_consultas_ativas_telefone ON consultas_ativas(telefone);
CREATE INDEX IF NOT EXISTS idx_consultas_ativas_tipo ON consultas_ativas(tipo);
CREATE INDEX IF NOT EXISTS idx_consultas_ativas_status ON consultas_ativas(status_geral);
CREATE INDEX IF NOT EXISTS idx_consultas_ativas_data_consulta ON consultas_ativas(data_consulta);
CREATE INDEX IF NOT EXISTS idx_consultas_ativas_reagendamento_de ON consultas_ativas(reagendamento_de);
CREATE INDEX IF NOT EXISTS idx_consultas_ativas_reagendamento_data ON consultas_ativas(reagendamento_data);


-- ============================================================================
-- DESMARCAÇÕES ATIVAS (Aba Desmarcação)
-- ============================================================================

CREATE TABLE IF NOT EXISTS desmarcacoes_ativas (
    -- Identificação Única
    id TEXT PRIMARY KEY,                        -- ID único gerado pelo sistema (UUID)
    consulta_numero TEXT NOT NULL,              -- Número da consulta no AGHUse

    -- Dados do Paciente
    nome_paciente TEXT NOT NULL,
    nome_exibicao TEXT,                         -- Nome resumido para exibição
    pac_codigo TEXT,                            -- Código do paciente no AGHUse
    prontuario TEXT,
    telefone TEXT,
    telefone_formatado TEXT,

    -- Dados da Consulta
    especialidade TEXT,
    profissional TEXT,                          -- Médico responsável
    local TEXT,                                 -- Local da consulta
    data_hora_formatada TEXT,
    data_consulta TEXT,                         -- ISO 8601 datetime

    -- Tipo e Status de Desmarcação
    status TEXT,                                -- Status atual: 'pending', 'reagendamento', 'sem_reagendamento', 'paciente_solicitou'
    tipo_desmarcacao TEXT,                      -- 'reagendamento', 'sem_reagendamento', 'paciente_solicitou'
    veio_de_confirmacao BOOLEAN DEFAULT 0,      -- Se veio da aba Confirmação (badge Desmarcar)
    confirmacao_id TEXT,                        -- ID da confirmação original (se veio de lá)

    -- WhatsApp
    mensagem_template TEXT,
    mensagem_enviada BOOLEAN DEFAULT 0,
    enviar_mensagem BOOLEAN DEFAULT 1,          -- Se deve enviar mensagem (0 se veio de confirmação)
    data_envio TEXT,                            -- ISO 8601 datetime
    whatsapp_message_id TEXT,

    -- Monitoramento
    data_desmarcacao TEXT,                      -- Quando foi desmarcada no AGHUse (ISO 8601)
    data_desmarcacao_formatada TEXT,            -- Data formatada para exibição (dd/mm/yyyy hh:mm)
    data_apareceu_dashboard TEXT,               -- Quando apareceu no dashboard

    -- Contexto WhatsApp (para receber respostas sobre reagendamento)
    contexto_id TEXT,                           -- ID do contexto ativo
    contexto_expires_at TEXT,                   -- Quando expira o contexto

    -- Reagendamento (quando paciente solicitou e operador reagendou)
    reagendada BOOLEAN DEFAULT 0,               -- Se a consulta foi reagendada
    reagendada_em TEXT,                         -- Quando foi reagendada (ISO 8601)
    nova_consulta_numero TEXT,                  -- Número da nova consulta criada
    reagendamento_comunicado BOOLEAN DEFAULT 0, -- Se paciente foi notificado do reagendamento

    -- Resposta do Paciente (via WhatsApp)
    resposta_em TEXT,                           -- Quando paciente respondeu (ISO 8601)
    status_geral TEXT DEFAULT 'pending',        -- Status geral: 'pending', 'completed', etc
    data_marcacao TEXT,                         -- Data de marcação original (ISO 8601)
    contexto TEXT DEFAULT 'desmarcacao',        -- Contexto da conversa: 'desmarcacao'

    -- Metadados
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP,
    criado_por TEXT DEFAULT 'sistema',

    -- Índices e Constraints
    UNIQUE(consulta_numero, telefone)           -- Evita duplicatas
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_desmarcacoes_ativas_consulta_numero ON desmarcacoes_ativas(consulta_numero);
CREATE INDEX IF NOT EXISTS idx_desmarcacoes_ativas_telefone ON desmarcacoes_ativas(telefone);
CREATE INDEX IF NOT EXISTS idx_desmarcacoes_ativas_tipo ON desmarcacoes_ativas(tipo_desmarcacao);
CREATE INDEX IF NOT EXISTS idx_desmarcacoes_ativas_confirmacao ON desmarcacoes_ativas(confirmacao_id);
CREATE INDEX IF NOT EXISTS idx_desmarcacoes_ativas_data ON desmarcacoes_ativas(data_desmarcacao);
CREATE INDEX IF NOT EXISTS idx_desmarcacoes_ativas_reagendada ON desmarcacoes_ativas(reagendada);


-- ============================================================================
-- CONSULTAS ARQUIVADAS (Histórico)
-- ============================================================================

CREATE TABLE IF NOT EXISTS consultas_arquivadas (
    -- Identificação
    id TEXT PRIMARY KEY,                        -- Mesmo ID da consulta original
    consulta_numero TEXT NOT NULL,

    -- Tipo Original
    tipo_original TEXT NOT NULL,                -- 'consulta_ativa' ou 'desmarcacao_ativa'

    -- Dados Completos (JSON)
    dados_completos TEXT NOT NULL,              -- JSON com todos os campos da consulta

    -- Motivo do Arquivamento
    motivo_arquivamento TEXT,                   -- 'manual', 'automatico', 'consulta_realizada', etc
    arquivado_por TEXT,

    -- Timestamps
    data_original TEXT,                         -- Data da consulta/desmarcação original
    criado_em TEXT,                             -- Quando foi criado originalmente
    arquivado_em TEXT DEFAULT CURRENT_TIMESTAMP -- Quando foi arquivado
);

-- Índices para consulta de histórico
CREATE INDEX IF NOT EXISTS idx_arquivadas_consulta_numero ON consultas_arquivadas(consulta_numero);
CREATE INDEX IF NOT EXISTS idx_arquivadas_tipo ON consultas_arquivadas(tipo_original);
CREATE INDEX IF NOT EXISTS idx_arquivadas_data ON consultas_arquivadas(arquivado_em);


-- ============================================================================
-- ESTATÍSTICAS E VIEWS
-- ============================================================================

-- View: Estatísticas de Confirmações
CREATE VIEW IF NOT EXISTS vw_stats_confirmacoes AS
SELECT
    COUNT(*) as total,
    SUM(CASE WHEN tipo = 'marcada' THEN 1 ELSE 0 END) as marcadas,
    SUM(CASE WHEN tipo = 'lembrete72h' THEN 1 ELSE 0 END) as lembretes,
    SUM(CASE WHEN status_geral = 'pending' THEN 1 ELSE 0 END) as pendentes,
    SUM(CASE WHEN status_geral = 'confirmed' THEN 1 ELSE 0 END) as confirmadas,
    SUM(CASE WHEN status_geral = 'declined' THEN 1 ELSE 0 END) as declinadas,
    SUM(CASE WHEN status_geral = 'not_scheduled' THEN 1 ELSE 0 END) as nao_agendou,
    SUM(CASE WHEN mensagem_enviada = 1 THEN 1 ELSE 0 END) as mensagens_enviadas
FROM consultas_ativas;

-- View: Estatísticas de Desmarcações
CREATE VIEW IF NOT EXISTS vw_stats_desmarcacoes AS
SELECT
    COUNT(*) as total,
    SUM(CASE WHEN tipo_desmarcacao = 'reagendamento' THEN 1 ELSE 0 END) as reagendamentos,
    SUM(CASE WHEN tipo_desmarcacao = 'sem_reagendamento' THEN 1 ELSE 0 END) as sem_reagendamento,
    SUM(CASE WHEN tipo_desmarcacao = 'paciente_solicitou' THEN 1 ELSE 0 END) as paciente_solicitou,
    SUM(CASE WHEN veio_de_confirmacao = 1 THEN 1 ELSE 0 END) as veio_de_confirmacao,
    SUM(CASE WHEN mensagem_enviada = 1 THEN 1 ELSE 0 END) as mensagens_enviadas
FROM desmarcacoes_ativas;
