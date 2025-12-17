/**
 * Sistema de Logging Estruturado
 *
 * Níveis:
 * - debug: Informações de desenvolvimento (apenas em modo dev)
 * - info: Informações gerais do sistema
 * - warn: Avisos que não impedem o funcionamento
 * - error: Erros que precisam de atenção
 *
 * Uso:
 *   const logger = require('./server/utils/logger');
 *   logger.info('[WhatsApp] Cliente conectado');
 *   logger.error('[Auth] Erro ao validar sessão', error);
 */

const fs = require('fs');
const path = require('path');

// Cores ANSI para console
const colors = {
    reset: '\x1b[0m',
    debug: '\x1b[36m',    // Cyan
    info: '\x1b[32m',     // Green
    warn: '\x1b[33m',     // Yellow
    error: '\x1b[31m'     // Red
};

// Níveis de log
const levels = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};

class Logger {
    constructor() {
        this.isDevelopment = process.env.NODE_ENV !== 'production';
        this.logLevel = process.env.LOG_LEVEL || (this.isDevelopment ? 'debug' : 'info');
        this.logToFile = process.env.LOG_TO_FILE === 'true';

        if (this.logToFile) {
            this.logDir = path.join(__dirname, '../../logs');
            this.ensureLogDirectory();
        }
    }

    ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    shouldLog(level) {
        return levels[level] >= levels[this.logLevel];
    }

    formatMessage(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

        let formattedMessage = `${prefix} ${message}`;

        if (data) {
            if (data instanceof Error) {
                formattedMessage += `\n  Error: ${data.message}`;
                if (this.isDevelopment && data.stack) {
                    formattedMessage += `\n  Stack: ${data.stack}`;
                }
            } else if (typeof data === 'object') {
                formattedMessage += `\n  Data: ${JSON.stringify(data, null, 2)}`;
            } else {
                formattedMessage += ` ${data}`;
            }
        }

        return formattedMessage;
    }

    writeToFile(level, message) {
        if (!this.logToFile) return;

        try {
            const date = new Date().toISOString().split('T')[0];
            const logFile = path.join(this.logDir, `${date}.log`);
            const errorFile = path.join(this.logDir, `${date}_error.log`);

            // Log geral
            fs.appendFileSync(logFile, message + '\n');

            // Log de erros separado
            if (level === 'error') {
                fs.appendFileSync(errorFile, message + '\n');
            }
        } catch (error) {
            console.error('[Logger] Erro ao escrever em arquivo:', error.message);
        }
    }

    log(level, message, data = null) {
        if (!this.shouldLog(level)) return;

        const formattedMessage = this.formatMessage(level, message, data);
        const color = colors[level] || colors.reset;

        // Console com cor
        if (level === 'error') {
            console.error(`${color}${formattedMessage}${colors.reset}`);
        } else if (level === 'warn') {
            console.warn(`${color}${formattedMessage}${colors.reset}`);
        } else {
            console.log(`${color}${formattedMessage}${colors.reset}`);
        }

        // Arquivo sem cor
        this.writeToFile(level, formattedMessage);
    }

    debug(message, data = null) {
        this.log('debug', message, data);
    }

    info(message, data = null) {
        this.log('info', message, data);
    }

    warn(message, data = null) {
        this.log('warn', message, data);
    }

    error(message, data = null) {
        this.log('error', message, data);
    }

    // Métodos de conveniência para módulos específicos
    whatsapp = {
        debug: (msg, data) => this.debug(`[WhatsApp] ${msg}`, data),
        info: (msg, data) => this.info(`[WhatsApp] ${msg}`, data),
        warn: (msg, data) => this.warn(`[WhatsApp] ${msg}`, data),
        error: (msg, data) => this.error(`[WhatsApp] ${msg}`, data)
    };

    auth = {
        debug: (msg, data) => this.debug(`[Auth] ${msg}`, data),
        info: (msg, data) => this.info(`[Auth] ${msg}`, data),
        warn: (msg, data) => this.warn(`[Auth] ${msg}`, data),
        error: (msg, data) => this.error(`[Auth] ${msg}`, data)
    };

    aghuse = {
        debug: (msg, data) => this.debug(`[AGHUse] ${msg}`, data),
        info: (msg, data) => this.info(`[AGHUse] ${msg}`, data),
        warn: (msg, data) => this.warn(`[AGHUse] ${msg}`, data),
        error: (msg, data) => this.error(`[AGHUse] ${msg}`, data)
    };

    database = {
        debug: (msg, data) => this.debug(`[Database] ${msg}`, data),
        info: (msg, data) => this.info(`[Database] ${msg}`, data),
        warn: (msg, data) => this.warn(`[Database] ${msg}`, data),
        error: (msg, data) => this.error(`[Database] ${msg}`, data)
    };
}

// Singleton
const logger = new Logger();

module.exports = logger;
