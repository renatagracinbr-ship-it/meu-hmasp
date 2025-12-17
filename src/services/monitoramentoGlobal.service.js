/**
 * Serviço de Monitoramento Global
 *
 * Gerencia o monitoramento de consultas de forma global e independente das abas.
 * O monitoramento continua ativo mesmo quando o usuário muda de aba.
 */

import * as ConfirmacaoService from './confirmacao.service.js';
import * as MonitoramentoLog from './monitoramentoLog.service.js';

// Estado global do monitoramento
const state = {
    active: false,
    callbacks: new Set() // Múltiplos callbacks para diferentes abas
};

/**
 * Inicializa o monitoramento global
 * SEMPRE inicia o monitoramento automaticamente (política: sempre ativo)
 */
export async function init() {
    console.log('[MonitoramentoGlobal] Inicializando...');

    try {
        // Carrega estado anterior do PostgreSQL
        const estadoAnterior = await MonitoramentoLog.loadMonitoramentoState();

        console.log('[MonitoramentoGlobal] Estado anterior:', estadoAnterior.ativo ? 'ATIVO' : 'INATIVO');

        // POLÍTICA: Monitoramento SEMPRE ativo
        // Inicia automaticamente mesmo se estava parado antes
        console.log('[MonitoramentoGlobal] ✅ INICIANDO monitoramento automático (política: sempre ativo)');
        await start();

    } catch (error) {
        console.error('[MonitoramentoGlobal] Erro ao inicializar:', error);
    }
}

/**
 * Inicia o monitoramento global
 */
export async function start() {
    if (state.active) {
        console.log('[MonitoramentoGlobal] Monitoramento já está ativo');
        return;
    }

    console.log('[MonitoramentoGlobal] Iniciando monitoramento...');
    state.active = true;

    // Inicia o monitoramento de consultas
    await ConfirmacaoService.startMonitoring(handleNewConfirmations, 30000);

    console.log('[MonitoramentoGlobal] ✓ Monitoramento iniciado');
}

/**
 * Para o monitoramento global
 */
export async function stop() {
    if (!state.active) {
        console.log('[MonitoramentoGlobal] Monitoramento já está parado');
        return;
    }

    console.log('[MonitoramentoGlobal] Parando monitoramento...');
    state.active = false;

    // Para o monitoramento de consultas
    await ConfirmacaoService.stopMonitoring();

    console.log('[MonitoramentoGlobal] ✓ Monitoramento parado');
}

/**
 * Registra callback para receber notificações de novas consultas
 *
 * @param {Function} callback - Função a ser chamada quando novas consultas são encontradas
 * @returns {Function} - Função para remover o callback
 */
export function registerCallback(callback) {
    state.callbacks.add(callback);
    console.log('[MonitoramentoGlobal] Callback registrado. Total:', state.callbacks.size);

    // Retorna função para remover o callback
    return () => {
        state.callbacks.delete(callback);
        console.log('[MonitoramentoGlobal] Callback removido. Total:', state.callbacks.size);
    };
}

/**
 * Handler chamado quando novas consultas são encontradas
 * Distribui para todos os callbacks registrados
 */
function handleNewConfirmations(confirmations) {
    console.log('[MonitoramentoGlobal] Novas confirmações:', confirmations.length);

    // Notifica todos os callbacks registrados
    state.callbacks.forEach(callback => {
        try {
            callback(confirmations);
        } catch (error) {
            console.error('[MonitoramentoGlobal] Erro ao executar callback:', error);
        }
    });
}

/**
 * Verifica se o monitoramento está ativo
 */
export function isActive() {
    return state.active;
}

export default {
    init,
    start,
    stop,
    registerCallback,
    isActive
};
