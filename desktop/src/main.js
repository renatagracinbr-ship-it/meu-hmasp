/**
 * HMASP Chat - Main Application
 * Frontend para Central de Regulação
 *
 * ARQUITETURA LOCAL HMASP:
 * - Frontend: Interface web (Vite)
 * - Backend Database: Servidor SQLite local
 * - Backend AGHUse: VM3 (Intranet - acesso PostgreSQL)
 * - Chat: Chat Próprio via Meu HMASP App (Push + SQLite)
 * - Autenticação: Sistema local (JSON) sem Firebase
 */

import CONFIG from './config/backend.config.js';
import { DateUtils } from './utils/dateUtils.js';
import { PhoneNormalizer } from './utils/phoneNormalizer.js';
import * as AuthClient from './auth-client.js';
import * as ConfirmacaoPresenca from './components/confirmacaoPresenca.js';
import * as DesmarcacaoConsultas from './components/desmarcacaoConsultas.js';
import * as ConfiguracaoMensagens from './components/configuracaoMensagens.js';
import * as ConsultasPaciente from './components/consultasPaciente.js';
import * as AcoesPendentes from './components/acoesPendentes.js';
import * as MonitoramentoGlobal from './services/monitoramentoGlobal.service.js';
import * as ChatProprio from './components/chatProprio.js';

// URL base da API
const API_BASE = CONFIG.DATABASE_BACKEND;

// Estado da aplicação
const appState = {
    chatProprioReady: false, // Chat Próprio está pronto
    currentUser: null,
    userData: null,
    usuariosUnsubscribe: null
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
 * Inicializa todos os componentes em background
 * Isso permite que polling e atualizações funcionem mesmo quando a aba não está visível
 */
function initializeAllComponentsInBackground() {
    console.log('[App] Inicializando todos os componentes em background...');

    // Delay pequeno para garantir que o DOM esteja pronto
    setTimeout(() => {
        // Inicializa Confirmação de Presença
        try {
            ConfirmacaoPresenca.init();
            console.log('[App] ✓ ConfirmacaoPresenca inicializado em background');
        } catch (error) {
            console.error('[App] Erro ao inicializar ConfirmacaoPresenca:', error);
        }

        // Inicializa Desmarcação de Consultas
        try {
            DesmarcacaoConsultas.init();
            console.log('[App] ✓ DesmarcacaoConsultas inicializado em background');
        } catch (error) {
            console.error('[App] Erro ao inicializar DesmarcacaoConsultas:', error);
        }

        // Inicializa Ações Pendentes
        try {
            AcoesPendentes.init();
            console.log('[App] ✓ AcoesPendentes inicializado em background');
        } catch (error) {
            console.error('[App] Erro ao inicializar AcoesPendentes:', error);
        }

        // Inicializa Consultas do Paciente
        try {
            ConsultasPaciente.init();
            console.log('[App] ✓ ConsultasPaciente inicializado em background');
        } catch (error) {
            console.error('[App] Erro ao inicializar ConsultasPaciente:', error);
        }

        console.log('[App] Todos os componentes inicializados em background!');
    }, 500);
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

    // Se trocar para ações pendentes, inicializa componente
    if (tabName === 'acoes') {
        AcoesPendentes.init();
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
            alert('HMASP Chat v2.0.0\n\nSistema de Marcação de Consultas\nHospital Militar de Área de São Paulo\n\nArquitetura:\n- Frontend: Vite + JavaScript\n- Backend AGHUse: Node.js + PostgreSQL\n- Banco de Dados: SQLite + PostgreSQL (HMASP)\n- Comunicação: Chat Próprio via Meu HMASP App');
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
            alert('HMASP Chat v2.0.0\n\nSistema de Marcação de Consultas\nHospital Militar de Área de São Paulo\n\nArquitetura:\n- Frontend: Vite + JavaScript\n- Backend AGHUse: Node.js + PostgreSQL\n- Banco de Dados: SQLite + PostgreSQL (HMASP)\n- Comunicação: Chat Próprio via Meu HMASP App');
        });
    }
}

// ============================================================================
// INTERFACE DE CHAT (AGORA VIA CHAT PRÓPRIO)
// A interface de chat agora usa o Chat Próprio em vez do WhatsApp
// O componente ChatProprio (chatProprio.js) gerencia toda a lógica de
// conversa com pacientes via Chat Próprio e Push Notifications
// ============================================================================

// FUNÇÕES LEGADAS REMOVIDAS:
// - displayConversations, startPollingUpdates, displayQRCode
// - showChatInterface, showDisconnected, showAuthError, showConnectionError
// - requestNewQRCode, loadConversations, displayEmptyState
// - appendConversations, setupInfiniteScroll, createConversationElement
// - loadProfilePicForChat, updateAvatarWithPhoto
// - openChat, startMessagesPolling, stopMessagesPolling
// - refreshMessages, loadMessages, displayMessages
// - createMessageElement, markChatAsRead, sendMessage
// - updateConversationInList, scrollToBottom, filterConversations
// - setupEventListeners (relacionados ao chat WhatsApp)
//
// Toda a lógica de chat agora está em src/components/chatProprio.js

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


// ============================================================================
// FUNÇÕES LEGADAS REMOVIDAS (WHATSAPP)
// Todas as funções de chat foram movidas para chatProprio.js:
// - displayMessages, setupMessagesScroll, handleMessagesScroll
// - createMessageElement, escapeHtml, markChatAsRead
// - openImageViewer, sendMessage, updateConversationInList
// - scrollToBottom, filterConversations, setupEventListeners (chat)
// - openChat, startMessagesPolling, stopMessagesPolling, refreshMessages
// - loadMessages, closeChat
// ============================================================================

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

    // Inicializa Chat Proprio (interface de chat com pacientes)
    ChatProprio.init();

    // Inicializa monitoramento global de consultas
    MonitoramentoGlobal.init();

    // =====================================================================
    // INICIALIZA TODOS OS COMPONENTES EM BACKGROUND
    // Os componentes devem funcionar mesmo quando a aba não está selecionada
    // =====================================================================
    initializeAllComponentsInBackground();

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

    // Inicializa Chat Proprio (interface de chat com pacientes)
    ChatProprio.init();

    // Inicializa monitoramento global de consultas
    MonitoramentoGlobal.init();

    // =====================================================================
    // INICIALIZA TODOS OS COMPONENTES EM BACKGROUND
    // Os componentes devem funcionar mesmo quando a aba não está selecionada
    // =====================================================================
    initializeAllComponentsInBackground();

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
