-- ============================================================================
-- MIGRATION: Validação Temporal e Limpeza de Consultas Antigas
-- ============================================================================
-- Data: 2025-12-12
-- Objetivo: Adicionar validação temporal e arquivamento automático
--
-- Funcionalidade:
-- 1. Evita processar consultas já passadas
-- 2. Arquiva automaticamente consultas antigas
-- 3. Adiciona índices para consultas por data
-- 4. Remove consultas muito antigas (90+ dias passados)
-- ============================================================================

-- ============================================================================
-- ÍNDICES TEMPORAIS (já existem no schema, mas garantindo)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_consultas_ativas_data_consulta ON consultas_ativas(data_consulta);
CREATE INDEX IF NOT EXISTS idx_desmarcacoes_ativas_data_consulta ON desmarcacoes_ativas(data_consulta);

-- ============================================================================
-- VIEW: Consultas Futuras (apenas consultas que ainda não passaram)
-- ============================================================================
DROP VIEW IF EXISTS v_consultas_futuras;
CREATE VIEW v_consultas_futuras AS
SELECT *
FROM consultas_ativas
WHERE data_consulta >= datetime('now', '-3 hours') -- Margem de 3 horas para fuso/atraso
ORDER BY data_consulta ASC;

-- ============================================================================
-- VIEW: Consultas Passadas (para arquivamento)
-- ============================================================================
DROP VIEW IF EXISTS v_consultas_passadas;
CREATE VIEW v_consultas_passadas AS
SELECT *
FROM consultas_ativas
WHERE data_consulta < datetime('now', '-3 hours')
ORDER BY data_consulta DESC;

-- ============================================================================
-- VIEW: Consultas Muito Antigas (90+ dias, candidatas à exclusão)
-- ============================================================================
DROP VIEW IF EXISTS v_consultas_muito_antigas;
CREATE VIEW v_consultas_muito_antigas AS
SELECT *
FROM consultas_ativas
WHERE data_consulta < datetime('now', '-90 days')
ORDER BY data_consulta ASC;

-- ============================================================================
-- FUNÇÃO: Arquivar Consultas Passadas
-- ============================================================================
-- Esta query deve ser executada periodicamente (ex: a cada 24 horas)
-- Move consultas passadas para a tabela de arquivadas
-- ============================================================================

-- EXEMPLO DE USO (comentado - executar manualmente):
/*
INSERT INTO consultas_arquivadas
SELECT
    id,
    consulta_numero,
    nome_paciente,
    nome_exibicao,
    pac_codigo,
    prontuario,
    telefone,
    telefone_formatado,
    especialidade,
    profissional,
    local,
    data_hora_formatada,
    data_consulta,
    tipo,
    status_geral,
    mensagem_template,
    mensagem_enviada,
    data_envio,
    whatsapp_message_id,
    data_marcacao,
    data_apareceu_dashboard,
    contexto,
    contexto_id,
    contexto_expires_at,
    reagendamento_de,
    reagendamento_data,
    reagendamento_tipo,
    data_resposta,
    badge_status,
    badge_info,
    criado_em,
    atualizado_em,
    criado_por,
    datetime('now') as data_arquivamento,
    'arquivamento_automatico' as motivo_arquivamento,
    'sistema' as arquivado_por
FROM consultas_ativas
WHERE data_consulta < datetime('now', '-24 hours'); -- Arquiva após 24h de passada

DELETE FROM consultas_ativas
WHERE id IN (
    SELECT id FROM consultas_ativas
    WHERE data_consulta < datetime('now', '-24 hours')
);
*/

-- ============================================================================
-- ESTATÍSTICAS: Consultas por Status Temporal
-- ============================================================================
-- SELECT
--     CASE
--         WHEN data_consulta >= datetime('now') THEN 'Futura'
--         WHEN data_consulta >= datetime('now', '-24 hours') THEN 'Passada (< 24h)'
--         WHEN data_consulta >= datetime('now', '-7 days') THEN 'Passada (< 7 dias)'
--         WHEN data_consulta >= datetime('now', '-30 days') THEN 'Passada (< 30 dias)'
--         ELSE 'Muito Antiga (90+ dias)'
--     END as status_temporal,
--     COUNT(*) as quantidade,
--     status_geral,
--     tipo
-- FROM consultas_ativas
-- GROUP BY status_temporal, status_geral, tipo
-- ORDER BY
--     CASE status_temporal
--         WHEN 'Futura' THEN 1
--         WHEN 'Passada (< 24h)' THEN 2
--         WHEN 'Passada (< 7 dias)' THEN 3
--         WHEN 'Passada (< 30 dias)' THEN 4
--         ELSE 5
--     END;

-- ============================================================================
-- QUERY: Limpar Consultas Muito Antigas (90+ dias)
-- ============================================================================
-- DELETE FROM consultas_ativas
-- WHERE data_consulta < datetime('now', '-90 days');
