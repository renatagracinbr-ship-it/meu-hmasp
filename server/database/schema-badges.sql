-- Schema para Sistema de Badges Centralizado
-- SQLite - Armazena badges para ambiente multi-usuário

/**
 * Tabela de Badges Ativos
 *
 * Centraliza TODOS os badges (DESMARCAR, REAGENDAR, etc.)
 * para que todos os usuários vejam os mesmos badges em tempo real
 *
 * Tipos de Badge:
 * - DESMARCAR (vermelho) → DESMARCADA (verde)
 * - REAGENDAR (vermelho) → REAGENDADA (verde)
 */
CREATE TABLE IF NOT EXISTS badges_ativos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    -- Identificação
    consulta_numero TEXT NOT NULL UNIQUE,
    confirmacao_id TEXT,  -- ID da confirmação original (se veio da aba Confirmação)
    desmarcacao_id TEXT,  -- ID da desmarcação (se veio da aba Desmarcação)

    -- Dados do paciente
    telefone TEXT NOT NULL,
    nome_paciente TEXT,
    prontuario TEXT,
    especialidade TEXT,
    data_hora_formatada TEXT,

    -- Badge
    tipo_badge TEXT NOT NULL, -- 'DESMARCAR' ou 'REAGENDAR'
    status_badge TEXT NOT NULL, -- 'vermelho' (pendente) ou 'verde' (concluído)
    label_badge TEXT NOT NULL, -- 'Desmarcar', 'Desmarcada', 'Reagendar', 'Reagendada'
    cor_badge TEXT NOT NULL, -- '#ef4444' (vermelho) ou '#10b981' (verde)

    -- Ação pendente
    acao_operador TEXT, -- 'desmarcar_aghuse', 'reagendar_aghuse', null
    descricao_acao TEXT,

    -- Controle de mensagens
    enviar_mensagem_desmarcacao BOOLEAN DEFAULT 1, -- 0 = NÃO enviar (paciente já sabe)
    mensagem_enviada BOOLEAN DEFAULT 0,

    -- Origem
    origem TEXT NOT NULL, -- 'confirmacao' ou 'desmarcacao'
    status_anterior TEXT, -- 'declined', 'not_scheduled', 'reagendamento', etc.

    -- Timestamps
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP,
    concluido_em TEXT, -- Quando badge ficou verde

    -- Metadados
    metadata TEXT -- JSON com dados extras
);

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_badges_consulta ON badges_ativos(consulta_numero);
CREATE INDEX IF NOT EXISTS idx_badges_telefone ON badges_ativos(telefone);
CREATE INDEX IF NOT EXISTS idx_badges_tipo ON badges_ativos(tipo_badge);
CREATE INDEX IF NOT EXISTS idx_badges_status ON badges_ativos(status_badge);
CREATE INDEX IF NOT EXISTS idx_badges_origem ON badges_ativos(origem);
CREATE INDEX IF NOT EXISTS idx_badges_criado ON badges_ativos(criado_em);

-- Índice composto para buscar badges pendentes
CREATE INDEX IF NOT EXISTS idx_badges_pendentes ON badges_ativos(status_badge, tipo_badge)
WHERE status_badge = 'vermelho';

/**
 * Tabela de Histórico de Badges (Audit Log)
 *
 * Armazena histórico de transições de badges para auditoria
 */
CREATE TABLE IF NOT EXISTS badges_historico (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    badge_id INTEGER NOT NULL,
    consulta_numero TEXT NOT NULL,

    -- Transição
    status_antigo TEXT,
    status_novo TEXT,
    label_antigo TEXT,
    label_novo TEXT,

    -- Operador (se aplicável)
    operador_id TEXT,
    operador_nome TEXT,
    acao TEXT, -- 'criado', 'atualizado', 'concluido', 'deletado'

    -- Timestamp
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP,

    -- Metadados
    metadata TEXT,

    FOREIGN KEY (badge_id) REFERENCES badges_ativos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_historico_badge ON badges_historico(badge_id);
CREATE INDEX IF NOT EXISTS idx_historico_consulta ON badges_historico(consulta_numero);
CREATE INDEX IF NOT EXISTS idx_historico_criado ON badges_historico(criado_em);
