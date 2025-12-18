/**
 * Configuração de Backends
 *
 * ARQUITETURA HMASP (São Paulo):
 * - VM2 (DMZ/Internet): WhatsApp apenas - Isolada da intranet
 * - VM3 (Intranet): AGHUse apenas - Acesso ao banco PostgreSQL
 * - Frontend: Orquestra comunicação entre VM2 e VM3
 */

const CONFIG = {
    // Backend Principal
    MAIN_BACKEND: 'http://localhost:3000',

    // Backend WhatsApp
    WHATSAPP_BACKEND: 'http://localhost:3000',

    // Backend AGHUse
    AGHUSE_BACKEND: 'http://localhost:3000',

    // Backend Database
    DATABASE_BACKEND: 'http://localhost:3000',

    // Desenvolvimento/Produção
    IS_DEVELOPMENT: window.location.hostname === 'localhost'
};

export default CONFIG;
