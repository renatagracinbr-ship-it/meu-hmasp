/**
 * Componente: Consultas do Paciente
 * Interface para buscar e visualizar consultas de um paciente especifico
 */

import CONFIG from '../config/backend.config.js';
import { Toast } from '../utils/toast.js';

// Estado do componente
const state = {
    pacienteAtual: null,
    consultas: [],
    isLoading: false,
    aghuseConnected: false
};

// Elementos do DOM
const elements = {
    // Filtros
    filtroNome: null,
    filtroCpf: null,
    filtroProntuario: null,
    btnBuscar: null,

    // Info do paciente
    pacienteInfo: null,
    pacienteNome: null,
    pacienteProntuarioValor: null,
    pacienteCpfValor: null,
    pacienteTelefoneValor: null,
    btnLimpar: null,

    // Estados
    consultasLoading: null,
    consultasResultado: null,
    consultasEmpty: null,
    consultasInicial: null,
    consultasCount: null,
    consultasTbody: null,

    // Status
    aghuseIndicator: null
};

/**
 * Inicializa o componente
 */
export function init() {
    console.log('[ConsultasPaciente] Inicializando componente...');

    // Captura referencias aos elementos do DOM
    elements.filtroNome = document.getElementById('filtro-nome');
    elements.filtroCpf = document.getElementById('filtro-cpf');
    elements.filtroProntuario = document.getElementById('filtro-prontuario');
    elements.btnBuscar = document.getElementById('btn-buscar-paciente');

    elements.pacienteInfo = document.getElementById('paciente-info');
    elements.pacienteNome = document.getElementById('paciente-nome');
    elements.pacienteProntuarioValor = document.getElementById('paciente-prontuario-valor');
    elements.pacienteCpfValor = document.getElementById('paciente-cpf-valor');
    elements.pacienteTelefoneValor = document.getElementById('paciente-telefone-valor');
    elements.btnLimpar = document.getElementById('btn-limpar-busca');

    elements.consultasLoading = document.getElementById('consultas-loading');
    elements.consultasResultado = document.getElementById('consultas-resultado');
    elements.consultasEmpty = document.getElementById('consultas-empty');
    elements.consultasInicial = document.getElementById('consultas-inicial');
    elements.consultasCount = document.getElementById('consultas-count');
    elements.consultasTbody = document.getElementById('consultas-tbody');

    elements.aghuseIndicator = document.getElementById('aghuse-indicator-consultas-paciente');

    // Configura event listeners
    setupEventListeners();

    // Verifica conexao com AGHUse
    checkAghuseConnection();

    console.log('[ConsultasPaciente] Componente inicializado');
}

/**
 * Configura event listeners
 */
function setupEventListeners() {
    // Botao buscar
    if (elements.btnBuscar) {
        elements.btnBuscar.addEventListener('click', handleBuscarPaciente);
    }

    // Botao limpar
    if (elements.btnLimpar) {
        elements.btnLimpar.addEventListener('click', handleLimparBusca);
    }

    // Enter nos campos de filtro
    [elements.filtroNome, elements.filtroCpf, elements.filtroProntuario].forEach(input => {
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    handleBuscarPaciente();
                }
            });
        }
    });

    // Mascara para CPF
    if (elements.filtroCpf) {
        elements.filtroCpf.addEventListener('input', (e) => {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length > 11) value = value.slice(0, 11);

            if (value.length > 9) {
                value = value.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
            } else if (value.length > 6) {
                value = value.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
            } else if (value.length > 3) {
                value = value.replace(/(\d{3})(\d{1,3})/, '$1.$2');
            }

            e.target.value = value;
        });
    }

    // Mascara para prontuario (apenas numeros)
    if (elements.filtroProntuario) {
        elements.filtroProntuario.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/\D/g, '');
        });
    }
}

/**
 * Verifica conexao com AGHUse
 */
async function checkAghuseConnection() {
    try {
        const response = await fetch(`${CONFIG.AGHUSE_BACKEND}/api/aghuse/test-connection`);
        const data = await response.json();

        state.aghuseConnected = data.success;
        updateAghuseStatus(data.success);
    } catch (error) {
        console.error('[ConsultasPaciente] Erro ao verificar AGHUse:', error);
        state.aghuseConnected = false;
        updateAghuseStatus(false);
    }
}

/**
 * Atualiza indicador de status do AGHUse
 */
function updateAghuseStatus(connected) {
    if (elements.aghuseIndicator) {
        if (connected) {
            elements.aghuseIndicator.textContent = 'Conectado';
            elements.aghuseIndicator.style.color = '#22c55e';
        } else {
            elements.aghuseIndicator.textContent = 'Desconectado';
            elements.aghuseIndicator.style.color = '#ef4444';
        }
    }
}

