/**
 * Push Notifications Service - Meu HMASP
 *
 * Gerencia o envio e recebimento de notificacoes push via Firebase Cloud Messaging (FCM)
 * Suporta:
 * - Notificacoes silenciosas (apenas badge, sem alerta)
 * - Notificacoes com alerta (som e banner)
 */

import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { firebaseConfig, VAPID_KEY, isFCMConfigured } from '../config/firebase.config.js';

// Estado do serviço
let messaging = null;
let fcmToken = null;
let isInitialized = false;

// Callback para quando receber notificação
let onNotificationCallback = null;

/**
 * Inicializa o Firebase Messaging
 * @returns {Promise<boolean>} - true se inicializado com sucesso
 */
export async function initPushNotifications() {
    try {
        // Verifica se o navegador suporta notificações
        if (!('Notification' in window)) {
            console.log('[Push] Navegador não suporta notificações');
            return false;
        }

        // Verifica se FCM é suportado
        const supported = await isSupported();
        if (!supported) {
            console.log('[Push] Firebase Messaging não é suportado neste navegador');
            return false;
        }

        // Verifica se VAPID está configurado
        if (!isFCMConfigured()) {
            console.log('[Push] VAPID_KEY não configurado. Push notifications desabilitadas.');
            return false;
        }

        // Inicializa o Firebase
        const app = initializeApp(firebaseConfig);
        messaging = getMessaging(app);

        console.log('[Push] Firebase Messaging inicializado');
        isInitialized = true;

        // Configura listener para mensagens em foreground
        onMessage(messaging, (payload) => {
            console.log('[Push] Mensagem recebida em foreground:', payload);
            handleForegroundMessage(payload);
        });

        return true;
    } catch (error) {
        console.error('[Push] Erro ao inicializar:', error);
        return false;
    }
}

/**
 * Solicita permissão para notificações e obtém o token FCM
 * @returns {Promise<string|null>} - Token FCM ou null se falhar
 */
export async function requestPermissionAndToken() {
    try {
        if (!isInitialized) {
            const init = await initPushNotifications();
            if (!init) return null;
        }

        // Solicita permissão
        const permission = await Notification.requestPermission();
        console.log('[Push] Permissão:', permission);

        if (permission !== 'granted') {
            console.log('[Push] Permissão negada');
            return null;
        }

        // Obtém o token
        const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });

        if (currentToken) {
            console.log('[Push] Token FCM obtido');
            fcmToken = currentToken;
            return currentToken;
        } else {
            console.log('[Push] Nenhum token disponível');
            return null;
        }
    } catch (error) {
        console.error('[Push] Erro ao obter token:', error);
        return null;
    }
}

/**
 * Registra o token FCM no backend
 * @param {string} token - Token FCM
 * @param {string} prontuario - Prontuário do paciente
 * @param {string} pacienteId - ID do paciente
 */
