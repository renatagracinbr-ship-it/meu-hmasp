/**
 * Componente: Desmarcação de Consultas
 * Interface para visualizar e gerenciar consultas desmarcadas
 */

import CONFIG from '../config/backend.config.js';
import * as DesmarcacaoService from '../services/desmarcacao.service.js';
import * as AghuseService from '../services/aghuse.service.js';
import * as BadgeManager from '../services/badgeManager.service.js';
import * as DesmarcacaoLinker from '../services/desmarcacaoLinker.service.js';
import { PhoneNormalizer } from '../utils/phoneNormalizer.js';
import { Toast } from '../utils/toast.js';
import * as ConsultasSQLite from '../services/consultasSQLite.service.js';
// Helper: Converte Markdown (*negrito*) para HTML <strong>
function formatMarkdownToHTML(text) {
    if (!text) return text;

    // Converte *texto* para <strong>texto</strong>
    return text.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
}

// Helper: Trunca texto se ultrapassar o limite
function truncateText(text, maxLength = 30) {
    if (!text) return text;
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// Detecta se está em admin.html (VM com envio automático)
const isAdminInterface = window.location.pathname.includes('admin.html');

// Estado do componente
const state = {
    initialized: false, // Flag para evitar múltiplas inicializações
    monitoringActive: false,
    desmarcacoes: [],
    desmarcacoesArquivadas: [], // Desmarcações arquivadas (carregadas do banco)
    filtroStatus: 'all',
    filtroNome: '', // Filtro de busca por nome
    mostrarArquivados: false, // Checkbox de mostrar arquivados
    autoSendEnabled: false // SEMPRE DESABILITADO - envio manual apenas
};

// Elementos do DOM
const elements = {
    clearDesmarcacoesBtn: null,
    filterStatus: null,
    aghuseIndicator: null,
    monitoringIndicator: null,
    statTotalDesmarcacoes: null,
    statReagendamento: null,
    statSemReagendamento: null,
    statPacienteSolicitou: null,
    statAguardandoConfirmacaoDesm: null,
    desmarcacoesList: null,
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
        console.log('[Desmarcação] Componente já inicializado, pulando...');
        return;
    }
    state.initialized = true;

    console.log('[Desmarcação] Inicializando componente...');

    // Captura elementos do DOM
    elements.clearDesmarcacoesBtn = document.getElementById('clear-desmarcacoes-btn');
    elements.filterStatus = document.getElementById('filter-status-desmarcacao');
    elements.aghuseIndicator = document.getElementById('aghuse-indicator-desmarcacao');
    elements.monitoringIndicator = document.getElementById('monitoring-indicator-desmarcacao');
    elements.statTotalDesmarcacoes = document.getElementById('stat-total-desmarcacoes');
    elements.statReagendamento = document.getElementById('stat-reagendamento');
    elements.statSemReagendamento = document.getElementById('stat-sem-reagendamento');
    elements.statPacienteSolicitou = document.getElementById('stat-paciente-solicitou');
    elements.statAguardandoConfirmacaoDesm = document.getElementById('stat-aguardando-confirmacao-desm');
    elements.desmarcacoesList = document.getElementById('desmarcacoes-list');
    elements.autoSendToggle = document.getElementById('auto-send-toggle-desmarcacao');
    elements.searchInput = document.getElementById('search-desmarcacao');
    elements.mostrarArquivadosCheckbox = document.getElementById('mostrar-arquivados-desmarcacao');

    // Carrega preferência de envio automático do localStorage
    const savedAutoSend = localStorage.getItem('hmasp_auto_send_desmarcacao');
    if (savedAutoSend !== null) {
        state.autoSendEnabled = savedAutoSend === 'true';
        if (elements.autoSendToggle) {
            elements.autoSendToggle.checked = state.autoSendEnabled;
        }
    }

    // Event listeners
    elements.clearDesmarcacoesBtn?.addEventListener('click', handleClearDesmarcacoes);
    elements.filterStatus?.addEventListener('change', handleFilterChange);
    elements.autoSendToggle?.addEventListener('change', handleAutoSendToggle);
    elements.searchInput?.addEventListener('input', handleSearchInput);
    elements.mostrarArquivadosCheckbox?.addEventListener('change', handleMostrarArquivadosChange);

    // Event listeners para cards de estatísticas (filtros clicáveis)
    const statCards = document.querySelectorAll('[data-filter-desm]');
    statCards.forEach(card => {
        card.addEventListener('click', (e) => {
            const filterValue = card.getAttribute('data-filter-desm');
            if (elements.filterStatus) {
                elements.filterStatus.value = filterValue;
                elements.filterStatus.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
    });


    // Migra dados antigos do localStorage para SQLite (se existirem)
    loadDesmarcacoesFromStorage();

    // Carrega desmarcações do SQLite (sistema multi-usuário)
    await loadDesmarcacoesFromSQLite();

    // Inicia monitoramento automaticamente
    await autoStartMonitoring();

    // Respostas dos pacientes são processadas via Chat Próprio
    // O endpoint /api/chat-proprio/acao-resposta atualiza o status diretamente no SQLite
    console.log('[Desmarcação] 📱 Respostas processadas via Chat Próprio (sem WhatsApp)');

    // Inicia auto-arquivamento periódico (a cada 1 hora)
    startAutoArquivamento();

    // Inicia polling de atualização do SQLite (recarrega a cada 5 segundos)
    startSQLitePolling();

    // Escuta eventos de mudança no toggle (quando o botão é clonado)
    window.addEventListener('desmarcacao-toggle-changed', (e) => {
        state.autoSendEnabled = e.detail.enabled;

        if (state.autoSendEnabled) {
            console.log('[Desmarcação] ✅ Envio automático HABILITADO');
            Toast.success('Envio Automático', 'Mensagens serão enviadas automaticamente', 3000);
        } else {
            console.log('[Desmarcação] ⏸️ Envio automático DESABILITADO');
            Toast.info('Envio Automático', 'Mensagens aguardam envio manual', 3000);
        }
    });

    console.log('[Desmarcação] Componente inicializado');
}

/**
 * Inicia monitoramento automaticamente ao carregar
 */
async function autoStartMonitoring() {
    try {
        console.log('[Desmarcação] 🚀 Iniciando monitoramento automático...');

        // Testa conexão com AGHUse (silencioso se falhar)
        try {
            const result = await AghuseService.testConnection();
            if (result.success) {
                if (elements.aghuseIndicator) {
                    elements.aghuseIndicator.innerHTML = '🟢 Conectado';
                    elements.aghuseIndicator.style.color = '#10b981';
                }
                console.log('[Desmarcação] ✅ AGHUse conectado');
            } else {
                if (elements.aghuseIndicator) {
                    elements.aghuseIndicator.innerHTML = '🟡 Tentando...';
                    elements.aghuseIndicator.style.color = '#f59e0b';
                }
                // Não loga erro - vai tentar novamente automaticamente
            }
        } catch (error) {
            if (elements.aghuseIndicator) {
                elements.aghuseIndicator.innerHTML = '🟡 Tentando...';
                elements.aghuseIndicator.style.color = '#f59e0b';
            }
            // Não loga erro - vai tentar novamente automaticamente
        }

        // Inicia monitoramento
        await DesmarcacaoService.startMonitoring(handleNewDesmarcacoes, 30000);

        // Atualiza UI para estado ativo
        state.monitoringActive = true;
        if (elements.monitoringIndicator) {
            elements.monitoringIndicator.innerHTML = '🟢 Ativo';
            elements.monitoringIndicator.style.color = '#10b981';
        }

        console.log('[Desmarcação] ✅ Monitoramento iniciado automaticamente');

    } catch (error) {
        console.error('[Desmarcação] ❌ Erro ao iniciar monitoramento automático:', error);
        if (elements.monitoringIndicator) {
            elements.monitoringIndicator.innerHTML = '🔴 Erro';
            elements.monitoringIndicator.style.color = '#ef4444';
        }
    }
}

/**
 * Processa uma resposta do Chat Próprio e atualiza o status da desmarcação
 * As respostas são atualizadas diretamente no SQLite via /api/chat-proprio/acao-resposta
 * Esta função é chamada apenas para atualização local da UI
 */
function processChatProprioResponse(desmarcacaoId, tipoDesmarcacao) {
    if (!desmarcacaoId || !tipoDesmarcacao) {
        console.warn('[Desmarcação] ⚠️ Resposta inválida - faltando ID ou tipo');
        return;
    }

    // Busca desmarcação pelo ID
    const desmarcacao = state.desmarcacoes.find(d => d.id === desmarcacaoId);

    if (!desmarcacao) {
        console.warn('[Desmarcação] ⚠️ Desmarcação não encontrada:', desmarcacaoId);
        return;
    }

    // Atualiza status local
    const statusAnterior = desmarcacao.status;
    desmarcacao.status = tipoDesmarcacao;
    desmarcacao.tipoDesmarcacao = tipoDesmarcacao;
    desmarcacao.respostaEm = new Date();
    desmarcacao.atualizadoEm = new Date();

    console.log('[Desmarcação] ✅ Status atualizado via Chat Próprio:', {
        desmarcacaoId,
        paciente: desmarcacao.nomePaciente,
        statusAnterior,
        statusNovo: tipoDesmarcacao
    });

    // Atualiza UI
    renderDesmarcacoes();
    updateStats();

    // Notifica
    const statusLabel = {
        'reagendamento': 'Quer reagendar',
        'sem_reagendamento': 'Sem reagendamento',
        'paciente_solicitou': 'Paciente solicitou'
    };

    Toast.info(
        'Resposta recebida!',
        `${desmarcacao.nomePaciente}: ${statusLabel[tipoDesmarcacao] || tipoDesmarcacao}`,
        4000
    );
}

/**
 * Salva desmarcações no localStorage
 */
/**
 * LEGADO: Salva no localStorage
 * @deprecated Não usado mais - agora salva diretamente no SQLite
 */
function saveDesmarcacoesToStorage() {
    // Função mantida apenas para compatibilidade com código legado
    // Não faz nada - salvar no SQLite acontece via API
    console.log('[Desmarcação] localStorage desabilitado - usando SQLite');
}

/**
 * Carrega desmarcações do SQLite (substitui localStorage)
 */
async function loadDesmarcacoesFromSQLite() {
    try {
        // Busca todas as desmarcações ativas do banco
        const desmarcacoes = await ConsultasSQLite.getAllDesmarcacoesAtivas();

        if (desmarcacoes.length > 0) {
            // 🔍 DEBUG: Logs comentados para reduzir poluição visual
            // console.log('[Desmarcação] 🔍 DEBUG - Primeira desmarcação do banco:', desmarcacoes[0]);
            // console.log('[Desmarcação] 🔍 DEBUG - Campo reagendada:', desmarcacoes[0]?.reagendada);
            // console.log('[Desmarcação] 🔍 DEBUG - Campo tipo_desmarcacao:', desmarcacoes[0]?.tipo_desmarcacao);
            // console.log('[Desmarcação] 🔍 DEBUG - Tipo reagendada:', typeof desmarcacoes[0]?.reagendada);

            // Converte formato snake_case do SQLite para camelCase do frontend
            state.desmarcacoes = desmarcacoes.map(d => ({
                id: d.id,
                consultaNumero: d.consulta_numero,
                nomePaciente: d.nome_paciente,
                nomeExibicao: d.nome_exibicao || '',
                pacCodigo: d.pac_codigo || '',
                prontuario: d.prontuario,
                telefone: d.telefone,
                telefoneFormatado: d.telefone_formatado,
                especialidade: d.especialidade,
                profissional: d.profissional || 'Não informado',
                local: d.local || null,
                dataHoraFormatada: d.data_hora_formatada,
                dataConsulta: d.data_consulta,
                status: d.status,  // ✅ CAMPO ESSENCIAL para badge
                tipoDesmarcacao: d.tipo_desmarcacao,
                veioDeConfirmacao: Boolean(d.veio_de_confirmacao),
                confirmacaoId: d.confirmacao_id,
                contexto: 'desmarcacao', // ✅ ESSENCIAL: validação de segurança
                mensagemTemplate: d.mensagem_template,
                mensagemEnviada: d.mensagem_enviada === 1 || d.mensagem_enviada === '1',
                enviarMensagem: d.enviar_mensagem === 1 || d.enviar_mensagem === '1',
                dataEnvio: d.data_envio,
                chatMessageId: d.chat_message_id || d.whatsapp_message_id, // Suporta ambos para migração
                dataDesmarcacao: d.data_desmarcacao,
                dataDesmarcacaoFormatada: d.data_desmarcacao ? new Date(d.data_desmarcacao).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                }) : null,
                dataApareceuDashboard: d.data_apareceu_dashboard,
                contextoId: d.contexto_id,
                contextoExpiresAt: d.contexto_expires_at,
                // Reagendamento
                reagendada: Boolean(d.reagendada),
                reagendadaEm: d.reagendada_em,
                novaConsultaNumero: d.nova_consulta_numero,
                reagendamentoComunicado: Boolean(d.reagendamento_comunicado),
                criadoEm: d.criado_em,
                atualizadoEm: d.atualizado_em,
                criadoPor: d.criado_por || 'sistema',
                // Campos adicionais
                respostaEm: d.resposta_em,
                statusGeral: d.status_geral || 'pending',
                dataMarcacao: d.data_marcacao,
                contexto: d.contexto || 'desmarcacao',
                // ✅ Reconstrói array de telefones (necessário para compatibilidade com renderização)
                telefones: d.telefone ? [{
                    telefone: d.telefone,
                    telefoneFormatado: d.telefone_formatado || PhoneNormalizer.formatForDisplay(d.telefone),
                    telefoneType: 'mobile',
                    prioridade: 1
                }] : [{
                    telefone: null,
                    telefoneFormatado: '⚠️ SEM TELEFONE CADASTRADO',
                    telefoneType: 'none',
                    prioridade: 1
                }],
                status: d.status || null  // Status da resposta do paciente
            }));

            console.log(`[Desmarcação] ${desmarcacoes.length} desmarcações carregadas do SQLite`);

            // Renderiza na tela
            renderDesmarcacoes();
            updateStats();
        } else {
            console.log('[Desmarcação] Nenhuma desmarcação no SQLite');
        }
    } catch (error) {
        console.error('[Desmarcação] Erro ao carregar do SQLite:', error);
    }
}

/**
 * LEGADO: Carrega desmarcações do localStorage (mantido para migração)
 * @deprecated Usar loadDesmarcacoesFromSQLite()
 */
async function loadDesmarcacoesFromStorage() {
    console.warn('[Desmarcação] ⚠️ localStorage LEGADO - migrando para SQLite...');

    try {
        const saved = localStorage.getItem('hmasp_desmarcacoes');
        if (saved) {
            const desmarcacoes = JSON.parse(saved);

            if (desmarcacoes.length > 0) {
                console.log(`[Desmarcação] Encontradas ${desmarcacoes.length} desmarcações no localStorage`);
                console.log('[Desmarcação] Migrando para SQLite...');

                // Migra para o SQLite de forma assíncrona
                try {
                    const migracaoPromises = desmarcacoes.map(d => ConsultasSQLite.saveDesmarcacaoAtiva(d));
                    const results = await Promise.all(migracaoPromises);
                    console.log(`[Desmarcação] ✅ Migração concluída: ${results.length} desmarcações`);

                    // Limpa localStorage após migração bem-sucedida
                    localStorage.removeItem('hmasp_desmarcacoes');
                    console.log('[Desmarcação] localStorage limpo após migração');
                } catch (error) {
                    console.error('[Desmarcação] ❌ Erro na migração:', error);
                }
            } else {
                console.log('[Desmarcação] localStorage vazio');
            }
        }
    } catch (error) {
        console.error('[Desmarcação] Erro ao migrar do localStorage:', error);
    }
}

/**
 * Limpa todas as desmarcações da lista (arquiva no SQLite)
 */
async function handleClearDesmarcacoes() {
    const confirmar = confirm('Deseja arquivar todas as desmarcações visíveis? (Elas ficarão disponíveis no histórico)');

    if (!confirmar) return;

    const total = state.desmarcacoes.length;
    console.log(`[Desmarcação] Arquivando ${total} desmarcações...`);

    // Arquiva todas as desmarcações no SQLite
    let arquivadas = 0;
    for (const desmarcacao of state.desmarcacoes) {
        try {
            const success = await ConsultasSQLite.arquivarDesmarcacao(
                desmarcacao.id,
                'manual',
                'operador'
            );
            if (success) arquivadas++;
        } catch (error) {
            console.error('[Desmarcação] Erro ao arquivar:', desmarcacao.consultaNumero, error);
        }
    }

    console.log(`[Desmarcação] ✅ ${arquivadas}/${total} desmarcações arquivadas`);

    // Limpa estado local
    state.desmarcacoes = [];

    // Atualiza interface
    renderDesmarcacoes();
    updateStats();

    Toast.success('Limpas!', `${total} desmarcações removidas da lista`, 3000);
}

/**
 * Trata mudança no filtro de status
 */
function handleFilterChange(e) {
    state.filtroStatus = e.target.value;
    console.log('[Desmarcação] Filtro alterado para:', state.filtroStatus);
    renderDesmarcacoes();
}

/**
 * Trata mudança no toggle de envio automático
 */
function handleAutoSendToggle(e) {
    state.autoSendEnabled = e.target.checked;

    if (state.autoSendEnabled) {
        console.log('[Desmarcação] ✅ Envio automático HABILITADO');
        Toast.success('Envio Automático', 'Mensagens serão enviadas automaticamente', 3000);
    } else {
        console.log('[Desmarcação] ⏸️ Envio automático DESABILITADO');
        Toast.info('Envio Automático', 'Mensagens aguardam envio manual', 3000);
    }

    // Salva preferência no localStorage
    localStorage.setItem('hmasp_auto_send_desmarcacao', state.autoSendEnabled);
}

/**
 * Trata mudança no campo de busca
 */
function handleSearchInput(e) {
    state.filtroNome = e.target.value.trim();
    console.log('[Desmarcação] 🔍 Busca:', state.filtroNome);

    // Se checkbox está marcado e tem texto na busca, busca no banco
    if (state.mostrarArquivados && state.filtroNome.length >= 2) {
        buscarArquivadas(state.filtroNome);
    } else {
        // Renderiza apenas desmarcações ativas filtradas
        renderDesmarcacoes();
    }
}

/**
 * Trata mudança no checkbox Mostrar Arquivados
 */
async function handleMostrarArquivadosChange(e) {
    state.mostrarArquivados = e.target.checked;
    console.log('[Desmarcação] 📦 Mostrar arquivados:', state.mostrarArquivados);

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
        state.desmarcacoesArquivadas = [];
        renderDesmarcacoes();
    }
}

