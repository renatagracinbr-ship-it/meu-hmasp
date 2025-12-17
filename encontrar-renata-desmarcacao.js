/**
 * Script final para encontrar a desmarcação da RENATA
 */

const { Pool } = require('pg');

const DB_CONFIG = {
    host: '10.12.40.219',
    port: 5432,
    database: 'dbaghu',
    user: 'birm_read',
    password: 'birm@read',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
};

async function encontrarDesmarcacao() {
    const pool = new Pool(DB_CONFIG);

    try {
        console.log('\n=== BUSCANDO DESMARCAÇÃO DA RENATA ===\n');

        // Buscar histórico de mudanças da RENATA na tabela de journal
        console.log('Buscando histórico de mudanças...\n');
        const queryHistorico = `
            SELECT
                numero,
                stc_situacao,
                jn_operation,
                jn_date_time,
                jn_user
            FROM agh.aac_consultas_jn
            WHERE pac_codigo = 7567
                AND jn_date_time >= NOW() - INTERVAL '2 hours'
            ORDER BY jn_date_time DESC
            LIMIT 50;
        `;

        const resultHistorico = await pool.query(queryHistorico);
        console.log(`Mudanças nas últimas 2 horas: ${resultHistorico.rows.length}\n`);

        if (resultHistorico.rows.length > 0) {
            resultHistorico.rows.forEach((row, i) => {
                const operacao = row.jn_operation === 'INS' ? '➕ INSERT'
                    : row.jn_operation === 'UPD' ? '✏️  UPDATE'
                    : row.jn_operation === 'DEL' ? '❌ DELETE'
                    : row.jn_operation;

                console.log(`${i + 1}. ${operacao} - Consulta ${row.numero}`);
                console.log(`   Situação: ${row.stc_situacao}`);
                console.log(`   Data/Hora operação: ${row.jn_date_time}`);
                console.log(`   Usuário: ${row.jn_user}`);
                console.log('');
            });

        }

        // Buscar consultas deletadas ou modificadas
        console.log('\n\nBuscando consultas deletadas recentemente...\n');
        const queryDeletes = `
            SELECT
                jn.numero,
                jn.stc_situacao,
                jn.jn_date_time,
                jn.jn_user,
                p.nome as paciente
            FROM agh.aac_consultas_jn jn
            LEFT JOIN agh.aip_pacientes p ON p.codigo = jn.pac_codigo
            WHERE jn_operation = 'DEL'
                AND jn_date_time >= NOW() - INTERVAL '2 hours'
            ORDER BY jn_date_time DESC
            LIMIT 20;
        `;

        const resultDeletes = await pool.query(queryDeletes);
        console.log(`Consultas deletadas nas últimas 2 horas: ${resultDeletes.rows.length}\n`);

        if (resultDeletes.rows.length > 0) {
            resultDeletes.rows.forEach((row, i) => {
                console.log(`${i + 1}. ❌ ${row.paciente || 'N/A'}`);
                console.log(`   Consulta: ${row.numero}`);
                console.log(`   Deletada em: ${row.jn_date_time}`);
                console.log(`   Por: ${row.jn_user}`);
                console.log('');
            });
        }

        // Buscar consultas que mudaram de M para L
        console.log('\n\nBuscando mudanças M -> L (possíveis desmarcações)...\n');
        const queryMudancas = `
            SELECT
                jn1.numero,
                jn1.stc_situacao as situacao_depois,
                jn2.stc_situacao as situacao_antes,
                jn1.jn_date_time,
                jn1.jn_user,
                p.nome as paciente
            FROM agh.aac_consultas_jn jn1
            LEFT JOIN agh.aac_consultas_jn jn2 ON jn2.numero = jn1.numero
                AND jn2.jn_date_time < jn1.jn_date_time
                AND jn2.jn_operation != 'DEL'
            LEFT JOIN agh.aip_pacientes p ON p.codigo = jn1.pac_codigo
            WHERE jn1.jn_operation = 'UPD'
                AND jn1.jn_date_time >= NOW() - INTERVAL '2 hours'
                AND jn2.stc_situacao = 'M'
                AND jn1.stc_situacao = 'L'
            ORDER BY jn1.jn_date_time DESC
            LIMIT 20;
        `;

        const resultMudancas = await pool.query(queryMudancas);
        console.log(`Consultas que mudaram de M para L: ${resultMudancas.rows.length}\n`);

        if (resultMudancas.rows.length > 0) {
            resultMudancas.rows.forEach((row, i) => {
                console.log(`${i + 1}. 🔄 ${row.paciente || 'N/A'}`);
                console.log(`   Consulta: ${row.numero}`);
                console.log(`   Mudança: ${row.situacao_antes} → ${row.situacao_depois}`);
                console.log(`   Data: ${row.jn_date_time}`);
                console.log(`   Usuário: ${row.jn_user}`);
                console.log('');
            });
        }

    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        console.error(error);
    } finally {
        await pool.end();
        console.log('\n=== FIM DA BUSCA ===\n');
    }
}

encontrarDesmarcacao();
