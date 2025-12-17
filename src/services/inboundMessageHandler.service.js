/**
 * Handler de Mensagens Recebidas (Inbound)
 *
 * Pipeline de processamento:
 * 1. Recebe mensagem do paciente
 * 2. Obtém contexto (última mensagem do sistema)
 * 3. Verifica ambiguidade (múltiplas mensagens pendentes)
 * 4. Classifica intenção (NLP + keywords + números)
 * 5. Valida compatibilidade com contexto
 * 6. Processa resposta (confirmação ou desmarcação)
 * 7. Atualiza badges e status
 * 8. Envia resposta automática
 * 9. Registra logs
 *
 * Regras fundamentais:
 * - SEMPRE usar lastSystemMessage como fonte de verdade
 * - Evitar respostas cruzadas com verificação de ambiguidade
 * - Confidence >= 0.75: aceitar automaticamente
 * - Confidence 0.55-0.75: pedir confirmação
 * - Confidence < 0.55: fallback
 */

import * as IntentClassifier from './intentClassifier.service.js';
import * as ConversationContext from './conversationContext.service.js';
import * as BadgeManager from './badgeManager.service.js';
import * as ConfirmacaoService from './confirmacao.service.js';
import * as DesmarcacaoService from './desmarcacao.service.js';
import * as WhatsAppQueue from './whatsappQueue.service.js';
import * as WhatsAppTemplates from './whatsappTemplates.service.js';
import { PhoneNormalizer } from '../utils/phoneNormalizer.js';

/**
 * Processa mensagem recebida do paciente
 *
 * @param {Object} inboundMessage - Mensagem recebida
 * @param {string} inboundMessage.from - Telefone do remetente (formato WhatsApp: 5511999999999@c.us)
 * @param {string} inboundMessage.body - Texto da mensagem
 * @param {string} inboundMessage.timestamp - Timestamp da mensagem
 * @returns {Promise<Object>} - Resultado do processamento
 */
