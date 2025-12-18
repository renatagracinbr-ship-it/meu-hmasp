/**
 * Serviço de Gerenciamento de Contexto de Conversas
 *
 * Responsável por:
 * - Armazenar última mensagem do sistema para cada telefone
 * - Gerenciar mensagens pendentes (quando há múltiplas)
 * - Evitar respostas cruzadas
 * - Detectar ambiguidades
 * - Fornecer contexto para classificação de intenções
 *
 * Estrutura de dados por telefone:
 * {
 *   telefone: "+5511999999999",
 *   pacienteId: 12345,
 *   prontuarioNr: "A000111",
 *   lastSystemMessage: {
 *     type: "confirmacao" | "desmarcacao",
 *     consultaId: 98765,
 *     especialidade: "Endocrinologia",
 *     data: "2025-12-20",
 *     hora: "14:00",
 *     dataHoraFormatada: "20/12/2025 14:00",
 *     medico: "Fulano de Tal",
 *     timestamp: "2025-12-08T15:30:00-03:00",
 *     messageId: "msg_123"
 *   },
 *   pendingSystemMessages: [
 *     { id: "m1", type: "confirmacao", consultaId: 111, timestamp: "..." },
 *     { id: "m2", type: "desmarcacao", consultaId: 112, timestamp: "..." }
 *   ],
 *   conversationContext: {
 *     lastInbound: { text: "...", timestamp: "..." },
 *     status: "awaiting_confirmation",
 *     lastIntentConfidence: 0.83,
 *     failedAttempts: 0
 *   },
 *   reagendamentoRequests: [
 *     { pedidoId: "r1", consultaOriginalId: 111, timestamp: "2025-12-08T15:32:00-03:00" }
 *   ]
 * }
 */

import { PhoneNormalizer } from '../utils/phoneNormalizer.js';

// Storage em memória (depois migrar para PostgreSQL)
const contextsStore = new Map();

/**
 * Obtém contexto de um telefone
 *
 * @param {string} telefone - Telefone normalizado (E.164)
 * @returns {Object|null} - Contexto ou null
 */
export function getContext(telefone) {
    const normalized = PhoneNormalizer.normalize(telefone);
    return contextsStore.get(normalized) || null;
}

/**
 * Cria ou atualiza contexto básico de um telefone
 *
 * @param {string} telefone - Telefone normalizado
 * @param {Object} data - Dados opcionais (pacienteId, prontuarioNr)
 * @returns {Object} - Contexto criado/atualizado
 */
