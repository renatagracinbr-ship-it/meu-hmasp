/**
 * Serviço de Gerenciamento de Consultas (SQLite Multi-Usuário)
 *
 * Substitui localStorage por SQLite para consultas ativas e desmarcações.
 * Todos os operadores veem os mesmos dados em tempo real.
 *
 * Funcionalidades:
 * - CRUD de consultas ativas (confirmações)
 * - CRUD de desmarcações ativas
 * - Arquivamento de consultas
 * - Estatísticas em tempo real
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

// Caminho do banco de dados
const DB_PATH = path.join(__dirname, 'hmasp_consultas.db');
const schemaPath = path.join(__dirname, 'schema-consultas.sql');

let db = null;

/**
 * Inicializa o banco de dados
 */
function init() {
    try {
        console.log('[ConsultasService] Inicializando banco de dados...');
        console.log('[ConsultasService] Caminho:', DB_PATH);

        // Cria conexão
        db = new Database(DB_PATH);

        // Configurações de performance
        db.pragma('journal_mode = WAL'); // Write-Ahead Logging para melhor concorrência
        db.pragma('synchronous = NORMAL'); // Balance entre segurança e performance

        // Executa schema
        if (!fs.existsSync(schemaPath)) {
            throw new Error(`Schema não encontrado: ${schemaPath}`);
        }

        const schema = fs.readFileSync(schemaPath, 'utf-8');
        db.exec(schema);

        console.log('[ConsultasService] ✅ Banco de dados inicializado');
        return true;
    } catch (error) {
        console.error('[ConsultasService] ❌ Erro ao inicializar:', error);
        throw error;
    }
}

// ============================================================================
// CONSULTAS ATIVAS (Aba Confirmação)
// ============================================================================

/**
 * Cria ou atualiza uma consulta ativa
 */
function upsertConsultaAtiva(params) {
    if (!db) throw new Error('Banco não inicializado');

    const {
        id = uuidv4(),
        consultaNumero,
        nomePaciente,
        prontuario = '',
        telefone = '',
        telefoneFormatado = '',
        especialidade = '',
        profissional = 'Não informado',
        local = null,
        dataHoraFormatada = '',
        dataConsulta = '',
        tipo = 'marcada', // 'marcada' ou 'lembrete72h'
        statusGeral = 'pending',
        mensagemTemplate = '',
        mensagemEnviada = false,
        dataEnvio = null,
        whatsappMessageId = null,
        dataMarcacao = null,
        dataApareceuDashboard = new Date().toISOString(),
        contextoId = null,
        contextoExpiresAt = null,
        criadoPor = 'sistema',
        // NOVOS CAMPOS ADICIONADOS
        pacCodigo = null,
        nomeExibicao = null,
        dataResposta = null,
        badgeStatus = null,
        badgeInfo = null,
        contexto = 'confirmacao',
        // CAMPOS DE REAGENDAMENTO
        reagendamentoDe = null,
        reagendamentoData = null,
        reagendamentoTipo = null
    } = params;

    const stmt = db.prepare(`
        INSERT INTO consultas_ativas (
            id, consulta_numero, nome_paciente, prontuario, telefone, telefone_formatado,
            especialidade, profissional, local, data_hora_formatada, data_consulta,
            tipo, status_geral,
            mensagem_template, mensagem_enviada, data_envio, whatsapp_message_id,
            data_marcacao, data_apareceu_dashboard,
            contexto_id, contexto_expires_at,
            pac_codigo, nome_exibicao, data_resposta, badge_status, badge_info, contexto,
            reagendamento_de, reagendamento_data, reagendamento_tipo,
            criado_em, atualizado_em, criado_por
        ) VALUES (
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?,
            ?, ?, ?, ?,
            ?, ?,
            ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?,
            datetime('now'), datetime('now'), ?
        )
        ON CONFLICT(consulta_numero, telefone) DO UPDATE SET
            nome_paciente = excluded.nome_paciente,
            especialidade = excluded.especialidade,
            profissional = excluded.profissional,
            local = excluded.local,
            data_hora_formatada = excluded.data_hora_formatada,
            data_consulta = excluded.data_consulta,
            status_geral = excluded.status_geral,
            mensagem_enviada = excluded.mensagem_enviada,
            data_envio = excluded.data_envio,
            whatsapp_message_id = excluded.whatsapp_message_id,
            contexto_id = excluded.contexto_id,
            contexto_expires_at = excluded.contexto_expires_at,
            pac_codigo = excluded.pac_codigo,
            nome_exibicao = excluded.nome_exibicao,
            data_resposta = excluded.data_resposta,
            badge_status = excluded.badge_status,
            badge_info = excluded.badge_info,
            contexto = excluded.contexto,
            reagendamento_de = excluded.reagendamento_de,
            reagendamento_data = excluded.reagendamento_data,
            reagendamento_tipo = excluded.reagendamento_tipo,
            atualizado_em = datetime('now')
    `);

    const result = stmt.run(
        id, String(consultaNumero), nomePaciente, prontuario, telefone, telefoneFormatado,
        especialidade, profissional, local, dataHoraFormatada, dataConsulta,
        tipo, statusGeral,
        mensagemTemplate, mensagemEnviada ? 1 : 0, dataEnvio, whatsappMessageId,
        dataMarcacao, dataApareceuDashboard,
        contextoId, contextoExpiresAt,
        pacCodigo, nomeExibicao, dataResposta, badgeStatus, badgeInfo, contexto,
        reagendamentoDe, reagendamentoData, reagendamentoTipo,
        criadoPor
    );

    console.log(
        reagendamentoDe
            ? `[ConsultasService] ✅ Consulta ${consultaNumero} criada como REAGENDAMENTO (origem: ${reagendamentoDe})`
            : `[ConsultasService] ✅ Consulta ${consultaNumero} criada`
    );

    return {
        success: true,
        id: id,
        consultaNumero: consultaNumero,
        changes: result.changes,
        isReagendamento: !!reagendamentoDe
    };
}

