/**
 * Serviço de Gerenciamento de Badges e Transições de Status
 *
 * Implementa as regras exatas do prompt:
 *
 * ABA CONFIRMAÇÃO:
 * - Resposta 1 → status "confirmed" → card "Confirmados" → Mensagem automática confirmação
 * - Resposta 2 → status "declined" → card "Não poderá comparecer" + Badge VERMELHO "Desmarcar"
 *               → Operador desmarca no AGHUse → Badge muda para VERDE "Desmarcada"
 *               → NÃO envia mensagem de desmarcação (paciente já comunicou)
 * - Resposta 3 → status "not_scheduled" → card "Não agendou" → Mensagem automática verificação
 *
 * ABA DESMARCAÇÃO:
 * - Resposta 1 → status "reagendamento" → card "Solicitou Reagendamento" + Badge VERMELHO "Reagendar"
 *               → Mensagem automática agradecimento
 *               → Quando operador reagenda (24h) → Envia MARCACAO_CONFIRMACAO + Badge VERDE "Reagendada"
 * - Resposta 2 → status "paciente_solicitou" → card informativo → Mensagem automática compreensão
 * - Resposta 3 → status "sem_reagendamento" → card informativo → Mensagem automática agradecimento
 */

import * as WhatsAppTemplates from './whatsappTemplates.service.js';
import * as WhatsAppQueue from './whatsappQueue.service.js';

/**
 * Definição de badges e cores
 */
export const BADGES = {
    // Confirmação
    DESMARCAR: { label: 'Desmarcar', color: 'red', action: 'desmarcar_aghuse' },
    DESMARCADA: { label: 'Desmarcada', color: 'green', action: null },

    // Desmarcação
    REAGENDAR: { label: 'Reagendar', color: 'red', action: 'reagendar_aghuse' },
    REAGENDADA: { label: 'Reagendada', color: 'green', action: null }
};

/**
 * Mensagens automáticas por tipo de resposta
 */
const AUTO_RESPONSES = {
    confirmed: {
        texto: (nome) => `✅ *Presença confirmada!* Obrigado. Aguardamos você na data e horário marcados.\n\n_HMASP - Central de Marcação de Consultas_`,
        needsWhatsApp: true
    },
    declined: {
        texto: (nome) => `❌ *Entendido.* Sua consulta foi desmarcada. Em caso de dúvidas, entre em contato com a Central de Marcação de Consultas.\n\n_HMASP - Central de Marcação de Consultas_`,
        needsWhatsApp: true
    },
    not_scheduled: {
        texto: (nome) => `⚠️ *Obrigado pelo retorno.* Verificaremos o agendamento. Se necessário, entraremos em contato.\n\n_HMASP - Central de Marcação de Consultas_`,
        needsWhatsApp: true
    },
    reagendamento: {
        texto: (nome) => `✅ *Agradecemos o retorno!*\n\nSua consulta será reagendada e você será informado assim que tivermos uma nova data disponível. Contamos com a sua compreensão.\n\n_HMASP - Central de Marcação de Consultas_`,
        needsWhatsApp: true
    },
    paciente_solicitou: {
        texto: (nome) => `✅ *Agradecemos o retorno!*\n\nCompreendemos sua solicitação. Ficamos à disposição caso precise reagendar. Desejamos saúde e bem-estar.\n\n_HMASP - Central de Marcação de Consultas_`,
        needsWhatsApp: true
    },
    sem_reagendamento: {
        texto: (nome) => `✅ *Agradecemos pela informação!*\n\nCaso precise de um novo agendamento no futuro, estamos à disposição através dos nossos canais de atendimento. Desejamos saúde e bem-estar.\n\n_HMASP - Central de Marcação de Consultas_`,
        needsWhatsApp: true
    }
};

/**
 * Processa resposta de confirmação (Aba Confirmação)
 *
 * @param {Object} confirmation - Objeto de confirmação
 * @param {string} intent - Intenção detectada ('confirmed', 'declined', 'not_scheduled')
 * @param {string} telefone - Telefone que respondeu
 * @returns {Promise<Object>} - Resultado do processamento
 */
