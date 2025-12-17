/**
 * Script para inserir o template de reagendamento no banco
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'mensagens-whatsapp.db');

console.log('📋 Verificando template de reagendamento...\n');

// Abre conexão com o banco
const db = new Database(dbPath);

// Busca templates de reagendamento
const existentes = db.prepare(`
    SELECT codigo, titulo, categoria
    FROM mensagens_whatsapp
    WHERE codigo LIKE '%reagendamento%'
`).all();

console.log('Templates com "reagendamento" no código:');
existentes.forEach(t => {
    console.log(`  - ${t.codigo} (${t.categoria})`);
});
console.log('');

// Verifica se o template principal existe
const existe = db.prepare(`
    SELECT codigo FROM mensagens_whatsapp
    WHERE codigo = 'notificacao_reagendamento_confirmacao'
`).get();

if (existe) {
    console.log('✅ Template notificacao_reagendamento_confirmacao já existe\n');
} else {
    console.log('➕ Inserindo template notificacao_reagendamento_confirmacao...\n');

    db.prepare(`
        INSERT INTO mensagens_whatsapp (
            codigo, fluxo, categoria, contexto, titulo, texto, tipo_envio,
            variaveis_disponiveis, gatilho_condicao, possui_botoes, ativo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        'notificacao_reagendamento_confirmacao',
        'confirmacao',
        'template',
        'confirmacao',
        'Notificação - Reagendamento com Confirmação de Presença',
        'Olá, *{nome}*.\nAqui é a Central de Marcação de Consultas do HMASP.\n\n✅ *Sua consulta foi reagendada conforme solicitado!*\n\n📋 *Detalhes da Nova Consulta:*\n• Especialidade: *{especialidade}*\n• Data: *{data}*\n• Horário: *{horario}h*\n• Profissional: Dr(a) *{profissional}*\n\nPor gentileza, confirme sua presença respondendo com o número:\n\n*1* - ✅ Confirmo presença\n*2* - ❌ Não poderei comparecer\n*3* - ⚠️ Não agendei essa consulta\n\n_HMASP - Central de Marcação de Consultas_',
        'send_message',
        '["nome", "data", "horario", "especialidade", "profissional"]',
        'Consulta foi reagendada pelo operador após solicitação do paciente',
        1,
        1
    );

    console.log('✅ Template inserido!');
}

// Lista todos os templates ativos
console.log('\n📋 Todos os templates ativos no banco:\n');
const templates = db.prepare(`
    SELECT codigo, titulo, fluxo, categoria
    FROM mensagens_whatsapp
    WHERE categoria = 'template' AND ativo = 1
    ORDER BY fluxo, codigo
`).all();

templates.forEach(t => {
    console.log(`  ✅ ${t.codigo} (${t.fluxo})`);
    console.log(`     ${t.titulo}\n`);
});

console.log(`Total: ${templates.length} templates ativos`);

db.close();
console.log('\n✅ Concluído!');