export async function processInboundMessage(inboundMessage) {
    const result = {
        success: false,
        telefone: null,
        context: null,
        intent: null,
        action: null,
        response: null,
        error: null
    };

    try {
        // 1. Normaliza telefone
        const telefoneRaw = inboundMessage.from.replace('@c.us', '');
        const telefone = PhoneNormalizer.normalize(`+${telefoneRaw}`);
        result.telefone = telefone;

        console.log(`[InboundHandler] Mensagem recebida de ${telefone}: "${inboundMessage.body}"`);

        // 2. Obtém ou cria contexto
        let context = ConversationContext.getContext(telefone);
        if (!context) {
            context = ConversationContext.createOrUpdateContext(telefone);
            console.log(`[InboundHandler] Contexto criado para ${telefone}`);
        }
        result.context = context;

        // 3. Verifica se há mensagens pendentes (ambiguidade)
        const ambiguity = ConversationContext.checkAmbiguity(telefone);

        if (ambiguity.hasAmbiguity) {
            // MÚLTIPLAS MENSAGENS PENDENTES: Enviar clarificação e reenviar uma por vez
            console.log(`[InboundHandler] Ambiguidade detectada: ${ambiguity.pendingCount} mensagens pendentes`);

            const clarificationMessage = ConversationContext.generateAmbiguityClarification(telefone);

            // Envia mensagem de clarificação
            await sendMessage(telefone, clarificationMessage);

            // Obtém próxima mensagem pendente para reenvio
            const nextPending = ConversationContext.getNextPendingMessage(telefone);

            if (nextPending) {
                // Reenvia a mensagem pendente
                await resendPendingMessage(telefone, nextPending);
            }

            result.action = 'ambiguity_clarification';
            result.response = clarificationMessage;
            result.success = true;

            return result;
        }

        // 4. Obtém última mensagem do sistema (fonte de verdade)
        const lastSystemMessage = context.lastSystemMessage;

        if (!lastSystemMessage) {
            // PACIENTE INICIOU A CONVERSA (sem contexto de sistema)
            console.log(`[InboundHandler] Paciente iniciou conversa sem contexto prévio`);

            result.action = 'patient_initiated';
            result.response = await handlePatientInitiatedConversation(telefone, inboundMessage.body);
            result.success = true;

            return result;
        }

        // 5. Classifica intenção baseado no contexto
        const classification = IntentClassifier.classifyIntent(
            inboundMessage.body,
            lastSystemMessage.type // 'confirmacao' ou 'desmarcacao'
        );

        result.intent = classification;

        console.log(`[InboundHandler] Intenção classificada: ${classification.intent} (confidence: ${classification.confidence})`);

        // Registra mensagem recebida no contexto
        ConversationContext.registerInboundMessage(telefone, inboundMessage.body, classification);

        // 6. Valida compatibilidade com contexto
        const isCompatible = IntentClassifier.isIntentCompatibleWithContext(
            classification.intent,
            lastSystemMessage.type
        );

        if (!isCompatible) {
            console.warn(`[InboundHandler] Intenção incompatível com contexto: ${classification.intent} vs ${lastSystemMessage.type}`);

            // Envia mensagem pedindo clarificação
            const clarificationMsg = `Desculpe, não entendi sua resposta. Por favor, responda à última mensagem que enviamos sobre ${lastSystemMessage.especialidade} em ${lastSystemMessage.dataHoraFormatada}.`;

            await sendMessage(telefone, clarificationMsg);

            result.action = 'incompatible_intent';
            result.response = clarificationMsg;
            result.success = false;

            return result;
        }

        // 7. Verifica confidence e decide ação
        if (classification.confidence >= 0.75) {
            // ALTA CONFIANÇA: Processar automaticamente
            console.log(`[InboundHandler] Alta confiança (${classification.confidence}) - Processando automaticamente`);

            result.action = 'auto_process';
            result.response = await processHighConfidenceIntent(telefone, classification, lastSystemMessage);
            result.success = true;

        } else if (classification.confidence >= 0.55) {
            // MÉDIA CONFIANÇA: Pedir confirmação
            console.log(`[InboundHandler] Média confiança (${classification.confidence}) - Pedindo confirmação`);

            const confirmationMsg = IntentClassifier.generateClarificationMessage(classification, lastSystemMessage);

            await sendMessage(telefone, confirmationMsg);

            // Incrementa tentativas falhadas
            ConversationContext.incrementFailedAttempts(telefone);

            result.action = 'request_confirmation';
            result.response = confirmationMsg;
            result.success = true;

        } else {
            // BAIXA CONFIANÇA: Fallback
            console.log(`[InboundHandler] Baixa confiança (${classification.confidence}) - Fallback`);

            result.action = 'fallback';
            result.response = await handleLowConfidence(telefone, inboundMessage.body, lastSystemMessage);
            result.success = true;
        }

    } catch (error) {
        console.error('[InboundHandler] Erro ao processar mensagem:', error);
        result.error = error.message;
        result.success = false;
    }

    // 10. Registra log (TODO: implementar auditService)
    await logInboundMessage(result);

    return result;
}

/**
 * Processa intenção com alta confiança (>= 0.75)
 *
 * @param {string} telefone - Telefone normalizado
 * @param {Object} classification - Classificação da intenção
 * @param {Object} lastSystemMessage - Última mensagem do sistema
 * @returns {Promise<Object>} - Resultado do processamento
 */
