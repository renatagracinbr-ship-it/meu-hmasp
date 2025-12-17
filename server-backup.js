/**
 * Servidor WhatsApp para Google Compute Engine - VERSÃO COMPLETA
 * Com nomes de contatos, informações e sincronização Google Contacts
 */

const express = require('express');
const cors = require('cors');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const { google } = require('googleapis');
const fs = require('fs');

const app = express();
const PORT = 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Estado do WhatsApp
let whatsappClient = null;
let isReady = false;
let qrCodeData = null;

// Cache de contatos
const contactsCache = new Map();

// Google Contacts API
let googleContactsAPI = null;

// ============================================================================
// GOOGLE CONTACTS - SINCRONIZAÇÃO
// ============================================================================

async function initializeGoogleContacts() {
    try {
        // TODO: Configurar credenciais OAuth2
        // Por enquanto, apenas loga que será implementado
        console.log('[Google Contacts] Sincronização será configurada');
    } catch (error) {
        console.error('[Google Contacts] Erro ao inicializar:', error.message);
    }
}

async function syncContactToGoogle(contactInfo) {
    try {
        // TODO: Implementar sincronização real com Google Contacts API
        console.log('[Google Contacts] Sincronizando:', contactInfo.name);
    } catch (error) {
        console.error('[Google Contacts] Erro ao sincronizar:', error.message);
    }
}

// ============================================================================
// WHATSAPP - FUNÇÕES AUXILIARES
// ============================================================================

/**
 * Busca informações completas do contato
 */
async function getContactInfo(chatId) {
    try {
        // Verifica cache
        if (contactsCache.has(chatId)) {
            return contactsCache.get(chatId);
        }

        // Busca o contato
        const contact = await whatsappClient.getContactById(chatId);

        const contactInfo = {
            id: contact.id._serialized,
            number: contact.number,
            name: contact.name || contact.pushname || contact.number,
            pushname: contact.pushname,
            isMyContact: contact.isMyContact,
            isGroup: contact.isGroup,
            isUser: contact.isUser,
            isWAContact: contact.isWAContact,
            profilePicUrl: null
        };

        // Busca foto do perfil
        try {
            contactInfo.profilePicUrl = await contact.getProfilePicUrl();
        } catch (err) {
            // Sem foto de perfil
        }

        // Salva no cache
        contactsCache.set(chatId, contactInfo);

        // Sincroniza com Google Contacts
        if (contactInfo.isMyContact) {
            await syncContactToGoogle(contactInfo);
        }

        return contactInfo;
    } catch (error) {
        console.error('[WhatsApp] Erro ao buscar info do contato:', error.message);
        return {
            id: chatId,
            number: chatId.replace('@c.us', ''),
            name: chatId.replace('@c.us', ''),
            isGroup: false
        };
    }
}

// Inicializa o cliente WhatsApp
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
                '--disable-software-rasterizer',
                '--disable-dev-tools'
            ]
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
    });

    // Evento: Desconectado
    whatsappClient.on('disconnected', (reason) => {
        console.log('[WhatsApp] Desconectado:', reason);
        isReady = false;
        whatsappClient = null;
        contactsCache.clear();
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

// Listar conversas (COM NOMES CORRETOS)
app.get('/api/chats', async (req, res) => {
    try {
        if (!isReady) {
            return res.status(503).json({ success: false, error: 'WhatsApp não está conectado' });
        }

        const chats = await whatsappClient.getChats();

        // Busca informações de cada contato
        const chatList = await Promise.all(chats.map(async (chat) => {
            let contactName = chat.name;

            // Para chats individuais, busca o nome do contato
            if (!chat.isGroup) {
                try {
                    const contactInfo = await getContactInfo(chat.id._serialized);
                    contactName = contactInfo.name;
                } catch (err) {
                    contactName = chat.id.user;
                }
            }

            return {
                id: chat.id._serialized,
                name: contactName,
                isGroup: chat.isGroup,
                unreadCount: chat.unreadCount,
                timestamp: chat.timestamp,
                lastMessage: chat.lastMessage ? {
                    body: chat.lastMessage.body,
                    timestamp: chat.lastMessage.timestamp,
                    fromMe: chat.lastMessage.fromMe
                } : null
            };
        }));

        res.json({ success: true, chats: chatList });
    } catch (error) {
        console.error('[API] Erro ao buscar chats:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Buscar informações do contato (NOVO ENDPOINT)
app.get('/api/contact/:contactId', async (req, res) => {
    try {
        if (!isReady) {
            return res.status(503).json({ success: false, error: 'WhatsApp não está conectado' });
        }

        const { contactId } = req.params;
        const contactInfo = await getContactInfo(contactId);

        res.json({ success: true, contact: contactInfo });
    } catch (error) {
        console.error('[API] Erro ao buscar informações do contato:', error);
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
            return res.status(503).json({ success: false, error: 'WhatsApp não está conectado' });
        }

        const { to, message } = req.body;

        if (!to || !message) {
            return res.status(400).json({ success: false, error: 'Campos "to" e "message" são obrigatórios' });
        }

        const sentMessage = await whatsappClient.sendMessage(to, message);

        res.json({
            success: true,
            messageId: sentMessage.id._serialized,
            timestamp: sentMessage.timestamp
        });
    } catch (error) {
        console.error('[API] Erro ao enviar mensagem:', error);
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

// Logout
app.post('/api/logout', async (req, res) => {
    try {
        if (whatsappClient) {
            await whatsappClient.logout();
            whatsappClient = null;
            isReady = false;
            qrCodeData = null;
            contactsCache.clear();
        }
        res.json({ success: true });
    } catch (error) {
        console.error('[API] Erro ao fazer logout:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Página inicial
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>HMASP Chat - WhatsApp Server</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                    margin: 0;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                }
                .container {
                    background: white;
                    padding: 40px;
                    border-radius: 20px;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                    text-align: center;
                }
                h1 { color: #333; }
                .status {
                    font-size: 24px;
                    margin: 20px 0;
                    color: ${isReady ? '#10b981' : '#f59e0b'};
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>📱 HMASP Chat</h1>
                <div class="status">${isReady ? '✓ WhatsApp Conectado' : '⏳ Inicializando...'}</div>
                <p>Servidor Google Cloud - Oregon</p>
                <p>IP: 136.118.10.24:3000</p>
            </div>
        </body>
        </html>
    `);
});

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================

app.listen(PORT, '0.0.0.0', () => {
    console.log('============================================');
    console.log('  HMASP Chat - Servidor Cloud');
    console.log('============================================');
    console.log(`Servidor: http://136.118.10.24:${PORT}`);
    console.log('============================================');

    // Inicializa serviços
    initializeWhatsApp();
    initializeGoogleContacts();
});

// Tratamento de erros
process.on('uncaughtException', (error) => {
    console.error('[ERRO]', error);
});

process.on('unhandledRejection', (reason) => {
    console.error('[ERRO]', reason);
});
