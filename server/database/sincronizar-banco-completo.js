/**
 * Script para sincronizar TODAS as mensagens do schema para o banco
 * Executa os INSERTs do schema SQL
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'mensagens-whatsapp.db');
const schemaPath = path.join(__dirname, 'schema-mensagens-whatsapp.sql');

console.log('🔄 Sincronizando banco de mensagens com schema SQL...\n');

// Abre conexão com o banco
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Lê o schema
const schema = fs.readFileSync(schemaPath, 'utf8');

// Extrai apenas os blocos de INSERT (ignora CREATE TABLE e CREATE INDEX)
const insertBlocks = schema.match(/INSERT OR REPLACE INTO mensagens_whatsapp[\s\S]*?;/g);

console.log(`📄 Encontrados ${insertBlocks ? insertBlocks.length : 0} blocos de INSERT no schema\n`);

if (insertBlocks) {
    // Conta mensagens antes
    const antesDe = db.prepare('SELECT COUNT(*) as total FROM mensagens_whatsapp').get().total;

    // Executa cada bloco
    insertBlocks.forEach((block, index) => {
        try {
            db.exec(block);
            console.log(`✅ Bloco ${index + 1}/${insertBlocks.length} executado`);
        } catch (error) {
            console.error(`❌ Erro no bloco ${index + 1}:`, error.message);
        }
    });

    // Conta mensagens depois
    const depoisDe = db.prepare('SELECT COUNT(*) as total FROM mensagens_whatsapp').get().total;
    const novas = depoisDe - antesDe;

    console.log(`\n📊 Resultado:`);
    console.log(`   Antes: ${antesDe} mensagens`);
    console.log(`   Depois: ${depoisDe} mensagens`);
    console.log(`   Novas/Atualizadas: ${novas >= 0 ? '+' + novas : novas}`);
}

// Lista todos os templates
console.log('\n📋 Todos os templates no banco:\n');
const templates = db.prepare(`
    SELECT codigo, titulo, fluxo, categoria
    FROM mensagens_whatsapp
    WHERE categoria = 'template' AND ativo = 1
    ORDER BY fluxo, codigo
`).all();

templates.forEach(t => {
    console.log(`  ✅ ${t.codigo}`);
    console.log(`     ${t.titulo} (${t.fluxo})\n`);
});

console.log(`Total: ${templates.length} templates ativos`);

// Resumo por fluxo
console.log('\n📊 Resumo por fluxo:\n');
const porFluxo = db.prepare(`
    SELECT
        fluxo,
        COUNT(*) as total,
        SUM(CASE WHEN ativo = 1 THEN 1 ELSE 0 END) as ativas
    FROM mensagens_whatsapp
    GROUP BY fluxo
    ORDER BY fluxo
`).all();

porFluxo.forEach(f => {
    console.log(`  ${f.fluxo}: ${f.ativas}/${f.total} ativas`);
});

db.close();
console.log('\n✅ Sincronização concluída!');
