-- ============================================================================
-- MIGRATION 001: Adicionar Campos Faltantes Críticos
-- ============================================================================
-- Data: 2025-12-12
-- Autor: Sistema HMASP Chat
--
-- OBJETIVO:
-- Adicionar campos que são usados no código JavaScript mas não existem no
-- schema do banco de dados, causando perda de dados ao recarregar página.
--
-- IMPACTO:
-- - Badges persistirão entre reloads
-- - Dados de profissional e local serão mantidos
-- - Rastreamento de respostas completo
-- - Sincronização entre operadores completa
-- ============================================================================

BEGIN TRANSACTION;

-- ============================================================================
-- CONSULTAS_ATIVAS (Aba Confirmação de Presença)
-- ============================================================================

-- Informações adicionais da consulta
ALTER TABLE consultas_ativas ADD COLUMN profissional TEXT DEFAULT 'Não informado';
ALTER TABLE consultas_ativas ADD COLUMN local TEXT;

-- Informações do paciente (padronização com desmarcação)
ALTER TABLE consultas_ativas ADD COLUMN pac_codigo TEXT;
ALTER TABLE consultas_ativas ADD COLUMN nome_exibicao TEXT;

-- Rastreamento de interações
ALTER TABLE consultas_ativas ADD COLUMN data_resposta TEXT; -- ISO 8601 datetime

-- Sistema de Badges Inteligentes (CRÍTICO)
ALTER TABLE consultas_ativas ADD COLUMN badge_status TEXT; -- 'desmarcar', 'desmarcada', NULL
ALTER TABLE consultas_ativas ADD COLUMN badge_info TEXT; -- JSON com informações do badge

-- IMPORTANTE: contexto já existe no schema (linha 53 do schema-consultas.sql)
-- Apenas garantindo que existe e tem valor padrão correto
-- ALTER TABLE consultas_ativas ADD COLUMN contexto TEXT DEFAULT 'confirmacao';

-- ============================================================================
-- DESMARCACOES_ATIVAS (Aba Desmarcação)
-- ============================================================================

-- Informações adicionais da consulta (padronização com confirmação)
ALTER TABLE desmarcacoes_ativas ADD COLUMN local TEXT;

-- Rastreamento de interações
ALTER TABLE desmarcacoes_ativas ADD COLUMN resposta_em TEXT; -- ISO 8601 datetime

-- Compatibilidade com sistema de confirmação
ALTER TABLE desmarcacoes_ativas ADD COLUMN status_geral TEXT DEFAULT 'pending';
ALTER TABLE desmarcacoes_ativas ADD COLUMN data_marcacao TEXT; -- Data original de marcação

-- IMPORTANTE: contexto não existe no schema de desmarcação
-- Adicionando para validação de segurança
ALTER TABLE desmarcacoes_ativas ADD COLUMN contexto TEXT DEFAULT 'desmarcacao';

-- ============================================================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================================================

-- Índices para badges (consultas frequentes)
CREATE INDEX IF NOT EXISTS idx_consultas_ativas_badge ON consultas_ativas(badge_status);
CREATE INDEX IF NOT EXISTS idx_consultas_ativas_data_resposta ON consultas_ativas(data_resposta);

-- Índices para desmarcação
CREATE INDEX IF NOT EXISTS idx_desmarcacoes_ativas_resposta_em ON desmarcacoes_ativas(resposta_em);
CREATE INDEX IF NOT EXISTS idx_desmarcacoes_ativas_contexto ON desmarcacoes_ativas(contexto);

-- ============================================================================
-- ATUALIZAÇÃO DE DADOS EXISTENTES (SE HOUVER)
-- ============================================================================

-- Atualizar registros existentes com valores padrão
UPDATE consultas_ativas
SET
    profissional = 'Não informado',
    contexto = COALESCE(contexto, 'confirmacao'),
    nome_exibicao = SUBSTR(nome_paciente, 1, INSTR(nome_paciente || ' ', ' ') - 1) || ' ' || SUBSTR(nome_paciente, INSTR(nome_paciente || ' ', ' ') + 1, 1) || '.'
WHERE profissional IS NULL;

UPDATE desmarcacoes_ativas
SET
    contexto = COALESCE(contexto, 'desmarcacao'),
    status_geral = COALESCE(status_geral, 'pending')
WHERE contexto IS NULL;

-- ============================================================================
-- VERIFICAÇÃO PÓS-MIGRAÇÃO
-- ============================================================================

-- Verificar se todos os campos foram adicionados
SELECT
    name,
    'consultas_ativas' as tabela
FROM pragma_table_info('consultas_ativas')
WHERE name IN ('profissional', 'local', 'pac_codigo', 'nome_exibicao', 'data_resposta', 'badge_status', 'badge_info', 'contexto')

UNION ALL

SELECT
    name,
    'desmarcacoes_ativas' as tabela
FROM pragma_table_info('desmarcacoes_ativas')
WHERE name IN ('local', 'resposta_em', 'status_geral', 'data_marcacao', 'contexto');

COMMIT;

-- ============================================================================
-- ROLLBACK (se necessário)
-- ============================================================================
-- Não é possível fazer DROP COLUMN no SQLite
-- Se precisar reverter, será necessário:
-- 1. Criar nova tabela sem os campos
-- 2. Copiar dados
-- 3. Deletar tabela antiga
-- 4. Renomear nova tabela
-- ============================================================================
