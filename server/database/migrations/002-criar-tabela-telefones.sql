-- ============================================================================
-- MIGRATION 002: Criar Tabela de Telefones/Mensagens
-- ============================================================================
-- Data: 2025-12-12
-- Autor: Sistema HMASP Chat
--
-- PROBLEMA:
-- Arrays de telefones/mensagens não podem ser armazenados diretamente
-- no SQLite. Atualmente são mantidos apenas em memória, causando perda
-- ao recarregar página.
--
-- SOLUÇÃO:
-- Criar tabelas separadas para armazenar telefones/mensagens de cada
-- confirmação/desmarcação com relacionamento 1:N
--
-- IMPACTO:
-- - Persistência completa de telefones
-- - Múltiplos telefones por paciente
-- - Status individual de envio por telefone
-- - Sistema de prioridade mantido
-- ============================================================================

BEGIN TRANSACTION;

-- ============================================================================
-- TABELA: Telefones de Confirmações
-- ============================================================================

CREATE TABLE IF NOT EXISTS consulta_telefones (
    -- Identificação
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    consulta_id TEXT NOT NULL,                  -- FK para consultas_ativas.id

    -- Dados do Telefone
    telefone TEXT NOT NULL,                     -- Normalizado: 5511987654321
    telefone_formatado TEXT,                    -- Display: (11) 98765-4321
    telefone_type TEXT,                         -- 'mobile', 'fixo', 'recado'
    telefone_origem TEXT,                       -- Telefone original do AGHUse
    chat_id TEXT,                               -- WhatsApp chat ID (@c.us)

    -- Status e Prioridade
    status TEXT DEFAULT 'pending',              -- pending, sent, delivered, read, confirmed, declined, not_scheduled
    prioridade INTEGER DEFAULT 1,               -- 1 (principal), 2, 3...
    tentativas INTEGER DEFAULT 0,               -- Número de tentativas de envio

    -- Mensagem
    mensagem_texto TEXT,                        -- Texto da mensagem enviada
    mensagem_template_id TEXT,                  -- ID do template usado

    -- WhatsApp
    whatsapp_message_id TEXT,                   -- ID da mensagem no WhatsApp
    data_envio TEXT,                            -- Quando foi enviada (ISO 8601)
    data_entrega TEXT,                          -- Quando foi entregue (ISO 8601)
    data_leitura TEXT,                          -- Quando foi lida (ISO 8601)

    -- Logs e Erros
    logs TEXT,                                  -- JSON array de logs
    ultimo_erro TEXT,                           -- Última mensagem de erro

    -- Metadados
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    FOREIGN KEY (consulta_id) REFERENCES consultas_ativas(id) ON DELETE CASCADE,
    UNIQUE(consulta_id, telefone)               -- Evita duplicatas
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_consulta_telefones_consulta ON consulta_telefones(consulta_id);
CREATE INDEX IF NOT EXISTS idx_consulta_telefones_telefone ON consulta_telefones(telefone);
CREATE INDEX IF NOT EXISTS idx_consulta_telefones_status ON consulta_telefones(status);
CREATE INDEX IF NOT EXISTS idx_consulta_telefones_prioridade ON consulta_telefones(prioridade);

-- ============================================================================
-- TABELA: Telefones de Desmarcações
-- ============================================================================

CREATE TABLE IF NOT EXISTS desmarcacao_telefones (
    -- Identificação
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    desmarcacao_id TEXT NOT NULL,               -- FK para desmarcacoes_ativas.id

    -- Dados do Telefone
    telefone TEXT NOT NULL,                     -- Normalizado: 5511987654321
    telefone_formatado TEXT,                    -- Display: (11) 98765-4321
    telefone_type TEXT,                         -- 'mobile', 'fixo', 'recado'
    telefone_origem TEXT,                       -- Telefone original do AGHUse
    chat_id TEXT,                               -- WhatsApp chat ID (@c.us)

    -- Status e Prioridade
    status TEXT DEFAULT 'pending',              -- pending, sent, delivered, read, reagendamento, sem_reagendamento, paciente_solicitou
    prioridade INTEGER DEFAULT 1,               -- 1 (principal), 2, 3...
    tentativas INTEGER DEFAULT 0,               -- Número de tentativas de envio

    -- Mensagem
    mensagem_texto TEXT,                        -- Texto da mensagem enviada
    mensagem_template_id TEXT,                  -- ID do template usado

    -- WhatsApp
    whatsapp_message_id TEXT,                   -- ID da mensagem no WhatsApp
    data_envio TEXT,                            -- Quando foi enviada (ISO 8601)
    data_entrega TEXT,                          -- Quando foi entregue (ISO 8601)
    data_leitura TEXT,                          -- Quando foi lida (ISO 8601)

    -- Logs e Erros
    logs TEXT,                                  -- JSON array de logs
    ultimo_erro TEXT,                           -- Última mensagem de erro

    -- Metadados
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    FOREIGN KEY (desmarcacao_id) REFERENCES desmarcacoes_ativas(id) ON DELETE CASCADE,
    UNIQUE(desmarcacao_id, telefone)            -- Evita duplicatas
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_desmarcacao_telefones_desmarcacao ON desmarcacao_telefones(desmarcacao_id);
CREATE INDEX IF NOT EXISTS idx_desmarcacao_telefones_telefone ON desmarcacao_telefones(telefone);
CREATE INDEX IF NOT EXISTS idx_desmarcacao_telefones_status ON desmarcacao_telefones(status);
CREATE INDEX IF NOT EXISTS idx_desmarcacao_telefones_prioridade ON desmarcacao_telefones(prioridade);

-- ============================================================================
-- VIEWS: Consultas COM telefones (JOIN)
-- ============================================================================

-- View: Confirmações com telefones
CREATE VIEW IF NOT EXISTS vw_consultas_com_telefones AS
SELECT
    c.*,
    GROUP_CONCAT(
        json_object(
            'telefone', t.telefone,
            'telefoneFormatado', t.telefone_formatado,
            'telefoneType', t.telefone_type,
            'chatId', t.chat_id,
            'status', t.status,
            'prioridade', t.prioridade
        ), '|||'
    ) as telefones_json
FROM consultas_ativas c
LEFT JOIN consulta_telefones t ON c.id = t.consulta_id
GROUP BY c.id;

-- View: Desmarcações com telefones
CREATE VIEW IF NOT EXISTS vw_desmarcacoes_com_telefones AS
SELECT
    d.*,
    GROUP_CONCAT(
        json_object(
            'telefone', t.telefone,
            'telefoneFormatado', t.telefone_formatado,
            'telefoneType', t.telefone_type,
            'chatId', t.chat_id,
            'status', t.status,
            'prioridade', t.prioridade
        ), '|||'
    ) as telefones_json
FROM desmarcacoes_ativas d
LEFT JOIN desmarcacao_telefones t ON d.id = t.desmarcacao_id
GROUP BY d.id;

-- ============================================================================
-- TRIGGERS: Atualização automática de timestamps
-- ============================================================================

CREATE TRIGGER IF NOT EXISTS trg_consulta_telefones_updated
AFTER UPDATE ON consulta_telefones
FOR EACH ROW
BEGIN
    UPDATE consulta_telefones
    SET atualizado_em = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_desmarcacao_telefones_updated
AFTER UPDATE ON desmarcacao_telefones
FOR EACH ROW
BEGIN
    UPDATE desmarcacao_telefones
    SET atualizado_em = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

-- ============================================================================
-- TRIGGERS: Atualizar tabela principal ao mudar telefone
-- ============================================================================

-- Quando status de telefone muda, pode precisar atualizar status_geral
CREATE TRIGGER IF NOT EXISTS trg_atualiza_status_consulta
AFTER UPDATE OF status ON consulta_telefones
FOR EACH ROW
BEGIN
    -- Atualiza timestamp da consulta
    UPDATE consultas_ativas
    SET atualizado_em = CURRENT_TIMESTAMP
    WHERE id = NEW.consulta_id;

    -- Se todos telefones foram respondidos, atualizar status_geral
    -- (lógica a ser implementada no código)
END;

CREATE TRIGGER IF NOT EXISTS trg_atualiza_status_desmarcacao
AFTER UPDATE OF status ON desmarcacao_telefones
FOR EACH ROW
BEGIN
    -- Atualiza timestamp da desmarcação
    UPDATE desmarcacoes_ativas
    SET atualizado_em = CURRENT_TIMESTAMP
    WHERE id = NEW.desmarcacao_id;
END;

-- ============================================================================
-- VERIFICAÇÃO PÓS-MIGRAÇÃO
-- ============================================================================

SELECT
    'consulta_telefones' as tabela,
    COUNT(*) as total_campos
FROM pragma_table_info('consulta_telefones')

UNION ALL

SELECT
    'desmarcacao_telefones' as tabela,
    COUNT(*) as total_campos
FROM pragma_table_info('desmarcacao_telefones');

COMMIT;

-- ============================================================================
-- NOTAS DE IMPLEMENTAÇÃO
-- ============================================================================

/*
COMO USAR:

1. INSERIR CONFIRMAÇÃO COM TELEFONES:
   - Inserir na tabela principal (consultas_ativas)
   - Para cada telefone, inserir em consulta_telefones

2. BUSCAR CONFIRMAÇÃO COM TELEFONES:
   - Opção 1: Usar view vw_consultas_com_telefones
   - Opção 2: Fazer JOIN manual
   - Opção 3: Buscar principal + buscar telefones separado

3. ATUALIZAR STATUS DE TELEFONE:
   - UPDATE consulta_telefones SET status = 'confirmed' WHERE id = ?

4. CONVERSÃO PARA FRONTEND:
   - Parsear telefones_json de volta para array JavaScript
   - Usar split('|||') e JSON.parse() para cada item

EXEMPLO:

INSERT INTO consultas_ativas (id, consulta_numero, ...) VALUES (...);
INSERT INTO consulta_telefones (consulta_id, telefone, prioridade) VALUES
    ('conf-123', '5511987654321', 1),
    ('conf-123', '5511876543210', 2);

SELECT * FROM vw_consultas_com_telefones WHERE consulta_numero = '123456';
*/
