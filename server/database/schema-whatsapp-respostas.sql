-- ============================================================================
-- SCHEMA: Respostas WhatsApp (Sistema Multi-Usuário)
-- ============================================================================
-- Armazena respostas processadas de pacientes via WhatsApp
--
-- IMPORTANTE: Esta tabela NÃO interfere com o banco do WhatsApp
-- - WhatsApp gerencia suas próprias mensagens (LocalAuth, sessão, etc)
-- - Esta tabela apenas registra RESPOSTAS PROCESSADAS pelo nosso sistema
-- - Usado para sincronizar status entre múltiplos operadores
--
-- Benefícios:
-- - Persistência: Não perde respostas se servidor reiniciar
-- - Multi-usuário: Todos operadores veem mesmas respostas
-- - Auditoria: Histórico completo de interações
-- - Evita duplicação: Controla quais respostas já foram processadas
-- ============================================================================

-- ============================================================================
-- RESPOSTAS WHATSAPP ATIVAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS whatsapp_respostas_ativas (
    -- Identificação
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    confirmacao_id TEXT,                    -- ID da confirmação/desmarcação relacionada

    -- Dados do Paciente
    telefone TEXT NOT NULL,                 -- Telefone original (do mapeamento)
    telefone_chat TEXT,                     -- Chat ID do WhatsApp (@c.us ou @lid)

    -- Resposta
    status TEXT,                            -- Status da resposta: 'confirmed', 'declined', 'not_scheduled'
    tipo_desmarcacao TEXT,                  -- Para desmarcações: 'reagendamento', 'sem_reagendamento', 'paciente_solicitou'
    contexto TEXT,                          -- 'confirmacao' ou 'desmarcacao'

    -- Mensagem
    message_body TEXT,                      -- Corpo da mensagem enviada pelo paciente
    timestamp TEXT NOT NULL,                -- Quando foi recebida

    -- Processamento
    processada BOOLEAN DEFAULT 0,           -- Se já foi processada pelo frontend
    processada_em TEXT,                     -- Quando foi processada

    -- Metadados
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP,

    -- Índices para performance
    UNIQUE(confirmacao_id, telefone, timestamp) -- Evita duplicatas
);

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_whatsapp_respostas_confirmacao ON whatsapp_respostas_ativas(confirmacao_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_respostas_telefone ON whatsapp_respostas_ativas(telefone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_respostas_processada ON whatsapp_respostas_ativas(processada);
CREATE INDEX IF NOT EXISTS idx_whatsapp_respostas_timestamp ON whatsapp_respostas_ativas(timestamp);


-- ============================================================================
-- RESPOSTAS WHATSAPP HISTÓRICO
-- ============================================================================

CREATE TABLE IF NOT EXISTS whatsapp_respostas_historico (
    -- Identificação
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resposta_id INTEGER,                    -- ID da resposta original

    -- Dados copiados da resposta ativa
    confirmacao_id TEXT,
    telefone TEXT,
    telefone_chat TEXT,
    status TEXT,
    tipo_desmarcacao TEXT,
    contexto TEXT,
    message_body TEXT,
    timestamp_resposta TEXT,

    -- Arquivamento
    motivo_arquivamento TEXT,               -- 'processada', 'timeout', 'manual'
    arquivado_em TEXT DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key (opcional)
    FOREIGN KEY (resposta_id) REFERENCES whatsapp_respostas_ativas(id) ON DELETE SET NULL
);

-- Índice para histórico
CREATE INDEX IF NOT EXISTS idx_whatsapp_historico_confirmacao ON whatsapp_respostas_historico(confirmacao_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_historico_timestamp ON whatsapp_respostas_historico(timestamp_resposta);


-- ============================================================================
-- VIEW: Respostas Pendentes (Não Processadas)
-- ============================================================================

CREATE VIEW IF NOT EXISTS vw_whatsapp_respostas_pendentes AS
SELECT
    id,
    confirmacao_id,
    telefone,
    telefone_chat,
    status,
    tipo_desmarcacao,
    contexto,
    message_body,
    timestamp,
    criado_em
FROM whatsapp_respostas_ativas
WHERE processada = 0
ORDER BY timestamp DESC;


-- ============================================================================
-- VIEW: Estatísticas de Respostas
-- ============================================================================

CREATE VIEW IF NOT EXISTS vw_whatsapp_respostas_stats AS
SELECT
    COUNT(*) as total_ativas,
    SUM(CASE WHEN processada = 0 THEN 1 ELSE 0 END) as pendentes,
    SUM(CASE WHEN processada = 1 THEN 1 ELSE 0 END) as processadas,
    SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmadas,
    SUM(CASE WHEN status = 'declined' THEN 1 ELSE 0 END) as declinadas,
    SUM(CASE WHEN status = 'not_scheduled' THEN 1 ELSE 0 END) as nao_agendou,
    SUM(CASE WHEN tipo_desmarcacao = 'reagendamento' THEN 1 ELSE 0 END) as reagendamentos,
    SUM(CASE WHEN tipo_desmarcacao = 'sem_reagendamento' THEN 1 ELSE 0 END) as sem_reagendamento
FROM whatsapp_respostas_ativas;


-- ============================================================================
-- LIMPEZA AUTOMÁTICA (Opcional)
-- ============================================================================
-- Respostas processadas podem ser arquivadas automaticamente após 24h
-- Isso mantém a tabela ativa pequena e performática
