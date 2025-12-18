/**
 * Componente: Confirmação de Presença
 * Interface para visualizar e gerenciar confirmações de consultas
 */

import CONFIG from '../config/backend.config.js';
import * as ConfirmacaoService from '../services/confirmacao.service.js';
import * as Lembrete72hService from '../services/lembrete72h.service.js';
import * as AghuseService from '../services/aghuse.service.js';
import * as MonitoramentoGlobal from '../services/monitoramentoGlobal.service.js';
import * as ReagendamentoLinker from '../services/reagendamentoLinker.service.js';
import * as HeaderClone from '../utils/headerClone.js';
import { PhoneNormalizer } from '../utils/phoneNormalizer.js';
import { Toast } from '../utils/toast.js';
import * as ConsultasSQLite from '../services/consultasSQLite.service.js';

// Helper: Converte Markdown (*negrito*) para HTML <strong>
function formatMarkdownToHTML(text) {
    if (!text) return text;

    // Converte *texto* para <strong>texto</strong>
    // Regex: captura texto entre asteriscos (sem asteriscos dentro)
    return text.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
}

// Helper: Trunca texto se ultrapassar o limite
function truncateText(text, maxLength = 30) {
    if (!text) return text;
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * Gera iniciais do nome para avatar
 * @param {string} nome - Nome completo
 * @returns {string} Iniciais (máx 2 letras)
 */
function getInitials(nome) {
    if (!nome) return '?';
    const parts = nome.trim().split(' ').filter(p => p.length > 0);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0][0].toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Detecta se está em admin.html (VM com envio automático)
const isAdminInterface = window.location.pathname.includes('admin.html');

// Estado do componente
const state = {
    initialized: false, // Flag para evitar múltiplas inicializações
    monitoringActive: false,
    confirmations: [],
    confirmationsArquivadas: [], // Confirmações arquivadas (carregadas do banco)
    filtroStatus: 'all',
    filtroNome: '', // Filtro de busca por nome
    mostrarArquivados: false, // Checkbox de mostrar arquivados
    unregisterCallback: null, // Função para remover callback do monitoramento global
    autoSendEnabled: false // SEMPRE DESABILITADO - envio manual apenas
};

// Elementos do DOM
const elements = {
    clearConfirmationsBtn: null,
    aghuseIndicator: null,
    monitoringIndicator: null,
    statTotalConfirmacoes: null,
    statPendentes: null,
    statConfirmadas: null,
    statDeclinadas: null,
    statNaoAgendou: null,
    confirmacoesList: null,
    filterStatus: null,
    autoSendToggle: null,
    searchInput: null, // Campo de busca
    mostrarArquivadosCheckbox: null // Checkbox mostrar arquivados
};

/**
 * Inicializa o componente
 */
export async function init() {
    // Evita múltiplas inicializações
    if (state.initialized) {
        console.log('[Confirmação] Componente já inicializado, pulando...');
        return;
    }
    state.initialized = true;

    console.log('[Confirmação] Inicializando componente...');

    // Captura elementos do DOM
    elements.clearConfirmationsBtn = document.getElementById('clear-confirmations-btn');
    elements.aghuseIndicator = document.getElementById('aghuse-indicator');
    elements.monitoringIndicator = document.getElementById('monitoring-indicator');
    elements.statTotalConfirmacoes = document.getElementById('stat-total-confirmacoes');
    elements.statPendentes = document.getElementById('stat-pendentes');
    elements.statConfirmadas = document.getElementById('stat-confirmadas');
    elements.statDeclinadas = document.getElementById('stat-declinadas');
    elements.statNaoAgendou = document.getElementById('stat-nao-agendou');
    elements.confirmacoesList = document.getElementById('confirmacoes-list');
    elements.filterStatus = document.getElementById('filter-status');
    elements.autoSendToggle = document.getElementById('auto-send-toggle-confirmacao');
    elements.searchInput = document.getElementById('search-confirmacao');
    elements.mostrarArquivadosCheckbox = document.getElementById('mostrar-arquivados-confirmacao');

    // Carrega preferência de envio automático do localStorage
    const savedAutoSend = localStorage.getItem('hmasp_auto_send_confirmacao');
    if (savedAutoSend !== null) {
        state.autoSendEnabled = savedAutoSend === 'true';
        if (elements.autoSendToggle) {
            elements.autoSendToggle.checked = state.autoSendEnabled;
        }
    }

    // Event listeners
    elements.clearConfirmationsBtn?.addEventListener('click', handleClearConfirmations);
    elements.filterStatus?.addEventListener('change', handleFilterChange);
    elements.autoSendToggle?.addEventListener('change', handleAutoSendToggle);
    elements.searchInput?.addEventListener('input', handleSearchInput);
    elements.mostrarArquivadosCheckbox?.addEventListener('change', handleMostrarArquivadosChange);

    // Stat cards como filtros clicáveis
    const statCards = document.querySelectorAll('.stat-card[data-filter]');
    console.log('[Confirmação] 🔍 Cards com filtro encontrados:', statCards.length);
    statCards.forEach(card => {
        card.addEventListener('click', (e) => {
            e.stopPropagation(); // Previne propagação do evento
            const filterValue = card.getAttribute('data-filter');
            console.log('[Confirmação] 🎯 Card clicado! Filtro:', filterValue);
            if (elements.filterStatus) {
                // Atualiza o valor do dropdown
                elements.filterStatus.value = filterValue;

                // Dispara o evento change manualmente para aplicar o filtro
                const changeEvent = new Event('change', { bubbles: true });
                elements.filterStatus.dispatchEvent(changeEvent);

                console.log('[Confirmação] ✅ Filtro aplicado:', filterValue);
            } else {
                console.error('[Confirmação] ❌ Dropdown não encontrado!');
            }
        });
    });

    // TEMPORÁRIO: Limpa dados antigos para forçar reprocessamento com dataMarcacao
    const needsReprocess = localStorage.getItem('hmasp_needs_reprocess');
    if (needsReprocess !== 'done_v6') {  // v6: adicionado dataMarcacao ao objeto confirmation
        console.log('[Confirmação] 🧹 Limpando dados antigos para reprocessar com dataMarcacao...');
        localStorage.removeItem('hmasp_confirmations');
        localStorage.setItem('hmasp_needs_reprocess', 'done_v6');

        // Limpa banco também
        try {
            await fetch(`${CONFIG.DATABASE_BACKEND}/api/database/monitoramento/clear`);
            console.log('[Confirmação] ✅ Banco limpo');
        } catch (error) {
            console.warn('[Confirmação] Erro ao limpar banco:', error);
        }

        // Recarrega a página para buscar consultas novas
        console.log('[Confirmação] 🔄 Recarregando para buscar consultas atualizadas...');
        setTimeout(() => window.location.reload(), 500);
        return; // Para a execução aqui
    }

    // Migra dados antigos do localStorage para SQLite (se existirem)
    loadConfirmationsFromStorage();

    // Carrega confirmações do SQLite (sistema multi-usuário)
    await loadConfirmationsFromSQLite();

    // Inicia sincronização de headers entre abas
    setupAllTabsEventListeners();

    // Inicia monitoramento automaticamente
    await autoStartMonitoring();

    // Inicia monitoramento de lembretes 72h
    await startLembrete72hMonitoring();

    // Respostas dos pacientes são processadas automaticamente via Chat Próprio
    // O endpoint /api/chat-proprio/acao-resposta atualiza o status diretamente no SQLite
    console.log('[Confirmação] 📱 Respostas processadas via Chat Próprio');

    // Inicia auto-arquivamento periódico (a cada 1 hora)
    startAutoArquivamento();

    // Inicia sincronização de badges com SQLite (Sistema Multi-Usuário)
    console.log('[Badges] Iniciando sincronização com SQLite...');
    await syncBadgesWithConfirmations(); // Sincronização inicial
    setInterval(async () => {
        await syncBadgesWithConfirmations();
    }, 10000); // Sincroniza a cada 10 segundos

    // Escuta eventos de mudança no toggle (quando o botão é clonado)
    window.addEventListener('confirmacao-toggle-changed', (e) => {
        state.autoSendEnabled = e.detail.enabled;

        if (state.autoSendEnabled) {
            console.log('[Confirmação] ✅ Envio automático HABILITADO');
            Toast.success('Envio Automático', 'Mensagens serão enviadas automaticamente', 3000);
        } else {
            console.log('[Confirmação] ⏸️ Envio automático DESABILITADO');
            Toast.info('Envio Automático', 'Mensagens aguardam envio manual', 3000);
        }
    });

    console.log('[Confirmação] Componente inicializado');
}

// TabMaster REMOVIDO
// Agora usamos 2 navegadores separados:
// - Principal (index.html) = Operadores - Apenas visualiza
// - Admin (admin.html) = VM Ubuntu - Envia mensagens automaticamente

/**
 * Inicia a clonagem do header para as outras abas
 * O header da aba "Confirmação" é o principal e as outras apenas clonam
 */
function setupAllTabsEventListeners() {
    // Inicia a sincronização automática dos headers
    HeaderClone.startHeaderSync();

    console.log('[Confirmação] Sincronização de headers iniciada - todas as abas mostram o mesmo componente');
}

/**
 * Inicia monitoramento automaticamente ao carregar
 */
async function autoStartMonitoring() {
    try {
        console.log('[Confirmação] 🚀 Iniciando monitoramento automático...');

        // Registra callback para receber notificações de novas consultas
        state.unregisterCallback = MonitoramentoGlobal.registerCallback(handleNewConfirmations);

        // Testa conexão com AGHUse (silencioso se falhar)
        try {
            const result = await AghuseService.testConnection();
            if (result.success) {
                elements.aghuseIndicator.innerHTML = '🟢 Conectado';
                elements.aghuseIndicator.style.color = '#10b981';
                console.log('[Confirmação] ✅ AGHUse conectado');
            } else {
                elements.aghuseIndicator.innerHTML = '🟡 Tentando...';
                elements.aghuseIndicator.style.color = '#f59e0b';
                // Não loga erro - vai tentar novamente automaticamente
            }
        } catch (error) {
            elements.aghuseIndicator.innerHTML = '🟡 Tentando...';
            elements.aghuseIndicator.style.color = '#f59e0b';
            // Não loga erro - vai tentar novamente automaticamente
        }

        // Inicia monitoramento global
        await MonitoramentoGlobal.start();

        // Atualiza UI para estado ativo
        state.monitoringActive = true;
        elements.monitoringIndicator.innerHTML = '🟢 Ativo';
        elements.monitoringIndicator.style.color = '#10b981';

        console.log('[Confirmação] ✅ Monitoramento iniciado automaticamente');

    } catch (error) {
        console.error('[Confirmação] ❌ Erro ao iniciar monitoramento automático:', error);
        elements.monitoringIndicator.innerHTML = '🔴 Erro';
        elements.monitoringIndicator.style.color = '#ef4444';
    }
}

/**
 * Inicia monitoramento de lembretes 72h
 */
async function startLembrete72hMonitoring() {
    try {
        console.log('[Lembrete 72h] 🚀 Iniciando monitoramento de lembretes 72h...');

        // Inicia monitoramento (verifica a cada 1 hora)
        await Lembrete72hService.startMonitoring(handleNewLembretes72h, 3600000);

        console.log('[Lembrete 72h] ✅ Monitoramento de lembretes 72h iniciado');

    } catch (error) {
        console.error('[Lembrete 72h] ❌ Erro ao iniciar monitoramento de lembretes 72h:', error);
    }
}

/**
 * Callback quando novos lembretes 72h são encontrados
 */
async function handleNewLembretes72h(newConfirmations) {
    console.log('[Lembrete 72h] 📩 Novos lembretes 72h:', newConfirmations.length);

    // Adiciona à lista existente (mesma estrutura de confirmação)
    // Remove duplicatas - usa chave composta COMPLETA incluindo dataMarcacao
    // CHAVE: consultaNumero + prontuario + dataHoraFormatada + dataMarcacao
    // Isso permite que a mesma consulta marcada várias vezes apareça cada vez
    const existingKeys = new Set(
        state.confirmations.map(c => `${c.consultaNumero}-${c.prontuario}-${c.dataHoraFormatada}-${c.dataMarcacao || ''}`)
    );

    const reallyNew = newConfirmations.filter(c => {
        const key = `${c.consultaNumero}-${c.prontuario}-${c.dataHoraFormatada}-${c.dataMarcacao || ''}`;
        return !existingKeys.has(key) && !c.arquivada;
    });

    if (reallyNew.length === 0) {
        console.log('[Lembrete 72h] Nenhum lembrete novo (duplicatas ignoradas)');
        return;
    }

    // Marca como lembrete 72h para exibição do badge
    // E adiciona dataApareceuDashboard (data atual - momento que apareceu)
    const agora = new Date().toISOString();
    reallyNew.forEach(c => {
        c.tipo = 'lembrete72h';
        c.dataApareceuDashboard = agora; // IMPORTANTE: registra quando apareceu no dashboard
    });

    // Salva no SQLite (sistema multi-usuário)
    console.log('[Lembrete 72h] Salvando no SQLite...');
    const resultadoSave = await ConsultasSQLite.saveConsultasAtivasBatch(reallyNew);
    console.log(`[Lembrete 72h] ✅ SQLite: ${resultadoSave.salvos}/${resultadoSave.total} lembretes salvos`);

    // Adiciona ao estado (lembretes no topo)
    state.confirmations = [
        ...reallyNew,
        ...state.confirmations
    ];

    // Atualiza interface
    renderConfirmations();
    updateStats();

    // Mostra notificação
    const msg = `${reallyNew.length} lembrete(s) 72h adicionado(s)`;
    console.log(`[Lembrete 72h] ${msg}`);

    // Verifica se está em modo admin
    if (window.IS_ADMIN_MODE) {
        // ✅ ENVIO AUTOMÁTICO - Modo Admin
        console.log('[Lembrete 72h] 🤖 MODO ADMIN - Enviando mensagens automaticamente');
        Toast.success('Admin: Envio automático', `${msg}. Enviando automaticamente...`, 5000);

        // Envia mensagens automaticamente
        await autoSendMessages(reallyNew);
    } else {
        // ✅ ENVIO MANUAL - Modo Operador
        console.log('[Lembrete 72h] ⏸️ Envio manual - aguardando operador clicar em "Enviar Mensagem"');
        Toast.info('Lembretes 72h', `${msg}. Clique em "Enviar Mensagem" para notificar os pacientes.`, 5000);
    }
}

/**
 * Trata mudança no toggle de envio automático
 */
function handleAutoSendToggle(e) {
    state.autoSendEnabled = e.target.checked;

    if (state.autoSendEnabled) {
        console.log('[Confirmação] ✅ Envio automático HABILITADO');
        Toast.success('Envio Automático', 'Mensagens serão enviadas automaticamente', 3000);
    } else {
        console.log('[Confirmação] ⏸️ Envio automático DESABILITADO');
        Toast.info('Envio Automático', 'Mensagens aguardam envio manual', 3000);
    }

    // Salva preferência no localStorage
    localStorage.setItem('hmasp_auto_send_confirmacao', state.autoSendEnabled);
}

/**
 * Trata mudança no campo de busca
 */
function handleSearchInput(e) {
    state.filtroNome = e.target.value.trim();
    console.log('[Confirmação] 🔍 Busca:', state.filtroNome);

    // Se checkbox está marcado e tem texto na busca, busca no banco
    if (state.mostrarArquivados && state.filtroNome.length >= 2) {
        buscarArquivadas(state.filtroNome);
    } else {
        // Renderiza apenas confirmações ativas filtradas
        renderConfirmations();
    }
}

/**
 * Trata mudança no checkbox Mostrar Arquivados
 */
async function handleMostrarArquivadosChange(e) {
    state.mostrarArquivados = e.target.checked;
    console.log('[Confirmação] 📦 Mostrar arquivados:', state.mostrarArquivados);

    if (state.mostrarArquivados) {
        // Se tem filtro de busca, busca arquivadas
        if (state.filtroNome.length >= 2) {
            await buscarArquivadas(state.filtroNome);
        } else {
            // Busca todas as arquivadas (limita a 100)
            await buscarTodasArquivadas();
        }
    } else {
        // Limpa arquivadas e mostra apenas ativas
        state.confirmationsArquivadas = [];
        renderConfirmations();
    }
}

/**
 * Busca confirmações arquivadas por nome
 */
async function buscarArquivadas(nome) {
    try {
        console.log(`[Confirmação] 🔍 Buscando arquivadas: "${nome}"`);

        const response = await fetch(`/api/arquivamento/buscar?nome=${encodeURIComponent(nome)}`);
        const data = await response.json();

        if (!data.success) {
            console.error('[Confirmação] Erro ao buscar arquivadas:', data.error);
            Toast.error('Erro', 'Falha ao buscar confirmações arquivadas', 3000);
            return;
        }

        state.confirmationsArquivadas = data.confirmacoes;
        console.log(`[Confirmação] ✅ ${data.confirmacoes.length} arquivadas encontradas`);

        renderConfirmations();

        if (data.confirmacoes.length === 0) {
            Toast.info('Busca', 'Nenhuma confirmação arquivada encontrada', 3000);
        }
    } catch (error) {
        console.error('[Confirmação] Erro ao buscar arquivadas:', error);
        Toast.error('Erro', 'Falha na conexão com o servidor', 3000);
    }
}

/**
 * Busca todas as confirmações arquivadas
 */
async function buscarTodasArquivadas() {
    try {
        console.log('[Confirmação] 📦 Carregando todas as arquivadas...');

        const response = await fetch('/api/arquivamento/todas?limit=100');
        const data = await response.json();

        if (!data.success) {
            console.error('[Confirmação] Erro ao buscar todas:', data.error);
            Toast.error('Erro', 'Falha ao buscar confirmações arquivadas', 3000);
            return;
        }

        state.confirmationsArquivadas = data.confirmacoes;
        console.log(`[Confirmação] ✅ ${data.confirmacoes.length} arquivadas carregadas (total: ${data.total})`);

        renderConfirmations();

        Toast.info('Arquivadas', `${data.confirmacoes.length} confirmações arquivadas carregadas`, 3000);
    } catch (error) {
        console.error('[Confirmação] Erro ao buscar todas:', error);
        Toast.error('Erro', 'Falha na conexão com o servidor', 3000);
    }
}

/**
 * Arquiva automaticamente confirmações com 72h+
 * Executado periodicamente
 */
async function autoArquivarAntigas() {
    try {
        console.log('[Confirmação] 🕐 Verificando confirmações para auto-arquivamento (72h+)...');

        // Filtra confirmações antigas localmente (evita payload grande)
        const agora = new Date();
        const HORAS_72 = 72 * 60 * 60 * 1000;

        const confirmacoesPraArquivar = state.confirmations.filter(c => {
            const dataReferencia = c.dataApareceuDashboard || c.dataMarcacao;
            if (!dataReferencia) return false;

            const dataRef = new Date(dataReferencia);
            const diffMs = agora - dataRef;
            return diffMs >= HORAS_72; // Antigas (72h+)
        });

        if (confirmacoesPraArquivar.length === 0) {
            console.log('[Confirmação] ✅ Nenhuma confirmação antiga para arquivar');
            return;
        }

        console.log(`[Confirmação] 📦 Enviando ${confirmacoesPraArquivar.length} confirmações para arquivar...`);

        // Envia apenas as confirmações antigas para o backend arquivar
        const response = await fetch('/api/arquivamento/auto-arquivar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirmacoes: confirmacoesPraArquivar })
        });

        const data = await response.json();

        if (!data.success) {
            console.error('[Confirmação] Erro ao auto-arquivar:', data.error);
            return;
        }

        if (data.arquivadas > 0) {
            console.log(`[Confirmação] 📦 ${data.arquivadas} confirmações arquivadas automaticamente`);

            // Remove confirmações arquivadas do state
            // IMPORTANTE: Usa dataApareceuDashboard e NÃO dataMarcacao
            const agora = new Date();
            const HORAS_72 = 72 * 60 * 60 * 1000;

            state.confirmations = state.confirmations.filter(c => {
                // Usa dataApareceuDashboard se existir, senão tenta dataMarcacao (fallback)
                const dataReferencia = c.dataApareceuDashboard || c.dataMarcacao;

                if (!dataReferencia) return true; // Mantém se não tem data

                const dataRef = new Date(dataReferencia);
                const diffMs = agora - dataRef;
                return diffMs < HORAS_72; // Mantém apenas as que têm menos de 72h no dashboard
            });

            // Salva no localStorage
            saveConfirmationsToStorage();

            // Atualiza UI
            renderConfirmations();
            updateStats();

            Toast.info('Arquivamento', `${data.arquivadas} confirmações arquivadas (72h+ no dashboard)`, 4000);
        }
    } catch (error) {
        console.error('[Confirmação] Erro no auto-arquivamento:', error);
    }
}

