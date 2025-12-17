/**
 * Servidor HMASP Chat - WhatsApp + PostgreSQL
 * 100% Local - Ubuntu/VM - Sem dependências cloud
 */

// Carrega variáveis de ambiente do arquivo .env
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const auth = require('./server/auth');
const aghuse = require('./server/aghuse-server');
const Database = require('better-sqlite3');
const BadgesService = require('./server/database/badges.service');
const ConsultasService = require('./server/database/consultas.service');
const WhatsAppRespostasService = require('./server/database/whatsappRespostas.service');
const MensagensWhatsApp = require('./server/database/mensagensWhatsApp.service');
const ContatosService = require('./server/database/contatos.service');
const ChatContextosService = require('./server/database/chatContextos.service');
const ChatService = require('./server/database/chat.service');

// ============================================================================
// API OFICIAL DO WHATSAPP (META CLOUD API)
// ============================================================================
const WhatsAppOfficialAPI = require('./server/services/whatsappOfficialAPI.service');

// Configuração: qual API usar
// 'official' = API Oficial da Meta (Cloud API)
// 'unofficial' = whatsapp-web.js (API não oficial)
const WHATSAPP_API_MODE = process.env.WHATSAPP_API_MODE || 'unofficial';

console.log(`[Config] Modo da API WhatsApp: ${WHATSAPP_API_MODE}`);

// ============================================================================
// NOVOS MÓDULOS - MELHORIAS DE QUALIDADE
// ============================================================================
const logger = require('./server/utils/logger');
const rateLimiter = require('./server/middleware/rateLimiter');
const validators = require('./server/middleware/validators');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// FUNÇÕES DE SEGURANÇA
// ============================================================================

/**
 * Executa comandos do sistema de forma segura usando execFile
 * Lista branca de comandos permitidos para prevenir RCE
 */
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

const ALLOWED_COMMANDS = {
    git: '/usr/bin/git',
    npm: '/usr/bin/npm',
    sudo: '/usr/bin/sudo'
};

/**
 * Valida e sanitiza parâmetros numéricos de query
 * Previne DoS via parâmetros excessivos
 */
function validateNumericParam(value, defaultValue, min = 0, max = 1000) {
    const parsed = parseInt(value);

    // Se não for número válido, usa default
    if (isNaN(parsed)) return defaultValue;

    // Garante que está dentro dos limites
    if (parsed < min) return min;
    if (parsed > max) return max;

    return parsed;
}

/**
 * Calcula timeout dinâmico para matching de contexto
 * Baseado na carga de contextos ativos
 *
 * @returns {number} Timeout em milissegundos
 */
function getMatchTimeout() {
    const TIMEOUT_BASE = 60000;  // 1 minuto base
    const TIMEOUT_MAX = 120000;  // 2 minutos máximo

    try {
        const stats = ChatContextosService.getStats();
        const contextosAtivos = stats.ativos || 0;

        // Se poucos contextos ativos (< 10), aceita janela maior
        if (contextosAtivos < 10) {
            logger.debug(`[Matching] Timeout: 2min (poucos contextos: ${contextosAtivos})`);
            return TIMEOUT_MAX;
        }

        // Se muitos contextos (> 50), janela menor (mais seguro)
        if (contextosAtivos > 50) {
            logger.debug(`[Matching] Timeout: 1min (muitos contextos: ${contextosAtivos})`);
            return TIMEOUT_BASE;
        }

        // Meio termo (10-50 contextos)
        logger.debug(`[Matching] Timeout: 1.5min (contextos: ${contextosAtivos})`);
        return 90000; // 1.5 minutos
    } catch (error) {
        logger.error('[Matching] Erro ao calcular timeout, usando padrão', error);
        return TIMEOUT_MAX; // Fallback seguro
    }
}

/**
 * Cache de mensagens WhatsApp para evitar I/O repetitivo
 * TTL: 30 segundos
 */
const messageCache = new Map();

/**
 * Sistema de Pausa do Bot - REMOVIDO
 * Não é mais necessário pausar bot pois não há mensagens fora de contexto.
 * Sistema agora responde APENAS a marcação/lembrete/desmarcação.
 */

async function getCachedMessages(chat, limit = 50) {
    const cacheKey = `${chat.id._serialized}_${limit}`;
    const now = Date.now();

    // Verifica se existe cache válido
    if (messageCache.has(cacheKey)) {
        const cached = messageCache.get(cacheKey);
        if (now - cached.timestamp < 30000) { // 30 segundos
            console.log(`[Cache] ✅ Usando mensagens cacheadas para ${chat.id._serialized}`);
            return cached.messages;
        }
    }

    // Busca mensagens do WhatsApp
    const messages = await chat.fetchMessages({ limit });

    // Armazena no cache
    messageCache.set(cacheKey, {
        messages,
        timestamp: now
    });

    // Limpeza automática de cache antigo (evita memory leak)
    if (messageCache.size > 100) {
        const sortedEntries = Array.from(messageCache.entries())
            .sort((a, b) => a[1].timestamp - b[1].timestamp);

        // Remove os 20 mais antigos
        for (let i = 0; i < 20; i++) {
            messageCache.delete(sortedEntries[i][0]);
        }
    }

    return messages;
}

