/**
 * Script para verificar mensagens de reagendamento
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'mensagens-whatsapp.db');

console.log('🔍 Verificando mensagens de reagendamento...\n');

const db = new Database(dbPath);

// Busca por código
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('BUSCA POR CÓDIGO (contém "reagend"):');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const porCodigo = db.prepare(`
    SELECT codigo, titulo, fluxo, categoria, contexto, ativo
    FROM mensagens_whatsapp
    WHERE codigo LIKE '%reagend%'
    ORDER BY fluxo, categoria, codigo
`).all();

if (porCodigo.length === 0) {
    console.log('❌ Nenhuma mensagem encontrada\n');
} else {
    porCodigo.forEach(m => {
        const status = m.ativo ? '✅' : '❌';
        console.log(`${status} ${m.codigo}`);
        console.log(`   Título: ${m.titulo}`);
        console.log(`   Fluxo: ${m.fluxo} | Categoria: ${m.categoria} | Contexto: ${m.contexto}`);
        console.log('');
    });
}

// Busca por categoria
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('BUSCA POR CATEGORIA (categoria = "reagendamento"):');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const porCategoria = db.prepare(`
    SELECT codigo, titulo, fluxo, categoria, contexto, ativo
    FROM mensagens_whatsapp
    WHERE categoria = 'reagendamento'
    ORDER BY fluxo, codigo
`).all();

if (porCategoria.length === 0) {
    console.log('❌ Nenhuma mensagem encontrada\n');
} else {
    porCategoria.forEach(m => {
        const status = m.ativo ? '✅' : '❌';
        console.log(`${status} ${m.codigo}`);
        console.log(`   Título: ${m.titulo}`);
        console.log(`   Fluxo: ${m.fluxo} | Contexto: ${m.contexto}`);
        console.log('');
    });
}

// Lista TODAS as mensagens agrupadas por fluxo
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('TODAS AS MENSAGENS POR FLUXO:');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

const todas = db.prepare(`
    SELECT codigo, titulo, fluxo, categoria, contexto, ativo
    FROM mensagens_whatsapp
    ORDER BY fluxo, categoria, codigo
`).all();

const porFluxo = todas.reduce((acc, msg) => {
    if (!acc[msg.fluxo]) acc[msg.fluxo] = [];
    acc[msg.fluxo].push(msg);
    return acc;
}, {});

for (const [fluxo, mensagens] of Object.entries(porFluxo)) {
    console.log(`\n📂 FLUXO: ${fluxo.toUpperCase()}`);
    console.log('─'.repeat(60));

    mensagens.forEach(m => {
        const status = m.ativo ? '✅' : '❌';
        console.log(`\n  ${status} ${m.codigo}`);
        console.log(`     Título: ${m.titulo}`);
        console.log(`     Categoria: ${m.categoria} | Contexto: ${m.contexto || '(nenhum)'}`);
    });
    console.log('');
}

db.close();
console.log('\n✅ Verificação concluída!');
