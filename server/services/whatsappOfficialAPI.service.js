/**
 * WhatsApp Official API Service
 * Serviço para envio de mensagens via API Oficial do WhatsApp (Meta Cloud API)
 *
 * Substitui o whatsapp-web.js para envio de mensagens
 */

const https = require('https');

// Configurações da API - ATUALIZE COM SUAS CREDENCIAIS
const CONFIG = {
    // Token permanente gerado no Meta Business Suite
    ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN || 'EAAPX5CafmqUBQDdkKZCnsP0QIZClZBqLt19jqs8JR1EZBG2MunSah0VmBcoeBB4K7BZCICBYH0607ZCx5wbX7EvzCofKiUyZCGZAfifUOJXzO4HwRRKQ1ZBZAuAmvKAvdSXcft1nkWVUTRFh1GSXrO2biZCTG4QOZBsH5KOgWr3TmbhRQ6IzW5Pb3s1AFmH2xNhYiQZDZD',

    // Phone Number ID do número de teste ou verificado
    PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID || '984058148105584',

    // WhatsApp Business Account ID
    WABA_ID: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '850539624561225',

    // Versão da API Graph
    API_VERSION: 'v22.0',

    // Base URL da API
    BASE_URL: 'graph.facebook.com'
};

/**
 * Formata número de telefone para o padrão do WhatsApp
 * Remove caracteres especiais e garante formato correto
 * @param {string} phoneNumber - Número no formato brasileiro ou com @c.us
 * @returns {string} - Número formatado (apenas dígitos, com código do país)
 */
function formatPhoneNumber(phoneNumber) {
    // Remove @c.us, @s.whatsapp.net, etc
    let cleaned = phoneNumber.replace(/@[a-z.]+$/i, '');

    // Remove todos os caracteres não numéricos
    cleaned = cleaned.replace(/\D/g, '');

    // Se começar com 55 e tiver 12-13 dígitos, está ok
    // Se não tiver 55, adiciona (assumindo Brasil)
    if (!cleaned.startsWith('55') && cleaned.length >= 10 && cleaned.length <= 11) {
        cleaned = '55' + cleaned;
    }

    return cleaned;
}

/**
 * Envia mensagem de texto simples
 * @param {string} to - Número de destino
 * @param {string} message - Texto da mensagem
 * @returns {Promise<object>} - Resposta da API
 */
async function sendTextMessage(to, message) {
    const phoneNumber = formatPhoneNumber(to);

    const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phoneNumber,
        type: 'text',
        text: {
            preview_url: false,
            body: message
        }
    };

    return makeAPIRequest(payload);
}

/**
 * Envia mensagem usando template aprovado
 * @param {string} to - Número de destino
 * @param {string} templateName - Nome do template
 * @param {string} languageCode - Código do idioma (ex: 'pt_BR')
 * @param {Array} components - Componentes do template (variáveis)
 * @returns {Promise<object>} - Resposta da API
 */
async function sendTemplateMessage(to, templateName, languageCode = 'pt_BR', components = []) {
    const phoneNumber = formatPhoneNumber(to);

    const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phoneNumber,
        type: 'template',
        template: {
            name: templateName,
            language: {
                code: languageCode
            }
        }
    };

    // Adiciona componentes se houver variáveis
    if (components.length > 0) {
        payload.template.components = components;
    }

    return makeAPIRequest(payload);
}

/**
 * Envia mensagem interativa com botões
 * NOTA: Só funciona em resposta a mensagem do usuário (janela de 24h)
 * @param {string} to - Número de destino
 * @param {string} bodyText - Texto principal
 * @param {Array} buttons - Array de botões [{id: 'btn1', title: 'Opção 1'}]
 * @returns {Promise<object>} - Resposta da API
 */
async function sendInteractiveButtons(to, bodyText, buttons) {
    const phoneNumber = formatPhoneNumber(to);

    const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phoneNumber,
        type: 'interactive',
        interactive: {
            type: 'button',
            body: {
                text: bodyText
            },
            action: {
                buttons: buttons.map((btn, index) => ({
                    type: 'reply',
                    reply: {
                        id: btn.id || `btn_${index}`,
                        title: btn.title.substring(0, 20) // Máximo 20 caracteres
                    }
                }))
            }
        }
    };

    return makeAPIRequest(payload);
}

/**
 * Envia mensagem interativa com lista de opções
 * @param {string} to - Número de destino
 * @param {string} bodyText - Texto principal
 * @param {string} buttonText - Texto do botão que abre a lista
 * @param {Array} sections - Seções da lista
 * @returns {Promise<object>} - Resposta da API
 */
