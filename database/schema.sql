-- ============================================
-- HMASP Chat - Schema PostgreSQL
-- Database: hmasp_chat_producao
-- Versão: 1.0
-- Data: Dezembro 2025
-- ============================================

-- Criar extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- Para busca de texto

-- ============================================
-- TABELA: usuarios
-- Usuários do sistema com autenticação
-- ============================================
CREATE TABLE IF NOT EXISTS usuarios (
    uid VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    display_name VARCHAR(255),
    photo_url TEXT,
    role VARCHAR(20) CHECK (role IN ('admin', 'user', 'pending')) DEFAULT 'pending',
    ativo BOOLEAN DEFAULT false,
    data_criacao TIMESTAMP DEFAULT NOW(),
    ultimo_acesso TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE usuarios IS 'Usuários do sistema com controle de acesso';
COMMENT ON COLUMN usuarios.role IS 'admin: acesso total | user: acesso limitado | pending: aguardando aprovação';
COMMENT ON COLUMN usuarios.ativo IS 'Apenas usuários ativos podem acessar o sistema';

-- ============================================
-- TABELA: pacientes
-- Dados dos pacientes do hospital
-- ============================================
CREATE TABLE IF NOT EXISTS pacientes (
    cpf VARCHAR(11) PRIMARY KEY,
    nome_completo VARCHAR(255) NOT NULL,
    primeiro_nome VARCHAR(100),
    ultimo_nome VARCHAR(100),
    prontuario VARCHAR(50),
    data_nascimento DATE,
    data_criacao TIMESTAMP DEFAULT NOW(),
    ultima_atualizacao TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE pacientes IS 'Cadastro de pacientes (dados sensíveis - LGPD)';
COMMENT ON COLUMN pacientes.cpf IS 'CPF sem pontos ou traços (apenas números)';

-- ============================================
-- TABELA: pacientes_telefones
-- Telefones dos pacientes (relacionamento 1:N)
-- ============================================
CREATE TABLE IF NOT EXISTS pacientes_telefones (
    id SERIAL PRIMARY KEY,
    cpf VARCHAR(11) NOT NULL REFERENCES pacientes(cpf) ON DELETE CASCADE,
    tipo VARCHAR(50),  -- Ex: 'celular', 'residencial', 'comercial'
    numero VARCHAR(20) NOT NULL,
    normalized VARCHAR(20),  -- Formato E.164: +5511999999999
    phone_type VARCHAR(20) CHECK (phone_type IN ('mobile', 'landline')),
    principal BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(cpf, numero)
);

COMMENT ON TABLE pacientes_telefones IS 'Telefones de contato dos pacientes';
COMMENT ON COLUMN pacientes_telefones.normalized IS 'Número normalizado no formato E.164 para WhatsApp';

-- ============================================
-- TABELA: agenda_contatos
-- Agenda complementar com observações
-- ============================================
CREATE TABLE IF NOT EXISTS agenda_contatos (
    cpf VARCHAR(11) PRIMARY KEY REFERENCES pacientes(cpf) ON DELETE CASCADE,
    observacoes TEXT,
    preferencia_contato VARCHAR(20) CHECK (preferencia_contato IN ('whatsapp', 'ligacao', 'sms')),
    melhor_horario VARCHAR(50),
    ultima_atualizacao TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE agenda_contatos IS 'Informações adicionais para contato com pacientes';

-- ============================================
-- TABELA: audit_logs
-- Logs de auditoria para conformidade LGPD
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT NOW(),
    user_id VARCHAR(255),
    user_email VARCHAR(255),
    action VARCHAR(50) NOT NULL,  -- create, read, update, delete, send, view
    resource VARCHAR(50) NOT NULL,  -- patient, message, appointment, etc
    resource_id VARCHAR(255),
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    success BOOLEAN DEFAULT true
);

COMMENT ON TABLE audit_logs IS 'Registro de todas as ações no sistema (LGPD Art. 37)';
COMMENT ON COLUMN audit_logs.details IS 'Dados adicionais da ação em formato JSON';

-- ============================================
-- TABELA: templates
-- Templates de mensagens reutilizáveis
-- ============================================
CREATE TABLE IF NOT EXISTS templates (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) NOT NULL UNIQUE,
    tipo VARCHAR(50) CHECK (tipo IN ('confirmacao', 'lembrete', 'cancelamento', 'falta', 'personalizado')),
    mensagem TEXT NOT NULL,
    variaveis TEXT[],  -- Array de variáveis: ['nome', 'data', 'hora']
    ativo BOOLEAN DEFAULT true,
    data_criacao TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE templates IS 'Templates de mensagens com variáveis dinâmicas';
COMMENT ON COLUMN templates.variaveis IS 'Lista de variáveis que podem ser usadas: {{nome}}, {{data}}, etc';

-- ============================================
-- TABELA: configuracoes
-- Configurações globais do sistema
-- ============================================
CREATE TABLE IF NOT EXISTS configuracoes (
    chave VARCHAR(100) PRIMARY KEY,
    valor JSONB NOT NULL,
    descricao TEXT,
    tipo VARCHAR(20) CHECK (tipo IN ('string', 'number', 'boolean', 'json')) DEFAULT 'string',
    ultima_atualizacao TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE configuracoes IS 'Configurações do sistema (chave-valor)';

-- ============================================
-- TABELA: monitoramento_logs
-- Logs de monitoramento do sistema
-- ============================================
CREATE TABLE IF NOT EXISTS monitoramento_logs (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMP DEFAULT NOW(),
    tipo VARCHAR(50) CHECK (tipo IN ('envio', 'recebimento', 'erro', 'sistema', 'integracao')),
    mensagem TEXT,
    dados JSONB,
    severidade VARCHAR(20) CHECK (severidade IN ('info', 'warning', 'error', 'critical')) DEFAULT 'info',
    origem VARCHAR(50)  -- whatsapp, aghuse, frontend, backend
);

COMMENT ON TABLE monitoramento_logs IS 'Logs técnicos para debugging e monitoramento';

-- ============================================
-- TABELA: conversas
-- Cache local de conversas WhatsApp
-- ============================================
CREATE TABLE IF NOT EXISTS conversas (
    id VARCHAR(255) PRIMARY KEY,  -- WhatsApp chat ID
    nome VARCHAR(255),
    telefone VARCHAR(50),
    is_group BOOLEAN DEFAULT false,
    ultima_mensagem TEXT,
    ultima_mensagem_timestamp TIMESTAMP,
    nao_lidas INTEGER DEFAULT 0,
    arquivada BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE conversas IS 'Cache de conversas do WhatsApp (sincronizado periodicamente)';

-- ============================================
-- TABELA: mensagens
-- Cache local de mensagens (LGPD: retenção 30 dias)
-- ============================================
CREATE TABLE IF NOT EXISTS mensagens (
    id VARCHAR(255) PRIMARY KEY,  -- WhatsApp message ID
    conversa_id VARCHAR(255) NOT NULL REFERENCES conversas(id) ON DELETE CASCADE,
    texto TEXT,
    enviado_por VARCHAR(50) CHECK (enviado_por IN ('usuario', 'paciente', 'sistema')),
    timestamp TIMESTAMP DEFAULT NOW(),
    status VARCHAR(20),  -- sent, delivered, read, failed
    tipo VARCHAR(20) DEFAULT 'text',  -- text, image, audio, document
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE mensagens IS 'Cache de mensagens WhatsApp (LGPD: deletar após 30 dias)';

-- ============================================
-- TABELA: consultas_monitoramento
-- Monitoramento de consultas para envio automático
-- ============================================
CREATE TABLE IF NOT EXISTS consultas_monitoramento (
    id SERIAL PRIMARY KEY,
    consulta_id_aghuse VARCHAR(50) UNIQUE NOT NULL,
    cpf_paciente VARCHAR(11) REFERENCES pacientes(cpf),
    data_hora_consulta TIMESTAMP NOT NULL,
    profissional VARCHAR(255),
    especialidade VARCHAR(100),
    status VARCHAR(50) DEFAULT 'agendada',  -- agendada, confirmada, cancelada, falta
    confirmacao_enviada BOOLEAN DEFAULT false,
    confirmacao_timestamp TIMESTAMP,
    resposta_paciente VARCHAR(10),  -- '1' (sim), '2' (não), null (sem resposta)
    lembrete_72h_enviado BOOLEAN DEFAULT false,
    notificacao_cancelamento_enviada BOOLEAN DEFAULT false,
    notificacao_falta_enviada BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE consultas_monitoramento IS 'Controle de envio automático de mensagens sobre consultas';

-- ============================================
-- TABELA: fila_envio
-- Fila de mensagens para envio
-- ============================================
CREATE TABLE IF NOT EXISTS fila_envio (
    id SERIAL PRIMARY KEY,
    destinatario VARCHAR(50) NOT NULL,  -- Número normalizado
    mensagem TEXT NOT NULL,
    tipo VARCHAR(50),  -- confirmacao, lembrete, cancelamento, falta
    prioridade INTEGER DEFAULT 5,  -- 1 (baixa) a 10 (alta)
    agendado_para TIMESTAMP DEFAULT NOW(),
    status VARCHAR(20) DEFAULT 'pendente',  -- pendente, enviando, enviado, erro
    tentativas INTEGER DEFAULT 0,
    max_tentativas INTEGER DEFAULT 3,
    erro_detalhes TEXT,
    enviado_em TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE fila_envio IS 'Fila de mensagens agendadas para envio';

-- ============================================
-- ÍNDICES
-- ============================================

-- Usuários
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_role ON usuarios(role);
CREATE INDEX IF NOT EXISTS idx_usuarios_ativo ON usuarios(ativo);

-- Pacientes
CREATE INDEX IF NOT EXISTS idx_pacientes_nome ON pacientes USING gin(nome_completo gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_pacientes_prontuario ON pacientes(prontuario);

-- Telefones
CREATE INDEX IF NOT EXISTS idx_telefones_cpf ON pacientes_telefones(cpf);
CREATE INDEX IF NOT EXISTS idx_telefones_normalized ON pacientes_telefones(normalized);
CREATE INDEX IF NOT EXISTS idx_telefones_principal ON pacientes_telefones(cpf, principal) WHERE principal = true;

-- Audit Logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource, resource_id);

-- Templates
CREATE INDEX IF NOT EXISTS idx_templates_tipo ON templates(tipo) WHERE ativo = true;

-- Monitoramento
CREATE INDEX IF NOT EXISTS idx_monitoramento_timestamp ON monitoramento_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_monitoramento_severidade ON monitoramento_logs(severidade) WHERE severidade IN ('error', 'critical');

-- Conversas
CREATE INDEX IF NOT EXISTS idx_conversas_timestamp ON conversas(ultima_mensagem_timestamp DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_conversas_telefone ON conversas(telefone);

-- Mensagens
CREATE INDEX IF NOT EXISTS idx_mensagens_conversa ON mensagens(conversa_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_mensagens_timestamp ON mensagens(timestamp DESC);

-- Consultas
CREATE INDEX IF NOT EXISTS idx_consultas_cpf ON consultas_monitoramento(cpf_paciente);
CREATE INDEX IF NOT EXISTS idx_consultas_data ON consultas_monitoramento(data_hora_consulta);
CREATE INDEX IF NOT EXISTS idx_consultas_status ON consultas_monitoramento(status);
CREATE INDEX IF NOT EXISTS idx_consultas_pendentes ON consultas_monitoramento(status, confirmacao_enviada)
    WHERE status = 'agendada' AND confirmacao_enviada = false;

-- Fila de envio
CREATE INDEX IF NOT EXISTS idx_fila_status ON fila_envio(status, agendado_para) WHERE status = 'pendente';
CREATE INDEX IF NOT EXISTS idx_fila_prioridade ON fila_envio(prioridade DESC, agendado_para);

-- ============================================
-- FUNÇÕES E TRIGGERS
-- ============================================

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
DROP TRIGGER IF EXISTS update_usuarios_updated_at ON usuarios;
CREATE TRIGGER update_usuarios_updated_at
    BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_pacientes_updated_at ON pacientes;
CREATE TRIGGER update_pacientes_updated_at
    BEFORE UPDATE ON pacientes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_templates_updated_at ON templates;
CREATE TRIGGER update_templates_updated_at
    BEFORE UPDATE ON templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversas_updated_at ON conversas;
CREATE TRIGGER update_conversas_updated_at
    BEFORE UPDATE ON conversas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_consultas_updated_at ON consultas_monitoramento;
CREATE TRIGGER update_consultas_updated_at
    BEFORE UPDATE ON consultas_monitoramento
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Função para registrar audit log automaticamente
CREATE OR REPLACE FUNCTION audit_log_patient_access()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (user_id, action, resource, resource_id, details)
    VALUES (
        current_setting('app.current_user_id', true),
        TG_OP,
        'patient',
        NEW.cpf,
        jsonb_build_object('nome', NEW.nome_completo)
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger de auditoria em pacientes
DROP TRIGGER IF EXISTS audit_pacientes_changes ON pacientes;
CREATE TRIGGER audit_pacientes_changes
    AFTER INSERT OR UPDATE ON pacientes
    FOR EACH ROW EXECUTE FUNCTION audit_log_patient_access();

-- ============================================
-- DADOS INICIAIS
-- ============================================

-- Usuário admin inicial
INSERT INTO usuarios (uid, email, display_name, role, ativo)
VALUES ('admin-inicial', 'centralderegulacaohmasp@gmail.com', 'Administrador', 'admin', true)
ON CONFLICT (uid) DO NOTHING;

-- Configurações padrão
INSERT INTO configuracoes (chave, valor, descricao, tipo) VALUES
('data_retention_days', '30', 'Dias de retenção de mensagens (LGPD)', 'number'),
('enable_audit', 'true', 'Habilitar logs de auditoria', 'boolean'),
('envio_automatico', 'true', 'Habilitar envio automático de confirmações', 'boolean'),
('intervalo_confirmacao', '60', 'Minutos após agendamento para enviar confirmação', 'number'),
('lembrete_72h', 'true', 'Enviar lembrete 72h antes da consulta', 'boolean'),
('notificar_cancelamento', 'true', 'Notificar paciente sobre cancelamentos', 'boolean'),
('notificar_falta', 'true', 'Notificar paciente após falta', 'boolean'),
('horario_inicio_envio', '08:00', 'Horário de início para envio automático', 'string'),
('horario_fim_envio', '18:00', 'Horário de fim para envio automático', 'string'),
('max_tentativas_envio', '3', 'Máximo de tentativas de envio por mensagem', 'number')
ON CONFLICT (chave) DO NOTHING;

-- Templates padrão
INSERT INTO templates (nome, tipo, mensagem, variaveis) VALUES
(
    'Confirmação de Consulta',
    'confirmacao',
    'Olá, {{nome}}! Sua consulta foi agendada para {{data}} às {{hora}} com {{profissional}}. Confirma presença? Digite 1 para SIM ou 2 para NÃO.',
    ARRAY['nome', 'data', 'hora', 'profissional']
),
(
    'Lembrete 72h',
    'lembrete',
    'Olá, {{nome}}! Lembramos que sua consulta com {{profissional}} está agendada para {{data}} às {{hora}}. Confirme presença digitando 1 para SIM ou 2 para NÃO.',
    ARRAY['nome', 'data', 'hora', 'profissional']
),
(
    'Cancelamento',
    'cancelamento',
    'Olá, {{nome}}! Informamos que sua consulta do dia {{data}} às {{hora}} com {{profissional}} foi CANCELADA por indisponibilidade do profissional. Por favor, entre em contato para reagendar.',
    ARRAY['nome', 'data', 'hora', 'profissional']
),
(
    'Notificação de Falta',
    'falta',
    'Olá, {{nome}}! Identificamos que você não compareceu à consulta do dia {{data}} às {{hora}}. Poderia nos informar o motivo?',
    ARRAY['nome', 'data', 'hora']
)
ON CONFLICT (nome) DO NOTHING;

-- ============================================
-- VIEWS ÚTEIS
-- ============================================

-- View de pacientes com telefone principal
CREATE OR REPLACE VIEW vw_pacientes_contato AS
SELECT
    p.cpf,
    p.nome_completo,
    p.primeiro_nome,
    p.prontuario,
    t.numero as telefone,
    t.normalized as telefone_whatsapp,
    t.phone_type,
    a.observacoes,
    a.preferencia_contato
FROM pacientes p
LEFT JOIN pacientes_telefones t ON p.cpf = t.cpf AND t.principal = true
LEFT JOIN agenda_contatos a ON p.cpf = a.cpf;

COMMENT ON VIEW vw_pacientes_contato IS 'Pacientes com telefone principal para contato';

-- View de consultas pendentes de confirmação
CREATE OR REPLACE VIEW vw_consultas_pendentes_confirmacao AS
SELECT
    c.id,
    c.consulta_id_aghuse,
    p.nome_completo,
    p.primeiro_nome,
    t.normalized as telefone_whatsapp,
    c.data_hora_consulta,
    c.profissional,
    c.especialidade,
    c.created_at
FROM consultas_monitoramento c
JOIN pacientes p ON c.cpf_paciente = p.cpf
LEFT JOIN pacientes_telefones t ON p.cpf = t.cpf AND t.principal = true
WHERE c.status = 'agendada'
  AND c.confirmacao_enviada = false
  AND t.normalized IS NOT NULL
ORDER BY c.data_hora_consulta;

COMMENT ON VIEW vw_consultas_pendentes_confirmacao IS 'Consultas que precisam de confirmação';

-- ============================================
-- PERMISSÕES
-- ============================================

-- Conceder permissões ao usuário da aplicação
-- NOTA: Certifique-se que o usuário 'hmasp_user' foi criado antes de executar este schema
GRANT ALL ON ALL TABLES IN SCHEMA public TO hmasp_user;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO hmasp_user;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO hmasp_user;

-- Permissões padrão para objetos futuros
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO hmasp_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO hmasp_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO hmasp_user;

-- ============================================
-- FIM DO SCHEMA
-- ============================================

-- Registrar criação do schema nos logs
INSERT INTO monitoramento_logs (tipo, mensagem, severidade, origem)
VALUES ('sistema', 'Schema do banco de dados criado com sucesso', 'info', 'postgresql');

-- Exibir resumo
SELECT
    'Tabelas criadas' as tipo,
    count(*) as quantidade
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
UNION ALL
SELECT
    'Índices criados' as tipo,
    count(*) as quantidade
FROM pg_indexes
WHERE schemaname = 'public'
UNION ALL
SELECT
    'Views criadas' as tipo,
    count(*) as quantidade
FROM information_schema.views
WHERE table_schema = 'public';
