/**
 * HMASP Chat - Main Application
 * Frontend para Central de Regulação
 *
 * ARQUITETURA LOCAL HMASP:
 * - Frontend: Interface web (Vite)
 * - Backend WhatsApp: VM2 (DMZ/Internet - isolada)
 * - Backend AGHUse: VM3 (Intranet - acesso PostgreSQL)
 * - Autenticação: Sistema local (JSON) sem Firebase
 */

import CONFIG from './config/backend.config.js';
import { DateUtils } from './utils/dateUtils.js';
import { PhoneNormalizer } from './utils/phoneNormalizer.js';
import * as AuthClient from './auth-client.js';
import {
    getWhatsAppStatus,
    getQRCode,
    getMessages,
    sendMessage as sendWhatsAppMessage,
    markAsRead,
    logout as logoutWhatsApp,
    startPolling,
    stopPolling
} from './services/whatsapp.service.js';
import * as ConfirmacaoPresenca from './components/confirmacaoPresenca.js';
import * as DesmarcacaoConsultas from './components/desmarcacaoConsultas.js';
import * as ConfiguracaoMensagens from './components/configuracaoMensagens.js';
import * as ConsultasPaciente from './components/consultasPaciente.js';
import * as MonitoramentoGlobal from './services/monitoramentoGlobal.service.js';

// URL base da API
const API_BASE = CONFIG.WHATSAPP_BACKEND;

// Estado da aplicação
const appState = {
    whatsappReady: false,
    currentChat: null,
    conversations: new Map(),
    messages: new Map(),
    messagesCache: new Map(), // Cache de mensagens carregadas
    currentUser: null,
    userData: null,
    usuariosUnsubscribe: null,
    pollingActive: false,
    loadMessagesTimeout: null, // Timeout para debounce
    messagesLoadedCount: 20, // Quantas mensagens já foram carregadas
    loadingMoreMessages: false, // Flag para evitar múltiplas requisições
    profilePicCache: new Map(), // Cache de fotos de perfil {chatId: url}
    messagesPollingInterval: null, // Interval para polling de mensagens
    lastMessageTimestamp: null // Timestamp da última mensagem carregada
};

// Elementos do DOM
const elements = {
    // Auth screens
    loginScreen: document.getElementById('login-screen'),
    waitingScreen: document.getElementById('waiting-screen'),
    app: document.getElementById('app'),
    loginForm: document.getElementById('login-form'),
    loginUsername: document.getElementById('login-username'),
    loginPassword: document.getElementById('login-password'),
    logoutWaitingBtn: document.getElementById('logout-waiting-btn'),
    waitingUserInfo: document.getElementById('waiting-user-info'),

    // Tabs (suporta ambas as classes para compatibilidade)
    tabButtons: document.querySelectorAll('.tab-button, .nav-item'),
    tabContents: document.querySelectorAll('.tab-content'),

    // WhatsApp Status
    whatsappStatus: document.getElementById('whatsapp-status'),
    qrCode: document.getElementById('qr-code'),
    reconnectBtn: document.getElementById('reconnect-btn'),

    // Chat Interface
    chatInterface: document.getElementById('chat-interface'),
    noChatSelected: document.getElementById('no-chat-selected'),
    chatActive: document.getElementById('chat-active'),
    conversationsList: document.getElementById('conversations-list'),
    messagesList: document.getElementById('messages-list'),
    messageInput: document.getElementById('message-input'),
    sendBtn: document.getElementById('send-btn'),

    // Contact info
    contactName: document.getElementById('contact-name'),
    contactStatus: document.getElementById('contact-status'),
    contactAvatar: document.getElementById('contact-avatar'),

    // Buttons
    newChatBtn: document.getElementById('new-chat-btn'),
    searchChatsBtn: document.getElementById('search-chats-btn'),
    chatInfoBtn: document.getElementById('chat-info-btn'),

    // Search
    searchBox: document.getElementById('search-box'),
    searchInput: document.getElementById('search-input'),

    // Modal
    newChatModal: document.getElementById('new-chat-modal'),
    newChatNumber: document.getElementById('new-chat-number'),
    closeNewChat: document.getElementById('close-new-chat'),
    cancelNewChat: document.getElementById('cancel-new-chat'),
    confirmNewChat: document.getElementById('confirm-new-chat'),

    // Configurações - Sub-abas
    configTabBtns: document.querySelectorAll('.config-tab-btn'),
    configContents: document.querySelectorAll('.config-content'),

    // Configurações - Sistema
    currentUserEmail: document.getElementById('current-user-email'),
    systemLogoutBtn: document.getElementById('system-logout-btn'),
    logoutAccountBtn: document.getElementById('logout-account-btn'),
    navLogoutBtn: document.getElementById('nav-logout-btn'),
    clearCacheBtn: document.getElementById('clear-cache-btn'),
    exportDataBtn: document.getElementById('export-data-btn'),
    aboutBtn: document.getElementById('about-btn')
};

/**
 * Inicializa a aplicação
 */
async function init() {
    console.log('[App] Iniciando aplicação HMASP Chat...');

    // Mostra app diretamente (sem autenticação)
    showAppDirect();

    console.log('[App] Aplicação iniciada com sucesso');
}

/**
 * Verifica se há sessão existente ou auto-login
 */
async function checkExistingSession() {
    console.log('[Auth] ============================================');
    console.log('[Auth] Verificando sessão existente...');
    console.log('[Auth] ============================================');

    try {
        // 1. Tenta auto-login (VM)
        console.log('[Auth] Passo 1/3: Verificando auto-login...');
        const autoLoginUser = await AuthClient.checkAutoLogin();
        if (autoLoginUser) {
            console.log('[Auth] ✅ Auto-login bem-sucedido:', autoLoginUser);
            handleAuthStateChange({ user: autoLoginUser, userData: autoLoginUser });
            return;
        }
        console.log('[Auth] ℹ️  Auto-login não configurado ou não disponível');

        // 2. Verifica sessão salva no localStorage
        console.log('[Auth] Passo 2/3: Verificando sessão no localStorage...');
        const session = AuthClient.getSession();
        if (session && session.token) {
            console.log('[Auth] ℹ️  Sessão encontrada:', {
                username: session.user?.username,
                savedAt: session.savedAt
            });
            console.log('[Auth] Validando sessão com servidor...');

            const isValid = await AuthClient.validateSession();

            if (isValid) {
                console.log('[Auth] ✅ Sessão válida!');
                handleAuthStateChange({ user: session.user, userData: session.user });
                return;
            } else {
                console.log('[Auth] ❌ Sessão expirada, limpando...');
                AuthClient.clearSession();
            }
        } else {
            console.log('[Auth] ℹ️  Nenhuma sessão salva no localStorage');
        }

        // 3. Nenhuma sessão - mostra login
        console.log('[Auth] Passo 3/3: Mostrando tela de login');
        console.log('[Auth] ============================================');
        showLoginScreen();
    } catch (error) {
        console.error('[Auth] ❌ Erro ao verificar sessão:', error);
        showLoginScreen();
    }
}

/**
 * Configura o sistema de abas
 */
function setupTabs() {
    elements.tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabName = button.dataset.tab;
            switchTab(tabName);
        });
    });
}

/**
 * Troca de aba
 */
function switchTab(tabName) {
    // Remove active de todos
    elements.tabButtons.forEach(btn => btn.classList.remove('active'));
    elements.tabContents.forEach(content => content.classList.remove('active'));

    // Adiciona active no selecionado
    const activeButton = document.querySelector(`[data-tab="${tabName}"]`);
    const activeContent = document.getElementById(`${tabName}-tab`);

    if (activeButton && activeContent) {
        activeButton.classList.add('active');
        activeContent.classList.add('active');
    }

    // Salva aba ativa no localStorage
    localStorage.setItem('activeTab', tabName);

    // Se trocar para confirmação, inicializa componente
    if (tabName === 'confirmacao') {
        ConfirmacaoPresenca.init();
    }

    // Se trocar para desmarcação, inicializa componente
    if (tabName === 'desmarcacao') {
        DesmarcacaoConsultas.init();
    }

    // Se trocar para consultas do paciente, inicializa componente
    if (tabName === 'consultas-paciente') {
        ConsultasPaciente.init();
    }

    // Se trocar para configurações, ativa aba usuários por padrão
    if (tabName === 'config') {
        // Ativa primeira aba (usuários) e carrega dados
        const usuariosBtn = document.querySelector('.config-tab-btn[data-config-tab="usuarios"]');
        if (usuariosBtn && !usuariosBtn.classList.contains('active')) {
            usuariosBtn.click();
        }
    }
}