/**
 * Busca desmarcações arquivadas por nome
 */
async function buscarArquivadas(nome) {
    try {
        console.log(`[Desmarcação] 🔍 Buscando arquivadas: "${nome}"`);

        const response = await fetch(`/api/arquivamento/buscar?nome=${encodeURIComponent(nome)}`);
        const data = await response.json();

        if (!data.success) {
            console.error('[Desmarcação] Erro ao buscar arquivadas:', data.error);
            Toast.error('Erro', 'Falha ao buscar desmarcações arquivadas', 3000);
            return;
        }

        state.desmarcacoesArquivadas = data.confirmacoes;
        console.log(`[Desmarcação] ✅ ${data.confirmacoes.length} arquivadas encontradas`);

        renderDesmarcacoes();

        if (data.confirmacoes.length === 0) {
            Toast.info('Busca', 'Nenhuma desmarcação arquivada encontrada', 3000);
        }
    } catch (error) {
        console.error('[Desmarcação] Erro ao buscar arquivadas:', error);
        Toast.error('Erro', 'Falha na conexão com o servidor', 3000);
    }
}

/**
 * Busca todas as desmarcações arquivadas
 */
async function buscarTodasArquivadas() {
    try {
        console.log('[Desmarcação] 📦 Carregando todas as arquivadas...');

        const response = await fetch('/api/arquivamento/todas?limit=100');
        const data = await response.json();

        if (!data.success) {
            console.error('[Desmarcação] Erro ao buscar todas:', data.error);
            Toast.error('Erro', 'Falha ao buscar desmarcações arquivadas', 3000);
            return;
        }

        state.desmarcacoesArquivadas = data.confirmacoes;
        console.log(`[Desmarcação] ✅ ${data.confirmacoes.length} arquivadas carregadas (total: ${data.total})`);

        renderDesmarcacoes();

        Toast.info('Arquivadas', `${data.confirmacoes.length} desmarcações arquivadas carregadas`, 3000);
    } catch (error) {
        console.error('[Desmarcação] Erro ao buscar todas:', error);
        Toast.error('Erro', 'Falha na conexão com o servidor', 3000);
    }
}

