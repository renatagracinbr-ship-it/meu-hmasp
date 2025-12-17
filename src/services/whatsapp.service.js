/**
 * WhatsApp Service - HMASP Chat
 *
 * ARQUITETURA:
 * - Mensagens ficam armazenadas NO WHATSAPP (não em banco de dados)
 * - Backend WhatsApp em VM2 (DMZ/Internet - isolada da intranet)
 * - Comunicação via REST API sob demanda (polling otimizado)
 */

// Backend WhatsApp - Configuração dinâmica (local ou produção HMASP)
// Desenvolvimento: localhost:3000
// Produção HMASP: VM2 (DMZ/Internet - isolada da intranet)
import CONFIG from '../config/backend.config.js';
const BACKEND_URL = CONFIG.WHATSAPP_BACKEND;

// ============================================================================
// BACKEND API (chamadas sob demanda via REST)
// ============================================================================

/**
 * Verifica status do WhatsApp
 */
export async function getWhatsAppStatus() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/status`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('[WhatsApp] Erro ao verificar status:', error);
        return { isReady: false, hasQr: false };
    }
}

/**
 * Obtém QR Code para autenticação
 */
export async function getQRCode() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/qr`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('[WhatsApp] Erro ao obter QR Code:', error);
        throw error;
    }
}

/**
 * Reinicia WhatsApp e gera novo QR Code
 */
export async function resetWhatsApp() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/whatsapp/reset`, {
            method: 'POST'
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('[WhatsApp] Erro ao reiniciar WhatsApp:', error);
        throw error;
    }
}

/**
 * Busca lista de conversas (chats) direto do WhatsApp
 */
export async function getChats() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/chats`);
        const data = await response.json();

        if (!data.success) {
            // WhatsApp não está pronto ainda, retorna array vazio
            console.warn('[WhatsApp] WhatsApp não está conectado:', data.error);
            return [];
        }

        return data.chats;
    } catch (error) {
        console.error('[WhatsApp] Erro ao buscar chats:', error);
        // Retorna array vazio para não quebrar o polling
        return [];
    }
}

/**
 * Busca mensagens de uma conversa direto do WhatsApp
 */
export async function getMessages(chatId, limit = 50) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/messages/${chatId}?limit=${limit}`);
        const data = await response.json();

        if (!data.success) {
            console.warn('[WhatsApp] Erro ao buscar mensagens:', data.error);
            return [];
        }

        return data.messages;
    } catch (error) {
        console.error('[WhatsApp] Erro ao buscar mensagens:', error);
        return [];
    }
}

/**
 * Envia mensagem via WhatsApp (com suporte a botões e metadata)
 */
export async function sendMessage(to, message, buttons = null, metadata = null) {
    try {
        const payload = { to, message };

        // Adiciona botões se fornecidos
        if (buttons && buttons.length > 0) {
            payload.buttons = buttons;
        }

        // Adiciona metadata se fornecido (CRÍTICO para rastreamento de confirmações)
        if (metadata) {
            payload.metadata = metadata;
        }

        const response = await fetch(`${BACKEND_URL}/api/send`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error);
        }

        return data;
    } catch (error) {
        console.error('[WhatsApp] Erro ao enviar mensagem:', error);
        throw error;
    }
}

/**
 * Marca conversa como lida
 */
export async function markAsRead(chatId) {
    try {
        const response = await fetch(`${BACKEND_URL}/api/read/${chatId}`, {
            method: 'POST'
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('[WhatsApp] Erro ao marcar como lido:', error);
        throw error;
    }
}

/**
 * Envia estado do chat (composing = digitando, recording = gravando áudio, etc)
 */
export async function sendChatState(chatId, state) {
    try {
        // Por enquanto, apenas registra no log
        // WhatsApp Web.js suporta isso via chat.sendStateTyping() / chat.sendStateRecording()
        console.log(`[WhatsApp] Enviando estado "${state}" para ${chatId}`);

        // TODO: Implementar no backend se necessário
        // const response = await fetch(`${BACKEND_URL}/api/chat-state`, {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify({ chatId, state })
        // });

        return { success: true };
    } catch (error) {
        console.error('[WhatsApp] Erro ao enviar estado do chat:', error);
        // Não lança erro, apenas loga
        return { success: false };
    }
}

/**
 * Faz logout do WhatsApp
 */
export async function logout() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/logout`, {
            method: 'POST'
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('[WhatsApp] Erro ao fazer logout:', error);
        throw error;
    }
}

// ============================================================================
// POLLING - Alternativa leve ao WebSocket
// ============================================================================

let pollingInterval = null;

/**
 * Inicia polling para verificar novas mensagens
 * Mais leve que WebSocket, backend só fica ativo quando chamado
 */
export function startPolling(callback, intervalMs = 5000) {
    if (pollingInterval) {
        stopPolling();
    }

    pollingInterval = setInterval(async () => {
        try {
            const status = await getWhatsAppStatus();
            if (status.isReady) {
                const chats = await getChats();
                callback(chats);
            }
        } catch (error) {
            console.error('[Polling] Erro:', error);
        }
    }, intervalMs);
}

/**
 * Para o polling
 */
export function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}

// ============================================================================
// BACKUP NO GOOGLE DRIVE (GRÁTIS!)
// ============================================================================

/**
 * TODO: Implementar backup automático no Google Drive
 * Usando conta: centralderegulacaohmasp@gmail.com
 *
 * Estratégia:
 * 1. Exportar conversas periodicamente (1x/dia)
 * 2. Salvar como JSON no Google Drive
 * 3. Manter histórico de 30 dias
 * 4. Custo: R$ 0,00 (15GB grátis)
 */
export async function backupToGoogleDrive() {
    // TODO: Implementar usando Google Drive API
    console.log('[Backup] Funcionalidade será implementada');
}
