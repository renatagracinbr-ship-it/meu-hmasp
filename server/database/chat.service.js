/**
 * ============================================================
 * SERVICO: Chat Proprio - Meu HMASP
 * ============================================================
 * Gerencia conversas e mensagens entre operadores e pacientes
 * Substitui a integracao com WhatsApp
 * ============================================================
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class ChatService {
    constructor() {
        this.dbPath = path.join(__dirname, 'chat.db');
        this.db = null;
    }

    /**
     * Inicializa o banco de dados
     */
    initialize() {
        try {
            console.log('[Chat] Inicializando banco de dados...');

            // Cria conexao com o banco
            this.db = new Database(this.dbPath);
            this.db.pragma('journal_mode = WAL');

            // Executa o schema
            const schemaPath = path.join(__dirname, 'schema-chat.sql');
            if (fs.existsSync(schemaPath)) {
                const schema = fs.readFileSync(schemaPath, 'utf8');
                this.db.exec(schema);
                console.log('[Chat] Schema aplicado com sucesso');
            }

            console.log('[Chat] Banco de dados inicializado');
            return true;
        } catch (error) {
            console.error('[Chat] Erro ao inicializar:', error);
            return false;
        }
    }

    // ============================================================
    // CONVERSAS
    // ============================================================

    /**
     * Busca ou cria uma conversa para um paciente
     * @param {string} pacienteId - Prontuario ou ID do paciente
     * @param {string} pacienteNome - Nome do paciente
     * @param {string} pacienteTelefone - Telefone (opcional)
     */
    getOrCreateConversa(pacienteId, pacienteNome = null, pacienteTelefone = null) {
        try {
            // Tenta buscar conversa existente
            let conversa = this.db.prepare(`
                SELECT * FROM chat_conversas WHERE paciente_id = ?
            `).get(pacienteId);

            if (conversa) {
                // Atualiza dados se fornecidos
                if (pacienteNome || pacienteTelefone) {
                    this.db.prepare(`
                        UPDATE chat_conversas
                        SET paciente_nome = COALESCE(?, paciente_nome),
                            paciente_telefone = COALESCE(?, paciente_telefone)
                        WHERE id = ?
                    `).run(pacienteNome, pacienteTelefone, conversa.id);

                    conversa = this.db.prepare(`
                        SELECT * FROM chat_conversas WHERE id = ?
                    `).get(conversa.id);
                }
                return conversa;
            }

            // Cria nova conversa
            const result = this.db.prepare(`
                INSERT INTO chat_conversas (paciente_id, paciente_nome, paciente_telefone)
                VALUES (?, ?, ?)
            `).run(pacienteId, pacienteNome, pacienteTelefone);

            return this.db.prepare(`
                SELECT * FROM chat_conversas WHERE id = ?
            `).get(result.lastInsertRowid);

        } catch (error) {
            console.error('[Chat] Erro ao buscar/criar conversa:', error);
            throw error;
        }
    }

    /**
     * Lista todas as conversas ativas
     * @param {Object} options - Opcoes de filtro
     */
    listarConversas(options = {}) {
        try {
            const { status = 'ativa', limit = 50, offset = 0 } = options;

            const conversas = this.db.prepare(`
                SELECT
                    c.*,
                    (SELECT COUNT(*) FROM chat_mensagens WHERE conversa_id = c.id) as total_mensagens
                FROM chat_conversas c
                WHERE c.status = ?
                ORDER BY c.ultima_mensagem_at DESC NULLS LAST, c.created_at DESC
                LIMIT ? OFFSET ?
            `).all(status, limit, offset);

            return conversas;
        } catch (error) {
            console.error('[Chat] Erro ao listar conversas:', error);
            throw error;
        }
    }

    /**
     * Busca uma conversa por ID
     */
    getConversa(conversaId) {
        try {
            return this.db.prepare(`
                SELECT * FROM chat_conversas WHERE id = ?
            `).get(conversaId);
        } catch (error) {
            console.error('[Chat] Erro ao buscar conversa:', error);
            throw error;
        }
    }

    /**
     * Busca conversa por paciente_id
     */
    getConversaPorPaciente(pacienteId) {
        try {
            return this.db.prepare(`
                SELECT * FROM chat_conversas WHERE paciente_id = ?
            `).get(pacienteId);
        } catch (error) {
            console.error('[Chat] Erro ao buscar conversa por paciente:', error);
            throw error;
        }
    }

    /**
     * Arquiva uma conversa
     */
    arquivarConversa(conversaId) {
        try {
            this.db.prepare(`
                UPDATE chat_conversas SET status = 'arquivada' WHERE id = ?
            `).run(conversaId);
            return true;
        } catch (error) {
            console.error('[Chat] Erro ao arquivar conversa:', error);
            throw error;
        }
    }

    // ============================================================
    // MENSAGENS
    // ============================================================

    /**
     * Envia uma mensagem
     * @param {Object} dados - Dados da mensagem
     */
    enviarMensagem(dados) {
        try {
            const {
                conversaId,
                remetenteTipo,  // 'paciente' ou 'operador'
                remetenteId = null,
                remetenteNome = null,
                conteudo,
                tipo = 'texto'
            } = dados;

            // Valida dados obrigatorios
            if (!conversaId || !remetenteTipo || !conteudo) {
                throw new Error('Dados obrigatorios: conversaId, remetenteTipo, conteudo');
            }

            // Insere mensagem
            const result = this.db.prepare(`
                INSERT INTO chat_mensagens
                (conversa_id, remetente_tipo, remetente_id, remetente_nome, tipo, conteudo)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(conversaId, remetenteTipo, remetenteId, remetenteNome, tipo, conteudo);

            // Retorna mensagem criada
            const mensagem = this.db.prepare(`
                SELECT * FROM chat_mensagens WHERE id = ?
            `).get(result.lastInsertRowid);

            console.log(`[Chat] Mensagem enviada: ${mensagem.id} (${remetenteTipo})`);
            return mensagem;

        } catch (error) {
            console.error('[Chat] Erro ao enviar mensagem:', error);
            throw error;
        }
    }

    /**
     * Lista mensagens de uma conversa
     * @param {number} conversaId - ID da conversa
     * @param {Object} options - Opcoes
     */
    listarMensagens(conversaId, options = {}) {
        try {
            const { limit = 50, offset = 0, ordem = 'ASC' } = options;

            const mensagens = this.db.prepare(`
                SELECT * FROM chat_mensagens
                WHERE conversa_id = ?
                ORDER BY created_at ${ordem === 'DESC' ? 'DESC' : 'ASC'}
                LIMIT ? OFFSET ?
            `).all(conversaId, limit, offset);

            return mensagens;
        } catch (error) {
            console.error('[Chat] Erro ao listar mensagens:', error);
            throw error;
        }
    }

    /**
     * Busca mensagens mais recentes (para polling)
     * @param {number} conversaId - ID da conversa
     * @param {string} aposTimestamp - Buscar mensagens apos este timestamp
     */
    getMensagensRecentes(conversaId, aposTimestamp = null) {
        try {
            if (aposTimestamp) {
                return this.db.prepare(`
                    SELECT * FROM chat_mensagens
                    WHERE conversa_id = ? AND created_at > ?
                    ORDER BY created_at ASC
                `).all(conversaId, aposTimestamp);
            }

            // Se nao tem timestamp, retorna ultimas 20
            return this.db.prepare(`
                SELECT * FROM chat_mensagens
                WHERE conversa_id = ?
                ORDER BY created_at DESC
                LIMIT 20
            `).all(conversaId).reverse();

        } catch (error) {
            console.error('[Chat] Erro ao buscar mensagens recentes:', error);
            throw error;
        }
    }

    /**
     * Marca mensagens como lidas
     * @param {number} conversaId - ID da conversa
     * @param {string} leitoPor - 'paciente' ou 'operador'
     */
    marcarComoLidas(conversaId, lidoPor) {
        try {
            const tipoOposto = lidoPor === 'paciente' ? 'operador' : 'paciente';

            // Marca mensagens como lidas
            this.db.prepare(`
                UPDATE chat_mensagens
                SET status = 'lida', lida_at = CURRENT_TIMESTAMP
                WHERE conversa_id = ?
                    AND remetente_tipo = ?
                    AND status != 'lida'
            `).run(conversaId, tipoOposto);

            // Zera contador de nao lidas
            const campo = lidoPor === 'operador'
                ? 'mensagens_nao_lidas_operador'
                : 'mensagens_nao_lidas_paciente';

            this.db.prepare(`
                UPDATE chat_conversas
                SET ${campo} = 0
                WHERE id = ?
            `).run(conversaId);

            return true;
        } catch (error) {
            console.error('[Chat] Erro ao marcar como lidas:', error);
            throw error;
        }
    }

    // ============================================================
    // OPERADORES ONLINE
    // ============================================================

    /**
     * Registra operador como online
     */
    registrarOperadorOnline(operadorId, operadorNome) {
        try {
            this.db.prepare(`
                INSERT INTO chat_operadores_online (operador_id, operador_nome, ultimo_ping)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(operador_id) DO UPDATE SET
                    operador_nome = excluded.operador_nome,
                    ultimo_ping = CURRENT_TIMESTAMP,
                    status = 'online'
            `).run(operadorId, operadorNome);
            return true;
        } catch (error) {
            console.error('[Chat] Erro ao registrar operador:', error);
            throw error;
        }
    }

    /**
     * Lista operadores online (ping nos ultimos 2 minutos)
     */
    listarOperadoresOnline() {
        try {
            return this.db.prepare(`
                SELECT * FROM chat_operadores_online
                WHERE ultimo_ping >= datetime('now', '-2 minutes')
                ORDER BY operador_nome
            `).all();
        } catch (error) {
            console.error('[Chat] Erro ao listar operadores:', error);
            throw error;
        }
    }

    /**
     * Remove operador offline
     */
    removerOperadorOffline(operadorId) {
        try {
            this.db.prepare(`
                DELETE FROM chat_operadores_online WHERE operador_id = ?
            `).run(operadorId);
            return true;
        } catch (error) {
            console.error('[Chat] Erro ao remover operador:', error);
            throw error;
        }
    }

    // ============================================================
    // ESTATISTICAS
    // ============================================================

    /**
     * Retorna estatisticas do chat
     */
    getEstatisticas() {
        try {
            const stats = {
                totalConversas: 0,
                conversasAtivas: 0,
                totalMensagens: 0,
                mensagensHoje: 0,
                operadoresOnline: 0
            };

            stats.totalConversas = this.db.prepare(`
                SELECT COUNT(*) as count FROM chat_conversas
            `).get().count;

            stats.conversasAtivas = this.db.prepare(`
                SELECT COUNT(*) as count FROM chat_conversas WHERE status = 'ativa'
            `).get().count;

            stats.totalMensagens = this.db.prepare(`
                SELECT COUNT(*) as count FROM chat_mensagens
            `).get().count;

            stats.mensagensHoje = this.db.prepare(`
                SELECT COUNT(*) as count FROM chat_mensagens
                WHERE DATE(created_at) = DATE('now')
            `).get().count;

            stats.operadoresOnline = this.listarOperadoresOnline().length;

            return stats;
        } catch (error) {
            console.error('[Chat] Erro ao buscar estatisticas:', error);
            throw error;
        }
    }

    /**
     * Conta mensagens nao lidas (para badge)
     */
    contarNaoLidas() {
        try {
            const result = this.db.prepare(`
                SELECT SUM(mensagens_nao_lidas_operador) as total
                FROM chat_conversas
                WHERE status = 'ativa'
            `).get();

            return result.total || 0;
        } catch (error) {
            console.error('[Chat] Erro ao contar nao lidas:', error);
            return 0;
        }
    }
}

// Exporta instancia singleton
const chatService = new ChatService();
module.exports = chatService;
