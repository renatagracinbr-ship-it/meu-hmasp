/**
 * Script para Criar Tabelas de Telefones
 *
 * Cria as tabelas consulta_telefones e desmarcacao_telefones
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'hmasp_consultas.db');
const MIGRATION_PATH = path.join(__dirname, 'migrations', '002-criar-tabela-telefones.sql');

console.log('='.repeat(80));
console.log('CRIAÇÃO DE TABELAS DE TELEFONES');
console.log('='.repeat(80));
console.log();

// Conecta ao banco
console.log('📦 Conectando ao banco de dados...');
const db = new Database(DB_PATH);
console.log('✅ Conectado!\n');

// Verifica se tabelas já existem
console.log('🔍 Verificando se tabelas já existem...');
const tabelasExistentes = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND (name = 'consulta_telefones' OR name = 'desmarcacao_telefones')
`).all();

if (tabelasExistentes.length > 0) {
    console.log('⚠️  Tabelas já existem:');
    tabelasExistentes.forEach(t => console.log(`   - ${t.name}`));
    console.log('\n❌ Migração abortada para evitar duplicação.');
    console.log('   Se deseja recriar as tabelas, delete-as primeiro.\n');
    db.close();
    process.exit(0);
}

console.log('✅ Tabelas não existem, prosseguindo com criação...\n');

// Lê arquivo de migração
console.log('📄 Lendo arquivo de migração...');
const sql = fs.readFileSync(MIGRATION_PATH, 'utf-8');
console.log(`✅ Arquivo lido: ${sql.length} caracteres\n`);

// Remove BEGIN TRANSACTION e COMMIT (executamos manualmente)
const sqlLimpo = sql
    .replace(/BEGIN TRANSACTION;/gi, '')
    .replace(/COMMIT;/gi, '');

console.log('⚙️  Executando SQL...');
console.log('-'.repeat(80));

try {
    // Executa dentro de transação
    db.exec('BEGIN TRANSACTION');

    // Executa SQL
    db.exec(sqlLimpo);

    // Commit
    db.exec('COMMIT');

    console.log('✅ SQL executado com sucesso!');
    console.log();

} catch (error) {
    console.error('❌ ERRO ao executar SQL:');
    console.error(`   ${error.message}`);
    console.error();

    // Rollback
    try {
        db.exec('ROLLBACK');
        console.log('↩️  Rollback executado');
    } catch (e) {
        console.error('❌ Erro ao fazer rollback:', e.message);
    }

    db.close();
    process.exit(1);
}

// Verifica criação
console.log('📊 VERIFICANDO CRIAÇÃO');
console.log('='.repeat(80));

const tabelas = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table' AND name LIKE '%telefones%'
    ORDER BY name
`).all();

console.log(`\n✅ Tabelas criadas: ${tabelas.length}\n`);

for (const tabela of tabelas) {
    console.log(`🔹 ${tabela.name.toUpperCase()}`);

    const info = db.prepare(`PRAGMA table_info('${tabela.name}')`).all();
    console.log(`   Total de campos: ${info.length}\n`);

    // Agrupa campos
    const camposId = info.filter(c => c.name.includes('id'));
    const camposTelefone = info.filter(c => c.name.includes('telefone') || c.name.includes('chat'));
    const camposStatus = info.filter(c => c.name.includes('status') || c.name.includes('prioridade') || c.name.includes('tentativas'));
    const camposMensagem = info.filter(c => c.name.includes('mensagem'));
    const camposWhatsApp = info.filter(c => c.name.includes('whatsapp') || c.name.includes('data_'));
    const camposLogs = info.filter(c => c.name.includes('log') || c.name.includes('erro'));
    const camposData = info.filter(c => c.name.includes('criado') || c.name.includes('atualizado'));

    if (camposId.length > 0) {
        console.log('   📌 Identificação:');
        camposId.forEach(c => console.log(`      - ${c.name} (${c.type})`));
    }

    if (camposTelefone.length > 0) {
        console.log('\n   📞 Telefone:');
        camposTelefone.forEach(c => console.log(`      - ${c.name} (${c.type})`));
    }

    if (camposStatus.length > 0) {
        console.log('\n   🏷️  Status e Controle:');
        camposStatus.forEach(c => console.log(`      - ${c.name} (${c.type})`));
    }

    if (camposMensagem.length > 0) {
        console.log('\n   💬 Mensagem:');
        camposMensagem.forEach(c => console.log(`      - ${c.name} (${c.type})`));
    }

    if (camposWhatsApp.length > 0) {
        console.log('\n   📱 WhatsApp e Datas:');
        camposWhatsApp.forEach(c => console.log(`      - ${c.name} (${c.type})`));
    }

    if (camposLogs.length > 0) {
        console.log('\n   📝 Logs:');
        camposLogs.forEach(c => console.log(`      - ${c.name} (${c.type})`));
    }

    if (camposData.length > 0) {
        console.log('\n   📅 Metadados:');
        camposData.forEach(c => console.log(`      - ${c.name} (${c.type})`));
    }

    console.log();
}

// Verifica índices criados
console.log('📊 ÍNDICES CRIADOS');
console.log('-'.repeat(80));

const indices = db.prepare(`
    SELECT name, tbl_name
    FROM sqlite_master
    WHERE type='index' AND name LIKE '%telefones%'
    ORDER BY tbl_name, name
`).all();

if (indices.length > 0) {
    console.log();
    let tabelaAnterior = '';
    indices.forEach(idx => {
        if (idx.tbl_name !== tabelaAnterior) {
            console.log(`\n   ${idx.tbl_name}:`);
            tabelaAnterior = idx.tbl_name;
        }
        console.log(`      ✓ ${idx.name}`);
    });
    console.log();
} else {
    console.log('   ⚠️  Nenhum índice encontrado');
}

// Verifica views criadas
console.log('\n📊 VIEWS CRIADAS');
console.log('-'.repeat(80));

const views = db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type='view' AND name LIKE '%telefones%'
    ORDER BY name
`).all();

if (views.length > 0) {
    console.log();
    views.forEach(v => console.log(`   ✓ ${v.name}`));
    console.log();
} else {
    console.log('   ⚠️  Nenhuma view encontrada');
}

// Verifica triggers criados
console.log('\n📊 TRIGGERS CRIADOS');
console.log('-'.repeat(80));

const triggers = db.prepare(`
    SELECT name, tbl_name
    FROM sqlite_master
    WHERE type='trigger' AND name LIKE '%telefones%'
    ORDER BY tbl_name, name
`).all();

if (triggers.length > 0) {
    console.log();
    let tabelaAnterior = '';
    triggers.forEach(trg => {
        if (trg.tbl_name !== tabelaAnterior) {
            console.log(`\n   ${trg.tbl_name}:`);
            tabelaAnterior = trg.tbl_name;
        }
        console.log(`      ✓ ${trg.name}`);
    });
    console.log();
} else {
    console.log('   ⚠️  Nenhum trigger encontrado');
}

console.log('\n' + '='.repeat(80));
console.log('✅ Tabelas de telefones criadas com sucesso!');
console.log('='.repeat(80));

// Fecha conexão
db.close();

process.exit(0);