/**
 * Salva confirmações no localStorage
 */
/**
 * Salva confirmações no SQLite (substitui localStorage)
 * @deprecated Salvar consultas individuais diretamente com ConsultasSQLite.saveConsultaAtiva()
 */
async function saveConfirmationsToSQLite() {
    console.warn('[Confirmação] ⚠️ saveConfirmationsToSQLite() está deprecated - use ConsultasSQLite.saveConsultaAtiva() diretamente');
    // Esta função não é mais necessária porque salvamos consultas individuais
    // no momento que são criadas/atualizadas
}

/**
 * LEGADO: Salva no localStorage
 * @deprecated Não usado mais - agora salva diretamente no SQLite
 */
function saveConfirmationsToStorage() {
    // Função mantida apenas para compatibilidade com código legado
    // Não faz nada - salvar no SQLite acontece via API
    console.log('[Confirmação] localStorage desabilitado - usando SQLite');
}

/**
 * Carrega confirmações do SQLite (substitui localStorage)
 */
async function loadConfirmationsFromSQLite() {
    try {
        console.log('[Confirmação] Carregando consultas do SQLite...');

        // Busca todas as consultas ativas do banco
        const consultas = await ConsultasSQLite.getAllConsultasAtivas();

        if (consultas.length > 0) {
            // Converte formato snake_case do SQLite para camelCase do frontend
            state.confirmations = consultas.map(c => ConsultasSQLite.convertSQLiteToFrontend(c));

            console.log(`[Confirmação] ${consultas.length} confirmações carregadas do SQLite`);

            // Renderiza na tela
            renderConfirmations();
            updateStats();
        } else {
            console.log('[Confirmação] Nenhuma confirmação no SQLite');
        }
    } catch (error) {
        console.error('[Confirmação] Erro ao carregar do SQLite:', error);
    }
}

