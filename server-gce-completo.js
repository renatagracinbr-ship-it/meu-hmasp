/**
 * Servidor Completo HMASP Chat - Google Compute Engine
 *
 * Roda TUDO na nuvem:
 * - WhatsApp Web.js (porta 3000)
 * - AGHUse PostgreSQL (porta 3000, endpoints /api/aghuse/*)
 *
 * Benefícios:
 * ✅ Zero configuração local
 * ✅ Usuário só precisa de navegador + VPN (para AGHUse)
 * ✅ Custo: $0.00 (Free Tier)
 */

const express = require('express');
const cors = require('cors');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = 3000;

// ============================================================================
// MIDDLEWARES
// ============================================================================

app.use(cors());
app.use(express.json());

// ============================================================================
// CONFIGURAÇÃO POSTGRESQL - AGHUse
// ============================================================================

const DB_CONFIG = {
    host: '10.12.40.219',
    port: 5432,
    database: 'dbaghu',
    user: 'birm_read',
    password: 'birm@read',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
};

let pgPool = null;

/**
 * Obtém ou cria o pool de conexões PostgreSQL
 */
function getPostgresPool() {
    if (!pgPool) {
        pgPool = new Pool(DB_CONFIG);
        pgPool.on('error', (err) => {
            console.error('[AGHUse] Erro no pool de conexões:', err);
        });
        console.log('[AGHUse] Pool de conexões PostgreSQL criado');
    }
    return pgPool;
}

// ============================================================================
// WHATSAPP - CONFIGURAÇÃO
// ============================================================================

let whatsappClient = null;
let isReady = false;
let qrCodeData = null;

/**
 * Inicializa o cliente WhatsApp
 */
function initializeWhatsApp() {
    if (whatsappClient) {
        console.log('[WhatsApp] Cliente já existe');
        return;
    }

    console.log('[WhatsApp] Inicializando cliente...');

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
                '--disable-gpu',
                '--disable-software-rasterizer',
                '--disable-dev-tools'
            ]
        }
    });

    // Evento: QR Code
    whatsappClient.on('qr', async (qr) => {
        console.log('[WhatsApp] QR Code recebido!');
        console.log('[WhatsApp] Acesse http://136.118.10.24:3000 para escanear');
        try {
            qrCodeData = await qrcode.toDataURL(qr);
        } catch (err) {
            console.error('[WhatsApp] Erro ao gerar QR Code:', err);
        }
    });

    // Evento: Autenticado
    whatsappClient.on('authenticated', () => {
        console.log('[WhatsApp] ✓ Autenticado com sucesso!');
        qrCodeData = null;
    });

    // Evento: Pronto
    whatsappClient.on('ready', () => {
        console.log('[WhatsApp] ✓ Cliente pronto e conectado!');
        isReady = true;
        qrCodeData = null;
    });

    // Evento: Desconectado
    whatsappClient.on('disconnected', (reason) => {
        console.log('[WhatsApp] ✗ Desconectado:', reason);
        isReady = false;
        whatsappClient = null;
        setTimeout(initializeWhatsApp, 5000);
    });

    // Evento: Erro de autenticação
    whatsappClient.on('auth_failure', (error) => {
        console.error('[WhatsApp] ✗ Falha na autenticação:', error);
        qrCodeData = null;
    });

    whatsappClient.initialize();
}

// ============================================================================
// API - WHATSAPP
// ============================================================================

