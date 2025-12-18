/**
 * Serviço de Auditoria e Logs do Chat
 *
 * Responsável por registrar TODOS os eventos conforme seção 11 do prompt:
 * - Inbound raw text, normalized text
 * - Matched intent, confidence
 * - Matched lastSystemMessage id
 * - Action taken
 * - consultaId, operadorId (se houver)
 * - Timestamps
 *
 * Métricas:
 * - Taxa de acerto por keyword vs NLP
 * - Média de tempo de resposta (simulado)
 * - Número de respostas cruzadas detectadas e resolvidas
 * - Número de mensagens pendentes por telefone
 */

// Storage em memória (depois migrar para PostgreSQL)
const auditLogs = [];
const metrics = {
    totalMessages: 0,
    intentDetection: {
        directNumber: 0,
        keyword: 0,
        nlp: 0,
        fallback: 0
    },
    confidence: {
        high: 0,      // >= 0.75
        medium: 0,    // 0.55 - 0.75
        low: 0        // < 0.55
    },
    actions: {
        auto_process: 0,
        request_confirmation: 0,
        fallback: 0,
        ambiguity_clarification: 0,
        patient_initiated: 0,
        incompatible_intent: 0
    },
    responses: {
        confirmed: 0,
        declined: 0,
        not_scheduled: 0,
        reagendamento: 0,
        paciente_solicitou: 0,
        sem_reagendamento: 0
    },
    ambiguityDetected: 0,
    ambiguityResolved: 0,
    responseTimeMs: []
};

/**
 * Registra log de mensagem recebida (inbound)
 *
 * @param {Object} logData - Dados do log
 * @returns {string} - ID do log criado
 */
export function logInboundMessage(logData) {
    const log = {
        id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        type: 'inbound_message',
        telefone: logData.telefone,
        rawText: logData.rawText || null,
        normalizedText: logData.normalizedText || null,
        intent: logData.intent || null,
        confidence: logData.confidence || null,
        method: logData.method || null, // 'direct_number', 'keyword', 'nlp', 'fallback'
        lastSystemMessageId: logData.lastSystemMessageId || null,
        lastSystemMessageType: logData.lastSystemMessageType || null, // 'confirmacao' ou 'desmarcacao'
        consultaId: logData.consultaId || null,
        action: logData.action || null,
        success: logData.success !== undefined ? logData.success : true,
        error: logData.error || null,
        context: logData.context || null
    };

    auditLogs.push(log);

    // Atualiza métricas
    updateMetrics(log);

    console.log(`[ChatAudit] Log registrado: ${log.id} - ${log.action}`);

    return log.id;
}

/**
 * Registra log de mensagem enviada (outbound)
 *
 * @param {Object} logData - Dados do log
 * @returns {string} - ID do log criado
 */
export function logOutboundMessage(logData) {
    const log = {
        id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        type: 'outbound_message',
        telefone: logData.telefone,
        chatId: logData.chatId,
        messageType: logData.messageType, // 'confirmacao', 'desmarcacao', 'auto_response', 'clarification', etc
        consultaId: logData.consultaId || null,
        templateId: logData.templateId || null,
        texto: logData.texto || null,
        queueId: logData.queueId || null,
        success: logData.success !== undefined ? logData.success : true,
        error: logData.error || null
    };

    auditLogs.push(log);

    console.log(`[ChatAudit] Log enviado: ${log.id} - ${log.messageType}`);

    return log.id;
}

/**
 * Registra ação do operador
 *
 * @param {Object} logData - Dados do log
 * @returns {string} - ID do log criado
 */
export function logOperatorAction(logData) {
    const log = {
        id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        type: 'operator_action',
        operadorId: logData.operadorId,
        operadorNome: logData.operadorNome || null,
        action: logData.action, // 'desmarcar_aghuse', 'reagendar_aghuse', etc
        consultaId: logData.consultaId,
        consultaOriginalId: logData.consultaOriginalId || null,
        novaConsultaId: logData.novaConsultaId || null,
        telefone: logData.telefone || null,
        success: logData.success !== undefined ? logData.success : true,
        error: logData.error || null,
        details: logData.details || null
    };

    auditLogs.push(log);

    console.log(`[ChatAudit] Ação operador: ${log.id} - ${log.action} por ${log.operadorNome || log.operadorId}`);

    return log.id;
}

