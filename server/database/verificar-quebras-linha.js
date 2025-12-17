/**
 * Script para verificar se há \n literais nas mensagens
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'mensagens-whatsapp.db');

console.log('🔍 Verificando quebras de linha nas mensagens...\n');

const db = new Database(dbPath);

// Busca templates ativos
const templates = db.prepare(`
    SELECT codigo, titulo, texto
    FROM mensagens_whatsapp
    WHERE categoria = 'template' AND ativo = 1
    ORDER BY codigo
`).all();

console.log(`📋 Verificando ${templates.length} templates ativos:\n`);
console.log('='.repeat(80));

let temProblema = false;

templates.forEach(t => {
    console.log(`\n📌 ${t.codigo}`);
    console.log(`   ${t.titulo}`);
    console.log('─'.repeat(80));

    // Verifica se tem \n literal (barra seguida de n)
    const temBarraN = t.texto.includes('\\n');

    if (temBarraN) {
        console.log('   ❌ PROBLEMA: Contém \\n literal (não vai quebrar linha!)');
        console.log('\n   Texto atual:');
        console.log('   ' + t.texto.substring(0, 200) + '...');
        temProblema = true;
    } else {
        console.log('   ✅ OK: Quebras de linha corretas');
        // Mostra primeira linha apenas
        const primeiraLinha = t.texto.split('\n')[0];
        console.log('   Primeira linha: ' + primeiraLinha);
    }
});

console.log('\n' + '='.repeat(80));

if (temProblema) {
    console.log('\n⚠️  ATENÇÃO: Foram encontrados problemas!');
    console.log('   As mensagens com \\n literal não vão quebrar linha no WhatsApp.');
    console.log('   Execute o script de correção para corrigir.\n');
} else {
    console.log('\n✅ Todas as mensagens estão OK!\n');
}

db.close();
