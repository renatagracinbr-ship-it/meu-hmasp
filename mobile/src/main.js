/**
 * Meu HMASP - App Mobile (Paciente)
 *
 * Aplicativo para pacientes acessarem suas consultas
 * e se comunicarem com a Central de Regulacao
 */

// Configuracao da API
const API_BASE = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'https://seu-backend.hmasp.com.br'; // Sera configurado para a VM do HMASP

// Estado da aplicacao
const state = {
    currentUser: null,
    currentPatient: null,
    patients: [], // Titular + dependentes
    messages: [],
    consultas: [],
    unreadMessages: 0,
    isConnected: false,
    conversaId: null,      // ID da conversa no chat proprio
    lastMessageTimestamp: null,
    pollingInterval: null,
    isLoggedIn: false
};

// Elementos DOM
const elements = {
    // Login
    loginScreen: document.getElementById('login-screen'),
    loginForm: document.getElementById('login-form'),
    loginCpf: document.getElementById('login-cpf'),
    loginProntuario: document.getElementById('login-prontuario'),
    loginBtn: document.getElementById('login-btn'),
    smsVerify: document.getElementById('sms-verify'),
    smsCode: document.getElementById('sms-code'),
    verifyCodeBtn: document.getElementById('verify-code-btn'),
    resendCodeBtn: document.getElementById('resend-code-btn'),

    // App
    app: document.getElementById('app'),

    // Screens
    homeScreen: document.getElementById('home-screen'),
    chatScreen: document.getElementById('chat-screen'),
    consultasScreen: document.getElementById('consultas-screen'),

    // Navigation
    navItems: document.querySelectorAll('.bottom-nav .nav-item'),

    // Home
    userInitials: document.getElementById('user-initials'),
    userName: document.getElementById('user-name'),
    dependentsList: document.getElementById('dependents-list'),
    addDependentBtn: document.getElementById('add-dependent-btn'),
    actionCards: document.querySelectorAll('.action-card'),

    // Chat
    chatMessages: document.getElementById('chat-messages'),
    chatInput: document.getElementById('chat-input'),
    sendMessageBtn: document.getElementById('send-message-btn'),
    chatBadge: document.getElementById('chat-badge'),

    // Consultas
    patientSelector: document.getElementById('patient-selector'),
    consultasList: document.getElementById('consultas-list'),

    // Modal
    addDependentModal: document.getElementById('add-dependent-modal'),
    dependentProntuario: document.getElementById('dependent-prontuario'),
    dependentRelationship: document.getElementById('dependent-relationship'),

    // Menu
    menuBtn: document.getElementById('menu-btn'),
    dropdownMenu: document.getElementById('dropdown-menu')
};

/**
 * Inicializa a aplicacao
 */
async function init() {
    console.log('[MeuHMASP] Iniciando aplicacao...');

    // Configura login
    setupLogin();

    // Configura navegacao
    setupNavigation();

    // Configura chat
    setupChat();

    // Configura modais
    setupModals();

    // Configura menu dropdown
    setupMenu();

    // Verifica autenticacao
    await checkAuth();

    console.log('[MeuHMASP] Aplicacao iniciada');
}

/**
 * Configura menu dropdown
 */
function setupMenu() {
    if (elements.menuBtn && elements.dropdownMenu) {
        // Toggle menu ao clicar no botao
        elements.menuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            elements.dropdownMenu.classList.toggle('show');
        });

        // Fechar menu ao clicar fora
        document.addEventListener('click', (e) => {
            if (!elements.dropdownMenu.contains(e.target) && !elements.menuBtn.contains(e.target)) {
                elements.dropdownMenu.classList.remove('show');
            }
        });
    }
}

/**
 * Configura eventos de login
 */