/**
 * Arquiva automaticamente desmarcações com 72h+
 * Executado periodicamente
 */
async function autoArquivarAntigas() {
    try {
        console.log('[Desmarcação] 🕐 Verificando desmarcações para auto-arquivamento (72h+)...');

        // Envia todas as desmarcações ativas para o backend decidir quais arquivar
        const response = await fetch('/api/arquivamento/auto-arquivar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ confirmacoes: state.desmarcacoes })
        });

        const data = await response.json();

        if (!data.success) {
            console.error('[Desmarcação] Erro ao auto-arquivar:', data.error);
            return;
        }

        if (data.arquivadas > 0) {
            console.log(`[Desmarcação] 📦 ${data.arquivadas} desmarcações arquivadas automaticamente`);

            // Remove desmarcações arquivadas do state
            // IMPORTANTE: Usa dataApareceuDashboard e NÃO dataMarcacao
            const agora = new Date();
            const HORAS_72 = 72 * 60 * 60 * 1000;

            state.desmarcacoes = state.desmarcacoes.filter(d => {
                // Usa dataApareceuDashboard se existir, senão tenta dataMarcacao (fallback)
                const dataReferencia = d.dataApareceuDashboard || d.dataMarcacao;

                if (!dataReferencia) return true; // Mantém se não tem data

                const dataRef = new Date(dataReferencia);
                const diffMs = agora - dataRef;
                return diffMs < HORAS_72; // Mantém apenas as que têm menos de 72h no dashboard
            });

            // Salva no localStorage
            saveDesmarcacoesToStorage();

            // Atualiza UI
            renderDesmarcacoes();
            updateStats();

            Toast.info('Arquivamento', `${data.arquivadas} desmarcações arquivadas (72h+ no dashboard)`, 4000);
        }
    } catch (error) {
        console.error('[Desmarcação] Erro no auto-arquivamento:', error);
    }
}