/**
 * Busca consulta ativa por ID
 */
function getConsultaAtiva(id) {
    if (!db) throw new Error('Banco não inicializado');

    const stmt = db.prepare('SELECT * FROM consultas_ativas WHERE id = ?');
    return stmt.get(id);
}

/**
 * Busca consulta ativa por número da consulta
 */
function getConsultaAtivaByNumero(consultaNumero) {
    if (!db) throw new Error('Banco não inicializado');

    const stmt = db.prepare('SELECT * FROM consultas_ativas WHERE consulta_numero = ?');
    return stmt.get(String(consultaNumero));
}

/**
 * Busca todas as consultas ativas
 */
function getAllConsultasAtivas(filtros = {}) {
    if (!db) throw new Error('Banco não inicializado');

    let query = 'SELECT * FROM consultas_ativas WHERE 1=1';
    const params = [];

    // FILTRO AUTOMÁTICO: Apenas consultas com menos de 72h no dashboard
    // (Consultas antigas são automaticamente arquivadas)
    query += ` AND datetime(data_apareceu_dashboard) >= datetime('now', '-72 hours')`;

    if (filtros.tipo) {
        query += ' AND tipo = ?';
        params.push(filtros.tipo);
    }

    if (filtros.statusGeral) {
        query += ' AND status_geral = ?';
        params.push(filtros.statusGeral);
    }

    if (filtros.nomePaciente) {
        query += ' AND nome_paciente LIKE ?';
        params.push(`%${filtros.nomePaciente}%`);
    }

    // Ordenação inteligente por tipo:
    // - Consultas marcadas: ordena por dataMarcacao (quando foi marcada no AGHUse)
    // - Lembretes 72h: ordena por dataApareceuDashboard (quando o lembrete surgiu)
    // Isso garante que consultas recém-marcadas apareçam no topo, misturadas com lembretes recentes
    query += ` ORDER BY
        CASE
            WHEN tipo = 'marcada' THEN data_marcacao
            WHEN tipo = 'lembrete72h' THEN data_apareceu_dashboard
            ELSE data_apareceu_dashboard
        END DESC`;

    const stmt = db.prepare(query);
    return stmt.all(...params);
}

/**
 * Atualiza status de uma consulta ativa
 * IMPORTANTE: Também salva data_resposta para indicar que houve resposta via WhatsApp
 * Isso é necessário para exibir o badge vermelho corretamente após recarregar a página
 */
function updateConsultaStatus(consultaNumero, novoStatus) {
    if (!db) throw new Error('Banco não inicializado');

    const stmt = db.prepare(`
        UPDATE consultas_ativas
        SET status_geral = ?,
            data_resposta = datetime('now'),
            atualizado_em = datetime('now')
        WHERE consulta_numero = ?
    `);

    const result = stmt.run(novoStatus, String(consultaNumero));
    return result.changes > 0;
}

/**
 * Atualiza status da consulta por confirmacaoId
 * IMPORTANTE: Também salva data_resposta para indicar que houve resposta via WhatsApp
 */
