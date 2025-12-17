/**
 * Serviço de Gerenciamento de Respostas WhatsApp (SQLite Multi-Usuário)
 *
 * IMPORTANTE: Este serviço NÃO interfere com o banco de dados do WhatsApp
 * - WhatsApp gerencia suas próprias mensagens via LocalAuth e sessão
 * - Este serviço apenas registra RESPOSTAS PROCESSADAS pelo nosso sistema
 * - Usado para sincronizar status entre múltiplos operadores
 *
 * Funcionalidades:
 * - Salvar respostas de pacientes (confirmação/desmarcação)
 * - Buscar respostas pendentes (não processadas)
 * - Marcar respostas como processadas
 * - Arquivar respostas antigas
 * - Estatísticas em tempo real
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Caminho do banco de dados (usa o mesmo banco das consultas)
const DB_PATH = path.join(__dirname, 'hmasp_consultas.db');
const schemaPath = path.join(__dirname, 'schema-whatsapp-respostas.sql');

let db = null;

/**
 * Inicializa o banco de dados
 */
function init() {
    try {
        console.log('[WhatsAppRespostas] Inicializando banco de dados...');
        console.log('[WhatsAppRespostas] Caminho:', DB_PATH);

        // Cria conexão (reutiliza o mesmo banco das consultas)
        db = new Database(DB_PATH);

        // Configurações de performance
        db.pragma('journal_mode = WAL');
        db.pragma('synchronous = NORMAL');

        // Executa schema
        if (!fs.existsSync(schemaPath)) {
            throw new Error(`Schema não encontrado: ${schemaPath}`);
        }

        const schema = fs.readFileSync(schemaPath, 'utf-8');
        db.exec(schema);

        console.log('[WhatsAppRespostas] ✅ Banco de dados inicializado');
        return true;
    } catch (error) {
        console.error('[WhatsAppRespostas] ❌ Erro ao inicializar:', error);
        throw error;
    }
}

// ============================================================================
// RESPOSTAS ATIVAS
// ============================================================================

/**
 * Salva uma resposta do WhatsApp
 */
function saveResposta(params) {
    if (!db) throw new Error('Banco não inicializado');

    const {
        confirmacaoId = null,
        telefone,
        telefoneChat = null,
        status = null,
        tipoDesmarcacao = null,
        contexto = null,
        messageBody = '',
        timestamp = new Date().toISOString()
    } = params;

    try {
        const stmt = db.prepare(`
            INSERT INTO whatsapp_respostas_ativas (
                confirmacao_id,
                telefone,
                telefone_chat,
                status,
                tipo_desmarcacao,
                contexto,
                message_body,
                timestamp,
                processada,
                criado_em
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, datetime('now'))
        `);

        const result = stmt.run(
            confirmacaoId,
            telefone,
            telefoneChat,
            status,
            tipoDesmarcacao,
            contexto,
            messageBody,
            timestamp
        );

        console.log(`[WhatsAppRespostas] ✅ Resposta salva: ${telefone} - ${status}`);

        return {
            success: true,
            id: result.lastInsertRowid,
            telefone: telefone
        };
    } catch (error) {
        // Se for erro de UNIQUE constraint, não é um erro crítico
        if (error.message.includes('UNIQUE constraint')) {
            console.log(`[WhatsAppRespostas] ℹ️ Resposta duplicada (já existe): ${telefone} - ${timestamp}`);
            return {
                success: true,
                duplicate: true,
                telefone: telefone
            };
        }

        console.error('[WhatsAppRespostas] ❌ Erro ao salvar resposta:', error);
        throw error;
    }
}

/**
 * Busca respostas pendentes (não processadas)
 */
function getRespostasPendentes() {
    if (!db) throw new Error('Banco não inicializado');

    const stmt = db.prepare(`
        SELECT * FROM vw_whatsapp_respostas_pendentes
        ORDER BY timestamp DESC
    `);

    return stmt.all();
}