/**
 * Inicia auto-arquivamento periódico
 */
function startAutoArquivamento() {
    console.log('[Desmarcação] 📦 Iniciando auto-arquivamento periódico (a cada 1 hora)...');

    // Executa imediatamente
    autoArquivarAntigas();

    // Depois executa a cada 1 hora (3600000 ms)
    setInterval(autoArquivarAntigas, 3600000);
}

/**
 * Inicia polling de atualização do SQLite
 * Recarrega desmarcações a cada 5 segundos para detectar mudanças (ex: reagendamentos)
 */
function startSQLitePolling() {
    console.log('[Desmarcação] 🔄 Iniciando polling de atualização do SQLite (a cada 5 segundos)...');

    // Executa a cada 5 segundos (5000 ms)
    setInterval(async () => {
        try {
            await loadDesmarcacoesFromSQLite();
        } catch (error) {
            console.error('[Desmarcação] Erro ao recarregar do SQLite:', error);
        }
    }, 5000);
}

/**
 * Normaliza dataDesmarcacao para ISO string
 * @param {Date|string|null} data - Data de desmarcação
 * @returns {string} - ISO string ou string vazia
 */
function normalizarDataDesmarcacao(data) {
    if (!data) return '';
    if (data instanceof Date) return data.toISOString();
    if (typeof data === 'string') return data;
    return '';
}

