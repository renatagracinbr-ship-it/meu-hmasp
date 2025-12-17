-- ============================================================
-- SCHEMA: Mensagens WhatsApp Centralizadas
-- ============================================================
-- Autor: Sistema HMASP Chat
-- Data: 2025-12-11
-- Descrição: Centraliza todas as mensagens WhatsApp do sistema
--            para facilitar manutenção, tradução e auditoria
-- ============================================================

CREATE TABLE IF NOT EXISTS mensagens_whatsapp (
    -- Identificação
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo VARCHAR(100) UNIQUE NOT NULL,  -- Ex: 'confirmacao_presenca_aprovada'

    -- Categorização
    fluxo VARCHAR(50) NOT NULL,           -- 'confirmacao', 'desmarcacao', 'erro', 'reagendamento'
    categoria VARCHAR(50) NOT NULL,       -- 'template', 'resposta', 'validacao', 'fallback'
    contexto VARCHAR(50),                 -- 'desmarcacao', 'confirmacao', NULL (geral)

    -- Conteúdo
    titulo VARCHAR(200),                  -- Título descritivo para o admin
    texto TEXT NOT NULL,                  -- Texto da mensagem (com {variaveis})
    tipo_envio VARCHAR(50) NOT NULL,      -- 'template', 'msg_reply', 'send_message'

    -- Variáveis disponíveis
    variaveis_disponiveis TEXT,           -- JSON: ["nome_paciente", "data", "hora"]
    exemplo_uso TEXT,                     -- Exemplo de como usar (para documentação)

    -- Configurações
    ativo BOOLEAN DEFAULT 1,              -- Mensagem ativa ou desativada
    ordem INTEGER DEFAULT 0,              -- Ordem de exibição no admin

    -- Metadados para templates WhatsApp Business API
    template_id VARCHAR(100),             -- ID do template no WhatsApp (se aplicável)
    template_categoria VARCHAR(50),       -- 'UTILITY', 'MARKETING', 'AUTHENTICATION'
    possui_botoes BOOLEAN DEFAULT 0,      -- Se tem botões interativos
    config_botoes TEXT,                   -- JSON com configuração dos botões

    -- Gatilhos/Condições
    gatilho_condicao TEXT,                -- Descrição da condição que dispara esta mensagem
    tentativa_numero INTEGER,             -- Para mensagens de erro progressivas (1, 2, 3+)

    -- Auditoria e versionamento
    versao INTEGER DEFAULT 1,             -- Versão da mensagem (para histórico)
    criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    criado_por VARCHAR(100),

    -- Estatísticas de uso
    total_envios INTEGER DEFAULT 0,       -- Total de vezes enviada
    ultimo_envio_em DATETIME,             -- Última vez que foi enviada

    -- Observações
    observacoes TEXT                      -- Notas sobre uso, contexto, etc.
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_msg_codigo ON mensagens_whatsapp(codigo);
CREATE INDEX IF NOT EXISTS idx_msg_fluxo ON mensagens_whatsapp(fluxo);
CREATE INDEX IF NOT EXISTS idx_msg_categoria ON mensagens_whatsapp(categoria);
CREATE INDEX IF NOT EXISTS idx_msg_contexto ON mensagens_whatsapp(contexto);
CREATE INDEX IF NOT EXISTS idx_msg_ativo ON mensagens_whatsapp(ativo);

-- ============================================================
-- TABELA: Histórico de Envios de Mensagens
-- ============================================================
-- Rastreia cada envio de mensagem para auditoria

CREATE TABLE IF NOT EXISTS mensagens_envios_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mensagem_id INTEGER NOT NULL,
    codigo_mensagem VARCHAR(100) NOT NULL,

    -- Destinatário
    telefone VARCHAR(20),
    confirmacao_id INTEGER,

    -- Conteúdo renderizado
    texto_enviado TEXT,                   -- Texto final com variáveis substituídas
    variaveis_usadas TEXT,                -- JSON com valores das variáveis

    -- Contexto do envio
    contexto VARCHAR(50),
    fluxo VARCHAR(50),

    -- Resultado
    status VARCHAR(50),                   -- 'enviado', 'erro', 'fila'
    erro_detalhes TEXT,

    -- Auditoria
    enviado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
    enviado_por VARCHAR(100),             -- 'sistema', 'operador:nome', etc.

    FOREIGN KEY (mensagem_id) REFERENCES mensagens_whatsapp(id)
);

