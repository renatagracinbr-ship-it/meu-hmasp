/**
 * Utilitário para clonar e sincronizar o header de monitoramento
 * nas abas Desmarcação e Notificação aos Faltantes
 */

let syncInterval = null;

/**
 * Inicia a sincronização visual do header em todas as abas
 */
export function startHeaderSync() {
    console.log('[HeaderClone] Iniciando sincronização de headers...');

    // Sincroniza imediatamente
    syncHeaders();

    // Sincroniza a cada 500ms para manter tudo atualizado
    syncInterval = setInterval(syncHeaders, 500);
}

/**
 * Para a sincronização
 */
export function stopHeaderSync() {
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
    }
}

/**
 * Sincroniza o conteúdo dos headers
 */
function syncHeaders() {
    // Header principal (Confirmação de Presença)
    const mainHeader = document.querySelector('#confirmacao-tab .confirmacao-header');
    if (!mainHeader) return;

    // Headers das outras abas
    const desmarcacaoHeader = document.querySelector('#desmarcacao-tab .confirmacao-header');
    const notificacaoHeader = document.querySelector('#notificacao-tab .confirmacao-header');

    if (desmarcacaoHeader) {
        cloneHeaderContent(mainHeader, desmarcacaoHeader, 'Desmarcação de Consultas');
    }

    if (notificacaoHeader) {
        cloneHeaderContent(mainHeader, notificacaoHeader, 'Notificação aos Faltantes');
    }
}

/**
 * Sincroniza apenas os indicadores de status (AGHUse e Monitor)
 * mantendo o título e toggle de cada aba independentes
 */
function cloneHeaderContent(sourceHeader, targetHeader, targetTitle) {
    // Clona apenas os indicadores de status (AGHUse e Monitor), NÃO o toggle
    const sourceStatusBar = sourceHeader.querySelector('.header-status');
    const targetStatusBar = targetHeader.querySelector('.header-status');

    if (sourceStatusBar && targetStatusBar) {
        // Sincroniza apenas os 2 primeiros indicadores (AGHUse e Monitor)
        const aghuseIndicator = sourceStatusBar.querySelector('.status-item-inline:nth-child(1)');
        const monitorIndicator = sourceStatusBar.querySelector('.status-item-inline:nth-child(2)');

        const targetAghuseIndicator = targetStatusBar.querySelector('.status-item-inline:nth-child(1)');
        const targetMonitorIndicator = targetStatusBar.querySelector('.status-item-inline:nth-child(2)');

        if (aghuseIndicator && targetAghuseIndicator) {
            targetAghuseIndicator.innerHTML = aghuseIndicator.innerHTML;
        }

        if (monitorIndicator && targetMonitorIndicator) {
            targetMonitorIndicator.innerHTML = monitorIndicator.innerHTML;
        }
    }
}

export default {
    startHeaderSync,
    stopHeaderSync
};
