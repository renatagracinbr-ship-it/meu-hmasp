/**
 * Verifica estado atual dos templates
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'mensagens-whatsapp.db');
const db = new Database(dbPath);

console.log('📊 RELATÓRIO DE TEMPLATES - CHAT PRÓPRIO\n');
console.log('=' .repeat(70) + '\n');

// Templates ativos para Chat Próprio
console.log('✅ TEMPLATES ATIVOS (Chat Próprio com botões):\n');
const ativos = db.prepare(`
    SELECT codigo, titulo, fluxo, tipo_envio, SUBSTR(texto, 1, 100) as texto_preview
    FROM mensagens_whatsapp
    WHERE ativo = 1 AND (codigo LIKE 'chat_%' OR categoria = 'template')
    ORDER BY fluxo, codigo
`).all();

ativos.forEach(t => {
    console.log(`📄 ${t.codigo}`);
    console.log(`   Título: ${t.titulo}`);
    console.log(`   Fluxo: ${t.fluxo} | Tipo: ${t.tipo_envio}`);
    console.log(`   Preview: ${t.texto_preview}...`);
    console.log('');
});

// Templates desativados (antigos com números)
console.log('\n❌ TEMPLATES DESATIVADOS (Legacy WhatsApp com opções 1,2,3):\n');
const inativos = db.prepare(`
    SELECT codigo, titulo
    FROM mensagens_whatsapp
    WHERE ativo = 0 AND codigo LIKE 'notificacao_%'
    ORDER BY codigo
`).all();

inativos.forEach(t => {
    console.log(`   🚫 ${t.codigo} - ${t.titulo}`);
});

// Estatísticas
console.log('\n' + '='.repeat(70));
console.log('\n📈 ESTATÍSTICAS:\n');
const stats = db.prepare(`
    SELECT
        COUNT(*) as total,
        SUM(CASE WHEN ativo = 1 THEN 1 ELSE 0 END) as ativos,
        SUM(CASE WHEN ativo = 0 THEN 1 ELSE 0 END) as inativos
    FROM mensagens_whatsapp
`).get();

console.log(`   Total de mensagens no banco: ${stats.total}`);
console.log(`   Ativas: ${stats.ativos}`);
console.log(`   Inativas: ${stats.inativos}`);

db.close();
console.log('\n✅ Verificação concluída!\n');
