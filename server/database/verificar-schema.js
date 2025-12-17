/**
 * Script para verificar schema do banco de dados
 * Compara campos existentes no banco vs schema-consultas.sql
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'hmasp_consultas.db');

console.log('==========================================');
console.log('VERIFICAÇÃO DE SCHEMA DO BANCO');
console.log('==========================================\n');

try {
    const db = new Database(DB_PATH);

    // Verifica campos da tabela consultas_ativas
    console.log('📋 Campos da tabela CONSULTAS_ATIVAS:\n');
    const tableInfo = db.prepare("PRAGMA table_info(consultas_ativas)").all();

    const camposEsperados = [
        'id', 'consulta_numero', 'nome_paciente', 'prontuario', 'telefone', 'telefone_formatado',
        'especialidade', 'profissional', 'local', 'data_hora_formatada', 'data_consulta',
        'tipo', 'status_geral',
        'mensagem_template', 'mensagem_enviada', 'data_envio', 'whatsapp_message_id',
        'data_marcacao', 'data_apareceu_dashboard',
        'contexto', 'contexto_id', 'contexto_expires_at',
        'pac_codigo', 'nome_exibicao', 'data_resposta', 'badge_status', 'badge_info',
        'reagendamento_de', 'reagendamento_data', 'reagendamento_tipo',
        'criado_em', 'atualizado_em', 'criado_por'
    ];

    console.log('✅ Campos no banco:');
    tableInfo.forEach((col, index) => {
        const esperado = camposEsperados.includes(col.name);
        const emoji = esperado ? '✅' : '⚠️ ';
        console.log(`${emoji} ${index + 1}. ${col.name} (${col.type})${col.notnull ? ' NOT NULL' : ''}${col.dflt_value ? ' DEFAULT ' + col.dflt_value : ''}`);
    });

    // Verifica campos faltantes
    console.log('\n🔍 Verificando campos faltantes...');
    const camposNoBanco = tableInfo.map(col => col.name);
    const camposFaltantes = camposEsperados.filter(campo => !camposNoBanco.includes(campo));

    if (camposFaltantes.length > 0) {
        console.log('❌ Campos FALTANTES no banco:');
        camposFaltantes.forEach(campo => {
            console.log(`   - ${campo}`);
        });
    } else {
        console.log('✅ Todos os campos esperados estão presentes!');
    }

    // Verifica campos extras (não esperados)
    const camposExtras = camposNoBanco.filter(campo => !camposEsperados.includes(campo));
    if (camposExtras.length > 0) {
        console.log('\n⚠️  Campos EXTRAS no banco (não no schema):');
        camposExtras.forEach(campo => {
            console.log(`   - ${campo}`);
        });
    }

    // Verifica índices
    console.log('\n📊 Índices da tabela:');
    const indices = db.prepare("PRAGMA index_list(consultas_ativas)").all();
    indices.forEach((idx, i) => {
        console.log(`${i + 1}. ${idx.name}${idx.unique ? ' (UNIQUE)' : ''}`);
    });

    // Verifica se existem registros de reagendamento
    console.log('\n📈 Estatísticas:');
    const stats = db.prepare(`
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN reagendamento_de IS NOT NULL THEN 1 ELSE 0 END) as reagendamentos
        FROM consultas_ativas
    `).get();

    console.log(`   Total de consultas: ${stats.total}`);
    console.log(`   Reagendamentos: ${stats.reagendamentos}`);

    db.close();

    console.log('\n==========================================');
    console.log('✅ VERIFICAÇÃO CONCLUÍDA');
    console.log('==========================================');

    process.exit(0);

} catch (error) {
    console.error('\n❌ ERRO:');
    console.error(error.message);
    process.exit(1);
}