async function processHighConfidenceIntent(telefone, classification, lastSystemMessage) {
    const { intent } = classification;
    const { type, consultaId } = lastSystemMessage;

    console.log(`[InboundHandler] Processando intent: ${intent} para consulta ${consultaId}`);

    let processResult;

    if (type === 'confirmacao') {
        // CONFIRMAÇÃO: Busca confirmação e processa
        const confirmation = ConfirmacaoService.getConfirmation(`MARCACAO_${consultaId}`);

        if (!confirmation) {
            throw new Error(`Confirmação não encontrada: ${consultaId}`);
        }

        // Processa resposta via BadgeManager
        processResult = await BadgeManager.processConfirmacaoResponse(confirmation, intent, telefone);

        // Atualiza status da confirmação
        if (processResult.success) {
            confirmation.statusGeral = processResult.newStatus;
            confirmation.badge = processResult.badge;
            confirmation.atualizadoEm = new Date();

            console.log(`[InboundHandler] Confirmação atualizada: ${consultaId} → ${processResult.newStatus}`);
        }

    } else if (type === 'desmarcacao') {
        // DESMARCAÇÃO: Busca desmarcação e processa
        const desmarcacao = findDesmarcacaoByConsultaId(consultaId);

        if (!desmarcacao) {
            throw new Error(`Desmarcação não encontrada: ${consultaId}`);
        }

        // Processa resposta via BadgeManager
        processResult = await BadgeManager.processDesmarcacaoResponse(desmarcacao, intent, telefone);

        // Atualiza status da desmarcação
        if (processResult.success) {
            DesmarcacaoService.registerResponse(desmarcacao.id, mapIntentToBotaoId(intent));

            console.log(`[InboundHandler] Desmarcação atualizada: ${consultaId} → ${processResult.newStatus}`);

            // Se foi reagendamento, registra no contexto
            if (intent === 'reagendamento') {
                ConversationContext.registerReagendamentoRequest(telefone, {
                    consultaOriginalId: consultaId,
                    especialidade: desmarcacao.especialidade,
                    // ✅ NOVO: Passa dados do paciente para otimizar match futuro
                    pacienteId: desmarcacao.pacCodigo,
                    prontuarioNr: desmarcacao.prontuario,
                    nomePaciente: desmarcacao.nomePaciente,
                    desmarcacaoId: desmarcacao.id
                });
            }
        }
    }

    // Marca mensagem como respondida no contexto
    ConversationContext.markMessageAsResponded(telefone, consultaId);

    // Reset tentativas falhadas
    ConversationContext.resetFailedAttempts(telefone);

    return processResult;
}

/**
 * Trata conversas iniciadas pelo paciente (sem contexto prévio)
 *
 * @param {string} telefone - Telefone normalizado
 * @param {string} messageText - Texto da mensagem
 * @returns {Promise<string>} - Mensagem de resposta
 */
async function handlePatientInitiatedConversation(telefone, messageText) {
    console.log(`[InboundHandler] Paciente iniciou conversa: ${telefone}`);

    // Mensagem padrão de boas-vindas (conforme prompt seção 16)
    const welcomeMessage = `✅ *Olá! Agradecemos o contato.*\n\n` +
        `Este é nosso sistema automatizado de confirmação de presença e desmarcação de consultas, que está em implementação.\n\n` +
        `No momento, utilizamos este canal exclusivamente para:\n` +
        `• Confirmação de presença em consultas agendadas\n` +
        `• Desmarcação de consultas\n\n` +
        `Para outros assuntos, por favor entre em contato com a *Central de Marcação de Consultas* pelos nossos canais de atendimento.\n\n` +
        `Agradecemos a compreensão.\n\n` +
        `_HMASP - Central de Marcação de Consultas_`;

    // Envia com typing delay
    await sendMessage(telefone, welcomeMessage);

    return welcomeMessage;
}

/**
 * Trata mensagens com baixa confiança (< 0.55)
 *
 * @param {string} telefone - Telefone normalizado
 * @param {string} messageText - Texto da mensagem
 * @param {Object} lastSystemMessage - Última mensagem do sistema
 * @returns {Promise<string>} - Mensagem de resposta
 */
async function handleLowConfidence(telefone, messageText, lastSystemMessage) {
    console.log(`[InboundHandler] Baixa confiança - Enviando mensagem de clarificação`);

    // Incrementa tentativas falhadas
    const failedAttempts = ConversationContext.incrementFailedAttempts(telefone);

    // Se já tentou 3 vezes, encerra cordialmente (conforme schema SQL)
    if (failedAttempts >= 3) {
        const encerramento = `🙏 *Agradecemos seu contato!*\n\n` +
            `Percebemos que houve dificuldade em processar sua resposta.\n\n` +
            `Se você possui dúvidas sobre sua consulta ou precisa de assistência, por favor entre em contato com a *Central de Marcação de Consultas* através dos nossos canais oficiais de atendimento.\n\n` +
            `_Estamos à disposição._\n\n` +
            `_HMASP - Central de Marcação de Consultas_`;
        await sendMessage(telefone, encerramento);
        return encerramento;
    }

    // Gera mensagem de clarificação baseada no contexto
    const clarificationMsg = IntentClassifier.generateClarificationMessage(
        { intent: 'unknown', confidence: 0 },
        lastSystemMessage
    );

    await sendMessage(telefone, clarificationMsg);

    return clarificationMsg;
}

