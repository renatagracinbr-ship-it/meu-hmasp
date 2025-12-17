const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function testLateralJoin() {
    try {
        const client = await pool.connect();

        console.log('\n=== INVESTIGANDO LATERAL JOIN - CONSULTA 515148 ===\n');

        // Verificar TODOS os registros de marcação no journal
        console.log('1. TODOS os registros de MARCAÇÃO no journal:\n');

        const journalQuery = `
            SELECT
                jn_date_time,
                stc_situacao,
                pac_codigo,
                jn_operation,
                jn_user
            FROM agh.aac_consultas_jn
            WHERE numero = 515148
                AND stc_situacao = 'M'
                AND jn_operation = 'UPD'
            ORDER BY jn_date_time DESC;
        `;

        const journalResult = await client.query(journalQuery);
        console.log(`Total: ${journalResult.rows.length} registro(s)\n`);

        journalResult.rows.forEach((row, i) => {
            console.log(`[${i + 1}] ${row.jn_date_time}`);
            console.log(`    Situação: ${row.stc_situacao}`);
            console.log(`    Pac Código: ${row.pac_codigo}`);
            console.log(`    Operação: ${row.jn_operation}`);
            console.log(`    Usuário: ${row.jn_user}`);
            console.log('');
        });

        // Testar o LATERAL JOIN especificamente
        console.log('\n2. TESTANDO LATERAL JOIN (sem WHERE, para ver todos os resultados):\n');

        const lateralQuery = `
            SELECT
                c.numero as consulta_numero,
                c.stc_situacao as situacao_atual,
                c.alterado_em,
                jn_marcacao.jn_date_time as data_hora_marcacao,
                jn_marcacao.pac_codigo as pac_codigo_marcacao,
                jn_marcacao.jn_user as usuario_marcacao
            FROM agh.aac_consultas c
            INNER JOIN LATERAL (
                SELECT
                    jn.jn_date_time,
                    jn.pac_codigo,
                    jn.jn_user
                FROM agh.aac_consultas_jn jn
                WHERE jn.numero = c.numero
                    AND jn.stc_situacao = 'M'
                    AND jn.jn_operation = 'UPD'
                    AND jn.pac_codigo IS NOT NULL
                ORDER BY jn.jn_date_time DESC
                LIMIT 1
            ) jn_marcacao ON true
            WHERE c.numero = 515148;
        `;

        const lateralResult = await client.query(lateralQuery);
        console.log(`Registros retornados: ${lateralResult.rows.length}\n`);

        lateralResult.rows.forEach((row, i) => {
            console.log(`[${i + 1}]`);
            console.log(`    Consulta: ${row.consulta_numero}`);
            console.log(`    Situação Atual: ${row.situacao_atual}`);
            console.log(`    Alterado em: ${row.alterado_em}`);
            console.log(`    Data Marcação (journal): ${row.data_hora_marcacao}`);
            console.log(`    Pac Código (journal): ${row.pac_codigo_marcacao}`);
            console.log(`    Usuário (journal): ${row.usuario_marcacao}`);
            console.log('');
        });

        // Testar query COMPLETA com todos os JOINs
        console.log('\n3. QUERY COMPLETA COM TODOS OS JOINS:\n');

        const fullQuery = `
            SELECT
                c.numero as consulta_numero,
                c.alterado_em as data_hora_desmarcacao,
                jn_marcacao.jn_date_time as data_hora_marcacao,
                jn_marcacao.pac_codigo,
                p.nome as nome_paciente,
                g.seq as grade_seq,
                e.seq as especialidade_seq
            FROM agh.aac_consultas c
            INNER JOIN LATERAL (
                SELECT
                    jn.jn_date_time,
                    jn.pac_codigo,
                    jn.jn_user
                FROM agh.aac_consultas_jn jn
                WHERE jn.numero = c.numero
                    AND jn.stc_situacao = 'M'
                    AND jn.jn_operation = 'UPD'
                    AND jn.pac_codigo IS NOT NULL
                ORDER BY jn.jn_date_time DESC
                LIMIT 1
            ) jn_marcacao ON true
            LEFT JOIN agh.aip_pacientes p ON p.codigo = jn_marcacao.pac_codigo
            LEFT JOIN agh.aac_grade_agendamen_consultas g ON g.seq = c.grd_seq
            LEFT JOIN agh.agh_especialidades e ON e.seq = g.esp_seq
            WHERE c.numero = 515148;
        `;

        const fullResult = await client.query(fullQuery);
        console.log(`Registros retornados: ${fullResult.rows.length}\n`);

        fullResult.rows.forEach((row, i) => {
            console.log(`[${i + 1}]`);
            console.log(`    Consulta: ${row.consulta_numero}`);
            console.log(`    Data Desmarcação: ${row.data_hora_desmarcacao}`);
            console.log(`    Data Marcação: ${row.data_hora_marcacao}`);
            console.log(`    Pac Código: ${row.pac_codigo}`);
            console.log(`    Paciente: ${row.nome_paciente}`);
            console.log(`    Grade: ${row.grade_seq}`);
            console.log(`    Especialidade: ${row.especialidade_seq}`);
            console.log('');
        });

        client.release();
        await pool.end();
    } catch (err) {
        console.error('Erro:', err);
        await pool.end();
    }
}

testLateralJoin();
