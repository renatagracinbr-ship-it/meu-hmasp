/**
 * Script para inserir o template de lembrete 72h no banco
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'mensagens-whatsapp.db');

console.log('📋 Inserindo template de lembrete 72h...\n');

// Abre conexão com o banco
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Verifica se o template já existe
const existe = db.prepare(`
    SELECT codigo FROM mensagens_whatsapp
    WHERE codigo = 'notificacao_lembrete_72h'
`).get();

if (existe) {
    console.log('ℹ️  Template já existe, atualizando...');

    db.prepare(`
        UPDATE mensagens_whatsapp
        SET
            texto = ?,
            titulo = 'Lembrete - Consulta Próxima (72h antes)',
            fluxo = 'confirmacao',
            categoria = 'template',
            contexto = 'confirmacao',
            tipo_envio = 'send_message',
            variaveis_disponiveis = '["nome", "data", "horario", "especialidade", "profissional"]',
            gatilho_condicao = 'Lembrete enviado 72h antes da consulta agendada',
            possui_botoes = 1,
            ativo = 1
        WHERE codigo = 'notificacao_lembrete_72h'
    `).run('Olá, *{nome}*.\nAqui é a Central de Marcação de Consultas do HMASP.\n\n⏰ *LEMBRETE: Sua consulta está próxima!*\n\n📋 *Detalhes da Consulta:*\n• Especialidade: *{especialidade}*\n• Data: *{data}*\n• Horário: *{horario}h*\n• Profissional: Dr(a) *{profissional}*\n\nPor gentileza, confirme sua presença respondendo com o número:\n\n*1* - ✅ Confirmo presença\n*2* - ❌ Não poderei comparecer\n*3* - ⚠️ Não agendei essa consulta\n\n_HMASP - Central de Marcação de Consultas_');

    console.log('✅ Template atualizado!');
} else {
    console.log('➕ Inserindo novo template...');

    db.prepare(`
        INSERT INTO mensagens_whatsapp (
            codigo, fluxo, categoria, contexto, titulo, texto, tipo_envio,
            variaveis_disponiveis, gatilho_condicao, possui_botoes, ativo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        'notificacao_lembrete_72h',
        'confirmacao',
        'template',
        'confirmacao',
        'Lembrete - Consulta Próxima (72h antes)',
        'Olá, *{nome}*.\nAqui é a Central de Marcação de Consultas do HMASP.\n\n⏰ *LEMBRETE: Sua consulta está próxima!*\n\n📋 *Detalhes da Consulta:*\n• Especialidade: *{especialidade}*\n• Data: *{data}*\n• Horário: *{horario}h*\n• Profissional: Dr(a) *{profissional}*\n\nPor gentileza, confirme sua presença respondendo com o número:\n\n*1* - ✅ Confirmo presença\n*2* - ❌ Não poderei comparecer\n*3* - ⚠️ Não agendei essa consulta\n\n_HMASP - Central de Marcação de Consultas_',
        'send_message',
        '["nome", "data", "horario", "especialidade", "profissional"]',
        'Lembrete enviado 72h antes da consulta agendada',
        1,
        1
    );

    console.log('✅ Template inserido!');
}

// Verifica se o template de lembrete sem resposta também existe
const existeSemResposta = db.prepare(`
    SELECT codigo FROM mensagens_whatsapp
    WHERE codigo = 'notificacao_lembrete_sem_resposta'
`).get();

if (!existeSemResposta) {
    console.log('\n➕ Inserindo template de lembrete sem resposta...');

    db.prepare(`
        INSERT INTO mensagens_whatsapp (
            codigo, fluxo, categoria, contexto, titulo, texto, tipo_envio,
            variaveis_disponiveis, gatilho_condicao, possui_botoes, ativo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        'notificacao_lembrete_sem_resposta',
        'confirmacao',
        'template',
        'confirmacao',
        'Lembrete - Sem Resposta (5 minutos)',
        'Olá, *{nome}*. Ainda não recebemos sua confirmação. Lembramos que sua consulta de *{especialidade}* está marcada para *{data}* às *{horario}h*. Por favor, confirme sua presença respondendo: *1* (Confirmo) / *2* (Não poderei) / *3* (Não agendei).',
        'send_message',
        '["nome", "data", "horario", "especialidade"]',
        'Lembrete enviado após 5 minutos sem resposta',
        1,
        1
    );

    console.log('✅ Template inserido!');
}

// Lista todos os templates
console.log('\n📋 Templates de confirmação no banco:\n');
const templates = db.prepare(`
    SELECT codigo, titulo, ativo
    FROM mensagens_whatsapp
    WHERE fluxo = 'confirmacao' AND categoria = 'template'
    ORDER BY codigo
`).all();

templates.forEach(msg => {
    const status = msg.ativo ? '✅' : '❌';
    console.log(`${status} ${msg.codigo}`);
    console.log(`   ${msg.titulo}\n`);
});

console.log(`Total: ${templates.length} templates de confirmação`);

db.close();
console.log('\n✅ Concluído!');
