-- ============================================================
-- MIGRAÇÃO: Corrige formatação de quebras de linha nas mensagens
-- ============================================================
-- Data: 2025-12-11
-- Descrição: Remove \n literais e usa quebras de linha reais
-- ============================================================

-- Mensagem: consulta_reagendada_comunicacao
UPDATE mensagens_whatsapp
SET texto = 'Olá, *{nome}*!

Sua consulta foi reagendada com sucesso:

📅 *Nova Data:* {data}
⏰ *Horário:* {horario}
🏥 *Especialidade:* {especialidade}
👨‍⚕️ *Profissional:* {profissional}

*Contamos com sua presença!*

_Em caso de dúvidas, entre em contato com a Central de Marcação de Consultas._

_HMASP - Central de Marcação de Consultas_',
versao = versao + 1,
atualizado_em = CURRENT_TIMESTAMP
WHERE codigo = 'consulta_reagendada_comunicacao';

-- Mensagem: notificacao_confirmacao_presenca
UPDATE mensagens_whatsapp
SET texto = 'Olá, *{nome}*! 👋

Você tem uma consulta agendada:

📅 *Data:* {data}
⏰ *Horário:* {horario}
🏥 *Especialidade:* {especialidade}
👨‍⚕️ *Profissional:* {profissional}

*Por favor, confirme sua presença:*

1️⃣ - Confirmo minha presença
2️⃣ - Não poderei comparecer
3️⃣ - Não agendei esta consulta

_Aguardamos sua resposta._

_HMASP - Central de Marcação de Consultas_',
versao = versao + 1,
atualizado_em = CURRENT_TIMESTAMP
WHERE codigo = 'notificacao_confirmacao_presenca';

-- Mensagem: notificacao_desmarcacao_consulta
UPDATE mensagens_whatsapp
SET texto = 'Olá, *{nome}*! 👋

⚠️ *Informamos que sua consulta foi desmarcada:*

📅 *Data que seria:* {data}
⏰ *Horário:* {horario}
🏥 *Especialidade:* {especialidade}
👨‍⚕️ *Profissional:* {profissional}

*Por favor, escolha uma opção:*

1️⃣ - Desejo reagendar
2️⃣ - Fui eu que solicitei a desmarcação
3️⃣ - Não preciso reagendar no momento

_Aguardamos sua resposta._

_HMASP - Central de Marcação de Consultas_',
versao = versao + 1,
atualizado_em = CURRENT_TIMESTAMP
WHERE codigo = 'notificacao_desmarcacao_consulta';

-- Mensagem: confirmacao_presenca_aprovada
UPDATE mensagens_whatsapp
SET texto = '✅ *Presença confirmada!* Obrigado. Aguardamos você na data e horário marcados.

_HMASP - Central de Marcação de Consultas_',
versao = versao + 1,
atualizado_em = CURRENT_TIMESTAMP
WHERE codigo = 'confirmacao_presenca_aprovada';

-- Mensagem: confirmacao_presenca_declinada
UPDATE mensagens_whatsapp
SET texto = '❌ *Entendido.* Sua consulta foi desmarcada. Em caso de dúvidas, entre em contato com a Central de Marcação de Consultas.

_HMASP - Central de Marcação de Consultas_',
versao = versao + 1,
atualizado_em = CURRENT_TIMESTAMP
WHERE codigo = 'confirmacao_presenca_declinada';

-- Mensagem: confirmacao_nao_agendada
UPDATE mensagens_whatsapp
SET texto = '⚠️ *Obrigado pelo retorno.* Verificaremos o agendamento. Se necessário, entraremos em contato.

_HMASP - Central de Marcação de Consultas_',
versao = versao + 1,
atualizado_em = CURRENT_TIMESTAMP
WHERE codigo = 'confirmacao_nao_agendada';

-- Mensagem: desmarcacao_solicita_reagendamento
UPDATE mensagens_whatsapp
SET texto = '✅ *Agradecemos o retorno!*

Sua consulta será reagendada e você será informado assim que tivermos uma nova data disponível. Contamos com a sua compreensão.

_HMASP - Central de Marcação de Consultas_',
versao = versao + 1,
atualizado_em = CURRENT_TIMESTAMP
WHERE codigo = 'desmarcacao_solicita_reagendamento';

-- Mensagem: desmarcacao_sem_reagendamento
UPDATE mensagens_whatsapp
SET texto = '✅ *Agradecemos pela informação!*

Caso precise de um novo agendamento no futuro, estamos à disposição através dos nossos canais de atendimento. Desejamos saúde e bem-estar.

_HMASP - Central de Marcação de Consultas_',
versao = versao + 1,
atualizado_em = CURRENT_TIMESTAMP
WHERE codigo = 'desmarcacao_sem_reagendamento';

-- Mensagem: desmarcacao_paciente_solicitou
UPDATE mensagens_whatsapp
SET texto = '✅ *Agradecemos o retorno!*

Compreendemos sua solicitação. Ficamos à disposição caso precise reagendar. Desejamos saúde e bem-estar.

