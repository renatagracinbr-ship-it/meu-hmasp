/**
 * Script para atualizar o banco de mensagens WhatsApp
 * Aplica o schema e verifica os templates
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'mensagens-whatsapp.db');
const schemaPath = path.join(__dirname, 'schema-mensagens-whatsapp.sql');

console.log('📋 Atualizando banco de mensagens WhatsApp...\n');

// Abre conexão com o banco
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Lê e executa o schema
console.log('📄 Lendo schema SQL...');
const schema = fs.readFileSync(schemaPath, 'utf8');

console.log('⚙️  Executando schema...');
db.exec(schema);

// Verifica templates de lembrete
console.log('\n📨 Templates de lembrete no banco:\n');
const lembretes = db.prepare(`
    SELECT codigo, titulo, fluxo, categoria, ativo
    FROM mensagens_whatsapp
    WHERE codigo LIKE '%lembrete%'
    ORDER BY codigo
`).all();

if (lembretes.length === 0) {
    console.log('❌ Nenhum template de lembrete encontrado!');
} else {
    lembretes.forEach(msg => {
        const status = msg.ativo ? '✅' : '❌';
        console.log(`${status} ${msg.codigo}`);
        console.log(`   Título: ${msg.titulo}`);
        console.log(`   Fluxo: ${msg.fluxo} | Categoria: ${msg.categoria}`);
        console.log('');
    });
}

// Lista todos os templates
console.log('\n📋 Todos os templates no banco:\n');
const todos = db.prepare(`
    SELECT codigo, titulo, fluxo, categoria, ativo
    FROM mensagens_whatsapp
    WHERE categoria = 'template' AND ativo = 1
    ORDER BY fluxo, codigo
`).all();

console.log(`Total: ${todos.length} templates ativos\n`);
todos.forEach(msg => {
    console.log(`• ${msg.codigo} (${msg.fluxo})`);
    console.log(`  ${msg.titulo}`);
});

db.close();
console.log('\n✅ Atualização concluída!');