function setupLogin() {
    // Mascara para CPF
    if (elements.loginCpf) {
        elements.loginCpf.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 11) value = value.slice(0, 11);

            // Formata CPF: 000.000.000-00
            if (value.length > 9) {
                value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
            } else if (value.length > 6) {
                value = value.replace(/(\d{3})(\d{3})(\d{3})/, '$1.$2.$3');
            } else if (value.length > 3) {
                value = value.replace(/(\d{3})(\d{3})/, '$1.$2');
            }

            e.target.value = value;
        });
    }

    // Botao de login
    if (elements.loginBtn) {
        elements.loginBtn.addEventListener('click', handleLogin);
    }

    // Enter no formulario
    if (elements.loginProntuario) {
        elements.loginProntuario.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleLogin();
        });
    }

    // Verificacao de codigo SMS
    if (elements.verifyCodeBtn) {
        elements.verifyCodeBtn.addEventListener('click', handleVerifyCode);
    }

    // Reenviar codigo
    if (elements.resendCodeBtn) {
        elements.resendCodeBtn.addEventListener('click', handleResendCode);
    }
}

/**
 * Trata login
 */
async function handleLogin() {
    const cpf = elements.loginCpf.value.replace(/\D/g, '');
    const prontuario = elements.loginProntuario.value.trim();

    if (!cpf || cpf.length !== 11) {
        alert('Digite um CPF valido');
        return;
    }

    if (!prontuario) {
        alert('Digite o numero do prontuario');
        return;
    }

    // Mostra loading
    elements.loginBtn.classList.add('loading');
    elements.loginBtn.disabled = true;

    try {
        // Busca dados do paciente no backend
        const response = await fetch(`${API_BASE}/api/paciente/verificar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cpf, prontuario })
        });

        const data = await response.json();

        if (data.success && data.paciente) {
            // Login bem sucedido
            loginSuccess(data.paciente);
        } else {
            alert(data.error || 'CPF ou prontuario nao encontrado');
        }
    } catch (error) {
        console.error('[Login] Erro:', error);
        // Modo offline - usa dados mockados para teste
        loginWithMockData(cpf, prontuario);
    } finally {
        elements.loginBtn.classList.remove('loading');
        elements.loginBtn.disabled = false;
    }
}

/**
 * Login com dados mockados (quando servidor nao disponivel)
 */
function loginWithMockData(cpf, prontuario) {
    console.log('[Login] Usando modo offline');

    const mockPaciente = {
        id: prontuario,
        nome: 'Paciente ' + prontuario,
        prontuario: prontuario,
        cpf: cpf,
        telefone: '11999887766'
    };

    loginSuccess(mockPaciente);
}

/**
 * Login bem sucedido
 */
function loginSuccess(paciente) {
    state.currentUser = paciente;
    state.currentPatient = {
        id: paciente.prontuario,
        nome: paciente.nome,
        prontuario: paciente.prontuario,
        relationship: 'titular',
        isMain: true
    };
    state.patients = [state.currentPatient];
    state.isLoggedIn = true;

    // Salva no localStorage
    localStorage.setItem('meuHmasp_user', JSON.stringify({
        ...paciente,
        patients: state.patients
    }));

    // Mostra app
    showApp();

    // Inicializa chat
    initializeChatConversa();
}

/**
 * Mostra o app principal
 */
function showApp() {
    if (elements.loginScreen) {
        elements.loginScreen.style.display = 'none';
    }
    if (elements.app) {
        elements.app.style.display = 'block';
    }

    updateUserInterface();
    loadConsultas();
}

/**
 * Mostra tela de login
 */
function showLogin() {
    if (elements.loginScreen) {
        elements.loginScreen.style.display = 'flex';
    }
    if (elements.app) {
        elements.app.style.display = 'none';
    }
}

/**
 * Trata verificacao de codigo SMS (para uso futuro com Firebase)
 */
async function handleVerifyCode() {
    const code = elements.smsCode.value.trim();
    if (!code || code.length !== 6) {
        alert('Digite o codigo de 6 digitos');
        return;
    }

    // TODO: Integrar com Firebase Auth
    console.log('[Auth] Verificando codigo:', code);
}

/**
 * Reenvia codigo SMS
 */
async function handleResendCode() {
    // TODO: Integrar com Firebase Auth
    console.log('[Auth] Reenviando codigo...');
    alert('Codigo reenviado!');
}

/**
 * Faz logout
 */
function handleLogout() {
    state.currentUser = null;
    state.currentPatient = null;
    state.patients = [];
    state.isLoggedIn = false;
    state.conversaId = null;

    // Limpa localStorage
    localStorage.removeItem('meuHmasp_user');

    // Para polling
    if (state.pollingInterval) {
        clearInterval(state.pollingInterval);
        state.pollingInterval = null;
    }

    // Mostra login
    showLogin();
}

// Expoe logout globalmente
window.logout = handleLogout;

/**
 * Verifica se o usuario esta autenticado
 */
async function checkAuth() {
    const savedUser = localStorage.getItem('meuHmasp_user');

    if (savedUser) {
        try {
            const userData = JSON.parse(savedUser);
            state.currentUser = userData;
            state.patients = userData.patients || [];
            state.currentPatient = state.patients[0] || null;
            state.isLoggedIn = true;

            // Mostra app
            showApp();

            // Inicializa chat
            initializeChatConversa();
        } catch (e) {
            console.error('[Auth] Erro ao carregar usuario:', e);
            showLogin();
        }
    } else {
        // Mostra tela de login
        showLogin();
    }
}

/**
 * Login de teste (sera substituido por Firebase Auth)
 */
async function mockLogin() {
    // Dados de teste
    state.currentUser = {
        id: '1',
        nome: 'Joao da Silva',
        prontuario: '123456',
        cpf: '12345678900',
        telefone: '11999887766'
    };

    state.patients = [
        {
            id: '1',
            nome: 'Joao da Silva',
            prontuario: '123456',
            relationship: 'titular',
            isMain: true
        }
    ];

    state.currentPatient = state.patients[0];

    // Salva no localStorage
    localStorage.setItem('meuHmasp_user', JSON.stringify({
        ...state.currentUser,
        patients: state.patients
    }));

    updateUserInterface();
    loadConsultas();

    // Inicializa chat
    initializeChatConversa();
}

/**
 * Atualiza a interface com dados do usuario
 */
function updateUserInterface() {
    const user = state.currentUser;
    if (!user) return;

    // Atualiza iniciais
    const initials = getInitials(user.nome);
    elements.userInitials.textContent = initials;

    // Atualiza nome
    elements.userName.textContent = user.nome;

    // Atualiza lista de dependentes
    renderDependentsList();

    // Atualiza seletor de pacientes
    renderPatientSelector();
}

/**
 * Obtem as iniciais do nome
 */
function getInitials(nome) {
    if (!nome) return '?';
    const parts = nome.split(' ').filter(p => p.length > 0);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Renderiza lista de dependentes
 */
function renderDependentsList() {
    const list = elements.dependentsList;
    list.innerHTML = '';

    state.patients.forEach(patient => {
        const item = document.createElement('div');
        item.className = 'dependent-item';
        item.innerHTML = `
            <div class="dependent-avatar">${getInitials(patient.nome)}</div>
            <div class="dependent-info">
                <div class="dependent-name">${patient.nome}</div>
                <div class="dependent-relationship">${getRelationshipLabel(patient.relationship)}</div>
            </div>
        `;
        list.appendChild(item);
    });
}

/**
 * Obtem label do parentesco
 */
function getRelationshipLabel(relationship) {
    const labels = {
        titular: 'Titular',
        filho: 'Filho(a)',
        conjuge: 'Conjuge',
        pai: 'Pai/Mae',
        outro: 'Dependente'
    };
    return labels[relationship] || relationship;
}

/**
 * Renderiza seletor de pacientes
 */
function renderPatientSelector() {
    const selector = elements.patientSelector;
    selector.innerHTML = '';

    state.patients.forEach(patient => {
        const option = document.createElement('option');
        option.value = patient.prontuario;
        option.textContent = patient.nome;
        if (patient.isMain) option.selected = true;
        selector.appendChild(option);
    });
}

/**
 * Configura navegacao entre telas
 */
function setupNavigation() {
    // Navegacao inferior
    elements.navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tab = item.dataset.tab;
            switchScreen(tab);
        });
    });

    // Cards de acao na home
    elements.actionCards.forEach(card => {
        card.addEventListener('click', () => {
            const tab = card.dataset.tab;
            switchScreen(tab);
        });
    });
}

/**
 * Troca de tela
 */
function switchScreen(screenName) {
    // Atualiza navegacao
    elements.navItems.forEach(item => {
        item.classList.toggle('active', item.dataset.tab === screenName);
    });

    // Atualiza telas
    const screens = document.querySelectorAll('.screen');
    screens.forEach(screen => {
        screen.classList.remove('active');
    });

    const targetScreen = document.getElementById(`${screenName}-screen`);
    if (targetScreen) {
        targetScreen.classList.add('active');
    }

    // Acoes especificas por tela
    if (screenName === 'chat') {
        elements.chatInput.focus();
        markMessagesAsRead();
    } else if (screenName === 'consultas') {
        loadConsultas();
    }
}

/**
 * Configura funcionalidades do chat
 */
function setupChat() {
    // Habilita/desabilita botao de envio baseado no input
    elements.chatInput.addEventListener('input', () => {
        elements.sendMessageBtn.disabled = !elements.chatInput.value.trim();
    });

    // Enviar mensagem com Enter
    elements.chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Botao de enviar
    elements.sendMessageBtn.addEventListener('click', sendMessage);

    // Inicializa conversa quando tiver paciente
    if (state.currentPatient) {
        initializeChatConversa();
    }
}

/**
 * Inicializa conversa no chat proprio
 */
async function initializeChatConversa() {
    if (!state.currentPatient) return;

    try {
        // Cria ou busca conversa para o paciente
        const response = await fetch(`${API_BASE}/api/chat-proprio/conversas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pacienteId: state.currentPatient.prontuario,
                pacienteNome: state.currentPatient.nome,
                pacienteTelefone: state.currentUser?.telefone || null
            })
        });

        const data = await response.json();
        if (data.success && data.conversa) {
            state.conversaId = data.conversa.id;
            console.log('[Chat] Conversa inicializada:', state.conversaId);

            // Carrega mensagens existentes
            await loadMessages();

            // Inicia polling para novas mensagens
            startMessagesPolling();
        }
    } catch (error) {
        console.error('[Chat] Erro ao inicializar conversa:', error);
    }
}