function updateConsultaStatusByConfirmacaoId(confirmacaoId, novoStatus) {
    if (!db) throw new Error('Banco não inicializado');

    const stmt = db.prepare(`
        UPDATE consultas_ativas
        SET status_geral = ?,
            data_resposta = datetime('now'),
            contexto = 'confirmacao',
            atualizado_em = datetime('now')
        WHERE id = ?
    `);

    const result = stmt.run(novoStatus, confirmacaoId);

    return {
        success: result.changes > 0,
        confirmacaoId: confirmacaoId,
        changes: result.changes
    };
}

/**
 * Atualiza badgeStatus de uma consulta ativa (para exibir badge vermelho/verde)
 */
function updateBadgeStatus(consultaNumero, badgeStatus) {
    if (!db) throw new Error('Banco não inicializado');

    const stmt = db.prepare(`
        UPDATE consultas_ativas
        SET badge_status = ?,
            atualizado_em = datetime('now')
        WHERE consulta_numero = ?
    `);

    const result = stmt.run(badgeStatus, String(consultaNumero));
    return result.changes > 0;
}

/**
 * Marca mensagem como enviada
 */
function markMensagemEnviada(consultaNumero, whatsappMessageId = null) {
    if (!db) throw new Error('Banco não inicializado');

    const stmt = db.prepare(`
        UPDATE consultas_ativas
        SET mensagem_enviada = 1,
            data_envio = datetime('now'),
            whatsapp_message_id = ?,
            atualizado_em = datetime('now')
        WHERE consulta_numero = ?
    `);

    const result = stmt.run(whatsappMessageId, String(consultaNumero));
    return result.changes > 0;
}

/**
 * Deleta consulta ativa
 */
