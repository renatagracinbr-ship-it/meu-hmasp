/**
 * ============================================================
 * SERVIÇO: Mensagens WhatsApp Centralizadas
 * ============================================================
 * Autor: Sistema HMASP Chat
 * Data: 2025-12-11
 *
 * Descrição:
 * Gerencia todas as mensagens WhatsApp do sistema de forma centralizada.
 * Facilita manutenção, tradução, auditoria e versionamento de mensagens.
 *
 * Funcionalidades:
 * - Busca de mensagens por código
 * - Substituição de variáveis
 * - Registro de envios
 * - Estatísticas de uso
 * - Versionamento de mensagens
 * ============================================================
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class MensagensWhatsAppService {
    constructor() {
        this.dbPath = path.join(__dirname, 'mensagens-whatsapp.db');
        this.db = null;
        this.cache = new Map(); // Cache em memória para performance
        this.cacheExpiry = 60000; // 1 minuto
        this.lastCacheUpdate = null;
    }

    /**
     * Inicializa o banco de dados
     */
    initialize() {
        try {
            console.log('[MensagensWhatsApp] Inicializando banco de dados...');

            // Cria conexão com o banco
            this.db = new Database(this.dbPath);
            this.db.pragma('journal_mode = WAL');

            // Executa o schema se necessário
            const schemaPath = path.join(__dirname, 'schema-mensagens-whatsapp.sql');
            if (fs.existsSync(schemaPath)) {
                const schema = fs.readFileSync(schemaPath, 'utf8');
                this.db.exec(schema);
                console.log('[MensagensWhatsApp] ✅ Schema aplicado com sucesso');
            }

            // Pré-carrega cache
            this.reloadCache();

            console.log('[MensagensWhatsApp] ✅ Banco de dados inicializado');
            return true;
        } catch (error) {
            console.error('[MensagensWhatsApp] ❌ Erro ao inicializar:', error);
            return false;
        }
    }

    /**
     * Recarrega o cache de mensagens
     */
    reloadCache() {
        try {
            const mensagens = this.db.prepare(`
                SELECT * FROM mensagens_whatsapp
                WHERE ativo = 1
            `).all();

            this.cache.clear();
            mensagens.forEach(msg => {
                this.cache.set(msg.codigo, msg);
            });

            this.lastCacheUpdate = Date.now();
            console.log(`[MensagensWhatsApp] Cache recarregado: ${this.cache.size} mensagens`);
        } catch (error) {
            console.error('[MensagensWhatsApp] Erro ao recarregar cache:', error);
        }
    }

    /**
     * Verifica se o cache está expirado
     */
    isCacheExpired() {
        if (!this.lastCacheUpdate) return true;
        return (Date.now() - this.lastCacheUpdate) > this.cacheExpiry;
    }

    /**
     * Busca mensagem por código
     * @param {string} codigo - Código da mensagem
     * @returns {Object|null} - Objeto com dados da mensagem ou null
     */
    getMensagem(codigo) {
        try {
            // Recarrega cache se expirado
            if (this.isCacheExpired()) {
                this.reloadCache();
            }

            // Busca no cache primeiro
            if (this.cache.has(codigo)) {
                return this.cache.get(codigo);
            }

            // Se não encontrou no cache, busca no banco
            const mensagem = this.db.prepare(`
                SELECT * FROM mensagens_whatsapp
                WHERE codigo = ? AND ativo = 1
            `).get(codigo);

            if (mensagem) {
                this.cache.set(codigo, mensagem);
            }

            return mensagem || null;
        } catch (error) {
            console.error(`[MensagensWhatsApp] Erro ao buscar mensagem ${codigo}:`, error);
            return null;
        }
    }

    /**
     * Renderiza mensagem substituindo variáveis
     * @param {string} codigo - Código da mensagem
     * @param {Object} variaveis - Objeto com variáveis {nome: valor}
     * @returns {string|null} - Texto renderizado ou null
     */
    renderMensagem(codigo, variaveis = {}) {
        const mensagem = this.getMensagem(codigo);
        if (!mensagem) {
            console.warn(`[MensagensWhatsApp] Mensagem não encontrada: ${codigo}`);
            return null;
        }

        let textoRenderizado = mensagem.texto;

        // Substitui variáveis
        Object.keys(variaveis).forEach(chave => {
            const regex = new RegExp(`\\{${chave}\\}`, 'g');
            textoRenderizado = textoRenderizado.replace(regex, variaveis[chave]);
        });

        return textoRenderizado;
    }

    /**
     * Registra envio de mensagem
     * @param {Object} dados - Dados do envio
     */
    registrarEnvio(dados) {
        try {
            const mensagem = this.getMensagem(dados.codigo);
            if (!mensagem) {
                console.warn(`[MensagensWhatsApp] Mensagem não encontrada para registro: ${dados.codigo}`);
                return false;
            }

            this.db.prepare(`
                INSERT INTO mensagens_envios_log (
                    mensagem_id, codigo_mensagem, telefone, confirmacao_id,
                    texto_enviado, variaveis_usadas, contexto, fluxo,
                    status, erro_detalhes, enviado_por
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                mensagem.id,
                dados.codigo,
                dados.telefone || null,
                dados.confirmacaoId || null,
                dados.textoEnviado || null,
                JSON.stringify(dados.variaveis || {}),
                dados.contexto || null,
                mensagem.fluxo,
                dados.status || 'enviado',
                dados.erro || null,
                dados.enviadoPor || 'sistema'
            );

            return true;
        } catch (error) {
            console.error('[MensagensWhatsApp] Erro ao registrar envio:', error);
            return false;
        }
    }

    /**
     * Busca mensagens por fluxo
     * @param {string} fluxo - Nome do fluxo
     * @returns {Array} - Array de mensagens
     */
    getMensagensPorFluxo(fluxo) {
        try {
            return this.db.prepare(`
                SELECT * FROM mensagens_whatsapp
                WHERE fluxo = ? AND ativo = 1
                ORDER BY ordem, id
            `).all(fluxo);
        } catch (error) {
            console.error(`[MensagensWhatsApp] Erro ao buscar mensagens do fluxo ${fluxo}:`, error);
            return [];
        }
    }

    /**
     * Busca mensagens por contexto e tentativa (para erros progressivos)
     * @param {string} contexto - Contexto (confirmacao, desmarcacao)
     * @param {number} tentativa - Número da tentativa
     * @returns {Object|null} - Mensagem ou null
     */
    getMensagemErro(contexto, tentativa) {
        try {
            const codigo = `erro_tentativa${tentativa}_${contexto}`;
            return this.getMensagem(codigo);
        } catch (error) {
            console.error(`[MensagensWhatsApp] Erro ao buscar mensagem de erro:`, error);
            return null;
        }
    }

    /**
     * Lista todas as mensagens ativas
     * @returns {Array} - Array de mensagens
     */
    listarTodas() {
        try {
            return this.db.prepare(`
                SELECT * FROM mensagens_whatsapp
                WHERE ativo = 1
                ORDER BY fluxo, categoria, ordem
            `).all();
        } catch (error) {
            console.error('[MensagensWhatsApp] Erro ao listar mensagens:', error);
            return [];
        }
    }

    /**
     * Obtém estatísticas de uso
     * @returns {Object} - Estatísticas
     */
    getEstatisticas() {
        try {
            const estatisticas = {
                totalMensagens: this.db.prepare(`
                    SELECT COUNT(*) as total FROM mensagens_whatsapp WHERE ativo = 1
                `).get().total,

                porFluxo: this.db.prepare(`
                    SELECT * FROM v_mensagens_por_fluxo
                `).all(),

                maisEnviadas: this.db.prepare(`
                    SELECT * FROM v_mensagens_mais_enviadas LIMIT 10
                `).all(),

                enviosHoje: this.db.prepare(`
                    SELECT COUNT(*) as total
                    FROM mensagens_envios_log
                    WHERE DATE(enviado_em) = DATE('now')
                `).get().total,

                enviosUltimos7Dias: this.db.prepare(`
                    SELECT
                        DATE(enviado_em) as data,
                        COUNT(*) as total
                    FROM mensagens_envios_log
                    WHERE DATE(enviado_em) >= DATE('now', '-7 days')
                    GROUP BY DATE(enviado_em)
                    ORDER BY data DESC
                `).all()
            };

            return estatisticas;
        } catch (error) {
            console.error('[MensagensWhatsApp] Erro ao obter estatísticas:', error);
            return {};
        }
    }

    /**
     * Atualiza texto de mensagem
     * @param {string} codigo - Código da mensagem
     * @param {string} novoTexto - Novo texto
     * @param {string} atualizadoPor - Quem atualizou
     */
    atualizarTexto(codigo, novoTexto, atualizadoPor = 'sistema') {
        try {
            const result = this.db.prepare(`
                UPDATE mensagens_whatsapp
                SET
                    texto = ?,
                    versao = versao + 1,
                    atualizado_em = CURRENT_TIMESTAMP
                WHERE codigo = ? AND ativo = 1
            `).run(novoTexto, codigo);

            if (result.changes > 0) {
                // Limpa cache para forçar reload
                this.cache.delete(codigo);
                console.log(`[MensagensWhatsApp] ✅ Mensagem ${codigo} atualizada`);
                return true;
            }

            return false;
        } catch (error) {
            console.error('[MensagensWhatsApp] Erro ao atualizar mensagem:', error);
            return false;
        }
    }

    /**
     * Desativa mensagem (sem deletar)
     * @param {string} codigo - Código da mensagem
     */
    desativarMensagem(codigo) {
        try {
            const result = this.db.prepare(`
                UPDATE mensagens_whatsapp
                SET ativo = 0
                WHERE codigo = ?
            `).run(codigo);

            if (result.changes > 0) {
                this.cache.delete(codigo);
                console.log(`[MensagensWhatsApp] ✅ Mensagem ${codigo} desativada`);
                return true;
            }

            return false;
        } catch (error) {
            console.error('[MensagensWhatsApp] Erro ao desativar mensagem:', error);
            return false;
        }
    }

    /**
     * Adiciona nova mensagem
     * @param {Object} mensagem - Dados da mensagem
     */
    adicionarMensagem(mensagem) {
        try {
            const result = this.db.prepare(`
                INSERT INTO mensagens_whatsapp (
                    codigo, fluxo, categoria, contexto, titulo, texto,
                    tipo_envio, variaveis_disponiveis, gatilho_condicao,
                    possui_botoes, config_botoes, tentativa_numero,
                    ativo, criado_por
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                mensagem.codigo,
                mensagem.fluxo,
                mensagem.categoria,
                mensagem.contexto || null,
                mensagem.titulo || null,
                mensagem.texto,
                mensagem.tipoEnvio || 'msg_reply',
                JSON.stringify(mensagem.variaveisDisponiveis || []),
                mensagem.gatilhoCondicao || null,
                mensagem.possuiBotoes ? 1 : 0,
                mensagem.configBotoes ? JSON.stringify(mensagem.configBotoes) : null,
                mensagem.tentativaNumero || null,
                mensagem.ativo !== false ? 1 : 0,
                mensagem.criadoPor || 'sistema'
            );

            if (result.changes > 0) {
                this.reloadCache(); // Recarrega cache
                console.log(`[MensagensWhatsApp] ✅ Mensagem ${mensagem.codigo} adicionada`);
                return true;
            }

            return false;
        } catch (error) {
            console.error('[MensagensWhatsApp] Erro ao adicionar mensagem:', error);
            return false;
        }
    }

    /**
     * Exporta todas as mensagens para JSON (backup/tradução)
     * @returns {Array} - Array de mensagens
     */
    exportarParaJSON() {
        try {
            return this.listarTodas();
        } catch (error) {
            console.error('[MensagensWhatsApp] Erro ao exportar:', error);
            return [];
        }
    }

    /**
     * Fecha conexão com o banco
     */
    close() {
        if (this.db) {
            this.db.close();
            console.log('[MensagensWhatsApp] Banco de dados fechado');
        }
    }
}

// Singleton
const instance = new MensagensWhatsAppService();

module.exports = instance;
