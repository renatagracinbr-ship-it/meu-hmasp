/**
 * Serviço de Templates WhatsApp - Confirmação de Presença
 *
 * FONTE ÚNICA DE VERDADE: BANCO DE DADOS
 * - Todos os templates são carregados do banco de dados
 * - Edições na aba de configurações refletem imediatamente nas mensagens
 * - Sem fallback hardcoded - se não encontrar no banco, erro
 */

import CONFIG from '../config/backend.config.js';

// ============================================================
// CONFIGURAÇÃO
// ============================================================

const API_BASE = CONFIG.WHATSAPP_BACKEND;

// Cache de templates do banco de dados
const templateCache = {
    data: new Map(),
    lastUpdate: null,
    expiryMs: 1 * 60 * 1000, // 1 minuto (reduzido para refletir edições mais rápido)
    loading: false,
    loadPromise: null
};

// Mapeamento de IDs do JS para códigos do banco de dados
const ID_MAPPING = {
    'marcacao_confirmacao': 'notificacao_confirmacao_presenca',
    'lembrete_72h': 'notificacao_lembrete_72h',
    'desmarcacao_notificacao': 'notificacao_desmarcacao_consulta',
    'reagendamento_confirmacao': 'notificacao_reagendamento_confirmacao',
    'resposta_confirmado': 'confirmacao_presenca_aprovada',
    'resposta_nao_poderei': 'confirmacao_presenca_declinada'
};

// Botões para cada tipo de template (não editáveis via UI)
const TEMPLATE_BUTTONS = {
    'marcacao_confirmacao': [
        { id: 'confirmar_presenca_sim', body: '✅ Confirmo presença' },
        { id: 'confirmar_presenca_nao', body: '❌ Não poderei comparecer' },
        { id: 'consulta_nao_agendada', body: '⚠️ Não agendei essa consulta' }
    ],
    'lembrete_72h': [
        { id: 'confirmar_presenca_sim', body: '✅ Confirmo presença' },
        { id: 'confirmar_presenca_nao', body: '❌ Não poderei comparecer' },
        { id: 'consulta_nao_agendada', body: '⚠️ Não agendei essa consulta' }
    ],
    'desmarcacao_notificacao': [
        { id: 'reagendamento', body: '📅 Solicito reagendamento' },
        { id: 'paciente_solicitou', body: '✋ Fui eu quem solicitei' },
        { id: 'sem_reagendamento', body: '❌ Não é necessário reagendar' }
    ],
    'reagendamento_confirmacao': [
        { id: 'confirmar_presenca_sim', body: '✅ Confirmo presença' },
        { id: 'confirmar_presenca_nao', body: '❌ Não poderei comparecer' },
        { id: 'consulta_nao_agendada', body: '⚠️ Não agendei essa consulta' }
    ],
    'resposta_confirmado': [],
    'resposta_nao_poderei': []
};

/**
 * Status de envio/resposta
 */
export const STATUS = {
    PENDING: 'pending',
    SENT: 'sent',
    DELIVERED: 'delivered',
    READ: 'read',
    CONFIRMED: 'confirmed',
    DECLINED: 'declined',
    NO_RESPONSE: 'no_response',
    FAILED: 'failed',
    UNSUPPORTED: 'unsupported'
};

// ============================================================
// FUNÇÕES DE CACHE E API
// ============================================================

/**
 * Verifica se o cache está expirado
 */
function isCacheExpired() {
    if (!templateCache.lastUpdate) return true;
    return (Date.now() - templateCache.lastUpdate) > templateCache.expiryMs;
}

/**
 * Carrega templates do banco de dados via API
 * Retorna Promise para permitir aguardar carregamento
 */