export async function processConfirmacaoResponse(confirmation, intent, telefone) {
    const result = {
        success: false,
        intent,
        newStatus: null,
        badge: null,
        card: null,
        autoResponse: null,
        actions: []
    };

    try {
        switch (intent) {
            case 'confirmed':
                // Status: confirmed → Card: Confirmados
                result.newStatus = 'confirmed';
                result.card = 'confirmados';
                result.autoResponse = AUTO_RESPONSES.confirmed.texto(
                    confirmation.nomeExibicao || confirmation.nomePaciente
                );

                // ❌ NÃO envia resposta aqui - backend já envia automaticamente
                // Motivo: Sistema multi-operador - backend centraliza envio de respostas
                // await sendAutoResponse(telefone, result.autoResponse);

                result.success = true;
                break;

            case 'declined':
                // Status: declined → Card: Não poderá comparecer + Badge VERMELHO
                result.newStatus = 'declined';
                result.card = 'nao_podera_comparecer';
                result.badge = BADGES.DESMARCAR;
                result.autoResponse = AUTO_RESPONSES.declined.texto(
                    confirmation.nomeExibicao || confirmation.nomePaciente
                );

                // ❌ NÃO envia resposta aqui - backend já envia automaticamente
                // Motivo: Sistema multi-operador - backend centraliza envio de respostas
                // await sendAutoResponse(telefone, result.autoResponse);

                // Registra ação pendente para operador
                result.actions.push({
                    type: 'operator_action',
                    action: 'desmarcar_aghuse',
                    consultaId: confirmation.consultaNumero,
                    description: 'Operador deve desmarcar esta consulta no AGHUse',
                    sendDesmarcacaoMessage: false  // IMPORTANTE: NÃO enviar mensagem de desmarcação (paciente já sabe)
                });

                result.success = true;
                break;

            case 'not_scheduled':
                // Status: not_scheduled → Card: Não agendou
                result.newStatus = 'not_scheduled';
                result.card = 'nao_agendou';
                result.autoResponse = AUTO_RESPONSES.not_scheduled.texto(
                    confirmation.nomeExibicao || confirmation.nomePaciente
                );

                // ❌ NÃO envia resposta aqui - backend já envia automaticamente
                // Motivo: Sistema multi-operador - backend centraliza envio de respostas
                // await sendAutoResponse(telefone, result.autoResponse);

                result.success = true;
                break;

            default:
                throw new Error(`Intent inválido para confirmação: ${intent}`);
        }

        console.log(`[BadgeManager] Resposta de confirmação processada: ${intent} → ${result.newStatus}`);

    } catch (error) {
        console.error('[BadgeManager] Erro ao processar resposta de confirmação:', error);
        result.error = error.message;
    }

    return result;
}

/**
 * Processa resposta de desmarcação (Aba Desmarcação)
 *
 * @param {Object} desmarcacao - Objeto de desmarcação
 * @param {string} intent - Intenção detectada ('reagendamento', 'paciente_solicitou', 'sem_reagendamento')
 * @param {string} telefone - Telefone que respondeu
 * @returns {Promise<Object>} - Resultado do processamento
 */
export async function processDesmarcacaoResponse(desmarcacao, intent, telefone) {
    const result = {
        success: false,
        intent,
        newStatus: null,
        badge: null,
        card: null,
        autoResponse: null,
        actions: []
    };

    try {
        switch (intent) {
            case 'reagendamento':
                // Status: reagendamento → Card: Solicitou Reagendamento + Badge VERMELHO
                result.newStatus = 'reagendamento';
                result.card = 'solicitou_reagendamento';
                result.badge = BADGES.REAGENDAR;
                result.autoResponse = AUTO_RESPONSES.reagendamento.texto(
                    desmarcacao.nomeExibicao || desmarcacao.nomePaciente
                );

                // Envia resposta automática
                await sendAutoResponse(telefone, result.autoResponse);

                // Registra pedido de reagendamento (será vinculado nas próximas 72h)
                result.actions.push({
                    type: 'reagendamento_request',
                    action: 'register_reagendamento',
                    consultaOriginalId: desmarcacao.consultaNumero,
                    especialidade: desmarcacao.especialidade,
                    description: 'Paciente solicitou reagendamento - vincular nova consulta nas próximas 72h'
                });

                result.success = true;
                break;

            case 'paciente_solicitou':
                // Status: paciente_solicitou → Card informativo
                result.newStatus = 'paciente_solicitou';
                result.card = 'paciente_solicitou';
                result.autoResponse = AUTO_RESPONSES.paciente_solicitou.texto(
                    desmarcacao.nomeExibicao || desmarcacao.nomePaciente
                );

                // ❌ NÃO envia resposta aqui - backend já envia automaticamente
                // Motivo: Sistema multi-operador - backend centraliza envio de respostas
                // await sendAutoResponse(telefone, result.autoResponse);

                result.success = true;
                break;

            case 'sem_reagendamento':
                // Status: sem_reagendamento → Card informativo
                result.newStatus = 'sem_reagendamento';
                result.card = 'sem_reagendamento';
                result.autoResponse = AUTO_RESPONSES.sem_reagendamento.texto(
                    desmarcacao.nomeExibicao || desmarcacao.nomePaciente
                );

                // ❌ NÃO envia resposta aqui - backend já envia automaticamente
                // Motivo: Sistema multi-operador - backend centraliza envio de respostas
                // await sendAutoResponse(telefone, result.autoResponse);

                result.success = true;
                break;

            default:
                throw new Error(`Intent inválido para desmarcação: ${intent}`);
        }

        console.log(`[BadgeManager] Resposta de desmarcação processada: ${intent} → ${result.newStatus}`);

    } catch (error) {
        console.error('[BadgeManager] Erro ao processar resposta de desmarcação:', error);
        result.error = error.message;
    }

    return result;
}

