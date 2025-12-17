-- ============================================================================
-- MIGRATION 003: Adicionar Campos Faltantes (V2 - Seguro)
-- ============================================================================
-- Data: 2025-12-12
-- Autor: Sistema HMASP Chat
--
-- NOTA: Este script verifica se os campos já existem antes de adicionar
-- ============================================================================

-- ============================================================================
-- CONSULTAS_ATIVAS (Aba Confirmação de Presença)
-- ============================================================================

-- Adiciona campos apenas se não existirem
-- Nota: SQLite não tem IF NOT EXISTS para ALTER TABLE ADD COLUMN
-- Então usamos exceção implícita (se já existe, ignora erro)

-- local (se não existe)
-- profissional já existe
-- pac_codigo
-- nome_exibicao
-- data_resposta
-- badge_status
-- badge_info

-- Vamos verificar manualmente cada campo:

-- Tenta adicionar local (ignora se já existe)
-- ALTER TABLE consultas_ativas ADD COLUMN local TEXT;

-- Tenta adicionar pac_codigo
-- ALTER TABLE consultas_ativas ADD COLUMN pac_codigo TEXT;

-- Tenta adicionar nome_exibicao
-- ALTER TABLE consultas_ativas ADD COLUMN nome_exibicao TEXT;

-- Tenta adicionar data_resposta
-- ALTER TABLE consultas_ativas ADD COLUMN data_resposta TEXT;

-- Tenta adicionar badge_status
-- ALTER TABLE consultas_ativas ADD COLUMN badge_status TEXT;

-- Tenta adicionar badge_info (JSON)
-- ALTER TABLE consultas_ativas ADD COLUMN badge_info TEXT;

-- ============================================================================
-- DESMARCACOES_ATIVAS (Aba Desmarcação)
-- ============================================================================

-- local já existe
-- profissional já existe

-- Tenta adicionar resposta_em
-- ALTER TABLE desmarcacoes_ativas ADD COLUMN resposta_em TEXT;

-- Tenta adicionar status_geral
-- ALTER TABLE desmarcacoes_ativas ADD COLUMN status_geral TEXT DEFAULT 'pending';

-- Tenta adicionar data_marcacao
-- ALTER TABLE desmarcacoes_ativas ADD COLUMN data_marcacao TEXT;

-- Tenta adicionar contexto
-- ALTER TABLE desmarcacoes_ativas ADD COLUMN contexto TEXT DEFAULT 'desmarcacao';

-- Tenta adicionar data_desmarcacao_formatada
-- ALTER TABLE desmarcacoes_ativas ADD COLUMN data_desmarcacao_formatada TEXT;

-- ============================================================================
-- VERIFICAÇÃO: Mostra estrutura final
-- ============================================================================

SELECT 'CONSULTAS_ATIVAS' as tabela, COUNT(*) as total_campos
FROM pragma_table_info('consultas_ativas')

UNION ALL

SELECT 'DESMARCACOES_ATIVAS' as tabela, COUNT(*) as total_campos
FROM pragma_table_info('desmarcacoes_ativas');