CREATE INDEX IF NOT EXISTS idx_envios_mensagem ON mensagens_envios_log(mensagem_id);
CREATE INDEX IF NOT EXISTS idx_envios_telefone ON mensagens_envios_log(telefone);
CREATE INDEX IF NOT EXISTS idx_envios_data ON mensagens_envios_log(enviado_em);

-- ============================================================
-- SEED: Inserção de todas as mensagens existentes
-- ============================================================

-- FLUXO 1: CONFIRMAÇÃO DE PRESENÇA - RESPOSTAS
INSERT OR REPLACE INTO mensagens_whatsapp (
    codigo, fluxo, categoria, contexto, titulo, texto, tipo_envio,
    variaveis_disponiveis, gatilho_condicao, possui_botoes, ativo
) VALUES
(
    'confirmacao_presenca_aprovada',
    'confirmacao',
    'resposta',
    'confirmacao',
    'Presença Confirmada com Sucesso',
    '✅ *Presença confirmada!* Obrigado. Aguardamos você na data e horário marcados.\n\n_HMASP - Central de Marcação de Consultas_',
    'msg_reply',
    '[]',
    'Paciente respondeu "1" (confirmo) em mensagem de confirmação',
    0,
    1
),
(
    'confirmacao_presenca_declinada',
    'confirmacao',
    'resposta',
    'confirmacao',
    'Consulta Desmarcada pelo Paciente',
    '❌ *Entendido.* Sua consulta foi desmarcada. Em caso de dúvidas, entre em contato com a Central de Marcação de Consultas.\n\n_HMASP - Central de Marcação de Consultas_',
    'msg_reply',
    '[]',
    'Paciente respondeu "2" (não poderei ir) em mensagem de confirmação',
    0,
    1
),
(
    'confirmacao_nao_agendada',
    'confirmacao',
    'resposta',
    'confirmacao',
    'Paciente Informa Não Ter Agendado',
    '⚠️ *Obrigado pelo retorno.* Verificaremos o agendamento. Se necessário, entraremos em contato.\n\n_HMASP - Central de Marcação de Consultas_',
    'msg_reply',
    '[]',
    'Paciente respondeu "3" (não agendei) em mensagem de confirmação',
    0,
    1
);

-- FLUXO 2: DESMARCAÇÃO - RESPOSTAS
INSERT OR REPLACE INTO mensagens_whatsapp (
    codigo, fluxo, categoria, contexto, titulo, texto, tipo_envio,
    variaveis_disponiveis, gatilho_condicao, possui_botoes, ativo
) VALUES
(
    'desmarcacao_solicita_reagendamento',
    'desmarcacao',
    'resposta',
    'desmarcacao',
    'Agradecimento - Solicitação de Reagendamento',
    '✅ *Agradecemos o retorno!*\n\nSua consulta será reagendada e você será informado assim que tivermos uma nova data disponível. Contamos com a sua compreensão.\n\n_HMASP - Central de Marcação de Consultas_',
    'msg_reply',
    '[]',
    'Paciente respondeu "1" (reagendar) em mensagem de desmarcação',
    0,
    1
),
(
    'desmarcacao_sem_reagendamento',
    'desmarcacao',
    'resposta',
    'desmarcacao',
    'Agradecimento - Sem Reagendamento',
    '✅ *Agradecemos pela informação!*\n\nCaso precise de um novo agendamento no futuro, estamos à disposição através dos nossos canais de atendimento. Desejamos saúde e bem-estar.\n\n_HMASP - Central de Marcação de Consultas_',
    'msg_reply',
    '[]',
    'Paciente respondeu "3" (não reagendar) em mensagem de desmarcação',
    0,
    1
),
(
    'desmarcacao_paciente_solicitou',
    'desmarcacao',
    'resposta',
    'desmarcacao',
    'Agradecimento - Paciente Solicitou Desmarcação',
    '✅ *Agradecemos o retorno!*\n\nCompreendemos sua solicitação. Ficamos à disposição caso precise reagendar. Desejamos saúde e bem-estar.\n\n_HMASP - Central de Marcação de Consultas_',
    'msg_reply',
    '[]',
    'Paciente respondeu "2" (eu solicitei) em mensagem de desmarcação',
    0,
    1
),
(
    'consulta_reagendada_comunicacao',
    'desmarcacao',
    'reagendamento',
    'desmarcacao',
    'Comunicação de Reagendamento - Nova Consulta',
    '✅ *Boa notícia, {nome}!*\n\nSua consulta foi reagendada com sucesso:\n\n📅 *Nova Data:* {data}\n⏰ *Horário:* {horario}\n🏥 *Especialidade:* {especialidade}\n👨‍⚕️ *Profissional:* {profissional}\n\n*Contamos com sua presença!*\n\n_Em caso de dúvidas, entre em contato com a Central de Marcação de Consultas._\n\n_HMASP - Central de Marcação de Consultas_',
    'send_message',
    '["nome", "data", "horario", "especialidade", "profissional"]',
    'Consulta foi reagendada pelo sistema (72h após solicitação)',
    0,
    1
);