/**
 * Configura sub-abas de configuração
 */
function setupConfigTabs() {
    if (!elements.configTabBtns || elements.configTabBtns.length === 0) return;

    elements.configTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.configTab;

            // Remove active de todos
            elements.configTabBtns.forEach(b => b.classList.remove('active'));
            elements.configContents.forEach(c => c.classList.remove('active'));

            // Adiciona active no clicado
            btn.classList.add('active');
            const content = document.getElementById(`${tabName}-content`);
            if (content) {
                content.classList.add('active');
            }

            // Inicializa componente de mensagens se selecionado
            if (tabName === 'mensagens') {
                console.log('[Main] Inicializando componente de mensagens...');
                ConfiguracaoMensagens.init();
            }

            // Salva sub-aba ativa no localStorage
            localStorage.setItem('activeConfigTab', tabName);
        });
    });

    // Restaura sub-aba ativa (se estiver na aba config)
    const activeMainTab = localStorage.getItem('activeTab');
    const savedConfigTab = localStorage.getItem('activeConfigTab');

    if (activeMainTab === 'config' && savedConfigTab) {
        const savedBtn = document.querySelector(`.config-tab-btn[data-config-tab="${savedConfigTab}"]`);
        if (savedBtn) {
            savedBtn.click();
        }
    }
}

/**
 * Configura ações do sistema SEM autenticação
 */
function setupSystemActionsNoAuth() {
    // Limpar cache
    if (elements.clearCacheBtn) {
        elements.clearCacheBtn.addEventListener('click', () => {
            if (confirm('Deseja limpar o cache do navegador? Isso pode melhorar o desempenho.')) {
                localStorage.clear();
                sessionStorage.clear();
                alert('Cache limpo com sucesso! A página será recarregada.');
                window.location.reload();
            }
        });
    }

    // Exportar dados
    if (elements.exportDataBtn) {
        elements.exportDataBtn.addEventListener('click', () => {
            alert('Funcionalidade de exportação de dados será implementada em breve.');
        });
    }

    // Sobre
    if (elements.aboutBtn) {
        elements.aboutBtn.addEventListener('click', () => {
            alert('HMASP Chat v1.0.0\n\nSistema de Marcação de Consultas\nHospital Militar de Área de São Paulo\n\nArquitetura:\n- Frontend: Vite + JavaScript\n- Backend WhatsApp: Node.js + whatsapp-web.js\n- Backend AGHUse: Node.js + PostgreSQL\n- Banco de Dados: PostgreSQL (HMASP)');
        });
    }
}

/**
 * Configura ações do sistema COM autenticação - LEGADO
 */
function setupSystemActions() {
    // Logout (botão da aba Sistema)
    if (elements.systemLogoutBtn) {
        elements.systemLogoutBtn.addEventListener('click', async () => {
            const confirmLogout = confirm('Deseja realmente sair da sua conta?');
            if (confirmLogout) {
                try {
                    await AuthClient.logout();
                    location.reload();
                } catch (error) {
                    console.error('[Logout] Erro ao fazer logout:', error);
                    alert('Erro ao fazer logout: ' + error.message);
                }
            }
        });
    }

    // Logout (botão do header de Configurações)
    if (elements.logoutAccountBtn) {
        elements.logoutAccountBtn.addEventListener('click', async () => {
            const confirmLogout = confirm('Deseja realmente sair da sua conta?');
            if (confirmLogout) {
                try {
                    await AuthClient.logout();
                    location.reload();
                } catch (error) {
                    console.error('[Logout] Erro ao fazer logout:', error);
                    alert('Erro ao fazer logout: ' + error.message);
                }
            }
        });
    }

    // Logout (botão da barra de navegação principal)
    if (elements.navLogoutBtn) {
        elements.navLogoutBtn.addEventListener('click', async () => {
            const confirmLogout = confirm('Deseja realmente sair da sua conta?');
            if (confirmLogout) {
                try {
                    await AuthClient.logout();
                    location.reload();
                } catch (error) {
                    console.error('[Logout] Erro ao fazer logout:', error);
                    alert('Erro ao fazer logout: ' + error.message);
                }
            }
        });
    }

    // Limpar cache
    if (elements.clearCacheBtn) {
        elements.clearCacheBtn.addEventListener('click', () => {
            if (confirm('Deseja limpar o cache do navegador? Isso pode melhorar o desempenho.')) {
                localStorage.clear();
                sessionStorage.clear();
                alert('Cache limpo com sucesso! A página será recarregada.');
                window.location.reload();
            }
        });
    }

    // Exportar dados
    if (elements.exportDataBtn) {
        elements.exportDataBtn.addEventListener('click', () => {
            alert('Funcionalidade de exportação de dados será implementada em breve.');
        });
    }

    // Sobre
    if (elements.aboutBtn) {
        elements.aboutBtn.addEventListener('click', () => {
            alert('HMASP Chat v1.0.0\n\nSistema de Marcação de Consultas\nHospital Militar de Área de São Paulo\n\nArquitetura:\n- Frontend: Vite + JavaScript\n- Backend WhatsApp: Node.js + whatsapp-web.js\n- Backend AGHUse: Node.js + PostgreSQL\n- Banco de Dados: PostgreSQL (HMASP)');
        });
    }
}

/**
 * Conecta ao servidor via REST API (sem WebSocket)
 */
async function connectWhatsApp() {
    console.log('[WhatsApp] Verificando status...');

    try {
        // Verifica status do WhatsApp
        const status = await getWhatsAppStatus();

        if (status.isReady) {
            // WhatsApp já conectado
            console.log('[WhatsApp] Já conectado');
            appState.whatsappReady = true;
            showChatInterface();
            loadConversations();

            // Inicia polling para atualizações
            startPollingUpdates();
        } else if (status.hasQr) {
            // Precisa escanear QR Code
            console.log('[WhatsApp] Aguardando autenticação via QR Code');
            await loadQRCode();

            // Verifica status periodicamente até conectar
            checkConnectionStatus();
        } else {
            // Aguardando QR Code ser gerado
            console.log('[WhatsApp] Aguardando QR Code...');
            elements.qrCode.innerHTML = `
                <p>Aguardando QR Code...</p>
                <button onclick="requestNewQRCode()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #25D366; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    🔄 Gerar Novo QR Code
                </button>
            `;

            // Verifica novamente em 2 segundos
            setTimeout(connectWhatsApp, 2000);
        }
    } catch (error) {
        console.error('[WhatsApp] Erro ao conectar:', error);
        showConnectionError();
    }
}

/**
 * Carrega e exibe QR Code
 */
async function loadQRCode() {
    try {
        const data = await getQRCode();

        if (data.connected) {
            // Já conectado
            appState.whatsappReady = true;
            showChatInterface();
            loadConversations();
            startPollingUpdates();
        } else if (data.qr) {
            // Exibe QR Code
            displayQRCode(data.qr);
        }
    } catch (error) {
        console.error('[WhatsApp] Erro ao obter QR Code:', error);
        showAuthError(error.message);
    }
}

/**
 * Verifica status de conexão periodicamente
 */
async function checkConnectionStatus() {
    const checkInterval = setInterval(async () => {
        try {
            const status = await getWhatsAppStatus();

            if (status.isReady) {
                // Conectado!
                clearInterval(checkInterval);
                appState.whatsappReady = true;
                showChatInterface();
                loadConversations();
                startPollingUpdates();
            } else if (status.hasQr) {
                // Ainda aguardando scan
                await loadQRCode();
            }
        } catch (error) {
            console.error('[WhatsApp] Erro ao verificar status:', error);
        }
    }, 3000); // Verifica a cada 3 segundos
}


/**
 * Atualiza a lista de conversas com base nos dados do polling.
 * Adiciona novas conversas e move as atualizadas para o topo.
 */
