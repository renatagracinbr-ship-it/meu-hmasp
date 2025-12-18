/**
 * Mostra texto completo dos templates
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'mensagens-whatsapp.db');
const db = new Database(dbPath);

console.log('📄 TEXTOS COMPLETOS DOS TEMPLATES\n');
console.log('='.repeat(70) + '\n');

const templates = db.prepare(`
    SELECT codigo, titulo, texto
    FROM mensagens_whatsapp
    WHERE codigo LIKE 'chat_%'
    ORDER BY fluxo, codigo
`).all();

templates.forEach((t, index) => {
    console.log(`${index + 1}. ${t.codigo}`);
    console.log(`   Título: ${t.titulo}\n`);
    console.log('   Texto:');
    console.log('   ' + '─'.repeat(66));
    console.log(t.texto.split('\n').map(line => '   ' + line).join('\n'));
    console.log('   ' + '─'.repeat(66));
    console.log('\n');
});

db.close();