async function executeSecureCommand(commandName, args, options = {}) {
    // Valida se comando está na whitelist
    if (!ALLOWED_COMMANDS[commandName]) {
        throw new Error(`Comando não permitido: ${commandName}`);
    }

    // Valida argumentos (não pode conter caracteres perigosos)
    const dangerousChars = /[;&|`$()]/;
    for (const arg of args) {
        if (dangerousChars.test(arg)) {
            throw new Error(`Argumento contém caracteres perigosos: ${arg}`);
        }
    }

    // Executa comando de forma segura
    const defaultOptions = {
        timeout: 60000, // 1 minuto padrão
        maxBuffer: 5 * 1024 * 1024, // 5MB
        ...options
    };

    try {
        const { stdout, stderr } = await execFileAsync(
            ALLOWED_COMMANDS[commandName],
            args,
            defaultOptions
        );
        return { stdout, stderr, success: true };
    } catch (error) {
        return {
            stdout: error.stdout || '',
            stderr: error.stderr || error.message,
            success: false,
            error: error.message
        };
    }
}

// Middlewares
app.use(cors());
app.use(express.json());

// IMPORTANTE: Desabilita cache para arquivos JavaScript em desenvolvimento
app.use((req, res, next) => {
    if (req.url.endsWith('.js') || req.url.endsWith('.css')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        console.log('[Server] 🚫 Cache desabilitado para:', req.url);
    }
    next();
});

// Servir arquivos estáticos da raiz (admin.html, etc)
app.use(express.static(__dirname));

// Servir arquivos estáticos da pasta public (whatsapp-admin.html, etc)
app.use(express.static(path.join(__dirname, 'public')));

// Servir frontend estático da pasta dist (interface principal)
app.use(express.static(path.join(__dirname, 'dist')));

// Estado do WhatsApp
let whatsappClient = null;
let isReady = false;
let qrCodeData = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
let heartbeatInterval = null;

// Estado do servidor HTTP (para graceful shutdown)
let httpServer = null;
let isShuttingDown = false;

// ============================================================================
// FUNÇÃO AUXILIAR: Envio de Mensagens Centralizadas
// ============================================================================

/**
 * Envia mensagem usando o sistema centralizado
 * @param {Object} msg - Objeto de mensagem do WhatsApp
 * @param {string} codigo - Código da mensagem
 * @param {Object} variaveis - Variáveis para substituição (opcional)
 * @param {Object} dadosLog - Dados adicionais para log (opcional)
 * @returns {Promise<boolean>} - true se enviou com sucesso
 */
async function enviarMensagemCentralizada(msg, codigo, variaveis = {}, dadosLog = {}) {
    try {
        // Renderiza mensagem
        const textoMensagem = MensagensWhatsApp.renderMensagem(codigo, variaveis);

        if (!textoMensagem) {
            console.error(`[WhatsApp] ❌ Mensagem ${codigo} não encontrada`);
            return false;
        }

        // Envia
        await msg.reply(textoMensagem);

        // Registra
        MensagensWhatsApp.registrarEnvio({
            codigo: codigo,
            telefone: dadosLog.telefone || msg.from.replace('@c.us', ''),
            confirmacaoId: dadosLog.confirmacaoId || null,
            textoEnviado: textoMensagem,
            variaveis: variaveis,
            contexto: dadosLog.contexto || null,
            status: 'enviado',
            enviadoPor: dadosLog.enviadoPor || 'sistema'
        });

        console.log(`[WhatsApp] ✅ Mensagem ${codigo} enviada`);
        return true;

    } catch (error) {
        console.error(`[WhatsApp] ❌ Erro ao enviar mensagem ${codigo}:`, error);

        // Registra erro
        MensagensWhatsApp.registrarEnvio({
            codigo: codigo,
            telefone: dadosLog.telefone || msg.from.replace('@c.us', ''),
            textoEnviado: null,
            variaveis: variaveis,
            status: 'erro',
            erro_detalhes: error.message
        });

        return false;
    }
}

// Heartbeat para manter conexão ativa
function startHeartbeat() {
    if (heartbeatInterval) return; // Já está rodando

    console.log('[WhatsApp] 💓 Iniciando heartbeat (a cada 30s)');
    heartbeatInterval = setInterval(async () => {
        if (!isReady || !whatsappClient) return;

        try {
            // Verifica se o cliente está realmente conectado
            const state = await whatsappClient.getState();
            if (state !== 'CONNECTED') {
                console.log('[WhatsApp] ⚠️ Estado não conectado:', state);
                isReady = false;
            } else {
                console.log('[WhatsApp] 💓 Heartbeat OK');
            }
        } catch (error) {
            console.error('[WhatsApp] ❌ Erro no heartbeat:', error.message);
            isReady = false;
        }
    }, 30000); // A cada 30 segundos
}

function stopHeartbeat() {
    if (heartbeatInterval) {
        console.log('[WhatsApp] Parando heartbeat');
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
}

// ============================================================================
// AUTENTICAÇÃO - ENDPOINTS
// ============================================================================

// Verifica auto-login (VM)
app.get('/api/auth/auto-login', async (req, res) => {
    try {
        const user = await auth.checkAutoLogin();
        if (user) {
            const token = await auth.createSession(user.username, user.role);
            console.log('[Auth] Auto-login realizado:', user.username);
            res.json({ success: true, user, token });
        } else {
            res.json({ success: false });
        }
    } catch (error) {
        console.error('[Auth] Erro no auto-login:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Login normal
app.post('/api/auth/login',
    rateLimiter.loginLimiter,
    validators.validateLogin,
    async (req, res) => {
        try {
            const { username, password } = req.body;

            const user = await auth.authenticateUser(username, password);
            if (!user) {
                logger.warn('[Auth] Tentativa de login inválida', { username });
                return res.status(401).json({ success: false, error: 'Usuário ou senha inválidos' });
            }

            const token = await auth.createSession(user.username, user.role);
            logger.info('[Auth] Login realizado', { username: user.username, role: user.role });

            res.json({ success: true, user, token });
        } catch (error) {
            logger.error('[Auth] Erro no login', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

// Solicitar acesso (para novos usuários)
app.post('/api/auth/request-access',
    rateLimiter.createUserLimiter,
    validators.validateRequestAccess,
    async (req, res) => {
        try {
            const { username, password, name, requestedRole, deviceInfo } = req.body;
            const result = await auth.requestAccess(username, password, name, requestedRole, deviceInfo);

            logger.info('[Auth] Solicitação de acesso criada', { username, requestedRole });
            res.json(result);
        } catch (error) {
            logger.error('[Auth] Erro ao solicitar acesso', error);
            res.status(500).json({ success: false, error: error.message });
        }
    }
);

// Validar sessão
app.get('/api/auth/session', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (!token) {
            return res.status(401).json({ success: false, error: 'Token não fornecido' });
        }

        const session = await auth.validateSession(token);
        if (!session) {
            return res.status(401).json({ success: false, error: 'Sessão inválida ou expirada' });
        }

        res.json({ success: true, session });
    } catch (error) {
        console.error('[Auth] Erro ao validar sessão:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Logout
app.post('/api/auth/logout', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        if (token) {
            await auth.deleteSession(token);
        }
        res.json({ success: true });
    } catch (error) {
        console.error('[Auth] Erro no logout:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Listar usuários (apenas admin)
app.get('/api/auth/users', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        const session = await auth.validateSession(token);

        if (!session || session.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Acesso negado' });
        }

        const users = await auth.getUsers();
        res.json({ success: true, users });
    } catch (error) {
        console.error('[Auth] Erro ao listar usuários:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Listar pedidos pendentes (apenas admin)
app.get('/api/auth/pending', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        const session = await auth.validateSession(token);

        if (!session || session.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Acesso negado' });
        }

        const pending = await auth.getPendingApprovals();
        res.json({ success: true, pending });
    } catch (error) {
        console.error('[Auth] Erro ao listar pendentes:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Aprovar usuário (apenas admin)
app.post('/api/auth/approve/:requestId', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        const session = await auth.validateSession(token);

        if (!session || session.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Acesso negado' });
        }

        const { requestId } = req.params;
        const result = await auth.approveUser(requestId, session.username);
        res.json(result);
    } catch (error) {
        console.error('[Auth] Erro ao aprovar usuário:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Rejeitar usuário (apenas admin)
app.post('/api/auth/reject/:requestId', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        const session = await auth.validateSession(token);

        if (!session || session.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Acesso negado' });
        }

        const { requestId } = req.params;
        const result = await auth.rejectUser(requestId);
        res.json(result);
    } catch (error) {
        console.error('[Auth] Erro ao rejeitar usuário:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Atualizar status de usuário (apenas admin)
app.patch('/api/auth/users/:userId/status', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        const session = await auth.validateSession(token);

        if (!session || session.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Acesso negado' });
        }

        const { userId } = req.params;
        const { status } = req.body;

        const result = await auth.updateUserStatus(userId, status);
        res.json(result);
    } catch (error) {
        console.error('[Auth] Erro ao atualizar status:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Criar novo usuário (apenas admin)
app.post('/api/auth/users', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        const session = await auth.validateSession(token);

        if (!session || session.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Acesso negado' });
        }

        const { username, password, name, role } = req.body;

        if (!username || !password || !name || !role) {
            return res.status(400).json({
                success: false,
                error: 'Todos os campos são obrigatórios: username, password, name, role'
            });
        }

        const result = await auth.createUser(username, password, name, role);
        res.json(result);
    } catch (error) {
        console.error('[Auth] Erro ao criar usuário:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Atualizar perfil de usuário (apenas admin)
app.patch('/api/auth/users/:userId/role', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        const session = await auth.validateSession(token);

        if (!session || session.role !== 'admin') {
            return res.status(403).json({ success: false, error: 'Acesso negado' });
        }

        const { userId } = req.params;
        const { role } = req.body;

        if (!role) {
            return res.status(400).json({ success: false, error: 'Perfil é obrigatório' });
        }

        const result = await auth.updateUserRole(userId, role);
        res.json(result);
    } catch (error) {
        console.error('[Auth] Erro ao atualizar perfil:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// WHATSAPP - INICIALIZAÇÃO
// ============================================================================

function initializeWhatsApp() {
    if (whatsappClient) {
        console.log('[WhatsApp] Cliente já existe');
        return;
    }

    console.log('[WhatsApp] Inicializando...');

    whatsappClient = new Client({
        authStrategy: new LocalAuth({
            dataPath: path.join(__dirname, '.wwebjs_auth')
        }),
        puppeteer: {
            headless: true,
            // executablePath removido - Puppeteer detecta automaticamente no Linux/Windows
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-software-rasterizer',
                '--disable-dev-tools',
                '--no-first-run',
                '--disable-extensions',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-background-timer-throttling',
                '--disable-ipc-flooding-protection',
                '--disable-hang-monitor'
            ],
            timeout: 60000
        }
    });

    // Evento: QR Code
    whatsappClient.on('qr', async (qr) => {
        console.log('[WhatsApp] QR Code gerado');
        try {
            qrCodeData = await qrcode.toDataURL(qr);
        } catch (err) {
            console.error('[WhatsApp] Erro ao gerar QR Code:', err);
        }
    });

    // Evento: Autenticado
    whatsappClient.on('authenticated', () => {
        console.log('[WhatsApp] Autenticado!');
        qrCodeData = null;
    });

    // Evento: Pronto
    whatsappClient.on('ready', () => {
        console.log('[WhatsApp] Pronto!');
        isReady = true;
        qrCodeData = null;
        reconnectAttempts = 0; // Reseta contador ao conectar com sucesso

        // Inicia heartbeat para manter conexão ativa
        startHeartbeat();
    });

    // Evento: Desconectado
    whatsappClient.on('disconnected', (reason) => {
        console.log('[WhatsApp] ⚠️ Desconectado:', reason);
        isReady = false;
        stopHeartbeat();

        // Verifica limite de tentativas
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            console.error('[WhatsApp] ❌ Máximo de tentativas de reconexão atingido');
            return;
        }

        reconnectAttempts++;
        const delay = Math.min(5000 * reconnectAttempts, 60000); // Backoff exponencial (max 60s)

        setTimeout(() => {
            console.log(`[WhatsApp] Tentando reconectar (tentativa ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
            whatsappClient.initialize();
        }, delay);
    });

    // Evento: Auth failure
    whatsappClient.on('auth_failure', (msg) => {
        console.error('[WhatsApp] ❌ Falha na autenticação:', msg);
        isReady = false;
    });

    // Evento: Mensagem recebida (para processar respostas)
    whatsappClient.on('message', async (msg) => {
        try {
            // DEBUG: Log de TODAS as mensagens (antes de filtrar fromMe)
            console.log('[WhatsApp] 🔍 DEBUG: Mensagem detectada - fromMe:', msg.fromMe, '| from:', msg.from, '| body:', msg.body);

            // Ignora mensagens enviadas por nós
            if (msg.fromMe) {
                console.log('[WhatsApp] ⏭️ Ignorando mensagem própria');
                return;
            }

            const body = msg.body.trim().toLowerCase();
            let phoneNumber = msg.from;

            console.log('='.repeat(80));
            console.log('[WhatsApp] 📨 MENSAGEM RECEBIDA de', phoneNumber, ':', body);
            console.log('='.repeat(80));

            // BUSCA CONTEXTO POR ID ÚNICO (novo sistema)
            let contextoObj = null; // Objeto completo do contexto
            let contexto = null;     // Tipo: 'confirmacao' ou 'desmarcacao'
            let confirmacaoId = null; // ID único da confirmação/desmarcação
            let realPhoneNumber = phoneNumber;
            let chatId = phoneNumber;
            let contextosAtivos = []; // Inicializa array vazio (evita ReferenceError)

            try {
                // Busca o chat
                const chat = await msg.getChat();
                chatId = chat.id._serialized;
                console.log('[WhatsApp] 🔍 Chat ID:', chatId);
                console.log('[WhatsApp] 🔍 Chat object:', {
                    id: chat.id,
                    name: chat.name,
                    isGroup: chat.isGroup,
                    isWAContact: chat.isWAContact
                });

                // 1️⃣ BUSCA CONTEXTOS ATIVOS USANDO SQLITE (Thread-Safe)
                // Estratégia 1: Busca exata pelo chatId (ex: 5511987654321@c.us)
                contextosAtivos = ChatContextosService.findContextosByPhone(chatId);
                if (contextosAtivos.length > 0) {
                    console.log(`[WhatsApp] ✅ Encontrado por chatId exato: ${chatId} (${contextosAtivos.length} contextos)`);
                }

                // Estratégia 2: Busca pelo número normalizado (sem sufixo)
                if (contextosAtivos.length === 0) {
                    const numeroNormalizado = chatId.replace(/@c\.us|@lid|@g\.us/g, '');
                    contextosAtivos = ChatContextosService.findContextosByPhone(numeroNormalizado);

                    if (contextosAtivos.length > 0) {
                        console.log(`[WhatsApp] ✅ Encontrado por número normalizado: ${numeroNormalizado} (${contextosAtivos.length} contextos)`);
                    }
                }

                // Estratégia 3: Fallback - busca por dígitos puros
                if (contextosAtivos.length === 0) {
                    const numeroDigitos = chatId.replace(/\D/g, '');
                    console.log('[WhatsApp] 🔍 Buscando por dígitos puros:', numeroDigitos);
                    contextosAtivos = ChatContextosService.findContextosByPhone(numeroDigitos);

                    if (contextosAtivos.length > 0) {
                        console.log(`[WhatsApp] ✅ Encontrado por dígitos puros: ${numeroDigitos} (${contextosAtivos.length} contextos)`);
                    }
                }

                // DEBUG: mostra contextos encontrados
                console.log(`[WhatsApp] 🔍 Contextos ativos para ${chatId}:`, contextosAtivos.length);

                // Converte para array de IDs para compatibilidade com código existente
                let idsAtivos = contextosAtivos.map(ctx => ctx.confirmacaoId);

                if (idsAtivos.length > 0) {
                    // 2️⃣ BUSCA MENSAGENS DO HISTÓRICO PARA MATCHING POR TIMESTAMP (com cache)
                    const messages = await getCachedMessages(chat, 50);
                    const ourMessages = messages.filter(m => m.fromMe === true);

                    if (ourMessages.length > 0) {
                        // Pega a ÚLTIMA mensagem nossa (mais recente)
                        const ourMessage = ourMessages[ourMessages.length - 1];
                        const ourMessageTimestamp = ourMessage.timestamp * 1000; // Converte para ms

                        console.log('[WhatsApp] 📨 Última mensagem nossa:', {
                            timestamp: new Date(ourMessageTimestamp).toISOString(),
                            body: ourMessage.body.substring(0, 100)
                        });

                        // 3️⃣ BUSCA O CONTEXTO MAIS PRÓXIMO POR TIMESTAMP
                        let melhorMatch = null;
                        let menorDiferenca = Infinity;

                        for (const ctx of contextosAtivos) {
                            // Contextos do SQLite já vêm filtrados por expiração
                            // Calcula diferença de timestamp
                            const ctxTimestamp = new Date(ctx.timestamp).getTime();
                            const diferenca = Math.abs(ourMessageTimestamp - ctxTimestamp);

                            console.log(`[WhatsApp] 🔍 Comparando timestamps - ID: ${ctx.confirmacaoId}, Diff: ${diferenca}ms`);

                            if (diferenca < menorDiferenca) {
                                menorDiferenca = diferenca;
                                melhorMatch = { id: ctx.confirmacaoId, ctx };
                            }
                        }

                        // 4️⃣ USA O MELHOR MATCH (se encontrou)
                        // 🔧 SEGURANÇA: Timeout dinâmico previne associação errada entre pacientes
                        const matchTimeout = getMatchTimeout();
                        if (melhorMatch && menorDiferenca < matchTimeout) {
                            contextoObj = melhorMatch.ctx;
                            contexto = contextoObj.contexto;
                            confirmacaoId = melhorMatch.id;
                            realPhoneNumber = contextoObj.telefone || chatId;

                            console.log('[WhatsApp] ✅ Contexto encontrado por TIMESTAMP MATCHING:', {
                                id: confirmacaoId,
                                contexto: contexto,
                                consultaNumero: contextoObj.consultaNumero,
                                diferencaMs: menorDiferenca
                            });
                        } else {
                            console.warn('[WhatsApp] ⚠️ Nenhum contexto válido encontrado por timestamp');
                            console.warn('[WhatsApp] 🔍 DEBUG - Melhor match:', melhorMatch ? {
                                id: melhorMatch.id,
                                diferencaMs: menorDiferenca,
                                limite: 3600000
                            } : 'nenhum');

                            // 🔧 FALLBACK ADICIONAL: Se encontrou match mas timestamp muito diferente,
                            // usa o mais recente mesmo assim (última mensagem enviada)
                            if (melhorMatch && idsAtivos.length === 1) {
                                console.log('[WhatsApp] 🔄 FALLBACK: Usando ID mais recente (único disponível)');
                                contextoObj = melhorMatch.ctx;
                                contexto = contextoObj.contexto;
                                confirmacaoId = melhorMatch.id;
                                realPhoneNumber = contextoObj.telefone || chatId;
                            }
                        }
                    } else {
                        console.warn('[WhatsApp] ⚠️ Nenhuma mensagem nossa no histórico');
                        console.warn('[WhatsApp] 🔍 DEBUG - Total de mensagens buscadas:', messages.length);

                        // 🔧 FALLBACK: Se só tem 1 contexto ativo, usa ele mesmo sem timestamp matching
                        if (contextosAtivos.length === 1) {
                            const ctx = contextosAtivos[0];
                            console.log('[WhatsApp] 🔄 FALLBACK: Usando único contexto disponível (sem histórico)');
                            contextoObj = ctx;
                            contexto = ctx.contexto;
                            confirmacaoId = ctx.confirmacaoId;
                            realPhoneNumber = ctx.telefone || chatId;
                        }
                    }
                } else {
                    console.warn('[WhatsApp] ⚠️ Nenhum contexto ativo para este telefone');
                    console.warn('[WhatsApp] 🔍 DEBUG - Chat ID:', chatId);
                }

                // 5️⃣ FALLBACK: Busca por análise de texto (compatibilidade com sistema antigo)
                if (!contexto) {
                    console.log('[WhatsApp] 🔄 Fallback: tentando detectar contexto por análise de texto');

                    const messages = await getCachedMessages(chat, 50);
                    const ourMessages = messages.filter(m => m.fromMe === true);

                    if (ourMessages.length > 0) {
                        const ourMessage = ourMessages[ourMessages.length - 1];
                        const ourMessageBody = ourMessage.body.toLowerCase();

                        if (ourMessageBody.includes('foi desmarcada') || ourMessageBody.includes('*foi desmarcada*')) {
                            contexto = 'desmarcacao';
                            console.log('[WhatsApp] ✅ CONTEXTO DETECTADO (fallback): DESMARCAÇÃO');
                        } else if (ourMessageBody.includes('confirme sua presença') || ourMessageBody.includes('confirmar sua presença')) {
                            contexto = 'confirmacao';
                            console.log('[WhatsApp] ✅ CONTEXTO DETECTADO (fallback): CONFIRMAÇÃO');
                        }
                    }
                }

                phoneNumber = realPhoneNumber;

            } catch (error) {
                console.error('[WhatsApp] ❌ Erro ao buscar contexto:', error.message);
            }

            console.log('[WhatsApp] 📞 Número final:', phoneNumber);
            console.log('[WhatsApp] 🔍 Contexto encontrado:', contexto);
            console.log('[WhatsApp] 🆔 Confirmação ID:', confirmacaoId);
            console.log('[WhatsApp] 🔍 Total de contextos ativos:', contextosAtivos.length);

            // Detecta resposta numérica
            let respostaDetectada = null;
            let tipoDesmarcacao = null; // Para desmarcações: reagendamento, sem_reagendamento, paciente_solicitou

            console.log('[WhatsApp] 🔍 Iniciando detecção de resposta. Body:', body, '| Contexto:', contexto);

            // Verifica PRIMEIRO se é contexto de desmarcação
            if (contexto === 'desmarcacao') {
                console.log('[WhatsApp] ✅ Processando como DESMARCAÇÃO');
                // DESMARCAÇÃO: 1=reagendamento, 2=paciente_solicitou, 3=sem_reagendamento
                if (body === '1') {
                    tipoDesmarcacao = 'reagendamento';
                    console.log('[WhatsApp] ✅ Detectado: reagendamento');
                } else if (body === '2') {
                    tipoDesmarcacao = 'paciente_solicitou';
                    console.log('[WhatsApp] ✅ Detectado: paciente_solicitou');
                } else if (body === '3') {
                    tipoDesmarcacao = 'sem_reagendamento';
                    console.log('[WhatsApp] ✅ Detectado: sem_reagendamento');
                }
            } else {
                console.log('[WhatsApp] ✅ Processando como CONFIRMAÇÃO DE PRESENÇA');
                // CONFIRMAÇÃO DE PRESENÇA: 1=confirmed, 2=declined, 3=not_scheduled
                // SOLUÇÃO 3: Detecção inteligente com variações
                // Ordem: frases específicas primeiro, depois palavras genéricas
                if (body === '1' ||
                    body.includes('vou sim') ||
                    body.includes('irei sim') ||
                    body.includes('confirmo') ||
                    body.includes('estarei presente') ||
                    body.includes('estarei lá') ||
                    body.includes('estarei la') ||
                    body.includes('compareço') ||
                    body.includes('compareco') ||
                    body.includes('vou ir') ||
                    body.includes('irei') ||
                    body.includes('sim') ||
                    body.includes('vou') ||
                    body.includes('estarei') ||
                    body.includes('presente') ||
                    body.includes('✅')) {
                    respostaDetectada = 'confirmed';
                    console.log('[WhatsApp] ✅ Detectado: confirmed');

                } else if (body === '2' ||
                           body.includes('nao vou') ||
                           body.includes('não vou') ||
                           body.includes('nao posso') ||
                           body.includes('não posso') ||
                           body.includes('nao poderei') ||
                           body.includes('não poderei') ||
                           body.includes('cancelar') ||
                           body.includes('desmarcar') ||
                           body.includes('❌') ||
                           (body.includes('não') && !body.includes('não agendei') && !body.includes('não marquei')) ||
                           (body.includes('nao') && !body.includes('nao agendei') && !body.includes('nao marquei'))) {
                    respostaDetectada = 'declined';
                    console.log('[WhatsApp] ✅ Detectado: declined');

                } else if (body === '3' ||
                           body.includes('não agendei') ||
                           body.includes('nao agendei') ||
                           body.includes('não marquei') ||
                           body.includes('nao marquei') ||
                           body.includes('engano') ||
                           body.includes('erro')) {
                    respostaDetectada = 'not_scheduled';
                    console.log('[WhatsApp] ✅ Detectado: not_scheduled');

                } else {
                    console.log('[WhatsApp] ⚠️ Resposta não reconhecida como opção válida');
                }
            }

            console.log('[WhatsApp] 🔍 Resultado da detecção - respostaDetectada:', respostaDetectada, '| tipoDesmarcacao:', tipoDesmarcacao);

            if (respostaDetectada || tipoDesmarcacao) {
                console.log('[WhatsApp] Resposta detectada:', tipoDesmarcacao || respostaDetectada, 'de', phoneNumber);

                // IMPORTANTE: Garante que phoneNumber seja sempre string
                const telefoneString = String(phoneNumber);

                // Busca telefone original do contexto (se disponível)
                const telefoneOriginal = contextoObj?.telefone || telefoneString;
                console.log('[WhatsApp] 📝 Telefone original do contexto:', telefoneOriginal);

                console.log('[WhatsApp] 💾 Salvando resposta no SQLite:', {
                    confirmacaoId: confirmacaoId,
                    telefone: telefoneOriginal,
                    telefoneChat: telefoneString,
                    status: respostaDetectada,
                    tipoDesmarcacao: tipoDesmarcacao,
                    contexto: contexto
                });

                // ✅ SALVA RESPOSTA NO SQLITE (Sistema Multi-Usuário)
                try {
                    const resultadoSave = WhatsAppRespostasService.saveResposta({
                        confirmacaoId: confirmacaoId,
                        telefone: telefoneOriginal,
                        telefoneChat: telefoneString,
                        status: respostaDetectada,
                        tipoDesmarcacao: tipoDesmarcacao,
                        contexto: contexto,
                        messageBody: msg.body,
                        timestamp: new Date().toISOString()
                    });

                    if (resultadoSave.success) {
                        console.log('[WhatsApp] ✅ Resposta salva no SQLite:', resultadoSave.id || 'duplicada');
                    }
                } catch (error) {
                    console.error('[WhatsApp] ❌ Erro ao salvar resposta no SQLite:', error);
                }

                // Salva resposta no banco de dados PostgreSQL
                try {
                    await fetch(`${process.env.DATABASE_BACKEND || 'http://localhost:3000'}/api/database/monitoramento/resposta`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            telefone: telefoneString,
                            status: respostaDetectada,
                            tipoDesmarcacao: tipoDesmarcacao,
                            contexto: contexto,
                            timestamp: new Date().toISOString()
                        })
                    });
                    console.log('[WhatsApp] ✅ Resposta salva no PostgreSQL');
                } catch (error) {
                    console.error('[WhatsApp] ⚠️ Erro ao salvar resposta no PostgreSQL:', error.message);
                }

                // 🔴 RESPOSTA 2 ou 3 → MUDA STATUS DIRETO
                if (contexto === 'confirmacao' && (respostaDetectada === 'declined' || respostaDetectada === 'not_scheduled') && confirmacaoId) {
                    console.log(`[Confirmação] 🔴 DECLINED - confirmacaoId: ${confirmacaoId}`);
                    ConsultasService.updateConsultaStatusByConfirmacaoId(confirmacaoId, respostaDetectada);
                    console.log(`[Confirmação] ✅ Status atualizado para: ${respostaDetectada}`);
                }

                // ✅ CONFIRMAÇÃO: Atualiza status quando paciente confirma presença
                if (contexto === 'confirmacao' && respostaDetectada === 'confirmed' && contextoObj) {
                    console.log(`[Confirmação] 🔄 Atualizando status da consulta para 'confirmed': ${contextoObj.consultaNumero}`);
                    ConsultasService.updateConsultaStatus(contextoObj.consultaNumero, 'confirmed');
                    console.log(`[Confirmação] ✅ Status da consulta atualizado para 'confirmed'`);
                }

                // Atualiza status da desmarcação quando paciente pede reagendamento
                if (contexto === 'desmarcacao' && tipoDesmarcacao === 'reagendamento' && confirmacaoId) {
                    console.log(`[Desmarcação] 🔄 Atualizando status para 'reagendamento': ${confirmacaoId}`);
                    const updateResult = ConsultasService.updateDesmarcacaoStatus(confirmacaoId, 'reagendamento', 'reagendamento');
                    console.log(`[Desmarcação] ✅ Status atualizado: ${updateResult.changes} registro(s)`);
                }

                // Simula digitação humana: mostra "digitando..." e espera alguns segundos
                const chat = await msg.getChat();
                await chat.sendStateTyping();

                // Delay aleatório entre 3-6 segundos para parecer humano
                const delaySeconds = 3 + Math.random() * 3;
                await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));

                // ========================================
                // RESPOSTAS PARA DESMARCAÇÃO
                // ========================================
                if (tipoDesmarcacao) {
                    const mapDesmarcacaoParaCodigo = {
                        'reagendamento': 'desmarcacao_solicita_reagendamento',
                        'sem_reagendamento': 'desmarcacao_sem_reagendamento',
                        'paciente_solicitou': 'desmarcacao_paciente_solicitou'
                    };

                    const codigoMensagem = mapDesmarcacaoParaCodigo[tipoDesmarcacao];
                    if (codigoMensagem) {
                        await enviarMensagemCentralizada(
                            msg,
                            codigoMensagem,
                            {},
                            {
                                telefone: phoneNumber,
                                confirmacaoId: confirmacaoId,
                                contexto: 'desmarcacao'
                            }
                        );
                    }
                }
                // ========================================
                // RESPOSTAS PARA CONFIRMAÇÃO DE PRESENÇA
                // ========================================
                else if (respostaDetectada) {
                    const mapRespostaParaCodigo = {
                        'confirmed': 'confirmacao_presenca_aprovada',
                        'declined': 'confirmacao_presenca_declinada',
                        'not_scheduled': 'confirmacao_nao_agendada'
                    };

                    const codigoMensagem = mapRespostaParaCodigo[respostaDetectada];
                    if (codigoMensagem) {
                        await enviarMensagemCentralizada(
                            msg,
                            codigoMensagem,
                            {},
                            {
                                telefone: phoneNumber,
                                confirmacaoId: confirmacaoId,
                                contexto: 'confirmacao'
                            }
                        );
                    }
                }

                // NÃO limpa o contexto imediatamente - permite que paciente mude de resposta
                // Contextos expiram automaticamente após 24h (configurado na criação do contexto)
                //
                // POLÍTICA:
                // ✅ Paciente pode responder "2" e depois mudar para "3"
                // ✅ Operador pode reenviar mensagem manualmente se necessário
                // ❌ Sistema NÃO reenvia automaticamente (protegido pelo SQLite de consultas processadas)
                // ✅ Contextos expiram automaticamente após 24h (limpeza periódica)
                if (confirmacaoId) {
                    const contexto = ChatContextosService.getContexto(confirmacaoId);
                    if (contexto) {
                        console.log('[WhatsApp] ℹ️ Contexto mantido ativo no SQLite (permite mudança de resposta)');
                        console.log('[WhatsApp] 📅 Expira em:', contexto.expiresAt);
                    }
                }
            } else {
                // ================================================================
                // SOLUÇÕES 1 e 2: TRATAMENTO DE RESPOSTA INVÁLIDA
                // ================================================================

                console.log('[WhatsApp] ⚠️ Resposta não reconhecida, processando erro');

                // REMOVIDO: Verificação de número inválido (mensagem deletada)
                // Se o paciente enviar número inválido, vai cair nas tentativas de erro

                // SOLUÇÃO 2: Sistema de tentativas com limite
                // Inicializa estrutura de tentativas
                if (!global.invalidAttempts) {
                    global.invalidAttempts = {};
                }

                const chatKey = chatId;

                // Contador de tentativas
                if (!global.invalidAttempts[chatKey]) {
                    global.invalidAttempts[chatKey] = {
                        count: 0,
                        firstAttempt: new Date(),
                        confirmacaoId: confirmacaoId,
                        contexto: contexto
                    };
                }

                global.invalidAttempts[chatKey].count++;
                const attempts = global.invalidAttempts[chatKey].count;

                console.log(`[WhatsApp] ⚠️ Tentativa inválida #${attempts} de ${chatKey} | Contexto: ${contexto || 'NENHUM'}`);

                const chat = await msg.getChat();
                await chat.sendStateTyping();
                await new Promise(resolve => setTimeout(resolve, 2000));

                // ========================================
                // MENSAGENS PROGRESSIVAS BASEADAS EM TENTATIVAS
                // ========================================
                if (contexto === 'desmarcacao' || contexto === 'confirmacao') {
                    // Determina código da mensagem baseado em contexto e tentativas
                    let codigoMensagem;

                    if (attempts === 1) {
                        codigoMensagem = `erro_tentativa1_${contexto}`;
                    } else if (attempts === 2) {
                        codigoMensagem = `erro_tentativa2_${contexto}`;
                    } else {
                        codigoMensagem = `erro_tentativa3_${contexto}`;
                    }

                    await enviarMensagemCentralizada(
                        msg,
                        codigoMensagem,
                        {},
                        {
                            telefone: phoneNumber,
                            confirmacaoId: confirmacaoId,
                            contexto: contexto
                        }
                    );

                    // Se foi 3ª tentativa ou mais, limpa e alerta
                    if (attempts >= 3) {
                        delete global.invalidAttempts[chatKey];
                        console.error(`[WhatsApp] 🚨 ALERTA: Paciente ${chatKey} teve 3+ tentativas inválidas (${contexto}). Requer atendimento humano.`);
                    }

                } else {
                    // ========================================
                    // SEM CONTEXTO - NÃO ENVIA MENSAGEM
                    // ========================================
                    // REMOVIDO: Mensagem 'sem_contexto_boasvindas' causava spam
                    // Se paciente manda mensagem sem contexto ativo, simplesmente ignora
                    console.log('[WhatsApp] ℹ️ Mensagem sem contexto ativo - ignorando (não enviando boas-vindas)');

                    delete global.invalidAttempts[chatKey];
                }
            }
        } catch (error) {
            console.error('[WhatsApp] Erro ao processar mensagem:', error);
        }
    });

    // Evento: Desconectado
    whatsappClient.on('disconnected', (reason) => {
        console.log('[WhatsApp] Desconectado:', reason);
        isReady = false;
        whatsappClient = null;
        setTimeout(initializeWhatsApp, 5000);
    });

    // Evento: Erro de autenticação
    whatsappClient.on('auth_failure', (error) => {
        console.error('[WhatsApp] Falha na autenticação:', error);
        qrCodeData = null;
    });

    // Inicializa
    whatsappClient.initialize();
}

// ============================================================================
// API REST - ENDPOINTS
// ============================================================================

// Status do WhatsApp
app.get('/api/status', async (req, res) => {
    const statusData = {
        isReady: isReady,
        hasQr: qrCodeData !== null,
        apiMode: WHATSAPP_API_MODE,
        timestamp: new Date().toISOString()
    };

    // Se estiver usando API oficial, verifica status da conta
    if (WHATSAPP_API_MODE === 'official') {
        try {
            const accountStatus = await WhatsAppOfficialAPI.getAccountStatus();
            statusData.isReady = true; // API oficial sempre "pronta" se token válido
            statusData.officialApi = {
                phoneNumberId: accountStatus.id,
                displayNumber: accountStatus.display_phone_number,
                qualityRating: accountStatus.quality_rating,
                verified: accountStatus.verified_name || null
            };
        } catch (error) {
            statusData.isReady = false;
            statusData.officialApi = {
                error: error.message
            };
        }
    }

    res.json(statusData);
});

// ENDPOINT REMOVIDO - usar /api/whatsapp/responses em vez de /api/responses

// QR Code para autenticação
app.get('/api/qr', (req, res) => {
    if (qrCodeData) {
        res.json({ qr: qrCodeData });
    } else if (isReady) {
        res.json({ qr: null, message: 'Já autenticado' });
    } else {
        res.json({ qr: null, message: 'Aguardando QR Code...' });
    }
});