function displayConversations(chats) {
    if (!chats || !Array.isArray(chats)) return;

    // Inverte os chats para processar do mais antigo para o mais novo,
    // garantindo que a ordem final na UI (prepend) seja a correta.
    chats.reverse().forEach(chat => {
        const chatId = chat.id._serialized || chat.id;
        const existingChatData = appState.conversations.get(chatId);

        const isNew = !existingChatData;
        
        // Considera uma atualização se a última mensagem mudou ou o contador de não lidas mudou.
        const hasUpdates = !isNew && (
            (chat.lastMessage?.id?._serialized || chat.lastMessage?.id) !== (existingChatData.lastMessage?.id?._serialized || existingChatData.lastMessage?.id) ||
            chat.unreadCount !== existingChatData.unreadCount
        );

        if (isNew || hasUpdates) {
            // Mescla dados novos com os existentes (se houver)
            const updatedChatData = { ...(existingChatData || {}), ...chat };
            
            // Garante que o chatId achatado esteja no objeto
            updatedChatData.chatId = chatId;

            // Atualiza o estado global da aplicação
            appState.conversations.set(chatId, updatedChatData);
            
            // Atualiza a UI, movendo a conversa para o topo
            updateConversationInList(updatedChatData);
        }
    });
}

/**
 * Inicia polling para atualizações de conversas
 */
function startPollingUpdates() {
    if (appState.pollingActive) return;

    console.log('[Polling] Iniciando polling de atualizações');
    appState.pollingActive = true;

    startPolling(async (chats) => {
        // Atualiza lista de conversas
        displayConversations(chats);

        // Se há um chat aberto, atualiza as mensagens em tempo real
        if (appState.currentChat) {
            // Limpa cache do chat atual para forçar reload das mensagens novas
            appState.messagesCache.delete(appState.currentChat);
            await loadMessages(appState.currentChat);
        }
    }, 5000); // Polling a cada 5 segundos
}

/**
 * Exibe o QR Code
 */
function displayQRCode(qrImageData) {
    elements.qrCode.innerHTML = `
        <img src="${qrImageData}" alt="QR Code WhatsApp" style="width: 256px; height: 256px;">
        <p style="margin-top: 1rem; color: #666;">Escaneie com seu WhatsApp</p>
    `;
}

/**
 * Mostra a interface do chat
 */
function showChatInterface() {
    elements.whatsappStatus.style.display = 'none';
    elements.chatInterface.style.display = 'flex';
}

/**
 * Mostra tela de desconectado
 */
function showDisconnected() {
    elements.chatInterface.style.display = 'none';
    elements.whatsappStatus.style.display = 'flex';
    elements.qrCode.innerHTML = '<p>WhatsApp desconectado</p>';
    elements.reconnectBtn.style.display = 'block';
}

/**
 * Mostra erro de autenticação
 */
function showAuthError(error) {
    elements.qrCode.innerHTML = `
        <p style="color: #d32f2f;">Erro de autenticação</p>
        <p style="color: #666; font-size: 0.9rem;">${error}</p>
    `;
    elements.reconnectBtn.style.display = 'block';
}

/**
 * Mostra erro de conexão
 */
function showConnectionError() {
    elements.qrCode.innerHTML = `
        <p style="color: #d32f2f;">Erro ao conectar ao servidor</p>
        <p style="color: #666; font-size: 0.9rem;">Verifique se o servidor está rodando</p>
        <button onclick="requestNewQRCode()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #25D366; color: white; border: none; border-radius: 4px; cursor: pointer;">
            🔄 Gerar Novo QR Code
        </button>
    `;
}

/**
 * Solicita novo QR Code (reinicia WhatsApp)
 */
window.requestNewQRCode = async function() {
    try {
        console.log('[WhatsApp] Solicitando reinicialização...');
        elements.qrCode.innerHTML = '<p>🔄 Reiniciando WhatsApp...</p>';

        const response = await fetch(`${API_BASE}/api/whatsapp/restart`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (data.success) {
            console.log('[WhatsApp] Reiniciado com sucesso');
            elements.qrCode.innerHTML = '<p>✅ Reiniciado! Aguardando QR Code...</p>';

            // Aguarda 2 segundos e tenta carregar o QR Code
            setTimeout(() => {
                connectWhatsApp();
            }, 2000);
        } else {
            throw new Error(data.error || 'Falha ao reiniciar');
        }
    } catch (error) {
        console.error('[WhatsApp] Erro ao reiniciar:', error);
        elements.qrCode.innerHTML = `
            <p style="color: #d32f2f;">❌ Erro ao reiniciar WhatsApp</p>
            <p style="color: #666; font-size: 0.9rem;">${error.message}</p>
            <button onclick="requestNewQRCode()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #25D366; color: white; border: none; border-radius: 4px; cursor: pointer;">
                🔄 Tentar Novamente
            </button>
        `;
    }
};

/**
 * Carrega conversas via REST API com paginação
 */
let conversationsState = {
    offset: 0,
    limit: 50,
    total: 0,
    loading: false,
    hasMore: true
};

async function loadConversations(append = false) {
    try {
        if (conversationsState.loading) return;
        conversationsState.loading = true;

        const response = await fetch(`${API_BASE}/api/chats?limit=${conversationsState.limit}&offset=${conversationsState.offset}`);
        const data = await response.json();

        if (data.success) {
            conversationsState.total = data.total;
            conversationsState.hasMore = data.hasMore;
            conversationsState.offset += data.chats.length;

            console.log(`[Chat] Conversas carregadas: ${data.chats.length} de ${data.total} (offset: ${conversationsState.offset})`);

            // SEMPRE adiciona as conversas (NUNCA limpa a lista)
            appendConversations(data.chats);

            // Configura scroll infinito apenas na primeira vez
            if (conversationsState.offset === data.chats.length) {
                setupInfiniteScroll();
            }
        }

        conversationsState.loading = false;
    } catch (error) {
        console.error('[Chat] Erro ao carregar conversas:', error);
        conversationsState.loading = false;
    }
}

/**
 * Limpa e exibe mensagem de lista vazia (não usado mais)
 */
function displayEmptyState() {
    elements.conversationsList.innerHTML = `
        <div style="padding: 2rem; text-align: center; color: #666;">
            <p>Nenhuma conversa encontrada</p>
            <p style="font-size: 0.85rem; margin-top: 0.5rem;">Inicie uma nova conversa</p>
        </div>
    `;
}

/**
 * Adiciona conversas à lista (sem limpar)
 */
function appendConversations(chats) {
    chats.forEach(chat => {
        // Extrai ID serializado (chat.id pode ser objeto ou string)
        const chatId = typeof chat.id === 'object' ? chat.id._serialized : chat.id;
        chat.chatId = chatId; // Salva ID como string

        // Evita duplicatas
        if (appState.conversations.has(chatId)) return;

        appState.conversations.set(chatId, chat);

        const conversationEl = createConversationElement(chat);
        elements.conversationsList.appendChild(conversationEl);
    });

    // Remove qualquer botão de "carregar mais" que possa existir
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) loadMoreBtn.remove();
}

/**
 * Configura scroll infinito
 */
function setupInfiniteScroll() {
    elements.conversationsList.addEventListener('scroll', () => {
        const { scrollTop, scrollHeight, clientHeight } = elements.conversationsList;

        // Se chegou perto do fim (100px antes)
        if (scrollHeight - scrollTop - clientHeight < 100 && conversationsState.hasMore && !conversationsState.loading) {
            loadConversations(true);
        }
    });
}

/**
 * Cria elemento de conversa
 */
