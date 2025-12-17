/**
 * Migração: Adiciona coluna 'status' na tabela desmarcacoes_ativas
 *
 * Esta migração resolve o erro: "no such column: status"
 * que estava causando o desaparecimento dos badges REAGENDAR
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'hmasp_consultas.db');

function runMigration() {
    console.log('[Migração] Iniciando migração: adicionar coluna status...');

    const db = new Database(DB_PATH);

    try {
        // Verifica se a coluna já existe
        const tableInfo = db.prepare("PRAGMA table_info(desmarcacoes_ativas)").all();
        const hasStatusColumn = tableInfo.some(col => col.name === 'status');

        if (hasStatusColumn) {
            console.log('[Migração] ✅ Coluna "status" já existe. Nenhuma ação necessária.');
            db.close();
            return;
        }

        // Adiciona a coluna status
        console.log('[Migração] 🔨 Adicionando coluna "status" à tabela desmarcacoes_ativas...');

        db.prepare(`
            ALTER TABLE desmarcacoes_ativas
            ADD COLUMN status TEXT
        `).run();

        console.log('[Migração] ✅ Coluna "status" adicionada com sucesso!');

        // Atualiza registros existentes com valor padrão baseado no tipo_desmarcacao
        console.log('[Migração] 🔄 Atualizando registros existentes...');

        const updateResult = db.prepare(`
            UPDATE desmarcacoes_ativas
            SET status = COALESCE(tipo_desmarcacao, 'pending')
            WHERE status IS NULL
        `).run();

        console.log(`[Migração] ✅ ${updateResult.changes} registros atualizados.`);

        // Verifica a estrutura final
        const finalTableInfo = db.prepare("PRAGMA table_info(desmarcacoes_ativas)").all();
        const statusColumn = finalTableInfo.find(col => col.name === 'status');

        if (statusColumn) {
            console.log('[Migração] ✅ Migração concluída com sucesso!');
            console.log(`[Migração] 📊 Estrutura da coluna: ${JSON.stringify(statusColumn)}`);
        } else {
            console.error('[Migração] ❌ ERRO: Coluna não foi criada corretamente!');
        }

    } catch (error) {
        console.error('[Migração] ❌ Erro durante migração:', error);
        throw error;
    } finally {
        db.close();
    }
}

// Executa a migração se for chamado diretamente
if (require.main === module) {
    runMigration();
}

module.exports = { runMigration };