/**
 * Busca todas as respostas ativas (processadas e não processadas)
 */
function getAllRespostas(filtros = {}) {
    if (!db) throw new Error('Banco não inicializado');

    let query = 'SELECT * FROM whatsapp_respostas_ativas WHERE 1=1';
    const params = [];

    if (filtros.processada !== undefined) {
        query += ' AND processada = ?';
        params.push(filtros.processada ? 1 : 0);
    }

    if (filtros.contexto) {
        query += ' AND contexto = ?';
        params.push(filtros.contexto);
    }

    if (filtros.status) {
        query += ' AND status = ?';
        params.push(filtros.status);
    }

    query += ' ORDER BY timestamp DESC';

    const stmt = db.prepare(query);
    return stmt.all(...params);
}

/**
 * Marca resposta como processada
 */
function marcarComoProcessada(id) {
    if (!db) throw new Error('Banco não inicializado');

    const stmt = db.prepare(`
        UPDATE whatsapp_respostas_ativas
        SET processada = 1,
            processada_em = datetime('now')
        WHERE id = ?
    `);

    const result = stmt.run(id);
    return result.changes > 0;
}

/**
 * Busca última resposta de um telefone por contexto
 */
function getUltimaRespostaPorTelefone(telefone, contexto) {
    if (!db) throw new Error('Banco não inicializado');

    const stmt = db.prepare(`
        SELECT * FROM whatsapp_respostas_ativas
        WHERE (telefone = ? OR telefone_chat = ?)
          AND contexto = ?
        ORDER BY timestamp DESC
        LIMIT 1
    `);

    return stmt.get(telefone, telefone, contexto);
}

/**
 * Marca múltiplas respostas como processadas
 */
function marcarVariasComoProcessadas(ids) {
    if (!db) throw new Error('Banco não inicializado');
    if (!Array.isArray(ids) || ids.length === 0) return 0;

    const placeholders = ids.map(() => '?').join(',');
    const stmt = db.prepare(`
        UPDATE whatsapp_respostas_ativas
        SET processada = 1,
            processada_em = datetime('now')
        WHERE id IN (${placeholders})
    `);

    const result = stmt.run(...ids);
    return result.changes;
}

/**
 * Arquiva uma resposta (move para histórico)
 */
function arquivarResposta(id, motivo = 'manual') {
    if (!db) throw new Error('Banco não inicializado');

    // Busca resposta
    const stmt = db.prepare('SELECT * FROM whatsapp_respostas_ativas WHERE id = ?');
    const resposta = stmt.get(id);

    if (!resposta) return false;

    // Inicia transação
    const transaction = db.transaction(() => {
        // Insere no histórico
        const insertStmt = db.prepare(`
            INSERT INTO whatsapp_respostas_historico (
                resposta_id,
                confirmacao_id,
                telefone,
                telefone_chat,
                status,
                tipo_desmarcacao,
                contexto,
                message_body,
                timestamp_resposta,
                motivo_arquivamento,
                arquivado_em
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `);

        insertStmt.run(
            resposta.id,
            resposta.confirmacao_id,
            resposta.telefone,
            resposta.telefone_chat,
            resposta.status,
            resposta.tipo_desmarcacao,
            resposta.contexto,
            resposta.message_body,
            resposta.timestamp,
            motivo
        );

        // Remove da tabela ativa
        const deleteStmt = db.prepare('DELETE FROM whatsapp_respostas_ativas WHERE id = ?');
        deleteStmt.run(id);
    });

    transaction();
    return true;
}

/**
 * Arquiva respostas processadas antigas (mais de 24h)
 */
