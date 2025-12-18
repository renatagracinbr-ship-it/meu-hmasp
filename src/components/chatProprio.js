/**
 * Chat Proprio - Componente do Operador
 *
 * Interface de chat interno para comunicacao com pacientes
 * Substitui a dependencia do WhatsApp
 */

import * as ChatService from '../services/chatProprio.service.js';

// Estado do componente
const state = {
    conversas: [],
    conversaAtual: null,
    mensagens: [],
    operadorId: 'operador_1',
    operadorNome: 'Operador',
    pingInterval: null
};

// Elementos do DOM
let elements = null;

/**
 * Inicializa o componente de chat
 */
export function init() {
    console.log('[ChatProprio] Inicializando componente...');

    // Captura elementos
    elements = {
        chatInterface: document.getElementById('chat-interface'),
        whatsappStatus: document.getElementById('whatsapp-status'),
        conversationsList: document.getElementById('conversations-list'),
        messagesList: document.getElementById('messages-list'),
        messageInput: document.getElementById('message-input'),
        sendBtn: document.getElementById('send-btn'),
        contactName: document.getElementById('contact-name'),
        contactStatus: document.getElementById('contact-status'),
        contactAvatar: document.getElementById('contact-avatar'),
        noChatSelected: document.getElementById('no-chat-selected'),
        chatActive: document.getElementById('chat-active'),
        searchInput: document.getElementById('search-input'),
        searchBox: document.getElementById('search-box'),
        searchChatsBtn: document.getElementById('search-chats-btn'),
        newChatBtn: document.getElementById('new-chat-btn'),
        newChatModal: document.getElementById('new-chat-modal'),
        newChatNumber: document.getElementById('new-chat-number'),
        closeNewChat: document.getElementById('close-new-chat'),
        cancelNewChat: document.getElementById('cancel-new-chat'),
        confirmNewChat: document.getElementById('confirm-new-chat')
    };

    // Configura eventos
    setupEventListeners();

    // Mostra interface do chat (sem QR Code)
    showChatInterface();

    // Inicia polling de conversas
    ChatService.startConversasPolling(handleConversasUpdate, 3000);

    // Registra operador online
    registerOperador();

    console.log('[ChatProprio] Componente inicializado');
}

/**
 * Configura listeners de eventos
 */
function setupEventListeners() {
    // Enviar mensagem
    if (elements.sendBtn) {
        elements.sendBtn.addEventListener('click', enviarMensagem);
    }

    // Enter para enviar
    if (elements.messageInput) {
        elements.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                enviarMensagem();
            }
        });

        // Auto-resize textarea
        elements.messageInput.addEventListener('input', () => {
            elements.messageInput.style.height = 'auto';
            elements.messageInput.style.height = elements.messageInput.scrollHeight + 'px';
        });
    }

    // Buscar conversas
    if (elements.searchChatsBtn) {
        elements.searchChatsBtn.addEventListener('click', () => {
            if (elements.searchBox) {
                elements.searchBox.style.display = elements.searchBox.style.display === 'none' ? 'block' : 'none';
                if (elements.searchBox.style.display === 'block') {
                    elements.searchInput.focus();
                }
            }
        });
    }

    // Filtrar conversas
    if (elements.searchInput) {
        elements.searchInput.addEventListener('input', (e) => {
            const termo = e.target.value.toLowerCase();
            filtrarConversas(termo);
        });
    }

    // Nova conversa
    if (elements.newChatBtn) {
        elements.newChatBtn.addEventListener('click', () => {
            if (elements.newChatModal) {
                elements.newChatModal.style.display = 'flex';
                elements.newChatNumber.value = '';
                elements.newChatNumber.focus();
            }
        });
    }

    // Fechar modal
    if (elements.closeNewChat) {
        elements.closeNewChat.addEventListener('click', () => {
            elements.newChatModal.style.display = 'none';
        });
    }

    if (elements.cancelNewChat) {
        elements.cancelNewChat.addEventListener('click', () => {
            elements.newChatModal.style.display = 'none';
        });
    }

    // Confirmar nova conversa
    if (elements.confirmNewChat) {
        elements.confirmNewChat.addEventListener('click', criarNovaConversa);
    }

    // Enter no modal
    if (elements.newChatNumber) {
        elements.newChatNumber.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                criarNovaConversa();
            }
        });
    }
}

/**
 * Mostra interface do chat (esconde QR Code)
 */
function showChatInterface() {
    if (elements.whatsappStatus) {
        elements.whatsappStatus.style.display = 'none';
    }
    if (elements.chatInterface) {
        elements.chatInterface.style.display = 'flex';
    }
}

/**
 * Registra operador como online
 */
