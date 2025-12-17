/**
 * ============================================================
 * COMPONENTE: Configuração de Mensagens WhatsApp
 * ============================================================
 * Interface admin para gerenciar mensagens centralizadas
 */

import CONFIG from '../config/backend.config.js';
import { reloadTemplates } from '../services/whatsappTemplates.service.js';

const API_BASE = CONFIG.WHATSAPP_BACKEND;

// Estado do componente
const state = {
    mensagens: [],
    filtros: {
        fluxo: '',
        categoria: '',
        contexto: ''
    },
    mensagemSelecionada: null,
    editando: false
};

/**
 * Inicializa o componente
 */
export async function init() {
    console.log('[ConfigMensagens] Inicializando...');

    // Carrega mensagens
    await carregarMensagens();

    // Renderiza interface
    renderizarInterface();

    // Configura event listeners
    configurarEventos();

    console.log('[ConfigMensagens] Inicializado com sucesso');
}

/**
 * Carrega mensagens do servidor
 */
async function carregarMensagens() {
    try {
        const url = new URL(`${API_BASE}/api/mensagens`);

        if (state.filtros.fluxo) {
            url.searchParams.append('fluxo', state.filtros.fluxo);
        }
        if (state.filtros.categoria) {
            url.searchParams.append('categoria', state.filtros.categoria);
        }
        if (state.filtros.contexto) {
            url.searchParams.append('contexto', state.filtros.contexto);
        }

        const response = await fetch(url);
        const data = await response.json();

        if (data.success) {
            state.mensagens = data.mensagens;
            console.log('[ConfigMensagens] Mensagens carregadas:', data.total);
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('[ConfigMensagens] Erro ao carregar mensagens:', error);
        mostrarNotificacao('Erro ao carregar mensagens', 'error');
    }
}

/**
 * Renderiza a interface completa
 */
function renderizarInterface() {
    const container = document.getElementById('mensagens-container');
    if (!container) {
        console.error('[ConfigMensagens] Container não encontrado');
        return;
    }

    container.innerHTML = `
        <div class="mensagens-config">
            <!-- Cabeçalho com Filtros -->
            <div class="mensagens-header">
                <h3>⚙️ Configuração de Mensagens WhatsApp</h3>
                <p class="mensagens-subtitle">Gerencie todas as mensagens enviadas automaticamente pelo sistema</p>

                <div class="mensagens-filtros">
                    <select id="filtro-fluxo" class="form-select">
                        <option value="">Todos os Fluxos</option>
                        <option value="confirmacao">Confirmação</option>
                        <option value="desmarcacao">Desmarcação</option>
                        <option value="validacao">Validação/Erros</option>
                        <option value="fallback">Fallback</option>
                    </select>

                    <select id="filtro-categoria" class="form-select">
                        <option value="">Todas as Categorias</option>
                        <option value="template">Template</option>
                        <option value="resposta">Resposta</option>
                        <option value="reagendamento">Reagendamento</option>
                        <option value="erro">Erro</option>
                        <option value="informativo">Informativo</option>
                        <option value="assistencia">Assistência</option>
                    </select>

                    <button id="btn-recarregar" class="btn btn-secondary">
                        🔄 Recarregar
                    </button>

                    <button id="btn-estatisticas" class="btn btn-info">
                        📊 Estatísticas
                    </button>
                </div>
            </div>

            <!-- Lista de Mensagens -->
            <div class="mensagens-lista">
                ${renderizarListaMensagens()}
            </div>

            <!-- Modal de Edição -->
            <div id="modal-editar-mensagem" class="modal" style="display: none;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h4>✏️ Editar Mensagem</h4>
                        <button class="modal-close" id="modal-close-btn">&times;</button>
                    </div>
                    <div class="modal-body" id="modal-editar-body">
                        <!-- Conteúdo dinâmico -->
                    </div>
                </div>
            </div>

            <!-- Modal de Estatísticas -->
            <div id="modal-estatisticas" class="modal" style="display: none;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h4>📊 Estatísticas de Mensagens</h4>
                        <button class="modal-close" id="modal-stats-close-btn">&times;</button>
                    </div>
                    <div class="modal-body" id="modal-estatisticas-body">
                        <!-- Conteúdo dinâmico -->
                    </div>
                </div>
            </div>
        </div>
    `;

    // Aplica estilos
    aplicarEstilos();
}

/**
 * Renderiza lista de mensagens
 */
function renderizarListaMensagens() {
    if (state.mensagens.length === 0) {
        return `
            <div class="mensagens-vazio">
                <p>📭 Nenhuma mensagem encontrada</p>
            </div>
        `;
    }

    // Agrupa por fluxo
    const porFluxo = state.mensagens.reduce((acc, msg) => {
        if (!acc[msg.fluxo]) {
            acc[msg.fluxo] = [];
        }
        acc[msg.fluxo].push(msg);
        return acc;
    }, {});

    let html = '';

    for (const [fluxo, mensagens] of Object.entries(porFluxo)) {
        // Ordena mensagens: template primeiro, depois resposta, reagendamento, erro, informativo
        const mensagensOrdenadas = mensagens.sort((a, b) => {
            const ordemCategoria = { template: 1, resposta: 2, reagendamento: 3, erro: 4, informativo: 5, assistencia: 6 };
            const ordemA = ordemCategoria[a.categoria] || 999;
            const ordemB = ordemCategoria[b.categoria] || 999;
            return ordemA - ordemB;
        });

        html += `
            <div class="mensagens-grupo">
                <h4 class="mensagens-grupo-titulo">
                    ${getFluxoIcon(fluxo)} ${formatarFluxo(fluxo)}
                    <span class="badge">${mensagensOrdenadas.length}</span>
                </h4>

                <div class="mensagens-cards">
                    ${mensagensOrdenadas.map(msg => renderizarCardMensagem(msg)).join('')}
                </div>
            </div>
        `;
    }

    return html;
}

/**
 * Renderiza card de mensagem
 */
function renderizarCardMensagem(msg) {
    const envios = msg.total_envios || 0;
    const ultimoEnvio = msg.ultimo_envio_em ? new Date(msg.ultimo_envio_em).toLocaleString('pt-BR') : 'Nunca';

    return `
        <div class="mensagem-card" data-codigo="${msg.codigo}">
            <div class="mensagem-card-header">
                <span class="mensagem-categoria ${msg.categoria}">${msg.categoria}</span>
                <span class="mensagem-envios">📤 ${envios} envios</span>
            </div>

            <div class="mensagem-card-body">
                <h5>${msg.titulo || msg.codigo}</h5>
                <p class="mensagem-codigo">Código: <code>${msg.codigo}</code></p>

                <div class="mensagem-preview">
                    ${truncarTexto(msg.texto, 150)}
                </div>

                <div class="mensagem-info">
                    <small>Último envio: ${ultimoEnvio}</small>
                </div>
            </div>

            <div class="mensagem-card-footer">
                <button class="btn btn-sm btn-primary" onclick="editarMensagem('${msg.codigo}')">
                    ✏️ Editar
                </button>
                <button class="btn btn-sm btn-secondary" onclick="visualizarMensagem('${msg.codigo}')">
                    👁️ Visualizar
                </button>
            </div>
        </div>
    `;
}

/**
 * Configura event listeners
 */
function configurarEventos() {
    // Filtros
    const filtroFluxo = document.getElementById('filtro-fluxo');
    const filtroCategoria = document.getElementById('filtro-categoria');

    if (filtroFluxo) {
        filtroFluxo.addEventListener('change', async (e) => {
            state.filtros.fluxo = e.target.value;
            await carregarMensagens();
            renderizarInterface();
            configurarEventos(); // Re-configura eventos
        });
    }

    if (filtroCategoria) {
        filtroCategoria.addEventListener('change', async (e) => {
            state.filtros.categoria = e.target.value;
            await carregarMensagens();
            renderizarInterface();
            configurarEventos(); // Re-configura eventos
        });
    }

    // Botão recarregar
    const btnRecarregar = document.getElementById('btn-recarregar');
    if (btnRecarregar) {
        btnRecarregar.addEventListener('click', async () => {
            await carregarMensagens();
            renderizarInterface();
            configurarEventos();
            mostrarNotificacao('Mensagens recarregadas', 'success');
        });
    }

    // Botão estatísticas
    const btnEstatisticas = document.getElementById('btn-estatisticas');
    if (btnEstatisticas) {
        btnEstatisticas.addEventListener('click', mostrarEstatisticas);
    }

    // Fechar modais
    const modalClose = document.getElementById('modal-close-btn');
    if (modalClose) {
        modalClose.addEventListener('click', fecharModalEdicao);
    }

    const modalStatsClose = document.getElementById('modal-stats-close-btn');
    if (modalStatsClose) {
        modalStatsClose.addEventListener('click', fecharModalEstatisticas);
    }
}

/**
 * Edita mensagem
 */
window.editarMensagem = async function(codigo) {
    const mensagem = state.mensagens.find(m => m.codigo === codigo);
    if (!mensagem) return;

    state.mensagemSelecionada = mensagem;
    state.editando = true;

    const modal = document.getElementById('modal-editar-mensagem');
    const body = document.getElementById('modal-editar-body');

    body.innerHTML = `
        <div class="form-group">
            <label>Código:</label>
            <input type="text" class="form-control" value="${mensagem.codigo}" disabled />
        </div>

        <div class="form-group">
            <label>Título:</label>
            <input type="text" class="form-control" value="${mensagem.titulo || ''}" disabled />
        </div>

        <div class="form-group">
            <label>Fluxo:</label>
            <input type="text" class="form-control" value="${mensagem.fluxo}" disabled />
        </div>

        <div class="form-group">
            <label>Texto da Mensagem:</label>
            <textarea id="input-texto-mensagem" class="form-control" rows="10">${mensagem.texto}</textarea>
            <small class="form-text">
                💡 Use {variavel} para inserir variáveis dinâmicas
            </small>
        </div>

        <div class="form-group">
            <label>Variáveis Disponíveis:</label>
            <div class="variaveis-info">
                ${renderizarVariaveis(mensagem)}
            </div>
        </div>

        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="fecharModalEdicao()">Cancelar</button>
            <button class="btn btn-primary" onclick="salvarMensagem()">💾 Salvar</button>
        </div>
    `;

    modal.style.display = 'flex';
};

/**
 * Visualiza mensagem (modo leitura)
 */
window.visualizarMensagem = function(codigo) {
    const mensagem = state.mensagens.find(m => m.codigo === codigo);
    if (!mensagem) return;

    const modal = document.getElementById('modal-editar-mensagem');
    const body = document.getElementById('modal-editar-body');

    body.innerHTML = `
        <div class="mensagem-visualizacao">
            <h5>${mensagem.titulo || mensagem.codigo}</h5>

            <div class="info-row">
                <strong>Código:</strong> <code>${mensagem.codigo}</code>
            </div>

            <div class="info-row">
                <strong>Fluxo:</strong> ${formatarFluxo(mensagem.fluxo)}
            </div>

            <div class="info-row">
                <strong>Categoria:</strong> ${mensagem.categoria}
            </div>

            <div class="info-row">
                <strong>Contexto:</strong> ${mensagem.contexto || 'N/A'}
            </div>

            <div class="mensagem-texto-completo">
                <strong>Texto:</strong>
                <pre>${mensagem.texto}</pre>
            </div>

            <div class="mensagem-stats">
                <div class="stat-item">
                    <span class="stat-label">Total de Envios:</span>
                    <span class="stat-value">${mensagem.total_envios || 0}</span>
                </div>

                <div class="stat-item">
                    <span class="stat-label">Último Envio:</span>
                    <span class="stat-value">${mensagem.ultimo_envio_em ? new Date(mensagem.ultimo_envio_em).toLocaleString('pt-BR') : 'Nunca'}</span>
                </div>

                <div class="stat-item">
                    <span class="stat-label">Versão:</span>
                    <span class="stat-value">${mensagem.versao || 1}</span>
                </div>
            </div>
        </div>

        <div class="modal-footer">
            <button class="btn btn-secondary" onclick="fecharModalEdicao()">Fechar</button>
            <button class="btn btn-primary" onclick="editarMensagem('${mensagem.codigo}')">✏️ Editar</button>
        </div>
    `;

    modal.style.display = 'flex';
};

/**
 * Salva mensagem editada
 */
window.salvarMensagem = async function() {
    if (!state.mensagemSelecionada) return;

    const novoTexto = document.getElementById('input-texto-mensagem').value;

    if (!novoTexto.trim()) {
        mostrarNotificacao('O texto da mensagem não pode estar vazio', 'error');
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/mensagens/${state.mensagemSelecionada.codigo}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                texto: novoTexto,
                atualizadoPor: 'admin'
            })
        });

        const data = await response.json();

        if (data.success) {
            mostrarNotificacao('Mensagem atualizada com sucesso!', 'success');

            // Recarrega cache dos templates para que as mensagens enviadas usem o novo texto
            try {
                await reloadTemplates();
                console.log('[ConfigMensagens] ✅ Cache de templates recarregado');
            } catch (e) {
                console.warn('[ConfigMensagens] ⚠️ Falha ao recarregar cache de templates:', e);
            }

            fecharModalEdicao();
            await carregarMensagens();
            renderizarInterface();
            configurarEventos();
        } else {
            throw new Error(data.error);
        }
    } catch (error) {
        console.error('[ConfigMensagens] Erro ao salvar mensagem:', error);
        mostrarNotificacao('Erro ao salvar mensagem', 'error');
    }
};

