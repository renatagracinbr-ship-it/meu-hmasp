/**
 * Script para listar apenas os templates do banco
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'mensagens-whatsapp.db');

console.log('📋 Templates no banco de dados:\n');

const db = new Database(dbPath);

const templates = db.prepare(`
    SELECT codigo, titulo, fluxo, categoria, ativo
    FROM mensagens_whatsapp
    WHERE categoria = 'template'
    ORDER BY fluxo, codigo
`).all();

console.log(`Total: ${templates.length} templates\n`);

templates.forEach(t => {
    const status = t.ativo ? '✅' : '❌';
    console.log(`${status} ${t.codigo}`);
    console.log(`   Título: ${t.titulo}`);
    console.log(`   Fluxo: ${t.fluxo}`);
    console.log('');
});

db.close();
