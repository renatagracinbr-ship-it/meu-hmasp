/**
 * Serviço de Fila de Mensagens WhatsApp com Proteção Anti-Banimento
 *
 * Implementa:
 * - Intervalo aleatório entre mensagens (45-120 segundos)
 * - Pausa de resfriamento a cada 20 mensagens (10-15 minutos)
 * - Simulação humana (status "digitando...")
 * - Variação de saudação
 */

import * as WhatsAppService from './whatsapp.service.js';

// Configurações de segurança
const CONFIG = {
    // Intervalo aleatório entre mensagens (em ms)
    MIN_INTERVAL: 45 * 1000,    // 45 segundos
    MAX_INTERVAL: 120 * 1000,   // 120 segundos

    // Pausa de resfriamento
    MENSAGENS_ANTES_PAUSA: 20,
    MIN_PAUSA: 10 * 60 * 1000,  // 10 minutos
    MAX_PAUSA: 15 * 60 * 1000,  // 15 minutos

    // Simulação de digitação
    MIN_TYPING_TIME: 3 * 1000,  // 3 segundos
    MAX_TYPING_TIME: 5 * 1000,  // 5 segundos
};

// Estado da fila
const state = {
    queue: [],
    processing: false,
    messagesSent: 0,
    lastMessageTime: null,
    stats: {
        totalEnviadas: 0,
        totalFalhas: 0,
        pausasRealizadas: 0
    }
};

// Variações de saudação
const SAUDACOES = [
    'Olá',
    'Oi'
];

/**
 * Adiciona mensagem à fila
 *
 * @param {Object} mensagem - Dados da mensagem
 * @returns {Promise<string>} - ID da mensagem na fila
 */
export async function addToQueue(mensagem) {
    const { chatId, texto, botoes, metadata } = mensagem;

    if (!chatId || !texto) {
        throw new Error('chatId e texto são obrigatórios');
    }

    const queueItem = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        chatId,
        texto: aplicarVariacaoSaudacao(texto),
        botoes: botoes || null,
        metadata: metadata || {},
        status: 'pending',
        tentativas: 0,
        adicionadoEm: new Date().toISOString(),
        erro: null
    };

    state.queue.push(queueItem);

    console.log(`[WhatsAppQueue] Mensagem adicionada à fila: ${queueItem.id} (${state.queue.length} na fila)`);

    // Inicia processamento se não estiver rodando
    if (!state.processing) {
        processQueue();
    }

    return queueItem.id;
}

/**
 * Aplica variação de saudação ao texto
 *
 * @param {string} texto - Texto original
 * @returns {string} - Texto com saudação variada
 */
function aplicarVariacaoSaudacao(texto) {
    // Detecta padrões de saudação e substitui
    const patterns = [
        /^Olá,/i,
        /^Oi,/i,
        /^Tudo bem\?/i,
        /^Bom dia,/i,
        /^Boa tarde,/i,
        /^Boa noite,/i
    ];

    // Escolhe saudação aleatória
    const saudacao = SAUDACOES[Math.floor(Math.random() * SAUDACOES.length)];

    // Substitui primeira ocorrência
    for (const pattern of patterns) {
        if (pattern.test(texto)) {
            return texto.replace(pattern, `${saudacao},`);
        }
    }

    return texto;
}

/**
 * Processa a fila de mensagens
 */
async function processQueue() {
    if (state.processing) {
        console.log('[WhatsAppQueue] Fila já está sendo processada');
        return;
    }

    state.processing = true;
    console.log('[WhatsAppQueue] Iniciando processamento da fila');

    while (state.queue.length > 0) {
        const item = state.queue[0];

        try {
            // Verifica se precisa fazer pausa de resfriamento
            if (state.messagesSent > 0 && state.messagesSent % CONFIG.MENSAGENS_ANTES_PAUSA === 0) {
                await pausaResfriamento();
            }

            // Aguarda intervalo aleatório
            if (state.lastMessageTime) {
                await intervaloAleatorio();
            }

            // Simula digitação
            await simulateTyping(item.chatId);

            // Envia mensagem
            const result = await sendMessage(item);

            if (result.success) {
                item.status = 'sent';
                item.messageId = result.messageId;
                item.enviadoEm = new Date().toISOString();

                state.messagesSent++;
                state.lastMessageTime = Date.now();
                state.stats.totalEnviadas++;

                console.log(`[WhatsAppQueue] Mensagem enviada: ${item.id}`);
            } else {
                throw new Error(result.error);
            }

        } catch (error) {
            console.error(`[WhatsAppQueue] Erro ao enviar mensagem ${item.id}:`, error);

            item.tentativas++;
            item.erro = error.message;

            // Retry logic (máximo 3 tentativas)
            if (item.tentativas < 3) {
                item.status = 'retry';
                console.log(`[WhatsAppQueue] Tentativa ${item.tentativas} falhou, tentando novamente...`);
                // Move para o final da fila
                state.queue.push(state.queue.shift());
                continue;
            } else {
                item.status = 'failed';
                state.stats.totalFalhas++;
                console.log(`[WhatsAppQueue] Mensagem ${item.id} falhou após ${item.tentativas} tentativas`);
            }
        }

        // Remove item da fila
        state.queue.shift();
    }

    state.processing = false;
    console.log('[WhatsAppQueue] Fila processada completamente');
}

