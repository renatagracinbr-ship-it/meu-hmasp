/**
 * Firebase Messaging Service Worker - Meu HMASP
 *
 * Processa notificações push em background
 */

// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Configuracao do Firebase (mesma do firebase.config.js)
const firebaseConfig = {
    apiKey: "AIzaSyCWQZfM_OIOFgTDIwoiuCIZisHZpywtgJs",
    authDomain: "meu-hmasp.firebaseapp.com",
    projectId: "meu-hmasp",
    storageBucket: "meu-hmasp.firebasestorage.app",
    messagingSenderId: "765044008220",
    appId: "1:765044008220:web:624f870a42a3582bab86d9"
};

// Inicializa Firebase
firebase.initializeApp(firebaseConfig);

// Inicializa Messaging
const messaging = firebase.messaging();

// Handler para mensagens em background
messaging.onBackgroundMessage((payload) => {
    console.log('[SW Push] Mensagem recebida em background:', payload);

    const { notification, data } = payload;

    // Verifica se é notificação silenciosa
    if (data && data.silent === 'true') {
        console.log('[SW Push] Notificação silenciosa - apenas atualiza badge');
        // Atualiza badge sem mostrar notificação
        updateBadge(data);
        return;
    }

    // Monta opções da notificação
    const notificationOptions = {
        body: notification?.body || data?.body || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-72.png',
        tag: data?.tag || 'meu-hmasp-notification',
        renotify: true,
        requireInteraction: data?.requireInteraction === 'true',
        data: data || {},
        actions: getNotificationActions(data)
    };

    // Mostra a notificação
    self.registration.showNotification(
        notification?.title || data?.title || 'Meu HMASP',
        notificationOptions
    );
});

// Retorna ações baseado no tipo de notificação
function getNotificationActions(data) {
    if (!data) return [];

    switch (data.type) {
        case 'marcacao':
        case 'lembrete72h':
            return [
                { action: 'confirmar', title: 'Confirmar' },
                { action: 'ver', title: 'Ver detalhes' }
            ];
        case 'desmarcacao':
            return [
                { action: 'reagendar', title: 'Reagendar' },
                { action: 'ver', title: 'Ver detalhes' }
            ];
        case 'chat_message':
            return [
                { action: 'responder', title: 'Responder' }
            ];
        default:
            return [];
    }
}

// Atualiza badge (contadores)
function updateBadge(data) {
    // Comunica com o cliente para atualizar badges
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clients) => {
            clients.forEach((client) => {
                client.postMessage({
                    type: 'BADGE_UPDATE',
                    data: data
                });
            });
        });
}

// Handler de clique na notificação
self.addEventListener('notificationclick', (event) => {
    console.log('[SW Push] Clique na notificação:', event);

    event.notification.close();

    const data = event.notification.data;
    let targetUrl = '/';

    // Define URL de destino baseado na ação ou tipo
    if (event.action === 'confirmar' || event.action === 'ver') {
        targetUrl = '/?tab=consultas';
    } else if (event.action === 'responder' || data?.type === 'chat_message') {
        targetUrl = '/?tab=chat';
    } else if (data?.screen) {
        targetUrl = `/?tab=${data.screen}`;
    }

    // Foca na janela existente ou abre nova
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clients) => {
                // Tenta encontrar janela já aberta
                for (const client of clients) {
                    if (client.url.includes(self.location.origin)) {
                        client.focus();
                        client.postMessage({
                            type: 'NOTIFICATION_CLICK',
                            action: event.action,
                            data: data
                        });
                        return;
                    }
                }
                // Abre nova janela se não encontrou
                return self.clients.openWindow(targetUrl);
            })
    );
});

// Handler para fechar notificação
self.addEventListener('notificationclose', (event) => {
    console.log('[SW Push] Notificação fechada');
});

console.log('[SW Push] Firebase Messaging Service Worker carregado');