app.get('/api/status', (req, res) => {
    res.json({
        isReady: isReady,
        hasQr: qrCodeData !== null,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/qr', (req, res) => {
    if (qrCodeData) {
        res.json({ qr: qrCodeData });
    } else if (isReady) {
        res.json({ qr: null, message: 'Já autenticado' });
    } else {
        res.json({ qr: null, message: 'Aguardando QR Code...' });
    }
});

app.get('/api/chats', async (req, res) => {
    try {
        if (!isReady) {
            return res.status(503).json({ success: false, error: 'WhatsApp não está conectado' });
        }

        const chats = await whatsappClient.getChats();
        const chatList = chats.map(chat => ({
            id: chat.id._serialized,
            name: chat.name || chat.id.user,
            isGroup: chat.isGroup,
            unreadCount: chat.unreadCount,
            timestamp: chat.timestamp,
            lastMessage: chat.lastMessage ? {
                body: chat.lastMessage.body,
                timestamp: chat.lastMessage.timestamp,
                fromMe: chat.lastMessage.fromMe
            } : null
        }));

        res.json({ success: true, chats: chatList });
    } catch (error) {
        console.error('[API] Erro ao buscar chats:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/api/messages/:chatId', async (req, res) => {
    try {
        if (!isReady) {
            return res.status(503).json({ success: false, error: 'WhatsApp não está conectado' });
        }

        const { chatId } = req.params;
        const limit = parseInt(req.query.limit) || 50;

        const chat = await whatsappClient.getChatById(chatId);
        const messages = await chat.fetchMessages({ limit });

        const messageList = messages.map(msg => ({
            id: msg.id._serialized,
            body: msg.body,
            timestamp: msg.timestamp,
            fromMe: msg.fromMe,
            hasMedia: msg.hasMedia,
            type: msg.type,
            author: msg.author || msg.from
        }));

        res.json({ success: true, messages: messageList });
    } catch (error) {
        console.error('[API] Erro ao buscar mensagens:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/send', async (req, res) => {
    try {
        if (!isReady) {
            return res.status(503).json({ error: 'WhatsApp não está conectado' });
        }

        const { to, message } = req.body;

        if (!to || !message) {
            return res.status(400).json({ error: 'Campos "to" e "message" são obrigatórios' });
        }

        const sentMessage = await whatsappClient.sendMessage(to, message);

        res.json({
            success: true,
            messageId: sentMessage.id._serialized,
            timestamp: sentMessage.timestamp
        });
    } catch (error) {
        console.error('[API] Erro ao enviar mensagem:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/read/:chatId', async (req, res) => {
    try {
        if (!isReady) {
            return res.status(503).json({ error: 'WhatsApp não está conectado' });
        }

        const { chatId } = req.params;
        const chat = await whatsappClient.getChatById(chatId);
        await chat.sendSeen();

        res.json({ success: true });
    } catch (error) {
        console.error('[API] Erro ao marcar como lido:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/logout', async (req, res) => {
    try {
        if (whatsappClient) {
            await whatsappClient.logout();
            whatsappClient = null;
            isReady = false;
            qrCodeData = null;
        }
        res.json({ success: true });
    } catch (error) {
        console.error('[API] Erro ao fazer logout:', error);
        res.status(500).json({ error: error.message });
    }
});

// ============================================================================
// API - AGHUse (PostgreSQL)
// ============================================================================

/**
 * Testa conexão com o banco AGHUse
 */
app.get('/api/aghuse/test-connection', async (req, res) => {
    try {
        const pool = getPostgresPool();
        const result = await pool.query('SELECT NOW() as current_time, version() as version');

        console.log('[AGHUse] Conexão OK:', result.rows[0]);

        res.json({
            success: true,
            timestamp: result.rows[0].current_time,
            version: result.rows[0].version,
            message: 'Conexão com AGHUse estabelecida via VPN/Intranet'
        });
    } catch (error) {
        console.error('[AGHUse] Erro ao testar conexão:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            hint: 'Certifique-se de estar conectado à VPN ou na rede do hospital'
        });
    }
});

/**
 * Busca consultas marcadas recentemente
 */
app.get('/api/aghuse/recent-appointments', async (req, res) => {
    try {
        const minutes = parseInt(req.query.minutes) || 5;
        const pool = getPostgresPool();

        const query = `
            SELECT
                c.numero AS consulta_numero,
                p.codigo AS pac_codigo,
                p.prontuario,
                p.nome AS nome_paciente,
                p.dt_nascimento,
                pf.ddd_fone_residencial,
                pf.fone_residencial,
                pf.ddd_fone_celular,
                pf.fone_celular,
                pf.ddd_fone_comercial,
                pf.fone_comercial,
                e.nome_especialidade AS especialidade,
                c.dt_consulta AS data_hora_consulta,
                srv.nome AS profissional_nome,
                u.descricao AS local_descricao,
                c.criado_em AS data_hora_marcacao,
                sac.codigo AS situacao_codigo,
                sac.descricao AS situacao_descricao
            FROM
                agh.aac_consultas c
                INNER JOIN agh.aip_pacientes p ON c.pac_codigo = p.codigo
                LEFT JOIN agh.aip_pacientes_fones pf ON p.codigo = pf.pac_codigo
                LEFT JOIN agh.agh_especialidades e ON c.esp_seq = e.seq
                LEFT JOIN agh.rap_servidores srv ON c.srv_matricula = srv.matricula AND c.srv_vin_codigo = srv.vin_codigo
                LEFT JOIN agh.agh_unidades_funcionais u ON c.unf_seq = u.seq
                LEFT JOIN agh.aac_situacao_consultas sac ON c.sit_codigo = sac.codigo
            WHERE
                c.criado_em >= NOW() - INTERVAL '${minutes} minutes'
                AND sac.codigo = 'A'
            ORDER BY
                c.criado_em DESC
            LIMIT 100
        `;

        const result = await pool.query(query);

        console.log(`[AGHUse] Encontradas ${result.rows.length} consultas nos últimos ${minutes} minutos`);

        res.json({
            success: true,
            appointments: result.rows,
            count: result.rows.length,
            minutes: minutes
        });
    } catch (error) {
        console.error('[AGHUse] Erro ao buscar consultas:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            hint: 'Certifique-se de estar conectado à VPN ou na rede do hospital'
        });
    }
});

// ============================================================================
// PÁGINA INICIAL
// ============================================================================

app.get('/', (req, res) => {
    const whatsappStatus = isReady ? '✅ Conectado' : (qrCodeData ? '🔄 Aguardando QR Code' : '⏳ Inicializando');

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>HMASP Chat - Servidor Cloud</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    max-width: 900px;
                    margin: 50px auto;
                    padding: 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    min-height: 100vh;
                }
                .container {
                    background: white;
                    padding: 40px;
                    border-radius: 20px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                }
                h1 {
                    color: #333;
                    border-bottom: 4px solid #667eea;
                    padding-bottom: 15px;
                    margin-bottom: 30px;
                }
                .status-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                    margin: 30px 0;
                }
                .status-card {
                    background: #f8f9fa;
                    padding: 20px;
                    border-radius: 10px;
                    border-left: 4px solid #667eea;
                }
                .status-card h3 {
                    margin: 0 0 10px 0;
                    color: #667eea;
                    font-size: 14px;
                    text-transform: uppercase;
                }
                .status-card .value {
                    font-size: 24px;
                    font-weight: bold;
                    color: #333;
                }
                .endpoint {
                    background: #f9f9f9;
                    padding: 15px;
                    margin: 10px 0;
                    border-left: 4px solid #4CAF50;
                    border-radius: 5px;
                    font-family: 'Courier New', monospace;
                }
                .endpoint code {
                    color: #d63031;
                    background: #fff;
                    padding: 3px 8px;
                    border-radius: 3px;
                    font-size: 14px;
                }
                .badge {
                    display: inline-block;
                    padding: 5px 15px;
                    border-radius: 20px;
                    font-weight: bold;
                    font-size: 14px;
                }
                .badge-success { background: #4CAF50; color: white; }
                .badge-warning { background: #FF9800; color: white; }
                .badge-info { background: #2196F3; color: white; }
                .qr-container {
                    text-align: center;
                    margin: 30px 0;
                    padding: 20px;
                    background: #f8f9fa;
                    border-radius: 10px;
                }
                .qr-container img {
                    max-width: 300px;
                    border: 3px solid #667eea;
                    border-radius: 10px;
                }
                .info-section {
                    background: #e3f2fd;
                    padding: 20px;
                    border-radius: 10px;
                    margin: 20px 0;
                    border-left: 4px solid #2196F3;
                }
                .info-section h3 {
                    margin-top: 0;
                    color: #1976d2;
                }
            </style>
            ${qrCodeData ? '<meta http-equiv="refresh" content="5">' : ''}
        </head>
        <body>
            <div class="container">
                <h1>🏥 HMASP Chat - Servidor Cloud</h1>

                <div class="status-grid">
                    <div class="status-card">
                        <h3>WhatsApp</h3>
                        <div class="value">${whatsappStatus}</div>
                    </div>
                    <div class="status-card">
                        <h3>Servidor</h3>
                        <div class="value">✅ Online</div>
                    </div>
                    <div class="status-card">
                        <h3>IP Estático</h3>
                        <div class="value">136.118.10.24</div>
                    </div>
                    <div class="status-card">
                        <h3>Porta</h3>
                        <div class="value">:${PORT}</div>
                    </div>
                </div>

                ${qrCodeData ? `
                <div class="qr-container">
                    <h2>📱 Conectar WhatsApp</h2>
                    <p>Escaneie o QR Code com o WhatsApp do celular</p>
                    <img src="${qrCodeData}" alt="QR Code">
                    <p style="color: #666; margin-top: 15px;">Página atualiza automaticamente a cada 5 segundos</p>
                </div>
                ` : ''}

                <div class="info-section">
                    <h3>ℹ️ Informações do Sistema</h3>
                    <p><strong>Localização:</strong> Google Cloud (Oregon, EUA)</p>
                    <p><strong>Tipo:</strong> VM e2-micro (Free Tier)</p>
                    <p><strong>Custo:</strong> $0.00/mês</p>
                    <p><strong>Uptime:</strong> 24/7</p>
                </div>

                <h2>📡 Endpoints Disponíveis</h2>

                <h3>WhatsApp:</h3>
                <div class="endpoint">
                    <span class="badge badge-success">GET</span> <code>/api/status</code> - Status do WhatsApp
                </div>
                <div class="endpoint">
                    <span class="badge badge-success">GET</span> <code>/api/qr</code> - QR Code
                </div>
                <div class="endpoint">
                    <span class="badge badge-success">GET</span> <code>/api/chats</code> - Lista de conversas
                </div>
                <div class="endpoint">
                    <span class="badge badge-success">GET</span> <code>/api/messages/:chatId</code> - Mensagens
                </div>
                <div class="endpoint">
                    <span class="badge badge-warning">POST</span> <code>/api/send</code> - Enviar mensagem
                </div>

                <h3>AGHUse (Requer VPN/Intranet):</h3>
                <div class="endpoint">
                    <span class="badge badge-success">GET</span> <code>/api/aghuse/test-connection</code> - Testar conexão
                </div>
                <div class="endpoint">
                    <span class="badge badge-success">GET</span> <code>/api/aghuse/recent-appointments</code> - Consultas recentes
                </div>

                <div class="info-section" style="background: #fff3cd; border-left-color: #ff9800;">
                    <h3>⚠️ Importante - AGHUse</h3>
                    <p>Os endpoints do AGHUse só funcionam quando você está:</p>
                    <ul>
                        <li>Conectado à <strong>VPN do hospital</strong>, ou</li>
                        <li>Na <strong>rede interna (intranet)</strong> do HMASP</li>
                    </ul>
                    <p>O servidor está na nuvem, mas acessa o banco de dados interno via sua conexão VPN.</p>
                </div>
            </div>
        </body>
        </html>
    `);
});

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        services: {
            whatsapp: isReady ? 'connected' : 'disconnected',
            server: 'running'
        },
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================

app.listen(PORT, '0.0.0.0', () => {
    console.log('============================================');
    console.log('  HMASP Chat - Servidor Cloud Completo');
    console.log('============================================');
    console.log(`✓ Servidor rodando em: http://136.118.10.24:${PORT}`);
    console.log('');
    console.log('✓ Serviços disponíveis:');
    console.log('  - WhatsApp Web.js');
    console.log('  - AGHUse PostgreSQL (via VPN/Intranet)');
    console.log('');
    console.log('✓ Acesse no navegador:');
    console.log(`  http://136.118.10.24:${PORT}`);
    console.log('============================================');
    console.log('');

    // Inicializa WhatsApp
    initializeWhatsApp();
});

// Tratamento de erros
process.on('uncaughtException', (error) => {
    console.error('[ERRO] Exceção não capturada:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[ERRO] Promise rejeitada:', reason);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('[Sistema] Recebido SIGTERM, encerrando gracefully...');
    if (pgPool) {
        await pgPool.end();
    }
    process.exit(0);
});
