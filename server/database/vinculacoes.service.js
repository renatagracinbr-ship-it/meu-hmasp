/**
 * Serviço de Vinculação Confirmação → Desmarcação
 *
 * Armazena vinculações no SQLite para detectar quando uma desmarcação
 * veio da aba de Confirmação de Presença (paciente disse "não poderei comparecer")
 *
 * Fluxo:
 * 1. Paciente responde "2 - Não poderei comparecer" → saveVinculacao()
 * 2. Badge vermelho "DESMARCAR" aparece
 * 3. Operador desmarca no AGHUse
 * 4. Sistema detecta desmarcação → getVinculacao()
 * 5. Badge muda para verde "DESMARCADA" → updateBadgeStatus()
 * 6. NÃO envia mensagem ao paciente (ele já sabe)
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Caminho do banco de dados
const DB_PATH = path.join(__dirname, 'vinculacoes_confirmacao_desmarcacao.db');

let db = null;

/**
 * Inicializa o banco de dados SQLite
 */
function init() {
    try {
        db = new Database(DB_PATH);
        console.log('[Vinculações] 🟢 Conectado ao SQLite:', DB_PATH);

        // Lê e executa o schema
        const schemaPath = path.join(__dirname, 'schema-vinculacoes.sql');
        const schema = fs.readFileSync(schemaPath, 'utf-8');

        console.log(schema);
        db.exec(schema);

        console.log('[Vinculações] ✅ Schema inicializado');

        return true;
    } catch (error) {
        console.error('[Vinculações] ❌ Erro ao inicializar:', error);
        return false;
    }
}

/**
 * Salva vinculação quando paciente diz "não poderei comparecer"
 *
 * @param {Object} params - Parâmetros da vinculação
 * @param {string} params.confirmacaoId - ID da confirmação
 * @param {string} params.consultaNumero - Número da consulta
 * @param {string} params.telefone - Telefone do paciente
 * @param {string} params.nomePaciente - Nome do paciente
 * @param {string} params.prontuario - Prontuário
 * @param {string} params.especialidade - Especialidade
 * @param {string} params.statusAnterior - Status anterior ('declined' ou 'not_scheduled')
 * @returns {Object} - Resultado da operação
 */
function saveVinculacao(params) {
    try {
        const {
            confirmacaoId,
            consultaNumero,
            telefone,
            nomePaciente,
            prontuario,
            especialidade,
            statusAnterior
        } = params;

        const stmt = db.prepare(`
            INSERT OR REPLACE INTO vinculacoes_confirmacao_desmarcacao
            (confirmacao_id, consulta_numero, telefone, nome_paciente, prontuario, especialidade, status_anterior, badge_status, criado_em, atualizado_em)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'desmarcar', datetime('now'), datetime('now'))
        `);

        const result = stmt.run(
            confirmacaoId,
            String(consultaNumero),
            telefone,
            nomePaciente,
            prontuario,
            especialidade,
            statusAnterior
        );

        console.log(`[Vinculações] ✅ Vinculação salva: consulta ${consultaNumero} → confirmação ${confirmacaoId}`);

        return {
            success: true,
            vinculacaoId: result.lastInsertRowid
        };

    } catch (error) {
        console.error('[Vinculações] ❌ Erro ao salvar vinculação:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Busca vinculação por consultaNumero
 *
 * @param {string|number} consultaNumero - Número da consulta
 * @returns {Object|null} - Vinculação encontrada ou null
 */
function getVinculacao(consultaNumero) {
    try {
        const stmt = db.prepare(`
            SELECT * FROM vinculacoes_confirmacao_desmarcacao
            WHERE consulta_numero = ?
            ORDER BY criado_em DESC
            LIMIT 1
        `);

        const vinculacao = stmt.get(String(consultaNumero));

        if (vinculacao) {
            console.log(`[Vinculações] ✅ Vinculação encontrada para consulta ${consultaNumero}`);
            console.log(`[Vinculações]    Confirmação ID: ${vinculacao.confirmacao_id}`);
            console.log(`[Vinculações]    Badge status: ${vinculacao.badge_status}`);
        } else {
            console.log(`[Vinculações] ℹ️  Nenhuma vinculação encontrada para consulta ${consultaNumero}`);
        }

        return vinculacao;

    } catch (error) {
        console.error('[Vinculações] ❌ Erro ao buscar vinculação:', error);
        return null;
    }
}

/**
 * Atualiza status do badge (vermelho → verde)
 *
 * @param {string|number} consultaNumero - Número da consulta
 * @param {string} novoBadgeStatus - Novo status ('desmarcada')
 * @returns {Object} - Resultado da operação
 */
function updateBadgeStatus(consultaNumero, novoBadgeStatus = 'desmarcada') {
    try {
        const stmt = db.prepare(`
            UPDATE vinculacoes_confirmacao_desmarcacao
            SET badge_status = ?,
                desmarcada_em = datetime('now'),
                atualizado_em = datetime('now')
            WHERE consulta_numero = ?
        `);

        const result = stmt.run(novoBadgeStatus, String(consultaNumero));

        if (result.changes > 0) {
            console.log(`[Vinculações] ✅ Badge atualizado: consulta ${consultaNumero} → ${novoBadgeStatus}`);
            return { success: true, changes: result.changes };
        } else {
            console.log(`[Vinculações] ⚠️  Nenhuma vinculação encontrada para atualizar: ${consultaNumero}`);
            return { success: false, changes: 0 };
        }

    } catch (error) {
        console.error('[Vinculações] ❌ Erro ao atualizar badge:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Deleta vinculação antiga (limpeza)
 *
 * @param {number} diasAntigos - Número de dias (padrão: 30)
 * @returns {number} - Quantidade de vinculações deletadas
 */
function deleteOldVinculacoes(diasAntigos = 30) {
    try {
        const stmt = db.prepare(`
            DELETE FROM vinculacoes_confirmacao_desmarcacao
            WHERE datetime(criado_em) < datetime('now', '-${diasAntigos} days')
        `);

        const result = stmt.run();

        console.log(`[Vinculações] 🗑️  ${result.changes} vinculações antigas deletadas (>${diasAntigos} dias)`);

        return result.changes;

    } catch (error) {
        console.error('[Vinculações] ❌ Erro ao deletar vinculações antigas:', error);
        return 0;
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
                SUM(CASE WHEN badge_status = 'desmarcar' THEN 1 ELSE 0 END) as badges_vermelhos,
                SUM(CASE WHEN badge_status = 'desmarcada' THEN 1 ELSE 0 END) as badges_verdes
            FROM vinculacoes_confirmacao_desmarcacao
        `);

        return stmt.get();

    } catch (error) {
        console.error('[Vinculações] ❌ Erro ao buscar estatísticas:', error);
        return { total: 0, badges_vermelhos: 0, badges_verdes: 0 };
    }
}

// Exporta funções
module.exports = {
    init,
    saveVinculacao,
    getVinculacao,
    updateBadgeStatus,
    deleteOldVinculacoes,
    getStats
};