-- FLUXO 3: VALIDAÇÃO - MENSAGENS DE ERRO
INSERT OR REPLACE INTO mensagens_whatsapp (
    codigo, fluxo, categoria, contexto, titulo, texto, tipo_envio,
    variaveis_disponiveis, gatilho_condicao, tentativa_numero, possui_botoes, ativo
) VALUES
(
    'erro_numero_invalido',
    'validacao',
    'erro',
    NULL,
    'Erro - Número Inválido',
    '⚠️ *Número inválido.*\n\nVocê digitou "{numero}", mas as opções disponíveis são apenas:\n\n{opcoes}\n\nPor favor, responda com *1*, *2* ou *3*.\n\n_HMASP - Central de Marcação de Consultas_',
    'msg_reply',
    '["numero", "opcoes"]',
    'Paciente digitou número > 3 com contexto ativo',
    0,
    0,
    1
),
(
    'erro_tentativa1_confirmacao',
    'validacao',
    'erro',
    'confirmacao',
    'Erro - Primeira Tentativa (Confirmação)',
    '❓ *Desculpe, não entendi sua resposta.*\n\nPor favor, escolha uma das opções abaixo respondendo apenas com o número:\n\n1️⃣ - Confirmo minha presença\n2️⃣ - Não poderei ir\n3️⃣ - Não agendei essa consulta\n\n_HMASP - Central de Marcação de Consultas_',
    'msg_reply',
    '[]',
    'Primeira resposta inválida em contexto de confirmação',
    1,
    0,
    1
),
(
    'erro_tentativa2_confirmacao',
    'validacao',
    'erro',
    'confirmacao',
    'Erro - Segunda Tentativa (Confirmação)',
    '⚠️ *Por favor, digite apenas o número: 1, 2 ou 3*\n\nExemplo: digite apenas *1* para confirmar sua presença.\n\n_HMASP - Central de Marcação de Consultas_',
    'msg_reply',
    '[]',
    'Segunda resposta inválida em contexto de confirmação',
    2,
    0,
    1
),
(
    'erro_tentativa3_confirmacao',
    'validacao',
    'erro',
    'confirmacao',
    'Erro - Terceira+ Tentativa (Confirmação)',
    '❌ *Não conseguimos processar sua resposta automaticamente.*\n\nPor favor, entre em contato com a Central de Marcação de Consultas.\n\nOu aguarde que um atendente entrará em contato com você em breve.\n\n_HMASP - Central de Marcação de Consultas_',
    'msg_reply',
    '[]',
    'Terceira+ resposta inválida em contexto de confirmação',
    3,
    0,
    1
),
(
    'erro_tentativa1_desmarcacao',
    'validacao',
    'erro',
    'desmarcacao',
    'Erro - Primeira Tentativa (Desmarcação)',
    '❓ *Desculpe, não entendi sua resposta.*\n\nPor favor, escolha uma das opções abaixo respondendo apenas com o número:\n\n1️⃣ - Quero reagendar\n2️⃣ - Eu que desmarcou\n3️⃣ - Não quero reagendar\n\n_HMASP - Central de Marcação de Consultas_',
    'msg_reply',
    '[]',
    'Primeira resposta inválida em contexto de desmarcação',
    1,
    0,
    1
),
(
    'erro_tentativa2_desmarcacao',
    'validacao',
    'erro',
    'desmarcacao',
    'Erro - Segunda Tentativa (Desmarcação)',
    '⚠️ *Por favor, digite apenas o número: 1, 2 ou 3*\n\nExemplo: digite apenas *1* se quiser reagendar.\n\n_HMASP - Central de Marcação de Consultas_',
    'msg_reply',
    '[]',
    'Segunda resposta inválida em contexto de desmarcação',
    2,
    0,
    1
),
(
    'erro_tentativa3_desmarcacao',
    'validacao',
    'erro',
    'desmarcacao',
    'Erro - Terceira+ Tentativa (Desmarcação)',
    '❌ *Não conseguimos processar sua resposta automaticamente.*\n\nPor favor, entre em contato com a Central de Marcação de Consultas.\n\nOu aguarde que um atendente entrará em contato com você em breve.\n\n_HMASP - Central de Marcação de Consultas_',
    'msg_reply',
    '[]',
    'Terceira+ resposta inválida em contexto de desmarcação',
    3,
    0,
    1
);