async function sendInteractiveList(to, bodyText, buttonText, sections) {
    const phoneNumber = formatPhoneNumber(to);

    const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phoneNumber,
        type: 'interactive',
        interactive: {
            type: 'list',
            body: {
                text: bodyText
            },
            action: {
                button: buttonText.substring(0, 20),
                sections: sections
            }
        }
    };

    return makeAPIRequest(payload);
}

/**
 * Marca mensagem como lida
 * @param {string} messageId - ID da mensagem (wamid.xxx)
 * @returns {Promise<object>} - Resposta da API
 */
async function markAsRead(messageId) {
    const payload = {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId
    };

    return makeAPIRequest(payload);
}

/**
 * Verifica o status da conexão/conta
 * @returns {Promise<object>} - Informações da conta
 */
async function getAccountStatus() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: CONFIG.BASE_URL,
            port: 443,
            path: `/${CONFIG.API_VERSION}/${CONFIG.PHONE_NUMBER_ID}`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${CONFIG.ACCESS_TOKEN}`
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    resolve(response);
                } catch (e) {
                    reject(new Error('Erro ao parsear resposta: ' + data));
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

/**
 * Faz requisição à API do WhatsApp
 * @param {object} payload - Dados a enviar
 * @returns {Promise<object>} - Resposta da API
 */
function makeAPIRequest(payload) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify(payload);

        const options = {
            hostname: CONFIG.BASE_URL,
            port: 443,
            path: `/${CONFIG.API_VERSION}/${CONFIG.PHONE_NUMBER_ID}/messages`,
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CONFIG.ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        console.log('[WhatsApp API] 📤 Enviando requisição...');
        console.log('[WhatsApp API] 📋 Payload:', JSON.stringify(payload, null, 2));

        const req = https.request(options, (res) => {
            let responseData = '';

            res.on('data', chunk => responseData += chunk);

            res.on('end', () => {
                try {
                    const response = JSON.parse(responseData);

                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        console.log('[WhatsApp API] ✅ Sucesso:', JSON.stringify(response, null, 2));

                        // Formata resposta similar ao whatsapp-web.js para compatibilidade
                        const formattedResponse = {
                            success: true,
                            messageId: response.messages?.[0]?.id || null,
                            waId: response.contacts?.[0]?.wa_id || null,
                            to: payload.to,
                            timestamp: new Date().toISOString(),
                            raw: response
                        };

                        resolve(formattedResponse);
                    } else {
                        console.error('[WhatsApp API] ❌ Erro:', JSON.stringify(response, null, 2));
                        reject(new Error(response.error?.message || 'Erro desconhecido da API'));
                    }
                } catch (e) {
                    console.error('[WhatsApp API] ❌ Erro ao parsear resposta:', responseData);
                    reject(new Error('Erro ao parsear resposta da API'));
                }
            });
        });

        req.on('error', (error) => {
            console.error('[WhatsApp API] ❌ Erro de conexão:', error.message);
            reject(error);
        });

        req.write(data);
        req.end();
    });
}

/**
 * Atualiza as configurações da API
 * @param {object} newConfig - Novas configurações
 */
function updateConfig(newConfig) {
    if (newConfig.accessToken) CONFIG.ACCESS_TOKEN = newConfig.accessToken;
    if (newConfig.phoneNumberId) CONFIG.PHONE_NUMBER_ID = newConfig.phoneNumberId;
    if (newConfig.wabaId) CONFIG.WABA_ID = newConfig.wabaId;
    console.log('[WhatsApp API] ⚙️ Configurações atualizadas');
}

/**
 * Retorna as configurações atuais (sem o token completo por segurança)
 * @returns {object} - Configurações
 */
function getConfig() {
    return {
        phoneNumberId: CONFIG.PHONE_NUMBER_ID,
        wabaId: CONFIG.WABA_ID,
        apiVersion: CONFIG.API_VERSION,
        hasToken: !!CONFIG.ACCESS_TOKEN,
        tokenPreview: CONFIG.ACCESS_TOKEN ? CONFIG.ACCESS_TOKEN.substring(0, 20) + '...' : null
    };
}

module.exports = {
    sendTextMessage,
    sendTemplateMessage,
    sendInteractiveButtons,
    sendInteractiveList,
    markAsRead,
    getAccountStatus,
    updateConfig,
    getConfig,
    formatPhoneNumber,
    CONFIG
};