function registerOperador() {
    // Tenta obter nome do operador do localStorage ou usa padrao
    const userData = localStorage.getItem('userData');
    if (userData) {
        try {
            const user = JSON.parse(userData);
            state.operadorId = user.username || 'operador_1';
            state.operadorNome = user.name || 'Operador';
        } catch (e) {
            console.warn('[ChatProprio] Erro ao ler userData:', e);
        }
    }

    // Faz ping imediato
    ChatService.pingOperador(state.operadorId, state.operadorNome);

    // Configura ping periodico (a cada 1 minuto)
    if (state.pingInterval) {
        clearInterval(state.pingInterval);
    }
    state.pingInterval = setInterval(() => {
        ChatService.pingOperador(state.operadorId, state.operadorNome);
    }, 60000);

    // Remove operador ao sair da pagina
    window.addEventListener('beforeunload', () => {
        ChatService.operadorOffline(state.operadorId);
    });
}

/**
 * Callback para atualizacao de conversas
 */
function handleConversasUpdate(conversas) {
    state.conversas = conversas;
    renderConversas(conversas);
}

/**
 * Renderiza lista de conversas
 */
function renderConversas(conversas) {
    if (!elements.conversationsList) return;

    if (!conversas || conversas.length === 0) {
        elements.conversationsList.innerHTML = `
            <div class="no-conversations">
                <p>Nenhuma conversa ainda</p>
                <p class="hint">Aguardando mensagens de pacientes...</p>
            </div>
        `;
        return;
    }

    elements.conversationsList.innerHTML = conversas.map(conversa => {
        const isAtiva = state.conversaAtual && state.conversaAtual.id === conversa.id;
        const temNaoLidas = conversa.mensagens_nao_lidas_operador > 0;
        const iniciais = ChatService.getIniciais(conversa.paciente_nome || conversa.paciente_id);
        const ultimaMsgPreview = conversa.ultima_mensagem_preview || 'Sem mensagens';
        const ultimaMsgTime = conversa.ultima_mensagem_at
            ? ChatService.formatarDataHora(conversa.ultima_mensagem_at)
            : '';

        return `
            <div class="conversation-item ${isAtiva ? 'active' : ''} ${temNaoLidas ? 'unread' : ''}"
                 data-conversa-id="${conversa.id}"
                 onclick="window.chatProprio.selecionarConversa(${conversa.id})">
                <div class="conversation-avatar">${iniciais}</div>
                <div class="conversation-info">
                    <div class="conversation-header">
                        <span class="conversation-name">${conversa.paciente_nome || conversa.paciente_id}</span>
                        <span class="conversation-time">${ultimaMsgTime}</span>
                    </div>
                    <div class="conversation-preview">
                        ${temNaoLidas ? `<span class="unread-badge">${conversa.mensagens_nao_lidas_operador}</span>` : ''}
                        <span class="preview-text">${ultimaMsgPreview}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Filtra conversas por termo de busca
 */
function filtrarConversas(termo) {
    if (!termo) {
        renderConversas(state.conversas);
        return;
    }

    const filtradas = state.conversas.filter(c =>
        (c.paciente_nome && c.paciente_nome.toLowerCase().includes(termo)) ||
        (c.paciente_id && c.paciente_id.toLowerCase().includes(termo)) ||
        (c.paciente_telefone && c.paciente_telefone.includes(termo))
    );

    renderConversas(filtradas);
}

/**
 * Seleciona uma conversa
 */
export async function selecionarConversa(conversaId) {
    console.log('[ChatProprio] Selecionando conversa:', conversaId);

    // Para polling anterior
    ChatService.stopMensagensPolling();

    // Busca dados da conversa
    const conversa = await ChatService.getConversa(conversaId);
    if (!conversa) {
        console.error('[ChatProprio] Conversa nao encontrada');
        return;
    }

    state.conversaAtual = conversa;

    // Atualiza header
    updateChatHeader(conversa);

    // Mostra area de chat
    if (elements.noChatSelected) {
        elements.noChatSelected.style.display = 'none';
    }
    if (elements.chatActive) {
        elements.chatActive.style.display = 'flex';
    }

    // Marca como lidas
    await ChatService.marcarComoLidas(conversaId, 'operador');

    // Inicia polling de mensagens
    ChatService.startMensagensPolling(conversaId, handleMensagensUpdate, 2000);

    // Atualiza lista de conversas (para remover badge)
    renderConversas(state.conversas);
}

/**
 * Atualiza header do chat
 */
function updateChatHeader(conversa) {
    if (elements.contactName) {
        elements.contactName.textContent = conversa.paciente_nome || conversa.paciente_id;
    }
    if (elements.contactStatus) {
        elements.contactStatus.textContent = conversa.paciente_telefone || 'Paciente';
    }
    if (elements.contactAvatar) {
        const iniciais = ChatService.getIniciais(conversa.paciente_nome || conversa.paciente_id);
        elements.contactAvatar.innerHTML = `<span>${iniciais}</span>`;
        elements.contactAvatar.className = 'contact-avatar avatar-paciente';
    }
}

/**
 * Callback para atualizacao de mensagens
 */
function handleMensagensUpdate(mensagens, saoNovas) {
    if (saoNovas) {
        // Adiciona novas mensagens
        mensagens.forEach(msg => {
            appendMensagem(msg);
        });
        scrollToBottom();
    } else {
        // Renderiza todas as mensagens
        state.mensagens = mensagens;
        renderMensagens(mensagens);
    }
}

/**
 * Renderiza todas as mensagens
 */
function renderMensagens(mensagens) {
    if (!elements.messagesList) return;

    if (!mensagens || mensagens.length === 0) {
        elements.messagesList.innerHTML = `
            <div class="no-messages">
                <p>Nenhuma mensagem ainda</p>
                <p class="hint">Inicie a conversa enviando uma mensagem</p>
            </div>
        `;
        return;
    }

    elements.messagesList.innerHTML = mensagens.map(msg => getMensagemHTML(msg)).join('');
    scrollToBottom();
}

/**
 * Adiciona uma mensagem ao final
 */
function appendMensagem(msg) {
    if (!elements.messagesList) return;

    // Remove mensagem "sem mensagens" se existir
    const noMessages = elements.messagesList.querySelector('.no-messages');
    if (noMessages) {
        noMessages.remove();
    }

    const div = document.createElement('div');
    div.innerHTML = getMensagemHTML(msg);
    elements.messagesList.appendChild(div.firstElementChild);
}

/**
 * Gera HTML de uma mensagem
 */
function getMensagemHTML(msg) {
    const isOperador = msg.remetente_tipo === 'operador';
    const hora = ChatService.formatarDataHora(msg.created_at);

    return `
        <div class="message ${isOperador ? 'message-sent' : 'message-received'}">
            <div class="message-content">
                <p>${formatMessageText(msg.conteudo)}</p>
                <span class="message-time">${hora}</span>
            </div>
        </div>
    `;
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
 * Formata texto com markdown para HTML
 * Converte *texto* para <strong>texto</strong>
 * Converte _texto_ para <em>texto</em>
 * Preserva quebras de linha como <br>
 * Previne XSS escapando HTML primeiro
 */
function formatMessageText(text) {
    if (!text) return '';

    // Primeiro escapa todo HTML para prevenir XSS
    let formatted = escapeHtml(text);

    // Converte *texto* para <strong>texto</strong> (negrito)
    formatted = formatted.replace(/\*(.*?)\*/g, '<strong>$1</strong>');

    // Converte _texto_ para <em>texto</em> (itálico)
    formatted = formatted.replace(/_(.*?)_/g, '<em>$1</em>');

    // Converte quebras de linha para <br>
    formatted = formatted.replace(/\n/g, '<br>');

    return formatted;
}

/**
 * Rola para o final das mensagens
 */
function scrollToBottom() {
    if (elements.messagesList) {
        elements.messagesList.scrollTop = elements.messagesList.scrollHeight;
    }
}

/**
 * Envia mensagem
 */
async function enviarMensagem() {
    if (!state.conversaAtual) {
        console.warn('[ChatProprio] Nenhuma conversa selecionada');
        return;
    }

    const conteudo = elements.messageInput.value.trim();
    if (!conteudo) return;

    try {
        // Limpa input
        elements.messageInput.value = '';
        elements.messageInput.style.height = 'auto';

        // Envia mensagem
        const mensagem = await ChatService.enviarMensagem({
            conversaId: state.conversaAtual.id,
            remetenteTipo: 'operador',
            remetenteId: state.operadorId,
            remetenteNome: state.operadorNome,
            conteudo: conteudo
        });

        // Adiciona mensagem na UI
        appendMensagem(mensagem);
        scrollToBottom();

        console.log('[ChatProprio] Mensagem enviada:', mensagem.id);
    } catch (error) {
        console.error('[ChatProprio] Erro ao enviar mensagem:', error);
        alert('Erro ao enviar mensagem. Tente novamente.');

        // Restaura texto no input
        elements.messageInput.value = conteudo;
    }
}

/**
 * Cria nova conversa
 */
async function criarNovaConversa() {
    const pacienteId = elements.newChatNumber.value.trim();
    if (!pacienteId) {
        alert('Informe o prontuario ou identificador do paciente');
        return;
    }

    try {
        const conversa = await ChatService.getOrCreateConversa(pacienteId);

        // Fecha modal
        elements.newChatModal.style.display = 'none';

        // Adiciona a conversa na lista se nao existir
        const existe = state.conversas.find(c => c.id === conversa.id);
        if (!existe) {
            state.conversas.unshift(conversa);
            renderConversas(state.conversas);
        }

        // Seleciona a conversa
        selecionarConversa(conversa.id);

        console.log('[ChatProprio] Nova conversa criada:', conversa.id);
    } catch (error) {
        console.error('[ChatProprio] Erro ao criar conversa:', error);
        alert('Erro ao criar conversa. Tente novamente.');
    }
}

/**
 * Destroi o componente (cleanup)
 */
export function destroy() {
    ChatService.stopConversasPolling();
    ChatService.stopMensagensPolling();

    if (state.pingInterval) {
        clearInterval(state.pingInterval);
        state.pingInterval = null;
    }

    ChatService.operadorOffline(state.operadorId);
}

// Expoe funcoes globalmente para onclick no HTML
window.chatProprio = {
    selecionarConversa
};