function deleteConsultaAtiva(id) {
    if (!db) throw new Error('Banco não inicializado');

    const stmt = db.prepare('DELETE FROM consultas_ativas WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
}

// ============================================================================
// DESMARCAÇÕES ATIVAS (Aba Desmarcação)
// ============================================================================

/**
 * Cria ou atualiza uma desmarcação ativa
 */
function upsertDesmarcacaoAtiva(params) {
    if (!db) throw new Error('Banco não inicializado');

    const {
        id = uuidv4(),
        consultaNumero,
        nomePaciente,
        nomeExibicao = '',
        pacCodigo = '',
        prontuario = '',
        telefone = '',
        telefoneFormatado = '',
        especialidade = '',
        profissional = 'Não informado',
        local = null,
        dataHoraFormatada = '',
        dataConsulta = '',
        tipoDesmarcacao = null,
        veioDeConfirmacao = false,
        confirmacaoId = null,
        mensagemTemplate = '',
        mensagemEnviada = false,
        enviarMensagem = true,
        dataEnvio = null,
        whatsappMessageId = null,
        dataDesmarcacao = new Date().toISOString(),
        dataDesmarcacaoFormatada = null,
        dataApareceuDashboard = new Date().toISOString(),
        contextoId = null,
        contextoExpiresAt = null,
        criadoPor = 'sistema',
        // NOVOS CAMPOS ADICIONADOS
        respostaEm = null,
        statusGeral = 'pending',
        dataMarcacao = null,
        contexto = 'desmarcacao',
        status = null,
        // Campos de reagendamento
        reagendada = false,
        reagendadaEm = null,
        novaConsultaNumero = null,
        reagendamentoComunicado = false
    } = params;

    const stmt = db.prepare(`
        INSERT INTO desmarcacoes_ativas (
            id, consulta_numero, nome_paciente, nome_exibicao, pac_codigo, prontuario, telefone, telefone_formatado,
            especialidade, profissional, local, data_hora_formatada, data_consulta,
            tipo_desmarcacao, veio_de_confirmacao, confirmacao_id,
            mensagem_template, mensagem_enviada, enviar_mensagem, data_envio, whatsapp_message_id,
            data_desmarcacao, data_desmarcacao_formatada, data_apareceu_dashboard,
            contexto_id, contexto_expires_at,
            resposta_em, status_geral, data_marcacao, contexto, status,
            reagendada, reagendada_em, nova_consulta_numero, reagendamento_comunicado,
            criado_em, atualizado_em, criado_por
        ) VALUES (
            ?, ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?,
            ?, ?, ?, ?, ?,
            ?, ?, ?, ?,
            datetime('now'), datetime('now'), ?
        )
        ON CONFLICT(consulta_numero, telefone) DO UPDATE SET
            nome_paciente = excluded.nome_paciente,
            nome_exibicao = excluded.nome_exibicao,
            pac_codigo = excluded.pac_codigo,
            prontuario = excluded.prontuario,
            especialidade = excluded.especialidade,
            profissional = excluded.profissional,
            local = excluded.local,
            data_hora_formatada = excluded.data_hora_formatada,
            data_consulta = excluded.data_consulta,
            tipo_desmarcacao = excluded.tipo_desmarcacao,
            mensagem_enviada = excluded.mensagem_enviada,
            data_envio = excluded.data_envio,
            whatsapp_message_id = excluded.whatsapp_message_id,
            contexto_id = excluded.contexto_id,
            contexto_expires_at = excluded.contexto_expires_at,
            data_desmarcacao_formatada = excluded.data_desmarcacao_formatada,
            resposta_em = excluded.resposta_em,
            status_geral = excluded.status_geral,
            data_marcacao = excluded.data_marcacao,
            contexto = excluded.contexto,
            status = excluded.status,
            reagendada = excluded.reagendada,
            reagendada_em = excluded.reagendada_em,
            nova_consulta_numero = excluded.nova_consulta_numero,
            reagendamento_comunicado = excluded.reagendamento_comunicado,
            atualizado_em = datetime('now')
    `);

    const result = stmt.run(
        id, String(consultaNumero), nomePaciente, nomeExibicao, pacCodigo, prontuario, telefone, telefoneFormatado,
        especialidade, profissional, local, dataHoraFormatada, dataConsulta,
        tipoDesmarcacao, veioDeConfirmacao ? 1 : 0, confirmacaoId,
        mensagemTemplate, mensagemEnviada ? 1 : 0, enviarMensagem ? 1 : 0, dataEnvio, whatsappMessageId,
        dataDesmarcacao, dataDesmarcacaoFormatada, dataApareceuDashboard,
        contextoId, contextoExpiresAt,
        respostaEm, statusGeral, dataMarcacao, contexto, status,
        reagendada ? 1 : 0, reagendadaEm, novaConsultaNumero, reagendamentoComunicado ? 1 : 0,
        criadoPor
    );

    return {
        success: true,
        id: id,
        consultaNumero: consultaNumero,
        changes: result.changes
    };
}

/**
 * Busca todas as desmarcações ativas
 */
function getAllDesmarcacoesAtivas(filtros = {}) {
    if (!db) throw new Error('Banco não inicializado');

    let query = 'SELECT * FROM desmarcacoes_ativas WHERE 1=1';
    const params = [];

    // FILTRO AUTOMÁTICO: Apenas desmarcações com menos de 72h no dashboard
    // (Desmarcações antigas são automaticamente arquivadas)
    query += ` AND datetime(data_apareceu_dashboard) >= datetime('now', '-72 hours')`;

    if (filtros.tipoDesmarcacao) {
        query += ' AND tipo_desmarcacao = ?';
        params.push(filtros.tipoDesmarcacao);
    }

    if (filtros.veioDeConfirmacao !== undefined) {
        query += ' AND veio_de_confirmacao = ?';
        params.push(filtros.veioDeConfirmacao ? 1 : 0);
    }

    // Ordena por data de desmarcação (mais recente primeiro)
    query += ' ORDER BY data_desmarcacao DESC';

    const stmt = db.prepare(query);
    return stmt.all(...params);
}

/**
 * Deleta desmarcação ativa
 */
function deleteDesmarcacaoAtiva(id) {
    if (!db) throw new Error('Banco não inicializado');

    const stmt = db.prepare('DELETE FROM desmarcacoes_ativas WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
}

// ============================================================================
// ARQUIVAMENTO
// ============================================================================

/**
 * Arquiva uma consulta ativa
 */
function arquivarConsulta(id, motivo = 'manual', arquivadoPor = 'operador') {
    if (!db) throw new Error('Banco não inicializado');

    // Busca consulta
    const consulta = getConsultaAtiva(id);
    if (!consulta) return false;

    // Inicia transação
    const transaction = db.transaction(() => {
        // Insere no arquivo
        const insertStmt = db.prepare(`
            INSERT INTO consultas_arquivadas (
                id, consulta_numero, tipo_original, dados_completos,
                motivo_arquivamento, arquivado_por,
                data_original, criado_em, arquivado_em
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `);

        insertStmt.run(
            consulta.id,
            consulta.consulta_numero,
            'consulta_ativa',
            JSON.stringify(consulta),
            motivo,
            arquivadoPor,
            consulta.data_consulta,
            consulta.criado_em
        );

        // Remove da tabela ativa
        const deleteStmt = db.prepare('DELETE FROM consultas_ativas WHERE id = ?');
        deleteStmt.run(id);
    });

    transaction();
    return true;
}

/**
 * Arquiva uma desmarcação ativa
 */
function arquivarDesmarcacao(id, motivo = 'manual', arquivadoPor = 'operador') {
    if (!db) throw new Error('Banco não inicializado');

    // Busca desmarcação
    const stmt = db.prepare('SELECT * FROM desmarcacoes_ativas WHERE id = ?');
    const desmarcacao = stmt.get(id);
    if (!desmarcacao) return false;

    // Inicia transação
    const transaction = db.transaction(() => {
        // Insere no arquivo
        const insertStmt = db.prepare(`
            INSERT INTO consultas_arquivadas (
                id, consulta_numero, tipo_original, dados_completos,
                motivo_arquivamento, arquivado_por,
                data_original, criado_em, arquivado_em
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `);

        insertStmt.run(
            desmarcacao.id,
            desmarcacao.consulta_numero,
            'desmarcacao_ativa',
            JSON.stringify(desmarcacao),
            motivo,
            arquivadoPor,
            desmarcacao.data_desmarcacao,
            desmarcacao.criado_em
        );

        // Remove da tabela ativa
        const deleteStmt = db.prepare('DELETE FROM desmarcacoes_ativas WHERE id = ?');
        deleteStmt.run(id);
    });

    transaction();
    return true;
}

/**
 * Busca consultas arquivadas
 */
function getConsultasArquivadas(limite = 100) {
    if (!db) throw new Error('Banco não inicializado');

    const stmt = db.prepare(`
        SELECT * FROM consultas_arquivadas
        ORDER BY arquivado_em DESC
        LIMIT ?
    `);

    return stmt.all(limite);
}

// ============================================================================
// ESTATÍSTICAS
// ============================================================================

/**
 * Retorna estatísticas de confirmações
 */
function getStatsConfirmacoes() {
    if (!db) throw new Error('Banco não inicializado');

    const stmt = db.prepare('SELECT * FROM vw_stats_confirmacoes');
    return stmt.get();
}

/**
 * Retorna estatísticas de desmarcações
 */
function getStatsDesmarcacoes() {
    if (!db) throw new Error('Banco não inicializado');

    const stmt = db.prepare('SELECT * FROM vw_stats_desmarcacoes');
    return stmt.get();
}

/**
 * Atualiza status e tipo_desmarcacao quando paciente responde
 * IMPORTANTE: Também salva resposta_em para indicar que houve resposta via WhatsApp
 *
 * @param {string} desmarcacaoId - ID único da desmarcação
 * @param {string} status - Status da resposta
 * @param {string} tipoDesmarcacao - Tipo de desmarcação
 * @returns {Object} - Resultado da atualização
 */
function updateDesmarcacaoStatus(desmarcacaoId, status, tipoDesmarcacao) {
    if (!db) throw new Error('Banco não inicializado');

    const stmt = db.prepare(`
        UPDATE desmarcacoes_ativas
        SET status = ?,
            tipo_desmarcacao = ?,
            resposta_em = datetime('now'),
            atualizado_em = datetime('now')
        WHERE id = ?
    `);

    const result = stmt.run(status, tipoDesmarcacao, desmarcacaoId);

    return {
        success: result.changes > 0,
        id: desmarcacaoId,
        status,
        tipo_desmarcacao: tipoDesmarcacao,
        changes: result.changes
    };
}

/**
 * Marca desmarcação como reagendada
 *
 * @param {string} consultaNumeroOriginal - Número da consulta desmarcada
 * @param {string} novaConsultaNumero - Número da nova consulta
 * @returns {Object} - Resultado da atualização
 */
function marcarDesmarcacaoComoReagendada(consultaNumeroOriginal, novaConsultaNumero) {
    const stmt = db.prepare(`
        UPDATE desmarcacoes_ativas
        SET reagendada = 1,
            reagendada_em = datetime('now'),
            nova_consulta_numero = ?,
            reagendamento_comunicado = 1,
            atualizado_em = datetime('now')
        WHERE consulta_numero = ?
    `);

    const result = stmt.run(novaConsultaNumero, consultaNumeroOriginal);

    return {
        success: result.changes > 0,
        consultaOriginal: consultaNumeroOriginal,
        novaConsulta: novaConsultaNumero,
        changes: result.changes
    };
}

// ============================================================================
// EXPORTS
// ============================================================================

// ============================================================================
// TELEFONES (Persistência de Arrays)
// ============================================================================

/**
 * Insere ou atualiza telefones de uma confirmação
 * @param {string} consultaId - ID da confirmação
 * @param {Array} telefones - Array de telefones [{telefone, telefoneFormatado, chatId, ...}]
 */
function upsertConsultaTelefones(consultaId, telefones) {
    if (!db) throw new Error('Banco não inicializado');
    if (!Array.isArray(telefones)) {
        console.warn('[SQLite] Telefones não é um array, ignorando');
        return { success: false, reason: 'invalid_array' };
    }

    try {
        // 1. Remove telefones antigos desta consulta
        db.prepare('DELETE FROM consulta_telefones WHERE consulta_id = ?').run(consultaId);

        // 2. Insere novos telefones
        const stmt = db.prepare(`
            INSERT INTO consulta_telefones (
                consulta_id, telefone, telefone_formatado, telefone_type, telefone_origem, chat_id,
                status, prioridade, tentativas,
                mensagem_texto, mensagem_template_id,
                whatsapp_message_id, data_envio, data_entrega, data_leitura,
                logs, ultimo_erro
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let inserted = 0;
        for (const tel of telefones) {
            // Serializa logs se existir
            const logsJson = tel.logs ? JSON.stringify(tel.logs) : null;

            stmt.run(
                consultaId,
                tel.telefone || null,
                tel.telefoneFormatado || null,
                tel.telefoneType || tel.type || null,
                tel.telefoneOrigem || tel.original || null,
                tel.chatId || null,
                tel.status || 'pending',
                tel.prioridade || 1,
                tel.tentativas || 0,
                tel.mensagemTexto || null,
                tel.mensagemTemplateId || null,
                tel.whatsappMessageId || null,
                tel.dataEnvio || null,
                tel.dataEntrega || null,
                tel.dataLeitura || null,
                logsJson,
                tel.ultimoErro || null
            );
            inserted++;
        }

        return { success: true, inserted };
    } catch (error) {
        console.error('[SQLite] Erro ao salvar telefones:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Busca telefones de uma confirmação
 */
function getConsultaTelefones(consultaId) {
    if (!db) throw new Error('Banco não inicializado');

    const stmt = db.prepare('SELECT * FROM consulta_telefones WHERE consulta_id = ? ORDER BY prioridade ASC');
    const rows = stmt.all(consultaId);

    // Deserializa logs
    return rows.map(row => ({
        ...row,
        logs: row.logs ? JSON.parse(row.logs) : []
    }));
}

/**
 * Atualiza status de um telefone específico
 */
function updateTelefoneStatus(telefoneId, status, erro = null) {
    if (!db) throw new Error('Banco não inicializado');

    const stmt = db.prepare(`
        UPDATE consulta_telefones
        SET status = ?,
            ultimo_erro = ?,
            atualizado_em = datetime('now')
        WHERE id = ?
    `);

    const result = stmt.run(status, erro, telefoneId);
    return result.changes > 0;
}

/**
 * Incrementa tentativas de envio de um telefone
 */
function incrementTelefoneAttempts(telefoneId) {
    if (!db) throw new Error('Banco não inicializado');

    const stmt = db.prepare(`
        UPDATE consulta_telefones
        SET tentativas = tentativas + 1,
            atualizado_em = datetime('now')
        WHERE id = ?
    `);

    const result = stmt.run(telefoneId);
    return result.changes > 0;
}

/**
 * Insere ou atualiza telefones de uma desmarcação
 */
function upsertDesmarcacaoTelefones(desmarcacaoId, telefones) {
    if (!db) throw new Error('Banco não inicializado');
    if (!Array.isArray(telefones)) {
        console.warn('[SQLite] Telefones não é um array, ignorando');
        return { success: false, reason: 'invalid_array' };
    }

    try {
        // 1. Remove telefones antigos
        db.prepare('DELETE FROM desmarcacao_telefones WHERE desmarcacao_id = ?').run(desmarcacaoId);

        // 2. Insere novos
        const stmt = db.prepare(`
            INSERT INTO desmarcacao_telefones (
                desmarcacao_id, telefone, telefone_formatado, telefone_type, telefone_origem, chat_id,
                status, prioridade, tentativas,
                mensagem_texto, mensagem_template_id,
                whatsapp_message_id, data_envio, data_entrega, data_leitura,
                logs, ultimo_erro
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        let inserted = 0;
        for (const tel of telefones) {
            const logsJson = tel.logs ? JSON.stringify(tel.logs) : null;

            stmt.run(
                desmarcacaoId,
                tel.telefone || null,
                tel.telefoneFormatado || null,
                tel.telefoneType || tel.type || null,
                tel.telefoneOrigem || tel.original || null,
                tel.chatId || null,
                tel.status || 'pending',
                tel.prioridade || 1,
                tel.tentativas || 0,
                tel.mensagemTexto || null,
                tel.mensagemTemplateId || null,
                tel.whatsappMessageId || null,
                tel.dataEnvio || null,
                tel.dataEntrega || null,
                tel.dataLeitura || null,
                logsJson,
                tel.ultimoErro || null
            );
            inserted++;
        }

        return { success: true, inserted };
    } catch (error) {
        console.error('[SQLite] Erro ao salvar telefones de desmarcação:', error.message);
        return { success: false, error: error.message };
    }
}

/**
 * Busca telefones de uma desmarcação
 */
function getDesmarcacaoTelefones(desmarcacaoId) {
    if (!db) throw new Error('Banco não inicializado');

    const stmt = db.prepare('SELECT * FROM desmarcacao_telefones WHERE desmarcacao_id = ? ORDER BY prioridade ASC');
    const rows = stmt.all(desmarcacaoId);

    return rows.map(row => ({
        ...row,
        logs: row.logs ? JSON.parse(row.logs) : []
    }));
}

// ============================================================================
// REAGENDAMENTO - Funções para detectar e gerenciar reagendamentos
// ============================================================================

/**
 * Verifica se uma consulta é um reagendamento recente (últimas 48h por padrão)
 *
 * @param {string} consultaNumero - Número da consulta
 * @param {string} telefone - Telefone do paciente
 * @param {number} janelaTempo - Janela de tempo em horas (padrão: 48h)
 * @returns {Object} - { isReagendamento, consultaOriginal, horasDesdeReagendamento }
 */
function isReagendamentoRecente(consultaNumero, telefone, janelaTempo = 48) {
    if (!db) throw new Error('Banco não inicializado');

    const stmt = db.prepare(`
        SELECT
            reagendamento_de,
            reagendamento_data,
            reagendamento_tipo,
            criado_em
        FROM consultas_ativas
        WHERE consulta_numero = ?
          AND telefone = ?
          AND reagendamento_de IS NOT NULL
          AND datetime(criado_em) > datetime('now', '-${janelaTempo} hours')
        LIMIT 1
    `);

    const resultado = stmt.get(consultaNumero, telefone);

    if (resultado) {
        const horasDesdeReagendamento =
            (new Date() - new Date(resultado.criado_em)) / (1000 * 60 * 60);

        console.log(
            `[ConsultasService] ⚠️ Consulta ${consultaNumero} é REAGENDAMENTO ` +
            `(${horasDesdeReagendamento.toFixed(1)}h atrás, origem: ${resultado.reagendamento_de})`
        );

        return {
            isReagendamento: true,
            consultaOriginal: resultado.reagendamento_de,
            reagendamentoTipo: resultado.reagendamento_tipo,
            horasDesdeReagendamento: horasDesdeReagendamento
        };
    }

    return { isReagendamento: false };
}

/**
 * Verifica se consulta é reagendamento (qualquer tempo)
 * Útil para exibir badge amarelo no dashboard
 *
 * @param {string} consultaNumero - Número da consulta
 * @param {string} telefone - Telefone do paciente
 * @returns {boolean} - true se for reagendamento
 */
function verificarSeConsultaEReagendamento(consultaNumero, telefone) {
    if (!db) throw new Error('Banco não inicializado');

    const stmt = db.prepare(`
        SELECT reagendamento_de
        FROM consultas_ativas
        WHERE consulta_numero = ?
          AND telefone = ?
          AND reagendamento_de IS NOT NULL
        LIMIT 1
    `);

    const resultado = stmt.get(consultaNumero, telefone);
    return !!resultado;
}

/**
 * Detecta se uma desmarcação do AGHUse corresponde a uma consulta com badge vermelho
 * Se sim, atualiza o status para 'cancelled' (badge verde "Desmarcada")
 *
 * Fluxo:
 * 1. Paciente responde "Não poderei comparecer" → status='declined', badge vermelho
 * 2. Operador desmarca no AGHUse
 * 3. Sistema detecta desmarcação e chama esta função
 * 4. Match encontrado → status='cancelled', badge verde "Desmarcada"
 *
 * @param {string} consultaNumero - Número da consulta desmarcada no AGHUse
 * @returns {Object} - Resultado do match
 */
function detectarDesmarcacaoEAtualizarBadge(consultaNumero) {
    if (!db) throw new Error('Banco não inicializado');

    // Busca consulta com badge vermelho (status declined ou not_scheduled)
    const stmtSelect = db.prepare(`
        SELECT id, consulta_numero, nome_paciente, status_geral, reagendamento_de
        FROM consultas_ativas
        WHERE consulta_numero = ?
          AND status_geral IN ('declined', 'not_scheduled')
    `);

    const consulta = stmtSelect.get(String(consultaNumero));

    if (!consulta) {
        // Não encontrou consulta com badge vermelho - normal, nem toda desmarcação tem
        return {
            success: false,
            matched: false,
            consultaNumero: consultaNumero,
            reason: 'Consulta não encontrada ou não tem badge vermelho'
        };
    }

    // Match encontrado! Atualiza status para 'cancelled' (badge verde)
    const stmtUpdate = db.prepare(`
        UPDATE consultas_ativas
        SET status_geral = 'cancelled',
            atualizado_em = datetime('now')
        WHERE consulta_numero = ?
    `);

    const result = stmtUpdate.run(String(consultaNumero));

    if (result.changes > 0) {
        const isReagendamento = !!consulta.reagendamento_de;
        console.log(`[ConsultasService] ✅ MATCH! Consulta ${consultaNumero} desmarcada no AGHUse`);
        console.log(`[ConsultasService]    Paciente: ${consulta.nome_paciente}`);
        console.log(`[ConsultasService]    Status anterior: ${consulta.status_geral}`);
        console.log(`[ConsultasService]    Status novo: cancelled (badge verde)`);
        if (isReagendamento) {
            console.log(`[ConsultasService]    Era reagendamento de: ${consulta.reagendamento_de}`);
        }

        // ✅ CORREÇÃO: Atualiza também o badge na tabela badges_ativos para verde
        // Sem isso, o frontend não consegue mostrar o badge verde
        const BadgesService = require('./badges.service');
        const badgeResult = BadgesService.updateBadgeToVerde(consultaNumero, 'sistema', 'Desmarcação AGHUse');
        if (badgeResult.success) {
            console.log(`[ConsultasService]    Badge atualizado para VERDE`);
        }
    }

    return {
        success: result.changes > 0,
        matched: true,
        consultaNumero: consultaNumero,
        nomePaciente: consulta.nome_paciente,
        statusAnterior: consulta.status_geral,
        statusNovo: 'cancelled',
        eraReagendamento: !!consulta.reagendamento_de,
        reagendamentoDe: consulta.reagendamento_de
    };
}

/**
 * Marca uma consulta como reagendamento
 * Atualiza os campos reagendamento_de, reagendamento_data, reagendamento_tipo
 *
 * @param {string} consultaNumero - Número da consulta a ser marcada
 * @param {string} desmarcacaoId - ID da desmarcação original
 * @param {string} reagendamentoTipo - Tipo: 'desmarcacao' ou 'confirmacao'
 * @returns {Object} - Resultado da atualização
 */
function marcarConsultaComoReagendamento(consultaNumero, desmarcacaoId, reagendamentoTipo = 'desmarcacao') {
    if (!db) throw new Error('Banco não inicializado');

    const stmt = db.prepare(`
        UPDATE consultas_ativas
        SET reagendamento_de = ?,
            reagendamento_data = datetime('now'),
            reagendamento_tipo = ?,
            atualizado_em = datetime('now')
        WHERE consulta_numero = ?
    `);

    const result = stmt.run(desmarcacaoId, reagendamentoTipo, String(consultaNumero));

    if (result.changes > 0) {
        console.log(`[ConsultasService] ✅ Consulta ${consultaNumero} marcada como REAGENDAMENTO (origem: ${desmarcacaoId})`);
    } else {
        console.warn(`[ConsultasService] ⚠️ Consulta ${consultaNumero} não encontrada para marcar como reagendamento`);
    }

    return {
        success: result.changes > 0,
        consultaNumero: consultaNumero,
        reagendamentoDe: desmarcacaoId,
        reagendamentoTipo: reagendamentoTipo,
        changes: result.changes
    };
}

// ============================================================================
// EXPORTAÇÕES
// ============================================================================

module.exports = {
    init,

    // Consultas Ativas
    upsertConsultaAtiva,
    getConsultaAtiva,
    getConsultaAtivaByNumero,
    getAllConsultasAtivas,
    updateConsultaStatus,
    updateConsultaStatusByConfirmacaoId,
    updateBadgeStatus,
    markMensagemEnviada,
    deleteConsultaAtiva,

    // Desmarcações Ativas
    upsertDesmarcacaoAtiva,
    getAllDesmarcacoesAtivas,
    deleteDesmarcacaoAtiva,
    updateDesmarcacaoStatus,
    marcarDesmarcacaoComoReagendada,

    // Telefones (Persistência de Arrays)
    upsertConsultaTelefones,
    getConsultaTelefones,
    updateTelefoneStatus,
    incrementTelefoneAttempts,
    upsertDesmarcacaoTelefones,
    getDesmarcacaoTelefones,

    // Arquivamento
    arquivarConsulta,
    arquivarDesmarcacao,
    getConsultasArquivadas,

    // Estatísticas
    getStatsConfirmacoes,
    getStatsDesmarcacoes,

    // Reagendamento
    isReagendamentoRecente,
    verificarSeConsultaEReagendamento,
    marcarConsultaComoReagendamento,

    // Detecção de desmarcação (badge vermelho → verde)
    detectarDesmarcacaoEAtualizarBadge
};
