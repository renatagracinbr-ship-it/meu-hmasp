/**
 * Chat Proprio Service - Meu HMASP
 *
 * ARQUITETURA:
 * - Mensagens armazenadas em SQLite local (chat.db)
 * - Substitui dependencia do WhatsApp
 * - Comunicacao entre operadores e pacientes via API REST
 */

import CONFIG from '../config/backend.config.js';
const BACKEND_URL = CONFIG.WHATSAPP_BACKEND; // Usa mesmo backend

// ============================================================================
// CONVERSAS
// ============================================================================

/**
 * Lista conversas ativas
 * @param {Object} options - Opcoes de filtro
 */
export async function getConversas(options = {}) {
    try {
        const { status = 'ativa', limit = 50, offset = 0 } = options;
        const params = new URLSearchParams({ status, limit, offset });

        const response = await fetch(`${BACKEND_URL}/api/chat-proprio/conversas?${params}`);
        const data = await response.json();

        if (!data.success) {
            console.warn('[ChatProprio] Erro ao listar conversas:', data.error);
            return [];
        }

        return data.conversas;
    } catch (error) {
        console.error('[ChatProprio] Erro ao buscar conversas:', error);
        return [];
    }
}

/**
 * Busca uma conversa por ID
 * @param {number} conversaId - ID da conversa
 */
export async function getConversa(conversaId) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/chat-proprio/conversas/${conversaId}`);
        const data = await response.json();

        if (!data.success) {
            console.warn('[ChatProprio] Conversa nao encontrada:', data.error);
            return null;
        }

        return data.conversa;
    } catch (error) {
        console.error('[ChatProprio] Erro ao buscar conversa:', error);
        return null;
    }
}

/**
 * Cria ou busca conversa para um paciente
 * @param {string} pacienteId - ID do paciente (prontuario)
 * @param {string} pacienteNome - Nome do paciente
 * @param {string} pacienteTelefone - Telefone (opcional)
 */
export async function getOrCreateConversa(pacienteId, pacienteNome = null, pacienteTelefone = null) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/chat-proprio/conversas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pacienteId, pacienteNome, pacienteTelefone })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error);
        }

        return data.conversa;
    } catch (error) {
        console.error('[ChatProprio] Erro ao criar conversa:', error);
        throw error;
    }
}

/**
 * Arquiva uma conversa
 * @param {number} conversaId - ID da conversa
 */
export async function arquivarConversa(conversaId) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/chat-proprio/conversas/${conversaId}/arquivar`, {
            method: 'POST'
        });

        const data = await response.json();
        return data.success;
    } catch (error) {
        console.error('[ChatProprio] Erro ao arquivar conversa:', error);
        throw error;
    }
}

// ============================================================================
// MENSAGENS
// ============================================================================

/**
 * Lista mensagens de uma conversa
 * @param {number} conversaId - ID da conversa
 * @param {Object} options - Opcoes de paginacao
 */
export async function getMensagens(conversaId, options = {}) {
    try {
        const { limit = 50, offset = 0, ordem = 'ASC' } = options;
        const params = new URLSearchParams({ limit, offset, ordem });

        const response = await fetch(`${BACKEND_URL}/api/chat-proprio/conversas/${conversaId}/mensagens?${params}`);
        const data = await response.json();

        if (!data.success) {
            console.warn('[ChatProprio] Erro ao listar mensagens:', data.error);
            return [];
        }

        return data.mensagens;
    } catch (error) {
        console.error('[ChatProprio] Erro ao buscar mensagens:', error);
        return [];
    }
}

/**
 * Busca mensagens recentes (para polling)
 * @param {number} conversaId - ID da conversa
 * @param {string} aposTimestamp - Buscar apos este timestamp
 */
export async function getMensagensRecentes(conversaId, aposTimestamp = null) {
    try {
        const params = aposTimestamp ? new URLSearchParams({ apos: aposTimestamp }) : '';
        const url = `${BACKEND_URL}/api/chat-proprio/conversas/${conversaId}/mensagens/recentes${params ? '?' + params : ''}`;

        const response = await fetch(url);
        const data = await response.json();

        if (!data.success) {
            return [];
        }

        return data.mensagens;
    } catch (error) {
        console.error('[ChatProprio] Erro ao buscar mensagens recentes:', error);
        return [];
    }
}

/**
 * Envia mensagem
 * @param {Object} dados - Dados da mensagem
 */
export async function enviarMensagem(dados) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/chat-proprio/mensagens`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error);
        }

        return data.mensagem;
    } catch (error) {
        console.error('[ChatProprio] Erro ao enviar mensagem:', error);
        throw error;
    }
}

/**
 * Marca mensagens como lidas
 * @param {number} conversaId - ID da conversa
 * @param {string} lidoPor - 'paciente' ou 'operador'
 */
export async function marcarComoLidas(conversaId, lidoPor = 'operador') {
    try {
        const response = await fetch(`${BACKEND_URL}/api/chat-proprio/conversas/${conversaId}/marcar-lidas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lidoPor })
        });

        const data = await response.json();
        return data.success;
    } catch (error) {
        console.error('[ChatProprio] Erro ao marcar como lidas:', error);
        return false;
    }
}

// ============================================================================
// OPERADORES
// ============================================================================

/**
 * Registra operador como online (ping)
 * @param {string} operadorId - ID do operador
 * @param {string} operadorNome - Nome do operador
 */
