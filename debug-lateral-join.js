const { Pool } = require('pg');

const pool = new Pool({
    host: '10.12.40.219',
    port: 5432,
    database: 'dbaghu',
    user: 'birm_read',
    password: 'birm@read',
    connectionTimeoutMillis: 5000,
});

async function testLateralJoin() {
    try {
        console.log('\n=== TESTE 1: M→L sem filtros ===');
        const test1 = await pool.query(`
            SELECT
                jn1.numero,
                jn1.pac_codigo,
                jn1.jn_date_time as data_desmarcacao,
                jn1.stc_situacao as situacao_atual
            FROM agh.aac_consultas_jn jn1
            WHERE jn1.jn_operation = 'UPD'
                AND jn1.jn_date_time >= NOW() - INTERVAL '120 minutes'
                AND jn1.stc_situacao = 'L'
            LIMIT 5
        `);
        console.log(`Encontradas ${test1.rows.length} desmarcações:`);
        test1.rows.forEach(row => {
            console.log(`  - Consulta ${row.numero}, Paciente ${row.pac_codigo}, Data: ${row.data_desmarcacao}`);
        });

        console.log('\n=== TESTE 2: Com LATERAL JOIN (sem filtro IS NOT NULL) ===');
        const test2 = await pool.query(`
            SELECT
                jn1.numero,
                jn1.pac_codigo,
                jn1.jn_date_time as data_desmarcacao,
                jn2.jn_date_time as data_marcacao_anterior
            FROM agh.aac_consultas_jn jn1
            LEFT JOIN LATERAL (
                SELECT jn2.jn_date_time
                FROM agh.aac_consultas_jn jn2
                WHERE jn2.numero = jn1.numero
                    AND jn2.jn_date_time < jn1.jn_date_time
                    AND jn2.stc_situacao = 'M'
                    AND jn2.jn_operation != 'DEL'
                ORDER BY jn2.jn_date_time DESC
                LIMIT 1
            ) jn2 ON true
            WHERE jn1.jn_operation = 'UPD'
                AND jn1.jn_date_time >= NOW() - INTERVAL '120 minutes'
                AND jn1.stc_situacao = 'L'
            LIMIT 10
        `);
        console.log(`Encontradas ${test2.rows.length} desmarcações com LATERAL JOIN:`);
        test2.rows.forEach(row => {
            const marcacaoAnterior = row.data_marcacao_anterior || 'NULL';
            console.log(`  - Consulta ${row.numero}, Paciente ${row.pac_codigo}`);
            console.log(`    Desmarcação: ${row.data_desmarcacao}`);
            console.log(`    Marcação anterior: ${marcacaoAnterior}`);
        });

        console.log('\n=== TESTE 3: Contando NULLs no LATERAL JOIN ===');
        const test3 = await pool.query(`
            SELECT
                COUNT(*) as total,
                COUNT(jn2.jn_date_time) as com_marcacao_anterior,
                COUNT(*) - COUNT(jn2.jn_date_time) as sem_marcacao_anterior
            FROM agh.aac_consultas_jn jn1
            LEFT JOIN LATERAL (
                SELECT jn2.jn_date_time
                FROM agh.aac_consultas_jn jn2
                WHERE jn2.numero = jn1.numero
                    AND jn2.jn_date_time < jn1.jn_date_time
                    AND jn2.stc_situacao = 'M'
                    AND jn2.jn_operation != 'DEL'
                ORDER BY jn2.jn_date_time DESC
                LIMIT 1
            ) jn2 ON true
            WHERE jn1.jn_operation = 'UPD'
                AND jn1.jn_date_time >= NOW() - INTERVAL '120 minutes'
                AND jn1.stc_situacao = 'L'
        `);
        console.log('Estatísticas:');
        console.log(`  Total de desmarcações: ${test3.rows[0].total}`);
        console.log(`  Com marcação anterior: ${test3.rows[0].com_marcacao_anterior}`);
        console.log(`  Sem marcação anterior: ${test3.rows[0].sem_marcacao_anterior}`);

        console.log('\n=== TESTE 4: Consulta 523560 específica (RENATA) ===');
        const test4 = await pool.query(`
            SELECT
                jn1.numero,
                jn1.pac_codigo,
                jn1.jn_date_time as data_desmarcacao,
                jn1.stc_situacao,
                jn2.jn_date_time as data_marcacao_anterior
            FROM agh.aac_consultas_jn jn1
            LEFT JOIN LATERAL (
                SELECT jn2.jn_date_time
                FROM agh.aac_consultas_jn jn2
                WHERE jn2.numero = jn1.numero
                    AND jn2.jn_date_time < jn1.jn_date_time
                    AND jn2.stc_situacao = 'M'
                    AND jn2.jn_operation != 'DEL'
                ORDER BY jn2.jn_date_time DESC
                LIMIT 1
            ) jn2 ON true
            WHERE jn1.numero = 523560
                AND jn1.jn_operation = 'UPD'
                AND jn1.stc_situacao = 'L'
            ORDER BY jn1.jn_date_time DESC
        `);
        console.log(`Encontradas ${test4.rows.length} desmarcações da consulta 523560:`);
        test4.rows.forEach(row => {
            const marcacaoAnterior = row.data_marcacao_anterior || 'NULL';
            console.log(`  - Desmarcação: ${row.data_desmarcacao}, Marcação anterior: ${marcacaoAnterior}`);
        });

    } catch (error) {
        console.error('Erro:', error);
    } finally {
        await pool.end();
    }
}

testLateralJoin();