/**
 * Registra detecção de ambiguidade
 *
 * @param {Object} logData - Dados do log
 * @returns {string} - ID do log criado
 */
export function logAmbiguityDetection(logData) {
    const log = {
        id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        type: 'ambiguity_detection',
        telefone: logData.telefone,
        pendingCount: logData.pendingCount,
        pendingMessages: logData.pendingMessages || [],
        resolved: logData.resolved !== undefined ? logData.resolved : false,
        resolution: logData.resolution || null
    };

    auditLogs.push(log);

    // Atualiza métricas
    metrics.ambiguityDetected++;
    if (log.resolved) {
        metrics.ambiguityResolved++;
    }

    console.log(`[ChatAudit] Ambiguidade detectada: ${log.telefone} - ${log.pendingCount} mensagens pendentes`);

    return log.id;
}

/**
 * Registra evento de reagendamento
 *
 * @param {Object} logData - Dados do log
 * @returns {string} - ID do log criado
 */
export function logReagendamento(logData) {
    const log = {
        id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        type: 'reagendamento',
        telefone: logData.telefone,
        consultaOriginalId: logData.consultaOriginalId,
        novaConsultaId: logData.novaConsultaId || null,
        especialidade: logData.especialidade,
        pedidoTimestamp: logData.pedidoTimestamp || null,
        vinculadoTimestamp: logData.vinculadoTimestamp || null,
        vinculadoEm72h: logData.vinculadoEm72h !== undefined ? logData.vinculadoEm72h : null,
        operadorId: logData.operadorId || null,
        success: logData.success !== undefined ? logData.success : true
    };

    auditLogs.push(log);

    console.log(`[ChatAudit] Reagendamento registrado: ${log.consultaOriginalId} → ${log.novaConsultaId}`);

    return log.id;
}

/**
 * Atualiza métricas baseado no log
 *
 * @param {Object} log - Log recém criado
 */
function updateMetrics(log) {
    if (log.type !== 'inbound_message') {
        return;
    }

    metrics.totalMessages++;

    // Método de detecção
    if (log.method) {
        if (log.method === 'direct_number') {
            metrics.intentDetection.directNumber++;
        } else if (log.method === 'keyword' || log.method === 'keyword_low_confidence') {
            metrics.intentDetection.keyword++;
        } else if (log.method === 'nlp') {
            metrics.intentDetection.nlp++;
        } else if (log.method === 'fallback') {
            metrics.intentDetection.fallback++;
        }
    }

    // Confidence
    if (log.confidence !== null) {
        if (log.confidence >= 0.75) {
            metrics.confidence.high++;
        } else if (log.confidence >= 0.55) {
            metrics.confidence.medium++;
        } else {
            metrics.confidence.low++;
        }
    }

    // Ações
    if (log.action) {
        if (metrics.actions[log.action] !== undefined) {
            metrics.actions[log.action]++;
        }
    }

    // Respostas (intents específicos)
    if (log.intent) {
        if (metrics.responses[log.intent] !== undefined) {
            metrics.responses[log.intent]++;
        }
    }
}

/**
 * Obtém logs filtrados
 *
 * @param {Object} filters - Filtros
 * @returns {Array} - Logs filtrados
 */
export function getLogs(filters = {}) {
    let logs = [...auditLogs];

    // Filtro por tipo
    if (filters.type) {
        logs = logs.filter(log => log.type === filters.type);
    }

    // Filtro por telefone
    if (filters.telefone) {
        logs = logs.filter(log => log.telefone === filters.telefone);
    }

    // Filtro por consulta
    if (filters.consultaId) {
        logs = logs.filter(log => log.consultaId === filters.consultaId);
    }

    // Filtro por operador
    if (filters.operadorId) {
        logs = logs.filter(log => log.operadorId === filters.operadorId);
    }

    // Filtro por data (últimas N horas)
    if (filters.lastHours) {
        const cutoff = new Date(Date.now() - filters.lastHours * 60 * 60 * 1000);
        logs = logs.filter(log => new Date(log.timestamp) >= cutoff);
    }

    // Limite
    if (filters.limit) {
        logs = logs.slice(-filters.limit);
    }

    return logs;
}

/**
 * Obtém métricas
 *
 * @returns {Object} - Métricas calculadas
 */