export function createOrUpdateContext(telefone, data = {}) {
    const normalized = PhoneNormalizer.normalize(telefone);

    let context = contextsStore.get(normalized);

    if (!context) {
        context = {
            telefone: normalized,
            pacienteId: data.pacienteId || null,
            prontuarioNr: data.prontuarioNr || null,
            lastSystemMessage: null,
            pendingSystemMessages: [],
            conversationContext: {
                lastInbound: null,
                status: 'idle',
                lastIntentConfidence: null,
                failedAttempts: 0
            },
            reagendamentoRequests: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
    } else {
        // Atualiza apenas campos fornecidos
        if (data.pacienteId) context.pacienteId = data.pacienteId;
        if (data.prontuarioNr) context.prontuarioNr = data.prontuarioNr;
        context.updatedAt = new Date().toISOString();
    }

    contextsStore.set(normalized, context);
    return context;
}

/**
 * Registra mensagem do sistema enviada
 *
 * @param {string} telefone - Telefone normalizado
 * @param {Object} messageData - Dados da mensagem
 * @returns {Object} - Contexto atualizado
 */
export function registerSystemMessage(telefone, messageData) {
    const normalized = PhoneNormalizer.normalize(telefone);
    let context = getContext(normalized) || createOrUpdateContext(normalized);

    const systemMessage = {
        id: messageData.messageId || `msg_${Date.now()}`,
        type: messageData.type, // 'confirmacao' ou 'desmarcacao'
        consultaId: messageData.consultaId,
        especialidade: messageData.especialidade,
        data: messageData.data,
        hora: messageData.hora,
        dataHoraFormatada: messageData.dataHoraFormatada,
        medico: messageData.medico,
        timestamp: messageData.timestamp || new Date().toISOString(),
        responded: false
    };

    // Define como última mensagem do sistema
    context.lastSystemMessage = systemMessage;

    // Adiciona às pendentes se ainda não houver resposta
    context.pendingSystemMessages.push(systemMessage);

    // Atualiza status
    context.conversationContext.status = 'awaiting_response';
    context.updatedAt = new Date().toISOString();

    contextsStore.set(normalized, context);

    console.log(`[Context] Mensagem do sistema registrada para ${normalized}: ${systemMessage.type} - Consulta ${systemMessage.consultaId}`);

    return context;
}

/**
 * Registra mensagem recebida do paciente
 *
 * @param {string} telefone - Telefone normalizado
 * @param {string} text - Texto da mensagem
 * @param {Object} intent - Resultado da classificação de intenção
 * @returns {Object} - Contexto atualizado
 */
export function registerInboundMessage(telefone, text, intent = null) {
    const normalized = PhoneNormalizer.normalize(telefone);
    let context = getContext(normalized) || createOrUpdateContext(normalized);

    context.conversationContext.lastInbound = {
        text,
        intent: intent?.intent || null,
        confidence: intent?.confidence || null,
        timestamp: new Date().toISOString()
    };

    if (intent) {
        context.conversationContext.lastIntentConfidence = intent.confidence;
    }

    context.updatedAt = new Date().toISOString();
    contextsStore.set(normalized, context);

    return context;
}

/**
 * Marca mensagem do sistema como respondida
 *
 * @param {string} telefone - Telefone normalizado
 * @param {string} consultaId - ID da consulta respondida
 * @returns {Object} - Contexto atualizado
 */
export function markMessageAsResponded(telefone, consultaId) {
    const normalized = PhoneNormalizer.normalize(telefone);
    let context = getContext(normalized);

    if (!context) {
        console.warn(`[Context] Contexto não encontrado para ${normalized}`);
        return null;
    }

    // Marca na lastSystemMessage se for a mesma consulta
    if (context.lastSystemMessage && context.lastSystemMessage.consultaId === consultaId) {
        context.lastSystemMessage.responded = true;
        context.lastSystemMessage.respondedAt = new Date().toISOString();
    }

    // Remove das pendentes
    context.pendingSystemMessages = context.pendingSystemMessages.filter(msg => {
        if (msg.consultaId === consultaId) {
            msg.responded = true;
            msg.respondedAt = new Date().toISOString();
            return false;
        }
        return true;
    });

    // Atualiza status
    if (context.pendingSystemMessages.length === 0) {
        context.conversationContext.status = 'idle';
    }

    context.conversationContext.failedAttempts = 0; // Reset
    context.updatedAt = new Date().toISOString();

    contextsStore.set(normalized, context);

    console.log(`[Context] Mensagem marcada como respondida: ${consultaId} para ${normalized}`);

    return context;
}

/**
 * Verifica se há ambiguidade (múltiplas mensagens pendentes)
 *
 * @param {string} telefone - Telefone normalizado
 * @returns {Object} - { hasAmbiguity, pendingCount, messages }
 */
export function checkAmbiguity(telefone) {
    const normalized = PhoneNormalizer.normalize(telefone);
    const context = getContext(normalized);

    if (!context) {
        return { hasAmbiguity: false, pendingCount: 0, messages: [] };
    }

    const pendingCount = context.pendingSystemMessages.filter(msg => !msg.responded).length;

    return {
        hasAmbiguity: pendingCount > 1,
        pendingCount,
        messages: context.pendingSystemMessages.filter(msg => !msg.responded)
    };
}

/**
 * Gera mensagem de clarificação para ambiguidade
 *
 * @param {string} telefone - Telefone normalizado
 * @returns {string|null} - Mensagem de clarificação ou null
 */
export function generateAmbiguityClarification(telefone) {
    const normalized = PhoneNormalizer.normalize(telefone);
    const ambiguity = checkAmbiguity(normalized);

    if (!ambiguity.hasAmbiguity) {
        return null;
    }

    let message = `Percebi que você tem *${ambiguity.pendingCount} mensagens pendentes*. Vou reenviar cada uma para que confirme individualmente.\n\n`;

    // Lista as mensagens pendentes
    ambiguity.messages.forEach((msg, index) => {
        const tipo = msg.type === 'confirmacao' ? '📋 Confirmação' : '⚠️ Desmarcação';
        message += `${index + 1}. ${tipo} - ${msg.especialidade} em ${msg.dataHoraFormatada}\n`;
    });

    message += `\nVou reenviar a primeira. Responda à primeira para começar.`;

    return message;
}

/**
 * Obtém próxima mensagem pendente para reenvio
 *
 * @param {string} telefone - Telefone normalizado
 * @returns {Object|null} - Próxima mensagem pendente ou null
 */
export function getNextPendingMessage(telefone) {
    const normalized = PhoneNormalizer.normalize(telefone);
    const context = getContext(normalized);

    if (!context || context.pendingSystemMessages.length === 0) {
        return null;
    }

    // Retorna a mais antiga
    const pending = context.pendingSystemMessages
        .filter(msg => !msg.responded)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    return pending[0] || null;
}

/**
 * Incrementa contador de tentativas falhadas
 *
 * @param {string} telefone - Telefone normalizado
 * @returns {number} - Número de tentativas falhadas
 */
export function incrementFailedAttempts(telefone) {
    const normalized = PhoneNormalizer.normalize(telefone);
    let context = getContext(normalized) || createOrUpdateContext(normalized);

    context.conversationContext.failedAttempts++;
    context.updatedAt = new Date().toISOString();

    contextsStore.set(normalized, context);

    return context.conversationContext.failedAttempts;
}

/**
 * Reseta contador de tentativas falhadas
 *
 * @param {string} telefone - Telefone normalizado
 */
export function resetFailedAttempts(telefone) {
    const normalized = PhoneNormalizer.normalize(telefone);
    let context = getContext(normalized);

    if (context) {
        context.conversationContext.failedAttempts = 0;
        context.updatedAt = new Date().toISOString();
        contextsStore.set(normalized, context);
    }
}

/**
 * Registra pedido de reagendamento
 *
 * MELHORADO: Agora armazena pacienteId e prontuarioNr direto no pedido
 * Benefício: Evita busca na desmarcação original (mais rápido e confiável)
 *
 * @param {string} telefone - Telefone normalizado
 * @param {Object} data - Dados do pedido (consultaOriginalId, especialidade, etc)
 * @returns {Object} - Pedido criado
 */
export function registerReagendamentoRequest(telefone, data) {
    const normalized = PhoneNormalizer.normalize(telefone);
    let context = getContext(normalized) || createOrUpdateContext(normalized);

    const pedido = {
        pedidoId: `reagend_${Date.now()}`,

        // Dados da consulta original
        consultaOriginalId: data.consultaOriginalId,
        especialidade: data.especialidade,

        // ✅ NOVO: Dados do paciente (evita busca na desmarcação)
        pacienteId: data.pacienteId || context.pacienteId,
        prontuarioNr: data.prontuarioNr || context.prontuarioNr,
        nomePaciente: data.nomePaciente || null,

        // Controle
        timestamp: new Date().toISOString(),
        status: 'pending', // 'pending', 'fulfilled', 'cancelled'

        // ✅ NOVO: Metadados para debugging
        requestSource: data.requestSource || 'chat_response', // ou 'manual'
        originalDesmarcacaoId: data.desmarcacaoId || null
    };

    context.reagendamentoRequests.push(pedido);
    context.updatedAt = new Date().toISOString();

    contextsStore.set(normalized, context);

    console.log(`[Context] ✅ Pedido de reagendamento registrado: ${pedido.pedidoId} para ${normalized}`);
    console.log(`[Context]    Paciente: ${pedido.nomePaciente || 'N/A'} (${pedido.prontuarioNr || 'sem prontuário'})`);
    console.log(`[Context]    Especialidade: ${pedido.especialidade}`);

    return pedido;
}

/**
 * Obtém pedidos de reagendamento pendentes (últimas 24h)
 *
 * @param {string} telefone - Telefone normalizado
 * @param {string} especialidade - Especialidade (opcional para filtrar)
 * @returns {Array} - Lista de pedidos pendentes
 */
export function getPendingReagendamentoRequests(telefone, especialidade = null) {
    const normalized = PhoneNormalizer.normalize(telefone);
    const context = getContext(normalized);

    if (!context || !context.reagendamentoRequests.length) {
        return [];
    }

    const now = new Date();
    const last72h = new Date(now.getTime() - 72 * 60 * 60 * 1000);

    return context.reagendamentoRequests.filter(pedido => {
        const pedidoDate = new Date(pedido.timestamp);
        const isRecent = pedidoDate >= last72h;
        const isPending = pedido.status === 'pending';
        const matchesEspecialidade = !especialidade || pedido.especialidade === especialidade;

        return isRecent && isPending && matchesEspecialidade;
    });
}

/**
 * Marca pedido de reagendamento como atendido
 *
 * @param {string} telefone - Telefone normalizado
 * @param {string} pedidoId - ID do pedido
 * @param {string} novaConsultaId - ID da nova consulta agendada
 * @returns {Object|null} - Pedido atualizado ou null
 */
export function fulfillReagendamentoRequest(telefone, pedidoId, novaConsultaId) {
    const normalized = PhoneNormalizer.normalize(telefone);
    const context = getContext(normalized);

    if (!context) {
        return null;
    }

    const pedido = context.reagendamentoRequests.find(p => p.pedidoId === pedidoId);

    if (pedido) {
        pedido.status = 'fulfilled';
        pedido.novaConsultaId = novaConsultaId;
        pedido.fulfilledAt = new Date().toISOString();

        context.updatedAt = new Date().toISOString();
        contextsStore.set(normalized, context);

        console.log(`[Context] Pedido de reagendamento atendido: ${pedidoId} -> Nova consulta ${novaConsultaId}`);

        return pedido;
    }

    return null;
}

/**
 * Marca consulta como reagendada recentemente (proteção contra loop)
 *
 * Quando uma consulta é reagendada após pedido de reagendamento,
 * marca no contexto para evitar que paciente clique "não poderei comparecer"
 * gerando loop infinito de desmarcação → reagendamento → desmarcação
 *
 * @param {string} telefone - Telefone normalizado
 * @param {string} consultaId - ID da nova consulta reagendada
 * @param {string} consultaOriginalId - ID da consulta original desmarcada
 * @returns {Object} - Contexto atualizado
 */
export function markConsultaAsReagendamento(telefone, consultaId, consultaOriginalId) {
    const normalized = PhoneNormalizer.normalize(telefone);
    let context = getContext(normalized) || createOrUpdateContext(normalized);

    // Inicializa array se não existir
    if (!context.consultasReagendadas) {
        context.consultasReagendadas = [];
    }

    // Registra reagendamento
    context.consultasReagendadas.push({
        novaConsultaId: consultaId,
        consultaOriginalId: consultaOriginalId,
        reagendadaEm: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()  // 48h de proteção
    });

    context.updatedAt = new Date().toISOString();
    contextsStore.set(normalized, context);

    console.log(`[Context] ✅ Consulta ${consultaId} marcada como reagendamento (proteção anti-loop por 48h)`);

    return context;
}

/**
 * Verifica se consulta é reagendamento recente (últimas 48h)
 *
 * Usado para evitar criar badge DESMARCAR se paciente clicar "não poderei comparecer"
 * em uma consulta que acabou de ser reagendada
 *
 * @param {string} telefone - Telefone normalizado
 * @param {string} consultaId - ID da consulta
 * @returns {boolean} - true se é reagendamento recente
 */
export function isRecentReagendamento(telefone, consultaId) {
    const normalized = PhoneNormalizer.normalize(telefone);
    const context = getContext(normalized);

    if (!context || !context.consultasReagendadas) {
        return false;
    }

    const now = new Date();

    // Verifica se consulta está na lista de reagendamentos e não expirou
    const reagendamento = context.consultasReagendadas.find(r => {
        const expiresAt = new Date(r.expiresAt);
        return r.novaConsultaId === consultaId && expiresAt > now;
    });

    if (reagendamento) {
        console.log(`[Context] ⚠️ Consulta ${consultaId} é reagendamento recente (proteção anti-loop ativa)`);
        return true;
    }

    return false;
}

/**
 * Limpa contextos antigos (mais de 7 dias sem atividade)
 */
export function cleanOldContexts() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    let removed = 0;

    contextsStore.forEach((context, telefone) => {
        const updatedAt = new Date(context.updatedAt);
        if (updatedAt < sevenDaysAgo) {
            contextsStore.delete(telefone);
            removed++;
        }
    });

    if (removed > 0) {
        console.log(`[Context] ${removed} contextos antigos removidos`);
    }

    return removed;
}