/**
 * LEGADO: Carrega confirmações do localStorage (mantido para migração)
 * @deprecated Usar loadConfirmationsFromSQLite()
 */
async function loadConfirmationsFromStorage() {
    console.warn('[Confirmação] ⚠️ localStorage LEGADO - migrando para SQLite...');

    try {
        const saved = localStorage.getItem('hmasp_confirmations');
        if (saved) {
            const confirmations = JSON.parse(saved);

            if (confirmations.length > 0) {
                console.log(`[Confirmação] Encontradas ${confirmations.length} consultas no localStorage`);
                console.log('[Confirmação] Migrando para SQLite...');

                // Migra para o SQLite de forma assíncrona
                try {
                    const result = await ConsultasSQLite.saveConsultasAtivasBatch(confirmations);
                    console.log(`[Confirmação] ✅ Migração concluída: ${result.salvos}/${result.total} consultas`);

                    // Limpa localStorage após migração bem-sucedida
                    if (result.salvos > 0) {
                        localStorage.removeItem('hmasp_confirmations');
                        console.log('[Confirmação] localStorage limpo após migração');
                    }
                } catch (error) {
                    console.error('[Confirmação] ❌ Erro na migração:', error);
                }
            } else {
                console.log('[Confirmação] localStorage vazio');
            }
        }
    } catch (error) {
        console.error('[Confirmação] Erro ao migrar do localStorage:', error);
    }
}