/**
 * Inicia polling de mensagens
 */
function startMessagesPolling() {
    if (state.pollingInterval) {
        clearInterval(state.pollingInterval);
    }

    state.pollingInterval = setInterval(async () => {
        if (state.conversaId) {
            await checkNewMessages();
        }
    }, 3000); // Verifica a cada 3 segundos
}

/**
 * Verifica novas mensagens
 */
async function checkNewMessages() {
    if (!state.conversaId) return;

    try {
        const params = state.lastMessageTimestamp
            ? `?apos=${encodeURIComponent(state.lastMessageTimestamp)}`
            : '';

        const response = await fetch(
            `${API_BASE}/api/chat-proprio/conversas/${state.conversaId}/mensagens/recentes${params}`
        );

        const data = await response.json();
        if (data.success && data.mensagens && data.mensagens.length > 0) {
            data.mensagens.forEach(msg => {
                // Atualiza timestamp
                state.lastMessageTimestamp = msg.created_at;

                // Se nao e mensagem do paciente, adiciona na UI
                if (msg.remetente_tipo !== 'paciente') {
                    addMessageToUI({
                        id: msg.id,
                        text: msg.conteudo,
                        fromMe: false,
                        timestamp: new Date(msg.created_at)
                    });

                    // Incrementa contador de nao lidas se nao estiver na tela de chat
                    const chatScreen = document.getElementById('chat-screen');
                    if (!chatScreen.classList.contains('active')) {
                        state.unreadMessages++;
                        updateUnreadBadge();
                    }
                }
            });
        }
    } catch (error) {
        console.log('[Chat] Erro ao verificar mensagens:', error.message);
    }
}

