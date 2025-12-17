/**
 * Serviço de Gerenciamento de Badges (Centralizado)
 *
 * Sistema multi-usuário: TODOS os badges ficam no SQLite
 * Qualquer navegador/usuário vê os mesmos badges em tempo real
 *
 * Fluxos suportados:
 * 1. Confirmação → Badge DESMARCAR (vermelho) → DESMARCADA (verde)
 * 2. Desmarcação → Badge REAGENDAR (vermelho) → REAGENDADA (verde)
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Caminho do banco de dados
const DB_PATH = path.join(__dirname, 'badges_ativos.db');

let db = null;

/**
 * Inicializa o banco de dados SQLite
 */
function init() {
    try {
        db = new Database(DB_PATH);
        console.log('[Badges] 🟢 Conectado ao SQLite:', DB_PATH);

        // Configurações de performance
        db.pragma('journal_mode = WAL');
        db.pragma('synchronous = NORMAL');

        // Lê e executa o schema
        const schemaPath = path.join(__dirname, 'schema-badges.sql');
        const schema = fs.readFileSync(schemaPath, 'utf-8');

        db.exec(schema);

        console.log('[Badges] ✅ Schema inicializado');

        return true;
    } catch (error) {
        console.error('[Badges] ❌ Erro ao inicializar:', error);
        return false;
    }
}

/**
 * Cria badge DESMARCAR (vermelho) quando paciente diz "não poderei comparecer"
 *
 * @param {Object} params - Parâmetros do badge
 * @returns {Object} - Resultado da operação
 */
