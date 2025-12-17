-- ============================================================================
-- MIGRATION: Adicionar Campos de Rastreamento de Reagendamento
-- ============================================================================
-- Data: 2025-12-12
-- Objetivo: Rastrear e identificar consultas que são reagendamentos
--
-- Funcionalidade:
-- 1. Marca consulta como reagendamento quando operador cria nova consulta após solicitação
-- 2. Permite enviar mensagem REAGENDAMENTO_CONFIRMACAO (com 3 botões - permite desmarcação)
-- 3. Badge AMARELO identifica visualmente reagendamentos no dashboard
-- 4. PERMITE desmarcação normal (libera vaga para outro paciente)
-- 5. Campos úteis para estatísticas, auditoria e relatórios
-- ============================================================================

-- Adicionar campos à tabela consultas_ativas
ALTER TABLE consultas_ativas ADD COLUMN reagendamento_de TEXT;
ALTER TABLE consultas_ativas ADD COLUMN reagendamento_data TEXT;
ALTER TABLE consultas_ativas ADD COLUMN reagendamento_tipo TEXT; -- 'desmarcacao' ou 'confirmacao'

-- Comentários dos campos:
-- reagendamento_de: ID da desmarcação ou confirmação original que gerou o reagendamento
-- reagendamento_data: Timestamp de quando foi criado o reagendamento
-- reagendamento_tipo: Indica se veio de uma desmarcação (paciente pediu reagendamento)
--                     ou confirmação (consulta desmarcada e remarcada)

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_consultas_reagendamento_de
    ON consultas_ativas(reagendamento_de);

CREATE INDEX IF NOT EXISTS idx_consultas_reagendamento_data
    ON consultas_ativas(reagendamento_data);

-- ============================================================================
-- Verificação: Consultar consultas que são reagendamentos
-- ============================================================================
-- SELECT
--     id,
--     consulta_numero,
--     nome_paciente,
--     reagendamento_de,
--     reagendamento_data,
--     reagendamento_tipo,
--     criado_em
-- FROM consultas_ativas
-- WHERE reagendamento_de IS NOT NULL
-- ORDER BY criado_em DESC;

-- ============================================================================
-- Estatísticas: Quantidade de reagendamentos
-- ============================================================================
-- SELECT
--     COUNT(*) as total_reagendamentos,
--     reagendamento_tipo,
--     COUNT(*) * 100.0 / (SELECT COUNT(*) FROM consultas_ativas) as percentual
-- FROM consultas_ativas
-- WHERE reagendamento_de IS NOT NULL
-- GROUP BY reagendamento_tipo;
