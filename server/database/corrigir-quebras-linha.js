/**
 * Script para corrigir \n literais nas mensagens
 * Substitui \\n por quebras de linha reais
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'mensagens-whatsapp.db');

console.log('🔧 Corrigindo quebras de linha nas mensagens...\n');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Busca templates com \n literal
const templates = db.prepare(`
    SELECT codigo, titulo, texto
    FROM mensagens_whatsapp
    WHERE categoria = 'template'
      AND ativo = 1
      AND texto LIKE '%\\n%'
`).all();

console.log(`📋 Encontrados ${templates.length} templates com \\n literal:\n`);

if (templates.length === 0) {
    console.log('✅ Nenhuma correção necessária!');
    db.close();
    process.exit(0);
}

const updateStmt = db.prepare(`
    UPDATE mensagens_whatsapp
    SET texto = ?
    WHERE codigo = ?
`);

let corrigidos = 0;

templates.forEach(t => {
    console.log(`📌 ${t.codigo}`);
    console.log(`   ${t.titulo}`);

    // Substitui \\n por quebras de linha reais
    const textoCorrigido = t.texto.replace(/\\n/g, '\n');

    // Conta quantos \\n foram substituídos
    const quantidadeSubstituicoes = (t.texto.match(/\\n/g) || []).length;

    console.log(`   ✏️  Substituindo ${quantidadeSubstituicoes} ocorrências de \\n`);

    // Mostra antes e depois (primeira linha)
    const antesPreview = t.texto.substring(0, 100).replace(/\\n/g, '␊');
    const depoisPreview = textoCorrigido.substring(0, 100).split('\n')[0];

    console.log(`   ANTES: ${antesPreview}...`);
    console.log(`   DEPOIS: ${depoisPreview}...`);

    // Atualiza no banco
    updateStmt.run(textoCorrigido, t.codigo);

    console.log(`   ✅ Corrigido!\n`);
    corrigidos++;
});

console.log('='.repeat(80));
console.log(`\n✅ ${corrigidos} templates corrigidos com sucesso!\n`);

// Verifica se ainda há problemas
const verificacao = db.prepare(`
    SELECT COUNT(*) as total
    FROM mensagens_whatsapp
    WHERE categoria = 'template'
      AND ativo = 1
      AND texto LIKE '%\\n%'
`).get();

if (verificacao.total > 0) {
    console.log(`⚠️  ATENÇÃO: Ainda há ${verificacao.total} templates com problemas!`);
} else {
    console.log('✅ Todos os templates foram corrigidos!\n');
}

db.close();