-- FLUXO 4: FALLBACK - MENSAGENS SEM CONTEXTO
INSERT OR REPLACE INTO mensagens_whatsapp (
    codigo, fluxo, categoria, contexto, titulo, texto, tipo_envio,
    variaveis_disponiveis, gatilho_condicao, possui_botoes, ativo
) VALUES
(
    'sem_contexto_boasvindas',
    'fallback',
    'informativo',
    NULL,
    'Boas-vindas - Sem Contexto Ativo',
    '✅ *Olá! Agradecemos o contato.*\n\nEste é nosso sistema automatizado de confirmação de presença e desmarcação de consultas, que está em implementação.\n\nNo momento, utilizamos este canal exclusivamente para:\n• Confirmação de presença em consultas agendadas\n• Desmarcação de consultas\n\nPara outros assuntos, por favor entre em contato com a *Central de Marcação de Consultas* pelos nossos canais de atendimento.\n\nAgradecemos a compreensão.\n\n_HMASP - Central de Marcação de Consultas_',
    'msg_reply',
    '[]',
    'Paciente enviou mensagem sem contexto prévio',
    0,
    1
),
(
    'oferta_atendente_humano',
    'fallback',
    'assistencia',
    NULL,
    'Oferta de Atendente Humano',
    'Percebi que está com dificuldades. Gostaria de falar com um atendente humano? Responda *"sim"* ou *"humano"*.',
    'send_message',
    '[]',
    'Após 3 tentativas falhas de resposta',
    0,
    0  -- DESATIVADA: Não oferecer atendente humano no momento
),
(
    'encerramento_3_tentativas',
    'fallback',
    'informativo',
    NULL,
    'Encerramento Cordial - 3 Tentativas Falhas',
    '🙏 *Agradecemos seu contato!*\n\nPercebemos que houve dificuldade em processar sua resposta.\n\nSe você possui dúvidas sobre sua consulta ou precisa de assistência, por favor entre em contato com a *Central de Marcação de Consultas* através dos nossos canais oficiais de atendimento.\n\n_Estamos à disposição._\n\n_HMASP - Central de Marcação de Consultas_',
    'msg_reply',
    '[]',
    'Após 3 tentativas falhas de resposta - encerra conversa cordialmente',
    0,
    1
);