// Listar conversas - COM PAGINAÇÃO E OTIMIZAÇÃO
app.get('/api/chats', async (req, res) => {
    try {
        if (!isReady) {
            return res.status(503).json({ success: false, error: 'WhatsApp não está conectado' });
        }

        // Parâmetros de paginação
        const limit = validateNumericParam(req.query.limit, 50, 1, 100); // Máximo 100 chats
        const offset = validateNumericParam(req.query.offset, 0, 0, 10000);
        const includeContacts = req.query.includeContacts !== 'false'; // Padrão: true

        console.log(`[API] Buscando chats (limit: ${limit}, offset: ${offset})`);

        const allChats = await whatsappClient.getChats();

        // Ordena por timestamp da última mensagem (mais recentes primeiro)
        const sortedChats = allChats.sort((a, b) => {
            const timestampA = a.lastMessage?.timestamp || 0;
            const timestampB = b.lastMessage?.timestamp || 0;
            return timestampB - timestampA;
        });

        // Aplica paginação
        const paginatedChats = sortedChats.slice(offset, offset + limit);

        // Serializa apenas os chats da página atual (muito mais rápido)
        const chatList = paginatedChats.map(chat => {
            const chatData = JSON.parse(JSON.stringify(chat));
            // Não busca contactDetails aqui - muito lento para muitas conversas
            // O frontend pode buscar individualmente se necessário
            return chatData;
        });

        res.json({
            success: true,
            chats: chatList,
            total: allChats.length,
            limit,
            offset,
            hasMore: offset + limit < allChats.length
        });
    } catch (error) {
        console.error('[API] Erro ao buscar chats:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Buscar informações do contato - TODOS OS DADOS
app.get('/api/contact/:contactId', async (req, res) => {
    try {
        if (!isReady) {
            return res.status(503).json({ success: false, error: 'WhatsApp não está conectado' });
        }

        const { contactId } = req.params;
        const contact = await whatsappClient.getContactById(contactId);

        // Serializa TODOS os dados do contato
        const contactInfo = JSON.parse(JSON.stringify(contact));

        // Busca foto do perfil
        try {
            contactInfo.profilePicUrl = await contact.getProfilePicUrl();
        } catch (err) {
            contactInfo.profilePicUrl = null;
        }

        // Busca about (status/bio)
        try {
            contactInfo.about = await contact.getAbout();
        } catch (err) {
            contactInfo.about = null;
        }

        res.json({ success: true, contact: contactInfo });
    } catch (error) {
        console.error('[API] Erro ao buscar informações do contato:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Buscar mensagens de um chat - TODOS OS DADOS
app.get('/api/messages/:chatId', async (req, res) => {
    try {
        if (!isReady) {
            return res.status(503).json({ success: false, error: 'WhatsApp não está conectado' });
        }

        const { chatId } = req.params;
        const limit = validateNumericParam(req.query.limit, 50, 1, 100);

        const chat = await whatsappClient.getChatById(chatId);
        const messages = await getCachedMessages(chat, limit);

        // Retorna TODOS os campos das mensagens
        const messageList = messages.map(msg => JSON.parse(JSON.stringify(msg)));

        res.json({ success: true, messages: messageList, total: messageList.length });
    } catch (error) {
        console.error('[API] Erro ao buscar mensagens:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Enviar mensagem
app.post('/api/send', async (req, res) => {
    try {
        // Verifica conexão baseado no modo da API
        if (WHATSAPP_API_MODE === 'unofficial' && !isReady) {
            return res.status(503).json({ success: false, error: 'WhatsApp não está conectado' });
        }

        const { to, message, buttons, metadata } = req.body;

        if (!to || !message) {
            return res.status(400).json({ success: false, error: 'Campos "to" e "message" são obrigatórios' });
        }

        // Bloqueia envio para grupos
        if (to.includes('@g.us')) {
            console.log('[API] ❌ Tentativa de enviar mensagem para grupo bloqueada:', to);
            return res.status(403).json({ success: false, error: 'Não é permitido enviar mensagens para grupos' });
        }

        console.log(`[API] 📤 Enviando mensagem para: ${to} (modo: ${WHATSAPP_API_MODE})`);
        console.log('[API] 🔍 Metadata recebido:', JSON.stringify(metadata, null, 2));

        // ✅ NOVA ESTRUTURA: Salva contexto por ID único (usando SQLite thread-safe)
        if (metadata?.confirmacaoId && metadata?.contexto) {
            console.log('[API] ✅ Metadata VÁLIDO - Salvando contexto...');

            // Salva contexto no SQLite (thread-safe, sem race conditions!)
            ChatContextosService.saveContexto({
                confirmacaoId: metadata.confirmacaoId,
                chatId: to,
                contexto: metadata.contexto,
                consultaNumero: metadata.consultaNumero,
                telefone: metadata.telefone,
                messageText: message,
                expiresInHours: 24
            });

            console.log('[API] 💾 Contexto salvo no SQLite:');
            console.log('  - ID:', metadata.confirmacaoId);
            console.log('  - Contexto:', metadata.contexto);
            console.log('  - Chat:', to);
        } else {
            console.log('[API] ⚠️ Metadata NÃO SALVO - Razão:');
            if (!metadata) {
                console.log('  ❌ metadata é null/undefined');
            } else if (!metadata.confirmacaoId) {
                console.log('  ❌ metadata.confirmacaoId não existe');
            } else if (!metadata.contexto) {
                console.log('  ❌ metadata.contexto não existe');
            }
        }

        let sentMessage;
        let messageId;
        let realChatId;

        // ============================================================================
        // ENVIO VIA API OFICIAL (META CLOUD API)
        // ============================================================================
        if (WHATSAPP_API_MODE === 'official') {
            console.log('[API] 📱 Usando API OFICIAL do WhatsApp (Meta Cloud API)');

            try {
                const result = await WhatsAppOfficialAPI.sendTextMessage(to, message);

                messageId = result.messageId;
                realChatId = result.waId || to;

                console.log('[API] ✅ Mensagem enviada via API Oficial. ID:', messageId);

                sentMessage = {
                    id: { _serialized: messageId },
                    to: realChatId,
                    from: WhatsAppOfficialAPI.CONFIG.PHONE_NUMBER_ID
                };
            } catch (apiError) {
                console.error('[API] ❌ Erro na API Oficial:', apiError.message);
                return res.status(500).json({ success: false, error: apiError.message });
            }
        }
        // ============================================================================
        // ENVIO VIA API NÃO OFICIAL (whatsapp-web.js)
        // ============================================================================
        else {
            console.log('[API] 🌐 Usando API NÃO OFICIAL (whatsapp-web.js)');

            // NOTA: O WhatsApp descontinuou os botões (deprecated), mas vamos tentar usá-los.
            // Se a biblioteca falhar, a mensagem ainda será enviada como texto.
            if (buttons && buttons.length > 0) {
                console.log('[API] ⚠️ Botões detectados, mas recurso está obsoleto no WhatsApp.');
                console.log('[API] Enviando mensagem como texto (opções já incluídas no template).');
                sentMessage = await whatsappClient.sendMessage(to, message);
            } else {
                // Mensagem simples sem botões
                sentMessage = await whatsappClient.sendMessage(to, message);
            }

            messageId = sentMessage.id._serialized;
            realChatId = sentMessage.to || to;

            console.log('[API] ✅ Mensagem enviada. ID:', messageId);
            console.log('[API] 🔍 DEBUG sentMessage:', {
                from: sentMessage.from,
                to: sentMessage.to,
                id: sentMessage.id,
                hasFrom: !!sentMessage.from,
                hasTo: !!sentMessage.to
            });
        }

        // 🔧 CORREÇÃO: Atualiza contexto com o chat ID REAL retornado pelo WhatsApp
        if (metadata && metadata.confirmacaoId && realChatId) {
            console.log('[API] 🔄 Atualizando contexto com chat ID real:');
            console.log('  - Número enviado (to):', to);
            console.log('  - Chat ID real:', realChatId);

            // Atualiza o contexto no SQLite (thread-safe)
            try {
                ChatContextosService.updateChatId(metadata.confirmacaoId, realChatId);
                console.log('[API] ✅ Contexto atualizado com chat ID real no SQLite');
            } catch (error) {
                console.error('[API] ❌ Erro ao atualizar chatId no SQLite:', error.message);
            }
        }

        res.json({
            success: true,
            messageId: messageId,
            chatId: to,
            realChatId: realChatId,
            confirmacaoId: metadata?.confirmacaoId,
            apiMode: WHATSAPP_API_MODE,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[API] ❌ Erro ao enviar mensagem:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Marcar chat como lido
app.post('/api/read/:chatId', async (req, res) => {
    try {
        if (!isReady) {
            return res.status(503).json({ success: false, error: 'WhatsApp não está conectado' });
        }

        const { chatId } = req.params;
        const chat = await whatsappClient.getChatById(chatId);
        await chat.sendSeen();

        res.json({ success: true });
    } catch (error) {
        console.error('[API] Erro ao marcar como lido:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Recuperar respostas do WhatsApp (para atualização automática dos cards)
// ✅ MIGRADO PARA SQLITE - Sistema Multi-Usuário
app.get('/api/whatsapp/responses', (req, res) => {
    try {
        // Busca respostas pendentes no SQLite
        const respostasSQLite = WhatsAppRespostasService.getRespostasPendentes();

        // Converte para formato do frontend
        const responses = respostasSQLite.map(r => WhatsAppRespostasService.convertToFrontend(r));

        console.log(`[API] 📤 Endpoint /api/whatsapp/responses chamado - ${responses.length} respostas pendentes no SQLite`);

        if (responses.length > 0) {
            console.log('[API] 📋 Respostas encontradas:', JSON.stringify(responses, null, 2));

            // Marca todas como processadas após retornar
            // Isso permite que o frontend processe, mas evita duplicação
            const ids = respostasSQLite.map(r => r.id);
            setTimeout(() => {
                const marcadas = WhatsAppRespostasService.marcarVariasComoProcessadas(ids);
                console.log(`[API] ✅ Marcadas ${marcadas} respostas como processadas`);
            }, 2000); // 2 segundos - tempo suficiente para frontend processar
        }

        res.json({
            success: true,
            responses: responses,
            count: responses.length
        });
    } catch (error) {
        console.error('[API] Erro ao recuperar respostas do SQLite:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Logout do WhatsApp
app.post('/api/logout', async (req, res) => {
    try {
        console.log('[WhatsApp] Fazendo logout...');
        if (whatsappClient) {
            await whatsappClient.logout();
            whatsappClient = null;
            isReady = false;
            qrCodeData = null;
        }
        console.log('[WhatsApp] Logout concluído');
        res.json({ success: true, message: 'Desconectado com sucesso' });
    } catch (error) {
        console.error('[API] Erro ao fazer logout:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Gerar novo QR Code (reinicia a conexão)
app.post('/api/whatsapp/restart', async (req, res) => {
    try {
        console.log('[WhatsApp] Reiniciando conexão...');

        // Para o heartbeat
        stopHeartbeat();

        // Destrói cliente atual
        if (whatsappClient) {
            try {
                await whatsappClient.destroy();
            } catch (error) {
                console.warn('[API] Erro ao destruir cliente:', error.message);
            }
            whatsappClient = null;
        }

        // Reseta variáveis
        isReady = false;
        qrCodeData = null;

        // Aguarda um momento antes de reiniciar
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Inicializa novamente
        console.log('[WhatsApp] Inicializando novamente...');

        whatsappClient = new Client({
            authStrategy: new LocalAuth({
                dataPath: path.join(__dirname, '.wwebjs_auth')
            }),
            puppeteer: {
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            }
        });

        // Reconfigura eventos
        whatsappClient.on('qr', async (qr) => {
            console.log('[WhatsApp] QR Code recebido');
            try {
                qrCodeData = await qrcode.toDataURL(qr);
            } catch (err) {
                console.error('[WhatsApp] Erro ao gerar QR Code:', err);
            }
        });

        whatsappClient.on('authenticated', () => {
            console.log('[WhatsApp] Autenticado!');
        });

        whatsappClient.on('ready', () => {
            console.log('[WhatsApp] Pronto!');
            isReady = true;
            qrCodeData = null;
            startHeartbeat();
        });

        whatsappClient.on('disconnected', (reason) => {
            console.log('[WhatsApp] Desconectado:', reason);
            isReady = false;
            qrCodeData = null;
            stopHeartbeat();
        });

        whatsappClient.initialize();

        res.json({ success: true, message: 'WhatsApp reiniciado, aguarde o QR Code' });
    } catch (error) {
        console.error('[API] Erro ao reiniciar WhatsApp:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Reiniciar WhatsApp (gerar novo QR Code)
app.post('/api/whatsapp/reset', async (req, res) => {
    try {
        console.log('[API] Solicitação de reset do WhatsApp');

        // Destrói cliente atual
        if (whatsappClient) {
            try {
                await whatsappClient.destroy();
            } catch (error) {
                console.warn('[API] Erro ao destruir cliente:', error.message);
            }
            whatsappClient = null;
        }

        // Reseta estados
        isReady = false;
        qrCodeData = null;

        // Remove pasta de autenticação
        const authPath = path.join(__dirname, 'server', '.wwebjs_auth');
        if (fs.existsSync(authPath)) {
            fs.rmSync(authPath, { recursive: true, force: true });
            console.log('[API] Pasta de autenticação removida');
        }

        // Aguarda 2 segundos
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Reinicia WhatsApp
        initializeWhatsApp();

        res.json({ success: true, message: 'WhatsApp reiniciado com sucesso' });
    } catch (error) {
        console.error('[API] Erro ao reiniciar WhatsApp:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// ENDPOINTS - CONTROLE DE BOT AUTOMÁTICO - REMOVIDO
// ============================================================================
// Bot pause/resume removido - não é mais necessário pois não há mensagens fora de contexto

// Download de mídia (imagens, áudios, vídeos, documentos)
app.get('/api/media/:chatId/:messageId', async (req, res) => {
    try {
        if (!isReady) {
            return res.status(503).json({ success: false, error: 'WhatsApp não está conectado' });
        }

        const { chatId, messageId } = req.params;

        try {
            // Busca a mensagem diretamente pelo ID
            const chat = await whatsappClient.getChatById(chatId);

            // Tenta buscar mais mensagens para encontrar mensagens antigas
            const messages = await chat.fetchMessages({ limit: 500 });
            const message = messages.find(msg => msg.id._serialized === messageId || msg.id.id === messageId);

            if (!message) {
                // Mídia não encontrada - comum para mensagens muito antigas
                // Retorna 404 silenciosamente (sem log de erro)
                return res.status(404).json({ success: false, error: 'Mensagem não encontrada' });
            }

            if (!message.hasMedia) {
                return res.status(400).json({ success: false, error: 'Mensagem não contém mídia' });
            }

            // Faz download da mídia
            const media = await message.downloadMedia();

            // IMPORTANTE: downloadMedia() retorna undefined quando:
            // - Mídia foi deletada do telefone
            // - Mídia expirou nos servidores do WhatsApp (comum em stickers antigos)
            // - Mídia não está mais disponível para download
            // Fonte: https://wwebjs.dev/guide/creating-your-bot/handling-attachments
            if (!media) {
                // Retorna 404 silenciosamente - comportamento esperado para mídias antigas
                return res.status(404).json({
                    success: false,
                    error: 'Mídia expirada ou não disponível'
                });
            }

            // Converte base64 para buffer
            const buffer = Buffer.from(media.data, 'base64');

            // Define tipo de conteúdo
            res.set('Content-Type', media.mimetype);
            res.set('Content-Length', buffer.length);

            // Envia arquivo
            res.send(buffer);
        } catch (mediaError) {
            // Erro ao processar - retorna 404 silenciosamente para evitar spam de logs
            // Stickers e mídias antigas frequentemente não estão mais disponíveis
            return res.status(404).json({
                success: false,
                error: 'Mídia não disponível'
            });
        }
    } catch (error) {
        console.error('[API] Erro ao baixar mídia:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// NOVOS ENDPOINTS - DADOS COMPLETOS DA API
// ============================================================================

// Obter todos os contatos - TODOS OS DADOS
app.get('/api/contacts', async (req, res) => {
    try {
        if (!isReady) {
            return res.status(503).json({ success: false, error: 'WhatsApp não está conectado' });
        }

        const contacts = await whatsappClient.getContacts();

        // Retorna TODOS os campos disponíveis
        const contactList = contacts.slice(0, 50).map(contact => {
            return JSON.parse(JSON.stringify(contact));
        });

        res.json({ success: true, contacts: contactList, total: contacts.length });
    } catch (error) {
        console.error('[API] Erro ao buscar contatos:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Obter contatos bloqueados
app.get('/api/blocked', async (req, res) => {
    try {
        if (!isReady) {
            return res.status(503).json({ success: false, error: 'WhatsApp não está conectado' });
        }

        const blocked = await whatsappClient.getBlockedContacts();
        const blockedList = blocked.map(contact => ({
            id: contact.id._serialized,
            number: contact.number,
            name: contact.name || contact.pushname || contact.number
        }));

        res.json({ success: true, blocked: blockedList, total: blocked.length });
    } catch (error) {
        console.error('[API] Erro ao buscar bloqueados:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Obter labels (etiquetas)
app.get('/api/labels', async (req, res) => {
    try {
        if (!isReady) {
            return res.status(503).json({ success: false, error: 'WhatsApp não está conectado' });
        }

        const labels = await whatsappClient.getLabels();
        const labelList = labels.map(label => ({
            id: label.id,
            name: label.name,
            color: label.color
        }));

        res.json({ success: true, labels: labelList, total: labels.length });
    } catch (error) {
        console.error('[API] Erro ao buscar labels:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Obter informações do cliente (perfil próprio)
app.get('/api/info', async (req, res) => {
    try {
        if (!isReady) {
            return res.status(503).json({ success: false, error: 'WhatsApp não está conectado' });
        }

        const info = whatsappClient.info;
        const profilePic = await whatsappClient.getProfilePicUrl(info.wid._serialized).catch(() => null);

        res.json({
            success: true,
            info: {
                wid: info.wid._serialized,
                pushname: info.pushname,
                phone: info.wid.user,
                platform: info.platform,
                profilePicUrl: profilePic
            }
        });
    } catch (error) {
        console.error('[API] Erro ao buscar info:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Obter estado da conexão
app.get('/api/state', async (req, res) => {
    try {
        if (!whatsappClient) {
            return res.json({ success: true, state: 'DISCONNECTED' });
        }

        const state = await whatsappClient.getState();
        res.json({ success: true, state: state });
    } catch (error) {
        console.error('[API] Erro ao buscar estado:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Buscar mensagens (pesquisa global)
app.get('/api/search', async (req, res) => {
    try {
        if (!isReady) {
            return res.status(503).json({ success: false, error: 'WhatsApp não está conectado' });
        }

        const query = req.query.q || '';
        if (!query) {
            return res.status(400).json({ success: false, error: 'Parâmetro "q" é obrigatório' });
        }

        const results = await whatsappClient.searchMessages(query, { limit: 20 });
        const messageList = results.map(msg => ({
            id: msg.id._serialized,
            body: msg.body,
            from: msg.from,
            timestamp: msg.timestamp,
            fromMe: msg.fromMe
        }));

        res.json({ success: true, messages: messageList, total: results.length });
    } catch (error) {
        console.error('[API] Erro ao buscar mensagens:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Obter TODOS os detalhes de um chat específico
app.get('/api/chat/:chatId/full', async (req, res) => {
    try {
        if (!isReady) {
            return res.status(503).json({ success: false, error: 'WhatsApp não está conectado' });
        }

        const { chatId } = req.params;
        const chat = await whatsappClient.getChatById(chatId);

        // Serializa todos os dados do chat
        const chatData = JSON.parse(JSON.stringify(chat));

        // Adiciona dados extras se for grupo
        if (chat.isGroup) {
            try {
                // Participantes do grupo
                chatData.participants = chat.participants;

                // Convite do grupo
                try {
                    chatData.inviteCode = await chat.getInviteCode();
                } catch (err) {
                    chatData.inviteCode = null;
                }
            } catch (err) {
                console.error('[API] Erro ao buscar dados do grupo:', err.message);
            }
        }

        // Últimas mensagens (10)
        try {
            const messages = await getCachedMessages(chat, 10);
            chatData.recentMessages = messages.map(msg => JSON.parse(JSON.stringify(msg)));
        } catch (err) {
            chatData.recentMessages = [];
        }

        res.json({ success: true, chat: chatData });
    } catch (error) {
        console.error('[API] Erro ao buscar detalhes do chat:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Estatísticas gerais
app.get('/api/stats', async (req, res) => {
    try {
        if (!isReady) {
            return res.status(503).json({ success: false, error: 'WhatsApp não está conectado' });
        }

        const chats = await whatsappClient.getChats();
        const contacts = await whatsappClient.getContacts();

        const groups = chats.filter(c => c.isGroup);
        const privateChats = chats.filter(c => !c.isGroup);
        const unreadChats = chats.filter(c => c.unreadCount > 0);
        const totalUnread = chats.reduce((sum, c) => sum + c.unreadCount, 0);
        const archivedChats = chats.filter(c => c.archived);
        const pinnedChats = chats.filter(c => c.pinned);

        res.json({
            success: true,
            stats: {
                totalChats: chats.length,
                groups: groups.length,
                privateChats: privateChats.length,
                unreadChats: unreadChats.length,
                totalUnreadMessages: totalUnread,
                archivedChats: archivedChats.length,
                pinnedChats: pinnedChats.length,
                totalContacts: contacts.length,
                myContacts: contacts.filter(c => c.isMyContact).length
            }
        });
    } catch (error) {
        console.error('[API] Erro ao buscar estatísticas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Página de diagnóstico do WhatsApp - movida para /api/dashboard
app.get('/api/dashboard', (req, res) => {
    const uptimeSeconds = Math.floor(process.uptime());
    const uptimeMinutes = Math.floor(uptimeSeconds / 60);
    const uptimeHours = Math.floor(uptimeMinutes / 60);
    const memoryUsage = process.memoryUsage();
    const memoryMB = Math.round(memoryUsage.heapUsed / 1024 / 1024);

    res.send(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>HMASP Chat - Servidor WhatsApp</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                    padding: 20px;
                }
                .container {
                    max-width: 1200px;
                    margin: 0 auto;
                }
                .header {
                    background: white;
                    padding: 30px;
                    border-radius: 15px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                    margin-bottom: 20px;
                    text-align: center;
                }
                .header h1 {
                    color: #333;
                    font-size: 32px;
                    margin-bottom: 10px;
                }
                .header .subtitle {
                    color: #666;
                    font-size: 16px;
                }
                .status-card {
                    background: white;
                    padding: 25px;
                    border-radius: 15px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                    margin-bottom: 20px;
                }
                .status-indicator {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 15px;
                    font-size: 28px;
                    font-weight: bold;
                    padding: 20px;
                    border-radius: 10px;
                    margin-bottom: 20px;
                    ${isReady
                        ? 'background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white;'
                        : 'background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white;'}
                }
                .qr-section {
                    background: #f9fafb;
                    padding: 30px;
                    border-radius: 10px;
                    text-align: center;
                    margin-top: 20px;
                }
                .qr-code {
                    background: white;
                    padding: 20px;
                    border-radius: 10px;
                    display: inline-block;
                    margin-top: 15px;
                }
                .qr-code img {
                    max-width: 300px;
                    display: block;
                }
                .info-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                    margin-top: 20px;
                }
                .info-item {
                    background: #f9fafb;
                    padding: 15px;
                    border-radius: 10px;
                    border-left: 4px solid #667eea;
                }
                .info-item strong {
                    display: block;
                    color: #666;
                    font-size: 12px;
                    text-transform: uppercase;
                    margin-bottom: 5px;
                }
                .info-item span {
                    color: #333;
                    font-size: 18px;
                    font-weight: 600;
                }
                .links {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 12px;
                    margin-top: 20px;
                }
                .link-card {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 20px;
                    border-radius: 10px;
                    text-decoration: none;
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    transition: transform 0.2s;
                }
                .link-card:hover {
                    transform: translateY(-5px);
                }
                .link-card .icon {
                    font-size: 32px;
                }
                .link-card .text h3 {
                    font-size: 15px;
                    margin-bottom: 5px;
                }
                .link-card .text p {
                    font-size: 12px;
                    opacity: 0.9;
                }
                .instructions {
                    background: #fef3c7;
                    border-left: 4px solid #f59e0b;
                    padding: 20px;
                    border-radius: 10px;
                    margin-top: 20px;
                }
                .instructions h3 {
                    color: #92400e;
                    margin-bottom: 10px;
                }
                .instructions ol {
                    color: #78350f;
                    margin-left: 20px;
                    line-height: 1.8;
                }
                .footer {
                    text-align: center;
                    color: white;
                    margin-top: 30px;
                    opacity: 0.8;
                }
                .api-panel {
                    background: #f9fafb;
                    border-radius: 10px;
                    margin-top: 15px;
                    overflow: hidden;
                    max-height: 0;
                    transition: max-height 0.3s ease-out;
                }
                .api-panel.active {
                    max-height: 600px;
                    border: 2px solid #667eea;
                }
                .api-content {
                    padding: 20px;
                }
                .json-viewer {
                    background: #1e293b;
                    color: #e2e8f0;
                    padding: 15px;
                    border-radius: 8px;
                    font-family: 'Courier New', monospace;
                    font-size: 13px;
                    max-height: 400px;
                    overflow: auto;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                }
                .toggle-btn {
                    background: none;
                    border: none;
                    color: inherit;
                    width: 100%;
                    cursor: pointer;
                }
                .data-grid {
                    display: grid;
                    gap: 10px;
                    margin-top: 15px;
                }
                .data-row {
                    background: white;
                    padding: 12px;
                    border-radius: 8px;
                    border-left: 3px solid #667eea;
                    display: grid;
                    grid-template-columns: 150px 1fr;
                    gap: 10px;
                }
                .data-row strong {
                    color: #666;
                    font-size: 13px;
                }
                .data-row span {
                    color: #333;
                    font-size: 14px;
                }
                .loading {
                    text-align: center;
                    color: #666;
                    padding: 20px;
                }
            </style>
            <script>
                // Sanitiza HTML para prevenir XSS
                function escapeHtml(unsafe) {
                    if (unsafe === null || unsafe === undefined) return '';
                    return String(unsafe)
                        .replace(/&/g, "&amp;")
                        .replace(/</g, "&lt;")
                        .replace(/>/g, "&gt;")
                        .replace(/"/g, "&quot;")
                        .replace(/'/g, "&#039;");
                }

                // Toggle panels
                function togglePanel(panelId) {
                    const panel = document.getElementById(panelId);
                    const allPanels = document.querySelectorAll('.api-panel');

                    // Fecha outros painéis
                    allPanels.forEach(p => {
                        if (p.id !== panelId) p.classList.remove('active');
                    });

                    // Toggle este painel
                    panel.classList.toggle('active');

                    // Carrega dados se estiver abrindo
                    if (panel.classList.contains('active')) {
                        loadPanelData(panelId);
                    }
                }

                // Carrega dados do painel
                async function loadPanelData(panelId) {
                    const content = document.getElementById(panelId + '-content');
                    content.innerHTML = '<div class="loading">⏳ Carregando dados...</div>';

                    try {
                        let data, html;

                        if (panelId === 'status-panel') {
                            const response = await fetch('/api/status');
                            data = await response.json();
                            html = \`
                                <div class="data-grid">
                                    <div class="data-row">
                                        <strong>Status:</strong>
                                        <span>\${data.isReady ? '✅ Conectado' : '❌ Desconectado'}</span>
                                    </div>
                                    <div class="data-row">
                                        <strong>Tem QR Code:</strong>
                                        <span>\${data.hasQr ? '✅ Sim' : '❌ Não'}</span>
                                    </div>
                                    <div class="data-row">
                                        <strong>Timestamp:</strong>
                                        <span>\${new Date(data.timestamp).toLocaleString('pt-BR')}</span>
                                    </div>
                                </div>
                                <h4 style="margin-top: 20px; margin-bottom: 10px;">📄 JSON Completo:</h4>
                                <div class="json-viewer">\${JSON.stringify(data, null, 2)}</div>
                            \`;
                        } else if (panelId === 'info-panel') {
                            const response = await fetch('/api/info');
                            data = await response.json();

                            if (data.success && data.info) {
                                const info = data.info;
                                html = \`
                                    \${info.profilePicUrl ? \`<div style="text-align: center; margin-bottom: 20px;"><img src="\${escapeHtml(info.profilePicUrl)}" style="width: 150px; height: 150px; border-radius: 50%; border: 3px solid #667eea;"></div>\` : ''}
                                    <div class="data-grid">
                                        <div class="data-row">
                                            <strong>Nome:</strong>
                                            <span>\${escapeHtml(info.pushname)}</span>
                                        </div>
                                        <div class="data-row">
                                            <strong>Telefone:</strong>
                                            <span>\${escapeHtml(info.phone)}</span>
                                        </div>
                                        <div class="data-row">
                                            <strong>ID WhatsApp:</strong>
                                            <span>\${escapeHtml(info.wid)}</span>
                                        </div>
                                        <div class="data-row">
                                            <strong>Plataforma:</strong>
                                            <span>\${info.platform}</span>
                                        </div>
                                    </div>
                                    <h4 style="margin-top: 20px; margin-bottom: 10px;">📄 JSON Completo:</h4>
                                    <div class="json-viewer">\${JSON.stringify(data.info, null, 2)}</div>
                                \`;
                            } else {
                                html = '<div class="loading">❌ WhatsApp não conectado</div>';
                            }
                        } else if (panelId === 'stats-panel') {
                            const response = await fetch('/api/stats');
                            data = await response.json();

                            if (data.success && data.stats) {
                                const s = data.stats;
                                html = \`
                                    <h3 style="margin-bottom: 15px;">📊 Estatísticas Gerais</h3>
                                    <div class="data-grid">
                                        <div class="data-row">
                                            <strong>Total de Chats:</strong>
                                            <span>\${s.totalChats}</span>
                                        </div>
                                        <div class="data-row">
                                            <strong>Grupos:</strong>
                                            <span>\${s.groups}</span>
                                        </div>
                                        <div class="data-row">
                                            <strong>Chats Privados:</strong>
                                            <span>\${s.privateChats}</span>
                                        </div>
                                        <div class="data-row">
                                            <strong>Chats Não Lidos:</strong>
                                            <span>\${s.unreadChats}</span>
                                        </div>
                                        <div class="data-row">
                                            <strong>Mensagens Não Lidas:</strong>
                                            <span>\${s.totalUnreadMessages}</span>
                                        </div>
                                        <div class="data-row">
                                            <strong>Chats Arquivados:</strong>
                                            <span>\${s.archivedChats}</span>
                                        </div>
                                        <div class="data-row">
                                            <strong>Chats Fixados:</strong>
                                            <span>\${s.pinnedChats}</span>
                                        </div>
                                        <div class="data-row">
                                            <strong>Total de Contatos:</strong>
                                            <span>\${s.totalContacts}</span>
                                        </div>
                                        <div class="data-row">
                                            <strong>Meus Contatos:</strong>
                                            <span>\${s.myContacts}</span>
                                        </div>
                                    </div>
                                    <h4 style="margin-top: 20px; margin-bottom: 10px;">📄 JSON Completo:</h4>
                                    <div class="json-viewer">\${JSON.stringify(data.stats, null, 2)}</div>
                                \`;
                            } else {
                                html = '<div class="loading">❌ WhatsApp não conectado</div>';
                            }
                        } else if (panelId === 'chats-panel') {
                            const response = await fetch('/api/chats');
                            data = await response.json();

                            if (data.success && data.chats && data.chats.length > 0) {
                                const chatsHtml = data.chats.slice(0, 20).map((chat, i) => \`
                                    <div class="data-row">
                                        <strong>\${chat.isGroup ? '👥' : '👤'} Chat \${i + 1}:</strong>
                                        <span>\${chat.name || chat.id} \${chat.unreadCount > 0 ? '(' + chat.unreadCount + ' não lidas)' : ''}</span>
                                    </div>
                                \`).join('');

                                html = \`
                                    <h3 style="margin-bottom: 15px;">💬 Conversas (20 primeiras de \${data.chats.length})</h3>
                                    <div class="data-grid">\${chatsHtml}</div>
                                    <h4 style="margin-top: 20px; margin-bottom: 10px;">📄 JSON Completo:</h4>
                                    <div class="json-viewer">\${JSON.stringify(data.chats.slice(0, 20), null, 2)}</div>
                                \`;
                            } else {
                                html = '<div class="loading">❌ Nenhum chat encontrado ou WhatsApp não conectado</div>';
                            }
                        } else if (panelId === 'contacts-panel') {
                            const response = await fetch('/api/contacts');
                            data = await response.json();

                            if (data.success && data.contacts && data.contacts.length > 0) {
                                const contactsHtml = data.contacts.map((contact, i) => \`
                                    <div class="data-row">
                                        <strong>\${contact.isMyContact ? '📇' : '👤'} Contato \${i + 1}:</strong>
                                        <span>\${contact.name} (\${contact.number || contact.id})</span>
                                    </div>
                                \`).join('');

                                html = \`
                                    <h3 style="margin-bottom: 15px;">👥 Contatos (50 primeiros de \${data.total})</h3>
                                    <div class="data-grid">\${contactsHtml}</div>
                                    <h4 style="margin-top: 20px; margin-bottom: 10px;">📄 JSON Completo:</h4>
                                    <div class="json-viewer">\${JSON.stringify(data.contacts, null, 2)}</div>
                                \`;
                            } else {
                                html = '<div class="loading">❌ Nenhum contato encontrado ou WhatsApp não conectado</div>';
                            }
                        } else if (panelId === 'labels-panel') {
                            const response = await fetch('/api/labels');
                            data = await response.json();

                            if (data.success && data.labels && data.labels.length > 0) {
                                const labelsHtml = data.labels.map((label, i) => \`
                                    <div class="data-row">
                                        <strong>🏷️ Label \${i + 1}:</strong>
                                        <span>\${label.name} <span style="display: inline-block; width: 20px; height: 20px; background: \${label.color || '#ccc'}; border-radius: 3px; vertical-align: middle;"></span></span>
                                    </div>
                                \`).join('');

                                html = \`
                                    <h3 style="margin-bottom: 15px;">🏷️ Etiquetas (\${data.total})</h3>
                                    <div class="data-grid">\${labelsHtml}</div>
                                    <h4 style="margin-top: 20px; margin-bottom: 10px;">📄 JSON Completo:</h4>
                                    <div class="json-viewer">\${JSON.stringify(data.labels, null, 2)}</div>
                                \`;
                            } else {
                                html = '<div class="loading">❌ Nenhuma etiqueta encontrada ou WhatsApp não conectado</div>';
                            }
                        } else if (panelId === 'blocked-panel') {
                            const response = await fetch('/api/blocked');
                            data = await response.json();

                            if (data.success && data.blocked && data.blocked.length > 0) {
                                const blockedHtml = data.blocked.map((contact, i) => \`
                                    <div class="data-row">
                                        <strong>🚫 Bloqueado \${i + 1}:</strong>
                                        <span>\${contact.name} (\${contact.number || contact.id})</span>
                                    </div>
                                \`).join('');

                                html = \`
                                    <h3 style="margin-bottom: 15px;">🚫 Contatos Bloqueados (\${data.total})</h3>
                                    <div class="data-grid">\${blockedHtml}</div>
                                    <h4 style="margin-top: 20px; margin-bottom: 10px;">📄 JSON Completo:</h4>
                                    <div class="json-viewer">\${JSON.stringify(data.blocked, null, 2)}</div>
                                \`;
                            } else {
                                html = '<div class="loading">✅ Nenhum contato bloqueado</div>';
                            }
                        } else if (panelId === 'state-panel') {
                            const response = await fetch('/api/state');
                            data = await response.json();

                            const stateEmoji = {
                                'CONNECTED': '✅',
                                'OPENING': '🔄',
                                'PAIRING': '⏳',
                                'TIMEOUT': '⏱️',
                                'CONFLICT': '⚠️',
                                'UNLAUNCHED': '🔌',
                                'PROXYBLOCK': '🚫',
                                'TOS_BLOCK': '⛔',
                                'SMB_TOS_BLOCK': '⛔',
                                'DISCONNECTED': '❌'
                            };

                            html = \`
                                <div class="data-grid">
                                    <div class="data-row">
                                        <strong>Estado da Conexão:</strong>
                                        <span>\${stateEmoji[data.state] || '❓'} \${data.state}</span>
                                    </div>
                                </div>
                                <h4 style="margin-top: 20px; margin-bottom: 10px;">📖 Possíveis Estados:</h4>
                                <div class="data-grid">
                                    <div class="data-row"><strong>CONNECTED:</strong><span>✅ Conectado</span></div>
                                    <div class="data-row"><strong>OPENING:</strong><span>🔄 Abrindo conexão</span></div>
                                    <div class="data-row"><strong>PAIRING:</strong><span>⏳ Pareando dispositivo</span></div>
                                    <div class="data-row"><strong>DISCONNECTED:</strong><span>❌ Desconectado</span></div>
                                    <div class="data-row"><strong>CONFLICT:</strong><span>⚠️ Conflito (outro dispositivo)</span></div>
                                </div>
                                <h4 style="margin-top: 20px; margin-bottom: 10px;">📄 JSON Completo:</h4>
                                <div class="json-viewer">\${JSON.stringify(data, null, 2)}</div>
                            \`;
                        }

                        content.innerHTML = html;
                    } catch (error) {
                        content.innerHTML = \`<div class="loading">❌ Erro ao carregar: \${error.message}</div>\`;
                    }
                }

                // Atualiza status a cada 3 segundos
                setInterval(async () => {
                    try {
                        const response = await fetch('/api/status');
                        const data = await response.json();

                        const statusEl = document.getElementById('status-indicator');
                        const qrSection = document.getElementById('qr-section');

                        if (data.isReady) {
                            statusEl.innerHTML = '✅ WhatsApp Conectado e Pronto';
                            statusEl.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
                            if (qrSection) qrSection.style.display = 'none';
                        } else if (data.hasQr) {
                            statusEl.innerHTML = '⏳ Aguardando Conexão - Escaneie o QR Code';
                            statusEl.style.background = 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
                            if (qrSection) qrSection.style.display = 'block';

                            // Atualiza QR Code
                            const qrResponse = await fetch('/api/qr');
                            const qrData = await qrResponse.json();
                            if (qrData.qr) {
                                document.getElementById('qr-img').src = qrData.qr;
                            }
                        } else {
                            statusEl.innerHTML = '🔄 Inicializando WhatsApp...';
                            statusEl.style.background = 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)';
                        }
                    } catch (error) {
                        console.error('Erro ao atualizar status:', error);
                    }
                }, 3000);
            </script>
        </head>
        <body>
            <div class="container">
                <!-- Header -->
                <div class="header">
                    <h1>📱 HMASP Chat - Servidor WhatsApp</h1>
                    <p class="subtitle">Servidor Local - HMASP São Paulo</p>
                </div>

                <!-- Status -->
                <div class="status-card">
                    <div class="status-indicator" id="status-indicator">
                        ${isReady ? '✅ WhatsApp Conectado e Pronto' : (qrCodeData ? '⏳ Aguardando Conexão - Escaneie o QR Code' : '🔄 Inicializando WhatsApp...')}
                    </div>

                    <!-- QR Code Section -->
                    ${!isReady && qrCodeData ? `
                    <div class="qr-section" id="qr-section">
                        <h3>📲 Conectar WhatsApp</h3>
                        <p>Abra o WhatsApp no celular e escaneie o código abaixo:</p>
                        <div class="qr-code">
                            <img id="qr-img" src="${qrCodeData}" alt="QR Code WhatsApp">
                        </div>
                        <div class="instructions">
                            <h3>Como Conectar:</h3>
                            <ol>
                                <li>Abra o <strong>WhatsApp</strong> no seu celular</li>
                                <li>Toque em <strong>Menu (⋮)</strong> ou <strong>Configurações</strong></li>
                                <li>Toque em <strong>Aparelhos Conectados</strong></li>
                                <li>Toque em <strong>Conectar um aparelho</strong></li>
                                <li><strong>Escaneie o QR Code</strong> acima</li>
                            </ol>
                        </div>
                    </div>
                    ` : ''}

                    <!-- Info Grid -->
                    <div class="info-grid">
                        <div class="info-item">
                            <strong>Porta</strong>
                            <span>localhost:3000</span>
                        </div>
                        <div class="info-item">
                            <strong>Tempo Online</strong>
                            <span>${uptimeHours}h ${uptimeMinutes % 60}m</span>
                        </div>
                        <div class="info-item">
                            <strong>Memória</strong>
                            <span>${memoryMB} MB</span>
                        </div>
                        <div class="info-item">
                            <strong>Node.js</strong>
                            <span>${process.version}</span>
                        </div>
                    </div>
                </div>

                <!-- Dados da API -->
                <div class="status-card">
                    <h2 style="margin-bottom: 15px;">📊 Visualizar TODOS os Dados da API WhatsApp</h2>
                    <p style="color: #666; margin-bottom: 15px; font-size: 14px;">⚠️ Agora retornando TODOS os campos disponíveis de cada objeto (sem filtros)</p>
                    <div class="links">
                        <a href="http://localhost:5173" class="link-card" target="_blank">
                            <div class="icon">🌐</div>
                            <div class="text">
                                <h3>Interface Web</h3>
                                <p>Abrir aplicação (nova aba)</p>
                            </div>
                        </a>
                        <button class="link-card toggle-btn" onclick="togglePanel('status-panel')">
                            <div class="icon">📊</div>
                            <div class="text">
                                <h3>Status</h3>
                                <p>Status da conexão</p>
                            </div>
                        </button>
                        <button class="link-card toggle-btn" onclick="togglePanel('info-panel')">
                            <div class="icon">👤</div>
                            <div class="text">
                                <h3>Meu Perfil</h3>
                                <p>Dados do perfil conectado</p>
                            </div>
                        </button>
                        <button class="link-card toggle-btn" onclick="togglePanel('stats-panel')">
                            <div class="icon">📈</div>
                            <div class="text">
                                <h3>Estatísticas</h3>
                                <p>Resumo geral dos dados</p>
                            </div>
                        </button>
                        <button class="link-card toggle-btn" onclick="togglePanel('chats-panel')">
                            <div class="icon">💬</div>
                            <div class="text">
                                <h3>Conversas</h3>
                                <p>Lista de chats ativos</p>
                            </div>
                        </button>
                        <button class="link-card toggle-btn" onclick="togglePanel('contacts-panel')">
                            <div class="icon">👥</div>
                            <div class="text">
                                <h3>Contatos</h3>
                                <p>Todos os contatos (50)</p>
                            </div>
                        </button>
                        <button class="link-card toggle-btn" onclick="togglePanel('labels-panel')">
                            <div class="icon">🏷️</div>
                            <div class="text">
                                <h3>Etiquetas</h3>
                                <p>Labels do WhatsApp</p>
                            </div>
                        </button>
                        <button class="link-card toggle-btn" onclick="togglePanel('blocked-panel')">
                            <div class="icon">🚫</div>
                            <div class="text">
                                <h3>Bloqueados</h3>
                                <p>Contatos bloqueados</p>
                            </div>
                        </button>
                        <button class="link-card toggle-btn" onclick="togglePanel('state-panel')">
                            <div class="icon">🔗</div>
                            <div class="text">
                                <h3>Estado</h3>
                                <p>Estado da conexão</p>
                            </div>
                        </button>
                    </div>

                    <!-- Painel Status -->
                    <div id="status-panel" class="api-panel">
                        <div class="api-content" id="status-panel-content">
                            <div class="loading">Carregando...</div>
                        </div>
                    </div>

                    <!-- Painel Info (Perfil) -->
                    <div id="info-panel" class="api-panel">
                        <div class="api-content" id="info-panel-content">
                            <div class="loading">Carregando...</div>
                        </div>
                    </div>

                    <!-- Painel Estatísticas -->
                    <div id="stats-panel" class="api-panel">
                        <div class="api-content" id="stats-panel-content">
                            <div class="loading">Carregando...</div>
                        </div>
                    </div>

                    <!-- Painel Chats -->
                    <div id="chats-panel" class="api-panel">
                        <div class="api-content" id="chats-panel-content">
                            <div class="loading">Carregando...</div>
                        </div>
                    </div>

                    <!-- Painel Contatos -->
                    <div id="contacts-panel" class="api-panel">
                        <div class="api-content" id="contacts-panel-content">
                            <div class="loading">Carregando...</div>
                        </div>
                    </div>

                    <!-- Painel Labels -->
                    <div id="labels-panel" class="api-panel">
                        <div class="api-content" id="labels-panel-content">
                            <div class="loading">Carregando...</div>
                        </div>
                    </div>

                    <!-- Painel Bloqueados -->
                    <div id="blocked-panel" class="api-panel">
                        <div class="api-content" id="blocked-panel-content">
                            <div class="loading">Carregando...</div>
                        </div>
                    </div>

                    <!-- Painel Estado -->
                    <div id="state-panel" class="api-panel">
                        <div class="api-content" id="state-panel-content">
                            <div class="loading">Carregando...</div>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="footer">
                    <p>Hospital Militar de Área de São Paulo</p>
                    <p style="font-size: 14px; margin-top: 5px;">Central de Regulação - Marcação de Consultas</p>
                </div>
            </div>
        </body>
        </html>
    `);
});

// ============================================================================
// ROTAS AGHUSE - Integração com Banco de Dados
// ============================================================================

// Testar conexão com AGHUse
app.get('/api/aghuse/test-connection', async (req, res) => {
    try {
        console.log('[AGHUse] Testando conexão...');
        const result = await aghuse.testConnection();
        res.json(result);
    } catch (error) {
        console.error('[AGHUse] Erro ao testar conexão:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Buscar consultas marcadas recentemente
app.get('/api/aghuse/recent-appointments', async (req, res) => {
    try {
        const minutes = validateNumericParam(req.query.minutes, 60, 1, 1440); // Máx 24h
        const offset = validateNumericParam(req.query.offset, 0, 0, 10000);
        const limit = validateNumericParam(req.query.limit, 100, 1, 500); // Máx 500
        console.log(`[AGHUse] Buscando consultas dos últimos ${minutes} minutos (offset: ${offset}, limit: ${limit})...`);

        const appointments = await aghuse.fetchRecentlyScheduledAppointments(minutes, { offset, limit });
        res.json({
            success: true,
            count: appointments.length,
            offset,
            limit,
            hasMore: appointments.length === limit,  // Se retornou limite completo, pode ter mais
            appointments
        });
    } catch (error) {
        console.error('[AGHUse] Erro ao buscar consultas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Buscar consultas desmarcadas recentemente
app.get('/api/aghuse/recent-cancellations', async (req, res) => {
    try {
        const minutes = validateNumericParam(req.query.minutes, 60, 1, 1440); // Máx 24h
        console.log(`[AGHUse] Buscando cancelamentos dos últimos ${minutes} minutos...`);

        const cancellations = await aghuse.fetchRecentlyCancelledAppointments(minutes);
        res.json({
            success: true,
            count: cancellations.length,
            cancellations
        });
    } catch (error) {
        console.error('[AGHUse] Erro ao buscar cancelamentos:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Alias para cancelled-appointments (compatibilidade com frontend)
app.get('/api/aghuse/cancelled-appointments', async (req, res) => {
    try {
        const minutes = validateNumericParam(req.query.minutes, 60, 1, 1440); // Máx 24h
        const offset = validateNumericParam(req.query.offset, 0, 0, 10000);
        const limit = validateNumericParam(req.query.limit, 100, 1, 500); // Máx 500
        console.log(`[AGHUse] Buscando cancelamentos dos últimos ${minutes} minutos (offset: ${offset}, limit: ${limit})...`);

        const appointments = await aghuse.fetchRecentlyCancelledAppointments(minutes, { offset, limit });
        console.log(`[AGHUse] ✅ ${appointments.length} consultas desmarcadas encontradas (offset: ${offset}, limit: ${limit})`);

        // ✅ CORREÇÃO: Filtra apenas desmarcações que JÁ EXISTEM na tabela desmarcacoes_ativas
        // NÃO usa mais consultas_processadas (que misturava marcações com desmarcações)
        // Isso permite que consultas previamente marcadas apareçam quando forem desmarcadas
        //
        // CHAVE COMPOSTA: consultaNumero + prontuario + dataHoraFormatada + dataDesmarcacao
        // Isso permite que a mesma consulta desmarcada várias vezes apareça cada vez
        const hmaspDB = require('better-sqlite3')(path.join(__dirname, 'server', 'database', 'hmasp_consultas.db'));

        const naoProcessadas = appointments.filter(c => {
            // AGHUse retorna em snake_case: consulta_numero, data_hora_consulta, etc.
            const numeroConsulta = c.consulta_numero || c.numero || c.consultaNumero;
            const prontuario = c.prontuario;

            // Calcula dataHoraFormatada a partir de data_hora_consulta
            let dataHoraFormatada = c.dataHoraFormatada;
            if (!dataHoraFormatada && c.data_hora_consulta) {
                const dataConsulta = new Date(c.data_hora_consulta);
                const dia = String(dataConsulta.getDate()).padStart(2, '0');
                const mes = String(dataConsulta.getMonth() + 1).padStart(2, '0');
                const ano = dataConsulta.getFullYear();
                const hora = String(dataConsulta.getHours()).padStart(2, '0');
                const minuto = String(dataConsulta.getMinutes()).padStart(2, '0');
                dataHoraFormatada = `${dia}/${mes}/${ano} ${hora}:${minuto}`;
            }

            // Normaliza dataDesmarcacao para string ISO (pode vir como Date ou string)
            // IMPORTANTE: AGHUse retorna como data_hora_desmarcacao (com _hora_)
            let dataDesmarcacao = c.dataDesmarcacao || c.data_hora_desmarcacao || c.data_desmarcacao;
            if (dataDesmarcacao instanceof Date) {
                dataDesmarcacao = dataDesmarcacao.toISOString();
            } else if (dataDesmarcacao && typeof dataDesmarcacao === 'string' && !dataDesmarcacao.includes('T')) {
                // Se for string mas não ISO, tenta converter
                const parsed = new Date(dataDesmarcacao);
                if (!isNaN(parsed.getTime())) {
                    dataDesmarcacao = parsed.toISOString();
                }
            }

            // DEBUG: Log para investigar problemas
            console.log(`[Filtro] Verificando desmarcação ${numeroConsulta}: prontuario=${prontuario}, dataHora=${dataHoraFormatada}, dataDesmarcacao=${dataDesmarcacao}`);

            // Se não tem dataDesmarcacao, usa filtro simplificado (sem esse campo)
            // Isso evita bloquear desmarcações quando o campo está null
            let row;
            if (!dataDesmarcacao) {
                const stmt = hmaspDB.prepare(`
                    SELECT 1 FROM desmarcacoes_ativas
                    WHERE consulta_numero = ?
                    AND prontuario = ?
                    AND data_hora_formatada = ?
                `);
                row = stmt.get(numeroConsulta, prontuario, dataHoraFormatada);
            } else {
                // Verifica se já existe na tabela de desmarcações ativas
                // Usa chave composta COMPLETA: consulta_numero + prontuario + data_hora_formatada + data_desmarcacao
                const stmt = hmaspDB.prepare(`
                    SELECT 1 FROM desmarcacoes_ativas
                    WHERE consulta_numero = ?
                    AND prontuario = ?
                    AND data_hora_formatada = ?
                    AND data_desmarcacao = ?
                `);
                row = stmt.get(numeroConsulta, prontuario, dataHoraFormatada, dataDesmarcacao);
            }

            const isNew = !row;
            console.log(`[Filtro] Desmarcação ${numeroConsulta}: ${isNew ? '✅ NOVA' : '⏭️ JÁ EXISTE'}`);
            return isNew; // Se não encontrou, não foi processada como desmarcação
        });

        hmaspDB.close();

        console.log(`[Database] Filtro desmarcacoes_ativas (chave: numero+prontuario+dataHora+dataDesmarcacao): ${naoProcessadas.length} novas de ${appointments.length} total`);

        res.json({
            success: true,
            count: naoProcessadas.length,
            offset,
            limit,
            hasMore: appointments.length === limit,  // Se retornou limite completo, pode ter mais
            appointments: naoProcessadas  // IMPORTANTE: frontend espera "appointments", não "cancellations"
        });
    } catch (error) {
        console.error('[AGHUse] Erro ao buscar cancelamentos:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Buscar consultas para lembrete 72h
app.get('/api/aghuse/appointments-72h', async (req, res) => {
    try {
        console.log('[AGHUse] Buscando consultas para lembrete 72h...');

        const appointments = await aghuse.fetchAppointmentsIn72Hours();
        res.json({
            success: true,
            count: appointments.length,
            appointments
        });
    } catch (error) {
        console.error('[AGHUse] Erro ao buscar consultas 72h:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// CONSULTAS DO PACIENTE - Busca por nome, CPF ou prontuario
// ============================================================================

// Buscar pacientes (para autocomplete/selecao)
app.get('/api/aghuse/search-patient', async (req, res) => {
    try {
        const { nome, cpf, prontuario } = req.query;

        if (!nome && !cpf && !prontuario) {
            return res.status(400).json({
                success: false,
                error: 'Informe pelo menos um filtro: nome, cpf ou prontuario'
            });
        }

        console.log('[AGHUse] Buscando paciente:', { nome, cpf, prontuario });

        const pacientes = await aghuse.searchPatient({ nome, cpf, prontuario });

        res.json({
            success: true,
            count: pacientes.length,
            pacientes
        });
    } catch (error) {
        console.error('[AGHUse] Erro ao buscar paciente:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Buscar consultas de um paciente especifico
app.get('/api/aghuse/patient-appointments', async (req, res) => {
    try {
        const { nome, cpf, prontuario, apenasAgendadas } = req.query;

        if (!nome && !cpf && !prontuario) {
            return res.status(400).json({
                success: false,
                error: 'Informe pelo menos um filtro: nome, cpf ou prontuario'
            });
        }

        console.log('[AGHUse] Buscando consultas do paciente:', { nome, cpf, prontuario });

        const appointments = await aghuse.fetchPatientAppointments({
            nome,
            cpf,
            prontuario,
            apenasAgendadas: apenasAgendadas !== 'false'
        });

        // Transforma dados para formato padrao do frontend
        const consultasFormatadas = appointments.map(row => ({
            consultaNumero: row.consulta_numero,
            pacCodigo: row.pac_codigo,
            prontuario: row.prontuario,
            nomePaciente: row.nome_paciente,
            cpf: row.cpf_paciente,
            telefoneCelular: row.telefone_celular,
            telefoneFixo: row.telefone_fixo,
            dataConsulta: row.data_hora_consulta,
            dataMarcacao: row.data_hora_marcacao,
            situacao: row.situacao_codigo,
            situacaoDescricao: row.situacao_descricao,
            especialidade: row.especialidade || 'Nao informada',
            profissional: row.profissional_nome || 'Nao informado',
            local: row.local_descricao || 'Nao informado'
        }));

        res.json({
            success: true,
            count: consultasFormatadas.length,
            consultas: consultasFormatadas
        });
    } catch (error) {
        console.error('[AGHUse] Erro ao buscar consultas do paciente:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// CHAT PROPRIO - API do Sistema de Mensagens Interno (Meu HMASP)
// ============================================================================
// Substitui a dependencia do WhatsApp por chat interno

// Listar conversas ativas
app.get('/api/chat-proprio/conversas', async (req, res) => {
    try {
        const { status = 'ativa', limit = 50, offset = 0 } = req.query;
        const conversas = ChatService.listarConversas({
            status,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        res.json({ success: true, conversas });
    } catch (error) {
        console.error('[Chat] Erro ao listar conversas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Buscar conversa por ID
app.get('/api/chat-proprio/conversas/:id', async (req, res) => {
    try {
        const conversa = ChatService.getConversa(parseInt(req.params.id));
        if (!conversa) {
            return res.status(404).json({ success: false, error: 'Conversa nao encontrada' });
        }
        res.json({ success: true, conversa });
    } catch (error) {
        console.error('[Chat] Erro ao buscar conversa:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Buscar ou criar conversa para um paciente
app.post('/api/chat-proprio/conversas', async (req, res) => {
    try {
        const { pacienteId, pacienteNome, pacienteTelefone } = req.body;
        if (!pacienteId) {
            return res.status(400).json({ success: false, error: 'pacienteId e obrigatorio' });
        }
        const conversa = ChatService.getOrCreateConversa(pacienteId, pacienteNome, pacienteTelefone);
        res.json({ success: true, conversa });
    } catch (error) {
        console.error('[Chat] Erro ao criar conversa:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Arquivar conversa
app.post('/api/chat-proprio/conversas/:id/arquivar', async (req, res) => {
    try {
        ChatService.arquivarConversa(parseInt(req.params.id));
        res.json({ success: true, message: 'Conversa arquivada' });
    } catch (error) {
        console.error('[Chat] Erro ao arquivar conversa:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Listar mensagens de uma conversa
app.get('/api/chat-proprio/conversas/:id/mensagens', async (req, res) => {
    try {
        const { limit = 50, offset = 0, ordem = 'ASC' } = req.query;
        const mensagens = ChatService.listarMensagens(parseInt(req.params.id), {
            limit: parseInt(limit),
            offset: parseInt(offset),
            ordem
        });
        res.json({ success: true, mensagens });
    } catch (error) {
        console.error('[Chat] Erro ao listar mensagens:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Buscar mensagens recentes (para polling)
app.get('/api/chat-proprio/conversas/:id/mensagens/recentes', async (req, res) => {
    try {
        const { apos } = req.query;
        const mensagens = ChatService.getMensagensRecentes(parseInt(req.params.id), apos);
        res.json({ success: true, mensagens });
    } catch (error) {
        console.error('[Chat] Erro ao buscar mensagens recentes:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Enviar mensagem
app.post('/api/chat-proprio/mensagens', async (req, res) => {
    try {
        const { conversaId, remetenteTipo, remetenteId, remetenteNome, conteudo, tipo = 'texto' } = req.body;

        if (!conversaId || !remetenteTipo || !conteudo) {
            return res.status(400).json({
                success: false,
                error: 'Campos obrigatorios: conversaId, remetenteTipo, conteudo'
            });
        }

        const mensagem = ChatService.enviarMensagem({
            conversaId: parseInt(conversaId),
            remetenteTipo,
            remetenteId,
            remetenteNome,
            conteudo,
            tipo
        });

        res.json({ success: true, mensagem });
    } catch (error) {
        console.error('[Chat] Erro ao enviar mensagem:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Marcar mensagens como lidas
app.post('/api/chat-proprio/conversas/:id/marcar-lidas', async (req, res) => {
    try {
        const { lidoPor } = req.body;
        if (!lidoPor || !['paciente', 'operador'].includes(lidoPor)) {
            return res.status(400).json({
                success: false,
                error: 'lidoPor deve ser "paciente" ou "operador"'
            });
        }
        ChatService.marcarComoLidas(parseInt(req.params.id), lidoPor);
        res.json({ success: true, message: 'Mensagens marcadas como lidas' });
    } catch (error) {
        console.error('[Chat] Erro ao marcar como lidas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Registrar operador online (ping)
app.post('/api/chat-proprio/operadores/ping', async (req, res) => {
    try {
        const { operadorId, operadorNome } = req.body;
        if (!operadorId || !operadorNome) {
            return res.status(400).json({
                success: false,
                error: 'operadorId e operadorNome sao obrigatorios'
            });
        }
        ChatService.registrarOperadorOnline(operadorId, operadorNome);
        res.json({ success: true });
    } catch (error) {
        console.error('[Chat] Erro ao registrar operador:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Listar operadores online
app.get('/api/chat-proprio/operadores/online', async (req, res) => {
    try {
        const operadores = ChatService.listarOperadoresOnline();
        res.json({ success: true, operadores });
    } catch (error) {
        console.error('[Chat] Erro ao listar operadores:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Remover operador offline
app.post('/api/chat-proprio/operadores/offline', async (req, res) => {
    try {
        const { operadorId } = req.body;
        if (!operadorId) {
            return res.status(400).json({ success: false, error: 'operadorId e obrigatorio' });
        }
        ChatService.removerOperadorOffline(operadorId);
        res.json({ success: true });
    } catch (error) {
        console.error('[Chat] Erro ao remover operador:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Estatisticas do chat
app.get('/api/chat-proprio/estatisticas', async (req, res) => {
    try {
        const stats = ChatService.getEstatisticas();
        res.json({ success: true, estatisticas: stats });
    } catch (error) {
        console.error('[Chat] Erro ao buscar estatisticas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Contar mensagens nao lidas (para badge)
app.get('/api/chat-proprio/nao-lidas', async (req, res) => {
    try {
        const total = ChatService.contarNaoLidas();
        res.json({ success: true, naoLidas: total });
    } catch (error) {
        console.error('[Chat] Erro ao contar nao lidas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// PACIENTE - Endpoints do App Mobile (Meu HMASP)
// ============================================================================

// Verificar paciente por CPF e prontuario (login do app mobile)
app.post('/api/paciente/verificar', async (req, res) => {
    try {
        const { cpf, prontuario } = req.body;

        if (!cpf || !prontuario) {
            return res.status(400).json({
                success: false,
                error: 'CPF e prontuario sao obrigatorios'
            });
        }

        console.log('[Paciente] Verificando:', { cpf: cpf.substring(0, 3) + '***', prontuario });

        // Busca no AGHUse
        const paciente = await aghuse.searchPatient({ cpf, prontuario });

        if (paciente && paciente.length > 0) {
            const p = paciente[0];
            res.json({
                success: true,
                paciente: {
                    id: p.pac_codigo,
                    prontuario: p.prontuario,
                    nome: p.nome,
                    cpf: cpf,
                    telefone: p.telefone_celular || p.telefone_fixo || null
                }
            });
        } else {
            res.json({
                success: false,
                error: 'Paciente nao encontrado. Verifique CPF e prontuario.'
            });
        }
    } catch (error) {
        console.error('[Paciente] Erro ao verificar:', error);

        // Modo offline - retorna dados mockados para teste
        res.json({
            success: true,
            paciente: {
                id: req.body.prontuario,
                prontuario: req.body.prontuario,
                nome: 'Paciente ' + req.body.prontuario,
                cpf: req.body.cpf,
                telefone: null
            },
            offline: true
        });
    }
});

// Buscar consultas do paciente (app mobile)
app.get('/api/paciente/consultas', async (req, res) => {
    try {
        const { prontuario } = req.query;

        if (!prontuario) {
            return res.status(400).json({
                success: false,
                error: 'Prontuario e obrigatorio'
            });
        }

        console.log('[Paciente] Buscando consultas para prontuario:', prontuario);

        const consultas = await aghuse.fetchPatientAppointments({
            prontuario,
            apenasAgendadas: true
        });

        // Formata para o app mobile
        const consultasFormatadas = consultas.map(c => ({
            id: c.consulta_numero,
            dataFormatada: new Date(c.data_hora_consulta).toLocaleDateString('pt-BR'),
            horaFormatada: new Date(c.data_hora_consulta).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit'
            }),
            especialidade: c.especialidade || 'Consulta',
            profissional: c.profissional_nome || 'A confirmar',
            local: c.local_descricao || 'HMASP',
            status: mapSituacaoToStatus(c.situacao_codigo)
        }));

        res.json({
            success: true,
            consultas: consultasFormatadas
        });
    } catch (error) {
        console.error('[Paciente] Erro ao buscar consultas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Mapeia codigo de situacao para status do app
function mapSituacaoToStatus(situacao) {
    const mapeamento = {
        'A': 'pendente',     // Agendada
        'C': 'confirmada',   // Confirmada
        'N': 'cancelada',    // Nao compareceu
        'R': 'cancelada',    // Reagendada
        'D': 'cancelada'     // Desmarcada
    };
    return mapeamento[situacao] || 'pendente';
}

// ============================================================================
// DATABASE - Otimização de Performance
// ============================================================================

// Endpoint para executar otimização de índices
app.post('/api/database/optimize', async (req, res) => {
    try {
        console.log('[Database] Iniciando otimização de índices...');

        const pool = aghuse.getPool();

        // Criar índice 1: status + time + numero
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_consultas_jn_status_time_numero
            ON agh.aac_consultas_jn (stc_situacao, jn_date_time DESC, numero)
            WHERE jn_operation = 'UPD'
        `);

        // Criar índice 2: numero + time + status
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_consultas_jn_numero_time_status
            ON agh.aac_consultas_jn (numero, jn_date_time DESC, stc_situacao)
            WHERE jn_operation != 'DEL'
        `);

        // Criar índice 3: time geral
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_consultas_jn_time
            ON agh.aac_consultas_jn (jn_date_time DESC)
            WHERE jn_operation = 'UPD'
        `);

        // Atualizar estatísticas
        await pool.query('ANALYZE agh.aac_consultas_jn');

        // Verificar índices criados
        const resultado = await pool.query(`
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename = 'aac_consultas_jn'
                AND indexname LIKE 'idx_consultas_jn_%'
            ORDER BY indexname
        `);

        console.log('[Database] ✅ Otimização concluída:', resultado.rows.length, 'índices');

        res.json({
            success: true,
            message: 'Otimização concluída com sucesso',
            indices: resultado.rows.map(r => r.indexname)
        });

    } catch (error) {
        console.error('[Database] ❌ Erro ao otimizar:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================================
// DATABASE - Endpoints de Monitoramento (PostgreSQL Local)
// ============================================================================

// Estado do monitoramento (em memória por enquanto, pode migrar para PostgreSQL depois)
let monitoramentoState = {
    ativo: false,
    ultimaVerificacao: null,
    totalEnviadas: 0,
    totalFalhas: 0
};

// ============================================================================
// BANCO DE DADOS SQLITE - PERSISTÊNCIA DE CONSULTAS PROCESSADAS
// ============================================================================

const DB_PATH = path.join(__dirname, 'server', 'database', 'consultas_processadas.db');
const consultasDB = new Database(DB_PATH);
consultasDB.pragma('journal_mode = WAL');

// Cria tabela se não existir
consultasDB.exec(`
    CREATE TABLE IF NOT EXISTS consultas_processadas (
        numero TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        detalhes TEXT,
        timestamp TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_consultas_timestamp ON consultas_processadas(timestamp);
    CREATE INDEX IF NOT EXISTS idx_consultas_status ON consultas_processadas(status);
`);

// ============================================================================
// MIGRAÇÃO: Adiciona campos para chave composta (consultaNumero + dataConsulta)
// ============================================================================
try {
    // Verifica se coluna chave_unica já existe
    const columns = consultasDB.prepare("PRAGMA table_info(consultas_processadas)").all();
    const hasChaveUnica = columns.some(col => col.name === 'chave_unica');
    const hasDataConsulta = columns.some(col => col.name === 'data_consulta');

    if (!hasChaveUnica) {
        console.log('[Database] 🔧 Migrando: Adicionando coluna chave_unica...');
        consultasDB.exec(`ALTER TABLE consultas_processadas ADD COLUMN chave_unica TEXT`);

        // Preenche chave_unica com valores existentes (usa numero como fallback)
        consultasDB.exec(`UPDATE consultas_processadas SET chave_unica = numero WHERE chave_unica IS NULL`);

        // Cria índice único
        consultasDB.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_consultas_chave_unica ON consultas_processadas(chave_unica)`);

        console.log('[Database] ✅ Coluna chave_unica adicionada com sucesso');
    }

    if (!hasDataConsulta) {
        console.log('[Database] 🔧 Migrando: Adicionando coluna data_consulta...');
        consultasDB.exec(`ALTER TABLE consultas_processadas ADD COLUMN data_consulta TEXT`);
        console.log('[Database] ✅ Coluna data_consulta adicionada com sucesso');
    }

    console.log('[Database] ✅ Migração concluída - Sistema usa chave composta (numero + data_consulta)');
} catch (error) {
    console.error('[Database] ❌ Erro na migração:', error.message);
}

console.log('[Database] ✅ SQLite inicializado para consultas processadas:', DB_PATH);

// GET /api/database/monitoramento/state - Obtém estado do monitoramento
app.get('/api/database/monitoramento/state', (req, res) => {
    res.json({
        success: true,
        state: monitoramentoState
    });
});

// POST /api/database/monitoramento/state - Salva estado do monitoramento
app.post('/api/database/monitoramento/state', (req, res) => {
    const { ativo, ultimaVerificacao, totalEnviadas, totalFalhas } = req.body;

    monitoramentoState = {
        ativo: ativo !== undefined ? ativo : monitoramentoState.ativo,
        ultimaVerificacao: ultimaVerificacao || monitoramentoState.ultimaVerificacao,
        totalEnviadas: totalEnviadas !== undefined ? totalEnviadas : monitoramentoState.totalEnviadas,
        totalFalhas: totalFalhas !== undefined ? totalFalhas : monitoramentoState.totalFalhas
    };

    console.log('[Database] Estado do monitoramento salvo:', monitoramentoState);

    res.json({
        success: true,
        state: monitoramentoState
    });
});

// POST /api/database/monitoramento/consulta - Registra consulta processada
app.post('/api/database/monitoramento/consulta', (req, res) => {
    try {
        const { consultaNumero, status, detalhes } = req.body;

        const stmt = consultasDB.prepare(`
            INSERT OR REPLACE INTO consultas_processadas (numero, status, detalhes, timestamp)
            VALUES (?, ?, ?, ?)
        `);

        stmt.run(
            consultaNumero,
            status,
            JSON.stringify(detalhes || {}),
            new Date().toISOString()
        );

        console.log(`[Database] Consulta ${consultaNumero} registrada como ${status} (SQLite)`);

        res.json({ success: true });
    } catch (error) {
        console.error('[Database] Erro ao registrar consulta:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/database/monitoramento/consulta/:numero - Verifica se consulta foi processada
app.get('/api/database/monitoramento/consulta/:numero', (req, res) => {
    try {
        const { numero } = req.params;

        const stmt = consultasDB.prepare(`
            SELECT numero, status, detalhes, timestamp
            FROM consultas_processadas
            WHERE numero = ?
        `);

        const row = stmt.get(numero);
        const processada = !!row;

        res.json({
            success: true,
            processada,
            dados: row ? {
                status: row.status,
                detalhes: JSON.parse(row.detalhes || '{}'),
                timestamp: row.timestamp
            } : null
        });
    } catch (error) {
        console.error('[Database] Erro ao verificar consulta:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/database/monitoramento/consulta/:numero - Remove consulta da lista de processadas
// IMPORTANTE: Usado pelo DesmarcacaoLinker para permitir que consulta reapareça se for remarcada
app.delete('/api/database/monitoramento/consulta/:numero', (req, res) => {
    try {
        const { numero } = req.params;

        // Remove TODAS as entradas com este consultaNumero
        // (pode haver múltiplas se a consulta foi marcada várias vezes)
        const stmt = consultasDB.prepare(`
            DELETE FROM consultas_processadas WHERE numero = ?
        `);

        const result = stmt.run(numero);

        console.log(`[Database] ✅ Consulta ${numero} removida da lista de processadas (${result.changes} registros)`);

        res.json({
            success: true,
            removidos: result.changes
        });
    } catch (error) {
        console.error('[Database] Erro ao remover consulta:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/database/monitoramento/consultas/filtrar - Filtra consultas não processadas
app.post('/api/database/monitoramento/consultas/filtrar', (req, res) => {
    try {
        const { consultas } = req.body;

        // Função auxiliar para gerar chave composta no backend
        // CHAVE: numero + dataConsulta + dataMarcacao
        // Isso permite que a mesma consulta marcada várias vezes apareça cada vez
        function gerarChaveUnicaBackend(c) {
            const numero = c.consultaNumero || c.consulta_numero || c.numero;
            const dataConsulta = c.dataConsulta || c.data_consulta || c.data_hora_consulta;
            // IMPORTANTE: AGHUse retorna como data_hora_marcacao (com _hora_)
            const dataMarcacao = c.dataMarcacao || c.data_marcacao || c.data_hora_marcacao || '';

            if (!numero || !dataConsulta) {
                return null;
            }

            // Normaliza datas para ISO
            let dataConsultaISO = dataConsulta;
            if (dataConsulta instanceof Date) {
                dataConsultaISO = dataConsulta.toISOString();
            }

            let dataMarcacaoISO = dataMarcacao;
            if (dataMarcacao instanceof Date) {
                dataMarcacaoISO = dataMarcacao.toISOString();
            }

            return `${numero}_${dataConsultaISO}_${dataMarcacaoISO}`;
        }

        // Usa SQLite para verificar quais consultas já foram processadas
        const naoProcessadas = consultas.filter(c => {
            // Usa chaveUnica do frontend ou gera no backend
            const chaveUnica = c.chaveUnica || gerarChaveUnicaBackend(c);

            if (!chaveUnica) {
                // Se não conseguiu gerar chave composta, considera como NÃO processada
                // (melhor mostrar do que esconder)
                console.warn(`[Database] ⚠️ Consulta sem chave válida - permitindo passagem:`, c.consultaNumero || c.consulta_numero);
                return true;
            }

            // Verifica pela chave composta
            const stmt = consultasDB.prepare(`
                SELECT 1 FROM consultas_processadas WHERE chave_unica = ?
            `);
            const row = stmt.get(chaveUnica);
            return !row; // Se não encontrou, não foi processada
        });

        console.log(`[Database] Filtro SQLite (chave composta): ${naoProcessadas.length} não processadas de ${consultas.length} total`);

        res.json({
            success: true,
            total: consultas.length,
            naoProcessadasCount: naoProcessadas.length,
            naoProcessadas
        });
    } catch (error) {
        console.error('[Database] Erro ao filtrar consultas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/database/monitoramento/consultas/marcar - Marca consultas como processadas
app.post('/api/database/monitoramento/consultas/marcar', (req, res) => {
    try {
        const { consultas } = req.body;

        if (!Array.isArray(consultas) || consultas.length === 0) {
            return res.json({ success: true, marcadas: 0 });
        }

        // Função auxiliar para gerar chave composta no backend
        // CHAVE: numero + dataConsulta + dataMarcacao
        function gerarChaveUnicaBackend(c) {
            const numero = c.consultaNumero || c.consulta_numero || c.numero;
            const dataConsulta = c.dataConsulta || c.data_consulta || c.data_hora_consulta;
            // IMPORTANTE: AGHUse retorna como data_hora_marcacao (com _hora_)
            const dataMarcacao = c.dataMarcacao || c.data_marcacao || c.data_hora_marcacao || '';

            if (!numero || !dataConsulta) {
                return numero; // Fallback para apenas numero se não tem dados
            }

            // Normaliza datas para ISO
            let dataConsultaISO = dataConsulta;
            if (dataConsulta instanceof Date) {
                dataConsultaISO = dataConsulta.toISOString();
            }

            let dataMarcacaoISO = dataMarcacao;
            if (dataMarcacao instanceof Date) {
                dataMarcacaoISO = dataMarcacao.toISOString();
            }

            return `${numero}_${dataConsultaISO}_${dataMarcacaoISO}`;
        }

        // CHAVE COMPOSTA: numero + dataConsulta + dataMarcacao
        // Isso permite que a mesma consulta marcada várias vezes apareça cada vez
        const stmt = consultasDB.prepare(`
            INSERT OR REPLACE INTO consultas_processadas
            (numero, chave_unica, data_consulta, status, detalhes, timestamp)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        let marcadas = 0;
        for (const consulta of consultas) {
            const numeroConsulta = consulta.numero || consulta.consultaNumero || consulta.consulta_numero;
            const chaveUnica = consulta.chaveUnica || gerarChaveUnicaBackend(consulta);
            const dataConsulta = consulta.dataConsulta || consulta.data_consulta || consulta.data_hora_consulta || null;
            // IMPORTANTE: AGHUse retorna como data_hora_marcacao (com _hora_)
            const dataMarcacao = consulta.dataMarcacao || consulta.data_marcacao || consulta.data_hora_marcacao || null;

            stmt.run(
                numeroConsulta,
                chaveUnica,
                dataConsulta,
                'processada',
                JSON.stringify({
                    paciente: consulta.paciente || consulta.nomePaciente,
                    especialidade: consulta.especialidade,
                    dataHora: consulta.dataHora || consulta.dataHoraFormatada,
                    dataConsulta: dataConsulta,
                    dataMarcacao: dataMarcacao
                }),
                new Date().toISOString()
            );
            marcadas++;
        }

        console.log(`[Database] ✅ ${marcadas} consultas marcadas como processadas (chave composta: numero + dataConsulta + dataMarcacao)`);

        res.json({
            success: true,
            marcadas
        });
    } catch (error) {
        console.error('[Database] Erro ao marcar consultas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/database/monitoramento/stats - Estatísticas
app.get('/api/database/monitoramento/stats', (req, res) => {
    try {
        const stmt = consultasDB.prepare(`SELECT COUNT(*) as total FROM consultas_processadas`);
        const { total } = stmt.get();

        res.json({
            success: true,
            stats: {
                totalProcessadas: total,
                totalEnviadas: monitoramentoState.totalEnviadas,
                totalFalhas: monitoramentoState.totalFalhas,
                ultimaVerificacao: monitoramentoState.ultimaVerificacao
            }
        });
    } catch (error) {
        console.error('[Database] Erro ao obter estatísticas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/database/monitoramento/reset - Reseta monitoramento
app.delete('/api/database/monitoramento/reset', (req, res) => {
    try {
        consultasDB.prepare(`DELETE FROM consultas_processadas`).run();
        monitoramentoState = {
            ativo: false,
            ultimaVerificacao: null,
            totalEnviadas: 0,
            totalFalhas: 0
        };

        console.log('[Database] Monitoramento resetado (SQLite limpo)');

        res.json({ success: true });
    } catch (error) {
        console.error('[Database] Erro ao resetar monitoramento:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/database/monitoramento/clear - Limpa banco (alias do reset)
app.post('/api/database/monitoramento/clear', (req, res) => {
    consultasProcessadas.clear();
    console.log('[Database] Banco limpo');
    res.json({ success: true });
});

// ============================================================================
// DESMARCAÇÕES - Endpoints para gerenciamento de desmarcações
// ============================================================================

// POST /api/desmarcacoes/update-status - Atualiza status quando paciente responde
app.post('/api/desmarcacoes/update-status', async (req, res) => {
    try {
        const { id, status, tipo_desmarcacao } = req.body;

        if (!id || !status || !tipo_desmarcacao) {
            return res.status(400).json({
                success: false,
                error: 'Campos obrigatórios: id, status, tipo_desmarcacao'
            });
        }

        const consultasService = require('./server/database/consultas.service');
        const result = consultasService.updateDesmarcacaoStatus(id, status, tipo_desmarcacao);

        console.log(`[Database] Status atualizado: ${id} → ${status} (${tipo_desmarcacao})`);

        res.json({
            success: true,
            ...result
        });

    } catch (error) {
        console.error('[Database] Erro ao atualizar status:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================================
// ADMIN - Endpoint de Atualização Remota
// ============================================================================

// Endpoint de emergência para configurar Git (bootstrap)
// NOTA: Este endpoint foi desabilitado por questões de segurança
// Use SSH/acesso direto ao servidor para executar comandos de manutenção
app.post('/api/fix-git', async (req, res) => {
    console.log('[FIX-GIT] ⚠️ Endpoint desabilitado por segurança');

    res.status(403).json({
        success: false,
        error: 'Este endpoint foi desabilitado por questões de segurança',
        message: 'Por favor, execute comandos de manutenção diretamente no servidor via SSH',
        alternative: 'Use: ssh usuario@servidor && git config --global --add safe.directory /opt/hmasp/hmasp-chat-v2'
    });
});

// Endpoint de força-bruta para bootstrap inicial
// NOTA: Este endpoint foi desabilitado por questões de segurança
// Use scripts de deploy ou acesso SSH direto ao servidor
app.post('/api/force-update', async (req, res) => {
    console.log('[FORCE-UPDATE] ⚠️ Endpoint desabilitado por segurança');

    res.status(403).json({
        success: false,
        error: 'Este endpoint foi desabilitado por questões de segurança',
        message: 'Por favor, use o script de deploy ou execute comandos diretamente no servidor',
        alternatives: [
            'SSH: Execute update-script.sh no servidor',
            'Script: ./deploy-update.sh',
            'Manual: git pull && npm install && npm run build && systemctl restart hmasp-chat'
        ]
    });
});

// ============================================================================
// ENDPOINTS DE DIAGNÓSTICO E CONTROLE REMOTO
// ============================================================================

// GET /api/diagnostic - Diagnóstico completo do sistema
app.get('/api/diagnostic', async (req, res) => {
    const fs = require('fs').promises;

    try {
        const diagnostic = {
            timestamp: new Date().toISOString(),
            server: {},
            git: {},
            frontend: {},
            processes: {}
        };

        // Git status (usando função segura)
        try {
            const gitLog = await executeSecureCommand('git', ['log', '-1', '--oneline'], { cwd: __dirname });
            const gitStatus = await executeSecureCommand('git', ['status', '--porcelain'], { cwd: __dirname });
            const gitBranch = await executeSecureCommand('git', ['branch', '--show-current'], { cwd: __dirname });

            if (gitLog.success && gitStatus.success && gitBranch.success) {
                diagnostic.git = {
                    commit: gitLog.stdout.trim(),
                    branch: gitBranch.stdout.trim(),
                    modified_files: gitStatus.stdout.trim().split('\n').filter(Boolean).length,
                    clean: gitStatus.stdout.trim() === ''
                };
            }
        } catch (err) {
            diagnostic.git.error = err.message;
        }

        // Frontend dist status
        try {
            const distExists = await fs.access(__dirname + '/dist').then(() => true).catch(() => false);
            if (distExists) {
                const distFiles = await fs.readdir(__dirname + '/dist');
                const assetsExists = await fs.access(__dirname + '/dist/assets').then(() => true).catch(() => false);
                let assetFiles = [];
                if (assetsExists) {
                    assetFiles = await fs.readdir(__dirname + '/dist/assets');
                }

                diagnostic.frontend = {
                    dist_exists: true,
                    dist_files: distFiles.length,
                    assets_files: assetFiles.length,
                    has_index: distFiles.includes('index.html')
                };
            } else {
                diagnostic.frontend = { dist_exists: false };
            }
        } catch (err) {
            diagnostic.frontend.error = err.message;
        }

        // Processos Node (informação básica)
        diagnostic.processes = {
            current_process_id: process.pid,
            uptime: process.uptime(),
            memory: process.memoryUsage()
        };

        // Config do servidor
        diagnostic.server = {
            port: PORT,
            env: process.env.NODE_ENV || 'production',
            uptime: process.uptime(),
            cwd: __dirname
        };

        res.json({ success: true, diagnostic });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/rebuild-frontend - Rebuild apenas do frontend
// NOTA: Este endpoint foi desabilitado por questões de segurança
app.post('/api/rebuild-frontend', async (req, res) => {
    console.log('[REBUILD] ⚠️ Endpoint desabilitado por segurança');

    res.status(403).json({
        success: false,
        error: 'Este endpoint foi desabilitado por questões de segurança',
        message: 'Por favor, execute o build diretamente no servidor',
        alternative: 'SSH: npm run build'
    });
});

// POST /api/full-sync - Git pull + npm install + build + restart
// NOTA: Este endpoint foi desabilitado por questões de segurança
app.post('/api/full-sync', async (req, res) => {
    console.log('[FULL-SYNC] ⚠️ Endpoint desabilitado por segurança');

    res.status(403).json({
        success: false,
        error: 'Este endpoint foi desabilitado por questões de segurança',
        message: 'Por favor, use o script de deploy ou acesse o servidor diretamente',
        alternatives: [
            'SSH: Execute ./deploy-update.sh',
            'Manual: git pull && npm install && npm run build && systemctl restart hmasp-chat'
        ]
    });
});

// POST /api/admin/update - Endpoint de atualização
// NOTA: Este endpoint foi desabilitado por questões de segurança
app.post('/api/admin/update', async (req, res) => {
    console.log('[ADMIN] ⚠️ Endpoint desabilitado por segurança');

    res.status(403).json({
        success: false,
        error: 'Este endpoint foi desabilitado por questões de segurança',
        message: 'Por favor, use o script de deploy ou acesse o servidor diretamente',
        alternatives: [
            'SSH: Execute ./deploy-update.sh',
            'Manual: git pull && npm install --production && systemctl restart hmasp-chat'
        ]
    });
});

// ============================================================================
// FALLBACK PARA SPA - Todas as rotas não-API servem o index.html
// ============================================================================

app.get('*', (req, res, next) => {
    // Ignora rotas de API e dashboard
    if (req.path.startsWith('/api/')) {
        return next();
    }

    // Se for arquivo HTML da pasta public (whatsapp-admin.html, etc), deixa o express.static servir
    if (req.path.endsWith('.html')) {
        return next();
    }

    // Serve o index.html do frontend (SPA)
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            console.error('[Frontend] Erro ao servir index.html:', err);
            res.status(404).send('Frontend não encontrado. Execute: npm run build');
        }
    });
});

// ============================================================================
// API - ARQUIVAMENTO DE CONFIRMAÇÕES (72h+)
// ============================================================================

const arquivamentoService = require('./server/database/arquivamento.service');

// Inicializa schema do arquivamento ao iniciar servidor
(async () => {
    try {
        await arquivamentoService.initializeSchema();
        console.log('[Arquivamento] ✅ Sistema de arquivamento inicializado');
    } catch (error) {
        console.error('[Arquivamento] ❌ Erro ao inicializar:', error);
    }
})();

// Buscar confirmações arquivadas por nome
app.get('/api/arquivamento/buscar', async (req, res) => {
    try {
        const { nome } = req.query;

        if (!nome || nome.trim().length < 2) {
            return res.status(400).json({
                success: false,
                error: 'Nome deve ter no mínimo 2 caracteres'
            });
        }

        const confirmacoes = await arquivamentoService.buscarPorNome(nome.trim());

        res.json({
            success: true,
            confirmacoes,
            total: confirmacoes.length
        });
    } catch (error) {
        console.error('[API Arquivamento] Erro ao buscar:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Buscar todas as confirmações arquivadas (paginado)
app.get('/api/arquivamento/todas', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const offset = parseInt(req.query.offset) || 0;

        const confirmacoes = await arquivamentoService.buscarTodas(limit, offset);
        const total = await arquivamentoService.contarArquivadas();

        res.json({
            success: true,
            confirmacoes,
            total,
            limit,
            offset
        });
    } catch (error) {
        console.error('[API Arquivamento] Erro ao buscar todas:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Arquivar confirmações manualmente
app.post('/api/arquivamento/arquivar', async (req, res) => {
    try {
        const { confirmacoes } = req.body;

        if (!Array.isArray(confirmacoes) || confirmacoes.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Array de confirmações é obrigatório'
            });
        }

        const resultado = await arquivamentoService.arquivarEmLote(confirmacoes);

        res.json({
            success: true,
            ...resultado
        });
    } catch (error) {
        console.error('[API Arquivamento] Erro ao arquivar:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Arquivar automaticamente confirmações antigas (72h+)
app.post('/api/arquivamento/auto-arquivar', async (req, res) => {
    try {
        const { confirmacoes } = req.body;

        if (!Array.isArray(confirmacoes)) {
            return res.status(400).json({
                success: false,
                error: 'Array de confirmações é obrigatório'
            });
        }

        const resultado = await arquivamentoService.arquivarAntigas(confirmacoes);

        res.json({
            success: true,
            ...resultado
        });
    } catch (error) {
        console.error('[API Arquivamento] Erro ao auto-arquivar:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Contar total de arquivadas
app.get('/api/arquivamento/count', async (req, res) => {
    try {
        const total = await arquivamentoService.contarArquivadas();

        res.json({
            success: true,
            total
        });
    } catch (error) {
        console.error('[API Arquivamento] Erro ao contar:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================================
// BADGES API (Sistema Multi-Usuário - SQLite)
// ============================================================================

// Buscar todos os badges ativos
app.get('/api/badges', async (req, res) => {
    try {
        const { status_badge, tipo_badge, origem } = req.query;
        const filtros = {};

        if (status_badge) filtros.status_badge = status_badge;
        if (tipo_badge) filtros.tipo_badge = tipo_badge;
        if (origem) filtros.origem = origem;

        const badges = BadgesService.getAllBadges(filtros);

        res.json({
            success: true,
            badges,
            total: badges.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[API Badges] Erro ao buscar badges:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Buscar badge específico por número da consulta
app.get('/api/badges/:consultaNumero', async (req, res) => {
    try {
        const { consultaNumero } = req.params;

        const badge = BadgesService.getBadgeByConsulta(consultaNumero);

        if (!badge) {
            return res.status(404).json({
                success: false,
                error: 'Badge não encontrado'
            });
        }

        res.json({
            success: true,
            badge
        });
    } catch (error) {
        console.error('[API Badges] Erro ao buscar badge:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Criar badge DESMARCAR (vermelho)
app.post('/api/badges/desmarcar', async (req, res) => {
    try {
        const {
            consultaNumero,
            confirmacaoId,
            telefone,
            nomePaciente,
            prontuario,
            especialidade,
            dataHoraFormatada,
            statusAnterior
        } = req.body;

        if (!consultaNumero || !telefone) {
            return res.status(400).json({
                success: false,
                error: 'consultaNumero e telefone são obrigatórios'
            });
        }

        const result = BadgesService.createBadgeDesmarcar({
            consultaNumero,
            confirmacaoId,
            telefone,
            nomePaciente,
            prontuario,
            especialidade,
            dataHoraFormatada,
            statusAnterior
        });

        console.log(`✅ Badge DESMARCAR criado: Consulta ${consultaNumero}`);

        res.json(result);
    } catch (error) {
        console.error('[API Badges] Erro ao criar badge DESMARCAR:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Criar badge REAGENDAR (vermelho)
app.post('/api/badges/reagendar', async (req, res) => {
    try {
        const {
            consultaNumero,
            confirmacaoId,
            telefone,
            nomePaciente,
            prontuario,
            especialidade,
            dataHoraFormatada,
            statusAnterior
        } = req.body;

        if (!consultaNumero || !telefone) {
            return res.status(400).json({
                success: false,
                error: 'consultaNumero e telefone são obrigatórios'
            });
        }

        const result = BadgesService.createBadgeReagendar({
            consultaNumero,
            confirmacaoId,
            telefone,
            nomePaciente,
            prontuario,
            especialidade,
            dataHoraFormatada,
            statusAnterior
        });

        console.log(`✅ Badge REAGENDAR criado: Consulta ${consultaNumero}`);

        res.json(result);
    } catch (error) {
        console.error('[API Badges] Erro ao criar badge REAGENDAR:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Atualizar badge para VERDE (ação concluída)
app.put('/api/badges/:consultaNumero/verde', async (req, res) => {
    try {
        const { consultaNumero } = req.params;
        const { operadorId, operadorNome } = req.body;

        const result = BadgesService.updateBadgeToVerde(
            consultaNumero,
            operadorId || 'sistema',
            operadorNome || 'Sistema Automático'
        );

        if (!result) {
            return res.status(404).json({
                success: false,
                error: 'Badge não encontrado'
            });
        }

        console.log(`✅ Badge atualizado para VERDE: Consulta ${consultaNumero}`);

        res.json({
            success: true,
            message: 'Badge atualizado para verde',
            consultaNumero
        });
    } catch (error) {
        console.error('[API Badges] Erro ao atualizar badge:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Atualizar badge REAGENDAR → REAGENDADA (verde) com nova consulta
app.put('/api/badges/reagendar/atualizar', async (req, res) => {
    try {
        const { consultaNumero, novaConsultaNumero } = req.body;

        if (!consultaNumero || !novaConsultaNumero) {
            return res.status(400).json({
                success: false,
                error: 'Campos obrigatórios: consultaNumero, novaConsultaNumero'
            });
        }

        const result = BadgesService.updateBadgeReagendada(consultaNumero, novaConsultaNumero);

        if (!result.success) {
            return res.status(404).json({
                success: false,
                error: result.error || 'Badge não encontrado'
            });
        }

        console.log(`✅ Badge REAGENDADA: Consulta ${consultaNumero} → Nova: ${novaConsultaNumero}`);

        res.json({
            success: true,
            message: 'Badge atualizado para REAGENDADA (verde)',
            consultaNumero,
            novaConsultaNumero,
            ...result
        });
    } catch (error) {
        console.error('[API Badges] Erro ao atualizar badge reagendada:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Marcar desmarcação como reagendada
app.put('/api/desmarcacao/:consultaNumero/reagendada', async (req, res) => {
    try {
        const { consultaNumero } = req.params;
        const { novaConsultaNumero } = req.body;

        if (!novaConsultaNumero) {
            return res.status(400).json({
                success: false,
                error: 'novaConsultaNumero é obrigatório'
            });
        }

        const result = ConsultasSQLiteService.marcarDesmarcacaoComoReagendada(
            consultaNumero,
            novaConsultaNumero
        );

        if (!result.success) {
            console.warn(`⚠️ Desmarcação não encontrada: ${consultaNumero}`);
        } else {
            console.log(`✅ Desmarcação ${consultaNumero} marcada como reagendada → Nova consulta: ${novaConsultaNumero}`);
        }

        res.json(result);
    } catch (error) {
        console.error('[API Desmarcação] Erro ao marcar como reagendada:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Deletar badge
app.delete('/api/badges/:consultaNumero', async (req, res) => {
    try {
        const { consultaNumero } = req.params;

        const result = BadgesService.deleteBadge(consultaNumero);

        if (!result) {
            return res.status(404).json({
                success: false,
                error: 'Badge não encontrado'
            });
        }

        console.log(`🗑️ Badge deletado: Consulta ${consultaNumero}`);

        res.json({
            success: true,
            message: 'Badge deletado',
            consultaNumero
        });
    } catch (error) {
        console.error('[API Badges] Erro ao deletar badge:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Buscar estatísticas dos badges
app.get('/api/badges/stats/overview', async (req, res) => {
    try {
        const stats = BadgesService.getStats();

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('[API Badges] Erro ao buscar estatísticas:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Limpar badges antigos (opcional - para manutenção)
app.post('/api/badges/cleanup', async (req, res) => {
    try {
        const { diasRetencao } = req.body;

        const result = BadgesService.deleteOldBadges(diasRetencao || 30);

        console.log(`🧹 Limpeza de badges: ${result.changes} badges removidos`);

        res.json({
            success: true,
            message: `${result.changes} badges antigos removidos`,
            badgesRemovidos: result.changes
        });
    } catch (error) {
        console.error('[API Badges] Erro ao limpar badges:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================================
// MENSAGENS WHATSAPP API (Sistema Centralizado - SQLite)
// ============================================================================

// Listar todas as mensagens ativas
app.get('/api/mensagens', async (req, res) => {
    try {
        const { fluxo, categoria, contexto } = req.query;
        let mensagens = MensagensWhatsApp.listarTodas();

        // Filtros opcionais
        if (fluxo) {
            mensagens = mensagens.filter(m => m.fluxo === fluxo);
        }
        if (categoria) {
            mensagens = mensagens.filter(m => m.categoria === categoria);
        }
        if (contexto) {
            mensagens = mensagens.filter(m => m.contexto === contexto);
        }

        res.json({
            success: true,
            mensagens,
            total: mensagens.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[API Mensagens] Erro ao listar mensagens:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Buscar mensagem por código
app.get('/api/mensagens/:codigo', async (req, res) => {
    try {
        const { codigo } = req.params;
        const mensagem = MensagensWhatsApp.getMensagem(codigo);

        if (!mensagem) {
            return res.status(404).json({
                success: false,
                error: 'Mensagem não encontrada'
            });
        }

        res.json({
            success: true,
            mensagem
        });
    } catch (error) {
        console.error('[API Mensagens] Erro ao buscar mensagem:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Atualizar texto de mensagem
app.put('/api/mensagens/:codigo', async (req, res) => {
    try {
        const { codigo } = req.params;
        const { texto, atualizadoPor } = req.body;

        if (!texto) {
            return res.status(400).json({
                success: false,
                error: 'Texto da mensagem é obrigatório'
            });
        }

        const success = MensagensWhatsApp.atualizarTexto(codigo, texto, atualizadoPor || 'admin');

        if (!success) {
            return res.status(404).json({
                success: false,
                error: 'Mensagem não encontrada ou não foi possível atualizar'
            });
        }

        res.json({
            success: true,
            message: 'Mensagem atualizada com sucesso'
        });
    } catch (error) {
        console.error('[API Mensagens] Erro ao atualizar mensagem:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Obter estatísticas de mensagens
app.get('/api/mensagens/stats/overview', async (req, res) => {
    try {
        const stats = MensagensWhatsApp.getEstatisticas();

        res.json({
            success: true,
            stats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[API Mensagens] Erro ao obter estatísticas:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Buscar mensagens por fluxo
app.get('/api/mensagens/fluxo/:fluxo', async (req, res) => {
    try {
        const { fluxo } = req.params;
        const mensagens = MensagensWhatsApp.getMensagensPorFluxo(fluxo);

        res.json({
            success: true,
            mensagens,
            total: mensagens.length
        });
    } catch (error) {
        console.error('[API Mensagens] Erro ao buscar mensagens por fluxo:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Adicionar nova mensagem
app.post('/api/mensagens', async (req, res) => {
    try {
        const mensagem = req.body;

        if (!mensagem.codigo || !mensagem.texto) {
            return res.status(400).json({
                success: false,
                error: 'Código e texto são obrigatórios'
            });
        }

        const success = MensagensWhatsApp.adicionarMensagem(mensagem);

        if (!success) {
            return res.status(400).json({
                success: false,
                error: 'Não foi possível adicionar mensagem'
            });
        }

        res.json({
            success: true,
            message: 'Mensagem adicionada com sucesso'
        });
    } catch (error) {
        console.error('[API Mensagens] Erro ao adicionar mensagem:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Desativar mensagem
app.delete('/api/mensagens/:codigo', async (req, res) => {
    try {
        const { codigo } = req.params;
        const success = MensagensWhatsApp.desativarMensagem(codigo);

        if (!success) {
            return res.status(404).json({
                success: false,
                error: 'Mensagem não encontrada'
            });
        }

        res.json({
            success: true,
            message: 'Mensagem desativada com sucesso'
        });
    } catch (error) {
        console.error('[API Mensagens] Erro ao desativar mensagem:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================================
// CONTATOS API (Agenda Integrada WhatsApp + AGHUse)
// ============================================================================

// Criar novo contato
app.post('/api/contatos', async (req, res) => {
    try {
        const id = ContatosService.criarContato(req.body);
        res.json({
            success: true,
            id,
            message: 'Contato criado com sucesso'
        });
    } catch (error) {
        console.error('[API Contatos] Erro ao criar contato:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Buscar contato por telefone
app.get('/api/contatos/telefone/:telefone', async (req, res) => {
    try {
        const { telefone } = req.params;
        const contato = ContatosService.buscarPorTelefone(telefone);

        if (!contato) {
            return res.status(404).json({
                success: false,
                error: 'Contato não encontrado'
            });
        }

        res.json({ success: true, contato });
    } catch (error) {
        console.error('[API Contatos] Erro ao buscar contato:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Buscar contato por ID
app.get('/api/contatos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const contato = ContatosService.buscarPorId(id);

        if (!contato) {
            return res.status(404).json({
                success: false,
                error: 'Contato não encontrado'
            });
        }

        res.json({ success: true, contato });
    } catch (error) {
        console.error('[API Contatos] Erro ao buscar contato:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Buscar contatos por nome
app.get('/api/contatos/buscar/:nome', async (req, res) => {
    try {
        const { nome } = req.params;
        const { limit } = req.query;
        const contatos = ContatosService.buscarPorNome(nome, limit ? parseInt(limit) : 50);

        res.json({
            success: true,
            contatos,
            total: contatos.length
        });
    } catch (error) {
        console.error('[API Contatos] Erro ao buscar contatos:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Listar todos os contatos (com paginação)
app.get('/api/contatos', async (req, res) => {
    try {
        const { offset, limit, ativo, orderBy, orderDir } = req.query;

        const opcoes = {
            offset: offset ? parseInt(offset) : 0,
            limit: limit ? parseInt(limit) : 100,
            ativo: ativo !== undefined ? ativo === 'true' : true,
            orderBy: orderBy || 'nome_completo',
            orderDir: orderDir || 'ASC'
        };

        const contatos = ContatosService.listarTodos(opcoes);

        res.json({
            success: true,
            contatos,
            total: contatos.length
        });
    } catch (error) {
        console.error('[API Contatos] Erro ao listar contatos:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Atualizar contato
app.put('/api/contatos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const success = ContatosService.atualizarContato(id, req.body);

        if (!success) {
            return res.status(404).json({
                success: false,
                error: 'Contato não encontrado ou não foi possível atualizar'
            });
        }

        res.json({
            success: true,
            message: 'Contato atualizado com sucesso'
        });
    } catch (error) {
        console.error('[API Contatos] Erro ao atualizar contato:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Desativar contato
app.delete('/api/contatos/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { motivo } = req.body;
        const success = ContatosService.desativarContato(id, motivo);

        if (!success) {
            return res.status(404).json({
                success: false,
                error: 'Contato não encontrado'
            });
        }

        res.json({
            success: true,
            message: 'Contato desativado com sucesso'
        });
    } catch (error) {
        console.error('[API Contatos] Erro ao desativar contato:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Bloquear contato
app.post('/api/contatos/:id/bloquear', async (req, res) => {
    try {
        const { id } = req.params;
        const { motivo } = req.body;

        if (!motivo) {
            return res.status(400).json({
                success: false,
                error: 'Motivo do bloqueio é obrigatório'
            });
        }

        const success = ContatosService.bloquearContato(id, motivo);

        if (!success) {
            return res.status(404).json({
                success: false,
                error: 'Contato não encontrado'
            });
        }

        res.json({
            success: true,
            message: 'Contato bloqueado com sucesso'
        });
    } catch (error) {
        console.error('[API Contatos] Erro ao bloquear contato:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Registrar interação
app.post('/api/contatos/interacoes', async (req, res) => {
    try {
        const id = ContatosService.registrarInteracao(req.body);

        if (!id) {
            return res.status(400).json({
                success: false,
                error: 'Não foi possível registrar interação'
            });
        }

        res.json({
            success: true,
            id,
            message: 'Interação registrada com sucesso'
        });
    } catch (error) {
        console.error('[API Contatos] Erro ao registrar interação:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Adicionar contato a grupo
app.post('/api/contatos/:id/grupos/:grupoId', async (req, res) => {
    try {
        const { id, grupoId } = req.params;
        const { adicionado_por } = req.body;

        const success = ContatosService.adicionarAoGrupo(
            parseInt(id),
            parseInt(grupoId),
            adicionado_por || 'sistema'
        );

        res.json({
            success,
            message: success ? 'Contato adicionado ao grupo' : 'Erro ao adicionar ao grupo'
        });
    } catch (error) {
        console.error('[API Contatos] Erro ao adicionar a grupo:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Remover contato de grupo
app.delete('/api/contatos/:id/grupos/:grupoId', async (req, res) => {
    try {
        const { id, grupoId } = req.params;
        const success = ContatosService.removerDoGrupo(parseInt(id), parseInt(grupoId));

        res.json({
            success,
            message: success ? 'Contato removido do grupo' : 'Erro ao remover do grupo'
        });
    } catch (error) {
        console.error('[API Contatos] Erro ao remover de grupo:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Listar grupos do contato
app.get('/api/contatos/:id/grupos', async (req, res) => {
    try {
        const { id } = req.params;
        const grupos = ContatosService.listarGruposDoContato(parseInt(id));

        res.json({
            success: true,
            grupos,
            total: grupos.length
        });
    } catch (error) {
        console.error('[API Contatos] Erro ao listar grupos:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Adicionar nota
app.post('/api/contatos/:id/notas', async (req, res) => {
    try {
        const { id } = req.params;
        const { nota, tipo, criado_por } = req.body;

        if (!nota) {
            return res.status(400).json({
                success: false,
                error: 'Nota é obrigatória'
            });
        }

        const notaId = ContatosService.adicionarNota(
            parseInt(id),
            nota,
            tipo || 'info',
            criado_por || 'sistema'
        );

        res.json({
            success: true,
            id: notaId,
            message: 'Nota adicionada com sucesso'
        });
    } catch (error) {
        console.error('[API Contatos] Erro ao adicionar nota:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Listar notas do contato
app.get('/api/contatos/:id/notas', async (req, res) => {
    try {
        const { id } = req.params;
        const notas = ContatosService.listarNotasDoContato(parseInt(id));

        res.json({
            success: true,
            notas,
            total: notas.length
        });
    } catch (error) {
        console.error('[API Contatos] Erro ao listar notas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Estatísticas gerais
app.get('/api/contatos/stats/geral', async (req, res) => {
    try {
        const stats = ContatosService.getEstatisticasGerais();

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('[API Contatos] Erro ao buscar estatísticas:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Contatos sem resposta
app.get('/api/contatos/relatorios/sem-resposta', async (req, res) => {
    try {
        const { limit } = req.query;
        const contatos = ContatosService.getContatosSemResposta(limit ? parseInt(limit) : 50);

        res.json({
            success: true,
            contatos,
            total: contatos.length
        });
    } catch (error) {
        console.error('[API Contatos] Erro ao buscar contatos sem resposta:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Contatos prioritários
app.get('/api/contatos/relatorios/prioritarios', async (req, res) => {
    try {
        const { limit } = req.query;
        const contatos = ContatosService.getContatosPrioritarios(limit ? parseInt(limit) : 100);

        res.json({
            success: true,
            contatos,
            total: contatos.length
        });
    } catch (error) {
        console.error('[API Contatos] Erro ao buscar contatos prioritários:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// CONSULTAS API (Sistema Multi-Usuário - SQLite)
// ============================================================================

// ========== CONSULTAS ATIVAS (Aba Confirmação) ==========

// Buscar todas as consultas ativas
app.get('/api/consultas/ativas', async (req, res) => {
    try {
        const consultas = ConsultasService.getAllConsultasAtivas();

        // 🔴 Mapeia status_geral → statusGeral para o frontend
        const consultasMapeadas = consultas.map(c => ({
            ...c,
            statusGeral: c.status_geral
        }));

        res.json({
            success: true,
            consultas: consultasMapeadas,
            total: consultasMapeadas.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[API Consultas] Erro ao buscar consultas ativas:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Buscar consulta ativa específica
app.get('/api/consultas/ativas/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const consulta = ConsultasService.getConsultaAtiva(id);

        if (!consulta) {
            return res.status(404).json({
                success: false,
                error: 'Consulta não encontrada'
            });
        }

        res.json({
            success: true,
            consulta
        });
    } catch (error) {
        console.error('[API Consultas] Erro ao buscar consulta:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Criar ou atualizar consulta ativa
app.post('/api/consultas/ativas', async (req, res) => {
    try {
        const result = ConsultasService.upsertConsultaAtiva(req.body);

        console.log(`✅ Consulta ativa salva: ${result.consultaNumero}`);

        // ✅ REAGENDAMENTO AUTOMÁTICO: Verifica se é um reagendamento
        try {
            const novaConsulta = req.body;

            // Só processa se tiver prontuário e especialidade
            if (novaConsulta.prontuario && novaConsulta.especialidade) {
                // Busca desmarcações recentes do mesmo paciente/especialidade
                const desmarcacoes = ConsultasService.getAllDesmarcacoesAtivas({});
                const now = new Date();
                const last72h = new Date(now.getTime() - 72 * 60 * 60 * 1000);

                console.log(`[Reagendamento] Verificando match para consulta ${novaConsulta.consultaNumero}`);
                console.log(`[Reagendamento]    Prontuário: ${novaConsulta.prontuario}`);
                console.log(`[Reagendamento]    Especialidade: ${novaConsulta.especialidade}`);

                // Filtra desmarcações que podem ser reagendamento
                // CORREÇÃO: Campos do banco estão em snake_case, não camelCase
                const matchedDesm = desmarcacoes.find(d => {
                    const dataDesmarcacao = new Date(d.data_desmarcacao || d.data_apareceu_dashboard || d.criado_em);
                    const dataMarcacaoNova = new Date(novaConsulta.dataMarcacao || novaConsulta.criadoEm || Date.now());

                    const samePatient = d.prontuario === novaConsulta.prontuario;
                    const sameSpecialty = d.especialidade === novaConsulta.especialidade;
                    const requestedReagendamento = d.status === 'reagendamento';
                    const notYetReagendada = !d.reagendada;
                    const within72h = dataDesmarcacao >= last72h;
                    const markedAfter = dataMarcacaoNova > dataDesmarcacao;

                    if (samePatient && sameSpecialty) {
                        console.log(`[Reagendamento]    Checando desm ${d.consulta_numero}:`);
                        console.log(`[Reagendamento]       - Mesmo paciente: ${samePatient}`);
                        console.log(`[Reagendamento]       - Mesma especialidade: ${sameSpecialty}`);
                        console.log(`[Reagendamento]       - Status reagendamento: ${requestedReagendamento} (${d.status})`);
                        console.log(`[Reagendamento]       - Não reagendada: ${notYetReagendada} (${d.reagendada})`);
                        console.log(`[Reagendamento]       - Dentro 72h: ${within72h}`);
                        console.log(`[Reagendamento]       - Marcada depois: ${markedAfter}`);
                    }

                    return samePatient && sameSpecialty && requestedReagendamento &&
                           notYetReagendada && within72h && markedAfter;
                });

                if (matchedDesm) {
                    console.log(`[Reagendamento] ✅ MATCH DETECTADO!`);
                    console.log(`[Reagendamento]    Desmarcação: ${matchedDesm.consulta_numero}`);
                    console.log(`[Reagendamento]    Nova consulta: ${novaConsulta.consultaNumero}`);
                    console.log(`[Reagendamento]    Paciente: ${novaConsulta.nomePaciente}`);
                    console.log(`[Reagendamento]    Especialidade: ${novaConsulta.especialidade}`);

                    // 1. Marca desmarcação como reagendada (badge vermelho → verde na aba Desmarcação)
                    // CORREÇÃO: Usar consulta_numero (snake_case) do banco
                    const updateResult = ConsultasService.marcarDesmarcacaoComoReagendada(
                        matchedDesm.consulta_numero,
                        novaConsulta.consultaNumero
                    );

                    if (updateResult.success) {
                        console.log(`[Reagendamento] ✅ Badge vermelho → verde atualizado na aba Desmarcação!`);
                    } else {
                        console.warn(`[Reagendamento] ⚠️ Falha ao atualizar badge na aba Desmarcação`);
                    }

                    // 2. Marca a NOVA CONSULTA como reagendamento (badge amarelo na aba Confirmação)
                    const reagendResult = ConsultasService.marcarConsultaComoReagendamento(
                        novaConsulta.consultaNumero,
                        matchedDesm.id || matchedDesm.consulta_numero,  // ID da desmarcação original
                        'desmarcacao'  // Tipo: veio de uma desmarcação
                    );

                    if (reagendResult.success) {
                        console.log(`[Reagendamento] ✅ Badge AMARELO adicionado na nova consulta!`);
                    } else {
                        console.warn(`[Reagendamento] ⚠️ Falha ao adicionar badge amarelo na nova consulta`);
                    }
                } else {
                    console.log(`[Reagendamento] Nenhum match encontrado`);
                }
            }
        } catch (reagendError) {
            console.error('[Reagendamento] Erro ao processar:', reagendError);
            // Não falha a requisição por causa desse erro
        }

        res.json(result);
    } catch (error) {
        console.error('[API Consultas] Erro ao salvar consulta:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Atualizar status de consulta
app.put('/api/consultas/ativas/:consultaNumero/status', async (req, res) => {
    try {
        const { consultaNumero } = req.params;
        const { novoStatus } = req.body;

        if (!novoStatus) {
            return res.status(400).json({
                success: false,
                error: 'novoStatus é obrigatório'
            });
        }

        const success = ConsultasService.updateConsultaStatus(consultaNumero, novoStatus);

        if (!success) {
            return res.status(404).json({
                success: false,
                error: 'Consulta não encontrada'
            });
        }

        console.log(`✅ Status atualizado: Consulta ${consultaNumero} → ${novoStatus}`);

        res.json({
            success: true,
            consultaNumero,
            novoStatus
        });
    } catch (error) {
        console.error('[API Consultas] Erro ao atualizar status:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Marcar consulta como reagendamento (badge amarelo na aba Confirmação)
// Chamado pelo badgeManager.service.js quando detecta vinculação de reagendamento
app.put('/api/consultas/ativas/:consultaNumero/marcar-reagendamento', async (req, res) => {
    try {
        const { consultaNumero } = req.params;
        const { reagendamentoDe, reagendamentoTipo } = req.body;

        if (!reagendamentoDe) {
            return res.status(400).json({
                success: false,
                error: 'reagendamentoDe é obrigatório'
            });
        }

        const result = ConsultasService.marcarConsultaComoReagendamento(
            consultaNumero,
            reagendamentoDe,
            reagendamentoTipo || 'desmarcacao'
        );

        if (result.success) {
            console.log(`✅ Consulta ${consultaNumero} marcada como REAGENDAMENTO (origem: ${reagendamentoDe})`);
        } else {
            console.warn(`⚠️ Falha ao marcar consulta ${consultaNumero} como reagendamento`);
        }

        res.json(result);
    } catch (error) {
        console.error('[API Consultas] Erro ao marcar reagendamento:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Marcar mensagem como enviada
app.put('/api/consultas/ativas/:consultaNumero/mensagem-enviada', async (req, res) => {
    try {
        const { consultaNumero } = req.params;
        const { whatsappMessageId } = req.body;

        const success = ConsultasService.markMensagemEnviada(consultaNumero, whatsappMessageId);

        if (!success) {
            return res.status(404).json({
                success: false,
                error: 'Consulta não encontrada'
            });
        }

        console.log(`✅ Mensagem marcada como enviada: Consulta ${consultaNumero}`);

        res.json({
            success: true,
            consultaNumero
        });
    } catch (error) {
        console.error('[API Consultas] Erro ao marcar mensagem:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Salvar telefones de uma confirmação
app.post('/api/consultas/telefones', async (req, res) => {
    try {
        const { consultaId, telefones } = req.body;

        if (!consultaId || !telefones) {
            return res.status(400).json({
                success: false,
                error: 'consultaId e telefones são obrigatórios'
            });
        }

        // 🔧 FIX: Adicionado await (estava faltando!)
        const result = await ConsultasService.upsertConsultaTelefones(consultaId, telefones);

        if (!result.success) {
            return res.status(400).json(result);
        }

        console.log(`📞 ${result.inserted} telefone(s) salvo(s) para confirmação ${consultaId}`);

        res.json(result);
    } catch (error) {
        console.error('[API Telefones] Erro ao salvar telefones:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Buscar telefones de uma confirmação
app.get('/api/consultas/telefones/:consultaId', async (req, res) => {
    try {
        const { consultaId } = req.params;

        // 🔧 FIX: Adicionado await (estava faltando!)
        const telefones = await ConsultasService.getConsultaTelefones(consultaId);

        res.json({
            success: true,
            consultaId,
            telefones
        });
    } catch (error) {
        console.error('[API Telefones] Erro ao buscar telefones:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Salvar telefones de uma desmarcação
app.post('/api/desmarcacoes/telefones', async (req, res) => {
    try {
        const { desmarcacaoId, telefones } = req.body;

        if (!desmarcacaoId || !telefones) {
            return res.status(400).json({
                success: false,
                error: 'desmarcacaoId e telefones são obrigatórios'
            });
        }

        // 🔧 FIX: Adicionado await (estava faltando!)
        const result = await ConsultasService.upsertDesmarcacaoTelefones(desmarcacaoId, telefones);

        if (!result.success) {
            return res.status(400).json(result);
        }

        console.log(`📞 ${result.inserted} telefone(s) salvo(s) para desmarcação ${desmarcacaoId}`);

        res.json(result);
    } catch (error) {
        console.error('[API Telefones] Erro ao salvar telefones de desmarcação:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Buscar telefones de uma desmarcação
app.get('/api/desmarcacoes/telefones/:desmarcacaoId', async (req, res) => {
    try {
        const { desmarcacaoId } = req.params;

        // 🔧 FIX: Adicionado await (estava faltando!)
        const telefones = await ConsultasService.getDesmarcacaoTelefones(desmarcacaoId);

        res.json({
            success: true,
            desmarcacaoId,
            telefones
        });
    } catch (error) {
        console.error('[API Telefones] Erro ao buscar telefones de desmarcação:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Arquivar consulta
app.post('/api/consultas/ativas/:id/arquivar', async (req, res) => {
    try {
        const { id } = req.params;
        const { motivo, arquivadoPor } = req.body;

        const success = ConsultasService.arquivarConsulta(id, motivo, arquivadoPor);

        if (!success) {
            return res.status(404).json({
                success: false,
                error: 'Consulta não encontrada'
            });
        }

        console.log(`📦 Consulta arquivada: ${id}`);

        res.json({
            success: true,
            id,
            motivo
        });
    } catch (error) {
        console.error('[API Consultas] Erro ao arquivar:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Deletar consulta
app.delete('/api/consultas/ativas/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const success = ConsultasService.deleteConsultaAtiva(id);

        if (!success) {
            return res.status(404).json({
                success: false,
                error: 'Consulta não encontrada'
            });
        }

        console.log(`🗑️ Consulta deletada: ${id}`);

        res.json({
            success: true,
            id
        });
    } catch (error) {
        console.error('[API Consultas] Erro ao deletar:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ========== DESMARCAÇÕES ATIVAS (Aba Desmarcação) ==========

// Buscar todas as desmarcações ativas
app.get('/api/desmarcacoes/ativas', async (req, res) => {
    try {
        const { tipoDesmarcacao, veioDeConfirmacao } = req.query;
        const filtros = {};

        if (tipoDesmarcacao) filtros.tipoDesmarcacao = tipoDesmarcacao;
        if (veioDeConfirmacao !== undefined) filtros.veioDeConfirmacao = veioDeConfirmacao === 'true';

        const desmarcacoes = ConsultasService.getAllDesmarcacoesAtivas(filtros);

        res.json({
            success: true,
            desmarcacoes,
            total: desmarcacoes.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[API Desmarcações] Erro ao buscar desmarcações:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Criar ou atualizar desmarcação ativa
app.post('/api/desmarcacoes/ativas', async (req, res) => {
    try {
        const result = ConsultasService.upsertDesmarcacaoAtiva(req.body);

        // 🔍 DETECÇÃO: Verifica se essa desmarcação corresponde a uma consulta com badge vermelho
        // Se sim, muda status para 'cancelled' (badge verde "Desmarcada")
        if (result.consultaNumero) {
            const matchResult = ConsultasService.detectarDesmarcacaoEAtualizarBadge(result.consultaNumero);

            if (matchResult.matched && matchResult.success) {
                console.log(`[Desmarcação] ✅ Badge VERMELHO → VERDE para consulta ${result.consultaNumero}`);
                if (matchResult.eraReagendamento) {
                    console.log(`[Desmarcação]    Era reagendamento de: ${matchResult.reagendamentoDe}`);
                }
            }
        }

        res.json(result);
    } catch (error) {
        console.error('[API Desmarcações] Erro ao salvar desmarcação:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Arquivar desmarcação
app.post('/api/desmarcacoes/ativas/:id/arquivar', async (req, res) => {
    try {
        const { id } = req.params;
        const { motivo, arquivadoPor } = req.body;

        const success = ConsultasService.arquivarDesmarcacao(id, motivo, arquivadoPor);

        if (!success) {
            return res.status(404).json({
                success: false,
                error: 'Desmarcação não encontrada'
            });
        }

        console.log(`📦 Desmarcação arquivada: ${id}`);

        res.json({
            success: true,
            id,
            motivo
        });
    } catch (error) {
        console.error('[API Desmarcações] Erro ao arquivar:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 🔧 FIX: Marcar mensagem de desmarcação como enviada
app.put('/api/desmarcacoes/ativas/:id/mensagem-enviada', async (req, res) => {
    try {
        const { id } = req.params;
        const { whatsappMessageId } = req.body;

        // Atualiza flag mensagem_enviada na desmarcação
        const db = require('better-sqlite3')(path.join(__dirname, 'server', 'database', 'hmasp_consultas.db'));
        const stmt = db.prepare(`
            UPDATE desmarcacoes_ativas
            SET mensagem_enviada = 1,
                data_envio = datetime('now'),
                whatsapp_message_id = ?,
                atualizado_em = datetime('now')
            WHERE id = ?
        `);

        const result = stmt.run(whatsappMessageId, id);
        db.close();

        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                error: 'Desmarcação não encontrada'
            });
        }

        console.log(`✅ Mensagem marcada como enviada: Desmarcação ${id}`);

        res.json({
            success: true,
            id,
            whatsappMessageId
        });
    } catch (error) {
        console.error('[API Desmarcações] Erro ao marcar mensagem:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Deletar desmarcação
app.delete('/api/desmarcacoes/ativas/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const success = ConsultasService.deleteDesmarcacaoAtiva(id);

        if (!success) {
            return res.status(404).json({
                success: false,
                error: 'Desmarcação não encontrada'
            });
        }

        console.log(`🗑️ Desmarcação deletada: ${id}`);

        res.json({
            success: true,
            id
        });
    } catch (error) {
        console.error('[API Desmarcações] Erro ao deletar:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ========== CONSULTAS ARQUIVADAS ==========

// Buscar consultas arquivadas
app.get('/api/consultas/arquivadas', async (req, res) => {
    try {
        const { limite } = req.query;
        const consultas = ConsultasService.getConsultasArquivadas(limite ? parseInt(limite) : 100);

        res.json({
            success: true,
            consultas,
            total: consultas.length
        });
    } catch (error) {
        console.error('[API Consultas] Erro ao buscar arquivadas:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ========== ESTATÍSTICAS ==========

// Estatísticas de confirmações
app.get('/api/consultas/stats/confirmacoes', async (req, res) => {
    try {
        const stats = ConsultasService.getStatsConfirmacoes();

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('[API Consultas] Erro ao buscar estatísticas:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Estatísticas de desmarcações
app.get('/api/consultas/stats/desmarcacoes', async (req, res) => {
    try {
        const stats = ConsultasService.getStatsDesmarcacoes();

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('[API Consultas] Erro ao buscar estatísticas:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================================
// API RESPOSTAS WHATSAPP (SQLite Multi-Usuário)
// ============================================================================

// Buscar todas as respostas ativas
app.get('/api/whatsapp-respostas/ativas', async (req, res) => {
    try {
        const { processada, contexto, status } = req.query;

        const filtros = {};
        if (processada !== undefined) filtros.processada = processada === 'true';
        if (contexto) filtros.contexto = contexto;
        if (status) filtros.status = status;

        const respostas = WhatsAppRespostasService.getAllRespostas(filtros);

        res.json({
            success: true,
            respostas,
            total: respostas.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[API WhatsApp Respostas] Erro ao buscar respostas:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Buscar respostas pendentes (não processadas)
app.get('/api/whatsapp-respostas/pendentes', async (req, res) => {
    try {
        const respostas = WhatsAppRespostasService.getRespostasPendentes();

        res.json({
            success: true,
            respostas,
            total: respostas.length,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[API WhatsApp Respostas] Erro ao buscar pendentes:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Marcar resposta como processada
app.put('/api/whatsapp-respostas/:id/processar', async (req, res) => {
    try {
        const { id } = req.params;

        const success = WhatsAppRespostasService.marcarComoProcessada(parseInt(id));

        if (!success) {
            return res.status(404).json({
                success: false,
                error: 'Resposta não encontrada'
            });
        }

        console.log(`✅ Resposta marcada como processada: ${id}`);

        res.json({
            success: true,
            id
        });
    } catch (error) {
        console.error('[API WhatsApp Respostas] Erro ao processar:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Arquivar resposta
app.post('/api/whatsapp-respostas/:id/arquivar', async (req, res) => {
    try {
        const { id } = req.params;
        const { motivo } = req.body;

        const success = WhatsAppRespostasService.arquivarResposta(parseInt(id), motivo);

        if (!success) {
            return res.status(404).json({
                success: false,
                error: 'Resposta não encontrada'
            });
        }

        console.log(`📦 Resposta arquivada: ${id}`);

        res.json({
            success: true,
            id,
            motivo
        });
    } catch (error) {
        console.error('[API WhatsApp Respostas] Erro ao arquivar:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Limpar respostas processadas
app.delete('/api/whatsapp-respostas/processadas', async (req, res) => {
    try {
        const deletados = WhatsAppRespostasService.limparProcessadas();

        console.log(`🗑️ ${deletados} respostas processadas removidas`);

        res.json({
            success: true,
            deletados
        });
    } catch (error) {
        console.error('[API WhatsApp Respostas] Erro ao limpar:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Buscar histórico de respostas
app.get('/api/whatsapp-respostas/historico', async (req, res) => {
    try {
        const { limite } = req.query;
        const historico = WhatsAppRespostasService.getHistorico(limite ? parseInt(limite) : 100);

        res.json({
            success: true,
            historico,
            total: historico.length
        });
    } catch (error) {
        console.error('[API WhatsApp Respostas] Erro ao buscar histórico:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Estatísticas de respostas
app.get('/api/whatsapp-respostas/stats', async (req, res) => {
    try {
        const stats = WhatsAppRespostasService.getStats();

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('[API WhatsApp Respostas] Erro ao buscar estatísticas:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================

// Cria servidor HTTP e armazena referência para graceful shutdown
httpServer = app.listen(PORT, '0.0.0.0', () => {
    logger.info('============================================');
    logger.info('  HMASP Chat - Servidor WhatsApp');
    logger.info('  Localização: HMASP São Paulo');
    logger.info('============================================');
    logger.info(`Servidor: http://localhost:${PORT}`);
    logger.info('============================================');

    // Inicializa sistema de Badges (SQLite Multi-Usuário)
    try {
        BadgesService.init();
        console.log('✅ Sistema de Badges inicializado (SQLite)');
    } catch (error) {
        console.error('❌ Erro ao inicializar sistema de Badges:', error);
    }

    // Inicializa sistema de Consultas (SQLite Multi-Usuário)
    try {
        ConsultasService.init();
        console.log('✅ Sistema de Consultas inicializado (SQLite)');
    } catch (error) {
        console.error('❌ Erro ao inicializar sistema de Consultas:', error);
    }

    // Inicializa sistema de Respostas WhatsApp (SQLite Multi-Usuário)
    try {
        WhatsAppRespostasService.init();
        console.log('✅ Sistema de Respostas WhatsApp inicializado (SQLite)');
    } catch (error) {
        console.error('❌ Erro ao inicializar sistema de Respostas WhatsApp:', error);
    }

    // Inicializa sistema de Mensagens WhatsApp Centralizadas (SQLite Multi-Usuário)
    try {
        MensagensWhatsApp.initialize();
        console.log('✅ Sistema de Mensagens WhatsApp Centralizadas inicializado (SQLite)');
    } catch (error) {
        console.error('❌ Erro ao inicializar sistema de Mensagens WhatsApp:', error);
    }

    // Inicializa sistema de Contextos de Chat (SQLite Thread-Safe)
    try {
        ChatContextosService.initialize();
        console.log('✅ Sistema de Contextos de Chat inicializado (SQLite)');

        // Limpeza inicial de contextos expirados
        const removed = ChatContextosService.cleanupExpiredContextos();
        if (removed > 0) {
            console.log(`   🧹 ${removed} contextos expirados removidos na inicialização`);
        }

        const stats = ChatContextosService.getStats();
        console.log(`   📊 Estatísticas: ${stats.ativos} ativos, ${stats.expirados} expirados, ${stats.total} total`);
    } catch (error) {
        console.error('❌ Erro ao inicializar sistema de Contextos:', error);
    }

    // Inicializa sistema de Chat Proprio (Meu HMASP)
    try {
        ChatService.initialize();
        console.log('✅ Sistema de Chat Proprio inicializado (SQLite)');
    } catch (error) {
        console.error('❌ Erro ao inicializar sistema de Chat:', error);
    }

    // Inicializa WhatsApp
    initializeWhatsApp();

    // ============================================================================
    // LIMPEZA PERIÓDICA DE CONTEXTOS EXPIRADOS (SQLite Thread-Safe)
    // ============================================================================
    setInterval(() => {
        try {
            const removed = ChatContextosService.cleanupExpiredContextos();
            if (removed > 0) {
                console.log(`[ChatContextos] 🧹 Limpeza: ${removed} contextos expirados removidos do SQLite`);
            }
        } catch (error) {
            console.error('[ChatContextos] ❌ Erro na limpeza periódica:', error.message);
        }
    }, 15 * 60 * 1000); // A cada 15 minutos (otimizado para reduzir memory leak)

    // Abre as três interfaces automaticamente
    setTimeout(() => {
        const { execFile } = require('child_process');
        const os = require('os');
        console.log('');
        console.log('🌐 Abrindo interfaces no navegador...');
        console.log('   1️⃣  Interface Principal (Usuários - Visualização)');
        console.log('   2️⃣  Interface Admin (VM Ubuntu - Envio Automático)');
        console.log('   3️⃣  WhatsApp Admin (Status/QR Code)');

        // Função segura para abrir URLs
        const openUrl = (url) => {
            const platform = os.platform();
            let command, args;

            if (platform === 'win32') {
                command = 'cmd.exe';
                args = ['/c', 'start', url];
            } else if (platform === 'darwin') {
                command = 'open';
                args = [url];
            } else {
                command = 'xdg-open';
                args = [url];
            }

            execFile(command, args, (error) => {
                if (error) console.error(`❌ Erro ao abrir ${url}:`, error.message);
            });
        };

        // Abre Interface Principal (Usuários)
        openUrl(`http://localhost:${PORT}/`);

        // Abre Interface Admin (VM - Envio Automático) após 1 segundo
        setTimeout(() => openUrl(`http://localhost:${PORT}/admin.html`), 1000);

        // Abre WhatsApp Admin (Status/QR) após 2 segundos
        setTimeout(() => openUrl(`http://localhost:${PORT}/whatsapp-admin.html`), 2000);
    }, 2000); // Aguarda 2 segundos para garantir que o servidor está pronto
});

// ============================================================================
// GRACEFUL SHUTDOWN - Encerramento Seguro
// ============================================================================

async function gracefulShutdown(signal) {
    if (isShuttingDown) {
        logger.warn(`[Shutdown] Já está encerrando, ignorando sinal ${signal}`);
        return;
    }

    isShuttingDown = true;
    logger.info(`[Shutdown] Sinal ${signal} recebido, encerrando gracefully...`);

    // 1. Para de aceitar novas conexões
    if (httpServer) {
        httpServer.close(() => {
            logger.info('[Shutdown] Servidor HTTP encerrado');
        });
    }

    try {
        // 2. Fecha WhatsApp Client
        if (whatsappClient) {
            logger.info('[Shutdown] Encerrando WhatsApp Client...');
            stopHeartbeat();
            await whatsappClient.destroy().catch(err => {
                logger.error('[Shutdown] Erro ao encerrar WhatsApp', err);
            });
            logger.info('[Shutdown] WhatsApp Client encerrado');
        }

        // 3. Fecha pool PostgreSQL
        logger.info('[Shutdown] Encerrando pool PostgreSQL...');
        await aghuse.closeConnection().catch(err => {
            logger.error('[Shutdown] Erro ao encerrar PostgreSQL', err);
        });
        logger.info('[Shutdown] PostgreSQL encerrado');

        // 4. Fecha bancos SQLite (não precisam de close explícito, mas limpa recursos)
        logger.info('[Shutdown] Limpando recursos SQLite...');
        // SQLite fecha automaticamente quando process termina

        logger.info('[Shutdown] ✅ Shutdown completo com sucesso');
        process.exit(0);

    } catch (error) {
        logger.error('[Shutdown] Erro durante shutdown', error);
        process.exit(1);
    }
}

// Registra handlers de shutdown
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT')); // Ctrl+C
process.on('SIGHUP', () => gracefulShutdown('SIGHUP'));

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
    logger.error('[FATAL] Exceção não capturada', error);

    // Em produção, faz shutdown graceful
    if (process.env.NODE_ENV === 'production') {
        gracefulShutdown('uncaughtException');
    } else {
        // Em dev, mostra stack trace completo
        console.error('[ERRO]', error);
    }
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('[FATAL] Promise rejection não tratada', { reason, promise });

    // Em produção, faz shutdown graceful
    if (process.env.NODE_ENV === 'production') {
        gracefulShutdown('unhandledRejection');
    } else {
        // Em dev, mostra detalhes
        console.error('[ERRO]', reason);
    }
});
