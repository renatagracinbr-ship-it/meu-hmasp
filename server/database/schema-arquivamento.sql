-- Schema para sistema de arquivamento automático de confirmações
-- SQLite - Armazena confirmações antigas (72h+) em arquivo local

-- Tabela principal de confirmações arquivadas
CREATE TABLE IF NOT EXISTS confirmacoes_arquivadas (
    id TEXT PRIMARY KEY,
    prontuario TEXT,
    nome_paciente TEXT NOT NULL,
    consulta_numero TEXT,
    pac_codigo TEXT,
    especialidade TEXT,
    data_hora_formatada TEXT,
    profissional TEXT,
    local TEXT,
    tipo TEXT, -- 'marcada' ou 'lembrete72h'
    status_geral TEXT, -- 'pending', 'confirmed', 'declined', 'not_scheduled'
    data_marcacao TEXT,
    data_apareceu_dashboard TEXT, -- Data em que apareceu no dashboard (usado para arquivamento)
    data_resposta TEXT,
    data_arquivamento TEXT DEFAULT CURRENT_TIMESTAMP,
    dados_completos TEXT NOT NULL, -- JSON completo da confirmação
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Índices para busca rápida
CREATE INDEX IF NOT EXISTS idx_confirmacoes_nome_paciente ON confirmacoes_arquivadas(nome_paciente);
CREATE INDEX IF NOT EXISTS idx_confirmacoes_data_marcacao ON confirmacoes_arquivadas(data_marcacao);
CREATE INDEX IF NOT EXISTS idx_confirmacoes_data_apareceu ON confirmacoes_arquivadas(data_apareceu_dashboard);
CREATE INDEX IF NOT EXISTS idx_confirmacoes_data_arquivamento ON confirmacoes_arquivadas(data_arquivamento);
CREATE INDEX IF NOT EXISTS idx_confirmacoes_prontuario ON confirmacoes_arquivadas(prontuario);
CREATE INDEX IF NOT EXISTS idx_confirmacoes_tipo ON confirmacoes_arquivadas(tipo);
CREATE INDEX IF NOT EXISTS idx_confirmacoes_status ON confirmacoes_arquivadas(status_geral);

-- Índice para busca por nome (case-insensitive)
CREATE INDEX IF NOT EXISTS idx_confirmacoes_nome_lower ON confirmacoes_arquivadas(LOWER(nome_paciente));