/**
 * Busca badges do sistema SQLite Multi-Usuário
 * Retorna um mapa: consultaNumero -> badge
 */
async function fetchBadgesFromSQLite() {
    try {
        const response = await fetch(`${CONFIG.DATABASE_BACKEND}/api/badges`);
        if (!response.ok) {
            console.warn('[Badges] Erro ao buscar badges:', response.status);
            return new Map();
        }

        const data = await response.json();
        if (!data.success || !data.badges) {
            console.warn('[Badges] Resposta inválida:', data);
            return new Map();
        }

        // Cria um mapa consultaNumero -> badge
        const badgesMap = new Map();
        data.badges.forEach(badge => {
            badgesMap.set(badge.consulta_numero, badge);
        });

        console.log(`[Badges] ${data.badges.length} badges carregados do SQLite`);
        return badgesMap;
    } catch (error) {
        console.error('[Badges] Erro ao buscar badges:', error);
        return new Map();
    }
}

/**
 * Atualiza badgeStatus das confirmações com dados do SQLite
 */
async function syncBadgesWithConfirmations() {
    try {
        const badgesMap = await fetchBadgesFromSQLite();

        // Atualiza cada confirmação com o badge correspondente
        state.confirmations.forEach(confirmation => {
            const badge = badgesMap.get(String(confirmation.consultaNumero));

            // ✅ FILTRO: Só aplica badges tipo DESMARCAR (que teve vermelho antes)
            if (badge && badge.confirmacao_id && badge.confirmacao_id.startsWith('conf-') && badge.tipo_badge === 'DESMARCAR') {
                // Atualiza badgeStatus baseado no badge do SQLite
                if (badge.status_badge === 'verde') {
                    confirmation.badgeStatus = 'desmarcada'; // Badge verde
                    console.log(`[Confirmação] ✅ Badge VERDE para consulta ${confirmation.consultaNumero}`);
                } else if (badge.status_badge === 'vermelho') {
                    confirmation.badgeStatus = 'desmarcar'; // Badge vermelho
                    console.log(`[Confirmação] 🔴 Badge VERMELHO para consulta ${confirmation.consultaNumero}`);
                }

                // Armazena informações adicionais do badge para debug
                confirmation.badgeInfo = {
                    tipo: badge.tipo_badge,
                    status: badge.status_badge,
                    label: badge.label_badge,
                    cor: badge.cor_badge,
                    acaoOperador: badge.acao_operador
                };
            } else {
                // Sem badge no SQLite - remove badgeStatus se existir
                if (confirmation.badgeStatus === 'desmarcar' || confirmation.badgeStatus === 'desmarcada') {
                    delete confirmation.badgeStatus;
                    delete confirmation.badgeInfo;
                }
            }
        });

        // Re-renderiza para refletir as mudanças (não precisa salvar - badges já estão no SQLite)
        renderConfirmations();

        console.log('[Confirmação] Sincronização de badges completa');
    } catch (error) {
        console.error('[Confirmação] Erro ao sincronizar badges:', error);
    }
}


/**
 * Limpa todas as confirmações da lista (arquiva no SQLite)
 */
async function handleClearConfirmations() {
    const confirmar = confirm('Deseja arquivar todas as confirmações visíveis? (Elas ficarão disponíveis no histórico)');

    if (!confirmar) return;

    const total = state.confirmations.length;
    console.log(`[Confirmação] Arquivando ${total} consultas...`);

    // Arquiva todas as confirmações no SQLite
    let arquivadas = 0;
    for (const confirmation of state.confirmations) {
        try {
            const success = await ConsultasSQLite.arquivarConsulta(
                confirmation.id,
                'manual',
                'operador'
            );
            if (success) arquivadas++;
        } catch (error) {
            console.error('[Confirmação] Erro ao arquivar:', confirmation.consultaNumero, error);
        }
    }

    console.log(`[Confirmação] ✅ ${arquivadas}/${total} consultas arquivadas`);

    // Limpa estado local
    state.confirmations = [];

    // Atualiza interface
    renderConfirmations();
    updateStats();

    Toast.success('Arquivadas!', `${arquivadas} confirmações arquivadas (disponíveis no histórico)`, 3000);
}


