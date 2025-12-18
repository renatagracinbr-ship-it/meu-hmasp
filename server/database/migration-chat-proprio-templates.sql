-- ============================================================
-- MIGRAÇÃO: Templates WhatsApp → Chat Próprio
-- ============================================================
-- Atualiza templates de mensagens para o sistema de Chat Próprio
-- Remove opções numeradas (1, 2, 3) pois agora usa botões interativos
-- Data: 2025-12-17
-- ============================================================

-- 1. DESATIVA templates antigos com opções numeradas
UPDATE mensagens_whatsapp
SET ativo = 0,
    observacoes = 'DESATIVADO: Migrado para Chat Próprio com botões interativos'
WHERE codigo IN (
    'notificacao_confirmacao_presenca',
    'notificacao_desmarcacao_consulta',
    'notificacao_reagendamento_confirmacao',
    'notificacao_lembrete_72h',
    'notificacao_lembrete_sem_resposta'
);

-- 2. INSERE novos templates para Chat Próprio

-- Template: Confirmação de Presença (Chat Próprio)
INSERT OR REPLACE INTO mensagens_whatsapp (
    codigo, fluxo, categoria, contexto, titulo, texto, tipo_envio,
    variaveis_disponiveis, gatilho_condicao, possui_botoes, ativo,
    observacoes
) VALUES (
    'chat_confirmacao_presenca',
    'confirmacao',
    'template',
    'confirmacao',
    '[Chat Próprio] Confirmação de Presença',
    'Olá, {nome}!

Você tem uma nova consulta agendada:

📅 *{especialidade}*
🕐 {data} às {horario}h
👨‍⚕️ {profissional}

Por favor, confirme sua presença através dos botões abaixo.',
    'chat_buttons',
    '["nome", "data", "horario", "especialidade", "profissional"]',
    'Consulta marcada - Sistema Chat Próprio',
    1,
    1,
    'Template para Chat Próprio com botões: Confirmar / Não poderei / Não agendei'
);

-- Template: Lembrete 72h (Chat Próprio)
INSERT OR REPLACE INTO mensagens_whatsapp (
    codigo, fluxo, categoria, contexto, titulo, texto, tipo_envio,
    variaveis_disponiveis, gatilho_condicao, possui_botoes, ativo,
    observacoes
) VALUES (
    'chat_lembrete_72h',
    'confirmacao',
    'template',
    'confirmacao',
    '[Chat Próprio] Lembrete 72h',
    'Olá, {nome}!

⏰ Lembrete: Sua consulta é em 3 dias!

📅 *{especialidade}*
🕐 {data} às {horario}h
👨‍⚕️ {profissional}

Confirma sua presença?',
    'chat_buttons',
    '["nome", "data", "horario", "especialidade", "profissional"]',
    'Lembrete 72h antes - Sistema Chat Próprio',
    1,
    1,
    'Template para Chat Próprio com botões: Confirmar / Desmarcar'
);

-- Template: Desmarcação (Chat Próprio)
INSERT OR REPLACE INTO mensagens_whatsapp (
    codigo, fluxo, categoria, contexto, titulo, texto, tipo_envio,
    variaveis_disponiveis, gatilho_condicao, possui_botoes, ativo,
    observacoes
) VALUES (
    'chat_desmarcacao',
    'desmarcacao',
    'template',
    'desmarcacao',
    '[Chat Próprio] Desmarcação de Consulta',
    'Olá, {nome}!

Sua consulta foi desmarcada:

📅 *{especialidade}*
🕐 {data} às {horario}h

Deseja reagendar?',
    'chat_buttons',
    '["nome", "data", "horario", "especialidade", "profissional"]',
    'Consulta desmarcada - Sistema Chat Próprio',
    1,
    1,
    'Template para Chat Próprio com botões: Sim reagendar / Fui eu que desmarcou / Não obrigado'
);

-- Template: Reagendamento (Chat Próprio)
INSERT OR REPLACE INTO mensagens_whatsapp (
    codigo, fluxo, categoria, contexto, titulo, texto, tipo_envio,
    variaveis_disponiveis, gatilho_condicao, possui_botoes, ativo,
    observacoes
) VALUES (
    'chat_reagendamento',
    'confirmacao',
    'template',
    'confirmacao',
    '[Chat Próprio] Reagendamento com Confirmação',
    'Olá, {nome}!

✅ Sua consulta foi reagendada conforme solicitado!

📅 *{especialidade}*
🕐 {data} às {horario}h
👨‍⚕️ {profissional}

Por favor, confirme sua presença.',
    'chat_buttons',
    '["nome", "data", "horario", "especialidade", "profissional"]',
    'Consulta reagendada - Sistema Chat Próprio',
    1,
    1,
    'Template para Chat Próprio com botões: Confirmar / Não poderei / Não agendei'
);

-- 3. ATUALIZA mensagens de RESPOSTA (essas ainda são usadas via Chat Próprio)

-- Mantém as mensagens de resposta ativas (confirmacao_presenca_aprovada, etc)
-- pois são enviadas APÓS o paciente clicar nos botões

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================

SELECT 'Migração concluída! Templates atualizados para Chat Próprio.' as resultado;
