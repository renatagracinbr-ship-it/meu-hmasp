/**
 * HMASP AGHUse Fix - Extensão Chrome
 * Redireciona automaticamente porta 3001 para 3000
 */

(function() {
    'use strict';

    console.log('[HMASP Fix] Iniciando correção AGHUse...');

    // Intercepta fetch
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        let url = args[0];

        if (typeof url === 'string' && url.includes(':3001')) {
            const newUrl = url.replace(':3001', ':3000');
            console.log('[HMASP Fix] 🔄 Redirecionando:', url, '→', newUrl);
            args[0] = newUrl;
        }

        return originalFetch.apply(this, args);
    };

    // Intercepta XMLHttpRequest
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        if (typeof url === 'string' && url.includes(':3001')) {
            const newUrl = url.replace(':3001', ':3000');
            console.log('[HMASP Fix] 🔄 XHR Redirecionando:', url, '→', newUrl);
            url = newUrl;
        }
        return originalOpen.call(this, method, url, ...rest);
    };

    console.log('[HMASP Fix] ✅ AGHUse configurado para porta 3000!');
})();