/**
 * Callback quando novas desmarcações são encontradas
 */
async function handleNewDesmarcacoes(newDesmarcacoes) {
    console.log('[Desmarcação] Novas desmarcações:', newDesmarcacoes.length);

    // Remove duplicatas - usa chave composta COMPLETA incluindo dataDesmarcacao
    // CHAVE: consultaNumero + prontuario + dataHoraFormatada + dataDesmarcacao
    // Isso permite que a mesma consulta desmarcada várias vezes apareça cada vez
    // IMPORTANTE: Normaliza dataDesmarcacao para ISO string (pode ser Date ou string)
    const existingKeys = new Set(
        state.desmarcacoes.map(d => `${d.consultaNumero}-${d.prontuario}-${d.dataHoraFormatada}-${normalizarDataDesmarcacao(d.dataDesmarcacao)}`)
    );

    const reallyNew = newDesmarcacoes.filter(d => {
        const key = `${d.consultaNumero}-${d.prontuario}-${d.dataHoraFormatada}-${normalizarDataDesmarcacao(d.dataDesmarcacao)}`;
        console.log(`[Desmarcação] Verificando chave: ${key} - Existe? ${existingKeys.has(key)}`);
        return !existingKeys.has(key);
    });

    if (reallyNew.length === 0) {
        console.log('[Desmarcação] Nenhuma desmarcação nova (duplicatas ignoradas)');
        return;
    }

    // Adiciona dataApareceuDashboard (data atual - momento que apareceu)
    const agora = new Date().toISOString();
    reallyNew.forEach(d => {
        d.dataApareceuDashboard = agora; // IMPORTANTE: registra quando apareceu no dashboard
    });

    // ✅ VINCULAÇÃO: Verifica se desmarcação veio da aba Confirmação
    // Se paciente disse "Não poderei comparecer" via Chat Próprio, atualiza badge vermelho → verde
    console.log('[Desmarcação] Verificando vinculação com aba Confirmação...');
    for (const desmarcacao of reallyNew) {
        try {
            const linkResult = await DesmarcacaoLinker.tryLinkDesmarcacao(desmarcacao);
            if (linkResult.linked) {
                console.log(`[Desmarcação] ✅ Vinculação encontrada: consulta ${desmarcacao.consultaNumero}`);
                console.log(`[Desmarcação]    Badge atualizado: DESMARCAR (vermelho) → DESMARCADA (verde)`);
                console.log(`[Desmarcação]    NÃO enviar mensagem (paciente já sabe)`);
                // Marca que não deve enviar mensagem automática
                desmarcacao.linkedFromConfirmacao = true;
                desmarcacao.shouldSendMessage = false;
            }
        } catch (error) {
            console.error(`[Desmarcação] Erro ao verificar vinculação:`, error);
        }
    }

    // Salva no SQLite (sistema multi-usuário)
    console.log('[Desmarcação] Salvando no SQLite...');
    const resultadoSave = await ConsultasSQLite.saveDesmarcacoesAtivasBatch(reallyNew);
    console.log(`[Desmarcação] ✅ SQLite: ${resultadoSave.salvos}/${resultadoSave.total} desmarcações salvas`);

    // Adiciona ao estado (somente as realmente novas e não arquivadas)
    state.desmarcacoes = [
        ...reallyNew,
        ...state.desmarcacoes
    ];

    // Atualiza UI
    renderDesmarcacoes();
    updateStats();

    // Notifica usuário
    const msg = reallyNew.length === 1
        ? '1 nova consulta desmarcada'
        : `${reallyNew.length} novas consultas desmarcadas`;

    console.log(`[Desmarcação] ${msg}`);

    // Verifica se está em modo admin
    if (window.IS_ADMIN_MODE) {
        // ✅ ENVIO AUTOMÁTICO - Modo Admin
        console.log('[Desmarcação] 🤖 MODO ADMIN - Enviando mensagens automaticamente');
        Toast.success('Admin: Envio automático', `${msg}. Enviando automaticamente...`, 5000);

        // Envia mensagens automaticamente
        await autoSendDesmarcacaoMessages(reallyNew);
    } else {
        // ✅ ENVIO MANUAL - Modo Operador
        console.log('[Desmarcação] ⏸️ Envio manual - aguardando operador clicar em "Enviar Mensagem"');
        Toast.info('Novas desmarcações', `${msg}. Clique em "Enviar Mensagem" para notificar os pacientes.`, 5000);
    }
}