-- FLUXO 5: NOTIFICAÇÕES INICIAIS - TEMPLATES
INSERT OR REPLACE INTO mensagens_whatsapp (
    codigo, fluxo, categoria, contexto, titulo, texto, tipo_envio,
    variaveis_disponiveis, gatilho_condicao, possui_botoes, ativo
) VALUES
(
    'notificacao_confirmacao_presenca',
    'confirmacao',
    'template',
    'confirmacao',
    'Notificação Inicial - Confirmação de Presença',
    'Oi, {nome}.\nAqui é a Central de Marcação de Consultas do HMASP.\n\n📋 Detalhes da Consulta:\n• Especialidade: {especialidade}\n• Data: {data}\n• Horário: {horario}h\n• Profissional: Dr(a) {profissional}\n\nPor gentileza, confirme sua presença respondendo com o número:\n\n1 - ✅ Confirmo presença\n2 - ❌ Não poderei comparecer\n3 - ⚠️ Não agendei essa consulta',
    'send_message',
    '["nome", "data", "horario", "especialidade", "profissional"]',
    'Consulta foi marcada no sistema',
    1,
    1
),
(
    'notificacao_desmarcacao_consulta',
    'desmarcacao',
    'template',
    'desmarcacao',
    'Notificação Inicial - Desmarcação de Consulta',
    'Oi, {nome}.\nAqui é a Central de Marcação de Consultas do HMASP.\n\n⚠️ Informativo de Desmarcação:\n\nInformamos que sua consulta foi *desmarcada* em nosso sistema:\n\n• Especialidade: {especialidade}\n• Data: {data}\n• Horário: {horario}h\n• Profissional: Dr(a) {profissional}\n\n*Motivo:* Indisponibilidade do profissional ou solicitação do paciente.\n\nPor favor, nos informe a situação para darmos o encaminhamento correto:\n\n1 - 📅 Solicito reagendamento, pois preciso da consulta\n2 - ✋ Fui eu (paciente) quem solicitei a desmarcação\n3 - ❌ Não é necessário reagendar',
    'send_message',
    '["nome", "data", "horario", "especialidade", "profissional"]',
    'Consulta foi desmarcada no sistema',
    1,
    1
),
(
    'notificacao_reagendamento_confirmacao',
    'confirmacao',
    'template',
    'confirmacao',
    'Notificação - Reagendamento com Confirmação de Presença',
    'Olá, *{nome}*.\nAqui é a Central de Marcação de Consultas do HMASP.\n\n✅ *Sua consulta foi reagendada conforme solicitado!*\n\n📋 *Detalhes da Nova Consulta:*\n• Especialidade: *{especialidade}*\n• Data: *{data}*\n• Horário: *{horario}h*\n• Profissional: Dr(a) *{profissional}*\n\nPor gentileza, confirme sua presença respondendo com o número:\n\n*1* - ✅ Confirmo presença\n*2* - ❌ Não poderei comparecer\n*3* - ⚠️ Não agendei essa consulta\n\n_HMASP - Central de Marcação de Consultas_',
    'send_message',
    '["nome", "data", "horario", "especialidade", "profissional"]',
    'Consulta foi reagendada pelo operador após solicitação do paciente',
    1,
    1
),
(
    'notificacao_lembrete_72h',
    'confirmacao',
    'template',
    'confirmacao',
    'Lembrete - Consulta Próxima (72h antes)',
    'Olá, *{nome}*.\nAqui é a Central de Marcação de Consultas do HMASP.\n\n⏰ *LEMBRETE: Sua consulta está próxima!*\n\n📋 *Detalhes da Consulta:*\n• Especialidade: *{especialidade}*\n• Data: *{data}*\n• Horário: *{horario}h*\n• Profissional: Dr(a) *{profissional}*\n\nPor gentileza, confirme sua presença respondendo com o número:\n\n*1* - ✅ Confirmo presença\n*2* - ❌ Não poderei comparecer\n*3* - ⚠️ Não agendei essa consulta\n\n_HMASP - Central de Marcação de Consultas_',
    'send_message',
    '["nome", "data", "horario", "especialidade", "profissional"]',
    'Lembrete enviado 72h antes da consulta agendada',
    1,
    1
),
(
    'notificacao_lembrete_sem_resposta',
    'confirmacao',
    'template',
    'confirmacao',
    'Lembrete - Sem Resposta (5 minutos)',
    'Olá, *{nome}*. Ainda não recebemos sua confirmação. Lembramos que sua consulta de *{especialidade}* está marcada para *{data}* às *{horario}h*. Por favor, confirme sua presença respondendo: *1* (Confirmo) / *2* (Não poderei) / *3* (Não agendei).',
    'send_message',
    '["nome", "data", "horario", "especialidade"]',
    'Lembrete enviado após 5 minutos sem resposta',
    1,
    1
);

