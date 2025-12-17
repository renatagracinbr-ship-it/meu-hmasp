/**
 * Serviço de Gerenciamento de Contatos
 * Agenda completa integrada com WhatsApp e AGHUse
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

class ContatosService {
    constructor() {
        this.dbPath = path.join(__dirname, 'contatos.db');
        this.db = null;
        this.cache = new Map(); // Cache de contatos frequentes
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutos
        this.init();
    }

    /**
     * Inicializa banco de dados
     */
    init() {
        try {
            this.db = new Database(this.dbPath);
            this.db.pragma('journal_mode = WAL');

            // Aplica schema
            const schemaPath = path.join(__dirname, 'schema-contatos.sql');
            if (fs.existsSync(schemaPath)) {
                const schema = fs.readFileSync(schemaPath, 'utf8');
                this.db.exec(schema);
                console.log('[ContatosService] ✅ Schema aplicado');
            }

            console.log('[ContatosService] ✅ Banco de dados inicializado');
        } catch (error) {
            console.error('[ContatosService] ❌ Erro ao inicializar:', error);
            throw error;
        }
    }

    /**
     * Normaliza telefone (remove formatação)
     */
    normalizarTelefone(telefone) {
        if (!telefone) return null;
        return telefone.replace(/\D/g, '');
    }

    /**
     * Formata telefone para WhatsApp ID
     */
    formatarWhatsAppId(telefone) {
        const normalizado = this.normalizarTelefone(telefone);
        if (!normalizado) return null;
        return `${normalizado}@c.us`;
    }

    // ====================================================================
    // CRUD - Contatos
    // ====================================================================

    /**
     * Cria novo contato
     */
    criarContato(dados) {
        try {
            const telefoneNormalizado = this.normalizarTelefone(dados.telefone);
            if (!telefoneNormalizado) {
                throw new Error('Telefone inválido');
            }

            const whatsappId = this.formatarWhatsAppId(telefoneNormalizado);

            const stmt = this.db.prepare(`
                INSERT INTO contatos (
                    telefone, whatsapp_id, nome_completo, nome_preferido,
                    cpf, data_nascimento, genero, prontuario, codigo_paciente,
                    telefone_secundario, email, cep, logradouro, numero,
                    complemento, bairro, cidade, estado, plano_saude,
                    numero_carteirinha, aceita_mensagens, data_opt_in,
                    observacoes, criado_por
                ) VALUES (
                    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                )
            `);

            const result = stmt.run(
                telefoneNormalizado,
                whatsappId,
                dados.nome_completo,
                dados.nome_preferido || null,
                dados.cpf || null,
                dados.data_nascimento || null,
                dados.genero || null,
                dados.prontuario || null,
                dados.codigo_paciente || null,
                dados.telefone_secundario ? this.normalizarTelefone(dados.telefone_secundario) : null,
                dados.email || null,
                dados.cep || null,
                dados.logradouro || null,
                dados.numero || null,
                dados.complemento || null,
                dados.bairro || null,
                dados.cidade || null,
                dados.estado || null,
                dados.plano_saude || null,
                dados.numero_carteirinha || null,
                dados.aceita_mensagens !== undefined ? (dados.aceita_mensagens ? 1 : 0) : 1,
                dados.aceita_mensagens ? new Date().toISOString() : null,
                dados.observacoes || null,
                dados.criado_por || 'sistema'
            );

            console.log(`[ContatosService] ✅ Contato criado: ${dados.nome_completo} (ID: ${result.lastInsertRowid})`);
            return result.lastInsertRowid;
        } catch (error) {
            if (error.message.includes('UNIQUE constraint')) {
                console.error('[ContatosService] ❌ Telefone já cadastrado');
                throw new Error('Telefone já cadastrado');
            }
            console.error('[ContatosService] ❌ Erro ao criar contato:', error);
            throw error;
        }
    }

    /**
     * Busca contato por telefone
     */
    buscarPorTelefone(telefone) {
        try {
            const telefoneNormalizado = this.normalizarTelefone(telefone);
            if (!telefoneNormalizado) return null;

            // Verifica cache
            const cacheKey = `tel_${telefoneNormalizado}`;
            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheExpiry) {
                    return cached.data;
                }
            }

            const stmt = this.db.prepare('SELECT * FROM contatos WHERE telefone = ?');
            const contato = stmt.get(telefoneNormalizado);

            // Armazena no cache
            if (contato) {
                this.cache.set(cacheKey, { data: contato, timestamp: Date.now() });
            }

            return contato;
        } catch (error) {
            console.error('[ContatosService] ❌ Erro ao buscar por telefone:', error);
            return null;
        }
    }

    /**
     * Busca contato por ID
     */
    buscarPorId(id) {
        try {
            const stmt = this.db.prepare('SELECT * FROM contatos WHERE id = ?');
            return stmt.get(id);
        } catch (error) {
            console.error('[ContatosService] ❌ Erro ao buscar por ID:', error);
            return null;
        }
    }

    /**
     * Busca contato por prontuário
     */
    buscarPorProntuario(prontuario) {
        try {
            const stmt = this.db.prepare('SELECT * FROM contatos WHERE prontuario = ?');
            return stmt.get(prontuario);
        } catch (error) {
            console.error('[ContatosService] ❌ Erro ao buscar por prontuário:', error);
            return null;
        }
    }

    /**
     * Busca contato por CPF
     */
    buscarPorCPF(cpf) {
        try {
            const stmt = this.db.prepare('SELECT * FROM contatos WHERE cpf = ?');
            return stmt.get(cpf);
        } catch (error) {
            console.error('[ContatosService] ❌ Erro ao buscar por CPF:', error);
            return null;
        }
    }

    /**
     * Busca contatos por nome (partial match)
     */
    buscarPorNome(nome, limit = 50) {
        try {
            const stmt = this.db.prepare(`
                SELECT * FROM contatos
                WHERE nome_completo LIKE ?
                  AND ativo = 1
                ORDER BY nome_completo
                LIMIT ?
            `);
            return stmt.all(`%${nome}%`, limit);
        } catch (error) {
            console.error('[ContatosService] ❌ Erro ao buscar por nome:', error);
            return [];
        }
    }

    /**
     * Lista todos os contatos (com paginação)
     */
    listarTodos(opcoes = {}) {
        try {
            const {
                offset = 0,
                limit = 100,
                ativo = true,
                orderBy = 'nome_completo',
                orderDir = 'ASC'
            } = opcoes;

            let query = 'SELECT * FROM contatos WHERE 1=1';

            if (ativo !== null) {
                query += ` AND ativo = ${ativo ? 1 : 0}`;
            }

            query += ` ORDER BY ${orderBy} ${orderDir} LIMIT ? OFFSET ?`;

            const stmt = this.db.prepare(query);
            return stmt.all(limit, offset);
        } catch (error) {
            console.error('[ContatosService] ❌ Erro ao listar contatos:', error);
            return [];
        }
    }

    /**
     * Atualiza contato
     */
    atualizarContato(id, dados) {
        try {
            const campos = [];
            const valores = [];

            // Campos atualizáveis
            const camposPermitidos = [
                'nome_completo', 'nome_preferido', 'cpf', 'data_nascimento', 'genero',
                'prontuario', 'codigo_paciente', 'telefone_secundario', 'email',
                'cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'estado',
                'plano_saude', 'numero_carteirinha', 'aceita_mensagens', 'observacoes',
                'foto_perfil_url', 'pushname', 'about'
            ];

            for (const campo of camposPermitidos) {
                if (dados[campo] !== undefined) {
                    campos.push(`${campo} = ?`);
                    valores.push(dados[campo]);
                }
            }

            if (campos.length === 0) {
                console.warn('[ContatosService] ⚠️  Nenhum campo para atualizar');
                return false;
            }

            // Adiciona atualizado_por
            if (dados.atualizado_por) {
                campos.push('atualizado_por = ?');
                valores.push(dados.atualizado_por);
            }

            valores.push(id);

            const query = `UPDATE contatos SET ${campos.join(', ')} WHERE id = ?`;
            const stmt = this.db.prepare(query);
            const result = stmt.run(...valores);

            // Limpa cache
            const contato = this.buscarPorId(id);
            if (contato) {
                this.cache.delete(`tel_${contato.telefone}`);
            }

            console.log(`[ContatosService] ✅ Contato atualizado: ID ${id}`);
            return result.changes > 0;
        } catch (error) {
            console.error('[ContatosService] ❌ Erro ao atualizar contato:', error);
            return false;
        }
    }

    /**
     * Desativa contato (soft delete)
     */
    desativarContato(id, motivo = null) {
        try {
            const stmt = this.db.prepare(`
                UPDATE contatos
                SET ativo = 0, atualizado_em = CURRENT_TIMESTAMP
                WHERE id = ?
            `);

            const result = stmt.run(id);

            // Limpa cache
            const contato = this.buscarPorId(id);
            if (contato) {
                this.cache.delete(`tel_${contato.telefone}`);
            }

            console.log(`[ContatosService] ✅ Contato desativado: ID ${id}`);
            return result.changes > 0;
        } catch (error) {
            console.error('[ContatosService] ❌ Erro ao desativar contato:', error);
            return false;
        }
    }

    /**
     * Bloqueia contato
     */
    bloquearContato(id, motivo) {
        try {
            const stmt = this.db.prepare(`
                UPDATE contatos
                SET bloqueado = 1, motivo_bloqueio = ?, atualizado_em = CURRENT_TIMESTAMP
                WHERE id = ?
            `);

            const result = stmt.run(motivo, id);
            console.log(`[ContatosService] ✅ Contato bloqueado: ID ${id} - Motivo: ${motivo}`);
            return result.changes > 0;
        } catch (error) {
            console.error('[ContatosService] ❌ Erro ao bloquear contato:', error);
            return false;
        }
    }

    // ====================================================================
    // Sincronização WhatsApp
    // ====================================================================

    /**
     * Atualiza dados do WhatsApp
     */
    atualizarDadosWhatsApp(telefone, dadosWhatsApp) {
        try {
            const telefoneNormalizado = this.normalizarTelefone(telefone);
            let contato = this.buscarPorTelefone(telefoneNormalizado);

            const dados = {
                foto_perfil_url: dadosWhatsApp.profilePicUrl || null,
                pushname: dadosWhatsApp.pushname || null,
                about: dadosWhatsApp.about || null,
                tem_whatsapp: true,
                sincronizado_whatsapp: true,
                ultima_sincronizacao_whatsapp: new Date().toISOString()
            };

            if (contato) {
                // Atualiza existente
                this.atualizarContato(contato.id, dados);
                return contato.id;
            } else {
                // Cria novo
                const novoContato = {
                    telefone: telefoneNormalizado,
                    nome_completo: dadosWhatsApp.pushname || telefoneNormalizado,
                    ...dados
                };
                return this.criarContato(novoContato);
            }
        } catch (error) {
            console.error('[ContatosService] ❌ Erro ao atualizar dados WhatsApp:', error);
            return null;
        }
    }

    // ====================================================================
    // Estatísticas
    // ====================================================================

    /**
     * Atualiza estatísticas de confirmações
     */
    atualizarEstatisticas(telefone, tipo) {
        try {
            const telefoneNormalizado = this.normalizarTelefone(telefone);
            const contato = this.buscarPorTelefone(telefoneNormalizado);

            if (!contato) return false;

            const campos = {
                confirmacao_enviada: 'total_confirmacoes = total_confirmacoes + 1',
                resposta_recebida: 'total_respostas = total_respostas + 1'
            };

            const campo = campos[tipo];
            if (!campo) return false;

            const stmt = this.db.prepare(`
                UPDATE contatos
                SET ${campo}
                WHERE id = ?
            `);

            stmt.run(contato.id);
            return true;
        } catch (error) {
            console.error('[ContatosService] ❌ Erro ao atualizar estatísticas:', error);
            return false;
        }
    }

    /**
     * Registra interação
     */
    registrarInteracao(dados) {
        try {
            const telefoneNormalizado = this.normalizarTelefone(dados.telefone);
            const contato = this.buscarPorTelefone(telefoneNormalizado);

            if (!contato) {
                console.warn('[ContatosService] ⚠️  Contato não encontrado para registrar interação');
                return null;
            }

            const stmt = this.db.prepare(`
                INSERT INTO contatos_interacoes (
                    contato_id, tipo, direcao, texto, template_usado,
                    resposta_texto, intencao_detectada, confidence,
                    consulta_id, confirmacao_id, metadata,
                    enviada_em, recebida_em
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const result = stmt.run(
                contato.id,
                dados.tipo,
                dados.direcao,
                dados.texto || null,
                dados.template_usado || null,
                dados.resposta_texto || null,
                dados.intencao_detectada || null,
                dados.confidence || null,
                dados.consulta_id || null,
                dados.confirmacao_id || null,
                dados.metadata ? JSON.stringify(dados.metadata) : null,
                dados.enviada_em || (dados.direcao === 'enviada' ? new Date().toISOString() : null),
                dados.recebida_em || (dados.direcao === 'recebida' ? new Date().toISOString() : null)
            );

            console.log(`[ContatosService] ✅ Interação registrada: ${contato.nome_completo} (${dados.tipo})`);
            return result.lastInsertRowid;
        } catch (error) {
            console.error('[ContatosService] ❌ Erro ao registrar interação:', error);
            return null;
        }
    }

    // ====================================================================
    // Grupos/Labels
    // ====================================================================

    /**
     * Adiciona contato a um grupo
     */
    adicionarAoGrupo(contatoId, grupoId, adicionadoPor = 'sistema') {
        try {
            const stmt = this.db.prepare(`
                INSERT OR IGNORE INTO contatos_grupos_rel (contato_id, grupo_id, adicionado_por)
                VALUES (?, ?, ?)
            `);

            stmt.run(contatoId, grupoId, adicionadoPor);
            console.log(`[ContatosService] ✅ Contato ${contatoId} adicionado ao grupo ${grupoId}`);
            return true;
        } catch (error) {
            console.error('[ContatosService] ❌ Erro ao adicionar ao grupo:', error);
            return false;
        }
    }

    /**
     * Remove contato de um grupo
     */
    removerDoGrupo(contatoId, grupoId) {
        try {
            const stmt = this.db.prepare(`
                DELETE FROM contatos_grupos_rel
                WHERE contato_id = ? AND grupo_id = ?
            `);

            stmt.run(contatoId, grupoId);
            console.log(`[ContatosService] ✅ Contato ${contatoId} removido do grupo ${grupoId}`);
            return true;
        } catch (error) {
            console.error('[ContatosService] ❌ Erro ao remover do grupo:', error);
            return false;
        }
    }

    /**
     * Lista grupos do contato
     */
    listarGruposDoContato(contatoId) {
        try {
            const stmt = this.db.prepare(`
                SELECT g.*
                FROM contatos_grupos g
                INNER JOIN contatos_grupos_rel cgr ON g.id = cgr.grupo_id
                WHERE cgr.contato_id = ?
                ORDER BY g.nome
            `);

            return stmt.all(contatoId);
        } catch (error) {
            console.error('[ContatosService] ❌ Erro ao listar grupos:', error);
            return [];
        }
    }

    // ====================================================================
    // Notas
    // ====================================================================

    /**
     * Adiciona nota a um contato
     */
    adicionarNota(contatoId, nota, tipo = 'info', criadoPor = 'sistema') {
        try {
            const stmt = this.db.prepare(`
                INSERT INTO contatos_notas (contato_id, nota, tipo, criada_por)
                VALUES (?, ?, ?, ?)
            `);

            const result = stmt.run(contatoId, nota, tipo, criadoPor);
            console.log(`[ContatosService] ✅ Nota adicionada ao contato ${contatoId}`);
            return result.lastInsertRowid;
        } catch (error) {
            console.error('[ContatosService] ❌ Erro ao adicionar nota:', error);
            return null;
        }
    }

    /**
     * Lista notas de um contato
     */
    listarNotasDoContato(contatoId) {
        try {
            const stmt = this.db.prepare(`
                SELECT * FROM contatos_notas
                WHERE contato_id = ?
                ORDER BY fixada DESC, criada_em DESC
            `);

            return stmt.all(contatoId);
        } catch (error) {
            console.error('[ContatosService] ❌ Erro ao listar notas:', error);
            return [];
        }
    }

    // ====================================================================
    // Relatórios e Views
    // ====================================================================

    /**
     * Retorna estatísticas gerais
     */
    getEstatisticasGerais() {
        try {
            const stmt = this.db.prepare(`
                SELECT
                    COUNT(*) as total_contatos,
                    SUM(CASE WHEN ativo = 1 THEN 1 ELSE 0 END) as ativos,
                    SUM(CASE WHEN tem_whatsapp = 1 THEN 1 ELSE 0 END) as com_whatsapp,
                    SUM(CASE WHEN aceita_mensagens = 1 THEN 1 ELSE 0 END) as aceitam_mensagens,
                    SUM(CASE WHEN bloqueado = 1 THEN 1 ELSE 0 END) as bloqueados,
                    AVG(taxa_resposta) as taxa_resposta_media
                FROM contatos
            `);

            return stmt.get();
        } catch (error) {
            console.error('[ContatosService] ❌ Erro ao buscar estatísticas:', error);
            return null;
        }
    }

    /**
     * Lista contatos sem resposta
     */
    getContatosSemResposta(limit = 50) {
        try {
            const stmt = this.db.prepare(`
                SELECT * FROM vw_contatos_sem_resposta
                LIMIT ?
            `);

            return stmt.all(limit);
        } catch (error) {
            console.error('[ContatosService] ❌ Erro ao buscar contatos sem resposta:', error);
            return [];
        }
    }

    /**
     * Lista contatos prioritários
     */
    getContatosPrioritarios(limit = 100) {
        try {
            const stmt = this.db.prepare(`
                SELECT * FROM vw_contatos_prioritarios
                LIMIT ?
            `);

            return stmt.all(limit);
        } catch (error) {
            console.error('[ContatosService] ❌ Erro ao buscar contatos prioritários:', error);
            return [];
        }
    }

    /**
     * Fecha conexão com banco
     */
    close() {
        if (this.db) {
            this.db.close();
            console.log('[ContatosService] Conexão fechada');
        }
    }
}

// Singleton
const instance = new ContatosService();

module.exports = instance;
