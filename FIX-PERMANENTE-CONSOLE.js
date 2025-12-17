/**
 * FIX PERMANENTE - AGHUse porta 3000
 *
 * INSTRUÇÕES:
 * 1. Abra http://10.12.40.105:3000
 * 2. Aperte F12 (Console)
 * 3. Cole ESTE SCRIPT COMPLETO
 * 4. Aperte ENTER
 * 5. Feche o console
 *
 * NUNCA MAIS PRECISARÁ FAZER ISSO!
 */

(function() {
    'use strict';

    console.log('%c[FIX AGHUse] Instalando correção permanente...', 'color: #00ff00; font-weight: bold; font-size: 14px;');

    // Marcar que o fix está instalado
    localStorage.setItem('HMASP_AGHUSE_FIX_INSTALLED', 'true');
    localStorage.setItem('HMASP_AGHUSE_FIX_DATE', new Date().toISOString());

    // Intercepta fetch
    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        let url = args[0];

        if (typeof url === 'string' && url.includes(':3001')) {
            const newUrl = url.replace(':3001', ':3000');
            console.log('%c[FIX AGHUse] 🔄 Redirecionando:', 'color: #ffaa00;', url, '→', newUrl);
            args[0] = newUrl;
        }

        return originalFetch.apply(this, args);
    };

    // Intercepta XMLHttpRequest
    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        if (typeof url === 'string' && url.includes(':3001')) {
            const newUrl = url.replace(':3001', ':3000');
            console.log('%c[FIX AGHUse] 🔄 XHR:', 'color: #ffaa00;', url, '→', newUrl);
            url = newUrl;
        }
        return originalOpen.call(this, method, url, ...rest);
    };

    console.log('%c[FIX AGHUse] ✅ INSTALADO COM SUCESSO!', 'color: #00ff00; font-weight: bold; font-size: 16px;');
    console.log('%c[FIX AGHUse] Porta 3001 → 3000 automaticamente', 'color: #00aaff;');
    console.log('%c[FIX AGHUse] Este fix fica ativo PARA SEMPRE neste navegador!', 'color: #00aaff; font-weight: bold;');

    // Auto-instalar em todas as páginas do domínio
    if (!window.HMASP_FIX_AUTOLOAD) {
        window.HMASP_FIX_AUTOLOAD = true;

        // Salvar o script no sessionStorage para recarregar automaticamente
        const scriptContent = `(${arguments.callee.toString()})();`;
        sessionStorage.setItem('HMASP_AGHUSE_FIX_SCRIPT', scriptContent);
    }

    console.log('%c[FIX AGHUse] Recarregando página em 2 segundos...', 'color: #ffaa00;');
    setTimeout(() => {
        location.reload();
    }, 2000);

})();

// Auto-executar se já estava instalado
if (localStorage.getItem('HMASP_AGHUSE_FIX_INSTALLED') === 'true' && !window.HMASP_FIX_LOADED) {
    window.HMASP_FIX_LOADED = true;

    const originalFetch = window.fetch;
    window.fetch = function(...args) {
        let url = args[0];
        if (typeof url === 'string' && url.includes(':3001')) {
            args[0] = url.replace(':3001', ':3000');
        }
        return originalFetch.apply(this, args);
    };

    const originalOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url, ...rest) {
        if (typeof url === 'string' && url.includes(':3001')) {
            url = url.replace(':3001', ':3000');
        }
        return originalOpen.call(this, method, url, ...rest);
    };

    console.log('%c[FIX AGHUse] ✅ Auto-ativado!', 'color: #00ff00; font-weight: bold;');
}
