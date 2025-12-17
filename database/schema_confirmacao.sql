-- ============================================================================
-- HMASP CHAT - SCHEMA POSTGRESQL - CONFIRMAÇÃO DE PRESENÇA
-- Sistema de Confirmação de Presença e Monitoramento
-- ============================================================================
-- Versão: 2.0.0
-- Data: 2025-12-02
-- Migração: Firebase → PostgreSQL (HMASP)
-- Descrição: Schema adicional para sistema de confirmação de presença
-- ============================================================================

-- ============================================================================
-- TABELA: confirmacoes
-- Armazena confirmações de presença de consultas
-- ============================================================================
CREATE TABLE IF NOT EXISTS confirmacoes (
    id VARCHAR(100) PRIMARY KEY, -- formato: MARCACAO_{consultaNumero}_{timestamp}
    tipo VARCHAR(20) NOT NULL, -- 'MARCACAO' ou 'LEMBRETE_72H'

    -- Dados da consulta (AGHUse)
    consulta_numero VARCHAR(50) NOT NULL,
    pac_codigo INTEGER,
    prontuario VARCHAR(20),
    nome_paciente VARCHAR(255) NOT NULL,
    nome_exibicao VARCHAR(255),
    especialidade VARCHAR(100) NOT NULL,
    data_consulta TIMESTAMP NOT NULL,
    data_hora_formatada VARCHAR(50),
    profissional VARCHAR(255),
    local VARCHAR(255),

    -- Status geral
    status_geral VARCHAR(20) DEFAULT 'pending', -- pending, confirmed, declined, no_phone
    arquivada BOOLEAN DEFAULT FALSE,
    data_arquivamento TIMESTAMP,

    -- Auditoria
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT tipo_valido CHECK (tipo IN ('MARCACAO', 'LEMBRETE_72H')),
    CONSTRAINT status_valido CHECK (status_geral IN ('pending', 'sent', 'delivered', 'confirmed', 'declined', 'no_phone', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_confirmacoes_consulta_numero ON confirmacoes(consulta_numero);
CREATE INDEX IF NOT EXISTS idx_confirmacoes_status_geral ON confirmacoes(status_geral);
CREATE INDEX IF NOT EXISTS idx_confirmacoes_arquivada ON confirmacoes(arquivada);
CREATE INDEX IF NOT EXISTS idx_confirmacoes_data_consulta ON confirmacoes(data_consulta);
CREATE INDEX IF NOT EXISTS idx_confirmacoes_criado_em ON confirmacoes(criado_em);

COMMENT ON TABLE confirmacoes IS 'Confirmações de presença em consultas';
COMMENT ON COLUMN confirmacoes.status_geral IS 'Status consolidado: pending, confirmed, declined, no_phone';
COMMENT ON COLUMN confirmacoes.arquivada IS 'Se true, confirmação foi arquivada (não aparece na lista ativa)';

-- ============================================================================
-- TABELA: confirmacoes_mensagens
-- Detalha mensagens enviadas para cada telefone
-- ============================================================================
CREATE TABLE IF NOT EXISTS confirmacoes_mensagens (
    id SERIAL PRIMARY KEY,
    confirmacao_id VARCHAR(100) NOT NULL REFERENCES confirmacoes(id) ON DELETE CASCADE,

    -- Dados do telefone
    telefone VARCHAR(20),
    telefone_formatado VARCHAR(30),
    telefone_type VARCHAR(20), -- 'mobile', 'landline', 'none'
    telefone_origem VARCHAR(50),
    chat_id VARCHAR(50), -- formato WhatsApp: numero@c.us

    -- Mensagem
    mensagem_texto TEXT,
    mensagem_botoes JSONB, -- Array de botões: [{id, text}]
    template_id VARCHAR(50),

    -- Status e tracking
    status VARCHAR(20) DEFAULT 'pending',
    prioridade INTEGER DEFAULT 1,
    tentativas INTEGER DEFAULT 0,
    queue_id VARCHAR(100),
    message_id VARCHAR(100),

    -- Logs
    logs JSONB DEFAULT '[]', -- Array de logs: [{timestamp, status, mensagem}]

    -- Auditoria
    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT status_mensagem_valido CHECK (status IN ('pending', 'queued', 'sent', 'delivered', 'read', 'confirmed', 'declined', 'failed', 'unsupported', 'no_phone'))
);

CREATE INDEX IF NOT EXISTS idx_mensagens_confirmacao_id ON confirmacoes_mensagens(confirmacao_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_telefone ON confirmacoes_mensagens(telefone);
CREATE INDEX IF NOT EXISTS idx_mensagens_status ON confirmacoes_mensagens(status);
CREATE INDEX IF NOT EXISTS idx_mensagens_queue_id ON confirmacoes_mensagens(queue_id);

COMMENT ON TABLE confirmacoes_mensagens IS 'Mensagens enviadas para confirmação (1 por telefone)';
COMMENT ON COLUMN confirmacoes_mensagens.logs IS 'Array JSON com histórico de mudanças de status';

-- ============================================================================
-- TABELA: monitoramento_estado
-- Estado global do monitoramento (singleton)
-- ============================================================================
CREATE TABLE IF NOT EXISTS monitoramento_estado (
    id INTEGER PRIMARY KEY DEFAULT 1,
    ativo BOOLEAN DEFAULT FALSE,
    ultima_verificacao TIMESTAMP,
    total_enviadas INTEGER DEFAULT 0,
    total_falhas INTEGER DEFAULT 0,

    -- Auditoria
    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT singleton_check CHECK (id = 1)
);

-- Insere registro único (se não existir)
INSERT INTO monitoramento_estado (id, ativo) VALUES (1, FALSE)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE monitoramento_estado IS 'Estado global do monitoramento (tabela singleton)';
COMMENT ON CONSTRAINT singleton_check ON monitoramento_estado IS 'Garante que só existe 1 registro';

-- ============================================================================
-- TABELA: monitoramento_consultas
-- Log de consultas processadas (evita duplicatas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS monitoramento_consultas (
    id SERIAL PRIMARY KEY,
    consulta_numero VARCHAR(50) UNIQUE NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'enviado' ou 'falha'

    -- Detalhes
    paciente VARCHAR(255),
    telefone VARCHAR(20),
    message_id VARCHAR(100),
    queue_id VARCHAR(100),
    erro TEXT,
    tentativas INTEGER DEFAULT 1,

    -- Auditoria
    processado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT status_processamento_valido CHECK (status IN ('enviado', 'falha'))
);

CREATE INDEX IF NOT EXISTS idx_monit_consulta_numero ON monitoramento_consultas(consulta_numero);
CREATE INDEX IF NOT EXISTS idx_monit_status ON monitoramento_consultas(status);
CREATE INDEX IF NOT EXISTS idx_monit_processado_em ON monitoramento_consultas(processado_em);

COMMENT ON TABLE monitoramento_consultas IS 'Log de consultas já processadas (evita duplicatas)';
COMMENT ON COLUMN monitoramento_consultas.status IS 'enviado (sucesso) ou falha';

-- ============================================================================
-- FUNCTIONS: Triggers para updated_at
-- ============================================================================

-- Cria função se não existir
CREATE OR REPLACE FUNCTION update_confirmacao_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplica triggers
DROP TRIGGER IF EXISTS update_confirmacoes_updated_at ON confirmacoes;
CREATE TRIGGER update_confirmacoes_updated_at BEFORE UPDATE ON confirmacoes
    FOR EACH ROW EXECUTE FUNCTION update_confirmacao_updated_at();

DROP TRIGGER IF EXISTS update_confirmacoes_mensagens_updated_at ON confirmacoes_mensagens;
CREATE TRIGGER update_confirmacoes_mensagens_updated_at BEFORE UPDATE ON confirmacoes_mensagens
    FOR EACH ROW EXECUTE FUNCTION update_confirmacao_updated_at();

DROP TRIGGER IF EXISTS update_monitoramento_estado_updated_at ON monitoramento_estado;
CREATE TRIGGER update_monitoramento_estado_updated_at BEFORE UPDATE ON monitoramento_estado
    FOR EACH ROW EXECUTE FUNCTION update_confirmacao_updated_at();

-- ============================================================================
-- VIEWS: Consultas úteis
-- ============================================================================

-- View: Confirmações ativas (não arquivadas)
CREATE OR REPLACE VIEW confirmacoes_ativas AS
SELECT * FROM confirmacoes
WHERE arquivada = FALSE
ORDER BY criado_em DESC;

COMMENT ON VIEW confirmacoes_ativas IS 'Confirmações não arquivadas (visíveis na interface)';

-- View: Estatísticas de confirmações
CREATE OR REPLACE VIEW confirmacoes_stats AS
SELECT
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status_geral = 'pending') as pendentes,
    COUNT(*) FILTER (WHERE status_geral = 'confirmed') as confirmadas,
    COUNT(*) FILTER (WHERE status_geral = 'declined') as declinadas,
    COUNT(*) FILTER (WHERE arquivada = TRUE) as arquivadas
FROM confirmacoes;

COMMENT ON VIEW confirmacoes_stats IS 'Estatísticas consolidadas de confirmações';

-- View: Mensagens por status
CREATE OR REPLACE VIEW mensagens_stats AS
SELECT
    status,
    COUNT(*) as quantidade
FROM confirmacoes_mensagens
GROUP BY status
ORDER BY quantidade DESC;

COMMENT ON VIEW mensagens_stats IS 'Quantidade de mensagens por status';

-- View: Confirmações com detalhes de mensagens
CREATE OR REPLACE VIEW confirmacoes_completas AS
SELECT
    c.*,
    json_agg(
        json_build_object(
            'id', m.id,
            'telefone', m.telefone,
            'status', m.status,
            'tentativas', m.tentativas,
            'queue_id', m.queue_id
        )
    ) as mensagens
FROM confirmacoes c
LEFT JOIN confirmacoes_mensagens m ON c.id = m.confirmacao_id
GROUP BY c.id;

COMMENT ON VIEW confirmacoes_completas IS 'Confirmações com todas as mensagens agregadas';

-- ============================================================================
-- FUNÇÕES UTILITÁRIAS
-- ============================================================================

-- Função: Arquivar confirmações por status
CREATE OR REPLACE FUNCTION arquivar_confirmacoes_por_status(p_status VARCHAR(20))
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE confirmacoes
    SET arquivada = TRUE,
        data_arquivamento = CURRENT_TIMESTAMP,
        atualizado_em = CURRENT_TIMESTAMP
    WHERE status_geral = p_status
      AND arquivada = FALSE;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION arquivar_confirmacoes_por_status IS 'Arquiva todas confirmações com status específico';

-- Função: Limpar confirmações antigas (mais de 90 dias)
CREATE OR REPLACE FUNCTION limpar_confirmacoes_antigas()
RETURNS TABLE(removidas INTEGER) AS $$
DECLARE
    v_count INTEGER;
BEGIN
    DELETE FROM confirmacoes
    WHERE criado_em < CURRENT_TIMESTAMP - INTERVAL '90 days'
      AND arquivada = TRUE;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN QUERY SELECT v_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION limpar_confirmacoes_antigas IS 'Remove confirmações arquivadas há mais de 90 dias';

-- ============================================================================
-- PERMISSÕES
-- ============================================================================

-- Conceder permissões ao usuário da aplicação (se existir)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'hmasp_app') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON confirmacoes TO hmasp_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON confirmacoes_mensagens TO hmasp_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON monitoramento_estado TO hmasp_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON monitoramento_consultas TO hmasp_app;
        GRANT USAGE, SELECT ON SEQUENCE confirmacoes_mensagens_id_seq TO hmasp_app;
        GRANT USAGE, SELECT ON SEQUENCE monitoramento_consultas_id_seq TO hmasp_app;
        GRANT SELECT ON confirmacoes_ativas TO hmasp_app;
        GRANT SELECT ON confirmacoes_stats TO hmasp_app;
        GRANT SELECT ON mensagens_stats TO hmasp_app;
        GRANT SELECT ON confirmacoes_completas TO hmasp_app;
    END IF;
END $$;

-- ============================================================================
-- VERIFICAÇÃO FINAL
-- ============================================================================

-- Exibir resumo das tabelas criadas
SELECT
    'Schema de Confirmação criado com sucesso!' as status,
    COUNT(*) FILTER (WHERE table_name LIKE 'confirmacoes%' OR table_name LIKE 'monitoramento%') as tabelas_confirmacao
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

-- Exibir estatísticas iniciais
SELECT * FROM confirmacoes_stats;

-- ============================================================================
-- FIM DO SCHEMA
-- ============================================================================