/**
 * Envia mensagem
 */
async function sendMessage() {
    const text = elements.chatInput.value.trim();
    if (!text) return;

    // Verifica se tem conversa
    if (!state.conversaId) {
        await initializeChatConversa();
        if (!state.conversaId) {
            alert('Erro ao conectar ao chat. Tente novamente.');
            return;
        }
    }

    // Limpa input
    elements.chatInput.value = '';
    elements.sendMessageBtn.disabled = true;

    // Adiciona mensagem na UI imediatamente
    const message = {
        id: Date.now(),
        text: text,
        fromMe: true,
        timestamp: new Date()
    };

    addMessageToUI(message);

    // Envia para o servidor
    try {
        const response = await fetch(`${API_BASE}/api/chat-proprio/mensagens`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                conversaId: state.conversaId,
                remetenteTipo: 'paciente',
                remetenteId: state.currentPatient.prontuario,
                remetenteNome: state.currentPatient.nome,
                conteudo: text
            })
        });

        const data = await response.json();
        if (data.success) {
            state.lastMessageTimestamp = data.mensagem.created_at;
        }
    } catch (error) {
        console.error('[Chat] Erro ao enviar mensagem:', error);
        alert('Erro ao enviar mensagem. Verifique sua conexao.');
    }
}

/**
 * Adiciona mensagem na UI
 */
