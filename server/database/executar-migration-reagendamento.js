/**
 * Script para executar migration de reagendamento
 * Adiciona campos reagendamento_de, reagendamento_data e reagendamento_tipo
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'hmasp_consultas.db');
const MIGRATION_PATH = path.join(__dirname, 'migration-reagendamento.sql');

console.log('==========================================');
console.log('EXECUTANDO MIGRATION DE REAGENDAMENTO');
console.log('==========================================\n');

try {
    // Conecta ao banco
    console.log(`📂 Conectando ao banco: ${DB_PATH}`);
    const db = new Database(DB_PATH);

    // Lê arquivo de migration
    console.log(`📄 Lendo migration: ${MIGRATION_PATH}`);
    const migration = fs.readFileSync(MIGRATION_PATH, 'utf-8');

    // Executa migration
    console.log('⚙️  Executando migration...\n');
    db.exec(migration);

    console.log('✅ Migration executada com sucesso!\n');

    // Verifica se os campos foram criados
    console.log('🔍 Verificando campos criados...');
    const tableInfo = db.prepare("PRAGMA table_info(consultas_ativas)").all();

    const novosCampos = tableInfo.filter(col =>
        col.name === 'reagendamento_de' ||
        col.name === 'reagendamento_data' ||
        col.name === 'reagendamento_tipo'
    );

    if (novosCampos.length === 3) {
        console.log('✅ Todos os campos foram criados:');
        novosCampos.forEach(col => {
            console.log(`   - ${col.name} (${col.type})`);
        });
    } else {
        console.warn('⚠️  Alguns campos não foram encontrados');
    }

    // Verifica índices
    console.log('\n🔍 Verificando índices criados...');
    const indices = db.prepare("PRAGMA index_list(consultas_ativas)").all();

    const novosIndices = indices.filter(idx =>
        idx.name.includes('reagendamento')
    );

    if (novosIndices.length > 0) {
        console.log('✅ Índices criados:');
        novosIndices.forEach(idx => {
            console.log(`   - ${idx.name}`);
        });
    }

    db.close();

    console.log('\n==========================================');
    console.log('✅ MIGRATION CONCLUÍDA COM SUCESSO!');
    console.log('==========================================');

    process.exit(0);

} catch (error) {
    console.error('\n❌ ERRO ao executar migration:');
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
}
