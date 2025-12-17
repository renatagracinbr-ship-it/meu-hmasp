/**
 * MIGRATION URGENTE: Adiciona campos faltantes nas tabelas
 *
 * EXECUTAR ESTE SCRIPT UMA VEZ para corrigir o banco de dados
 *
 * Comando: node server/database/EXECUTAR-MIGRATION-CAMPOS.js
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'hmasp_consultas.db');
const db = new Database(DB_PATH);

console.log('╔═══════════════════════════════════════════════════════════════╗');
console.log('║   MIGRATION CRÍTICA: Adicionando Campos Faltantes            ║');
console.log('╚═══════════════════════════════════════════════════════════════╝');
console.log('');

/**
 * Função helper para adicionar coluna com segurança
 */
function addColumnSafe(table, column, type, defaultValue = null) {
    try {
        // Verifica se coluna já existe
        const columns = db.prepare(`PRAGMA table_info(${table})`).all();
        const exists = columns.some(col => col.name === column);

        if (exists) {
            console.log(`⏭️  ${table}.${column} → Já existe, pulando`);
            return false;
        }

        // Adiciona coluna
        const defaultClause = defaultValue ? ` DEFAULT ${defaultValue}` : '';
        const sql = `ALTER TABLE ${table} ADD COLUMN ${column} ${type}${defaultClause}`;

        db.exec(sql);
        console.log(`✅ ${table}.${column} → Adicionado com sucesso`);
        return true;
    } catch (error) {
        console.error(`❌ ${table}.${column} → ERRO:`, error.message);
        return false;
    }
}

// ============================================================================
// CONSULTAS_ATIVAS
// ============================================================================

console.log('\n📋 TABELA: consultas_ativas');
console.log('────────────────────────────────────────');

let added = 0;

added += addColumnSafe('consultas_ativas', 'profissional', 'TEXT', "'Não informado'") ? 1 : 0;
added += addColumnSafe('consultas_ativas', 'local', 'TEXT') ? 1 : 0;
added += addColumnSafe('consultas_ativas', 'pac_codigo', 'TEXT') ? 1 : 0;
added += addColumnSafe('consultas_ativas', 'nome_exibicao', 'TEXT') ? 1 : 0;
added += addColumnSafe('consultas_ativas', 'data_resposta', 'TEXT') ? 1 : 0;
added += addColumnSafe('consultas_ativas', 'badge_status', 'TEXT') ? 1 : 0;
added += addColumnSafe('consultas_ativas', 'badge_info', 'TEXT') ? 1 : 0;

console.log(`\n✅ Total adicionado em consultas_ativas: ${added} campo(s)`);

// ============================================================================
// DESMARCACOES_ATIVAS
// ============================================================================

console.log('\n\n📋 TABELA: desmarcacoes_ativas');
console.log('────────────────────────────────────────');

added = 0;

added += addColumnSafe('desmarcacoes_ativas', 'profissional', 'TEXT', "'Não informado'") ? 1 : 0;
added += addColumnSafe('desmarcacoes_ativas', 'local', 'TEXT') ? 1 : 0;
added += addColumnSafe('desmarcacoes_ativas', 'resposta_em', 'TEXT') ? 1 : 0;
added += addColumnSafe('desmarcacoes_ativas', 'status_geral', 'TEXT', "'pending'") ? 1 : 0;
added += addColumnSafe('desmarcacoes_ativas', 'data_marcacao', 'TEXT') ? 1 : 0;
added += addColumnSafe('desmarcacoes_ativas', 'contexto', 'TEXT', "'desmarcacao'") ? 1 : 0;
added += addColumnSafe('desmarcacoes_ativas', 'data_desmarcacao_formatada', 'TEXT') ? 1 : 0;
added += addColumnSafe('desmarcacoes_ativas', 'status', 'TEXT') ? 1 : 0;

console.log(`\n✅ Total adicionado em desmarcacoes_ativas: ${added} campo(s)`);

// ============================================================================
// VERIFICAÇÃO FINAL
// ============================================================================

console.log('\n\n📊 VERIFICAÇÃO FINAL');
console.log('════════════════════════════════════════════════════════════════');

const consultasFields = db.prepare('PRAGMA table_info(consultas_ativas)').all();
const desmarcacoesFields = db.prepare('PRAGMA table_info(desmarcacoes_ativas)').all();

console.log(`\n✅ consultas_ativas: ${consultasFields.length} campos total`);
console.log('   Campos adicionados hoje:');
consultasFields.filter(f => ['profissional', 'local', 'pac_codigo', 'nome_exibicao', 'data_resposta', 'badge_status', 'badge_info'].includes(f.name))
    .forEach(f => console.log(`   - ${f.name} (${f.type})`));

console.log(`\n✅ desmarcacoes_ativas: ${desmarcacoesFields.length} campos total`);
console.log('   Campos adicionados hoje:');
desmarcacoesFields.filter(f => ['profissional', 'local', 'resposta_em', 'status_geral', 'data_marcacao', 'contexto', 'data_desmarcacao_formatada', 'status'].includes(f.name))
    .forEach(f => console.log(`   - ${f.name} (${f.type})`));

// ============================================================================
// FINALIZAÇÃO
// ============================================================================

db.close();

console.log('\n\n╔═══════════════════════════════════════════════════════════════╗');
console.log('║   ✅ MIGRATION CONCLUÍDA COM SUCESSO!                        ║');
console.log('╚═══════════════════════════════════════════════════════════════╝');
console.log('\n📝 Próximos passos:');
console.log('   1. Reiniciar o servidor: npm run server');
console.log('   2. Verificar logs se campos estão sendo salvos');
console.log('   3. Testar cadastro de nova consulta');
console.log('');