/**
 * Fecha modal de edição
 */
window.fecharModalEdicao = function() {
    const modal = document.getElementById('modal-editar-mensagem');
    modal.style.display = 'none';
    state.mensagemSelecionada = null;
    state.editando = false;
};

/**
 * Fecha modal de estatísticas
 */
window.fecharModalEstatisticas = function() {
    const modal = document.getElementById('modal-estatisticas');
    modal.style.display = 'none';
};

/**
 * Mostra estatísticas
 */
async function mostrarEstatisticas() {
    try {
        const response = await fetch(`${API_BASE}/api/mensagens/stats/overview`);
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error);
        }

        const stats = data.stats;

        const modal = document.getElementById('modal-estatisticas');
        const body = document.getElementById('modal-estatisticas-body');

        body.innerHTML = `
            <div class="estatisticas-container">
                <div class="mensagens-stat-card">
                    <h5>📊 Resumo Geral</h5>
                    <div class="mensagem-stats">
                        <div class="mensagens-stat-item">
                            <span class="mensagens-stat-value">${stats.totalMensagens}</span>
                            <span class="mensagens-stat-label">Total de Mensagens</span>
                        </div>
                        <div class="mensagens-stat-item">
                            <span class="mensagens-stat-value">${stats.enviosHoje}</span>
                            <span class="mensagens-stat-label">Envios Hoje</span>
                        </div>
                    </div>
                </div>

                <div class="mensagens-stat-card">
                    <h5>🏆 Mensagens Mais Enviadas</h5>
                    <table class="table">
                        <thead>
                            <tr>
                                <th>Mensagem</th>
                                <th>Envios</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${stats.maisEnviadas.slice(0, 10).map(msg => `
                                <tr>
                                    <td>${msg.titulo}</td>
                                    <td><strong>${msg.total_envios}</strong></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;

        modal.style.display = 'flex';
    } catch (error) {
        console.error('[ConfigMensagens] Erro ao carregar estatísticas:', error);
        mostrarNotificacao('Erro ao carregar estatísticas', 'error');
    }
}

