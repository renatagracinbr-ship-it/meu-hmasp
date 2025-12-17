/**
 * Script de Migração: Adiciona campos faltantes às tabelas
 *
 * Execute este script quando o servidor estiver DESLIGADO
 * Comando: node server/database/migrate-add-fields.js
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'hmasp_consultas.db');

console.log('[Migração] Iniciando migração do banco de dados...');
console.log('[Migração] Caminho:', DB_PATH);

try {
    const db = new Database(DB_PATH);

    console.log('[Migração] Banco de dados aberto');

    // ============================================================================
    // TABELA: desmarcacoes_ativas
    // ============================================================================
    const fieldsDesmarcacoes = [
        { name: 'nome_exibicao', type: 'TEXT', description: 'Nome resumido para exibição' },
        { name: 'pac_codigo', type: 'TEXT', description: 'Código do paciente no AGHUse' },
        { name: 'profissional', type: 'TEXT', description: 'Médico responsável' }
    ];

    console.log('[Migração] Adicionando campos à tabela desmarcacoes_ativas...');

    for (const field of fieldsDesmarcacoes) {
        try {
            const alterSQL = `ALTER TABLE desmarcacoes_ativas ADD COLUMN ${field.name} ${field.type}`;
            db.exec(alterSQL);
            console.log(`[Migração] ✅ Campo ${field.name} adicionado (${field.description})`);
        } catch (error) {
            if (error.message.includes('duplicate column name')) {
                console.log(`[Migração] ⚠️ Campo ${field.name} já existe, pulando...`);
            } else {
                console.error(`[Migração] ❌ Erro ao adicionar campo ${field.name}:`, error.message);
            }
        }
    }

    // ============================================================================
    // TABELA: consultas_ativas (Confirmações)
    // ============================================================================
    const fieldsConfirmacoes = [
        { name: 'profissional', type: 'TEXT', description: 'Médico responsável' }
    ];

    console.log('[Migração] Adicionando campos à tabela consultas_ativas...');

    for (const field of fieldsConfirmacoes) {
        try {
            const alterSQL = `ALTER TABLE consultas_ativas ADD COLUMN ${field.name} ${field.type}`;
            db.exec(alterSQL);
            console.log(`[Migração] ✅ Campo ${field.name} adicionado (${field.description})`);
        } catch (error) {
            if (error.message.includes('duplicate column name')) {
                console.log(`[Migração] ⚠️ Campo ${field.name} já existe, pulando...`);
            } else {
                console.error(`[Migração] ❌ Erro ao adicionar campo ${field.name}:`, error.message);
            }
        }
    }

    db.close();

    console.log('[Migração] ✅ Migração concluída com sucesso!');
    console.log('[Migração] Você pode reiniciar o servidor agora.');

} catch (error) {
    console.error('[Migração] ❌ Erro fatal:', error);
    process.exit(1);
}
