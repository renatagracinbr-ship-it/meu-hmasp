/**
 * Script para reaplicar templates do schema com quebras de linha corretas
 * Extrai os INSERT do schema e executa com quebras de linha reais
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'mensagens-whatsapp.db');
const schemaPath = path.join(__dirname, 'schema-mensagens-whatsapp.sql');

console.log('🔧 Reaplicando templates do schema com quebras de linha corretas...\n');

// Abre conexão com o banco
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

// Lê o schema
const schema = fs.readFileSync(schemaPath, 'utf8');

// Define os templates que precisamos atualizar
const templateCodes = [
    'notificacao_confirmacao_presenca',
    'notificacao_desmarcacao_consulta',
    'notificacao_lembrete_72h',
    'notificacao_reagendamento_confirmacao',
    'notificacao_lembrete_sem_resposta'
];

console.log(`📋 Atualizando ${templateCodes.length} templates do schema:\n`);

let atualizados = 0;

templateCodes.forEach(codigo => {
    // Extrai o bloco INSERT do template
    const regex = new RegExp(`\\(\\s*'${codigo}'[^)]+\\)`, 's');
    const match = schema.match(regex);

    if (!match) {
        console.log(`❌ ${codigo} - não encontrado no schema`);
        return;
    }

    // Extrai o texto da mensagem
    const textoMatch = match[0].match(/'([^']*(?:''[^']*)*)'/g);

    if (!textoMatch || textoMatch.length < 7) {
        console.log(`❌ ${codigo} - texto não encontrado`);
        return;
    }

    // O 6º campo é o texto (depois de codigo, fluxo, categoria, contexto, titulo)
    let textoSQL = textoMatch[5];

    // Remove aspas do SQL
    textoSQL = textoSQL.slice(1, -1);

    // Substitui '' (escape SQL) por '
    textoSQL = textoSQL.replace(/''/g, "'");

    // IMPORTANTE: No SQL, \n é literal. Precisamos converter para quebra real
    // O texto já vem do schema com \n literal, não precisa converter
    const textoFinal = textoSQL;

    console.log(`📌 ${codigo}`);
    console.log(`   Primeira linha: ${textoFinal.split('\\n')[0]}...`);

    // Atualiza no banco
    try {
        const result = db.prepare(`
            UPDATE mensagens_whatsapp
            SET texto = ?
            WHERE codigo = ?
        `).run(textoFinal, codigo);

        if (result.changes > 0) {
            console.log(`   ✅ Atualizado (${result.changes} linha)\\n`);
            atualizados++;
        } else {
            console.log(`   ⚠️  Não foi atualizado (template não existe?)\\n`);
        }
    } catch (error) {
        console.log(`   ❌ Erro: ${error.message}\\n`);
    }
});

console.log('='.repeat(80));
console.log(`\\n✅ ${atualizados}/${templateCodes.length} templates atualizados!\\n`);

// Agora corrige todos que ainda tiverem \\n literal
console.log('🔍 Verificando e corrigindo \\\\n literais restantes...\\n');

const comProblema = db.prepare(`
    SELECT codigo, texto
    FROM mensagens_whatsapp
    WHERE categoria = 'template'
      AND ativo = 1
      AND texto LIKE '%\\n%'
`).all();

if (comProblema.length > 0) {
    console.log(`❌ Ainda há ${comProblema.length} templates com \\\\n literal!\\n`);
    console.log('Executando correção final...\\n');

    comProblema.forEach(t => {
        const textoCorrigido = t.texto.replace(/\\n/g, '\\n');

        db.prepare(`
            UPDATE mensagens_whatsapp
            SET texto = ?
            WHERE codigo = ?
        `).run(textoCorrigido, t.codigo);

        console.log(`✅ Corrigido: ${t.codigo}`);
    });

    console.log('');
}

// Verificação final
const verificacao = db.prepare(`
    SELECT COUNT(*) as total
    FROM mensagens_whatsapp
    WHERE categoria = 'template'
      AND ativo = 1
      AND texto LIKE '%\\n%'
`).get();

console.log('='.repeat(80));
if (verificacao.total > 0) {
    console.log(`\\n⚠️  ATENÇÃO: Ainda há ${verificacao.total} templates com problemas!\\n`);
} else {
    console.log('\\n✅ Todos os templates estão corretos!\\n');
}

db.close();
