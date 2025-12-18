/**
 * Atualiza templates diretamente no banco
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'mensagens-whatsapp.db');

console.log('📋 Atualizando templates para Chat Próprio\n');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// 1. Desativa templates antigos
console.log('🔄 Desativando templates antigos com opções numeradas...\n');

const templatesAntigos = [
    'notificacao_confirmacao_presenca',
    'notificacao_desmarcacao_consulta',
    'notificacao_reagendamento_confirmacao',
    'notificacao_lembrete_72h',
    'notificacao_lembrete_sem_resposta'
];

templatesAntigos.forEach(codigo => {
    const result = db.prepare(`
        UPDATE mensagens_whatsapp
        SET ativo = 0,
            observacoes = 'DESATIVADO: Migrado para Chat Próprio com botões interativos'
        WHERE codigo = ?
    `).run(codigo);

    if (result.changes > 0) {
        console.log(`   ✅ Desativado: ${codigo}`);
    } else {
        console.log(`   ℹ️  Não encontrado: ${codigo}`);
    }
});

// 2. Insere novos templates
console.log('\n🆕 Inserindo novos templates para Chat Próprio...\n');

const novosTemplates = [
    {
        codigo: 'chat_confirmacao_presenca',
        fluxo: 'confirmacao',
        categoria: 'template',
        contexto: 'confirmacao',
        titulo: '[Chat Próprio] Confirmação de Presença',
        texto: `Olá, {nome}!

Você tem uma nova consulta agendada:

📅 *{especialidade}*
🕐 {data} às {horario}h
👨‍⚕️ {profissional}

Por favor, confirme sua presença através dos botões abaixo.`,
        tipo_envio: 'chat_buttons',
        variaveis: '["nome", "data", "horario", "especialidade", "profissional"]',
        gatilho: 'Consulta marcada - Sistema Chat Próprio',
        obs: 'Template para Chat Próprio com botões: Confirmar / Não poderei / Não agendei'
    },
    {
        codigo: 'chat_lembrete_72h',
        fluxo: 'confirmacao',
        categoria: 'template',
        contexto: 'confirmacao',
        titulo: '[Chat Próprio] Lembrete 72h',
        texto: `Olá, {nome}!

⏰ Lembrete: Sua consulta é em 3 dias!

📅 *{especialidade}*
🕐 {data} às {horario}h
👨‍⚕️ {profissional}

Confirma sua presença?`,
        tipo_envio: 'chat_buttons',
        variaveis: '["nome", "data", "horario", "especialidade", "profissional"]',
        gatilho: 'Lembrete 72h antes - Sistema Chat Próprio',
        obs: 'Template para Chat Próprio com botões: Confirmar / Desmarcar'
    },
    {
        codigo: 'chat_desmarcacao',
        fluxo: 'desmarcacao',
        categoria: 'template',
        contexto: 'desmarcacao',
        titulo: '[Chat Próprio] Desmarcação de Consulta',
        texto: `Olá, {nome}!

Sua consulta foi desmarcada:

📅 *{especialidade}*
🕐 {data} às {horario}h

Deseja reagendar?`,
        tipo_envio: 'chat_buttons',
        variaveis: '["nome", "data", "horario", "especialidade", "profissional"]',
        gatilho: 'Consulta desmarcada - Sistema Chat Próprio',
        obs: 'Template para Chat Próprio com botões: Sim reagendar / Fui eu que desmarcou / Não obrigado'
    },
    {
        codigo: 'chat_reagendamento',
        fluxo: 'confirmacao',
        categoria: 'template',
        contexto: 'confirmacao',
        titulo: '[Chat Próprio] Reagendamento com Confirmação',
        texto: `Olá, {nome}!

✅ Sua consulta foi reagendada conforme solicitado!

📅 *{especialidade}*
🕐 {data} às {horario}h
👨‍⚕️ {profissional}

Por favor, confirme sua presença.`,
        tipo_envio: 'chat_buttons',
        variaveis: '["nome", "data", "horario", "especialidade", "profissional"]',
        gatilho: 'Consulta reagendada - Sistema Chat Próprio',
        obs: 'Template para Chat Próprio com botões: Confirmar / Não poderei / Não agendei'
    }
];

const stmt = db.prepare(`
    INSERT OR REPLACE INTO mensagens_whatsapp (
        codigo, fluxo, categoria, contexto, titulo, texto, tipo_envio,
        variaveis_disponiveis, gatilho_condicao, possui_botoes, ativo, observacoes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, ?)
`);

novosTemplates.forEach(t => {
    stmt.run(
        t.codigo, t.fluxo, t.categoria, t.contexto, t.titulo, t.texto,
        t.tipo_envio, t.variaveis, t.gatilho, t.obs
    );
    console.log(`   ✅ Inserido: ${t.codigo}`);
});

// 3. Mostra resultado
console.log('\n📊 Templates ativos (confirmação):');
const ativos = db.prepare(`
    SELECT codigo, titulo
    FROM mensagens_whatsapp
    WHERE ativo = 1 AND fluxo = 'confirmacao' AND categoria = 'template'
    ORDER BY codigo
`).all();

ativos.forEach(t => {
    console.log(`   • ${t.codigo}`);
    console.log(`     ${t.titulo}`);
});

db.close();
console.log('\n✅ Atualização concluída!');