export async function pingOperador(operadorId, operadorNome) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/chat-proprio/operadores/ping`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operadorId, operadorNome })
        });

        const data = await response.json();
        return data.success;
    } catch (error) {
        console.error('[ChatProprio] Erro ao registrar operador:', error);
        return false;
    }
}

/**
 * Lista operadores online
 */
export async function getOperadoresOnline() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/chat-proprio/operadores/online`);
        const data = await response.json();

        if (!data.success) {
            return [];
        }

        return data.operadores;
    } catch (error) {
        console.error('[ChatProprio] Erro ao listar operadores:', error);
        return [];
    }
}

/**
 * Remove operador (offline)
 * @param {string} operadorId - ID do operador
 */
export async function operadorOffline(operadorId) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/chat-proprio/operadores/offline`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ operadorId })
        });

        const data = await response.json();
        return data.success;
    } catch (error) {
        console.error('[ChatProprio] Erro ao remover operador:', error);
        return false;
    }
}

// ============================================================================
// ESTATISTICAS
// ============================================================================

/**
 * Busca estatisticas do chat
 */
export async function getEstatisticas() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/chat-proprio/estatisticas`);
        const data = await response.json();

        if (!data.success) {
            return null;
        }

        return data.estatisticas;
    } catch (error) {
        console.error('[ChatProprio] Erro ao buscar estatisticas:', error);
        return null;
    }
}

/**
 * Conta mensagens nao lidas (para badge)
 */
export async function contarNaoLidas() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/chat-proprio/nao-lidas`);
        const data = await response.json();

        if (!data.success) {
            return 0;
        }

        return data.naoLidas;
    } catch (error) {
        console.error('[ChatProprio] Erro ao contar nao lidas:', error);
        return 0;
    }
}

// ============================================================================
// POLLING - Atualizacao periodica
// ============================================================================

let pollingInterval = null;
let mensagensPollingInterval = null;
let currentConversaId = null;
let lastMessageTimestamp = null;

/**
 * Inicia polling para atualizar lista de conversas
 * @param {Function} callback - Funcao chamada com as conversas
 * @param {number} intervalMs - Intervalo em ms (default: 5s)
 */
export function startConversasPolling(callback, intervalMs = 5000) {
    if (pollingInterval) {
        stopConversasPolling();
    }

    // Executa imediatamente
    getConversas().then(callback);

    pollingInterval = setInterval(async () => {
        try {
            const conversas = await getConversas();
            callback(conversas);
        } catch (error) {
            console.error('[ChatProprio] Erro no polling:', error);
        }
    }, intervalMs);
}

/**
 * Para o polling de conversas
 */
export function stopConversasPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}

/**
 * Inicia polling para mensagens de uma conversa especifica
 * @param {number} conversaId - ID da conversa
 * @param {Function} callback - Funcao chamada com novas mensagens
 * @param {number} intervalMs - Intervalo em ms (default: 2s)
 */
export function startMensagensPolling(conversaId, callback, intervalMs = 2000) {
    if (mensagensPollingInterval) {
        stopMensagensPolling();
    }

    currentConversaId = conversaId;
    lastMessageTimestamp = null;

    // Carrega mensagens iniciais
    getMensagens(conversaId).then(mensagens => {
        if (mensagens.length > 0) {
            lastMessageTimestamp = mensagens[mensagens.length - 1].created_at;
        }
        callback(mensagens, false); // false = nao e nova mensagem
    });

    mensagensPollingInterval = setInterval(async () => {
        try {
            const novasMensagens = await getMensagensRecentes(conversaId, lastMessageTimestamp);
            if (novasMensagens.length > 0) {
                lastMessageTimestamp = novasMensagens[novasMensagens.length - 1].created_at;
                callback(novasMensagens, true); // true = sao novas mensagens
            }
        } catch (error) {
            console.error('[ChatProprio] Erro no polling de mensagens:', error);
        }
    }, intervalMs);
}

/**
 * Para o polling de mensagens
 */
export function stopMensagensPolling() {
    if (mensagensPollingInterval) {
        clearInterval(mensagensPollingInterval);
        mensagensPollingInterval = null;
        currentConversaId = null;
        lastMessageTimestamp = null;
    }
}

// ============================================================================
// UTILIDADES
// ============================================================================

/**
 * Formata timestamp para exibicao
 * @param {string} timestamp - Timestamp ISO
 */
export function formatarDataHora(timestamp) {
    if (!timestamp) return '';

    const data = new Date(timestamp);
    const hoje = new Date();
    const ontem = new Date(hoje);
    ontem.setDate(ontem.getDate() - 1);

    const formatoHora = { hour: '2-digit', minute: '2-digit' };
    const hora = data.toLocaleTimeString('pt-BR', formatoHora);

    if (data.toDateString() === hoje.toDateString()) {
        return hora;
    } else if (data.toDateString() === ontem.toDateString()) {
        return `Ontem ${hora}`;
    } else {
        const formatoData = { day: '2-digit', month: '2-digit' };
        return `${data.toLocaleDateString('pt-BR', formatoData)} ${hora}`;
    }
}

/**
 * Gera iniciais do nome para avatar
 * @param {string} nome - Nome completo
 */
export function getIniciais(nome) {
    if (!nome) return '?';

    const partes = nome.trim().split(' ').filter(p => p.length > 0);
    if (partes.length === 0) return '?';
    if (partes.length === 1) return partes[0].charAt(0).toUpperCase();

    return (partes[0].charAt(0) + partes[partes.length - 1].charAt(0)).toUpperCase();
}