/**
 * Aguarda intervalo aleatório entre mensagens
 */
async function intervaloAleatorio() {
    const intervalo = Math.floor(
        Math.random() * (CONFIG.MAX_INTERVAL - CONFIG.MIN_INTERVAL) + CONFIG.MIN_INTERVAL
    );

    const segundos = (intervalo / 1000).toFixed(0);
    console.log(`[WhatsAppQueue] Aguardando ${segundos}s antes da próxima mensagem...`);

    return new Promise(resolve => setTimeout(resolve, intervalo));
}

/**
 * Pausa de resfriamento
 */
async function pausaResfriamento() {
    const pausa = Math.floor(
        Math.random() * (CONFIG.MAX_PAUSA - CONFIG.MIN_PAUSA) + CONFIG.MIN_PAUSA
    );

    const minutos = (pausa / 60000).toFixed(1);
    console.log(`[WhatsAppQueue] 🛑 PAUSA DE RESFRIAMENTO: ${minutos} minutos (${state.messagesSent} mensagens enviadas)`);

    state.stats.pausasRealizadas++;

    return new Promise(resolve => setTimeout(resolve, pausa));
}

/**
 * Simula status de "digitando..."
 *
 * @param {string} chatId - ID do chat
 */
async function simulateTyping(chatId) {
    const typingTime = Math.floor(
        Math.random() * (CONFIG.MAX_TYPING_TIME - CONFIG.MIN_TYPING_TIME) + CONFIG.MIN_TYPING_TIME
    );

    console.log(`[WhatsAppQueue] 💬 Simulando digitação por ${(typingTime / 1000).toFixed(1)}s...`);

    try {
        // Envia estado de "composing" (digitando)
        await WhatsAppService.sendChatState(chatId, 'composing');

        // Aguarda tempo de digitação
        await new Promise(resolve => setTimeout(resolve, typingTime));

    } catch (error) {
        console.error('[WhatsAppQueue] Erro ao simular digitação:', error);
        // Continua mesmo se falhar
    }
}

/**
 * Envia mensagem via WhatsApp
 *
 * @param {Object} item - Item da fila
 * @returns {Promise<Object>} - Resultado do envio
 */
async function sendMessage(item) {
    try {
        const result = await WhatsAppService.sendMessage(
            item.chatId,
            item.texto,
            item.botoes,      // Passa os botões se existirem
            item.metadata     // CRÍTICO: Passa metadata para rastreamento de confirmações
        );

        return {
            success: true,
            messageId: result.messageId,
            timestamp: result.timestamp
        };

    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Obtém status da fila
 *
 * @returns {Object} - Status atual
 */
export function getQueueStatus() {
    return {
        queueLength: state.queue.length,
        processing: state.processing,
        messagesSent: state.messagesSent,
        stats: state.stats,
        nextItems: state.queue.slice(0, 5).map(item => ({
            id: item.id,
            chatId: item.chatId,
            status: item.status,
            tentativas: item.tentativas
        }))
    };
}

/**
 * Limpa a fila
 */
export function clearQueue() {
    const removidos = state.queue.length;
    state.queue = [];
    console.log(`[WhatsAppQueue] Fila limpa: ${removidos} mensagens removidas`);
    return removidos;
}

/**
 * Remove mensagem específica da fila
 *
 * @param {string} messageId - ID da mensagem
 * @returns {boolean} - true se removida
 */
export function removeFromQueue(messageId) {
    const index = state.queue.findIndex(item => item.id === messageId);

    if (index !== -1) {
        state.queue.splice(index, 1);
        console.log(`[WhatsAppQueue] Mensagem ${messageId} removida da fila`);
        return true;
    }

    return false;
}

/**
 * Obtém estatísticas
 *
 * @returns {Object} - Estatísticas detalhadas
 */
export function getStats() {
    return {
        ...state.stats,
        queueLength: state.queue.length,
        messagesSent: state.messagesSent,
        taxaSucesso: state.stats.totalEnviadas > 0
            ? ((state.stats.totalEnviadas / (state.stats.totalEnviadas + state.stats.totalFalhas)) * 100).toFixed(2) + '%'
            : '0%'
    };
}

/**
 * Reseta estatísticas
 */
export function resetStats() {
    state.stats = {
        totalEnviadas: 0,
        totalFalhas: 0,
        pausasRealizadas: 0
    };
    state.messagesSent = 0;
    console.log('[WhatsAppQueue] Estatísticas resetadas');
}

export default {
    addToQueue,
    getQueueStatus,
    clearQueue,
    removeFromQueue,
    getStats,
    resetStats
};