/**
 * Atualiza estatísticas
 */
function updateStats() {
    const total = state.desmarcacoes.length;
    // Conta pedidos de reagendamento (status === 'reagendamento')
    // Inclui tanto os pendentes (vermelho) quanto os já reagendados (verde)
    const reagendamento = state.desmarcacoes.filter(d => d.status === 'reagendamento').length;
    const semReagendamento = state.desmarcacoes.filter(d => d.status === 'sem_reagendamento').length;
    const pacienteSolicitou = state.desmarcacoes.filter(d => d.status === 'paciente_solicitou').length;
    const aguardando = state.desmarcacoes.filter(d => d.status === null || d.status === undefined).length;

    if (elements.statTotalDesmarcacoes) {
        elements.statTotalDesmarcacoes.textContent = total;
    }
    if (elements.statReagendamento) {
        elements.statReagendamento.textContent = reagendamento;
    }
    if (elements.statSemReagendamento) {
        elements.statSemReagendamento.textContent = semReagendamento;
    }
    if (elements.statPacienteSolicitou) {
        elements.statPacienteSolicitou.textContent = pacienteSolicitou;
    }
    if (elements.statAguardandoConfirmacaoDesm) {
        elements.statAguardandoConfirmacaoDesm.textContent = aguardando;
    }
}

/**
 * Renderiza lista de desmarcações
 */
