/**
 * Script para listar todas as mensagens do banco
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'mensagens-whatsapp.db');

console.log('📋 Listando todas as mensagens do banco...\n');

// Abre conexão com o banco
const db = new Database(dbPath);

// Lista todas as mensagens
const todas = db.prepare(`
    SELECT
        codigo,
        titulo,
        fluxo,
        categoria,
        contexto,
        ativo,
        tipo_envio
    FROM mensagens_whatsapp
    ORDER BY fluxo, categoria, codigo
`).all();

console.log(`Total de mensagens: ${todas.length}\n`);

// Agrupa por fluxo
const porFluxo = todas.reduce((acc, msg) => {
    if (!acc[msg.fluxo]) {
        acc[msg.fluxo] = [];
    }
    acc[msg.fluxo].push(msg);
    return acc;
}, {});

for (const [fluxo, mensagens] of Object.entries(porFluxo)) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`FLUXO: ${fluxo.toUpperCase()}`);
    console.log(`${'='.repeat(60)}\n`);

    // Agrupa por categoria dentro do fluxo
    const porCategoria = mensagens.reduce((acc, msg) => {
        if (!acc[msg.categoria]) {
            acc[msg.categoria] = [];
        }
        acc[msg.categoria].push(msg);
        return acc;
    }, {});

    for (const [categoria, msgs] of Object.entries(porCategoria)) {
        console.log(`  Categoria: ${categoria}`);
        console.log(`  ${'-'.repeat(56)}`);

        msgs.forEach(msg => {
            const status = msg.ativo ? '✅' : '❌';
            console.log(`  ${status} ${msg.codigo}`);
            console.log(`     Título: ${msg.titulo || '(sem título)'}`);
            console.log(`     Contexto: ${msg.contexto || '(geral)'}`);
            console.log(`     Tipo: ${msg.tipo_envio}`);
            console.log('');
        });
    }
}

// Resumo por categoria
console.log(`\n${'='.repeat(60)}`);
console.log('RESUMO POR CATEGORIA');
console.log(`${'='.repeat(60)}\n`);

const porCategoriaGlobal = todas.reduce((acc, msg) => {
    if (!acc[msg.categoria]) {
        acc[msg.categoria] = { total: 0, ativas: 0 };
    }
    acc[msg.categoria].total++;
    if (msg.ativo) acc[msg.categoria].ativas++;
    return acc;
}, {});

for (const [categoria, stats] of Object.entries(porCategoriaGlobal)) {
    console.log(`  ${categoria}: ${stats.ativas}/${stats.total} ativas`);
}

db.close();
console.log('\n✅ Concluído!');
