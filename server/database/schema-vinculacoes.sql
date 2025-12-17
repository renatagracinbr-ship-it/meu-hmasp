-- Schema para vinculação Confirmação → Desmarcação
-- SQLite - Armazena vinculações entre confirmações e desmarcações

-- Tabela de vinculações (para detectar quando desmarcação veio da aba Confirmação)
CREATE TABLE IF NOT EXISTS vinculacoes_confirmacao_desmarcacao (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    confirmacao_id TEXT NOT NULL,
    consulta_numero TEXT NOT NULL,
    telefone TEXT NOT NULL,
    nome_paciente TEXT,
    prontuario TEXT,
    especialidade TEXT,
    status_anterior TEXT, -- 'declined' ou 'not_scheduled'
    badge_status TEXT DEFAULT 'desmarcar', -- 'desmarcar' (vermelho) ou 'desmarcada' (verde)
    criado_em TEXT DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TEXT DEFAULT CURRENT_TIMESTAMP,
    desmarcada_em TEXT, -- Quando operador desmarcou no AGHUse
    UNIQUE(consulta_numero, telefone) -- Não permite duplicatas
);

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_vinculacoes_consulta ON vinculacoes_confirmacao_desmarcacao(consulta_numero);
CREATE INDEX IF NOT EXISTS idx_vinculacoes_telefone ON vinculacoes_confirmacao_desmarcacao(telefone);
CREATE INDEX IF NOT EXISTS idx_vinculacoes_confirmacao_id ON vinculacoes_confirmacao_desmarcacao(confirmacao_id);
CREATE INDEX IF NOT EXISTS idx_vinculacoes_badge_status ON vinculacoes_confirmacao_desmarcacao(badge_status);
CREATE INDEX IF NOT EXISTS idx_vinculacoes_criado_em ON vinculacoes_confirmacao_desmarcacao(criado_em);