_HMASP - Central de Marcação de Consultas_',
versao = versao + 1,
atualizado_em = CURRENT_TIMESTAMP
WHERE codigo = 'desmarcacao_paciente_solicitou';

-- Mensagem: erro_numero_invalido
UPDATE mensagens_whatsapp
SET texto = '⚠️ *Número inválido.*

Você digitou "{numero}", mas as opções disponíveis são apenas:

{opcoes}

Por favor, responda com *1*, *2* ou *3*.

_HMASP - Central de Marcação de Consultas_',
versao = versao + 1,
atualizado_em = CURRENT_TIMESTAMP
WHERE codigo = 'erro_numero_invalido';

-- Mensagem: erro_tentativa1_confirmacao
UPDATE mensagens_whatsapp
SET texto = '❓ *Desculpe, não entendi sua resposta.*

Por favor, escolha uma das opções abaixo respondendo apenas com o número:

1️⃣ - Confirmo minha presença
2️⃣ - Não poderei ir
3️⃣ - Não agendei essa consulta

_HMASP - Central de Marcação de Consultas_',
versao = versao + 1,
atualizado_em = CURRENT_TIMESTAMP
WHERE codigo = 'erro_tentativa1_confirmacao';

-- Mensagem: erro_tentativa2_confirmacao
UPDATE mensagens_whatsapp
SET texto = '⚠️ *Por favor, digite apenas o número: 1, 2 ou 3*

Exemplo: digite apenas *1* para confirmar sua presença.

_HMASP - Central de Marcação de Consultas_',
versao = versao + 1,
atualizado_em = CURRENT_TIMESTAMP
WHERE codigo = 'erro_tentativa2_confirmacao';

-- Mensagem: erro_tentativa3_confirmacao
UPDATE mensagens_whatsapp
SET texto = '❌ *Não conseguimos processar sua resposta automaticamente.*

Por favor, entre em contato com a Central de Marcação de Consultas.

Ou aguarde que um atendente entrará em contato com você em breve.

_HMASP - Central de Marcação de Consultas_',
versao = versao + 1,
atualizado_em = CURRENT_TIMESTAMP
WHERE codigo = 'erro_tentativa3_confirmacao';

-- Mensagem: erro_tentativa1_desmarcacao
UPDATE mensagens_whatsapp
SET texto = '❓ *Desculpe, não entendi sua resposta.*

Por favor, escolha uma das opções abaixo respondendo apenas com o número:

1️⃣ - Quero reagendar
2️⃣ - Eu que desmarcou
3️⃣ - Não quero reagendar

_HMASP - Central de Marcação de Consultas_',
versao = versao + 1,
atualizado_em = CURRENT_TIMESTAMP
WHERE codigo = 'erro_tentativa1_desmarcacao';

-- Mensagem: erro_tentativa2_desmarcacao
UPDATE mensagens_whatsapp
SET texto = '⚠️ *Por favor, digite apenas o número: 1, 2 ou 3*

Exemplo: digite apenas *1* se quiser reagendar.

_HMASP - Central de Marcação de Consultas_',
versao = versao + 1,
atualizado_em = CURRENT_TIMESTAMP
WHERE codigo = 'erro_tentativa2_desmarcacao';

-- Mensagem: erro_tentativa3_desmarcacao
UPDATE mensagens_whatsapp
SET texto = '❌ *Não conseguimos processar sua resposta automaticamente.*

Por favor, entre em contato com a Central de Marcação de Consultas.

Ou aguarde que um atendente entrará em contato com você em breve.

_HMASP - Central de Marcação de Consultas_',
versao = versao + 1,
atualizado_em = CURRENT_TIMESTAMP
WHERE codigo = 'erro_tentativa3_desmarcacao';

-- Mensagem: sem_contexto_boasvindas
UPDATE mensagens_whatsapp
SET texto = '✅ *Olá! Agradecemos o contato.*

Este é nosso sistema automatizado de confirmação de presença e desmarcação de consultas, que está em implementação.

No momento, utilizamos este canal exclusivamente para:
• Confirmação de presença em consultas agendadas
• Desmarcação de consultas

Para outros assuntos, por favor entre em contato com a *Central de Marcação de Consultas* pelos nossos canais de atendimento.

Agradecemos a compreensão.

_HMASP - Central de Marcação de Consultas_',
versao = versao + 1,
atualizado_em = CURRENT_TIMESTAMP
WHERE codigo = 'sem_contexto_boasvindas';

-- Mensagem: encerramento_3_tentativas
UPDATE mensagens_whatsapp
SET texto = '🙏 *Agradecemos seu contato!*

Percebemos que houve dificuldade em processar sua resposta.

Se você possui dúvidas sobre sua consulta ou precisa de assistência, por favor entre em contato com a *Central de Marcação de Consultas* através dos nossos canais oficiais de atendimento.

_Estamos à disposição._

_HMASP - Central de Marcação de Consultas_',
versao = versao + 1,
atualizado_em = CURRENT_TIMESTAMP
WHERE codigo = 'encerramento_3_tentativas';