/**
 * Helpers
 */
function getFluxoIcon(fluxo) {
    const icons = {
        confirmacao: '✅',
        desmarcacao: '❌',
        validacao: '⚠️',
        fallback: '💬'
    };
    return icons[fluxo] || '📨';
}

function formatarFluxo(fluxo) {
    const nomes = {
        confirmacao: 'Confirmação de Presença',
        desmarcacao: 'Desmarcação de Consultas',
        validacao: 'Validação/Erros',
        fallback: 'Mensagens de Fallback'
    };
    return nomes[fluxo] || fluxo;
}

function truncarTexto(texto, maxLength) {
    if (texto.length <= maxLength) return texto;
    return texto.substring(0, maxLength) + '...';
}

function renderizarVariaveis(mensagem) {
    try {
        const variaveis = JSON.parse(mensagem.variaveis_disponiveis || '[]');

        if (variaveis.length === 0) {
            return '<em>Nenhuma variável disponível</em>';
        }

        return variaveis.map(v => `<code>{${v}}</code>`).join(', ');
    } catch (error) {
        return '<em>Nenhuma variável disponível</em>';
    }
}

function mostrarNotificacao(mensagem, tipo = 'info') {
    // Cria notificação toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.textContent = mensagem;

    document.body.appendChild(toast);

    // Remove após 3 segundos
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

/**
 * Aplica estilos CSS
 */
function aplicarEstilos() {
    if (document.getElementById('config-mensagens-styles')) {
        return; // Já aplicado
    }

    const style = document.createElement('style');
    style.id = 'config-mensagens-styles';
    style.textContent = `
        .mensagens-config {
            padding: 20px;
            max-width: 1400px;
            margin: 0 auto;
        }

        .mensagens-header {
            margin-bottom: 30px;
        }

        .mensagens-header h3 {
            margin: 0 0 5px 0;
            color: #2c3e50;
        }

        .mensagens-subtitle {
            color: #7f8c8d;
            margin: 0 0 20px 0;
        }

        .mensagens-filtros {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        .mensagens-filtros select,
        .mensagens-filtros button {
            padding: 8px 15px;
            border: 2px solid #007bff;
            border-radius: 6px;
            background: #e7f3ff;
            color: #0056b3;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
        }

        .mensagens-filtros button:hover {
            background: #007bff;
            color: white;
            border-color: #0056b3;
            transform: translateY(-1px);
            box-shadow: 0 2px 5px rgba(0,123,255,0.3);
        }

        .mensagens-filtros select {
            background: white;
            border-color: #ced4da;
            color: #495057;
        }

        .mensagens-filtros select:hover {
            border-color: #007bff;
            background: white;
        }

        .mensagens-grupo {
            margin-bottom: 30px;
        }

        .mensagens-grupo-titulo {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e0e0e0;
        }

        .mensagens-cards {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
            gap: 20px;
        }

        .mensagem-card {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 15px;
            background: white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            transition: box-shadow 0.3s;
        }

        .mensagem-card:hover {
            box-shadow: 0 4px 8px rgba(0,0,0,0.15);
        }

        .mensagem-card-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
        }

        .mensagem-categoria {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: bold;
            text-transform: uppercase;
        }

        .mensagem-categoria.template {
            background: #cfe2ff;
            color: #084298;
        }

        .mensagem-categoria.resposta {
            background: #d4edda;
            color: #155724;
        }

        .mensagem-categoria.erro {
            background: #f8d7da;
            color: #721c24;
        }

        .mensagem-categoria.informativo {
            background: #d1ecf1;
            color: #0c5460;
        }

        .mensagem-categoria.reagendamento {
            background: #fff3cd;
            color: #856404;
        }

        .mensagem-categoria.assistencia {
            background: #e2d4f0;
            color: #4a235a;
        }

        .mensagem-envios {
            font-size: 12px;
            color: #666;
        }

        .mensagem-card-body h5 {
            margin: 0 0 10px 0;
            color: #2c3e50;
        }

        .mensagem-codigo {
            font-size: 12px;
            color: #666;
            margin-bottom: 10px;
        }

        .mensagem-codigo code {
            background: #f8f9fa;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: monospace;
        }

        .mensagem-preview {
            font-size: 14px;
            color: #555;
            line-height: 1.5;
            margin-bottom: 10px;
            white-space: pre-wrap;
        }

        .mensagem-info {
            font-size: 12px;
            color: #999;
            margin-bottom: 10px;
        }

        .mensagem-card-footer {
            display: flex;
            gap: 10px;
            padding-top: 10px;
            border-top: 1px solid #eee;
        }

        .btn {
            padding: 6px 12px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            transition: opacity 0.3s;
        }

        .btn:hover {
            opacity: 0.8;
        }

        .btn-primary {
            background: #007bff;
            color: white;
        }

        .btn-secondary {
            background: #6c757d;
            color: white;
        }

        .btn-info {
            background: #17a2b8;
            color: white;
        }

        .btn-sm {
            padding: 4px 8px;
            font-size: 12px;
        }

        .modal {
            display: none;
            position: fixed;
            z-index: 9999;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            align-items: center;
            justify-content: center;
        }

        .modal-content {
            background: white;
            border-radius: 8px;
            max-width: 700px;
            width: 90%;
            max-height: 90vh;
            overflow-y: auto;
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px;
            border-bottom: 1px solid #ddd;
        }

        .modal-header h4 {
            margin: 0;
        }

        .modal-close {
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
            color: #999;
        }

        .modal-close:hover {
            color: #333;
        }

        .modal-body {
            padding: 20px;
        }

        .modal-footer {
            padding: 15px 20px;
            border-top: 1px solid #ddd;
            display: flex;
            justify-content: flex-end;
            gap: 10px;
        }

        .form-group {
            margin-bottom: 20px;
        }

        .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: bold;
            color: #333;
        }

        .form-control {
            width: 100%;
            padding: 8px 12px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-family: inherit;
        }

        textarea.form-control {
            resize: vertical;
            min-height: 150px;
        }

        .form-text {
            display: block;
            margin-top: 5px;
            font-size: 12px;
            color: #666;
        }

        .variaveis-info {
            padding: 10px;
            background: #f8f9fa;
            border-radius: 4px;
            font-size: 14px;
        }

        .toast {
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            border-radius: 4px;
            color: white;
            z-index: 10000;
            animation: slideIn 0.3s;
        }

        @keyframes slideIn {
            from {
                transform: translateX(100%);
            }
            to {
                transform: translateX(0);
            }
        }

        .toast-success {
            background: #28a745;
        }

        .toast-error {
            background: #dc3545;
        }

        .toast-info {
            background: #17a2b8;
        }

        .badge {
            background: #6c757d;
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: normal;
        }

        .mensagem-visualizacao {
            font-size: 14px;
        }

        .info-row {
            margin-bottom: 10px;
            padding-bottom: 10px;
            border-bottom: 1px solid #eee;
        }

        .mensagem-texto-completo {
            margin: 20px 0;
        }

        .mensagem-texto-completo pre {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 4px;
            white-space: pre-wrap;
            line-height: 1.6;
        }

        .mensagem-stats {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin-top: 20px;
        }

        @media (max-width: 768px) {
            .mensagem-stats {
                grid-template-columns: 1fr;
            }
        }

        .mensagens-stat-item {
            background: white;
            border: none;
            border-radius: 8px;
            padding: 2px 12px;
            display: flex;
            align-items: center;
            gap: 8px;
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.06);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            position: relative;
            overflow: hidden;
            height: 26px;
        }

        .mensagens-stat-item::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 4px;
            height: 100%;
            background: linear-gradient(180deg, #0cb7f2 0%, #0891b2 100%);
        }

        .mensagens-stat-value {
            font-size: 18px;
            font-weight: 700;
            background: linear-gradient(135deg, #0cb7f2 0%, #0891b2 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            line-height: 1;
            margin: 0;
            flex-shrink: 0;
        }

        .mensagens-stat-label {
            font-size: 9px;
            color: #64748b;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.2px;
            white-space: normal;
            flex: 1;
            line-height: 1.2;
        }

        .estatisticas-container {
            display: flex;
            flex-direction: column;
            gap: 20px;
        }

        .mensagens-stat-card {
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 15px;
        }

        .mensagens-stat-card h5 {
            margin: 0 0 15px 0;
            padding-bottom: 10px;
            border-bottom: 2px solid #e0e0e0;
        }

        .table {
            width: 100%;
            border-collapse: collapse;
        }

        .table th,
        .table td {
            padding: 10px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }

        .table th {
            background: #f8f9fa;
            font-weight: bold;
        }

        .mensagens-vazio {
            text-align: center;
            padding: 60px 20px;
            color: #999;
            font-size: 18px;
        }
    `;

    document.head.appendChild(style);
}