function createConversationElement(chat) {
    const div = document.createElement('div');
    div.className = 'conversation-item';
    const chatId = chat.chatId || (typeof chat.id === 'object' ? chat.id._serialized : chat.id);
    div.dataset.chatId = chatId;

    // Extrai primeiro e último nome
    const name = getFormattedName(chat.name);
    const initials = getInitials(name);

    // Obtém preview da última mensagem
    let lastMessagePreview = 'Sem mensagens';
    if (chat.lastMessage) {
        // Debug: verifica estrutura da mensagem
        if (!chat.lastMessage.body && !chat.lastMessage.type) {
            console.log('[Chat] lastMessage sem body ou type:', chatId, chat.lastMessage);
        }

        if (chat.lastMessage.body) {
            lastMessagePreview = chat.lastMessage.body;
        } else if (chat.lastMessage.type === 'image') {
            lastMessagePreview = '📷 Imagem';
        } else if (chat.lastMessage.type === 'video') {
            lastMessagePreview = '🎥 Vídeo';
        } else if (chat.lastMessage.type === 'audio' || chat.lastMessage.type === 'ptt') {
            lastMessagePreview = '🎤 Áudio';
        } else if (chat.lastMessage.type === 'document') {
            lastMessagePreview = '📄 Documento';
        } else if (chat.lastMessage.type === 'sticker') {
            lastMessagePreview = '🎭 Figurinha';
        } else if (chat.lastMessage.hasMedia) {
            lastMessagePreview = '📎 Mídia';
        }
    }

    const time = chat.lastMessage ? DateUtils.formatRelative(new Date(chat.lastMessage.timestamp * 1000)) : '';

    div.innerHTML = `
        <div class="conversation-avatar" data-chat-id="${chatId}">
            <div class="avatar-initials">${initials}</div>
        </div>
        <div class="conversation-info">
            <div class="conversation-header">
                <span class="conversation-name">${name}</span>
                <span class="conversation-time">${time}</span>
            </div>
            <div class="conversation-preview">${lastMessagePreview}</div>
        </div>
        ${chat.unreadCount > 0 ? `<div class="unread-badge">${chat.unreadCount}</div>` : ''}
    `;

    div.addEventListener('click', () => openChat(chatId));

    // Carrega foto de perfil assincronamente
    loadProfilePicForChat(chatId, div.querySelector('.conversation-avatar'));

    return div;
}

/**
 * Carrega foto de perfil do WhatsApp para um chat
 */