/**
 * Callback quando novas confirmações são encontradas
 */
async function handleNewConfirmations(newConfirmations) {
    console.log('[Confirmação] Novas confirmações:', newConfirmations.length);

    // Remove duplicatas - usa chave composta COMPLETA incluindo dataMarcacao
    // CHAVE: consultaNumero + prontuario + dataHoraFormatada + dataMarcacao
    // Isso permite que a mesma consulta marcada várias vezes apareça cada vez
    const existingKeys = new Set(
        state.confirmations.map(c => `${c.consultaNumero}-${c.prontuario}-${c.dataHoraFormatada}-${c.dataMarcacao || ''}`)
    );

    const reallyNew = newConfirmations.filter(c => {
        const key = `${c.consultaNumero}-${c.prontuario}-${c.dataHoraFormatada}-${c.dataMarcacao || ''}`;
        return !existingKeys.has(key);
    });

    if (reallyNew.length === 0) {
        console.log('[Confirmação] Nenhuma confirmação nova (duplicatas ignoradas)');
        return;
    }

    // Marca como consulta marcada para exibição do badge
    // E adiciona dataApareceuDashboard (data atual - momento que apareceu)
    const agora = new Date().toISOString();
    reallyNew.forEach(c => {
        c.tipo = 'marcada';
        c.dataApareceuDashboard = agora; // IMPORTANTE: registra quando apareceu no dashboard
    });

    // Salva no SQLite (sistema multi-usuário)
    console.log('[Confirmação] Salvando no SQLite...');
    const resultadoSave = await ConsultasSQLite.saveConsultasAtivasBatch(reallyNew);
    console.log(`[Confirmação] ✅ SQLite: ${resultadoSave.salvos}/${resultadoSave.total} consultas salvas`);

    // ✅ REAGENDAMENTO LINKER: Tenta vincular cada nova consulta a pedidos de reagendamento
    console.log('[Confirmação] Verificando se alguma consulta é um reagendamento...');
    for (const consulta of reallyNew) {
        // Método 1: Tenta vincular com pedido de reagendamento via Chat (paciente respondeu "1")
        const linkResult = await ReagendamentoLinker.tryLinkNovaConsulta(consulta);

        // Método 2: Se não encontrou pedido via Chat, tenta match automático
        // (mesmo prontuário + mesma especialidade + desmarcação nas últimas 72h)
        if (!linkResult.linked) {
            await ReagendamentoLinker.tryLinkToRecentDesmarcacao(consulta);
        }
    }

    // Adiciona ao estado local (somente as realmente novas e não arquivadas)
    state.confirmations = [
        ...reallyNew,
        ...state.confirmations
    ];

    // Atualiza UI
    renderConfirmations();
    updateStats();

    // Notifica usuário
    const msg = reallyNew.length === 1
        ? '1 nova consulta marcada'
        : `${reallyNew.length} novas consultas marcadas`;

    console.log(`[Confirmação] ${msg}`);

    // Verifica se está em modo admin
    if (window.IS_ADMIN_MODE) {
        // ✅ ENVIO AUTOMÁTICO - Modo Admin
        console.log('[Confirmação] 🤖 MODO ADMIN - Enviando mensagens automaticamente');
        Toast.success('Admin: Envio automático', `${msg}. Enviando automaticamente...`, 5000);

        // Envia mensagens automaticamente
        await autoSendMessages(reallyNew);
    } else {
        // ✅ ENVIO MANUAL - Modo Operador
        console.log('[Confirmação] ⏸️ Envio manual - aguardando operador clicar em "Enviar Mensagem"');
        Toast.info('Novas consultas', `${msg}. Clique em "Enviar Mensagem" para notificar os pacientes.`, 5000);
    }
}

/**
 * Envia mensagens automaticamente para consultas novas
 */
async function autoSendMessages(confirmations) {
    let sent = 0;
    let failed = 0;

    for (const confirmation of confirmations) {
        try {
            // Verifica se tem telefone
            const mensagemPrincipal = confirmation.mensagens?.[0];
            if (!mensagemPrincipal?.telefone) {
                console.log(`[Confirmação] ⚠️ Consulta ${confirmation.consultaNumero} sem telefone - pulando envio automático`);
                continue;
            }

            // Envia mensagem
            await ConfirmacaoService.sendConfirmationMessage(confirmation, 0);
            sent++;
            console.log(`[Confirmação] ✅ Mensagem enviada automaticamente para ${confirmation.nomePaciente}`);

        } catch (error) {
            failed++;
            console.error(`[Confirmação] ❌ Erro ao enviar mensagem automática:`, error);
        }
    }

    // Atualiza UI
    renderConfirmations();
    updateStats();

    // Notifica resultado
    if (sent > 0) {
        Toast.success('Envio automático', `${sent} mensagem(ns) enviada(s) automaticamente`, 5000);
    }
    if (failed > 0) {
        Toast.error('Erro no envio', `${failed} mensagem(ns) falharam`, 4000);
    }
}

/**
 * Inicia auto-arquivamento periódico
 */
function startAutoArquivamento() {
    console.log('[Confirmação] 📦 Iniciando auto-arquivamento periódico (a cada 1 hora)...');

    // Executa imediatamente
    autoArquivarAntigas();

    // Depois executa a cada 1 hora (3600000 ms)
    setInterval(autoArquivarAntigas, 3600000);
}

/**
 * Extrai número de telefone (mantido para compatibilidade)
 */
function extractPhoneNumber(phoneNumber) {
    if (!phoneNumber) return '';
    // Remove caracteres não numéricos
    return phoneNumber.replace(/\D/g, '');
}

/**
 * Processa uma resposta do Chat Próprio e atualiza o status da confirmação
 * As respostas são atualizadas diretamente no SQLite via /api/chat-proprio/acao-resposta
 * Esta função é chamada apenas para atualização local da UI
 */
function processChatProprioResponse(confirmacaoId, status) {
    if (!confirmacaoId || !status) {
        console.warn('[Confirmação] ⚠️ Resposta inválida - faltando ID ou status');
        return;
    }

    // Busca confirmação pelo ID
    const confirmation = state.confirmations.find(c => c.id === confirmacaoId);

    if (!confirmation) {
        console.warn('[Confirmação] ⚠️ Confirmação não encontrada:', confirmacaoId);
        return;
    }

    // Atualiza status local
    const statusAnterior = confirmation.statusGeral;
    confirmation.statusGeral = status;
    confirmation.dataResposta = new Date().toISOString();

    console.log('[Confirmação] ✅ Status atualizado via Chat Próprio:', {
        confirmacaoId,
        paciente: confirmation.nomePaciente,
        statusAnterior,
        statusNovo: status
    });

    // Atualiza UI
    renderConfirmations();
    updateStats();

    // Notifica
    const statusLabel = getStatusLabel(status);
    Toast.info(
        'Resposta recebida!',
        `${confirmation.nomePaciente}: ${statusLabel}`,
        4000
    );
}