function arquivarRespostasAntigas() {
    if (!db) throw new Error('Banco não inicializado');

    // Busca respostas processadas com mais de 24h
    const stmt = db.prepare(`
        SELECT id FROM whatsapp_respostas_ativas
        WHERE processada = 1
        AND datetime(processada_em) < datetime('now', '-1 day')
    `);

    const respostas = stmt.all();
    let arquivados = 0;

    for (const resposta of respostas) {
        if (arquivarResposta(resposta.id, 'automatico_24h')) {
            arquivados++;
        }
    }

    console.log(`[WhatsAppRespostas] 🗄️ Arquivados ${arquivados} registros antigos (24h+)`);
    return arquivados;
}

/**
 * Deleta uma resposta ativa
 */
function deleteResposta(id) {
    if (!db) throw new Error('Banco não inicializado');

    const stmt = db.prepare('DELETE FROM whatsapp_respostas_ativas WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
}

/**
 * Limpa respostas processadas (sem arquivar)
 */
function limparProcessadas() {
    if (!db) throw new Error('Banco não inicializado');

    const stmt = db.prepare('DELETE FROM whatsapp_respostas_ativas WHERE processada = 1');
    const result = stmt.run();

    console.log(`[WhatsAppRespostas] 🧹 Limpas ${result.changes} respostas processadas`);
    return result.changes;
}

// ============================================================================
// CONSULTAS E ESTATÍSTICAS
// ============================================================================

/**
 * Busca resposta por confirmação ID
 */
function getRespostaByConfirmacaoId(confirmacaoId) {
    if (!db) throw new Error('Banco não inicializado');

    const stmt = db.prepare(`
        SELECT * FROM whatsapp_respostas_ativas
        WHERE confirmacao_id = ?
        ORDER BY timestamp DESC
        LIMIT 1
    `);

    return stmt.get(confirmacaoId);
}

/**
 * Busca respostas por telefone
 */
function getRespostasByTelefone(telefone) {
    if (!db) throw new Error('Banco não inicializado');

    const stmt = db.prepare(`
        SELECT * FROM whatsapp_respostas_ativas
        WHERE telefone = ?
        ORDER BY timestamp DESC
    `);

    return stmt.all(telefone);
}

/**
 * Retorna estatísticas de respostas
 */
function getStats() {
    if (!db) throw new Error('Banco não inicializado');

    const stmt = db.prepare('SELECT * FROM vw_whatsapp_respostas_stats');
    return stmt.get();
}

/**
 * Retorna histórico de respostas
 */
function getHistorico(limite = 100) {
    if (!db) throw new Error('Banco não inicializado');

    const stmt = db.prepare(`
        SELECT * FROM whatsapp_respostas_historico
        ORDER BY arquivado_em DESC
        LIMIT ?
    `);

    return stmt.all(limite);
}

// ============================================================================
// UTILITÁRIOS
// ============================================================================

/**
 * Converte resposta do SQLite para formato do frontend
 */
function convertToFrontend(respostaSQLite) {
    return {
        id: respostaSQLite.id,
        confirmacaoId: respostaSQLite.confirmacao_id,
        telefone: respostaSQLite.telefone,
        telefoneChat: respostaSQLite.telefone_chat,
        status: respostaSQLite.status,
        tipoDesmarcacao: respostaSQLite.tipo_desmarcacao,
        contexto: respostaSQLite.contexto,
        messageBody: respostaSQLite.message_body,
        timestamp: respostaSQLite.timestamp,
        processada: Boolean(respostaSQLite.processada),
        processadaEm: respostaSQLite.processada_em,
        criadoEm: respostaSQLite.criado_em
    };
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
    init,

    // CRUD
    saveResposta,
    getRespostasPendentes,
    getAllRespostas,
    getRespostaByConfirmacaoId,
    getRespostasByTelefone,
    getUltimaRespostaPorTelefone,
    marcarComoProcessada,
    marcarVariasComoProcessadas,
    deleteResposta,

    // Arquivamento
    arquivarResposta,
    arquivarRespostasAntigas,
    limparProcessadas,

    // Consultas
    getStats,
    getHistorico,

    // Utilitários
    convertToFrontend
};
