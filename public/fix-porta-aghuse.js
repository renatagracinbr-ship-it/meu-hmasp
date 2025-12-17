/**
 * FIX TEMPORÁRIO - Força AGHUse usar porta 3000
 *
 * Cole este script no Console do navegador (F12):
 */

(function() {
    console.log('[FIX] Configurando AGHUse para porta 3000...');

    // Intercepta fetch para redirecionar porta 3001 -> 3000
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        let url = args[0];

        // Se URL contém :3001, muda para :3000
        if (typeof url === 'string' && url.includes(':3001')) {
            console.log('[FIX] Redirecionando:', url);
            url = url.replace(':3001', ':3000');
            args[0] = url;
            console.log('[FIX] Para:', url);
        }

        return originalFetch.apply(this, args);
    };

    console.log('[FIX] ✅ AGHUse agora usa porta 3000!');
    console.log('[FIX] Recarregue a página para aplicar: location.reload()');
})();