/**
 * Envia resposta automática via WhatsApp (com typing delay)
 *
 * @param {string} telefone - Telefone normalizado
 * @param {string} texto - Texto da mensagem
 * @returns {Promise<void>}
 */
async function sendAutoResponse(telefone, texto) {
    try {
        // Formata chatId
        const chatId = WhatsAppTemplates.formatWhatsAppChatId(telefone);

        // Adiciona à fila (já tem typing delay e proteção anti-ban)
        await WhatsAppQueue.addToQueue({
            chatId,
            texto,
            botoes: null, // Sem botões nas respostas automáticas
            metadata: {
                type: 'auto_response',
                telefone
            }
        });

        console.log(`[BadgeManager] Resposta automática adicionada à fila: ${telefone}`);

    } catch (error) {
        console.error('[BadgeManager] Erro ao enviar resposta automática:', error);
        // Não lança erro, apenas loga (não queremos bloquear o fluxo)
    }
}

/**
 * Processa ação do operador (desmarcar consulta)
 * Badge VERMELHO → VERDE
 *
 * IMPORTANTE: NÃO envia mensagem de desmarcação ao paciente
 * Motivo: Paciente já disse que não vem (resposta 2), então já sabe que será desmarcado
 * Evita loop: paciente pede desmarcar → operador desmarca → sistema avisa desmarcação → paciente pede reagendar → loop infinito
 *
 * @param {string} consultaId - ID da consulta
 * @param {string} operadorId - ID do operador
 * @returns {Object} - Resultado da ação
 */
export function processOperatorDesmarcacao(consultaId, operadorId) {
    console.log(`[BadgeManager] Operador ${operadorId} desmarcou consulta ${consultaId} no AGHUse (SEM enviar mensagem ao paciente)`);

    return {
        success: true,
        consultaId,
        newBadge: BADGES.DESMARCADA,
        timestamp: new Date().toISOString(),
        operadorId,
        // NÃO envia mensagem ao paciente (paciente já sabe que será desmarcado)
        sendMessageToPaciente: false,
        reason: 'Paciente solicitou desmarcação via WhatsApp (resposta 2)'
    };
}

/**
 * Processa reagendamento (quando operador cria nova consulta)
 * Badge VERMELHO → VERDE + Envia REAGENDAMENTO_CONFIRMACAO (COM 3 botões)
 *
 * Template REAGENDAMENTO_CONFIRMACAO permite que paciente:
 * - Confirme presença (botão 1)
 * - Diga que não poderá comparecer (botão 2) → libera vaga para outro paciente
 * - Informe que não agendou (botão 3)
 *
 * Badge AMARELO identifica visualmente que é reagendamento no dashboard.
 * Se paciente não puder comparecer, badge VERMELHO aparece JUNTO com AMARELO.
 *
 * @param {string} consultaOriginalId - ID da consulta original desmarcada
 * @param {Object} novaConsulta - Dados da nova consulta
 * @param {string} telefone - Telefone do paciente
 * @returns {Promise<Object>} - Resultado da ação
 */