function addMessageToUI(message) {
    // Remove mensagem de boas vindas se existir
    const welcome = elements.chatMessages.querySelector('.chat-welcome');
    if (welcome) welcome.remove();

    const div = document.createElement('div');
    div.className = `message ${message.fromMe ? 'sent' : 'received'}`;

    const time = message.timestamp instanceof Date
        ? message.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : '';

    div.innerHTML = `
        <div class="message-bubble">
            <div class="message-text">${escapeHtml(message.text)}</div>
            <div class="message-time">${time}</div>
        </div>
    `;

    elements.chatMessages.appendChild(div);

    // Scroll para o final
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight;
}

/**
 * Carrega mensagens do servidor
 */
async function loadMessages() {
    if (!state.conversaId) return;

    try {
        const response = await fetch(
            `${API_BASE}/api/chat-proprio/conversas/${state.conversaId}/mensagens?ordem=ASC`
        );
        const data = await response.json();

        if (data.success && data.mensagens && data.mensagens.length > 0) {
            // Remove mensagem de boas vindas
            const welcome = elements.chatMessages.querySelector('.chat-welcome');
            if (welcome) welcome.remove();

            // Limpa mensagens existentes
            const existingMessages = elements.chatMessages.querySelectorAll('.message');
            existingMessages.forEach(m => m.remove());

            // Adiciona mensagens
            data.mensagens.forEach(msg => {
                addMessageToUI({
                    id: msg.id,
                    text: msg.conteudo,
                    fromMe: msg.remetente_tipo === 'paciente',
                    timestamp: new Date(msg.created_at)
                });

                // Atualiza ultimo timestamp
                state.lastMessageTimestamp = msg.created_at;
            });

            // Marca como lidas
            await markMessagesAsReadOnServer();
        }
    } catch (error) {
        console.log('[Chat] Servidor nao disponivel, usando modo offline');
    }
}

/**
 * Marca mensagens como lidas no servidor
 */
