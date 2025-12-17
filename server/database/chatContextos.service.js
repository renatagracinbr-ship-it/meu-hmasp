/**
 * Serviço de Contextos de Chat - HMASP Chat
 * Gerencia contextos de confirmações de consultas com segurança contra race conditions
 * Usa SQLite com transações para garantir consistência
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'chat_contextos.db');
let db = null;

/**
 * Inicializa o banco de dados e cria as tabelas
 */
function initialize() {
    if (db) return db;

    console.log('[ChatContextos] Inicializando banco de dados...');
    console.log('[ChatContextos] Caminho:', DB_PATH);

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL'); // Write-Ahead Logging para melhor concorrência

    // Cria tabela de contextos
    db.exec(`
        CREATE TABLE IF NOT EXISTS contextos (
            confirmacao_id TEXT PRIMARY KEY,
            chat_id TEXT NOT NULL,
            contexto TEXT NOT NULL,
            consulta_numero TEXT,
            telefone TEXT,
            message_text TEXT,
            timestamp TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        -- Índices para tabela contextos
        CREATE INDEX IF NOT EXISTS idx_chat_id ON contextos(chat_id);
        CREATE INDEX IF NOT EXISTS idx_telefone ON contextos(telefone);
        CREATE INDEX IF NOT EXISTS idx_expires_at ON contextos(expires_at);

        -- Tabela de mapeamento telefone -> confirmações
        CREATE TABLE IF NOT EXISTS phone_confirmacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            telefone TEXT NOT NULL,
            confirmacao_id TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (confirmacao_id) REFERENCES contextos(confirmacao_id) ON DELETE CASCADE
        );

        -- Índices para tabela phone_confirmacoes
        CREATE INDEX IF NOT EXISTS idx_telefone_lookup ON phone_confirmacoes(telefone);
        CREATE INDEX IF NOT EXISTS idx_confirmacao_lookup ON phone_confirmacoes(confirmacao_id);
    `);

    console.log('[ChatContextos] ✅ Banco de dados inicializado');
    return db;
}

/**
 * Salva um contexto de chat (thread-safe)
 * @param {Object} data - Dados do contexto
 * @param {string} data.confirmacaoId - ID único da confirmação
 * @param {string} data.chatId - ID do chat WhatsApp
 * @param {string} data.contexto - Tipo de contexto (confirmacao, lembrete, etc)
 * @param {string} data.consultaNumero - Número da consulta
 * @param {string} data.telefone - Telefone do paciente
 * @param {string} data.messageText - Texto da mensagem
 * @param {number} data.expiresInHours - Horas até expirar (padrão: 24h)
 */