async function loadTemplatesFromDB() {
    // Se já está carregando, retorna a Promise existente
    if (templateCache.loading && templateCache.loadPromise) {
        return templateCache.loadPromise;
    }

    // Se cache ainda é válido, não recarrega
    if (!isCacheExpired() && templateCache.data.size > 0) {
        return true;
    }

    templateCache.loading = true;
    templateCache.loadPromise = (async () => {
        try {
            console.log('[WhatsAppTemplates] 🔄 Carregando templates do BANCO DE DADOS...');

            const response = await fetch(`${API_BASE}/api/mensagens`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();
            if (!result.success || !result.mensagens) {
                throw new Error('Resposta inválida da API');
            }

            // Limpa e atualiza cache
            templateCache.data.clear();
            result.mensagens.forEach(msg => {
                templateCache.data.set(msg.codigo, msg);
            });
            templateCache.lastUpdate = Date.now();

            console.log(`[WhatsAppTemplates] ✅ ${templateCache.data.size} templates carregados do banco`);
            return true;

        } catch (error) {
            console.error('[WhatsAppTemplates] ❌ ERRO ao carregar templates do banco:', error.message);
            throw error;
        } finally {
            templateCache.loading = false;
            templateCache.loadPromise = null;
        }
    })();

    return templateCache.loadPromise;
}

/**
 * Garante que o cache está carregado antes de continuar
 */
async function ensureCacheLoaded() {
    if (templateCache.data.size === 0 || isCacheExpired()) {
        await loadTemplatesFromDB();
    }
}

/**
 * Busca template do banco de dados pelo código
 */
function getTemplateFromDB(codigoBanco) {
    return templateCache.data.get(codigoBanco) || null;
}

/**
 * Renderiza texto do banco substituindo variáveis
 */
function renderTextoDB(texto, variaveis) {
    let resultado = texto;

    Object.keys(variaveis).forEach(chave => {
        const regex = new RegExp(`\\{${chave}\\}`, 'g');
        resultado = resultado.replace(regex, variaveis[chave]);
    });

    return resultado;
}

/**
 * Converte variáveis do formato JS para formato do banco
 */
function convertVariablesToDB(data) {
    const result = {};

    if (data.nomePaciente) {
        result.nome = data.nomePaciente;
    }

    if (data.especialidade) {
        result.especialidade = data.especialidade;
    }

    if (data.dataHora) {
        const partes = data.dataHora.split(' ');
        result.data = partes[0];
        result.horario = partes[1];
    }

    if (data.medico) {
        result.profissional = data.medico;
    }

    return result;
}

// ============================================================
// FUNÇÃO PRINCIPAL: generateMessage (SOMENTE BANCO DE DADOS)
// ============================================================

/**
 * Gera mensagem a partir de um template do BANCO DE DADOS
 *
 * IMPORTANTE: Esta função é SÍNCRONA mas depende do cache estar carregado.
 * O cache é carregado na inicialização do módulo.
 * Se o cache estiver vazio, dispara carregamento e lança erro.
 *
 * @param {string} templateId - ID do template (formato JS)
 * @param {Object} data - Dados para preencher variáveis
 * @returns {Object} - Mensagem formatada com texto e botões
 */
export function generateMessage(templateId, data) {
    // Mapeia ID do JS para código do banco
    const codigoBanco = ID_MAPPING[templateId];

    if (!codigoBanco) {
        throw new Error(`[WhatsAppTemplates] Template ID não mapeado: ${templateId}`);
    }

    // Busca do cache (deve estar carregado)
    const templateDB = getTemplateFromDB(codigoBanco);

    if (!templateDB || !templateDB.texto) {
        // Se cache vazio, dispara carregamento para próxima vez
        if (templateCache.data.size === 0 || isCacheExpired()) {
            loadTemplatesFromDB().catch(() => {});
        }
        throw new Error(`[WhatsAppTemplates] Template não encontrado no banco: ${codigoBanco}. Verifique se o servidor está rodando.`);
    }

    console.log(`[WhatsAppTemplates] 📨 Usando template do BANCO: ${codigoBanco}`);

    // Converte variáveis e renderiza
    const variaveisDB = convertVariablesToDB(data);
    const textoRenderizado = renderTextoDB(templateDB.texto, variaveisDB);

    return {
        templateId: templateId,
        codigoBanco: codigoBanco,
        categoria: templateDB.template_categoria || 'UTILITY',
        idioma: 'pt_BR',
        texto: textoRenderizado,
        botoes: TEMPLATE_BUTTONS[templateId] || [],
        fonte: 'banco_de_dados'
    };
}

/**
 * Gera mensagem a partir de um template (versão assíncrona - RECOMENDADA)
 *
 * Esta versão GARANTE que o cache está carregado antes de gerar a mensagem.
 * Use esta versão sempre que possível.
 *
 * @param {string} templateId - ID do template (formato JS)
 * @param {Object} data - Dados para preencher variáveis
 * @returns {Promise<Object>} - Mensagem formatada com texto e botões
 */
export async function generateMessageAsync(templateId, data) {
    // Garante que cache está carregado
    await ensureCacheLoaded();

    // Mapeia ID do JS para código do banco
    const codigoBanco = ID_MAPPING[templateId];

    if (!codigoBanco) {
        throw new Error(`[WhatsAppTemplates] Template ID não mapeado: ${templateId}`);
    }

    const templateDB = getTemplateFromDB(codigoBanco);

    if (!templateDB || !templateDB.texto) {
        throw new Error(`[WhatsAppTemplates] Template não encontrado no banco: ${codigoBanco}`);
    }

    console.log(`[WhatsAppTemplates] 📨 Usando template do BANCO: ${codigoBanco}`);

    // Converte variáveis e renderiza
    const variaveisDB = convertVariablesToDB(data);
    const textoRenderizado = renderTextoDB(templateDB.texto, variaveisDB);

    return {
        templateId: templateId,
        codigoBanco: codigoBanco,
        categoria: templateDB.template_categoria || 'UTILITY',
        idioma: 'pt_BR',
        texto: textoRenderizado,
        botoes: TEMPLATE_BUTTONS[templateId] || [],
        fonte: 'banco_de_dados'
    };
}

/**
 * Força recarga dos templates do banco
 * Chamado após edição na aba de configurações
 */
export async function reloadTemplates() {
    console.log('[WhatsAppTemplates] 🔄 Forçando recarga dos templates...');
    templateCache.lastUpdate = null;
    templateCache.data.clear();
    return loadTemplatesFromDB();
}

/**
 * Retorna estatísticas do cache
 */
export function getCacheStats() {
    return {
        size: templateCache.data.size,
        lastUpdate: templateCache.lastUpdate,
        isExpired: isCacheExpired(),
        templates: Array.from(templateCache.data.keys())
    };
}

/**
 * Valida se um template existe no banco
 */
export function validateTemplate(templateId) {
    const codigoBanco = ID_MAPPING[templateId];

    if (!codigoBanco) {
        return {
            valid: false,
            errors: ['Template ID não mapeado']
        };
    }

    const templateDB = getTemplateFromDB(codigoBanco);

    if (!templateDB) {
        return {
            valid: false,
            errors: ['Template não encontrado no banco de dados']
        };
    }

    return {
        valid: true,
        errors: []
    };
}

/**
 * Formata número de telefone para WhatsApp (padrão E.164)
 */
export function formatWhatsAppChatId(phoneE164) {
    if (!phoneE164 || phoneE164.trim() === '') {
        console.error('[WhatsAppTemplates] ❌ ERRO: Telefone vazio ou inválido');
        return null;
    }

    let number = phoneE164.trim();
    if (number.startsWith('+')) {
        number = number.replace('+', '');
    }

    if (!number || number.length < 10) {
        console.error('[WhatsAppTemplates] ❌ ERRO: Telefone muito curto:', number);
        return null;
    }

    const chatId = `${number}@c.us`;
    console.log(`[WhatsAppTemplates] ✅ ChatId gerado: ${chatId}`);
    return chatId;
}

/**
 * Registra log de envio/resposta
 */
export function createMessageLog(logData) {
    return {
        consultaNumero: logData.consultaNumero,
        pacCodigo: logData.pacCodigo,
        telefone: logData.telefone,
        telefoneType: logData.telefoneType,
        templateId: logData.templateId,
        status: logData.status,
        messageId: logData.messageId || null,
        timestamp: new Date().toISOString(),
        botaoClicado: logData.botaoClicado || null,
        timestampResposta: logData.timestampResposta || null,
        tentativa: logData.tentativa || 1,
        erro: logData.erro || null
    };
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================

// Carrega templates do banco ao inicializar o módulo
console.log('[WhatsAppTemplates] 🚀 Inicializando serviço (fonte: BANCO DE DADOS)');
loadTemplatesFromDB().catch(err => {
    console.error('[WhatsAppTemplates] ⚠️ Falha na inicialização:', err.message);
    console.error('[WhatsAppTemplates] ⚠️ Templates serão carregados na primeira requisição');
});

export default {
    STATUS,
    generateMessage,
    generateMessageAsync,
    reloadTemplates,
    getCacheStats,
    validateTemplate,
    formatWhatsAppChatId,
    createMessageLog
};
