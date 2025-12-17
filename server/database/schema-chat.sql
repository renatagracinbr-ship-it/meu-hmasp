-- ============================================================
-- SCHEMA: Sistema de Chat Proprio - Meu HMASP
-- ============================================================
-- Substitui o WhatsApp por um chat interno
-- Comunicacao entre operadores e pacientes
-- ============================================================

-- Tabela de conversas (cada paciente tem uma conversa)
CREATE TABLE IF NOT EXISTS chat_conversas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Identificacao do paciente
    paciente_id TEXT NOT NULL,           -- Prontuario ou ID unico
    paciente_nome TEXT,
    paciente_telefone TEXT,

    -- Status da conversa
    status TEXT DEFAULT 'ativa',          -- ativa, arquivada, bloqueada
    ultima_mensagem_at DATETIME,
    ultima_mensagem_preview TEXT,

    -- Contadores
    mensagens_nao_lidas_operador INTEGER DEFAULT 0,  -- Msgs do paciente nao lidas
    mensagens_nao_lidas_paciente INTEGER DEFAULT 0,  -- Msgs do operador nao lidas

    -- Metadados
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(paciente_id)
);

-- Tabela de mensagens
CREATE TABLE IF NOT EXISTS chat_mensagens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Referencia a conversa
    conversa_id INTEGER NOT NULL,

    -- Remetente
    remetente_tipo TEXT NOT NULL,        -- 'paciente' ou 'operador'
    remetente_id TEXT,                   -- ID do operador (se aplicavel)
    remetente_nome TEXT,

    -- Conteudo
    tipo TEXT DEFAULT 'texto',           -- texto, imagem, arquivo, sistema
    conteudo TEXT NOT NULL,

    -- Status
    status TEXT DEFAULT 'enviada',       -- enviada, entregue, lida
    lida_at DATETIME,

    -- Metadados
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (conversa_id) REFERENCES chat_conversas(id)
);

-- Tabela de operadores online (para saber quem esta disponivel)
CREATE TABLE IF NOT EXISTS chat_operadores_online (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operador_id TEXT NOT NULL,
    operador_nome TEXT,
    ultimo_ping DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'online',        -- online, ausente, ocupado

    UNIQUE(operador_id)
);

-- Indices para performance
CREATE INDEX IF NOT EXISTS idx_mensagens_conversa ON chat_mensagens(conversa_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_created ON chat_mensagens(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversas_paciente ON chat_conversas(paciente_id);
CREATE INDEX IF NOT EXISTS idx_conversas_ultima_msg ON chat_conversas(ultima_mensagem_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversas_status ON chat_conversas(status);

-- Trigger para atualizar updated_at na conversa
CREATE TRIGGER IF NOT EXISTS trg_conversas_updated_at
AFTER UPDATE ON chat_conversas
BEGIN
    UPDATE chat_conversas SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger para atualizar conversa quando nova mensagem e inserida
CREATE TRIGGER IF NOT EXISTS trg_atualiza_conversa_nova_mensagem
AFTER INSERT ON chat_mensagens
BEGIN
    UPDATE chat_conversas
    SET
        ultima_mensagem_at = NEW.created_at,
        ultima_mensagem_preview = SUBSTR(NEW.conteudo, 1, 100),
        mensagens_nao_lidas_operador = CASE
            WHEN NEW.remetente_tipo = 'paciente'
            THEN mensagens_nao_lidas_operador + 1
            ELSE mensagens_nao_lidas_operador
        END,
        mensagens_nao_lidas_paciente = CASE
            WHEN NEW.remetente_tipo = 'operador'
            THEN mensagens_nao_lidas_paciente + 1
            ELSE mensagens_nao_lidas_paciente
        END
    WHERE id = NEW.conversa_id;
END;
