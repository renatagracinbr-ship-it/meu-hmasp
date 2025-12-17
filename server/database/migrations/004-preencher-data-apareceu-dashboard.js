/**
 * Migration: Preenche data_apareceu_dashboard para consultas antigas
 *
 * Objetivo: Garantir que TODAS as consultas tenham data_apareceu_dashboard preenchida
 * para que a ordenação funcione corretamente.
 *
 * Lógica:
 * - Se data_apareceu_dashboard está NULL, usa data_marcacao como fallback
 * - Se data_marcacao também está NULL, usa criado_em
 * - Isso garante que consultas antigas tenham uma data de referência válida
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'hmasp_consultas.db');

function run() {
    console.log('[Migration 004] 🚀 Iniciando preenchimento de data_apareceu_dashboard...');

    const db = new Database(DB_PATH);

    try {
        // 1. Atualiza consultas_ativas onde data_apareceu_dashboard está NULL
        const updateConsultas = db.prepare(`
            UPDATE consultas_ativas
            SET data_apareceu_dashboard = COALESCE(data_marcacao, criado_em),
                atualizado_em = datetime('now')
            WHERE data_apareceu_dashboard IS NULL
        `);

        const resultConsultas = updateConsultas.run();
        console.log(`[Migration 004] ✅ ${resultConsultas.changes} consultas atualizadas`);

        // 2. Atualiza desmarcacoes_ativas onde data_apareceu_dashboard está NULL
        const updateDesmarcacoes = db.prepare(`
            UPDATE desmarcacoes_ativas
            SET data_apareceu_dashboard = COALESCE(data_desmarcacao, criado_em),
                atualizado_em = datetime('now')
            WHERE data_apareceu_dashboard IS NULL
        `);

        const resultDesmarcacoes = updateDesmarcacoes.run();
        console.log(`[Migration 004] ✅ ${resultDesmarcacoes.changes} desmarcações atualizadas`);

        // 3. Verifica se ainda há registros sem data_apareceu_dashboard
        const verificaConsultas = db.prepare(`
            SELECT COUNT(*) as total
            FROM consultas_ativas
            WHERE data_apareceu_dashboard IS NULL
        `).get();

        const verificaDesmarcacoes = db.prepare(`
            SELECT COUNT(*) as total
            FROM desmarcacoes_ativas
            WHERE data_apareceu_dashboard IS NULL
        `).get();

        if (verificaConsultas.total === 0 && verificaDesmarcacoes.total === 0) {
            console.log('[Migration 004] ✅ Todas as consultas e desmarcações têm data_apareceu_dashboard preenchida');
        } else {
            console.warn(`[Migration 004] ⚠️ Ainda há ${verificaConsultas.total} consultas e ${verificaDesmarcacoes.total} desmarcações sem data_apareceu_dashboard`);
        }

        console.log('[Migration 004] ✅ Migration concluída com sucesso!');

    } catch (error) {
        console.error('[Migration 004] ❌ Erro na migration:', error);
        throw error;
    } finally {
        db.close();
    }
}

// Executa se for chamado diretamente
if (require.main === module) {
    run();
}

module.exports = { run };