/**
 * Obtém estatísticas de contextos
 *
 * @returns {Object} - Estatísticas
 */
export function getStats() {
    let totalContexts = 0;
    let withPending = 0;
    let withAmbiguity = 0;
    let withReagendamento = 0;

    contextsStore.forEach(context => {
        totalContexts++;
        if (context.pendingSystemMessages.filter(m => !m.responded).length > 0) {
            withPending++;
        }
        if (context.pendingSystemMessages.filter(m => !m.responded).length > 1) {
            withAmbiguity++;
        }
        if (context.reagendamentoRequests.filter(r => r.status === 'pending').length > 0) {
            withReagendamento++;
        }
    });

    return {
        totalContexts,
        withPending,
        withAmbiguity,
        withReagendamento
    };
}

export default {
    getContext,
    createOrUpdateContext,
    registerSystemMessage,
    registerInboundMessage,
    markMessageAsResponded,
    checkAmbiguity,
    generateAmbiguityClarification,
    getNextPendingMessage,
    incrementFailedAttempts,
    resetFailedAttempts,
    registerReagendamentoRequest,
    getPendingReagendamentoRequests,
    fulfillReagendamentoRequest,
    markConsultaAsReagendamento,  // Nova função
    isRecentReagendamento,         // Nova função
    cleanOldContexts,
    getStats
};