function renderDesmarcacoes() {
    if (!elements.desmarcacoesList) return;

    // Combina desmarcações ativas e arquivadas (se checkbox marcado)
    let allDesmarcacoes = [...state.desmarcacoes];

    if (state.mostrarArquivados) {
        allDesmarcacoes = [...allDesmarcacoes, ...state.desmarcacoesArquivadas];
    }

    // Aplica filtro de nome
    if (state.filtroNome.length >= 2) {
        allDesmarcacoes = allDesmarcacoes.filter(d =>
            d.nomePaciente.toLowerCase().includes(state.filtroNome.toLowerCase())
        );
    }

    // Aplica filtro de status
    let desmarcacoesFiltradas = allDesmarcacoes;

    if (state.filtroStatus !== 'all') {
        // Mapeia valores do filtro para status
        const statusMap = {
            'reagendamento': 'reagendamento',
            'sem_reagendamento': 'sem_reagendamento',
            'paciente_solicitou': 'paciente_solicitou',
            'pending': null
        };

        const statusFiltro = statusMap[state.filtroStatus];
        if (statusFiltro === null) {
            // Filtra desmarcações aguardando (status null ou undefined)
            desmarcacoesFiltradas = allDesmarcacoes.filter(d => d.status === null || d.status === undefined);
        } else {
            desmarcacoesFiltradas = allDesmarcacoes.filter(d => d.status === statusFiltro);
        }
    }

    if (desmarcacoesFiltradas.length === 0) {
        const mensagem = state.filtroStatus === 'all'
            ? 'Aguardando consultas desmarcadas...'
            : `Nenhuma desmarcação com esse status`;

        elements.desmarcacoesList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📋</div>
                <h3>Nenhuma desmarcação encontrada</h3>
                <p>${mensagem}</p>
            </div>
        `;
        return;
    }

    // Renderiza cada desmarcação
    const html = desmarcacoesFiltradas.map(desmarcacao => renderDesmarcacaoCard(desmarcacao)).join('');
    elements.desmarcacoesList.innerHTML = html;

    // Adiciona event listeners
    attachCardEventListeners();
}

/**
 * Renderiza card de uma desmarcação
 */
function renderDesmarcacaoCard(desmarcacao) {
    // Telefone principal
    const telefonePrincipal = desmarcacao.telefones[0];
    const telefoneFormatado = telefonePrincipal?.telefone
        ? PhoneNormalizer.formatForDisplay(telefonePrincipal.telefone)
        : 'SEM TELEFONE';

    // Aviso se não tiver telefone
    const semTelefone = !telefonePrincipal?.telefone;
    const telefoneWarning = semTelefone ? '<span style="color: #ef4444; font-weight: 700;">⚠️ </span>' : '';

    // Data/hora da desmarcação formatada
    const dataDesmarcacao = desmarcacao.dataDesmarcacaoFormatada || 'Não informada';

    // Badge de reagendamento (SIMPLES)
    let badge = '';
    if (desmarcacao.status === 'reagendamento') {
        if (desmarcacao.reagendada) {
            // Verde - já foi reagendada
            badge = '<div class="badge-reagendada">✅ Reagendada</div>';
        } else {
            // Vermelho - precisa reagendar
            badge = '<div class="badge-reagendar">Reagendar</div>';
        }
    }

    return `
        <div class="confirmation-card-compact" data-id="${desmarcacao.id}">
            <div class="patient-info">
                <span class="badge-desmarcacao">D</span>
                <strong>${desmarcacao.nomePaciente}</strong>
                ${desmarcacao.prontuario ? `<span class="prontuario-label">Prontuário: ${desmarcacao.prontuario}</span>` : ''}
            </div>

            <div class="appointment-details">
                <span>📅 ${formatMarkdownToHTML(desmarcacao.dataHoraFormatada)}</span>
                <span class="especialidade-text" title="${desmarcacao.especialidade}">🏥 ${formatMarkdownToHTML(desmarcacao.especialidade)}</span>
                <span>${telefoneWarning}📞 ${telefoneFormatado}</span>
                <span>🔢 Nr: ${desmarcacao.consultaNumero}</span>
                <span>🗓️ Desmarcação: ${dataDesmarcacao}</span>
            </div>

            ${badge}

            <button class="btn-details-compact" onclick="window.showDesmarcacaoDetails('${desmarcacao.id}')">
                Ver Detalhes
            </button>
        </div>
    `;
}

/**
 * Envia mensagem sobre desmarcação (função global)
 */
window.handleSendDesmarcacaoMessage = async function(desmarcacaoId) {
    const desmarcacao = state.desmarcacoes.find(d => d.id === desmarcacaoId);
    if (!desmarcacao) {
        Toast.error('Erro', 'Desmarcação não encontrada', 3000);
        return;
    }

    // Verifica se tem telefone
    const telefonePrincipal = desmarcacao.telefones[0];
    if (!telefonePrincipal?.telefone) {
        Toast.error('Sem telefone', 'Paciente não possui telefone cadastrado', 4000);
        return;
    }

    // Conta quantas vezes mensagem foi enviada (pelo número de tentativas)
    const numeroEnvios = telefonePrincipal.tentativas || 0;

    // Se já foi enviada 2 ou mais vezes, mostra aviso especial
    if (numeroEnvios >= 2) {
        const statusLabel = {
            'reagendamento': 'REAGENDAMENTO SOLICITADO',
            'sem_reagendamento': 'SEM REAGENDAMENTO',
            'paciente_solicitou': 'PACIENTE SOLICITOU DESMARCAÇÃO',
            'pending': 'AGUARDANDO RESPOSTA',
            'queued': 'NA FILA DE ENVIO',
            'sent': 'ENVIADA',
            'no_phone': 'SEM TELEFONE'
        };

        const ultimoLog = telefonePrincipal.logs?.[telefonePrincipal.logs.length - 1];
        const dataUltimoEnvio = ultimoLog?.timestamp
            ? new Date(ultimoLog.timestamp).toLocaleString('pt-BR')
            : 'Data não disponível';

        const confirmar = confirm(
            `⚠️ ATENÇÃO - REENVIO DE MENSAGEM\n\n` +
            `Esta mensagem já foi enviada ${numeroEnvios} vez${numeroEnvios > 1 ? 'es' : ''} para este paciente.\n\n` +
            `📋 Paciente: ${desmarcacao.nomePaciente}\n` +
            `📱 Telefone: ${PhoneNormalizer.formatForDisplay(telefonePrincipal.telefone)}\n` +
            `🗓️ Consulta: ${desmarcacao.dataHoraFormatada}\n\n` +
            `📤 Último envio: ${dataUltimoEnvio}\n` +
            `📊 Status atual: ${statusLabel[desmarcacao.statusGeral] || desmarcacao.statusGeral}\n\n` +
            `Deseja REALMENTE reenviar esta mensagem?`
        );

        if (!confirmar) {
            return;
        }
    } else {
        // Confirmação padrão para 1º e 2º envios
        const confirmar = confirm(
            `Enviar mensagem sobre desmarcação?\n\n` +
            `Paciente: ${desmarcacao.nomePaciente}\n` +
            `Telefone: ${PhoneNormalizer.formatForDisplay(telefonePrincipal.telefone)}\n` +
            `Consulta: ${desmarcacao.dataHoraFormatada}`
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
        const result = await DesmarcacaoService.sendDesmarcacaoMessage(desmarcacao, 0);

        Toast.success(
            'Mensagem enviada!',
            `Adicionada à fila de envio. ID: ${result.queueId}`,
            5000
        );

        // Atualiza UI
        renderDesmarcacoes();
        updateStats();

    } catch (error) {
        console.error('[Desmarcação] Erro ao enviar:', error);
        Toast.error(
            'Erro ao enviar',
            error.message,
            6000
        );
    }
};

/**
 * Mostra detalhes da desmarcação (função global)
 */
window.showDesmarcacaoDetails = function(desmarcacaoId) {
    const desmarcacao = state.desmarcacoes.find(d => d.id === desmarcacaoId);
    if (!desmarcacao) {
        console.error('[Desmarcação] Não encontrada:', desmarcacaoId);
        return;
    }

    const telefonePrincipal = desmarcacao.telefones[0];
    const telefones = desmarcacao.telefones
        .filter(t => t.telefone)
        .map(t => `${PhoneNormalizer.formatForDisplay(t.telefone)} (${t.telefoneType})`)
        .join(', ') || 'Nenhum telefone cadastrado';

    const modalHtml = `
        <div class="modal-overlay" onclick="this.remove()">
            <div class="modal-content" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>Detalhes da Desmarcação</h3>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="detail-row">
                        <span class="detail-label">Paciente:</span>
                        <span class="detail-value">${desmarcacao.nomePaciente}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Prontuário:</span>
                        <span class="detail-value">${desmarcacao.prontuario}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Nr Consulta:</span>
                        <span class="detail-value">${desmarcacao.consultaNumero}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Especialidade:</span>
                        <span class="detail-value">${formatMarkdownToHTML(desmarcacao.especialidade)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Data/Hora:</span>
                        <span class="detail-value">${formatMarkdownToHTML(desmarcacao.dataHoraFormatada)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Profissional:</span>
                        <span class="detail-value">${desmarcacao.profissional || 'Não informado'}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Telefones:</span>
                        <span class="detail-value">${telefones}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Desmarcação:</span>
                        <span class="detail-value">${desmarcacao.dataDesmarcacaoFormatada || 'Não informada'}</span>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Fechar</button>
                    ${telefonePrincipal?.telefone ? `
                        <button class="btn-primary" onclick="window.handleSendDesmarcacaoMessage('${desmarcacao.id}')">
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
    // Os botões já usam onclick inline para evitar problemas com multiple listeners
}

/**
 * Envia mensagens automaticamente para desmarcações novas (Modo Admin)
 */
async function autoSendDesmarcacaoMessages(desmarcacoes) {
    let sent = 0;
    let failed = 0;

    for (const desmarcacao of desmarcacoes) {
        try {
            // Verifica se tem telefone
            const telefonePrincipal = desmarcacao.telefones?.[0];
            if (!telefonePrincipal?.telefone) {
                console.log(`[Desmarcação] ⚠️ Consulta ${desmarcacao.consultaNumero} sem telefone - pulando envio automático`);
                continue;
            }

            // Envia mensagem (vai para a fila com proteção anti-banimento)
            await DesmarcacaoService.sendDesmarcacaoMessage(desmarcacao, 0);
            sent++;

            console.log(`[Desmarcação] ✅ Mensagem enviada automaticamente para consulta ${desmarcacao.consultaNumero}`);

        } catch (error) {
            failed++;
            console.error(`[Desmarcação] ❌ Erro ao enviar mensagem automaticamente:`, error);
        }
    }

    // Atualiza UI
    renderDesmarcacoes();
    updateStats();

    // Notifica resultado
    if (sent > 0) {
        Toast.success(
            'Envio automático concluído',
            `${sent} mensagem(ns) enviada(s)${failed > 0 ? `, ${failed} falhou(aram)` : ''}`,
            6000
        );
    } else if (failed > 0) {
        Toast.error('Erro no envio automático', `${failed} mensagem(ns) falharam`, 6000);
    }
}

export default {
    init
};
