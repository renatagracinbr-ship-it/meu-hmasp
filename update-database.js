const Database = require('better-sqlite3');
const db = new Database('./server/database/hmasp_consultas.db');

console.log('===== ATUALIZANDO CAMPOS FALTANTES =====\n');

// 1. Atualiza telefone_formatado para consultas que têm telefone mas não têm formatado
const updateTelefone = db.prepare(`
    UPDATE consultas_ativas
    SET telefone_formatado = CASE
        WHEN telefone LIKE '+55%' THEN
            '(' || substr(telefone, 4, 2) || ') ' ||
            substr(telefone, 6, 5) || '-' ||
            substr(telefone, 11, 4)
        ELSE telefone
    END
    WHERE telefone IS NOT NULL
    AND telefone != ''
    AND (telefone_formatado IS NULL OR telefone_formatado = '')
`);

const result1 = updateTelefone.run();
console.log(`✅ Telefones formatados atualizados: ${result1.changes} registros`);

// 2. Atualiza mensagem_template baseado no tipo
const updateTemplate = db.prepare(`
    UPDATE consultas_ativas
    SET mensagem_template = CASE
        WHEN tipo = 'MARCACAO' OR tipo = 'marcada' THEN 'marcacao_confirmacao'
        WHEN tipo = 'LEMBRETE_72H' OR tipo = 'lembrete72h' THEN 'lembrete_72h'
        ELSE 'marcacao_confirmacao'
    END
    WHERE mensagem_template IS NULL OR mensagem_template = ''
`);

const result2 = updateTemplate.run();
console.log(`✅ Templates de mensagem atualizados: ${result2.changes} registros`);

// 3. Padroniza campo tipo
const updateTipo = db.prepare(`
    UPDATE consultas_ativas
    SET tipo = CASE
        WHEN tipo = 'MARCACAO' THEN 'marcada'
        WHEN tipo = 'LEMBRETE_72H' THEN 'lembrete72h'
        ELSE tipo
    END
    WHERE tipo IN ('MARCACAO', 'LEMBRETE_72H')
`);

const result3 = updateTipo.run();
console.log(`✅ Tipos padronizados: ${result3.changes} registros`);

// 4. Define status_geral padrão para consultas sem status
const updateStatus = db.prepare(`
    UPDATE consultas_ativas
    SET status_geral = 'pending'
    WHERE status_geral IS NULL OR status_geral = ''
`);

const result4 = updateStatus.run();
console.log(`✅ Status padrão definido: ${result4.changes} registros`);

// 5. Verifica resultado
console.log('\n===== VERIFICANDO CONSULTAS DE EXEMPLO =====\n');
const exemplo = db.prepare(`
    SELECT consulta_numero, nome_paciente, telefone, telefone_formatado, mensagem_template, tipo, status_geral
    FROM consultas_ativas
    WHERE telefone IS NOT NULL AND telefone != ''
    LIMIT 3
`).all();

exemplo.forEach(c => {
    console.log(`Consulta: ${c.consulta_numero}`);
    console.log(`  Paciente: ${c.nome_paciente}`);
    console.log(`  Telefone: ${c.telefone}`);
    console.log(`  Formatado: ${c.telefone_formatado}`);
    console.log(`  Template: ${c.mensagem_template}`);
    console.log(`  Tipo: ${c.tipo}`);
    console.log(`  Status: ${c.status_geral}`);
    console.log('');
});

db.close();
console.log('✅ Banco de dados atualizado!\n');
