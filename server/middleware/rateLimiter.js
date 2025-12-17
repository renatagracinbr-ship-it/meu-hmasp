/**
 * Middleware de Rate Limiting
 *
 * Protege endpoints contra abuso através de limitação de requisições
 * Baseado em IP e permite diferentes configurações por endpoint
 */

const logger = require('../utils/logger');

// Armazena tentativas por IP
const rateLimitStore = new Map();

// Configurações padrão
const DEFAULT_CONFIG = {
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // 100 requisições
    message: 'Muitas requisições. Tente novamente mais tarde.',
    skipSuccessfulRequests: false,
    skipFailedRequests: false
};

/**
 * Limpa entradas antigas do store
 */
function cleanupStore() {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, data] of rateLimitStore.entries()) {
        if (now > data.resetTime) {
            rateLimitStore.delete(key);
            cleaned++;
        }
    }

    if (cleaned > 0) {
        logger.debug(`[RateLimit] Limpeza: ${cleaned} entradas removidas`);
    }
}

// Limpeza periódica a cada 10 minutos
setInterval(cleanupStore, 10 * 60 * 1000);

/**
 * Cria um middleware de rate limiting
 */
function createRateLimiter(options = {}) {
    const config = { ...DEFAULT_CONFIG, ...options };

    return (req, res, next) => {
        // Obtém IP do cliente
        const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
        const key = `${config.name || 'default'}:${clientIp}`;

        const now = Date.now();

        // Busca ou cria registro
        let record = rateLimitStore.get(key);

        if (!record || now > record.resetTime) {
            // Cria novo registro
            record = {
                count: 0,
                resetTime: now + config.windowMs,
                firstRequest: now
            };
            rateLimitStore.set(key, record);
        }

        // Incrementa contador
        record.count++;

        // Calcula tempo restante
        const timeLeft = Math.ceil((record.resetTime - now) / 1000);

        // Headers informativos
        res.setHeader('X-RateLimit-Limit', config.max);
        res.setHeader('X-RateLimit-Remaining', Math.max(0, config.max - record.count));
        res.setHeader('X-RateLimit-Reset', new Date(record.resetTime).toISOString());

        // Verifica se excedeu limite
        if (record.count > config.max) {
            logger.warn(`[RateLimit] Limite excedido`, {
                ip: clientIp,
                endpoint: req.path,
                count: record.count,
                limit: config.max
            });

            return res.status(429).json({
                success: false,
                error: config.message,
                retryAfter: timeLeft
            });
        }

        next();
    };
}

// ============================================================================
// Rate Limiters Pré-configurados
// ============================================================================

/**
 * Rate limiter para login (proteção contra brute force)
 */
const loginLimiter = createRateLimiter({
    name: 'login',
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // 5 tentativas
    message: 'Muitas tentativas de login. Tente novamente em 15 minutos.'
});

/**
 * Rate limiter para criação de usuários
 */
const createUserLimiter = createRateLimiter({
    name: 'create-user',
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 3, // 3 tentativas
    message: 'Muitas tentativas de criação de usuário. Tente novamente em 1 hora.'
});

/**
 * Rate limiter para envio de mensagens WhatsApp
 */
const sendMessageLimiter = createRateLimiter({
    name: 'send-message',
    windowMs: 60 * 1000, // 1 minuto
    max: 10, // 10 mensagens
    message: 'Muitas mensagens enviadas. Aguarde 1 minuto.'
});

/**
 * Rate limiter para envio em massa
 */
const bulkSendLimiter = createRateLimiter({
    name: 'bulk-send',
    windowMs: 5 * 60 * 1000, // 5 minutos
    max: 2, // 2 envios em massa
    message: 'Limite de envios em massa atingido. Aguarde 5 minutos.'
});

/**
 * Rate limiter genérico para APIs
 */
const apiLimiter = createRateLimiter({
    name: 'api',
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // 100 requisições
    message: 'Muitas requisições. Tente novamente em alguns minutos.'
});

/**
 * Rate limiter mais permissivo para operações de leitura
 */
const readLimiter = createRateLimiter({
    name: 'read',
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 60, // 60 requisições
    message: 'Muitas requisições de leitura. Aguarde um momento.'
});

module.exports = {
    createRateLimiter,
    loginLimiter,
    createUserLimiter,
    sendMessageLimiter,
    bulkSendLimiter,
    apiLimiter,
    readLimiter
};