export async function registerTokenOnServer(token, prontuario, pacienteId) {
    try {
        const API_BASE = window.location.hostname === 'localhost'
            ? 'http://localhost:3000'
            : 'https://seu-backend.hmasp.com.br';

        const response = await fetch(`${API_BASE}/api/push/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token: token,
                prontuario: prontuario,
                pacienteId: pacienteId,
                platform: 'web',
                deviceInfo: {
                    userAgent: navigator.userAgent,
                    language: navigator.language,
                    platform: navigator.platform
                }
            })
        });

        const data = await response.json();

        if (data.success) {
            console.log('[Push] Token registrado no servidor');
            localStorage.setItem('meuHmasp_fcmToken', token);
            return true;
        } else {
            console.error('[Push] Erro ao registrar token:', data.error);
            return false;
        }
    } catch (error) {
        console.error('[Push] Erro ao registrar token no servidor:', error);
        return false;
    }
}

/**
 * Handler para mensagens recebidas em foreground
 * @param {Object} payload - Payload da notificação
 */
function handleForegroundMessage(payload) {
    const { notification, data } = payload;

    // Verifica se é notificação silenciosa (apenas badge)
    if (data && data.silent === 'true') {
        handleSilentNotification(data);
        return;
    }

    // Mostra notificação visível
    if (notification) {
        showNotification(notification.title, {
            body: notification.body,
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-72.png',
            tag: data?.tag || 'default',
            data: data
        });
    }

    // Chama callback se configurado
    if (onNotificationCallback) {
        onNotificationCallback(payload);
    }
}

/**
 * Handler para notificações silenciosas
 * Apenas atualiza badge/contador sem mostrar alerta
 * @param {Object} data - Dados da notificação
 */
function handleSilentNotification(data) {
    console.log('[Push] Notificação silenciosa recebida:', data);

    // Atualiza badge do chat se necessário
    if (data.type === 'chat_message') {
        updateChatBadge();
    }

    // Atualiza badge de consultas se necessário
    if (data.type === 'consulta_update') {
        updateConsultasBadge();
    }
}

/**
 * Mostra uma notificação ao usuário
 * @param {string} title - Título da notificação
 * @param {Object} options - Opções da notificação
 */
function showNotification(title, options = {}) {
    if (Notification.permission !== 'granted') {
        console.log('[Push] Permissão não concedida para notificações');
        return;
    }

    const notification = new Notification(title, {
        icon: options.icon || '/icons/icon-192.png',
        badge: options.badge || '/icons/icon-72.png',
        body: options.body || '',
        tag: options.tag || 'default',
        renotify: true,
        requireInteraction: options.requireInteraction || false,
        data: options.data || {}
    });

    // Handler de clique na notificação
    notification.onclick = (event) => {
        event.preventDefault();
        window.focus();

        // Navega para a tela apropriada
        if (options.data) {
            navigateToScreen(options.data);
        }

        notification.close();
    };
}

/**
 * Navega para a tela apropriada baseado nos dados da notificação
 * @param {Object} data - Dados da notificação
 */
function navigateToScreen(data) {
    if (data.screen === 'chat') {
        // Vai para aba de chat
        const chatTab = document.querySelector('[data-tab="chat"]');
        if (chatTab) chatTab.click();
    } else if (data.screen === 'consultas') {
        // Vai para aba de consultas
        const consultasTab = document.querySelector('[data-tab="consultas"]');
        if (consultasTab) consultasTab.click();
    }
}

/**
 * Atualiza o badge do chat (mensagens não lidas)
 */
function updateChatBadge() {
    const badge = document.getElementById('chat-badge');
    if (badge) {
        let count = parseInt(badge.textContent) || 0;
        count++;
        badge.textContent = count > 99 ? '99+' : count;
        badge.style.display = 'flex';
    }
}

/**
 * Atualiza o badge de consultas
 */
function updateConsultasBadge() {
    // Dispara evento para atualizar consultas
    window.dispatchEvent(new CustomEvent('consultas-update'));
}

/**
 * Define callback para quando receber notificação
 * @param {Function} callback - Função a ser chamada
 */
export function setOnNotificationCallback(callback) {
    onNotificationCallback = callback;
}

/**
 * Retorna o token FCM atual
 * @returns {string|null}
 */
export function getCurrentToken() {
    return fcmToken || localStorage.getItem('meuHmasp_fcmToken');
}

/**
 * Verifica se as notificações estão habilitadas
 * @returns {boolean}
 */
export function isNotificationsEnabled() {
    return Notification.permission === 'granted' && !!fcmToken;
}

/**
 * Remove o token (para logout)
 */
export async function removeToken() {
    try {
        const token = getCurrentToken();
        if (token) {
            const API_BASE = window.location.hostname === 'localhost'
                ? 'http://localhost:3000'
                : 'https://seu-backend.hmasp.com.br';

            await fetch(`${API_BASE}/api/push/unregister`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: token })
            });
        }

        fcmToken = null;
        localStorage.removeItem('meuHmasp_fcmToken');
        console.log('[Push] Token removido');
    } catch (error) {
        console.error('[Push] Erro ao remover token:', error);
    }
}

// Exporta estado
export const pushNotificationsState = {
    isInitialized: () => isInitialized,
    hasPermission: () => Notification.permission === 'granted'
};
