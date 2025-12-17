/**
 * Script para desativar a mensagem consulta_reagendada_comunicacao
 * Essa mensagem não é usada no código e causa confusão
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'mensagens-whatsapp.db');

console.log('🔧 Desativando mensagem duplicada de reagendamento...\n');

const db = new Database(dbPath);

// Verifica se a mensagem existe e está ativa
const mensagem = db.prepare(`
    SELECT codigo, titulo, categoria, ativo
    FROM mensagens_whatsapp
    WHERE codigo = 'consulta_reagendada_comunicacao'
`).get();

if (!mensagem) {
    console.log('❌ Mensagem não encontrada no banco de dados');
    db.close();
    process.exit(1);
}

console.log('📋 Mensagem encontrada:');
console.log(`   Código: ${mensagem.codigo}`);
console.log(`   Título: ${mensagem.titulo}`);
console.log(`   Categoria: ${mensagem.categoria}`);
console.log(`   Ativa: ${mensagem.ativo ? 'Sim' : 'Não'}`);
console.log('');

if (mensagem.ativo === 0) {
    console.log('ℹ️  Mensagem já está desativada');
    db.close();
    process.exit(0);
}

// Desativa a mensagem
console.log('⚙️  Desativando mensagem...');

db.prepare(`
    UPDATE mensagens_whatsapp
    SET ativo = 0
    WHERE codigo = 'consulta_reagendada_comunicacao'
`).run();

console.log('✅ Mensagem desativada com sucesso!\n');

// Lista mensagens de reagendamento ativas
console.log('📋 Mensagens de reagendamento ativas após a mudança:\n');

const reagendamentos = db.prepare(`
    SELECT codigo, titulo, fluxo, categoria, ativo
    FROM mensagens_whatsapp
    WHERE codigo LIKE '%reagend%' AND ativo = 1
    ORDER BY fluxo, categoria
`).all();

if (reagendamentos.length === 0) {
    console.log('   ⚠️  Nenhuma mensagem de reagendamento ativa!');
} else {
    reagendamentos.forEach(m => {
        console.log(`   ✅ ${m.codigo}`);
        console.log(`      ${m.titulo}`);
        console.log(`      Fluxo: ${m.fluxo} | Categoria: ${m.categoria}\n`);
    });
}

db.close();
console.log('✅ Concluído!');
