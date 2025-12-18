/**
 * Componente: Ações Pendentes
 * Interface para visualizar e gerenciar ações que precisam ser executadas no AGHUse
 *
 * Centraliza:
 * - Desmarcações solicitadas pelo paciente (via confirmação ou lembrete 72h)
 * - Reagendamentos solicitados (via desmarcação)
 */

import CONFIG from '../config/backend.config.js';
import * as ConsultasSQLite from '../services/consultasSQLite.service.js';
import { Toast } from '../utils/toast.js';

/**
 * Gera iniciais do nome para avatar
 */
function getInitials(nome) {
    if (!nome) return '?';
    const parts = nome.trim().split(' ').filter(p => p.length > 0);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Formata data para exibição
 */
function formatDate(dateStr) {
    if (!dateStr) return '-';
    try {
        const date = new Date(dateStr);
        return date.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return dateStr;
    }
}

// Estado do componente
const state = {
    acoes: [],
    filtroTipo: 'all',      // all, desmarcar, reagendar
    filtroOrigem: 'all',    // all, marcacao, lembrete72h, desmarcacao
    filtroNome: '',
    pollingInterval: null,
    isInitialized: false
};

// Elementos do DOM
const elements = {
    acoesList: null,
    searchInput: null,
    filterTipo: null,
    filterOrigem: null,
    statTotal: null,
    statDesmarcar: null,
    statReagendar: null,
    syncIndicator: null,
    badge: null
};

/**
 * Inicializa o componente
 */
export async function init() {
    // Evita múltiplas inicializações
    if (state.isInitialized) {
        console.log('[Ações] Componente já inicializado, pulando...');
        return;
    }

    console.log('[Ações] Inicializando componente...');

    // Captura elementos do DOM
    elements.acoesList = document.getElementById('acoes-list');
    elements.searchInput = document.getElementById('search-acoes');
    elements.filterTipo = document.getElementById('filter-tipo-acao');
    elements.filterOrigem = document.getElementById('filter-origem-acao');
    elements.statTotal = document.getElementById('stat-total-acoes');
    elements.statDesmarcar = document.getElementById('stat-desmarcar');
    elements.statReagendar = document.getElementById('stat-reagendar');
    elements.syncIndicator = document.getElementById('acoes-sync-indicator');
    elements.badge = document.getElementById('acoes-badge');

    // Event listeners
    elements.searchInput?.addEventListener('input', handleSearchInput);
    elements.filterTipo?.addEventListener('change', handleFilterChange);
    elements.filterOrigem?.addEventListener('change', handleFilterChange);

    // Clique nos cards de estatísticas para filtrar
    document.querySelectorAll('[data-filter-acoes]').forEach(card => {
        card.addEventListener('click', () => {
            const filter = card.dataset.filterAcoes;
            if (elements.filterTipo) {
                elements.filterTipo.value = filter === 'all' ? 'all' : filter;
                handleFilterChange();
            }
        });
    });

    // Carrega ações iniciais
    await loadAcoes();

    // Inicia polling para atualização automática
    startPolling();

    state.isInitialized = true;
    console.log('[Ações] Componente inicializado');
}

/**
 * Carrega ações pendentes do banco de dados
 */
async function loadAcoes() {
    try {
        // Busca confirmações com status 'declined' (paciente não irá)
        const confirmacoes = await fetchConfirmacoesDeclinadas();

        // Busca desmarcações com status 'reagendamento' (paciente quer reagendar)
        const desmarcacoes = await fetchDesmarcacoesReagendamento();

        // Combina e ordena por data
        state.acoes = [...confirmacoes, ...desmarcacoes].sort((a, b) => {
            const dateA = new Date(a.dataAcao || a.criadoEm);
            const dateB = new Date(b.dataAcao || b.criadoEm);
            return dateB - dateA; // Mais recentes primeiro
        });

        // Atualiza interface
        updateStats();
        renderAcoes();
        updateBadge();

        if (elements.syncIndicator) {
            elements.syncIndicator.textContent = '🟢 Sincronizado';
        }

    } catch (error) {
        console.error('[Ações] Erro ao carregar ações:', error);
        if (elements.syncIndicator) {
            elements.syncIndicator.textContent = '🔴 Erro';
        }
    }
}

/**
 * Busca confirmações declinadas (paciente disse que não irá)
 */
async function fetchConfirmacoesDeclinadas() {
    try {
        const response = await fetch(`${CONFIG.MAIN_BACKEND}/api/acoes/confirmacoes-declinadas`);
        if (!response.ok) {
            // Se endpoint não existe ainda, retorna array vazio
            if (response.status === 404) return [];
            throw new Error('Erro ao buscar confirmações');
        }
        const data = await response.json();

        // Mapeia para formato padronizado
        return (data.confirmacoes || []).map(c => ({
            id: c.id,
            tipo: 'desmarcar',
            pacienteNome: c.nome_paciente || c.nomePaciente,
            pacienteProntuario: c.prontuario,
            pacienteTelefone: c.telefone,
            especialidade: c.especialidade,
            dataConsulta: c.data_hora_formatada || c.dataHoraFormatada,
            consultaNumero: c.consulta_numero || c.consultaNumero,
            origem: c.tipo === 'lembrete72h' ? 'lembrete72h' : 'marcacao',
            origemLabel: c.tipo === 'lembrete72h' ? 'Lembrete 72h' : 'Marcação',
            dataAcao: c.atualizado_em || c.atualizadoEm,
            criadoEm: c.criado_em || c.criadoEm,
            statusOriginal: c.status_geral || c.statusGeral,
            confirmacaoId: c.id
        }));
    } catch (error) {
        console.warn('[Ações] Erro ao buscar confirmações declinadas:', error);
        return [];
    }
}

/**
 * Busca desmarcações que precisam de reagendamento
 */
async function fetchDesmarcacoesReagendamento() {
    try {
        const response = await fetch(`${CONFIG.MAIN_BACKEND}/api/acoes/desmarcacoes-reagendamento`);
        if (!response.ok) {
            if (response.status === 404) return [];
            throw new Error('Erro ao buscar desmarcações');
        }
        const data = await response.json();

        // Mapeia para formato padronizado
        return (data.desmarcacoes || []).map(d => ({
            id: d.id,
            tipo: 'reagendar',
            pacienteNome: d.nome_paciente || d.nomePaciente,
            pacienteProntuario: d.prontuario,
            pacienteTelefone: d.telefone,
            especialidade: d.especialidade,
            dataConsulta: d.data_hora_formatada || d.dataHoraFormatada,
            consultaNumero: d.consulta_numero || d.consultaNumero,
            origem: 'desmarcacao',
            origemLabel: 'Desmarcação',
            dataAcao: d.atualizado_em || d.atualizadoEm,
            criadoEm: d.criado_em || d.criadoEm,
            statusOriginal: d.status || d.tipoDesmarcacao,
            desmarcacaoId: d.id
        }));
    } catch (error) {
        console.warn('[Ações] Erro ao buscar desmarcações:', error);
        return [];
    }
}

/**
 * Inicia polling para atualização automática
 */
function startPolling() {
    if (state.pollingInterval) {
        clearInterval(state.pollingInterval);
    }

    // Atualiza a cada 10 segundos
    state.pollingInterval = setInterval(() => {
        loadAcoes();
    }, 10000);
}

/**
 * Para polling
 */
export function stopPolling() {
    if (state.pollingInterval) {
        clearInterval(state.pollingInterval);
        state.pollingInterval = null;
    }
}

/**
 * Atualiza estatísticas
 */
function updateStats() {
    const total = state.acoes.length;
    const desmarcar = state.acoes.filter(a => a.tipo === 'desmarcar').length;
    const reagendar = state.acoes.filter(a => a.tipo === 'reagendar').length;

    if (elements.statTotal) elements.statTotal.textContent = total;
    if (elements.statDesmarcar) elements.statDesmarcar.textContent = desmarcar;
    if (elements.statReagendar) elements.statReagendar.textContent = reagendar;
}

/**
 * Atualiza badge na navegação
 */
function updateBadge() {
    const total = state.acoes.length;

    if (elements.badge) {
        if (total > 0) {
            elements.badge.textContent = total > 99 ? '99+' : total;
            elements.badge.style.display = 'flex';
        } else {
            elements.badge.style.display = 'none';
        }
    }
}

/**
 * Atualiza badge externamente (chamado por outros componentes)
 */
export function refreshBadge() {
    loadAcoes();
}

/**
 * Renderiza lista de ações
 */
function renderAcoes() {
    if (!elements.acoesList) return;

    // Aplica filtros
    let acoesFiltradas = state.acoes;

    // Filtro por tipo
    if (state.filtroTipo !== 'all') {
        acoesFiltradas = acoesFiltradas.filter(a => a.tipo === state.filtroTipo);
    }

    // Filtro por origem
    if (state.filtroOrigem !== 'all') {
        acoesFiltradas = acoesFiltradas.filter(a => a.origem === state.filtroOrigem);
    }

    // Filtro por nome
    if (state.filtroNome) {
        const termo = state.filtroNome.toLowerCase();
        acoesFiltradas = acoesFiltradas.filter(a =>
            a.pacienteNome?.toLowerCase().includes(termo) ||
            a.pacienteProntuario?.includes(termo)
        );
    }

    // Se não há ações, mostra estado vazio
    if (acoesFiltradas.length === 0) {
        elements.acoesList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">✅</div>
                <h3>Nenhuma ação pendente</h3>
                <p>${state.acoes.length === 0
                    ? 'Todas as ações foram concluídas. Bom trabalho!'
                    : 'Nenhuma ação corresponde aos filtros selecionados.'}</p>
            </div>
        `;
        return;
    }

    // Renderiza ações
    elements.acoesList.innerHTML = acoesFiltradas.map(acao => renderAcaoItem(acao)).join('');

    // Adiciona event listeners aos botões
    acoesFiltradas.forEach(acao => {
        const btnConcluir = document.getElementById(`btn-concluir-${acao.id}`);
        const btnCopiar = document.getElementById(`btn-copiar-${acao.id}`);
        const btnChat = document.getElementById(`btn-chat-${acao.id}`);

        btnConcluir?.addEventListener('click', () => handleConcluirAcao(acao));
        btnCopiar?.addEventListener('click', () => handleCopiarDados(acao));
        btnChat?.addEventListener('click', () => handleAbrirChat(acao));
    });
}

/**
 * Renderiza um item de ação
 */
function renderAcaoItem(acao) {
    const initials = getInitials(acao.pacienteNome);
    const isDesmarcar = acao.tipo === 'desmarcar';

    // Badge de tipo
    const tipoBadge = isDesmarcar
        ? '<span class="badge badge-desmarcar">D</span>'
        : '<span class="badge badge-reagendar">R</span>';

    // Badge de origem
    let origemBadge = '';
    if (acao.origem === 'lembrete72h') {
        origemBadge = '<span class="badge badge-lembrete">72h</span>';
    } else if (acao.origem === 'marcacao') {
        origemBadge = '<span class="badge badge-marcacao">M</span>';
    }

    return `
        <div class="confirmacao-item acao-item ${isDesmarcar ? 'acao-desmarcar' : 'acao-reagendar'}" data-id="${acao.id}">
            <div class="item-avatar">
                <span class="avatar-initials">${initials}</span>
            </div>
            <div class="item-content">
                <div class="item-header">
                    <span class="item-name">${acao.pacienteNome || 'Paciente'}</span>
                    <div class="item-badges">
                        ${tipoBadge}
                        ${origemBadge}
                    </div>
                </div>
                <div class="item-details">
                    <span class="detail-item">
                        <strong>Prontuário:</strong> ${acao.pacienteProntuario || '-'}
                    </span>
                    <span class="detail-item">
                        <strong>Especialidade:</strong> ${acao.especialidade || '-'}
                    </span>
                    <span class="detail-item">
                        <strong>Consulta:</strong> ${acao.dataConsulta || '-'}
                    </span>
                </div>
                <div class="item-action-info">
                    <span class="action-type ${isDesmarcar ? 'type-desmarcar' : 'type-reagendar'}">
                        ${isDesmarcar ? '🔴 DESMARCAR no AGHUse' : '🟠 REAGENDAR no AGHUse'}
                    </span>
                    <span class="action-date">
                        Solicitado em: ${formatDate(acao.dataAcao)}
                    </span>
                </div>
            </div>
            <div class="item-actions">
                <button id="btn-copiar-${acao.id}" class="btn-action btn-secondary" title="Copiar dados para colar no AGHUse">
                    📋 Copiar
                </button>
                <button id="btn-chat-${acao.id}" class="btn-action btn-secondary" title="Abrir chat com paciente">
                    💬 Chat
                </button>
                <button id="btn-concluir-${acao.id}" class="btn-action btn-primary" title="Marcar como concluída">
                    ✅ Concluir
                </button>
            </div>
        </div>
    `;
}

/**
 * Handler: Busca por nome
 */
function handleSearchInput(event) {
    state.filtroNome = event.target.value;
    renderAcoes();
}

/**
 * Handler: Mudança de filtro
 */
function handleFilterChange() {
    state.filtroTipo = elements.filterTipo?.value || 'all';
    state.filtroOrigem = elements.filterOrigem?.value || 'all';
    renderAcoes();
}

/**
 * Handler: Concluir ação
 */
async function handleConcluirAcao(acao) {
    const tipoAcao = acao.tipo === 'desmarcar' ? 'desmarcação' : 'reagendamento';

    if (!confirm(`Confirma que a ${tipoAcao} foi realizada no AGHUse?\n\nPaciente: ${acao.pacienteNome}\nConsulta: ${acao.dataConsulta}`)) {
        return;
    }

    try {
        // Marca ação como concluída no backend
        const response = await fetch(`${CONFIG.MAIN_BACKEND}/api/acoes/concluir`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                acaoId: acao.id,
                tipo: acao.tipo,
                confirmacaoId: acao.confirmacaoId,
                desmarcacaoId: acao.desmarcacaoId
            })
        });

        if (!response.ok) {
            throw new Error('Erro ao concluir ação');
        }

        // Remove da lista local
        state.acoes = state.acoes.filter(a => a.id !== acao.id);

        // Atualiza interface
        updateStats();
        renderAcoes();
        updateBadge();

        Toast.success(`${tipoAcao.charAt(0).toUpperCase() + tipoAcao.slice(1)} concluída!`);

    } catch (error) {
        console.error('[Ações] Erro ao concluir ação:', error);
        Toast.error('Erro ao concluir ação. Tente novamente.');
    }
}

/**
 * Handler: Copiar dados para AGHUse
 */
function handleCopiarDados(acao) {
    const dados = `Paciente: ${acao.pacienteNome}
Prontuário: ${acao.pacienteProntuario}
Especialidade: ${acao.especialidade}
Consulta: ${acao.dataConsulta}
Ação: ${acao.tipo === 'desmarcar' ? 'DESMARCAR' : 'REAGENDAR'}`;

    navigator.clipboard.writeText(dados).then(() => {
        Toast.success('Dados copiados! Cole no AGHUse.');
    }).catch(() => {
        Toast.error('Erro ao copiar dados.');
    });
}

/**
 * Handler: Abrir chat com paciente
 */
function handleAbrirChat(acao) {
    // Navega para aba de chat e busca conversa do paciente
    const chatTab = document.querySelector('[data-tab="chat"]');
    if (chatTab) {
        chatTab.click();

        // Dispara evento customizado para abrir conversa específica
        window.dispatchEvent(new CustomEvent('open-chat-paciente', {
            detail: {
                prontuario: acao.pacienteProntuario,
                nome: acao.pacienteNome
            }
        }));
    }
}

/**
 * Adiciona uma nova ação (chamado externamente)
 */
export function addAcao(acao) {
    // Verifica se já existe
    const existe = state.acoes.find(a => a.id === acao.id);
    if (existe) return;

    state.acoes.unshift(acao);
    updateStats();
    renderAcoes();
    updateBadge();
}

/**
 * Remove uma ação (chamado externamente)
 */
export function removeAcao(acaoId) {
    state.acoes = state.acoes.filter(a => a.id !== acaoId);
    updateStats();
    renderAcoes();
    updateBadge();
}

/**
 * Retorna total de ações pendentes
 */
export function getTotalAcoes() {
    return state.acoes.length;
}

// Exporta para uso externo
export default {
    init,
    stopPolling,
    refreshBadge,
    addAcao,
    removeAcao,
    getTotalAcoes
};