/**
 * Handler para buscar paciente
 */
async function handleBuscarPaciente() {
    const nome = elements.filtroNome?.value.trim() || '';
    const cpf = elements.filtroCpf?.value.replace(/\D/g, '') || '';
    const prontuario = elements.filtroProntuario?.value.trim() || '';

    // Valida que pelo menos um filtro foi preenchido
    if (!nome && !cpf && !prontuario) {
        Toast.warning('Preencha pelo menos um campo para buscar');
        return;
    }

    // Mostra loading
    showLoading(true);

    try {
        // Monta query string
        const params = new URLSearchParams();
        if (nome) params.append('nome', nome);
        if (cpf) params.append('cpf', cpf);
        if (prontuario) params.append('prontuario', prontuario);

        // Busca consultas do paciente
        const response = await fetch(`${CONFIG.AGHUSE_BACKEND}/api/aghuse/patient-appointments?${params.toString()}`);
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Erro ao buscar consultas');
        }

        state.consultas = data.consultas || [];

        // Atualiza info do paciente (usa dados da primeira consulta)
        if (state.consultas.length > 0) {
            const primeiraConsulta = state.consultas[0];
            state.pacienteAtual = {
                nome: primeiraConsulta.nomePaciente,
                prontuario: primeiraConsulta.prontuario,
                cpf: primeiraConsulta.cpf,
                telefone: primeiraConsulta.telefoneCelular || primeiraConsulta.telefoneFixo || '-'
            };
            showPacienteInfo(state.pacienteAtual);
        } else if (nome || cpf || prontuario) {
            // Busca dados do paciente mesmo sem consultas
            await buscarDadosPaciente({ nome, cpf, prontuario });
        }

        // Renderiza consultas
        renderConsultas(state.consultas);

    } catch (error) {
        console.error('[ConsultasPaciente] Erro ao buscar:', error);
        Toast.error(error.message || 'Erro ao buscar consultas');
        showEmpty();
    } finally {
        showLoading(false);
    }
}

/**
 * Busca dados basicos do paciente (quando nao tem consultas)
 */
async function buscarDadosPaciente(filtros) {
    try {
        const params = new URLSearchParams();
        if (filtros.nome) params.append('nome', filtros.nome);
        if (filtros.cpf) params.append('cpf', filtros.cpf);
        if (filtros.prontuario) params.append('prontuario', filtros.prontuario);

        const response = await fetch(`${CONFIG.AGHUSE_BACKEND}/api/aghuse/search-patient?${params.toString()}`);
        const data = await response.json();

        if (data.success && data.pacientes && data.pacientes.length > 0) {
            const paciente = data.pacientes[0];
            state.pacienteAtual = {
                nome: paciente.nome,
                prontuario: paciente.prontuario,
                cpf: paciente.cpf,
                telefone: paciente.telefone_celular || paciente.telefone_fixo || '-'
            };
            showPacienteInfo(state.pacienteAtual);
        }
    } catch (error) {
        console.warn('[ConsultasPaciente] Erro ao buscar dados do paciente:', error);
    }
}

/**
 * Exibe informacoes do paciente
 */
function showPacienteInfo(paciente) {
    if (!elements.pacienteInfo) return;

    elements.pacienteInfo.style.display = 'block';

    if (elements.pacienteNome) {
        elements.pacienteNome.textContent = paciente.nome || '-';
    }
    if (elements.pacienteProntuarioValor) {
        elements.pacienteProntuarioValor.textContent = paciente.prontuario || '-';
    }
    if (elements.pacienteCpfValor) {
        elements.pacienteCpfValor.textContent = formatCPF(paciente.cpf) || '-';
    }
    if (elements.pacienteTelefoneValor) {
        elements.pacienteTelefoneValor.textContent = formatTelefone(paciente.telefone) || '-';
    }
}

/**
 * Esconde informacoes do paciente
 */
function hidePacienteInfo() {
    if (elements.pacienteInfo) {
        elements.pacienteInfo.style.display = 'none';
    }
}

/**
 * Handler para limpar busca
 */
function handleLimparBusca() {
    // Limpa campos
    if (elements.filtroNome) elements.filtroNome.value = '';
    if (elements.filtroCpf) elements.filtroCpf.value = '';
    if (elements.filtroProntuario) elements.filtroProntuario.value = '';

    // Limpa estado
    state.pacienteAtual = null;
    state.consultas = [];

    // Esconde info do paciente
    hidePacienteInfo();

    // Mostra estado inicial
    showInicial();
}

/**
 * Renderiza lista de consultas
 */