async function markMessagesAsReadOnServer() {
    if (!state.conversaId) return;

    try {
        await fetch(`${API_BASE}/api/chat-proprio/conversas/${state.conversaId}/marcar-lidas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lidoPor: 'paciente' })
        });
    } catch (error) {
        console.log('[Chat] Erro ao marcar como lidas:', error.message);
    }
}

/**
 * Marca mensagens como lidas
 */
function markMessagesAsRead() {
    state.unreadMessages = 0;
    updateUnreadBadge();
    markMessagesAsReadOnServer();
}

/**
 * Atualiza badge de mensagens nao lidas
 */
function updateUnreadBadge() {
    if (state.unreadMessages > 0) {
        elements.chatBadge.textContent = state.unreadMessages > 99 ? '99+' : state.unreadMessages;
        elements.chatBadge.style.display = 'flex';
    } else {
        elements.chatBadge.style.display = 'none';
    }
}

/**
 * Carrega consultas do paciente
 */
async function loadConsultas() {
    const prontuario = elements.patientSelector.value || state.currentPatient?.prontuario;
    if (!prontuario) return;

    elements.consultasList.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Carregando consultas...</p>
        </div>
    `;

    try {
        const response = await fetch(`${API_BASE}/api/paciente/consultas?prontuario=${prontuario}`);
        const data = await response.json();

        if (data.success && data.consultas.length > 0) {
            renderConsultas(data.consultas);
        } else {
            renderEmptyConsultas();
        }
    } catch (error) {
        console.log('[Consultas] Servidor nao disponivel');
        renderMockConsultas(); // Dados de teste
    }
}

/**
 * Renderiza consultas
 */
function renderConsultas(consultas) {
    elements.consultasList.innerHTML = '';

    consultas.forEach(consulta => {
        const card = document.createElement('div');
        card.className = 'consulta-card';

        const statusClass = getStatusClass(consulta.status);
        const statusLabel = getStatusLabel(consulta.status);

        card.innerHTML = `
            <div class="consulta-header">
                <div>
                    <div class="consulta-date">${consulta.dataFormatada}</div>
                    <div class="consulta-time">${consulta.horaFormatada}</div>
                </div>
                <span class="consulta-status ${statusClass}">${statusLabel}</span>
            </div>
            <div class="consulta-details">
                <div class="consulta-detail">
                    <svg viewBox="0 0 24 24" width="16" height="16">
                        <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                    <span>${consulta.especialidade}</span>
                </div>
                <div class="consulta-detail">
                    <svg viewBox="0 0 24 24" width="16" height="16">
                        <path fill="currentColor" d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                    </svg>
                    <span>${consulta.profissional}</span>
                </div>
                <div class="consulta-detail">
                    <svg viewBox="0 0 24 24" width="16" height="16">
                        <path fill="currentColor" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                    </svg>
                    <span>${consulta.local || 'HMASP'}</span>
                </div>
            </div>
            ${consulta.status === 'pendente' ? `
                <div class="consulta-actions">
                    <button class="btn-action btn-confirm" onclick="confirmarPresenca('${consulta.id}')">
                        Confirmar Presenca
                    </button>
                    <button class="btn-action btn-cancel-consulta" onclick="solicitarDesmarcacao('${consulta.id}')">
                        Desmarcar
                    </button>
                </div>
            ` : ''}
        `;

        elements.consultasList.appendChild(card);
    });
}

/**
 * Renderiza estado vazio
 */
function renderEmptyConsultas() {
    elements.consultasList.innerHTML = `
        <div class="empty-state">
            <svg viewBox="0 0 24 24" width="64" height="64">
                <path fill="currentColor" d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/>
            </svg>
            <h3>Nenhuma consulta encontrada</h3>
            <p>Voce nao possui consultas agendadas no momento</p>
        </div>
    `;
}

/**
 * Dados de teste para consultas
 */
function renderMockConsultas() {
    const mockData = [
        {
            id: '1',
            dataFormatada: '20/12/2024',
            horaFormatada: '09:30',
            especialidade: 'Cardiologia',
            profissional: 'Dr. Carlos Mendes',
            local: 'Ambulatorio 1',
            status: 'pendente'
        },
        {
            id: '2',
            dataFormatada: '23/12/2024',
            horaFormatada: '14:00',
            especialidade: 'Ortopedia',
            profissional: 'Dra. Maria Santos',
            local: 'Ambulatorio 2',
            status: 'confirmada'
        }
    ];

    renderConsultas(mockData);
}

/**
 * Obtem classe CSS do status
 */
function getStatusClass(status) {
    const classes = {
        confirmada: 'confirmada',
        pendente: 'pendente',
        cancelada: 'cancelada'
    };
    return classes[status] || 'pendente';
}

/**
 * Obtem label do status
 */
function getStatusLabel(status) {
    const labels = {
        confirmada: 'Confirmada',
        pendente: 'Aguardando',
        cancelada: 'Cancelada'
    };
    return labels[status] || status;
}

/**
 * Confirma presenca na consulta
 */
window.confirmarPresenca = async function(consultaId) {
    try {
        await fetch(`${API_BASE}/api/consulta/confirmar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ consultaId })
        });
        alert('Presenca confirmada com sucesso!');
        loadConsultas();
    } catch (error) {
        alert('Erro ao confirmar presenca. Tente novamente.');
    }
};

/**
 * Solicita desmarcacao da consulta
 */
window.solicitarDesmarcacao = async function(consultaId) {
    if (!confirm('Tem certeza que deseja desmarcar esta consulta?')) return;

    try {
        await fetch(`${API_BASE}/api/consulta/desmarcar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ consultaId })
        });
        alert('Solicitacao de desmarcacao enviada!');
        loadConsultas();
    } catch (error) {
        alert('Erro ao solicitar desmarcacao. Tente novamente.');
    }
};

