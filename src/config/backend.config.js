/**
 * Configuração de Backends
 *
 * ARQUITETURA HMASP (São Paulo):
 * - VM2 (DMZ/Internet): WhatsApp apenas - Isolada da intranet
 * - VM3 (Intranet): AGHUse apenas - Acesso ao banco PostgreSQL
 * - Frontend: Orquestra comunicação entre VM2 e VM3
 */

const CONFIG = {
    // Backend WhatsApp (Mesmo servidor do frontend)
    // Usa a mesma origem (hostname + porta) automaticamente
    WHATSAPP_BACKEND: window.location.hostname === 'localhost'
        ? 'http://localhost:3000'
        : `${window.location.protocol}//${window.location.host}`,

    // Backend AGHUse (Mesmo servidor - mesma porta 3000)
    AGHUSE_BACKEND: window.location.hostname === 'localhost'
        ? 'http://localhost:3000'
        : `${window.location.protocol}//${window.location.host}`,

    // Backend Database (Mesmo servidor - mesma porta 3000)
    DATABASE_BACKEND: window.location.hostname === 'localhost'
        ? 'http://localhost:3000'
        : `${window.location.protocol}//${window.location.host}`,

    // Desenvolvimento/Produção
    IS_DEVELOPMENT: window.location.hostname === 'localhost'
};

export default CONFIG;