/**
 * Reenvia mensagem pendente
 *
 * @param {string} telefone - Telefone normalizado
 * @param {Object} pendingMessage - Mensagem pendente
 * @returns {Promise<void>}
 */
async function resendPendingMessage(telefone, pendingMessage) {
    const { type, especialidade, dataHoraFormatada, consultaId } = pendingMessage;

    let mensagem;

    if (type === 'confirmacao') {
        const confirmation = ConfirmacaoService.getConfirmation(`MARCACAO_${consultaId}`);
        if (confirmation && confirmation.mensagens[0]) {
            mensagem = confirmation.mensagens[0].mensagem.texto;
        }
    } else if (type === 'desmarcacao') {
        const desmarcacao = findDesmarcacaoByConsultaId(consultaId);
        if (desmarcacao) {
            const msg = WhatsAppTemplates.generateMessage('desmarcacao_notificacao', {
                nomePaciente: desmarcacao.nomePaciente,
                especialidade: desmarcacao.especialidade,
                dataHora: desmarcacao.dataHoraFormatada,
                medico: desmarcacao.profissional
            });
            mensagem = msg.texto;
        }
    }

    if (mensagem) {
        await sendMessage(telefone, mensagem);
        console.log(`[InboundHandler] Mensagem pendente reenviada: ${consultaId}`);
    }
}

/**
 * Envia mensagem via WhatsApp (com typing delay)
 *
 * @param {string} telefone - Telefone normalizado
 * @param {string} texto - Texto da mensagem
 * @returns {Promise<void>}
 */
async function sendMessage(telefone, texto) {
    const chatId = WhatsAppTemplates.formatWhatsAppChatId(telefone);

    await WhatsAppQueue.addToQueue({
        chatId,
        texto,
        botoes: null,
        metadata: {
            type: 'clarification_or_fallback',
            telefone
        }
    });
}

/**
 * Busca desmarcação por consultaId
 * (pode ter múltiplas desmarcações com mesmo consultaId, retorna a mais recente)
 *
 * @param {string} consultaId - ID da consulta
 * @returns {Object|null} - Desmarcação encontrada
 */
function findDesmarcacaoByConsultaId(consultaId) {
    const allDesmarcacoes = DesmarcacaoService.getAllDesmarcacoes();
    const matches = allDesmarcacoes.filter(d => d.consultaNumero === consultaId);

    if (matches.length === 0) {
        return null;
    }

    // Retorna a mais recente
    return matches.sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm))[0];
}

/**
 * Mapeia intent para botaoId (para DesmarcacaoService.registerResponse)
 *
 * @param {string} intent - Intenção
 * @returns {string} - ID do botão ('1', '2', '3')
 */
function mapIntentToBotaoId(intent) {
    const map = {
        'reagendamento': '1',
        'paciente_solicitou': '2',
        'sem_reagendamento': '3',
        'confirmed': '1',
        'declined': '2',
        'not_scheduled': '3'
    };

    return map[intent] || '1';
}

/**
 * Registra log da mensagem processada
 * TODO: Implementar auditService completo
 *
 * @param {Object} result - Resultado do processamento
 * @returns {Promise<void>}
 */
async function logInboundMessage(result) {
    // TODO: Salvar em banco de dados
    const logEntry = {
        timestamp: new Date().toISOString(),
        telefone: result.telefone,
        intent: result.intent?.intent || null,
        confidence: result.intent?.confidence || null,
        action: result.action,
        success: result.success,
        error: result.error,
        context: result.context?.lastSystemMessage || null
    };

    console.log('[InboundHandler] Log:', JSON.stringify(logEntry, null, 2));
}

export default {
    processInboundMessage
};