function saveContexto(data) {
    if (!db) initialize();

    const {
        confirmacaoId,
        chatId,
        contexto,
        consultaNumero = null,
        telefone = null,
        messageText = null,
        expiresInHours = 24
    } = data;

    const timestamp = new Date().toISOString();
    const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();

    // Usa transação para garantir consistência
    const transaction = db.transaction(() => {
        // 1. Insere ou substitui o contexto
        const insertContexto = db.prepare(`
            INSERT OR REPLACE INTO contextos
            (confirmacao_id, chat_id, contexto, consulta_numero, telefone, message_text, timestamp, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        insertContexto.run(
            confirmacaoId,
            chatId,
            contexto,
            consultaNumero,
            telefone,
            messageText,
            timestamp,
            expiresAt
        );

        // 2. Adiciona mapeamentos de telefone
        // Cria múltiplas chaves para garantir que encontramos o contexto
        const telefones = [];

        // Adiciona chatId original (ex: 5511987654321@c.us)
        telefones.push(chatId);

        // Adiciona telefone normalizado (só números)
        if (telefone) {
            const numeroNormalizado = telefone.replace(/\D/g, '');
            if (numeroNormalizado) {
                telefones.push(numeroNormalizado);
            }
        }

        // Adiciona versão sem sufixo do chatId (ex: 5511987654321)
        const chatIdSemSufixo = chatId.replace(/@c\.us|@lid|@g\.us/g, '');
        if (chatIdSemSufixo !== chatId) {
            telefones.push(chatIdSemSufixo);
        }

        // Remove duplicatas
        const telefonesUnicos = [...new Set(telefones)];

        // Limpa mapeamentos antigos desta confirmação
        const deleteOldMappings = db.prepare(`
            DELETE FROM phone_confirmacoes
            WHERE confirmacao_id = ?
        `);
        deleteOldMappings.run(confirmacaoId);

        // Insere novos mapeamentos
        const insertMapping = db.prepare(`
            INSERT INTO phone_confirmacoes (telefone, confirmacao_id)
            VALUES (?, ?)
        `);

        for (const tel of telefonesUnicos) {
            insertMapping.run(tel, confirmacaoId);
        }
    });

    // Executa a transação (thread-safe!)
    transaction();

    console.log('[ChatContextos] 💾 Contexto salvo:', {
        confirmacaoId,
        contexto,
        chatId,
        telefones: telefone
    });

    return true;
}

/**
 * Busca contextos ativos para um telefone/chatId
 * @param {string} phoneOrChatId - Telefone ou Chat ID
 * @returns {Array} Array de contextos ativos
 */
function findContextosByPhone(phoneOrChatId) {
    if (!db) initialize();

    // Busca por mapeamento
    const query = db.prepare(`
        SELECT c.*
        FROM contextos c
        INNER JOIN phone_confirmacoes pc ON c.confirmacao_id = pc.confirmacao_id
        WHERE pc.telefone = ?
          AND datetime(c.expires_at) > datetime('now')
        ORDER BY c.timestamp DESC
    `);

    const contextos = query.all(phoneOrChatId);

    console.log(`[ChatContextos] 🔍 Buscando contextos para ${phoneOrChatId}: ${contextos.length} encontrados`);

    return contextos.map(ctx => ({
        confirmacaoId: ctx.confirmacao_id,
        chatId: ctx.chat_id,
        contexto: ctx.contexto,
        consultaNumero: ctx.consulta_numero,
        telefone: ctx.telefone,
        messageText: ctx.message_text,
        timestamp: ctx.timestamp,
        expiresAt: ctx.expires_at
    }));
}

/**
 * Busca um contexto específico por ID
 * @param {string} confirmacaoId - ID da confirmação
 * @returns {Object|null} Contexto ou null se não encontrado/expirado
 */
function getContexto(confirmacaoId) {
    if (!db) initialize();

    const query = db.prepare(`
        SELECT *
        FROM contextos
        WHERE confirmacao_id = ?
          AND datetime(expires_at) > datetime('now')
    `);

    const ctx = query.get(confirmacaoId);

    if (!ctx) return null;

    return {
        confirmacaoId: ctx.confirmacao_id,
        chatId: ctx.chat_id,
        contexto: ctx.contexto,
        consultaNumero: ctx.consulta_numero,
        telefone: ctx.telefone,
        messageText: ctx.message_text,
        timestamp: ctx.timestamp,
        expiresAt: ctx.expires_at
    };
}

/**
 * Remove contextos expirados (limpeza)
 * @returns {number} Número de contextos removidos
 */
function cleanupExpiredContextos() {
    if (!db) initialize();

    const deleteExpired = db.prepare(`
        DELETE FROM contextos
        WHERE datetime(expires_at) <= datetime('now')
    `);

    const result = deleteExpired.run();

    if (result.changes > 0) {
        console.log(`[ChatContextos] 🧹 ${result.changes} contextos expirados removidos`);
    }

    return result.changes;
}

/**
 * Atualiza o chatId de um contexto (após envio de mensagem)
 * @param {string} confirmacaoId - ID da confirmação
 * @param {string} newChatId - Novo chat ID real
 * @returns {boolean} Sucesso da operação
 */
function updateChatId(confirmacaoId, newChatId) {
    if (!db) initialize();

    const transaction = db.transaction(() => {
        // 1. Atualiza o chat_id no contexto
        const updateStmt = db.prepare(`
            UPDATE contextos
            SET chat_id = ?
            WHERE confirmacao_id = ?
        `);

        updateStmt.run(newChatId, confirmacaoId);

        // 2. Adiciona novo mapeamento de telefone
        const numeroNormalizado = newChatId.replace(/@c\.us|@lid|@g\.us/g, '');

        // Verifica se mapeamento já existe
        const checkStmt = db.prepare(`
            SELECT id FROM phone_confirmacoes
            WHERE telefone = ? AND confirmacao_id = ?
        `);

        const exists = checkStmt.get(newChatId, confirmacaoId);

        if (!exists) {
            const insertMapping = db.prepare(`
                INSERT INTO phone_confirmacoes (telefone, confirmacao_id)
                VALUES (?, ?)
            `);

            insertMapping.run(newChatId, confirmacaoId);

            // Adiciona versão normalizada também se diferente
            if (numeroNormalizado !== newChatId) {
                const existsNorm = checkStmt.get(numeroNormalizado, confirmacaoId);
                if (!existsNorm) {
                    insertMapping.run(numeroNormalizado, confirmacaoId);
                }
            }
        }
    });

    transaction();
    console.log(`[ChatContextos] 🔄 ChatId atualizado: ${confirmacaoId} -> ${newChatId}`);
    return true;
}

/**
 * Remove um contexto específico
 * @param {string} confirmacaoId - ID da confirmação
 */
function deleteContexto(confirmacaoId) {
    if (!db) initialize();

    const deleteStmt = db.prepare(`
        DELETE FROM contextos
        WHERE confirmacao_id = ?
    `);

    deleteStmt.run(confirmacaoId);
    console.log(`[ChatContextos] 🗑️ Contexto ${confirmacaoId} removido`);
}

/**
 * Retorna estatísticas dos contextos
 */
function getStats() {
    if (!db) initialize();

    const stats = db.prepare(`
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN datetime(expires_at) > datetime('now') THEN 1 ELSE 0 END) as ativos,
            SUM(CASE WHEN datetime(expires_at) <= datetime('now') THEN 1 ELSE 0 END) as expirados
        FROM contextos
    `).get();

    return stats;
}

module.exports = {
    initialize,
    saveContexto,
    findContextosByPhone,
    getContexto,
    updateChatId,
    cleanupExpiredContextos,
    deleteContexto,
    getStats
};
