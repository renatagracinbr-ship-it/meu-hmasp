-- ============================================================
-- SCHEMA: Agenda de Contatos WhatsApp
-- ============================================================
-- Descrição: Sistema completo de gerenciamento de contatos
--            integrado com WhatsApp e AGHUse
-- Data: 2025-12-12
-- ============================================================

-- ============================================================
-- TABELA: Contatos
-- ============================================================
CREATE TABLE IF NOT EXISTS contatos (
    -- Identificação
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telefone VARCHAR(20) UNIQUE NOT NULL,  -- Telefone normalizado (apenas números)
    whatsapp_id VARCHAR(100),              -- ID do WhatsApp (55999999999@c.us)

    -- Dados Pessoais
    nome_completo VARCHAR(200),            -- Nome completo do paciente
    nome_preferido VARCHAR(100),           -- Como prefere ser chamado
    cpf VARCHAR(14),                       -- CPF (com formatação)
    data_nascimento DATE,                  -- Data de nascimento
    genero VARCHAR(20),                    -- 'M', 'F', 'Outro', 'Não informado'

    -- Integração AGHUse
    prontuario VARCHAR(20),                -- Número do prontuário no AGHUse
    codigo_paciente INTEGER,               -- Código do paciente no AGHUse

    -- Contatos Adicionais
    telefone_secundario VARCHAR(20),       -- Telefone alternativo
    email VARCHAR(200),                    -- E-mail

    -- Endereço
    cep VARCHAR(10),
    logradouro VARCHAR(200),
    numero VARCHAR(20),
    complemento VARCHAR(100),
    bairro VARCHAR(100),
    cidade VARCHAR(100),
    estado VARCHAR(2),

    -- WhatsApp
    tem_whatsapp BOOLEAN DEFAULT 1,        -- Possui WhatsApp
    foto_perfil_url TEXT,                  -- URL da foto de perfil
    ultima_atualizacao_foto DATETIME,      -- Última vez que foto foi atualizada
    pushname VARCHAR(100),                 -- Nome no WhatsApp (pushname)
    about TEXT,                            -- Status/Bio do WhatsApp

    -- Preferências de Comunicação
    aceita_mensagens BOOLEAN DEFAULT 1,    -- Aceitou receber mensagens
    data_opt_in DATETIME,                  -- Data do consentimento
    data_opt_out DATETIME,                 -- Data da recusa
    idioma_preferido VARCHAR(10) DEFAULT 'pt-BR',
    horario_preferido VARCHAR(50),         -- Ex: "14:00-18:00"

    -- Informações Médicas (básicas)
    plano_saude VARCHAR(100),
    numero_carteirinha VARCHAR(50),

    -- Tags e Categorias
    tags TEXT,                             -- JSON: ["vip", "idoso", "gestante"]
    observacoes TEXT,                      -- Observações importantes

    -- Estatísticas
    total_consultas INTEGER DEFAULT 0,     -- Total de consultas agendadas
    total_confirmacoes INTEGER DEFAULT 0,  -- Total de confirmações enviadas
    total_respostas INTEGER DEFAULT 0,     -- Total de respostas recebidas
    taxa_resposta REAL DEFAULT 0,          -- % de respostas (0-100)
    ultima_consulta_data DATE,             -- Data da última consulta
    proxima_consulta_data DATE,            -- Data da próxima consulta

    -- Status
    ativo BOOLEAN DEFAULT 1,               -- Contato ativo
    bloqueado BOOLEAN DEFAULT 0,           -- Bloqueado pelo sistema
    motivo_bloqueio TEXT,                  -- Motivo do bloqueio

    -- Auditoria
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    criado_por VARCHAR(100),
    atualizado_por VARCHAR(100),

    -- Sincronização
    sincronizado_aghuse BOOLEAN DEFAULT 0, -- Sincronizado com AGHUse
    ultima_sincronizacao DATETIME,         -- Última sincronização com AGHUse
    sincronizado_whatsapp BOOLEAN DEFAULT 0, -- Sincronizado com WhatsApp
    ultima_sincronizacao_whatsapp DATETIME -- Última sincronização com WhatsApp
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_contatos_telefone ON contatos(telefone);
CREATE INDEX IF NOT EXISTS idx_contatos_whatsapp_id ON contatos(whatsapp_id);
CREATE INDEX IF NOT EXISTS idx_contatos_cpf ON contatos(cpf);
CREATE INDEX IF NOT EXISTS idx_contatos_prontuario ON contatos(prontuario);
CREATE INDEX IF NOT EXISTS idx_contatos_codigo_paciente ON contatos(codigo_paciente);
CREATE INDEX IF NOT EXISTS idx_contatos_nome ON contatos(nome_completo);
CREATE INDEX IF NOT EXISTS idx_contatos_ativo ON contatos(ativo);

-- ============================================================
-- TABELA: Histórico de Interações
-- ============================================================
CREATE TABLE IF NOT EXISTS contatos_interacoes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contato_id INTEGER NOT NULL,

    -- Tipo de Interação
    tipo VARCHAR(50) NOT NULL,  -- 'confirmacao', 'desmarcacao', 'reagendamento', 'lembrete', 'manual'
    direcao VARCHAR(20) NOT NULL, -- 'enviada', 'recebida'

    -- Conteúdo
    texto TEXT,                 -- Texto da mensagem
    template_usado VARCHAR(100), -- Template usado (se aplicável)

    -- Resposta
    resposta_texto TEXT,        -- Texto da resposta (se recebida)
    resposta_processada BOOLEAN DEFAULT 0,
    intencao_detectada VARCHAR(50), -- Intenção classificada
    confidence REAL,            -- Confidence da classificação (0-1)

    -- Contexto
    consulta_id INTEGER,        -- ID da consulta relacionada
    confirmacao_id INTEGER,     -- ID da confirmação relacionada

    -- Metadata
    metadata TEXT,              -- JSON com dados extras

    -- Timestamps
    enviada_em DATETIME,
    recebida_em DATETIME,
    processada_em DATETIME,

    FOREIGN KEY (contato_id) REFERENCES contatos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_interacoes_contato ON contatos_interacoes(contato_id);
CREATE INDEX IF NOT EXISTS idx_interacoes_tipo ON contatos_interacoes(tipo);
CREATE INDEX IF NOT EXISTS idx_interacoes_consulta ON contatos_interacoes(consulta_id);

-- ============================================================
-- TABELA: Grupos/Labels
-- ============================================================
CREATE TABLE IF NOT EXISTS contatos_grupos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome VARCHAR(100) UNIQUE NOT NULL,
    descricao TEXT,
    cor VARCHAR(20),            -- Cor do label (hex)
    icone VARCHAR(50),          -- Emoji ou ícone
    ativo BOOLEAN DEFAULT 1,
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Grupos pré-definidos
INSERT OR IGNORE INTO contatos_grupos (nome, descricao, cor, icone) VALUES
('VIP', 'Pacientes VIP com atendimento prioritário', '#FFD700', '⭐'),
('Idoso', 'Pacientes com 60+ anos', '#9CA3AF', '👴'),
('Gestante', 'Pacientes gestantes', '#FFC0CB', '🤰'),
('Deficiência', 'Pacientes com deficiência ou mobilidade reduzida', '#60A5FA', '♿'),
('Crônico', 'Pacientes com doenças crônicas', '#F87171', '💊'),
('Primeira Consulta', 'Primeira vez no hospital', '#10B981', '🆕'),
('Alta Frequência', 'Pacientes com consultas frequentes', '#8B5CF6', '📅'),
('Sem Resposta', 'Pacientes que não respondem mensagens', '#EF4444', '❌');

-- ============================================================
-- TABELA: Relacionamento Contatos-Grupos
-- ============================================================
CREATE TABLE IF NOT EXISTS contatos_grupos_rel (
    contato_id INTEGER NOT NULL,
    grupo_id INTEGER NOT NULL,
    adicionado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    adicionado_por VARCHAR(100),

    PRIMARY KEY (contato_id, grupo_id),
    FOREIGN KEY (contato_id) REFERENCES contatos(id) ON DELETE CASCADE,
    FOREIGN KEY (grupo_id) REFERENCES contatos_grupos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_contatos_grupos_contato ON contatos_grupos_rel(contato_id);
CREATE INDEX IF NOT EXISTS idx_contatos_grupos_grupo ON contatos_grupos_rel(grupo_id);

-- ============================================================
-- TABELA: Notas sobre Contatos
-- ============================================================
CREATE TABLE IF NOT EXISTS contatos_notas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contato_id INTEGER NOT NULL,

    titulo VARCHAR(200),
    nota TEXT NOT NULL,
    tipo VARCHAR(50),           -- 'importante', 'alerta', 'info', 'historico'

    -- Metadata
    privada BOOLEAN DEFAULT 0,  -- Visível apenas para quem criou
    fixada BOOLEAN DEFAULT 0,   -- Nota fixada no topo

    -- Auditoria
    criada_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    criada_por VARCHAR(100),
    atualizada_em DATETIME,
    atualizada_por VARCHAR(100),

    FOREIGN KEY (contato_id) REFERENCES contatos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notas_contato ON contatos_notas(contato_id);
CREATE INDEX IF NOT EXISTS idx_notas_tipo ON contatos_notas(tipo);

-- ============================================================
-- TABELA: Log de Mudanças (Auditoria)
-- ============================================================
CREATE TABLE IF NOT EXISTS contatos_auditoria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contato_id INTEGER NOT NULL,

    -- Ação
    acao VARCHAR(50) NOT NULL,  -- 'criado', 'atualizado', 'deletado', 'bloqueado', etc
    campo_alterado VARCHAR(100), -- Campo que foi alterado
    valor_anterior TEXT,         -- Valor anterior (JSON se necessário)
    valor_novo TEXT,             -- Valor novo (JSON se necessário)

    -- Metadata
    usuario VARCHAR(100),
    ip_address VARCHAR(50),
    user_agent TEXT,

    -- Timestamp
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (contato_id) REFERENCES contatos(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_auditoria_contato ON contatos_auditoria(contato_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_acao ON contatos_auditoria(acao);
CREATE INDEX IF NOT EXISTS idx_auditoria_data ON contatos_auditoria(criado_em);

-- ============================================================
-- VIEWS: Estatísticas e Relatórios
-- ============================================================

-- View: Contatos com estatísticas
CREATE VIEW IF NOT EXISTS vw_contatos_estatisticas AS
SELECT
    c.*,
    COUNT(DISTINCT i.id) as total_interacoes,
    COUNT(DISTINCT CASE WHEN i.direcao = 'enviada' THEN i.id END) as total_enviadas,
    COUNT(DISTINCT CASE WHEN i.direcao = 'recebida' THEN i.id END) as total_recebidas,
    GROUP_CONCAT(DISTINCT g.nome) as grupos,
    COUNT(DISTINCT n.id) as total_notas
FROM contatos c
LEFT JOIN contatos_interacoes i ON c.id = i.contato_id
LEFT JOIN contatos_grupos_rel cgr ON c.id = cgr.contato_id
LEFT JOIN contatos_grupos g ON cgr.grupo_id = g.id
LEFT JOIN contatos_notas n ON c.id = n.contato_id
WHERE c.ativo = 1
GROUP BY c.id;

-- View: Contatos sem resposta
CREATE VIEW IF NOT EXISTS vw_contatos_sem_resposta AS
SELECT
    c.*,
    COUNT(i.id) as mensagens_enviadas
FROM contatos c
LEFT JOIN contatos_interacoes i ON c.id = i.contato_id AND i.direcao = 'enviada'
WHERE c.ativo = 1
  AND c.total_confirmacoes > 0
  AND (c.total_respostas = 0 OR c.taxa_resposta < 30)
GROUP BY c.id
HAVING mensagens_enviadas > 2;

-- View: Contatos VIP/Prioritários
CREATE VIEW IF NOT EXISTS vw_contatos_prioritarios AS
SELECT c.*
FROM contatos c
INNER JOIN contatos_grupos_rel cgr ON c.id = cgr.contato_id
INNER JOIN contatos_grupos g ON cgr.grupo_id = g.id
WHERE c.ativo = 1
  AND g.nome IN ('VIP', 'Gestante', 'Idoso', 'Deficiência')
GROUP BY c.id;

-- ============================================================
-- TRIGGERS: Automações
-- ============================================================

-- Trigger: Atualiza timestamp de atualização
CREATE TRIGGER IF NOT EXISTS trg_contatos_updated_at
AFTER UPDATE ON contatos
FOR EACH ROW
BEGIN
    UPDATE contatos
    SET atualizado_em = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

-- Trigger: Calcula taxa de resposta
CREATE TRIGGER IF NOT EXISTS trg_contatos_taxa_resposta
AFTER UPDATE OF total_confirmacoes, total_respostas ON contatos
FOR EACH ROW
BEGIN
    UPDATE contatos
    SET taxa_resposta = CASE
        WHEN NEW.total_confirmacoes > 0
        THEN (CAST(NEW.total_respostas AS REAL) / NEW.total_confirmacoes) * 100
        ELSE 0
    END
    WHERE id = NEW.id;
END;

-- Trigger: Log de auditoria em updates
CREATE TRIGGER IF NOT EXISTS trg_contatos_auditoria_update
AFTER UPDATE ON contatos
FOR EACH ROW
WHEN NEW.nome_completo != OLD.nome_completo
  OR NEW.telefone != OLD.telefone
  OR NEW.email != OLD.email
  OR NEW.ativo != OLD.ativo
BEGIN
    INSERT INTO contatos_auditoria (contato_id, acao, valor_anterior, valor_novo)
    VALUES (NEW.id, 'atualizado',
            json_object('nome', OLD.nome_completo, 'telefone', OLD.telefone, 'email', OLD.email, 'ativo', OLD.ativo),
            json_object('nome', NEW.nome_completo, 'telefone', NEW.telefone, 'email', NEW.email, 'ativo', NEW.ativo)
    );
END;

-- Trigger: Log de auditoria em bloqueios
CREATE TRIGGER IF NOT EXISTS trg_contatos_auditoria_bloqueio
AFTER UPDATE OF bloqueado ON contatos
FOR EACH ROW
WHEN NEW.bloqueado != OLD.bloqueado
BEGIN
    INSERT INTO contatos_auditoria (contato_id, acao, campo_alterado, valor_anterior, valor_novo)
    VALUES (NEW.id,
            CASE WHEN NEW.bloqueado = 1 THEN 'bloqueado' ELSE 'desbloqueado' END,
            'bloqueado',
            CAST(OLD.bloqueado AS TEXT),
            CAST(NEW.bloqueado AS TEXT)
    );
END;