function createBadgeDesmarcar(params) {
    try {
        const {
            consultaNumero,
            confirmacaoId,
            telefone,
            nomePaciente,
            prontuario,
            especialidade,
            dataHoraFormatada,
            statusAnterior
        } = params;

        const stmt = db.prepare(`
            INSERT OR REPLACE INTO badges_ativos (
                consulta_numero, confirmacao_id, telefone, nome_paciente, prontuario,
                especialidade, data_hora_formatada,
                tipo_badge, status_badge, label_badge, cor_badge,
                acao_operador, descricao_acao,
                enviar_mensagem_desmarcacao, origem, status_anterior,
                criado_em, atualizado_em
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `);

        const result = stmt.run(
            String(consultaNumero),
            confirmacaoId,
            telefone,
            nomePaciente,
            prontuario,
            especialidade,
            dataHoraFormatada,
            'DESMARCAR',
            'vermelho',
            'Desmarcar',
            '#ef4444',
            'desmarcar_aghuse',
            'Operador deve desmarcar esta consulta no AGHUse',
            0, // NÃO enviar mensagem (paciente já sabe)
            'confirmacao',
            statusAnterior
        );

        console.log(`[Badges] ✅ Badge DESMARCAR criado: consulta ${consultaNumero}`);

        // Registra no histórico
        logBadgeHistory(result.lastInsertRowid, consultaNumero, 'criado', null, 'vermelho');

        return {
            success: true,
            badgeId: result.lastInsertRowid,
            tipo: 'DESMARCAR',
            status: 'vermelho'
        };

    } catch (error) {
        console.error('[Badges] ❌ Erro ao criar badge DESMARCAR:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Cria badge REAGENDAR (vermelho) quando paciente solicita reagendamento
 *
 * @param {Object} params - Parâmetros do badge
 * @returns {Object} - Resultado da operação
 */
function createBadgeReagendar(params) {
    try {
        const {
            consultaNumero,
            desmarcacaoId,
            telefone,
            nomePaciente,
            prontuario,
            especialidade,
            dataHoraFormatada
        } = params;

        const stmt = db.prepare(`
            INSERT OR REPLACE INTO badges_ativos (
                consulta_numero, desmarcacao_id, telefone, nome_paciente, prontuario,
                especialidade, data_hora_formatada,
                tipo_badge, status_badge, label_badge, cor_badge,
                acao_operador, descricao_acao,
                enviar_mensagem_desmarcacao, origem, status_anterior,
                criado_em, atualizado_em
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
        `);

        const result = stmt.run(
            String(consultaNumero),
            desmarcacaoId,
            telefone,
            nomePaciente,
            prontuario,
            especialidade,
            dataHoraFormatada,
            'REAGENDAR',
            'vermelho',
            'Reagendar',
            '#ef4444',
            'reagendar_aghuse',
            'Paciente solicitou reagendamento - vincular nova consulta nas próximas 72h',
            1, // Envia mensagem de reagendamento (quando nova consulta for marcada)
            'desmarcacao',
            'reagendamento'
        );

        console.log(`[Badges] ✅ Badge REAGENDAR criado: consulta ${consultaNumero}`);

        logBadgeHistory(result.lastInsertRowid, consultaNumero, 'criado', null, 'vermelho');

        return {
            success: true,
            badgeId: result.lastInsertRowid,
            tipo: 'REAGENDAR',
            status: 'vermelho'
        };

    } catch (error) {
        console.error('[Badges] ❌ Erro ao criar badge REAGENDAR:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Atualiza badge para verde (ação concluída)
 *
 * @param {string|number} consultaNumero - Número da consulta
 * @param {string} novaCor - 'verde'
 * @returns {Object} - Resultado da operação
 */
function updateBadgeToVerde(consultaNumero, operadorId = null, operadorNome = null) {
    try {
        // Busca badge atual
        const badgeAtual = getBadgeByConsulta(consultaNumero);

        if (!badgeAtual) {
            console.log(`[Badges] ⚠️  Badge não encontrado para consulta ${consultaNumero}`);
            return { success: false, error: 'Badge não encontrado' };
        }

        // Define novo label baseado no tipo
        const novoLabel = badgeAtual.tipo_badge === 'DESMARCAR' ? 'Desmarcada' : 'Reagendada';

        const stmt = db.prepare(`
            UPDATE badges_ativos
            SET status_badge = 'verde',
                label_badge = ?,
                cor_badge = '#10b981',
                acao_operador = NULL,
                concluido_em = datetime('now'),
                atualizado_em = datetime('now')
            WHERE consulta_numero = ?
        `);

        const result = stmt.run(novoLabel, String(consultaNumero));

        if (result.changes > 0) {
            console.log(`[Badges] ✅ Badge atualizado para VERDE: ${consultaNumero} → ${novoLabel}`);

            // Registra no histórico
            logBadgeHistory(
                badgeAtual.id,
                consultaNumero,
                'concluido',
                'vermelho',
                'verde',
                operadorId,
                operadorNome
            );

            return {
                success: true,
                changes: result.changes,
                novoLabel
            };
        } else {
            return { success: false, changes: 0 };
        }

    } catch (error) {
        console.error('[Badges] ❌ Erro ao atualizar badge:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Busca badge por consultaNumero
 *
 * @param {string|number} consultaNumero - Número da consulta
 * @returns {Object|null} - Badge encontrado ou null
 */
function getBadgeByConsulta(consultaNumero) {
    try {
        const stmt = db.prepare(`
            SELECT * FROM badges_ativos
            WHERE consulta_numero = ?
            LIMIT 1
        `);

        return stmt.get(String(consultaNumero));

    } catch (error) {
        console.error('[Badges] ❌ Erro ao buscar badge:', error);
        return null;
    }
}

/**
 * Busca TODOS os badges ativos (para frontend)
 *
 * @param {Object} filtros - Filtros opcionais
 * @returns {Array} - Lista de badges
 */
function getAllBadges(filtros = {}) {
    try {
        let query = 'SELECT * FROM badges_ativos WHERE 1=1';
        const params = [];

        if (filtros.status_badge) {
            query += ' AND status_badge = ?';
            params.push(filtros.status_badge);
        }

        if (filtros.tipo_badge) {
            query += ' AND tipo_badge = ?';
            params.push(filtros.tipo_badge);
        }

        if (filtros.origem) {
            query += ' AND origem = ?';
            params.push(filtros.origem);
        }

        query += ' ORDER BY criado_em DESC';

        const stmt = db.prepare(query);
        return stmt.all(...params);

    } catch (error) {
        console.error('[Badges] ❌ Erro ao buscar badges:', error);
        return [];
    }
}

/**
 * Atualiza badge REAGENDAR para REAGENDADA (verde) com número da nova consulta
 *
 * @param {string|number} consultaNumero - Número da consulta original
 * @param {string|number} novaConsultaNumero - Número da nova consulta
 * @returns {Object} - Resultado da operação
 */
function updateBadgeReagendada(consultaNumero, novaConsultaNumero) {
    try {
        // Busca badge atual
        const badgeAtual = getBadgeByConsulta(consultaNumero);

        if (!badgeAtual) {
            console.log(`[Badges] ⚠️ Badge não encontrado para consulta ${consultaNumero}`);
            return { success: false, error: 'Badge não encontrado' };
        }

        if (badgeAtual.tipo_badge !== 'REAGENDAR') {
            console.log(`[Badges] ⚠️ Badge não é do tipo REAGENDAR: ${badgeAtual.tipo_badge}`);
            return { success: false, error: 'Badge não é do tipo REAGENDAR' };
        }

        const stmt = db.prepare(`
            UPDATE badges_ativos
            SET status_badge = 'verde',
                label_badge = 'Reagendada',
                cor_badge = '#10b981',
                acao_operador = NULL,
                nova_consulta_numero = ?,
                concluido_em = datetime('now'),
                atualizado_em = datetime('now')
            WHERE consulta_numero = ?
        `);

        const result = stmt.run(String(novaConsultaNumero), String(consultaNumero));

        if (result.changes > 0) {
            console.log(`[Badges] ✅ Badge REAGENDADA (verde): ${consultaNumero} → Nova: ${novaConsultaNumero}`);

            // Registra no histórico
            logBadgeHistory(
                badgeAtual.id,
                consultaNumero,
                'reagendada',
                'vermelho',
                'verde',
                null,
                null
            );

            return {
                success: true,
                changes: result.changes,
                novoLabel: 'Reagendada',
                novaConsultaNumero
            };
        } else {
            return { success: false, changes: 0 };
        }

    } catch (error) {
        console.error('[Badges] ❌ Erro ao atualizar badge reagendada:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Deleta badge (quando não é mais necessário)
 *
 * @param {string|number} consultaNumero - Número da consulta
 * @returns {Object} - Resultado da operação
 */
function deleteBadge(consultaNumero) {
    try {
        const stmt = db.prepare(`
            DELETE FROM badges_ativos
            WHERE consulta_numero = ?
        `);

        const result = stmt.run(String(consultaNumero));

        if (result.changes > 0) {
            console.log(`[Badges] 🗑️  Badge deletado: consulta ${consultaNumero}`);
            return { success: true, changes: result.changes };
        } else {
            return { success: false, changes: 0 };
        }

    } catch (error) {
        console.error('[Badges] ❌ Erro ao deletar badge:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Deleta badges antigos (limpeza)
 *
 * @param {number} diasAntigos - Número de dias (padrão: 7)
 * @returns {number} - Quantidade de badges deletados
 */
function deleteOldBadges(diasAntigos = 7) {
    try {
        const stmt = db.prepare(`
            DELETE FROM badges_ativos
            WHERE status_badge = 'verde'
            AND datetime(concluido_em) < datetime('now', '-${diasAntigos} days')
        `);

        const result = stmt.run();

        console.log(`[Badges] 🗑️  ${result.changes} badges verdes antigos deletados (>${diasAntigos} dias)`);

        return result.changes;

    } catch (error) {
        console.error('[Badges] ❌ Erro ao deletar badges antigos:', error);
        return 0;
    }
}

/**
 * Registra transição no histórico
 */
function logBadgeHistory(badgeId, consultaNumero, acao, statusAntigo, statusNovo, operadorId = null, operadorNome = null) {
    try {
        const stmt = db.prepare(`
            INSERT INTO badges_historico (
                badge_id, consulta_numero, status_antigo, status_novo,
                acao, operador_id, operador_nome, criado_em
            ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `);

        stmt.run(badgeId, String(consultaNumero), statusAntigo, statusNovo, acao, operadorId, operadorNome);

    } catch (error) {
        console.error('[Badges] ❌ Erro ao registrar histórico:', error);
    }
}

/**
 * Obtém estatísticas
 */
function getStats() {
    try {
        const stmt = db.prepare(`
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN status_badge = 'vermelho' THEN 1 ELSE 0 END) as badges_vermelhos,
                SUM(CASE WHEN status_badge = 'verde' THEN 1 ELSE 0 END) as badges_verdes,
                SUM(CASE WHEN tipo_badge = 'DESMARCAR' THEN 1 ELSE 0 END) as total_desmarcar,
                SUM(CASE WHEN tipo_badge = 'REAGENDAR' THEN 1 ELSE 0 END) as total_reagendar
            FROM badges_ativos
        `);

        return stmt.get();

    } catch (error) {
        console.error('[Badges] ❌ Erro ao buscar estatísticas:', error);
        return {
            total: 0,
            badges_vermelhos: 0,
            badges_verdes: 0,
            total_desmarcar: 0,
            total_reagendar: 0
        };
    }
}

// Exporta funções
module.exports = {
    init,
    createBadgeDesmarcar,
    createBadgeReagendar,
    updateBadgeToVerde,
    updateBadgeReagendada,
    getBadgeByConsulta,
    getAllBadges,
    deleteBadge,
    deleteOldBadges,
    getStats
};