/**
 * Atualiza estatísticas
 */
function updateStats() {
    const total = state.confirmations.length;

    const pendentes = state.confirmations.filter(c =>
        c.statusGeral === 'pending'
    ).length;

    const confirmadas = state.confirmations.filter(c =>
        c.statusGeral === 'confirmed'
    ).length;

    const declinadas = state.confirmations.filter(c =>
        c.statusGeral === 'declined'
    ).length;

    const naoAgendou = state.confirmations.filter(c =>
        c.statusGeral === 'not_scheduled'
    ).length;

    elements.statTotalConfirmacoes.textContent = total;
    elements.statPendentes.textContent = pendentes;
    elements.statConfirmadas.textContent = confirmadas;
    elements.statDeclinadas.textContent = declinadas;
    elements.statNaoAgendou.textContent = naoAgendou;
}

/**
 * Renderiza lista de confirmações
 */
function renderConfirmations() {
    if (!elements.confirmacoesList) return;

    // Filtra confirmações
    const filtered = filterConfirmations();

    // DEBUG: Log de todos os status
    console.log('[Confirmação] 🔍 DEBUG - Confirmações filtradas:', filtered.length);
    filtered.forEach(c => {
        console.log(`[Confirmação] 📋 ${c.nomePaciente} - Status: ${c.statusGeral}`);
    });

    if (filtered.length === 0) {
        elements.confirmacoesList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📋</div>
                <h3>Nenhuma confirmação encontrada</h3>
                <p>Aguardando novas consultas marcadas...</p>
            </div>
        `;
        return;
    }

    // Renderiza cada confirmação
    const html = filtered.map(confirmation => renderConfirmationCard(confirmation)).join('');
    elements.confirmacoesList.innerHTML = html;

    // Adiciona event listeners
    attachCardEventListeners();

    // Carrega fotos de perfil assincronamente
    loadProfilePics();
}

/**
 * Carrega fotos de perfil assincronamente
 * DESABILITADO: Avatares removidos
 */
async function loadProfilePics() {
    // Função desabilitada - avatares removidos da interface
    return;
}

/**
 * Renderiza card de uma confirmação
 */
function renderConfirmationCard(confirmation) {
    // Telefone principal
    const telefonePrincipal = confirmation.mensagens[0];
    const telefoneFormatado = telefonePrincipal?.telefone
        ? PhoneNormalizer.formatForDisplay(telefonePrincipal.telefone)
        : 'SEM TELEFONE';

    // Aviso se não tiver telefone
    const semTelefone = !telefonePrincipal?.telefone;
    const telefoneWarning = semTelefone ? '<span style="color: #ef4444; font-weight: 700;">⚠️ </span>' : '';

    // Formata data de marcação
    let dataMarcacaoFormatada = '';
    if (confirmation.dataMarcacao) {
        const dataMarcacao = new Date(confirmation.dataMarcacao);
        const dia = String(dataMarcacao.getDate()).padStart(2, '0');
        const mes = String(dataMarcacao.getMonth() + 1).padStart(2, '0');
        const ano = dataMarcacao.getFullYear();
        const hora = String(dataMarcacao.getHours()).padStart(2, '0');
        const minuto = String(dataMarcacao.getMinutes()).padStart(2, '0');
        dataMarcacaoFormatada = `${dia}/${mes}/${ano} ${hora}:${minuto}`;
    }

    // Badge de tipo (M verde ou 72h amarelo)
    // O tipo é definido no momento que a consulta aparece no dashboard:
    // - 'marcada': detectada pelo monitoramento de novas marcações
    // - 'lembrete72h': detectada pelo monitoramento de lembretes 72h
    let badgeHTML = '';

    if (confirmation.tipo === 'marcada') {
        badgeHTML = '<div class="tipo-badge tipo-badge-marcada" title="Consulta recém-marcada">M</div>';
    } else if (confirmation.tipo === 'lembrete72h') {
        badgeHTML = '<div class="tipo-badge tipo-badge-lembrete" title="Lembrete 72 horas">72h</div>';
    }
    // Consultas antigas sem tipo: não mostra badge

    // ✅ Badge de Ação (DESMARCAR ou DESMARCADA)
    // Badge de Identificação de Reagendamento é separado (badge amarelo)
    //
    // IMPORTANTE: Só mostra badges se houve interação via Chat Próprio!
    // Se paciente marcou/desmarcou pela internet sem interagir com nosso sistema,
    // NÃO deve aparecer nenhum badge de desmarcação.
    //
    // Condições para mostrar badge:
    // 1. Paciente respondeu via Chat Próprio (badgeStatus existe ou dataResposta existe)
    // 2. OU badge foi criado no SQLite (sincronizado via syncBadgesWithConfirmations)
    let badgeAcao = '';

    // Verifica se houve interação via Chat Próprio (resposta do paciente)
    const houveRespostaChatProprio = confirmation.badgeStatus || confirmation.dataResposta;

    // 1️⃣ DESMARCADA (verde) - statusGeral === 'cancelled' significa que operador já desmarcou no AGHUse
    // O status só muda para 'cancelled' se antes era 'declined' (via detectarDesmarcacaoEAtualizarBadge)
    // Portanto, se está 'cancelled', implicitamente houve resposta Chat Próprio antes
    if (confirmation.badgeStatus === 'desmarcada' || confirmation.statusGeral === 'cancelled') {
        badgeAcao = '<div class="badge-desmarcada">✅ Desmarcada</div>';
        console.log(`[Confirmação] 🟢 Badge DESMARCADA (verde) para: ${confirmation.nomePaciente} - statusGeral: ${confirmation.statusGeral}`);
    }
    // 2️⃣ DESMARCAR (vermelho) - Paciente respondeu via Chat Próprio que não virá
    else if (houveRespostaChatProprio && (confirmation.statusGeral === 'declined' || confirmation.statusGeral === 'not_scheduled')) {
        badgeAcao = '<div class="badge-desmarcar">Desmarcar</div>';
        console.log(`[Confirmação] 🔴 Badge DESMARCAR (vermelho) para: ${confirmation.nomePaciente} - statusGeral: ${confirmation.statusGeral}`);
    }
    // 3️⃣ Se statusGeral indica desmarcação MAS não houve resposta Chat Próprio, NÃO mostra badge
    else if (!houveRespostaChatProprio && (confirmation.statusGeral === 'declined' || confirmation.statusGeral === 'not_scheduled')) {
        // Paciente marcou/desmarcou pela internet sem interagir com Chat Próprio
        // NÃO mostrar badge - apenas monitora o que vem pelo Chat Próprio
        console.log(`[Confirmação] ⏭️ Sem badge para: ${confirmation.nomePaciente} - sem resposta Chat Próprio (statusGeral: ${confirmation.statusGeral})`);
    }

    // Badge de Reagendamento (amarelo) - Apenas identificação visual
    // Aparece JUNTO com badge de ação (vermelho/verde) quando aplicável
    let badgeReagendamento = '';
    if (confirmation.reagendamentoDe) {
        badgeReagendamento = '<div class="badge-reagendamento">🔄 Reagendamento</div>';
        console.log(`[Confirmação] 🟡 Badge REAGENDAMENTO (amarelo) para: ${confirmation.nomePaciente} - origem: ${confirmation.reagendamentoDe}`);
    }

    return `
        <div class="confirmation-card-compact" data-id="${confirmation.id}">
            ${badgeHTML}
            <div class="patient-info">
                <strong>${confirmation.nomePaciente}</strong>
                ${confirmation.prontuario ? `<span class="prontuario-label">Prontuário: ${confirmation.prontuario}</span>` : ''}
            </div>

            <div class="appointment-details">
                <span>📅 ${formatMarkdownToHTML(confirmation.dataHoraFormatada)}</span>
                <span class="especialidade-text" title="${confirmation.especialidade}">🏥 ${formatMarkdownToHTML(confirmation.especialidade)}</span>
                <span>${telefoneWarning}📞 ${telefoneFormatado}</span>
                ${dataMarcacaoFormatada ? `<span>🕐 Marcada: ${dataMarcacaoFormatada}</span>` : ''}
            </div>

            <div class="actions-row">
                ${badgeReagendamento}
                ${badgeAcao}
                <button class="btn-details-compact" onclick="window.showConfirmationDetails('${confirmation.id}')">
                    Ver Detalhes
                </button>
            </div>
        </div>
    `;
}

/**
 * Retorna classe CSS para status
 */
function getStatusClass(status) {
    switch (status) {
        case 'pending': return 'status-pending';
        case 'sent': return 'status-sent';
        case 'delivered': return 'status-delivered';
        case 'confirmed': return 'status-confirmed';
        case 'declined': return 'status-declined';
        case 'no_phone': return 'status-warning';
        default: return 'status-other';
    }
}

/**
 * Retorna label para status
 */
function getStatusLabel(status) {
    switch (status) {
        case 'pending': return 'Aguardando';
        case 'sent': return 'Enviado';
        case 'delivered': return 'Entregue';
        case 'confirmed': return 'Confirmado';
        case 'declined': return 'Declinado';
        case 'not_scheduled': return 'Não Agendou';
        case 'no_phone': return 'Sem Telefone';
        default: return 'Outro';
    }
}

/**
 * Retorna ícone para status
 */
function getStatusIcon(status) {
    switch (status) {
        case 'pending': return '⏳';
        case 'sent': return '📤';
        case 'delivered': return '✅';
        case 'confirmed': return '👍';
        case 'declined': return '❌';
        case 'no_phone': return '⚠️';
        default: return '⚪';
    }
}

/**
 * Filtra confirmações baseado nos filtros selecionados
 */
function filterConfirmations() {
    // Combina confirmações ativas e arquivadas (se checkbox marcado)
    let allConfirmations = [...state.confirmations];

    if (state.mostrarArquivados) {
        allConfirmations = [...allConfirmations, ...state.confirmationsArquivadas];
    }

    // ✅ VALIDAÇÃO TEMPORAL: Filtra consultas já passadas (mais de 3h)
    const agora = new Date();
    const margemTresHoras = 3 * 60 * 60 * 1000; // 3 horas em ms

    allConfirmations = allConfirmations.filter(c => {
        // Consultas arquivadas sempre são exibidas (histórico)
        if (c.arquivada) return true;

        // Consultas sem data são exibidas (para debug)
        if (!c.dataConsulta) return true;

        const dataConsulta = new Date(c.dataConsulta);
        const jaPassou = dataConsulta.getTime() < (agora.getTime() - margemTresHoras);

        // Se já passou, não exibe (será arquivada automaticamente)
        if (jaPassou) {
            console.log(`[Confirmação] 🕐 Consulta ${c.consultaNumero} já passou - ocultando`);
            return false;
        }

        return true;
    });

    // Aplica filtro de nome
    if (state.filtroNome.length >= 2) {
        allConfirmations = allConfirmations.filter(c =>
            c.nomePaciente.toLowerCase().includes(state.filtroNome.toLowerCase())
        );
    }

    // Aplica filtro de status
    if (state.filtroStatus !== 'all') {
        allConfirmations = allConfirmations.filter(c => c.statusGeral === state.filtroStatus);
    }

    return allConfirmations;
}

/**
 * Handler para mudança de filtro
 */
function handleFilterChange(e) {
    state.filtroStatus = e.target.value;
    renderConfirmations();
}

/**
 * Envia mensagem de confirmação (função global)
 */
window.handleSendMessage = async function(confirmationId) {
    const confirmation = state.confirmations.find(c => c.id === confirmationId);
    if (!confirmation) {
        Toast.error('Erro', 'Confirmação não encontrada', 3000);
        return;
    }

    // Verifica se tem mensagem/telefone
    const mensagemPrincipal = confirmation.mensagens?.[0];
    if (!mensagemPrincipal?.telefone) {
        Toast.error('Sem telefone', 'Paciente não possui telefone cadastrado', 4000);
        return;
    }

    // Conta quantas vezes mensagem foi enviada (pelo número de tentativas)
    const numeroEnvios = mensagemPrincipal.tentativas || 0;

    // Se já foi enviada 2 ou mais vezes, mostra aviso especial
    if (numeroEnvios >= 2) {
        const statusLabel = {
            'confirmed': 'CONFIRMADO',
            'declined': 'NÃO PODERÁ COMPARECER',
            'not_scheduled': 'NÃO AGENDOU',
            'pending': 'AGUARDANDO RESPOSTA',
            'queued': 'NA FILA DE ENVIO',
            'sent': 'ENVIADA',
            'no_phone': 'SEM TELEFONE'
        };

        const ultimoLog = mensagemPrincipal.logs?.[mensagemPrincipal.logs.length - 1];
        const dataUltimoEnvio = ultimoLog?.timestamp
            ? new Date(ultimoLog.timestamp).toLocaleString('pt-BR')
            : 'Data não disponível';

        const confirmar = confirm(
            `⚠️ ATENÇÃO - REENVIO DE MENSAGEM\n\n` +
            `Esta mensagem já foi enviada ${numeroEnvios} vez${numeroEnvios > 1 ? 'es' : ''} para este paciente.\n\n` +
            `📋 Paciente: ${confirmation.nomePaciente}\n` +
            `📱 Telefone: ${PhoneNormalizer.formatForDisplay(mensagemPrincipal.telefone)}\n` +
            `🗓️ Consulta: ${confirmation.dataHoraFormatada}\n\n` +
            `📤 Último envio: ${dataUltimoEnvio}\n` +
            `📊 Status atual: ${statusLabel[confirmation.statusGeral] || confirmation.statusGeral}\n\n` +
            `Deseja REALMENTE reenviar esta mensagem?`
        );

        if (!confirmar) {
            return;
        }
    } else {
        // Confirmação padrão para 1º e 2º envios
        const confirmar = confirm(
            `Enviar mensagem de confirmação?\n\n` +
            `Paciente: ${confirmation.nomePaciente}\n` +
            `Telefone: ${PhoneNormalizer.formatForDisplay(mensagemPrincipal.telefone)}\n` +
            `Consulta: ${confirmation.dataHoraFormatada}`
        );

        if (!confirmar) {
            return;
        }
    }

    // Fecha o modal
    document.querySelector('.modal-overlay')?.remove();

    // Mostra toast de processamento
    Toast.info('Enviando...', 'Adicionando mensagem à fila de envio', 3000);

    try {
        // Envia mensagem (vai para a fila com proteção anti-banimento)
        const result = await ConfirmacaoService.sendConfirmationMessage(confirmation, 0);

        Toast.success(
            'Mensagem enviada!',
            `Adicionada à fila de envio. ID: ${result.queueId}`,
            5000
        );

        // Atualiza UI
        renderConfirmations();
        updateStats();

    } catch (error) {
        console.error('[Confirmação] Erro ao enviar:', error);
        Toast.error(
            'Erro ao enviar',
            error.message,
            6000
        );
    }
};

/**
 * Mostra detalhes da confirmação (função global)
 */
window.showConfirmationDetails = function(confirmationId) {
    const confirmation = state.confirmations.find(c => c.id === confirmationId);
    if (!confirmation) {
        console.error('[Confirmação] Não encontrada:', confirmationId);
        return;
    }

    const telefonePrincipal = confirmation.mensagens[0];
    const telefones = confirmation.mensagens
        .filter(m => m.telefone)
        .map(m => `${PhoneNormalizer.formatForDisplay(m.telefone)} (${m.telefoneType})`)
        .join(', ') || 'Nenhum telefone cadastrado';

    // Formata data de marcação
    let dataMarcacaoFormatada = 'Não informada';
    if (confirmation.dataMarcacao) {
        const dataMarcacao = new Date(confirmation.dataMarcacao);
        const dia = String(dataMarcacao.getDate()).padStart(2, '0');
        const mes = String(dataMarcacao.getMonth() + 1).padStart(2, '0');
        const ano = dataMarcacao.getFullYear();
        const hora = String(dataMarcacao.getHours()).padStart(2, '0');
        const minuto = String(dataMarcacao.getMinutes()).padStart(2, '0');
        dataMarcacaoFormatada = `${dia}/${mes}/${ano} às ${hora}:${minuto}`;
    }

    const modalHtml = `
        <div class="modal-overlay" onclick="this.remove()">
            <div class="modal-content" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>Detalhes da Confirmação</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="detail-row">
                        <span class="detail-label">Paciente:</span>
                        <span class="detail-value">${confirmation.nomePaciente}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Prontuário:</span>
                        <span class="detail-value">${confirmation.prontuario}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Nr Consulta:</span>
                        <span class="detail-value">${confirmation.consultaNumero}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Especialidade:</span>
                        <span class="detail-value">${formatMarkdownToHTML(confirmation.especialidade)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Data/Hora:</span>
                        <span class="detail-value">${formatMarkdownToHTML(confirmation.dataHoraFormatada)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Profissional:</span>
                        <span class="detail-value">${confirmation.profissional || 'Não informado'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Telefones:</span>
                        <span class="detail-value">${telefones}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Marcada em:</span>
                        <span class="detail-value">${dataMarcacaoFormatada}</span>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
                    ${telefonePrincipal?.telefone ? `
                        <button class="btn-primary" onclick="window.handleSendMessage('${confirmation.id}')">
                            📤 Enviar Mensagem
                        </button>
                    ` : ''}
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
};


/**
 * Adiciona event listeners aos cards
 */
function attachCardEventListeners() {
    // Botões de detalhes
    document.querySelectorAll('.btn-detail').forEach(btn => {
        btn.addEventListener('click', handleViewDetails);
    });

    // Botões de envio de teste
    document.querySelectorAll('.btn-send-test').forEach(btn => {
        btn.addEventListener('click', handleSendTest);
    });

    // Botões de corrigir cadastro
    document.querySelectorAll('.btn-fix-phone').forEach(btn => {
        btn.addEventListener('click', handleFixPhone);
    });
}

/**
 * Visualiza detalhes de uma confirmação
 */
function handleViewDetails(e) {
    const confirmationId = e.target.dataset.id;
    const confirmation = ConfirmacaoService.getConfirmation(confirmationId);

    if (!confirmation) {
        alert('Confirmação não encontrada');
        return;
    }

    // Monta detalhes
    let details = `DETALHES DA CONFIRMAÇÃO\n\n`;
    details += `Paciente: ${confirmation.nomeCompleto}\n`;
    details += `Prontuário: ${confirmation.prontuario}\n`;
    details += `Consulta: ${confirmation.especialidade}\n`;
    details += `Data/Hora: ${confirmation.dataHoraFormatada}\n`;
    details += `Profissional: ${confirmation.profissional}\n\n`;

    details += `TELEFONES:\n`;
    confirmation.mensagens.forEach((msg, index) => {
        details += `${index + 1}. ${msg.telefoneFormatado} (${msg.telefoneType}) - ${getStatusLabel(msg.status)}\n`;
    });

    alert(details);
}

/**
 * Simula envio de mensagem (DEV MODE)
 */
async function handleSendTest(e) {
    const confirmationId = e.target.dataset.id;
    const confirmation = ConfirmacaoService.getConfirmation(confirmationId);

    if (!confirmation) {
        alert('Confirmação não encontrada');
        return;
    }

    if (!confirm('Simular envio de mensagem?\n\nMODO DESENVOLVIMENTO: Não enviará notificação real.')) {
        return;
    }

    e.target.disabled = true;
    e.target.textContent = '📤 Enviando...';

    try {
        const result = await ConfirmacaoService.sendConfirmationMessage(confirmation, 0);

        alert(`Mensagem simulada com sucesso!\n\nMessage ID: ${result.messageId}`);

        // Atualiza UI
        renderConfirmations();
        updateStats();

    } catch (error) {
        alert(`Erro ao simular envio:\n\n${error.message}`);
    } finally {
        e.target.disabled = false;
        e.target.textContent = '📤 Simular Envio (DEV)';
    }
}

/**
 * Handler para corrigir cadastro de paciente sem telefone
 */
function handleFixPhone(e) {
    const confirmationId = e.target.dataset.id;
    const confirmation = ConfirmacaoService.getConfirmation(confirmationId);

    if (!confirmation) {
        alert('Confirmação não encontrada');
        return;
    }

    const mensagem = `ATENÇÃO: Paciente sem telefone cadastrado!\n\n` +
        `Paciente: ${confirmation.nomePaciente}\n` +
        `Prontuário: ${confirmation.prontuario || 'N/A'}\n` +
        `CPF/Código: ${confirmation.pacCodigo}\n\n` +
        `Consulta marcada para: ${confirmation.dataHoraFormatada}\n` +
        `Especialidade: ${confirmation.especialidade}\n\n` +
        `⚠️ Para enviar a notificação, é necessário:\n` +
        `1. Acessar o sistema AGHUse\n` +
        `2. Localizar o cadastro do paciente\n` +
        `3. Adicionar um telefone celular válido\n` +
        `4. Aguardar o próximo ciclo de monitoramento\n\n` +
        `Você será notificado quando o paciente for reprocessado.`;

    alert(mensagem);
}

export default {
    init
};