-- ============================================================
-- VIEWS ÚTEIS PARA CONSULTAS
-- ============================================================

-- View: Mensagens por Fluxo
CREATE VIEW IF NOT EXISTS v_mensagens_por_fluxo AS
SELECT
    fluxo,
    COUNT(*) as total_mensagens,
    SUM(CASE WHEN ativo = 1 THEN 1 ELSE 0 END) as ativas,
    SUM(total_envios) as total_envios
FROM mensagens_whatsapp
GROUP BY fluxo
ORDER BY total_envios DESC;

-- View: Mensagens mais enviadas
CREATE VIEW IF NOT EXISTS v_mensagens_mais_enviadas AS
SELECT
    codigo,
    titulo,
    fluxo,
    categoria,
    total_envios,
    ultimo_envio_em
FROM mensagens_whatsapp
WHERE ativo = 1
ORDER BY total_envios DESC
LIMIT 20;

-- View: Estatísticas de envio por dia
CREATE VIEW IF NOT EXISTS v_estatisticas_envio_dia AS
SELECT
    DATE(enviado_em) as data,
    fluxo,
    COUNT(*) as total_envios,
    COUNT(DISTINCT telefone) as telefones_unicos
FROM mensagens_envios_log
GROUP BY DATE(enviado_em), fluxo
ORDER BY data DESC;

-- ============================================================
-- TRIGGERS: Atualização Automática
-- ============================================================

-- Trigger: Atualiza timestamp ao modificar mensagem
CREATE TRIGGER IF NOT EXISTS trg_mensagens_atualizado_em
AFTER UPDATE ON mensagens_whatsapp
FOR EACH ROW
BEGIN
    UPDATE mensagens_whatsapp
    SET atualizado_em = CURRENT_TIMESTAMP
    WHERE id = NEW.id;
END;

-- Trigger: Incrementa contador ao registrar envio
CREATE TRIGGER IF NOT EXISTS trg_incrementa_total_envios
AFTER INSERT ON mensagens_envios_log
FOR EACH ROW
BEGIN
    UPDATE mensagens_whatsapp
    SET
        total_envios = total_envios + 1,
        ultimo_envio_em = CURRENT_TIMESTAMP
    WHERE id = NEW.mensagem_id;
END;

-- ============================================================
-- OBSERVAÇÕES E DOCUMENTAÇÃO
-- ============================================================

/*
COMO USAR ESTE SISTEMA:

1. INSERIR NOVA MENSAGEM:
   INSERT INTO mensagens_whatsapp (codigo, fluxo, categoria, texto, tipo_envio)
   VALUES ('minha_mensagem', 'confirmacao', 'resposta', 'Texto aqui', 'msg_reply');

2. BUSCAR MENSAGEM PARA ENVIAR:
   SELECT texto FROM mensagens_whatsapp
   WHERE codigo = 'confirmacao_presenca_aprovada' AND ativo = 1;

3. REGISTRAR ENVIO:
   INSERT INTO mensagens_envios_log (mensagem_id, codigo_mensagem, telefone, texto_enviado)
   VALUES (1, 'confirmacao_presenca_aprovada', '5511999999999', 'Texto enviado');

4. SUBSTITUIR VARIÁVEIS NO CÓDIGO:
   const msg = mensagem.texto
       .replace('{nome_paciente}', paciente.nome)
       .replace('{data}', consulta.data);

5. DESATIVAR MENSAGEM (sem deletar):
   UPDATE mensagens_whatsapp SET ativo = 0 WHERE codigo = 'mensagem_antiga';

6. CRIAR NOVA VERSÃO DE MENSAGEM:
   -- Desativa versão antiga
   UPDATE mensagens_whatsapp SET ativo = 0 WHERE codigo = 'msg_v1';
   -- Insere nova versão
   INSERT INTO mensagens_whatsapp (...) VALUES (...);

BENEFÍCIOS:
✅ Mensagens centralizadas em um único local
✅ Facilita tradução futura (copiar tabela para outro idioma)
✅ Auditoria completa de envios
✅ Estatísticas de uso
✅ Versionamento de mensagens
✅ Desativação sem perda de dados
✅ Fácil manutenção e atualização
*/
