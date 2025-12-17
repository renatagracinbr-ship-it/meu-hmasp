/**
 * Servidor Completo HMASP Chat - Google Compute Engine
 */

const express = require('express');
const cors = require('cors');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Configuração PostgreSQL - AGHUse
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

function getPostgresPool() {
    if (!pgPool) {
        pgPool = new Pool(DB_CONFIG);
        pgPool.on('error', (err) => {
            console.error('[AGHUse] Erro no pool:', err);
        });
        console.log('[AGHUse] Pool criado');
    }
    return pgPool;
}

// WhatsApp
let whatsappClient = null;
let isReady = false;
let qrCodeData = null;

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
            executablePath: '/usr/bin/chromium-browser',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-software-rasterizer'
            ]
        }
    });

    whatsappClient.on('qr', async (qr) => {
        console.log('[WhatsApp] QR Code recebido!');
        try {
            qrCodeData = await qrcode.toDataURL(qr);
        } catch (err) {
            console.error('[WhatsApp] Erro ao gerar QR:', err);
        }
    });

    whatsappClient.on('authenticated', () => {
        console.log('[WhatsApp] Autenticado!');
        qrCodeData = null;
    });

    whatsappClient.on('ready', () => {
        console.log('[WhatsApp] Pronto!');
        isReady = true;
        qrCodeData = null;
    });

    whatsappClient.on('disconnected', (reason) => {
        console.log('[WhatsApp] Desconectado:', reason);
        isReady = false;
        whatsappClient = null;
        setTimeout(initializeWhatsApp, 5000);
    });

    whatsappClient.initialize();
}

// API - WhatsApp
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
        res.json({ qr: null, message: 'Aguardando QR...' });
    }
});

app.get('/api/chats', async (req, res) => {
    try {
        if (!isReady) {
            return res.status(503).json({ success: false, error: 'WhatsApp não conectado' });
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
            return res.status(503).json({ success: false, error: 'WhatsApp não conectado' });
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
            return res.status(503).json({ error: 'WhatsApp não conectado' });
        }

        const { to, message } = req.body;
        if (!to || !message) {
            return res.status(400).json({ error: 'Campos obrigatórios' });
        }

        const sentMessage = await whatsappClient.sendMessage(to, message);
        res.json({
            success: true,
            messageId: sentMessage.id._serialized,
            timestamp: sentMessage.timestamp
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/read/:chatId', async (req, res) => {
    try {
        if (!isReady) {
            return res.status(503).json({ success: false, error: 'WhatsApp não conectado' });
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

// API - AGHUse
app.get('/api/aghuse/test-connection', async (req, res) => {
    try {
        const pool = getPostgresPool();
        const result = await pool.query('SELECT NOW() as current_time');
        res.json({
            success: true,
            timestamp: result.rows[0].current_time
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Página inicial
app.get('/', (req, res) => {
    const status = isReady ? '✅ Conectado' : (qrCodeData ? '🔄 QR Code' : '⏳ Iniciando');

    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>HMASP Chat - Cloud</title>
            <style>
                body { font-family: Arial; max-width: 900px; margin: 50px auto; padding: 20px; background: #667eea; }
                .container { background: white; padding: 40px; border-radius: 20px; }
                h1 { color: #333; border-bottom: 4px solid #667eea; padding-bottom: 15px; }
                .status { background: #f8f9fa; padding: 20px; margin: 20px 0; border-radius: 10px; }
                .qr-container { text-align: center; margin: 30px 0; }
                .qr-container img { max-width: 300px; border: 3px solid #667eea; }
            </style>
            ${qrCodeData ? '<meta http-equiv="refresh" content="5">' : ''}
        </head>
        <body>
            <div class="container">
                <h1>🏥 HMASP Chat - Servidor Cloud</h1>
                <div class="status">
                    <h3>Status WhatsApp: ${status}</h3>
                    <p>IP: 136.118.10.24:${PORT}</p>
                </div>
                ${qrCodeData ? `
                <div class="qr-container">
                    <h2>📱 Conectar WhatsApp</h2>
                    <p>Escaneie o QR Code</p>
                    <img src="${qrCodeData}" alt="QR Code">
                </div>
                ` : ''}
            </div>
        </body>
        </html>
    `);
});

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        whatsapp: isReady ? 'connected' : 'disconnected',
        timestamp: new Date().toISOString()
    });
});

// Inicialização
app.listen(PORT, '0.0.0.0', () => {
    console.log('============================================');
    console.log('  HMASP Chat - Servidor Cloud');
    console.log('============================================');
    console.log(`Servidor: http://136.118.10.24:${PORT}`);
    console.log('============================================');
    initializeWhatsApp();
});

process.on('uncaughtException', (error) => {
    console.error('[ERRO]:', error);
});

process.on('SIGTERM', async () => {
    console.log('Encerrando...');
    if (pgPool) await pgPool.end();
    process.exit(0);
});