export async function processOperatorReagendamento(consultaOriginalId, novaConsulta, telefone) {
    console.log(`[BadgeManager] Reagendamento: ${consultaOriginalId} → Nova consulta ${novaConsulta.consultaNumero}`);

    try {
        // Template REAGENDAMENTO_CONFIRMACAO com 3 botões (permite desmarcação para liberar vaga)
        const mensagem = WhatsAppTemplates.generateMessage('reagendamento_confirmacao', {
            nomePaciente: novaConsulta.nomeCompleto,  // ✅ CORRIGIDO: nomeCompleto não nomePaciente
            especialidade: novaConsulta.especialidade,
            dataHora: novaConsulta.dataHoraFormatada,
            medico: novaConsulta.profissional
        });

        // Formata chatId
        const chatId = WhatsAppTemplates.formatWhatsAppChatId(telefone);

        // Envia via fila
        await WhatsAppQueue.addToQueue({
            chatId,
            texto: mensagem.texto,
            botoes: mensagem.botoes,  // 3 botões: Confirmar, Não poderei, Não agendei
            metadata: {
                type: 'reagendamento_confirmacao',
                consultaOriginalId,
                novaConsultaId: novaConsulta.consultaNumero,
                telefone,
                isReagendamento: true  // ✅ Flag para identificar reagendamento
            }
        });

        console.log(`[BadgeManager] ✅ Mensagem de reagendamento enviada para ${telefone}`);

        // ✅ ATUALIZA BADGE: Vermelho → Verde
        try {
            const backendUrl = window?.CONFIG?.BACKEND_URL || 'http://localhost:3000';

            // 1. Marca desmarcação como reagendada na tabela desmarcacoes_ativas
            const response1 = await fetch(`${backendUrl}/api/desmarcacao/${consultaOriginalId}/reagendada`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ novaConsultaNumero: novaConsulta.consultaNumero })
            });

            const result1 = await response1.json();
            if (result1.success) {
                console.log(`[BadgeManager] ✅ Desmarcação ${consultaOriginalId} marcada como reagendada no SQLite`);
            } else {
                console.warn(`[BadgeManager] ⚠️ Falha ao marcar desmarcação como reagendada:`, result1);
            }

            // 2. Atualiza badge na tabela badges: vermelho → verde
            const response2 = await fetch(`${backendUrl}/api/badges/reagendar/atualizar`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    consultaNumero: consultaOriginalId,
                    novaConsultaNumero: novaConsulta.consultaNumero
                })
            });

            const result2 = await response2.json();
            if (result2.success) {
                console.log(`[BadgeManager] ✅ Badge atualizado: vermelho → verde (consulta ${consultaOriginalId})`);
            } else {
                console.warn(`[BadgeManager] ⚠️ Falha ao atualizar badge:`, result2);
            }

            // 3. Marca a NOVA CONSULTA como reagendamento (badge amarelo na aba Confirmação)
            // CORREÇÃO: Este passo estava faltando - a nova consulta não estava sendo marcada!
            const response3 = await fetch(`${backendUrl}/api/consultas/ativas/${novaConsulta.consultaNumero}/marcar-reagendamento`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reagendamentoDe: consultaOriginalId,
                    reagendamentoTipo: 'desmarcacao'
                })
            });

            const result3 = await response3.json();
            if (result3.success) {
                console.log(`[BadgeManager] ✅ Badge AMARELO adicionado na nova consulta ${novaConsulta.consultaNumero}`);
            } else {
                console.warn(`[BadgeManager] ⚠️ Falha ao adicionar badge amarelo:`, result3);
            }
        } catch (error) {
            console.error(`[BadgeManager] ❌ Erro ao atualizar reagendamento:`, error);
        }

        return {
            success: true,
            consultaOriginalId,
            novaConsultaId: novaConsulta.consultaNumero,
            newBadge: BADGES.REAGENDADA,
            messageSent: true,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('[BadgeManager] Erro ao processar reagendamento:', error);

        return {
            success: false,
            error: error.message,
            consultaOriginalId,
            novaConsultaId: novaConsulta.consultaNumero
        };
    }
}

/**
 * Valida se badge pode mudar de estado
 *
 * @param {Object} currentBadge - Badge atual
 * @param {Object} newBadge - Novo badge
 * @returns {boolean} - true se transição válida
 */
export function canTransitionBadge(currentBadge, newBadge) {
    // Transições válidas:
    // DESMARCAR (vermelho) → DESMARCADA (verde)
    // REAGENDAR (vermelho) → REAGENDADA (verde)

    if (!currentBadge) {
        return true; // Pode criar qualquer badge
    }

    const validTransitions = {
        'Desmarcar': ['Desmarcada'],
        'Reagendar': ['Reagendada']
    };

    const allowedTargets = validTransitions[currentBadge.label] || [];

    return allowedTargets.includes(newBadge.label);
}

/**
 * Obtém card de destino baseado no status
 *
 * @param {string} status - Status da resposta
 * @param {string} type - Tipo ('confirmacao' ou 'desmarcacao')
 * @returns {string} - Nome do card de destino
 */
export function getCardByStatus(status, type) {
    const cardMap = {
        confirmacao: {
            'confirmed': 'confirmados',
            'declined': 'nao_podera_comparecer',
            'not_scheduled': 'nao_agendou'
        },
        desmarcacao: {
            'reagendamento': 'solicitou_reagendamento',
            'paciente_solicitou': 'paciente_solicitou',
            'sem_reagendamento': 'sem_reagendamento'
        }
    };

    return cardMap[type]?.[status] || 'sem_resposta';
}

export default {
    BADGES,
    processConfirmacaoResponse,
    processDesmarcacaoResponse,
    processOperatorDesmarcacao,
    processOperatorReagendamento,
    canTransitionBadge,
    getCardByStatus
};