function renderConsultas(consultas) {
    if (!elements.consultasTbody) return;

    // Limpa tabela
    elements.consultasTbody.innerHTML = '';

    if (consultas.length === 0) {
        showEmpty();
        return;
    }

    // Atualiza contador
    if (elements.consultasCount) {
        elements.consultasCount.textContent = `${consultas.length} consulta${consultas.length > 1 ? 's' : ''}`;
    }

    // Renderiza cada consulta
    consultas.forEach(consulta => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #f1f5f9';

        // Formata data/hora
        const dataConsulta = new Date(consulta.dataConsulta);
        const dataFormatada = dataConsulta.toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        const horaFormatada = dataConsulta.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
        });

        // Determina cor do status
        const statusColor = getStatusColor(consulta.situacao);

        tr.innerHTML = `
            <td style="padding: 14px 16px; font-size: 14px;">
                <div style="font-weight: 500; color: #334155;">${dataFormatada}</div>
                <div style="font-size: 13px; color: #64748b;">${horaFormatada}</div>
            </td>
            <td style="padding: 14px 16px; font-size: 14px; color: #334155;">${consulta.especialidade}</td>
            <td style="padding: 14px 16px; font-size: 14px; color: #334155;">${consulta.profissional}</td>
            <td style="padding: 14px 16px; font-size: 14px; color: #64748b;">${consulta.local}</td>
            <td style="padding: 14px 16px; text-align: center;">
                <span style="display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 500; background: ${statusColor.bg}; color: ${statusColor.text};">
                    ${consulta.situacaoDescricao || consulta.situacao}
                </span>
            </td>
        `;

        elements.consultasTbody.appendChild(tr);
    });

    // Mostra resultado
    showResultado();
}

/**
 * Retorna cores baseadas no status da consulta
 */
function getStatusColor(situacao) {
    const colors = {
        'M': { bg: '#dcfce7', text: '#166534' }, // Marcada - Verde
        'A': { bg: '#dbeafe', text: '#1e40af' }, // Atendida - Azul
        'F': { bg: '#fee2e2', text: '#991b1b' }, // Falta - Vermelho
        'C': { bg: '#fef3c7', text: '#92400e' }, // Cancelada - Amarelo
        'L': { bg: '#f1f5f9', text: '#475569' }, // Livre - Cinza
        'G': { bg: '#f1f5f9', text: '#475569' }  // Gerada - Cinza
    };
    return colors[situacao] || { bg: '#f1f5f9', text: '#475569' };
}

/**
 * Mostra estado de loading
 */
function showLoading(show) {
    state.isLoading = show;

    if (elements.consultasLoading) {
        elements.consultasLoading.style.display = show ? 'block' : 'none';
    }
    if (elements.consultasResultado) {
        elements.consultasResultado.style.display = 'none';
    }
    if (elements.consultasEmpty) {
        elements.consultasEmpty.style.display = 'none';
    }
    if (elements.consultasInicial) {
        elements.consultasInicial.style.display = 'none';
    }
}

/**
 * Mostra resultado
 */
function showResultado() {
    if (elements.consultasLoading) elements.consultasLoading.style.display = 'none';
    if (elements.consultasResultado) elements.consultasResultado.style.display = 'block';
    if (elements.consultasEmpty) elements.consultasEmpty.style.display = 'none';
    if (elements.consultasInicial) elements.consultasInicial.style.display = 'none';
}

/**
 * Mostra estado vazio
 */
function showEmpty() {
    if (elements.consultasLoading) elements.consultasLoading.style.display = 'none';
    if (elements.consultasResultado) elements.consultasResultado.style.display = 'none';
    if (elements.consultasEmpty) elements.consultasEmpty.style.display = 'block';
    if (elements.consultasInicial) elements.consultasInicial.style.display = 'none';
}

/**
 * Mostra estado inicial
 */
function showInicial() {
    if (elements.consultasLoading) elements.consultasLoading.style.display = 'none';
    if (elements.consultasResultado) elements.consultasResultado.style.display = 'none';
    if (elements.consultasEmpty) elements.consultasEmpty.style.display = 'none';
    if (elements.consultasInicial) elements.consultasInicial.style.display = 'block';
}

/**
 * Formata CPF
 */
function formatCPF(cpf) {
    if (!cpf) return null;
    const cleaned = cpf.replace(/\D/g, '');
    if (cleaned.length !== 11) return cpf;
    return cleaned.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

/**
 * Formata telefone
 */
function formatTelefone(telefone) {
    if (!telefone) return null;
    const cleaned = telefone.replace(/\D/g, '');
    if (cleaned.length === 11) {
        return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    } else if (cleaned.length === 10) {
        return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }
    return telefone;
}

// Exporta funcoes publicas
export default {
    init
};