export function getMetrics() {
    const total = metrics.totalMessages || 1; // Evita divisão por zero

    return {
        totalMessages: metrics.totalMessages,

        intentDetection: {
            ...metrics.intentDetection,
            percentages: {
                directNumber: ((metrics.intentDetection.directNumber / total) * 100).toFixed(2) + '%',
                keyword: ((metrics.intentDetection.keyword / total) * 100).toFixed(2) + '%',
                nlp: ((metrics.intentDetection.nlp / total) * 100).toFixed(2) + '%',
                fallback: ((metrics.intentDetection.fallback / total) * 100).toFixed(2) + '%'
            }
        },

        confidence: {
            ...metrics.confidence,
            percentages: {
                high: ((metrics.confidence.high / total) * 100).toFixed(2) + '%',
                medium: ((metrics.confidence.medium / total) * 100).toFixed(2) + '%',
                low: ((metrics.confidence.low / total) * 100).toFixed(2) + '%'
            }
        },

        actions: metrics.actions,
        responses: metrics.responses,

        ambiguity: {
            detected: metrics.ambiguityDetected,
            resolved: metrics.ambiguityResolved,
            resolutionRate: metrics.ambiguityDetected > 0
                ? ((metrics.ambiguityResolved / metrics.ambiguityDetected) * 100).toFixed(2) + '%'
                : '0%'
        },

        responseTime: {
            count: metrics.responseTimeMs.length,
            average: metrics.responseTimeMs.length > 0
                ? (metrics.responseTimeMs.reduce((a, b) => a + b, 0) / metrics.responseTimeMs.length).toFixed(2) + 'ms'
                : '0ms'
        }
    };
}

/**
 * Registra tempo de resposta
 *
 * @param {number} timeMs - Tempo em milissegundos
 */
export function recordResponseTime(timeMs) {
    metrics.responseTimeMs.push(timeMs);

    // Mantém apenas últimos 1000 registros
    if (metrics.responseTimeMs.length > 1000) {
        metrics.responseTimeMs.shift();
    }
}

/**
 * Limpa logs antigos (mais de 30 dias)
 * Mantém histórico de 30 dias conforme seção 15 do prompt
 */
export function cleanOldLogs() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const initialLength = auditLogs.length;

    // Remove logs antigos
    const filteredLogs = auditLogs.filter(log => {
        const logDate = new Date(log.timestamp);
        return logDate >= thirtyDaysAgo;
    });

    // Atualiza array
    auditLogs.length = 0;
    auditLogs.push(...filteredLogs);

    const removed = initialLength - auditLogs.length;

    if (removed > 0) {
        console.log(`[ChatAudit] ${removed} logs antigos removidos (> 30 dias)`);
    }

    return removed;
}

/**
 * Exporta logs para análise (JSON)
 *
 * @param {Object} filters - Filtros opcionais
 * @returns {string} - JSON string
 */
export function exportLogs(filters = {}) {
    const logs = getLogs(filters);

    return JSON.stringify({
        exportedAt: new Date().toISOString(),
        totalLogs: logs.length,
        filters: filters,
        logs: logs,
        metrics: getMetrics()
    }, null, 2);
}

/**
 * Reseta métricas (útil para testes)
 */
export function resetMetrics() {
    metrics.totalMessages = 0;
    metrics.intentDetection = {
        directNumber: 0,
        keyword: 0,
        nlp: 0,
        fallback: 0
    };
    metrics.confidence = {
        high: 0,
        medium: 0,
        low: 0
    };
    metrics.actions = {
        auto_process: 0,
        request_confirmation: 0,
        fallback: 0,
        ambiguity_clarification: 0,
        patient_initiated: 0,
        incompatible_intent: 0
    };
    metrics.responses = {
        confirmed: 0,
        declined: 0,
        not_scheduled: 0,
        reagendamento: 0,
        paciente_solicitou: 0,
        sem_reagendamento: 0
    };
    metrics.ambiguityDetected = 0;
    metrics.ambiguityResolved = 0;
    metrics.responseTimeMs = [];

    console.log('[ChatAudit] Métricas resetadas');
}

export default {
    logInboundMessage,
    logOutboundMessage,
    logOperatorAction,
    logAmbiguityDetection,
    logReagendamento,
    getLogs,
    getMetrics,
    recordResponseTime,
    cleanOldLogs,
    exportLogs,
    resetMetrics
};
