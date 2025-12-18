/**
 * Restaura textos originais completos, apenas removendo opções numeradas
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'mensagens-whatsapp.db');

console.log('📋 Restaurando textos originais completos\n');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Templates com textos originais COMPLETOS
const templatesCompletos = [
    {
        codigo: 'chat_confirmacao_presenca',
        texto: `Oi, {nome}.
Aqui é a Central de Atendimento do HMASP.

📋 Detalhes da Consulta:
• Especialidade: {especialidade}
• Data: {data}
• Horário: {horario}h
• Profissional: Dr(a) {profissional}

Por gentileza, confirme sua presença respondendo com o número:`
    },
    {
        codigo: 'chat_lembrete_72h',
        texto: `Olá, *{nome}*.
Aqui é a Central de Atendimento do HMASP.

⏰ *LEMBRETE: Sua consulta está próxima!*

📋 *Detalhes da Consulta:*
• Especialidade: *{especialidade}*
• Data: *{data}*
• Horário: *{horario}h*
• Profissional: Dr(a) *{profissional}*

Por gentileza, confirme sua presença respondendo com o número:

_HMASP - Central de Atendimento_`
    },
    {
        codigo: 'chat_desmarcacao',
        texto: `Oi, {nome}.
Aqui é a Central de Atendimento do HMASP.

⚠️ Informativo de Desmarcação:

Informamos que sua consulta foi *desmarcada* em nosso sistema:

• Especialidade: {especialidade}
• Data: {data}
• Horário: {horario}h
• Profissional: Dr(a) {profissional}

*Motivo:* Indisponibilidade do profissional ou solicitação do paciente.

Por favor, nos informe a situação para darmos o encaminhamento correto:`
    },
    {
        codigo: 'chat_reagendamento',
        texto: `Olá, *{nome}*.
Aqui é a Central de Atendimento do HMASP.

✅ *Sua consulta foi reagendada conforme solicitado!*

📋 *Detalhes da Nova Consulta:*
• Especialidade: *{especialidade}*
• Data: *{data}*
• Horário: *{horario}h*
• Profissional: Dr(a) *{profissional}*

Por gentileza, confirme sua presença respondendo com o número:

_HMASP - Central de Atendimento_`
    }
];

console.log('🔄 Atualizando textos...\n');

const stmt = db.prepare(`
    UPDATE mensagens_whatsapp
    SET texto = ?
    WHERE codigo = ?
`);

templatesCompletos.forEach(t => {
    const result = stmt.run(t.texto, t.codigo);
    if (result.changes > 0) {
        console.log(`   ✅ Atualizado: ${t.codigo}`);
    } else {
        console.log(`   ⚠️  Não encontrado: ${t.codigo}`);
    }
});

// Verifica resultado
console.log('\n📄 Templates atualizados:\n');
const verificacao = db.prepare(`
    SELECT codigo, titulo, SUBSTR(texto, 1, 150) as preview
    FROM mensagens_whatsapp
    WHERE codigo LIKE 'chat_%'
    ORDER BY codigo
`).all();

verificacao.forEach(t => {
    console.log(`${t.codigo}:`);
    console.log(`${t.preview}...`);
    console.log('');
});

db.close();
console.log('✅ Textos restaurados com sucesso!');