/**
 * Configura modais
 */
function setupModals() {
    // Botao para abrir modal de adicionar dependente
    elements.addDependentBtn.addEventListener('click', () => {
        elements.addDependentModal.classList.add('active');
    });

    // Fechar modal
    const closeBtn = elements.addDependentModal.querySelector('.modal-close');
    const cancelBtn = elements.addDependentModal.querySelector('.btn-cancel');
    const confirmBtn = elements.addDependentModal.querySelector('.btn-confirm');

    closeBtn.addEventListener('click', () => {
        elements.addDependentModal.classList.remove('active');
    });

    cancelBtn.addEventListener('click', () => {
        elements.addDependentModal.classList.remove('active');
    });

    confirmBtn.addEventListener('click', addDependent);

    // Fechar ao clicar fora
    elements.addDependentModal.addEventListener('click', (e) => {
        if (e.target === elements.addDependentModal) {
            elements.addDependentModal.classList.remove('active');
        }
    });
}

/**
 * Adiciona dependente
 */
async function addDependent() {
    const prontuario = elements.dependentProntuario.value.trim();
    const relationship = elements.dependentRelationship.value;

    if (!prontuario) {
        alert('Digite o numero do prontuario');
        return;
    }

    try {
        // Busca dados do paciente pelo prontuario
        const response = await fetch(`${API_BASE}/api/paciente/buscar?prontuario=${prontuario}`);
        const data = await response.json();

        if (data.success && data.paciente) {
            // Adiciona a lista de pacientes
            const newPatient = {
                id: prontuario,
                nome: data.paciente.nome,
                prontuario: prontuario,
                relationship: relationship,
                isMain: false
            };

            state.patients.push(newPatient);

            // Atualiza localStorage
            const savedUser = JSON.parse(localStorage.getItem('meuHmasp_user'));
            savedUser.patients = state.patients;
            localStorage.setItem('meuHmasp_user', JSON.stringify(savedUser));

            // Atualiza UI
            renderDependentsList();
            renderPatientSelector();

            // Fecha modal
            elements.addDependentModal.classList.remove('active');
            elements.dependentProntuario.value = '';

            alert('Paciente adicionado com sucesso!');
        } else {
            alert('Prontuario nao encontrado');
        }
    } catch (error) {
        console.error('[Dependente] Erro ao buscar paciente:', error);

        // Para testes, adiciona mesmo sem servidor
        const newPatient = {
            id: prontuario,
            nome: `Paciente ${prontuario}`,
            prontuario: prontuario,
            relationship: relationship,
            isMain: false
        };

        state.patients.push(newPatient);
        renderDependentsList();
        renderPatientSelector();
        elements.addDependentModal.classList.remove('active');
        elements.dependentProntuario.value = '';
    }
}

/**
 * Escapa HTML para prevenir XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Inicializa quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