async function loadProfilePicForChat(chatId, avatarElement) {
    if (!chatId || !avatarElement) return;

    // Verifica cache
    if (appState.profilePicCache.has(chatId)) {
        const picUrl = appState.profilePicCache.get(chatId);
        if (picUrl) {
            updateAvatarWithPhoto(avatarElement, picUrl);
        }
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/contact/${chatId}`);
        if (!response.ok) {
            appState.profilePicCache.set(chatId, null);
            return;
        }

        const data = await response.json();
        const picUrl = data.contactInfo?.profilePicUrl || null;

        // Armazena no cache
        appState.profilePicCache.set(chatId, picUrl);

        // Atualiza avatar com foto
        if (picUrl) {
            updateAvatarWithPhoto(avatarElement, picUrl);
        }
    } catch (error) {
        console.warn(`[Chat] Erro ao buscar foto de ${chatId}:`, error);
        appState.profilePicCache.set(chatId, null);
    }
}

/**
 * Atualiza elemento do avatar com foto de perfil
 */
function updateAvatarWithPhoto(avatarElement, picUrl) {
    if (!avatarElement || !picUrl) return;

    // Cria elemento de imagem
    const img = document.createElement('img');
    img.src = picUrl;
    img.alt = 'Foto de perfil';
    img.className = 'avatar-photo';

    // Quando carregar, substitui as iniciais pela foto
    img.onload = () => {
        avatarElement.innerHTML = '';
        avatarElement.appendChild(img);
    };

    // Se falhar, mantém as iniciais
    img.onerror = () => {
        console.warn('[Chat] Erro ao carregar imagem:', picUrl);
    };
}

/**
 * Retorna o nome completo sem truncamento
 */
function getFormattedName(fullName) {
    if (!fullName) return 'Desconhecido';
    return fullName.trim();
}

/**
 * Obtém iniciais do nome
 */
function getInitials(name) {
    const parts = name.split(' ').filter(p => p.length > 0);

    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();

    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Abre um chat
 */
function openChat(chatId) {
    console.log('[Chat] Abrindo conversa:', chatId);

    appState.currentChat = chatId;

    // Atualiza UI
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
    });

    const activeItem = document.querySelector(`[data-chat-id="${chatId}"]`);
    if (activeItem) {
        activeItem.classList.add('active');
    }

    // Carrega mensagens
    loadMessages(chatId);

    // Marca como lido
    markChatAsRead(chatId);

    // Mostra área de chat
    elements.noChatSelected.style.display = 'none';
    elements.chatActive.style.display = 'flex';

    // Atualiza header
    const chat = appState.conversations.get(chatId);
    if (chat) {
        const name = getFormattedName(chat.name);
        const initials = getInitials(name);

        elements.contactName.textContent = name;
        elements.contactAvatar.innerHTML = `<div class="avatar-initials">${initials}</div>`;
        elements.contactStatus.textContent = 'online';

        // Carrega foto de perfil do contato no header
        loadProfilePicForChat(chatId, elements.contactAvatar);
    }

    // Desabilita envio de mensagens se for grupo
    if (chatId.includes('@g.us')) {
        elements.messageInput.disabled = true;
        elements.sendBtn.disabled = true;
        elements.messageInput.placeholder = '🚫 Envio de mensagens para grupos está desabilitado';
        console.log('[Chat] Interface de envio desabilitada para grupo');
    } else {
        elements.messageInput.disabled = false;
        elements.sendBtn.disabled = false;
        elements.messageInput.placeholder = 'Digite uma mensagem...';
    }

    // Inicia polling de mensagens novas
    startMessagesPolling(chatId);
}

/**
 * Inicia polling automático de mensagens para o chat atual
 */
function startMessagesPolling(chatId) {
    // Para polling anterior se existir
    stopMessagesPolling();

    console.log('[Chat] 🔄 Iniciando polling de mensagens a cada 3 segundos');

    // Faz primeira verificação imediatamente após 500ms
    setTimeout(() => {
        if (appState.currentChat === chatId) {
            refreshMessages(chatId);
        }
    }, 500);

    // Polling a cada 3 segundos (balanceado entre responsividade e performance)
    appState.messagesPollingInterval = setInterval(async () => {
        // Verifica se ainda estamos no mesmo chat e não está carregando
        if (appState.currentChat === chatId && !appState.loadingMoreMessages) {
            // Só faz refresh se a aba estiver visível (economia de recursos)
            if (!document.hidden) {
                await refreshMessages(chatId);
            }
        }
    }, 3000);
}

/**
 * Para o polling de mensagens
 */
function stopMessagesPolling() {
    if (appState.messagesPollingInterval) {
        clearInterval(appState.messagesPollingInterval);
        appState.messagesPollingInterval = null;
        console.log('[Chat] Polling de mensagens parado');
    }
}

/**
 * Verifica se o scroll está próximo do final do container
 * @param {HTMLElement} container - O container de mensagens
 * @param {number} threshold - Margem de tolerância em pixels (padrão: 150px)
 * @returns {boolean}
 */
function isScrollNearBottom(container, threshold = 150) {
    if (!container) return true;
    const { scrollTop, scrollHeight, clientHeight } = container;
    return scrollHeight - scrollTop - clientHeight <= threshold;
}

/**
 * Atualiza mensagens sem resetar o scroll
 */
async function refreshMessages(chatId) {
    try {
        const messages = await getMessages(chatId, appState.messagesLoadedCount);

        // Verifica se há mensagens novas comparando com o cache
        const cachedMessages = appState.messagesCache.get(chatId) || [];

        // Verifica se quantidade ou última mensagem mudou
        const hasNewMessages = messages.length !== cachedMessages.length ||
                               (messages.length > 0 && cachedMessages.length > 0 &&
                                messages[messages.length - 1]?.id !== cachedMessages[cachedMessages.length - 1]?.id);

        if (hasNewMessages) {
            console.log('[Chat] 🔄 Novas mensagens detectadas, atualizando...', {
                antes: cachedMessages.length,
                depois: messages.length
            });

            // Salva posição do scroll ANTES de qualquer modificação
            const container = document.querySelector('.messages-container');
            const wasAtBottom = isScrollNearBottom(container, 150);
            const previousScrollTop = container ? container.scrollTop : 0;
            const previousScrollHeight = container ? container.scrollHeight : 0;

            // Atualiza cache
            appState.messagesCache.set(chatId, messages);

            // Renderiza mensagens (passa flag para não fazer scroll automático)
            displayMessages(messages, false, !wasAtBottom);

            // Mantém scroll no final se já estava, senão mantém posição
            if (wasAtBottom) {
                scrollToBottom(true);
            } else if (container) {
                // Mantém a posição relativa do scroll
                const newScrollHeight = container.scrollHeight;
                const heightDiff = newScrollHeight - previousScrollHeight;
                container.scrollTop = previousScrollTop + heightDiff;
            }
        }
    } catch (error) {
        console.error('[Chat] Erro ao atualizar mensagens:', error);
    }
}

// ============================================================================
// CONTROLE DE BOT AUTOMÁTICO
// ============================================================================

/**
 * Bot control - REMOVIDO
 * Não é mais necessário pois não há mensagens fora de contexto
 */

/**
 * Abre o painel de informações do contato
 */
function openContactInfo() {
    if (!appState.currentChat) {
        alert('Selecione uma conversa primeiro');
        return;
    }

    const chat = appState.conversations.get(appState.currentChat);
    if (!chat) {
        alert('Conversa não encontrada');
        return;
    }

    // Pega os elementos do painel
    const panel = document.getElementById('contact-info-panel');
    const photoEl = document.getElementById('info-contact-photo');
    const nameEl = document.getElementById('info-contact-name');
    const subtitleEl = document.getElementById('info-contact-subtitle');
    const phoneEl = document.getElementById('info-contact-phone');

    // Formata nome
    const name = getFormattedName(chat.name);
    const initials = getInitials(name);

    // Preenche foto (iniciais)
    photoEl.textContent = initials;

    // Preenche nome principal
    nameEl.textContent = name;

    // Preenche subtítulo (nome completo se houver pushname diferente)
    if (chat.pushname && chat.pushname !== chat.name) {
        subtitleEl.textContent = `~${chat.pushname}`;
    } else {
        subtitleEl.textContent = '';
    }

    // Formata e preenche telefone
    const chatIdStr = chat.id?._serialized || chat.id || '';

    // WhatsApp Business usa @lid - mostra o número da conta conectada
    if (chatIdStr.includes('@lid')) {
        phoneEl.textContent = '+55 11 97487-8525';
        phoneEl.title = 'Número da sua conta WhatsApp Business';
    } else if (chat.contactDetails && chat.contactDetails.number) {
        // Tem detalhes do contato
        const phoneNumber = chat.contactDetails.number;
        const formattedPhone = phoneNumber.replace(/^(\d{2})(\d{2})(\d{5})(\d{4})$/, '+$1 $2 $3-$4') || phoneNumber;
        phoneEl.textContent = formattedPhone;
        phoneEl.title = '';
    } else {
        // Fallback: extrai do ID @c.us
        const phoneNumber = chatIdStr.replace(/@c\.us$/, '');
        const formattedPhone = phoneNumber.replace(/^(\d{2})(\d{2})(\d{5})(\d{4})$/, '+$1 $2 $3-$4') || phoneNumber;
        phoneEl.textContent = formattedPhone;
        phoneEl.title = '';
    }

    // Abre o painel com animação
    panel.classList.add('open');
}

/**
 * Carrega mensagens de um chat via REST API (com cache e debounce)
 */
async function loadMessages(chatId, loadMore = false) {
    // Cancela chamada anterior se existir (debounce)
    if (appState.loadMessagesTimeout) {
        clearTimeout(appState.loadMessagesTimeout);
    }

    // Debounce de 100ms para evitar múltiplas chamadas rápidas (reduzido para melhor performance)
    appState.loadMessagesTimeout = setTimeout(async () => {
        try {
            // Se for carregar mais e já está carregando, ignora
            if (loadMore && appState.loadingMoreMessages) {
                return;
            }

            // Se não for loadMore, reseta contador e cache
            if (!loadMore) {
                appState.messagesLoadedCount = 20;
                appState.messagesCache.delete(chatId);
            }

            // Verifica se já tem no cache e não é para carregar mais
            if (appState.messagesCache.has(chatId) && !loadMore) {
                console.log('[Chat] Mensagens do cache:', appState.messagesCache.get(chatId).length);
                displayMessages(appState.messagesCache.get(chatId));
                setupMessagesScroll();
                return;
            }

            // Se for loadMore, aumenta o limite
            if (loadMore) {
                appState.loadingMoreMessages = true;
                appState.messagesLoadedCount += 20;
            }

            const messages = await getMessages(chatId, appState.messagesLoadedCount);
            console.log('[Chat] Mensagens carregadas:', messages.length, '(total solicitado:', appState.messagesLoadedCount + ')');

            // Salva no cache
            appState.messagesCache.set(chatId, messages);

            displayMessages(messages, loadMore);

            // Configura scroll infinito
            if (!loadMore) {
                setupMessagesScroll();
            }

            appState.loadingMoreMessages = false;
        } catch (error) {
            console.error('[Chat] Erro ao carregar mensagens:', error);
            appState.loadingMoreMessages = false;
        }
    }, 100); // Reduzido de 300ms para 100ms
}

/**
 * Exibe mensagens
 * @param {Array} messages - Array de mensagens a exibir
 * @param {boolean} isLoadingMore - Se está carregando mensagens antigas (scroll para cima)
 * @param {boolean} skipAutoScroll - Se deve pular o scroll automático
 */
function displayMessages(messages, isLoadingMore = false, skipAutoScroll = false) {
    const container = document.querySelector('.messages-container');

    // Se for loadMore, salva altura atual para manter posição
    let previousHeight = 0;
    let previousScrollTop = 0;
    if (isLoadingMore && container) {
        previousHeight = container.scrollHeight;
        previousScrollTop = container.scrollTop;
    }

    // Salva se estava no final (só para carregamento inicial, não para refresh)
    const wasAtBottom = !skipAutoScroll && container && isScrollNearBottom(container, 150);

    elements.messagesList.innerHTML = '';

    if (!messages || messages.length === 0) {
        // Mensagem informativa quando não há mensagens
        elements.messagesList.innerHTML = `
            <div style="text-align: center; padding: 2rem; color: rgba(0,0,0,0.45);">
                <p style="margin-bottom: 0.5rem;">Nenhuma mensagem ainda</p>
                <p style="font-size: 0.85rem;">Digite uma mensagem abaixo para começar a conversa</p>
            </div>
        `;
        return;
    }

    messages.forEach(msg => {
        const messageEl = createMessageElement(msg);
        elements.messagesList.appendChild(messageEl);
    });

    // Ajusta scroll após carregar
    if (isLoadingMore && container) {
        // Mantém posição relativa após adicionar mensagens antigas (scroll para cima)
        const newHeight = container.scrollHeight;
        const heightDiff = newHeight - previousHeight;
        container.scrollTop = previousScrollTop + heightDiff;
    } else if (skipAutoScroll) {
        // Não faz nada - scroll será controlado externamente
    } else if (wasAtBottom) {
        // Só faz scroll automático se já estava no final
        scrollToBottom(true);
    }
}

/**
 * Configura scroll infinito para mensagens
 */
function setupMessagesScroll() {
    const container = document.querySelector('.messages-container');
    if (!container) return;

    // Remove listener anterior se existir
    container.removeEventListener('scroll', handleMessagesScrollThrottled);

    // Adiciona novo listener com throttle
    container.addEventListener('scroll', handleMessagesScrollThrottled, { passive: true });
}

// Variável para controle de throttle do scroll
let scrollThrottleTimeout = null;

/**
 * Handler do scroll de mensagens com throttle para melhor performance
 */
function handleMessagesScrollThrottled() {
    // Throttle de 150ms para evitar muitas chamadas
    if (scrollThrottleTimeout) return;

    scrollThrottleTimeout = setTimeout(() => {
        scrollThrottleTimeout = null;
        handleMessagesScroll();
    }, 150);
}

/**
 * Handler real do scroll de mensagens
 */
function handleMessagesScroll() {
    const container = document.querySelector('.messages-container');
    if (!container || !appState.currentChat) return;

    // Detecta se rolou para o topo (dentro de 80px do topo)
    if (container.scrollTop < 80 && !appState.loadingMoreMessages) {
        console.log('[Chat] Carregando mais mensagens antigas...');
        loadMessages(appState.currentChat, true);
    }
}

/**
 * Cria elemento de mensagem
 */
function createMessageElement(msg) {
    const div = document.createElement('div');
    div.className = `message ${msg.fromMe ? 'sent' : 'received'}`;

    const time = DateUtils.formatTime(new Date(msg.timestamp * 1000));

    // Status de leitura (apenas mensagens enviadas)
    let statusIcon = '';
    if (msg.fromMe) {
        switch (msg.ack) {
            case 1: statusIcon = '✓'; break; // Enviado
            case 2: statusIcon = '✓✓'; break; // Entregue
            case 3: statusIcon = '<span style="color: #0cb7f2;">✓✓</span>'; break; // Lido
            default: statusIcon = '⏱'; // Pendente
        }
    }

    // Conteúdo da mensagem (texto ou mídia)
    let messageContent = '';

    if (msg.hasMedia) {
        // Mensagem com mídia - Ignorando imagens (não são importantes para respostas automáticas)
        const messageId = msg.id._serialized || msg.id.id || msg.id;
        const chatId = appState.currentChat;
        const mediaUrl = `/api/media/${chatId}/${messageId}`;

        switch (msg.type) {
            case 'image':
                // Exibe imagem como miniatura clicável
                messageContent = `
                    <div class="media-message image-message">
                        <img src="${mediaUrl}"
                             alt="Imagem"
                             class="message-image"
                             loading="lazy"
                             onclick="openImageViewer('${mediaUrl}')"
                             style="max-width: 300px; max-height: 300px; border-radius: 8px; cursor: pointer; display: block;"
                             onerror="this.onerror=null; this.style.display='none'; this.parentElement.innerHTML='<div style=\\'padding: 20px; text-align: center; background: rgba(0,0,0,0.05); border-radius: 8px;\\'><div style=\\'font-size: 40px;\\'>📷</div><div style=\\'font-size: 12px; color: #999; margin-top: 5px;\\'>Imagem não disponível</div></div>';">
                        ${msg.body ? `<div class="media-caption" style="margin-top: 8px; font-size: 0.9em;">${escapeHtml(msg.body)}</div>` : ''}
                    </div>
                `;
                break;

            case 'video':
                // Não exibe vídeos, apenas indicador
                messageContent = `
                    <div class="media-message">
                        <div style="padding: 8px; background: #f0f0f0; border-radius: 8px; color: #666; font-size: 0.9em;">
                            🎬 Vídeo (mídia ignorada)
                        </div>
                        ${msg.body ? `<div class="media-caption">${escapeHtml(msg.body)}</div>` : ''}
                    </div>
                `;
                break;

            case 'audio':
            case 'ptt': // Push-to-talk (áudio de voz)
                // Não exibe áudios, apenas indicador
                messageContent = `
                    <div class="media-message">
                        <div style="padding: 8px; background: #f0f0f0; border-radius: 8px; color: #666; font-size: 0.9em;">
                            🎵 Áudio (mídia ignorada)
                        </div>
                        ${msg.body ? `<div class="media-caption">${escapeHtml(msg.body)}</div>` : ''}
                    </div>
                `;
                break;

            case 'document':
                const fileName = msg.body || 'Documento';
                messageContent = `
                    <div class="media-message">
                        <a href="${mediaUrl}" download="${fileName}" style="display: flex; align-items: center; gap: 10px; color: inherit; text-decoration: none; padding: 10px; background: rgba(0,0,0,0.05); border-radius: 8px;">
                            📄 <span>${escapeHtml(fileName)}</span>
                        </a>
                    </div>
                `;
                break;

            case 'sticker':
                messageContent = `
                    <div class="media-message">
                        <img src="${mediaUrl}" alt="Sticker"
                             style="max-width: 150px; max-height: 150px; background: transparent;"
                             onerror="this.onerror=null; this.parentElement.innerHTML='<div style=\\'padding: 20px; text-align: center; background: rgba(0,0,0,0.05); border-radius: 8px;\\'><div style=\\'font-size: 40px;\\'>🎭</div><div style=\\'font-size: 12px; color: #999; margin-top: 5px;\\'>Sticker</div></div>';">
                    </div>
                `;
                break;

            default:
                // Tipo de mídia desconhecido
                messageContent = `
                    <div class="media-message">
                        <a href="${mediaUrl}" download style="display: flex; align-items: center; gap: 10px;">
                            📎 <span>Baixar mídia (${msg.type})</span>
                        </a>
                        ${msg.body ? `<div class="media-caption">${escapeHtml(msg.body)}</div>` : ''}
                    </div>
                `;
        }
    } else {
        // Mensagem de texto simples
        messageContent = `<div class="message-text">${escapeHtml(msg.body)}</div>`;
    }

    div.innerHTML = `
        <div class="message-bubble">
            ${messageContent}
            <div class="message-time">
                ${time}
                ${msg.fromMe ? `<span class="message-status">${statusIcon}</span>` : ''}
            </div>
        </div>
    `;

    return div;
}

/**
 * Escapa HTML para prevenir XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Marca chat como lido via REST API
 */
async function markChatAsRead(chatId) {
    try {
        await markAsRead(chatId);
    } catch (error) {
        console.error('[Chat] Erro ao marcar como lido:', error);
    }
}

/**
 * Abre visualizador de imagem em modal
 */
window.openImageViewer = function(imageUrl) {
    // Cria modal se não existir
    let modal = document.getElementById('image-viewer-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'image-viewer-modal';
        modal.style.cssText = `
            display: none;
            position: fixed;
            z-index: 9999;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.9);
            justify-content: center;
            align-items: center;
        `;

        modal.innerHTML = `
            <div style="position: relative; max-width: 90%; max-height: 90%; display: flex; flex-direction: column; align-items: center;">
                <button id="close-image-viewer" style="
                    position: absolute;
                    top: -40px;
                    right: 0;
                    background: transparent;
                    border: none;
                    color: white;
                    font-size: 40px;
                    cursor: pointer;
                    padding: 0;
                    width: 40px;
                    height: 40px;
                    line-height: 40px;
                ">&times;</button>
                <img id="viewer-image" src="" style="max-width: 100%; max-height: 90vh; border-radius: 8px;">
                <a id="download-image" href="" download style="
                    margin-top: 20px;
                    padding: 10px 20px;
                    background: #00a884;
                    color: white;
                    text-decoration: none;
                    border-radius: 8px;
                    font-weight: 500;
                ">📥 Baixar imagem</a>
            </div>
        `;

        document.body.appendChild(modal);

        // Fecha ao clicar no X
        document.getElementById('close-image-viewer').addEventListener('click', () => {
            modal.style.display = 'none';
        });

        // Fecha ao clicar fora da imagem
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });

        // Fecha com tecla ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display === 'flex') {
                modal.style.display = 'none';
            }
        });
    }

    // Atualiza imagem e link de download
    const img = document.getElementById('viewer-image');
    const downloadLink = document.getElementById('download-image');
    img.src = imageUrl;
    downloadLink.href = imageUrl;

    // Mostra modal
    modal.style.display = 'flex';
}

/**
 * Envia mensagem via REST API
 */
async function sendMessage() {
    const message = elements.messageInput.value.trim();

    if (!message || !appState.currentChat) return;

    if (!appState.whatsappReady) {
        alert('WhatsApp não está conectado');
        return;
    }

    // Bloqueia envio para grupos
    if (appState.currentChat.includes('@g.us')) {
        alert('Não é permitido enviar mensagens para grupos');
        console.log('[Chat] ❌ Tentativa de enviar mensagem para grupo bloqueada');
        return;
    }

    console.log('[Chat] Enviando mensagem:', message);

    try {
        const response = await sendWhatsAppMessage(appState.currentChat, message);

        console.log('[Chat] Mensagem enviada com sucesso');

        // Adiciona mensagem à interface
        const messageData = {
            id: response.messageId,
            body: message,
            timestamp: response.timestamp,
            fromMe: true,
            type: 'chat',
            hasMedia: false,
            ack: 1
        };

        const messageEl = createMessageElement(messageData);
        elements.messagesList.appendChild(messageEl);
        scrollToBottom();

        // Atualiza a última mensagem da conversa localmente
        const chatData = appState.conversations.get(appState.currentChat);
        if (chatData) {
            chatData.lastMessage = {
                body: message,
                timestamp: response.timestamp,
                fromMe: true
            };
            chatData.timestamp = response.timestamp;
            updateConversationInList(chatData);
        }

        // Limpa cache de mensagens para forçar recarga na próxima vez
        appState.messagesCache.delete(appState.currentChat);

        // Limpa input
        elements.messageInput.value = '';
        elements.messageInput.style.height = 'auto';
    } catch (error) {
        console.error('[Chat] Erro ao enviar mensagem:', error);
        alert('Erro ao enviar mensagem: ' + error.message);
    }
}


/**
 * Atualiza uma conversa específica na lista
 */
function updateConversationInList(chatData) {
    // Normaliza o ID para garantir que seja uma string
    const chatId = chatData.chatId || (typeof chatData.id === 'object' ? chatData.id._serialized : chatData.id);
    chatData.chatId = chatId; // Garante que o objeto tenha o ID achatado

    // Remove conversa antiga da lista
    const oldElement = document.querySelector(`[data-chat-id="${chatId}"]`);
    if (oldElement) {
        oldElement.remove();
    }

    // Recria o elemento com dados atualizados
    const newElement = createConversationElement(chatData);

    // Insere no topo da lista (mensagem mais recente)
    const firstChild = elements.conversationsList.firstChild;
    if (firstChild) {
        elements.conversationsList.insertBefore(newElement, firstChild);
    } else {
        elements.conversationsList.appendChild(newElement);
    }
}

/**
 * Scroll para o final das mensagens
 * @param {boolean} smooth - Se deve usar animação suave (padrão: true)
 */
function scrollToBottom(smooth = true) {
    const container = document.querySelector('.messages-container');
    if (container) {
        if (smooth) {
            container.scrollTo({
                top: container.scrollHeight,
                behavior: 'smooth'
            });
        } else {
            container.scrollTop = container.scrollHeight;
        }
    }
}

/**
 * Reseta o timer de inatividade
 * DESABILITADO: Funcionalidade de mensagem automática de inatividade removida
 */
function resetInactivityTimer() {
    // Funcionalidade desabilitada
    // Não faz nada
}

/**
 * Trata inatividade
 * DESABILITADO: Funcionalidade de mensagem automática de inatividade removida
 */
async function handleInactivity() {
    // Funcionalidade desabilitada
    // Não faz nada
}

/**
 * Fecha o chat atual
 */
function closeChat() {
    appState.currentChat = null;

    elements.noChatSelected.style.display = 'flex';
    elements.chatActive.style.display = 'none';

    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
    });
}

/**
 * Filtra conversas pelo termo de busca
 */
function filterConversations(searchTerm) {
    const term = searchTerm.toLowerCase().trim();
    const conversationItems = document.querySelectorAll('.conversation-item');

    conversationItems.forEach(item => {
        const name = item.querySelector('.conversation-name')?.textContent.toLowerCase() || '';
        const preview = item.querySelector('.conversation-preview')?.textContent.toLowerCase() || '';

        if (name.includes(term) || preview.includes(term)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

/**
 * Configura event listeners
 */
function setupEventListeners() {
    // Botão de enviar
    elements.sendBtn.addEventListener('click', sendMessage);

    // Enter para enviar, Shift+Enter para nova linha
    elements.messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Auto-resize do textarea
    elements.messageInput.addEventListener('input', (e) => {
        e.target.style.height = 'auto';
        e.target.style.height = e.target.scrollHeight + 'px';
    });

    // Botão de reconectar
    elements.reconnectBtn.addEventListener('click', () => {
        console.log('[WhatsApp] Reconectando...');
        elements.reconnectBtn.style.display = 'none';
        elements.qrCode.innerHTML = '<p>Reconectando...</p>';
        connectWhatsApp();
    });

    // Botão de nova conversa
    elements.newChatBtn.addEventListener('click', () => {
        elements.newChatModal.style.display = 'flex';
        elements.newChatNumber.value = '';
        elements.newChatNumber.focus();
    });

    // Fechar modal de nova conversa
    elements.closeNewChat.addEventListener('click', () => {
        elements.newChatModal.style.display = 'none';
    });

    elements.cancelNewChat.addEventListener('click', () => {
        elements.newChatModal.style.display = 'none';
    });

    // Confirmar nova conversa
    elements.confirmNewChat.addEventListener('click', () => {
        const number = elements.newChatNumber.value.trim();
        if (!number) {
            alert('Digite um número válido');
            return;
        }

        // Remove caracteres não numéricos
        const cleanNumber = number.replace(/\D/g, '');

        // Valida tamanho (DDD + 8 ou 9 dígitos)
        if (cleanNumber.length < 10 || cleanNumber.length > 11) {
            alert('Número inválido. Digite DDD + número (ex: 11999887766)');
            return;
        }

        // Adiciona código do Brasil (+55) automaticamente
        const fullNumber = `55${cleanNumber}`;

        // Formato WhatsApp: número@c.us
        const chatId = `${fullNumber}@c.us`;

        // Fecha o modal
        elements.newChatModal.style.display = 'none';

        // Abre o chat
        openChat(chatId);
    });

    // Fechar modal ao clicar fora
    elements.newChatModal.addEventListener('click', (e) => {
        if (e.target === elements.newChatModal) {
            elements.newChatModal.style.display = 'none';
        }
    });

    // Enter para confirmar no modal
    elements.newChatNumber.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            elements.confirmNewChat.click();
        }
    });

    // Botão de pesquisar - toggle
    elements.searchChatsBtn.addEventListener('click', () => {
        const isVisible = elements.searchBox.style.display !== 'none';
        elements.searchBox.style.display = isVisible ? 'none' : 'block';

        if (!isVisible) {
            elements.searchInput.focus();
        } else {
            elements.searchInput.value = '';
            filterConversations('');
        }
    });

    // Pesquisar conversas
    elements.searchInput.addEventListener('input', (e) => {
        filterConversations(e.target.value);
    });

    // Botão de info do contato
    elements.chatInfoBtn.addEventListener('click', () => {
        openContactInfo();
    });

    // Botão de fechar painel de info
    const closeInfoBtn = document.getElementById('close-info-btn');
    const contactInfoPanel = document.getElementById('contact-info-panel');

    if (closeInfoBtn) {
        closeInfoBtn.addEventListener('click', () => {
            contactInfoPanel.classList.remove('open');
        });
    }

    // Fechar painel ao clicar fora dele
    document.addEventListener('click', (e) => {
        // Se o painel está aberto E o clique foi fora do painel E não foi no botão de info
        if (contactInfoPanel.classList.contains('open')) {
            const clickedInsidePanel = contactInfoPanel.contains(e.target);
            const clickedInfoButton = elements.chatInfoBtn.contains(e.target);

            if (!clickedInsidePanel && !clickedInfoButton) {
                contactInfoPanel.classList.remove('open');
            }
        }
    });
}

/**
 * Configura listeners de autenticação
 */
function setupAuthListeners() {
    // Botão de limpar cache na tela de login
    const clearCacheBtn = document.getElementById('clear-cache-login');
    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', () => {
            console.log('[Auth] Limpando cache e localStorage...');
            localStorage.clear();
            sessionStorage.clear();
            alert('Cache limpo! A página será recarregada.');
            location.reload(true);
        });
    }

    // Formulário de login
    if (elements.loginForm) {
        elements.loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('[Auth] Iniciando login...');

            const username = elements.loginUsername.value.trim();
            const password = elements.loginPassword.value.trim();

            if (!username || !password) {
                alert('Por favor, preencha usuário e senha');
                return;
            }

            // Desabilita botão durante login
            const submitBtn = elements.loginForm.querySelector('button[type="submit"]');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Entrando...';
            }

            try {
                console.log('[Auth] Enviando credenciais:', username);
                const result = await AuthClient.login(username, password);
                console.log('[Auth] Resposta do login:', result);

                if (result.success) {
                    console.log('[Auth] Login bem-sucedido:', result.user);
                    handleAuthStateChange({ user: result.user, userData: result.user });
                } else {
                    console.error('[Auth] Login falhou:', result.error);
                    alert('Erro ao fazer login: ' + (result.error || 'Usuário ou senha inválidos'));
                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.textContent = 'Entrar';
                    }
                }
            } catch (error) {
                console.error('[Auth] Exceção ao fazer login:', error);
                alert('Erro ao fazer login: ' + error.message + '\n\nVerifique se o servidor está rodando.');
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Entrar';
                }
            }
        });
    }

    // Botão de logout na tela de aguardando
    if (elements.logoutWaitingBtn) {
        elements.logoutWaitingBtn.addEventListener('click', async () => {
            await AuthClient.logout();
            location.reload();
        });
    }
}

/**
 * Trata mudanças no estado de autenticação
 */
function handleAuthStateChange({ user, userData }) {
    console.log('[Auth] Estado de autenticação mudou', { user, userData });

    appState.currentUser = user;
    appState.userData = userData;

    if (!user) {
        // Não autenticado - mostra tela de login
        showLoginScreen();
    } else if (userData && userData.status === 'inactive') {
        // Autenticado mas inativo - mostra tela de aguardando
        showWaitingScreen(user, userData);
    } else {
        // Autenticado e ativo - mostra aplicação
        showApp();
    }
}

/**
 * Mostra tela de login
 */
function showLoginScreen() {
    console.log('[UI] Mostrando tela de login');

    if (elements.loginScreen) elements.loginScreen.style.display = 'flex';
    if (elements.waitingScreen) elements.waitingScreen.style.display = 'none';
    if (elements.app) elements.app.style.display = 'none';

    // Cancela observador de usuários se existir
    if (appState.usuariosUnsubscribe) {
        appState.usuariosUnsubscribe();
        appState.usuariosUnsubscribe = null;
    }
}

/**
 * Mostra tela de aguardando autorização
 */
function showWaitingScreen(user, userData) {
    console.log('[UI] Mostrando tela de aguardando');

    if (elements.loginScreen) elements.loginScreen.style.display = 'none';
    if (elements.waitingScreen) elements.waitingScreen.style.display = 'flex';
    if (elements.app) elements.app.style.display = 'none';

    // Atualiza informações do usuário
    if (elements.waitingUserInfo) {
        elements.waitingUserInfo.innerHTML = `
            <p><strong>Nome:</strong> ${userData.displayName || 'Não informado'}</p>
            <p><strong>Email:</strong> ${userData.email || 'Não informado'}</p>
            <p><strong>Status:</strong> Aguardando ativação</p>
        `;
    }

    // Cancela observador de usuários se existir
    if (appState.usuariosUnsubscribe) {
        appState.usuariosUnsubscribe();
        appState.usuariosUnsubscribe = null;
    }
}

/**
 * Mostra aplicação diretamente (SEM autenticação)
 */
function showAppDirect() {
    console.log('[UI] Iniciando aplicação diretamente (sem login)');

    if (elements.loginScreen) elements.loginScreen.style.display = 'none';
    if (elements.waitingScreen) elements.waitingScreen.style.display = 'none';
    if (elements.app) elements.app.style.display = 'flex';

    // Define usuário padrão como admin (sem autenticação)
    appState.currentUser = {
        username: 'admin',
        name: 'Administrador',
        role: 'admin'
    };

    // Configura navegação de abas
    setupTabs();

    // Restaura aba ativa do localStorage (se existir)
    const savedTab = localStorage.getItem('activeTab');
    if (savedTab && savedTab !== 'chat') {
        switchTab(savedTab);
    }

    // Configura sub-abas de configurações
    setupConfigTabs();

    // Configura ações do sistema (sem logout)
    setupSystemActionsNoAuth();

    // Conecta ao WhatsApp via REST API
    connectWhatsApp();

    // Configura eventos da interface
    setupEventListeners();

    // Inicializa monitoramento global de consultas
    MonitoramentoGlobal.init();

    // Atualiza informações do usuário (modo sem auth)
    if (elements.currentUserEmail) {
        elements.currentUserEmail.textContent = 'Administrador (Acesso Direto)';
    }
}

/**
 * Mostra aplicação (usuário autenticado e ativo) - LEGADO
 */
function showApp() {
    console.log('[UI] Mostrando aplicação');

    if (elements.loginScreen) elements.loginScreen.style.display = 'none';
    if (elements.waitingScreen) elements.waitingScreen.style.display = 'none';
    if (elements.app) elements.app.style.display = 'flex';

    // Configura navegação de abas
    setupTabs();

    // Restaura aba ativa do localStorage (se existir)
    const savedTab = localStorage.getItem('activeTab');
    if (savedTab && savedTab !== 'chat') {
        // Se tiver aba salva e não for chat, muda para ela
        switchTab(savedTab);
    }

    // Configura sub-abas de configurações
    setupConfigTabs();

    // Configura ações do sistema
    setupSystemActions();

    // Conecta ao WhatsApp via REST API
    connectWhatsApp();

    // Configura eventos da interface
    setupEventListeners();

    // Inicializa monitoramento global de consultas
    MonitoramentoGlobal.init();

    // Atualiza informações do usuário atual
    if (elements.currentUserEmail && appState.currentUser) {
        const user = appState.currentUser;
        elements.currentUserEmail.textContent = `${user.name} (${user.username}) - ${user.role}`;
    }

    // Controle de permissões por perfil
    applyPermissionControls();
}

/**
 * Aplica controles de permissões baseados no perfil do usuário
 */
function applyPermissionControls() {
    const user = appState.currentUser;
    if (!user) return;

    console.log('[Permissions] Aplicando controles de permissões para:', user.role);

    // ADMIN: Acesso total
    if (user.role === 'admin') {
        console.log('[Permissions] Admin - acesso total');
        return;
    }

    // OPERATOR: Sem acesso à aba Configurações
    if (user.role === 'operator') {
        console.log('[Permissions] Operator - escondendo aba Configurações');
        const configTab = document.querySelector('.nav-item[data-tab="configuracoes"]');
        if (configTab) {
            configTab.style.display = 'none';
        }
    }

    // VIEWER: Apenas visualização (sem enviar mensagens)
    if (user.role === 'viewer') {
        console.log('[Permissions] Viewer - modo somente leitura');

        // Esconde aba Configurações
        const configTab = document.querySelector('.nav-item[data-tab="configuracoes"]');
        if (configTab) {
            configTab.style.display = 'none';
        }

        // Desabilita envio de mensagens
        const messageInput = document.querySelector('.message-input input');
        const sendButton = document.querySelector('.send-btn');
        const attachButton = document.querySelector('.attach-btn');

        if (messageInput) {
            messageInput.disabled = true;
            messageInput.placeholder = 'Modo somente leitura - você não pode enviar mensagens';
        }

        if (sendButton) {
            sendButton.disabled = true;
            sendButton.style.opacity = '0.5';
            sendButton.style.cursor = 'not-allowed';
        }

        if (attachButton) {
            attachButton.disabled = true;
            attachButton.style.opacity = '0.5';
            attachButton.style.cursor = 'not-allowed';
        }
    }
}


// ============================================================================
// SUPRESSÃO DE ERROS 404 DE MÍDIA ANTIGA/EXPIRADA
// ============================================================================
// Stickers e mídias antigas frequentemente expiram nos servidores do WhatsApp
// Isso é comportamento esperado e documentado
// Fonte: https://wwebjs.dev/guide/creating-your-bot/handling-attachments
window.addEventListener('error', (event) => {
    // Suprime erros de carregamento de mídia (404)
    if (event.target && (event.target.tagName === 'IMG' || event.target.tagName === 'VIDEO' || event.target.tagName === 'AUDIO')) {
        const src = event.target.src || '';
        if (src.includes('/api/media/')) {
            // Previne que o erro apareça no console
            event.preventDefault();
            event.stopPropagation();

            // Log silencioso apenas para debug (não aparece como erro vermelho)
            console.debug('[Media] Mídia não disponível (expirada):', src.split('/').pop());

            return false;
        }
    }
}, true); // useCapture = true para pegar o erro antes de propagar

// Inicializa quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
