/**
 * Restaura negritos (markdown) nos templates
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'mensagens-whatsapp.db');

console.log('📋 Restaurando negritos nos templates\n');

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Templates com negritos restaurados
const templatesComNegritos = [
    {
        codigo: 'chat_confirmacao_presenca',
        texto: `Oi, {nome}.
Aqui é a Central de Atendimento do HMASP.

📋 *Detalhes da Consulta:*
• *Especialidade:* {especialidade}
• *Data:* {data}
• *Horário:* {horario}h
• *Profissional:* Dr(a) {profissional}

Por gentileza, confirme sua presença.`
    },
    {
        codigo: 'chat_lembrete_72h',
        texto: `Olá, *{nome}*.
Aqui é a Central de Atendimento do HMASP.

⏰ *LEMBRETE: Sua consulta está próxima!*

📋 *Detalhes da Consulta:*
• *Especialidade:* {especialidade}
• *Data:* {data}
• *Horário:* {horario}h
• *Profissional:* Dr(a) {profissional}

Por gentileza, confirme sua presença.

_HMASP - Central de Atendimento_`
    },
    {
        codigo: 'chat_desmarcacao',
        texto: `Oi, {nome}.
Aqui é a Central de Atendimento do HMASP.

⚠️ *Informativo de Desmarcação:*

Informamos que sua consulta foi *desmarcada* em nosso sistema:

• *Especialidade:* {especialidade}
• *Data:* {data}
• *Horário:* {horario}h
• *Profissional:* Dr(a) {profissional}

*Motivo:* Indisponibilidade do profissional ou solicitação do paciente.

Por favor, nos informe a situação para darmos o encaminhamento correto.`
    },
    {
        codigo: 'chat_reagendamento',
        texto: `Olá, *{nome}*.
Aqui é a Central de Atendimento do HMASP.

✅ *Sua consulta foi reagendada conforme solicitado!*

📋 *Detalhes da Nova Consulta:*
• *Especialidade:* {especialidade}
• *Data:* {data}
• *Horário:* {horario}h
• *Profissional:* Dr(a) {profissional}

Por gentileza, confirme sua presença.

_HMASP - Central de Atendimento_`
    }
];

console.log('🔄 Atualizando templates com negritos...\n');

const stmt = db.prepare(`
    UPDATE mensagens_whatsapp
    SET texto = ?
    WHERE codigo = ?
`);

templatesComNegritos.forEach(t => {
    const result = stmt.run(t.texto, t.codigo);
    if (result.changes > 0) {
        console.log(`   ✅ ${t.codigo}`);
    }
});

console.log('\n✅ Negritos restaurados com sucesso!\n');

// Mostra preview
console.log('📄 Preview do template de confirmação:\n');
const preview = db.prepare(`
    SELECT texto
    FROM mensagens_whatsapp
    WHERE codigo = 'chat_confirmacao_presenca'
`).get();

console.log(preview.texto);
console.log('');

db.close();
