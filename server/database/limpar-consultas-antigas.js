/**
 * Script: Limpeza Automática de Consultas Antigas
 *
 * Funcionalidade:
 * 1. Arquiva consultas passadas (mais de 24h)
 * 2. Exclui consultas muito antigas (mais de 90 dias)
 * 3. Exibe estatísticas de limpeza
 *
 * Uso:
 * - node server/database/limpar-consultas-antigas.js
 * - Executar periodicamente (ex: diariamente via cron/scheduler)
 */

const Database = require('better-sqlite3');
const path = require('path');

// Caminho do banco de dados
const DB_PATH = path.join(__dirname, '../../data/consultas.db');

console.log('='.repeat(80));
console.log('LIMPEZA AUTOMÁTICA DE CONSULTAS ANTIGAS');
console.log('='.repeat(80));
console.log(`Banco: ${DB_PATH}`);
console.log('Data:', new Date().toISOString());
console.log('='.repeat(80));

try {
    // Abre conexão com banco
    const db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');

    // ============================================================================
    // ESTATÍSTICAS ANTES DA LIMPEZA
    // ============================================================================
    console.log('\n📊 ESTATÍSTICAS ANTES DA LIMPEZA:');
    console.log('-'.repeat(80));

    const statsAntes = db.prepare(`
        SELECT
            CASE
                WHEN data_consulta >= datetime('now') THEN 'Futura'
                WHEN data_consulta >= datetime('now', '-24 hours') THEN 'Passada (< 24h)'
                WHEN data_consulta >= datetime('now', '-7 days') THEN 'Passada (< 7 dias)'
                WHEN data_consulta >= datetime('now', '-30 days') THEN 'Passada (< 30 dias)'
                WHEN data_consulta >= datetime('now', '-90 days') THEN 'Passada (< 90 dias)'
                ELSE 'Muito Antiga (90+ dias)'
            END as status_temporal,
            COUNT(*) as quantidade
        FROM consultas_ativas
        GROUP BY status_temporal
        ORDER BY
            CASE status_temporal
                WHEN 'Futura' THEN 1
                WHEN 'Passada (< 24h)' THEN 2
                WHEN 'Passada (< 7 dias)' THEN 3
                WHEN 'Passada (< 30 dias)' THEN 4
                WHEN 'Passada (< 90 dias)' THEN 5
                ELSE 6
            END
    `).all();

    statsAntes.forEach(stat => {
        console.log(`  ${stat.status_temporal.padEnd(30)} ${stat.quantidade} consultas`);
    });

    const totalAntes = db.prepare('SELECT COUNT(*) as total FROM consultas_ativas').get();
    const totalArquivadasAntes = db.prepare('SELECT COUNT(*) as total FROM consultas_arquivadas').get();
    console.log(`\n  TOTAL ATIVAS: ${totalAntes.total}`);
    console.log(`  TOTAL ARQUIVADAS: ${totalArquivadasAntes.total}`);

    // ============================================================================
    // ARQUIVAMENTO: Consultas passadas (mais de 24h)
    // ============================================================================
    console.log('\n📦 ARQUIVANDO CONSULTAS PASSADAS (24h+)...');
    console.log('-'.repeat(80));

    // Conta quantas serão arquivadas
    const contarArquivar = db.prepare(`
        SELECT COUNT(*) as total
        FROM consultas_ativas
        WHERE data_consulta < datetime('now', '-24 hours')
    `).get();

    if (contarArquivar.total > 0) {
        // Arquiva (move para consultas_arquivadas)
        const arquivar = db.prepare(`
            INSERT INTO consultas_arquivadas (
                id, consulta_numero, nome_paciente, nome_exibicao, pac_codigo,
                prontuario, telefone, telefone_formatado, especialidade, profissional,
                local, data_hora_formatada, data_consulta, tipo, status_geral,
                mensagem_template, mensagem_enviada, data_envio, whatsapp_message_id,
                data_marcacao, data_apareceu_dashboard, contexto, contexto_id,
                contexto_expires_at, reagendamento_de, reagendamento_data,
                reagendamento_tipo, data_resposta, badge_status, badge_info,
                criado_em, atualizado_em, criado_por,
                data_arquivamento, motivo_arquivamento, arquivado_por
            )
            SELECT
                id, consulta_numero, nome_paciente, nome_exibicao, pac_codigo,
                prontuario, telefone, telefone_formatado, especialidade, profissional,
                local, data_hora_formatada, data_consulta, tipo, status_geral,
                mensagem_template, mensagem_enviada, data_envio, whatsapp_message_id,
                data_marcacao, data_apareceu_dashboard, contexto, contexto_id,
                contexto_expires_at, reagendamento_de, reagendamento_data,
                reagendamento_tipo, data_resposta, badge_status, badge_info,
                criado_em, atualizado_em, criado_por,
                datetime('now') as data_arquivamento,
                'arquivamento_automatico_24h' as motivo_arquivamento,
                'sistema_limpeza' as arquivado_por
            FROM consultas_ativas
            WHERE data_consulta < datetime('now', '-24 hours')
        `);

        const resultArquivar = arquivar.run();
        console.log(`  ✅ ${resultArquivar.changes} consultas arquivadas`);

        // Remove da tabela ativa
        const deletar = db.prepare(`
            DELETE FROM consultas_ativas
            WHERE data_consulta < datetime('now', '-24 hours')
        `);

        const resultDeletar = deletar.run();
        console.log(`  ✅ ${resultDeletar.changes} consultas removidas da tabela ativa`);
    } else {
        console.log('  ℹ️ Nenhuma consulta para arquivar');
    }

    // ============================================================================
    // EXCLUSÃO: Consultas muito antigas (mais de 90 dias)
    // ============================================================================
    console.log('\n🗑️  EXCLUINDO CONSULTAS MUITO ANTIGAS (90+ dias)...');
    console.log('-'.repeat(80));

    const contarExcluir = db.prepare(`
        SELECT COUNT(*) as total
        FROM consultas_ativas
        WHERE data_consulta < datetime('now', '-90 days')
    `).get();

    if (contarExcluir.total > 0) {
        const excluir = db.prepare(`
            DELETE FROM consultas_ativas
            WHERE data_consulta < datetime('now', '-90 days')
        `);

        const resultExcluir = excluir.run();
        console.log(`  ✅ ${resultExcluir.changes} consultas muito antigas excluídas`);
    } else {
        console.log('  ℹ️ Nenhuma consulta muito antiga para excluir');
    }

    // ============================================================================
    // LIMPEZA DE DESMARCAÇÕES ANTIGAS
    // ============================================================================
    console.log('\n🗑️  LIMPANDO DESMARCAÇÕES ANTIGAS (30+ dias)...');
    console.log('-'.repeat(80));

    const contarDesmarcacoes = db.prepare(`
        SELECT COUNT(*) as total
        FROM desmarcacoes_ativas
        WHERE data_consulta < datetime('now', '-30 days')
    `).get();

    if (contarDesmarcacoes.total > 0) {
        const excluirDesm = db.prepare(`
            DELETE FROM desmarcacoes_ativas
            WHERE data_consulta < datetime('now', '-30 days')
        `);

        const resultDesm = excluirDesm.run();
        console.log(`  ✅ ${resultDesm.changes} desmarcações antigas excluídas`);
    } else {
        console.log('  ℹ️ Nenhuma desmarcação antiga para excluir');
    }

    // ============================================================================
    // ESTATÍSTICAS DEPOIS DA LIMPEZA
    // ============================================================================
    console.log('\n📊 ESTATÍSTICAS DEPOIS DA LIMPEZA:');
    console.log('-'.repeat(80));

    const statsDepois = db.prepare(`
        SELECT
            CASE
                WHEN data_consulta >= datetime('now') THEN 'Futura'
                WHEN data_consulta >= datetime('now', '-24 hours') THEN 'Passada (< 24h)'
                WHEN data_consulta >= datetime('now', '-7 days') THEN 'Passada (< 7 dias)'
                WHEN data_consulta >= datetime('now', '-30 days') THEN 'Passada (< 30 dias)'
                WHEN data_consulta >= datetime('now', '-90 days') THEN 'Passada (< 90 dias)'
                ELSE 'Muito Antiga (90+ dias)'
            END as status_temporal,
            COUNT(*) as quantidade
        FROM consultas_ativas
        GROUP BY status_temporal
        ORDER BY
            CASE status_temporal
                WHEN 'Futura' THEN 1
                WHEN 'Passada (< 24h)' THEN 2
                WHEN 'Passada (< 7 dias)' THEN 3
                WHEN 'Passada (< 30 dias)' THEN 4
                WHEN 'Passada (< 90 dias)' THEN 5
                ELSE 6
            END
    `).all();

    statsDepois.forEach(stat => {
        console.log(`  ${stat.status_temporal.padEnd(30)} ${stat.quantidade} consultas`);
    });

    const totalDepois = db.prepare('SELECT COUNT(*) as total FROM consultas_ativas').get();
    const totalArquivadasDepois = db.prepare('SELECT COUNT(*) as total FROM consultas_arquivadas').get();
    console.log(`\n  TOTAL ATIVAS: ${totalDepois.total} (antes: ${totalAntes.total})`);
    console.log(`  TOTAL ARQUIVADAS: ${totalArquivadasDepois.total} (antes: ${totalArquivadasAntes.total})`);

    // ============================================================================
    // VACUUM (otimiza banco)
    // ============================================================================
    console.log('\n🔧 OTIMIZANDO BANCO DE DADOS (VACUUM)...');
    console.log('-'.repeat(80));
    db.exec('VACUUM');
    console.log('  ✅ Banco otimizado');

    // Fecha banco
    db.close();

    console.log('\n' + '='.repeat(80));
    console.log('✅ LIMPEZA CONCLUÍDA COM SUCESSO!');
    console.log('='.repeat(80));
    console.log('');

} catch (error) {
    console.error('\n❌ ERRO NA LIMPEZA:', error);
    console.error(error.stack);
    process.exit(1);
}
