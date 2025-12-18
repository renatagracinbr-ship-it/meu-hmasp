/**
 * Configuração de Backends
 *
 * ARQUITETURA HMASP (São Paulo):
 * - Backend Principal: API REST + Chat Próprio + Push Notifications
 * - AGHUse: Acesso ao banco PostgreSQL (consultas médicas)
 * - Database: SQLite local para persistência
 */

const CONFIG = {
    // Backend Principal (Chat Próprio + Push Notifications)
    MAIN_BACKEND: 'http://localhost:3000',

    // Backend AGHUse (Consultas médicas)
    AGHUSE_BACKEND: 'http://localhost:3000',

    // Backend Database (SQLite)
    DATABASE_BACKEND: 'http://localhost:3000',

    // Desenvolvimento/Produção
    IS_DEVELOPMENT: window.location.hostname === 'localhost'
};

export default CONFIG;
