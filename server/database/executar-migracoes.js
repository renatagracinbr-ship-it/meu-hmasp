/**
 * Script para Executar Migrações do Banco de Dados
 *
 * Executa migrações SQL no banco de dados SQLite
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'hmasp_consultas.db');
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

console.log('='.repeat(80));
console.log('EXECUÇÃO DE MIGRAÇÕES - HMASP Chat');
console.log('='.repeat(80));
console.log();

// Conecta ao banco
console.log('📦 Conectando ao banco de dados...');
console.log(`   Caminho: ${DB_PATH}`);
const db = new Database(DB_PATH);
console.log('✅ Conectado!\n');

// Lista migrações disponíveis
console.log('📁 Buscando migrações...');
const migrations = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

console.log(`   Encontradas ${migrations.length} migrações:\n`);
migrations.forEach((m, i) => {
    console.log(`   ${i + 1}. ${m}`);
});
console.log();

// Executa cada migração
let sucessos = 0;
let erros = 0;

for (const migration of migrations) {
    const migrationPath = path.join(MIGRATIONS_DIR, migration);
    console.log('-'.repeat(80));
    console.log(`🚀 Executando: ${migration}`);
    console.log('-'.repeat(80));

    try {
        // Lê arquivo SQL
        const sql = fs.readFileSync(migrationPath, 'utf-8');
        console.log(`   📄 Arquivo lido: ${sql.length} caracteres`);

        // Executa SQL
        console.log('   ⚙️  Executando comandos SQL...');
        const result = db.exec(sql);
        console.log('   ✅ Migração executada com sucesso!');

        // Mostra resultado das verificações (se houver)
        try {
            // Tenta pegar resultado da verificação pós-migração
            const verification = db.prepare(`
                SELECT name, 'consultas_ativas' as tabela
                FROM pragma_table_info('consultas_ativas')
                WHERE name IN ('profissional', 'local', 'pac_codigo', 'nome_exibicao', 'data_resposta', 'badge_status', 'badge_info', 'contexto')

                UNION ALL

                SELECT name, 'desmarcacoes_ativas' as tabela
                FROM pragma_table_info('desmarcacoes_ativas')
                WHERE name IN ('local', 'resposta_em', 'status_geral', 'data_marcacao', 'contexto')
            `).all();

            if (verification.length > 0) {
                console.log(`   📊 Campos adicionados:`);
                verification.forEach(v => {
                    console.log(`      ✓ ${v.tabela}.${v.name}`);
                });
            }
        } catch (e) {
            // Ignorar erro de verificação
        }

        sucessos++;
        console.log();

    } catch (error) {
        console.error(`   ❌ ERRO ao executar migração:`);
        console.error(`      ${error.message}`);
        console.error();
        erros++;
    }
}

// Resumo final
console.log('='.repeat(80));
console.log('RESUMO DA EXECUÇÃO');
console.log('='.repeat(80));
console.log(`✅ Sucessos: ${sucessos}`);
console.log(`❌ Erros: ${erros}`);
console.log(`📊 Total: ${migrations.length}`);
console.log();

// Mostra estrutura final das tabelas
console.log('📋 ESTRUTURA FINAL DAS TABELAS');
console.log('='.repeat(80));

console.log('\n🔹 CONSULTAS_ATIVAS:');
const consultasAtivas = db.prepare("PRAGMA table_info('consultas_ativas')").all();
console.log(`   Total de campos: ${consultasAtivas.length}`);
consultasAtivas.forEach(c => {
    const required = c.notnull ? ' NOT NULL' : '';
    const pk = c.pk ? ' [PK]' : '';
    const def = c.dflt_value ? ` DEFAULT ${c.dflt_value}` : '';
    console.log(`   - ${c.name} (${c.type})${required}${def}${pk}`);
});

console.log('\n🔹 DESMARCACOES_ATIVAS:');
const desmarcacoesAtivas = db.prepare("PRAGMA table_info('desmarcacoes_ativas')").all();
console.log(`   Total de campos: ${desmarcacoesAtivas.length}`);
desmarcacoesAtivas.forEach(c => {
    const required = c.notnull ? ' NOT NULL' : '';
    const pk = c.pk ? ' [PK]' : '';
    const def = c.dflt_value ? ` DEFAULT ${c.dflt_value}` : '';
    console.log(`   - ${c.name} (${c.type})${required}${def}${pk}`);
});

// Mostra novas tabelas (se existirem)
const tabelas = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%telefones%'").all();
if (tabelas.length > 0) {
    console.log('\n🔹 TABELAS DE TELEFONES:');
    tabelas.forEach(t => {
        const info = db.prepare(`PRAGMA table_info('${t.name}')`).all();
        console.log(`\n   ${t.name.toUpperCase()} (${info.length} campos)`);
        info.forEach(c => {
            const required = c.notnull ? ' NOT NULL' : '';
            const pk = c.pk ? ' [PK]' : '';
            const def = c.dflt_value ? ` DEFAULT ${c.dflt_value}` : '';
            console.log(`   - ${c.name} (${c.type})${required}${def}${pk}`);
        });
    });
}

console.log('\n' + '='.repeat(80));

// Fecha conexão
db.close();
console.log('✅ Migrações concluídas!');
console.log('='.repeat(80));

process.exit(erros > 0 ? 1 : 0);
