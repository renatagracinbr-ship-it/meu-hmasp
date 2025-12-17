-- Migração: Remove variável {local} da mensagem de reagendamento
-- Data: 2025-12-11
-- Descrição: Atualiza mensagem consulta_reagendada_comunicacao para remover referência ao local

UPDATE mensagens_whatsapp
SET
    texto = '✅ *Boa notícia, {nome}!*\n\nSua consulta foi reagendada com sucesso:\n\n📅 *Nova Data:* {data}\n⏰ *Horário:* {horario}\n🏥 *Especialidade:* {especialidade}\n👨‍⚕️ *Profissional:* {profissional}\n\n*Contamos com sua presença!*\n\n_Em caso de dúvidas, entre em contato com a Central de Marcação de Consultas._\n\n_HMASP - Central de Marcação de Consultas_',
    variaveis_disponiveis = '["nome", "data", "horario", "especialidade", "profissional"]',
    atualizado_em = CURRENT_TIMESTAMP,
    versao = versao + 1
WHERE codigo = 'consulta_reagendada_comunicacao';

-- Verificação
SELECT codigo, versao, texto, variaveis_disponiveis
FROM mensagens_whatsapp
WHERE codigo = 'consulta_reagendada_comunicacao';
