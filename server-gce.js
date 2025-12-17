/**
 * Servidor WhatsApp para Google Compute Engine
 * Otimizado para rodar 24/7 na VM e2-micro
 */

const express = require('express');
const cors = require('cors');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');

const app = express();
const PORT = 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Estado do WhatsApp
let whatsappClient = null;
let isReady = false;
let qrCodeData = null;

// Inicializa o cliente WhatsApp
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
        // Reconecta automaticamente
        setTimeout(initializeWhatsApp, 5000);
    });

    // Evento: Erro de autenticação
    whatsappClient.on('auth_failure', (error) => {
        console.error('[WhatsApp] ✗ Falha na autenticação:', error);
        qrCodeData = null;
    });

    // Inicializa
    whatsappClient.initialize();
}

// ============================================================================
// API REST - ENDPOINTS
// ============================================================================

// Status do WhatsApp
app.get('/api/status', (req, res) => {
    res.json({
        isReady: isReady,
        hasQr: qrCodeData !== null,
        timestamp: new Date().toISOString()
    });
});

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

// Listar conversas
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

// Buscar mensagens de um chat
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

// Enviar mensagem
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

// Marcar chat como lido
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

// Logout
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

// Página inicial com QR Code
app.get('/', (req, res) => {
    if (qrCodeData) {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>HMASP Chat - WhatsApp Login</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        margin: 0;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                    }
                    .container {
                        background: white;
                        padding: 40px;
                        border-radius: 20px;
                        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                        text-align: center;
                    }
                    h1 {
                        color: #333;
                        margin-bottom: 20px;
                    }
                    p {
                        color: #666;
                        margin-bottom: 30px;
                    }
                    img {
                        max-width: 300px;
                        border: 3px solid #667eea;
                        border-radius: 10px;
                    }
                    .status {
                        margin-top: 20px;
                        padding: 10px;
                        background: #f0f0f0;
                        border-radius: 5px;
                        color: #333;
                    }
                </style>
                <meta http-equiv="refresh" content="5">
            </head>
            <body>
                <div class="container">
                    <h1>📱 HMASP Chat (Google Cloud)</h1>
                    <p>Escaneie o QR Code com o WhatsApp</p>
                    <img src="${qrCodeData}" alt="QR Code">
                    <div class="status">
                        ✓ Aguardando leitura do QR Code...
                    </div>
                </div>
            </body>
            </html>
        `);
    } else if (isReady) {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>HMASP Chat - Conectado</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        margin: 0;
                        background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
                        color: white;
                    }
                    .container {
                        background: white;
                        padding: 40px;
                        border-radius: 20px;
                        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                        text-align: center;
                    }
                    h1 {
                        color: #333;
                    }
                    .success {
                        font-size: 60px;
                        margin: 20px 0;
                    }
                    p {
                        color: #666;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="success">✓</div>
                    <h1>WhatsApp Conectado!</h1>
                    <p>Servidor rodando no Google Cloud (Oregon)</p>
                    <p>IP: 136.118.10.24:3000</p>
                </div>
            </body>
            </html>
        `);
    } else {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>HMASP Chat - Inicializando</title>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        justify-content: center;
                        min-height: 100vh;
                        margin: 0;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: white;
                    }
                    .container {
                        background: white;
                        padding: 40px;
                        border-radius: 20px;
                        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                        text-align: center;
                    }
                    h1 {
                        color: #333;
                    }
                    p {
                        color: #666;
                    }
                    .spinner {
                        border: 4px solid #f3f3f3;
                        border-top: 4px solid #667eea;
                        border-radius: 50%;
                        width: 40px;
                        height: 40px;
                        animation: spin 1s linear infinite;
                        margin: 20px auto;
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
                <meta http-equiv="refresh" content="2">
            </head>
            <body>
                <div class="container">
                    <h1>📱 HMASP Chat</h1>
                    <div class="spinner"></div>
                    <p>Iniciando WhatsApp...</p>
                </div>
            </body>
            </html>
        `);
    }
});

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================

app.listen(PORT, '0.0.0.0', () => {
    console.log('============================================');
    console.log('  HMASP Chat - Google Compute Engine');
    console.log('============================================');
    console.log(`✓ Servidor rodando em: http://136.118.10.24:${PORT}`);
    console.log('✓ Para conectar o WhatsApp, acesse:');
    console.log(`  http://136.118.10.24:${PORT}`);
    console.log('');
    console.log('✓ API disponível em:');
    console.log(`  http://136.118.10.24:${PORT}/api`);
    console.log('============================================');
    console.log('');

    // Inicializa WhatsApp
    initializeWhatsApp();
});

// Tratamento de erros não capturados
process.on('uncaughtException', (error) => {
    console.error('[ERRO] Exceção não capturada:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[ERRO] Promise rejeitada não tratada:', reason);
});
