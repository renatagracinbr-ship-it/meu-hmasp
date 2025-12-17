/**
 * Script para ver textos das mensagens de reagendamento
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'mensagens-whatsapp.db');

console.log('📋 Textos das mensagens de reagendamento:\n');

const db = new Database(dbPath);

const mensagens = db.prepare(`
    SELECT codigo, titulo, fluxo, categoria, texto, variaveis_disponiveis
    FROM mensagens_whatsapp
    WHERE codigo IN ('notificacao_reagendamento_confirmacao', 'consulta_reagendada_comunicacao')
    ORDER BY fluxo
`).all();

mensagens.forEach(m => {
    console.log('━'.repeat(80));
    console.log(`CÓDIGO: ${m.codigo}`);
    console.log(`TÍTULO: ${m.titulo}`);
    console.log(`FLUXO: ${m.fluxo} | CATEGORIA: ${m.categoria}`);
    console.log('━'.repeat(80));
    console.log('\nTEXTO:');
    console.log(m.texto);
    console.log('\nVARIÁVEIS DISPONÍVEIS:');
    console.log(m.variaveis_disponiveis || '(nenhuma)');
    console.log('\n');
});

db.close();
