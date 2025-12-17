const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function testOrigemDuplicacao() {
    try {
        const client = await pool.connect();

        console.log('\n=== TESTE 1: QUERY SEM DISTINCT ON (como estava antes) ===\n');

        // Query ANTIGA (sem DISTINCT ON)
        const queryAntiga = `
            SELECT
                c.numero as consulta_numero,
                c.dt_consulta as data_hora_consulta,
                jn_marcacao.jn_date_time as data_hora_marcacao,
                c.alterado_em as data_hora_desmarcacao,
                jn_marcacao.pac_codigo as pac_codigo,
                c.stc_situacao as situacao_codigo,
                p.nome as nome_paciente
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
            WHERE c.stc_situacao IN ('L', 'G')
                AND c.pac_codigo IS NULL
                AND c.alterado_em >= NOW() - INTERVAL '60 minutes'
                AND jn_marcacao.jn_date_time IS NOT NULL
                AND c.numero IN (515148, 515980)  -- Apenas as consultas de teste
            ORDER BY c.alterado_em DESC;
        `;

        const resultAntiga = await client.query(queryAntiga);

        console.log(`Registros retornados SEM DISTINCT ON: ${resultAntiga.rows.length}\n`);

        resultAntiga.rows.forEach((row, i) => {
            console.log(`[${i + 1}] Consulta ${row.consulta_numero}`);
            console.log(`    Paciente: ${row.nome_paciente}`);
            console.log(`    Data Marcação: ${row.data_hora_marcacao}`);
            console.log(`    Data Desmarcação: ${row.data_hora_desmarcacao}`);
            console.log(`    Pac Código: ${row.pac_codigo}`);
            console.log('');
        });

        console.log('\n=== TESTE 2: QUERY COM DISTINCT ON (nova) ===\n');

        // Query NOVA (com DISTINCT ON)
        const queryNova = `
            SELECT DISTINCT ON (c.numero)
                c.numero as consulta_numero,
                c.dt_consulta as data_hora_consulta,
                jn_marcacao.jn_date_time as data_hora_marcacao,
                c.alterado_em as data_hora_desmarcacao,
                jn_marcacao.pac_codigo as pac_codigo,
                c.stc_situacao as situacao_codigo,
                p.nome as nome_paciente
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
            WHERE c.stc_situacao IN ('L', 'G')
                AND c.pac_codigo IS NULL
                AND c.alterado_em >= NOW() - INTERVAL '60 minutes'
                AND jn_marcacao.jn_date_time IS NOT NULL
                AND c.numero IN (515148, 515980)
            ORDER BY c.numero, c.alterado_em DESC;
        `;

        const resultNova = await client.query(queryNova);

        console.log(`Registros retornados COM DISTINCT ON: ${resultNova.rows.length}\n`);

        resultNova.rows.forEach((row, i) => {
            console.log(`[${i + 1}] Consulta ${row.consulta_numero}`);
            console.log(`    Paciente: ${row.nome_paciente}`);
            console.log(`    Data Marcação: ${row.data_hora_marcacao}`);
            console.log(`    Data Desmarcação: ${row.data_hora_desmarcacao}`);
            console.log(`    Pac Código: ${row.pac_codigo}`);
            console.log('');
        });

        console.log('\n=== TESTE 3: VERIFICAR TODOS OS JOINS PARA CONSULTA 515148 ===\n');

        // Verificar se há múltiplos registros em tabelas relacionadas
        const queryJoins = `
            SELECT
                'aac_grade_agendamen_consultas' as tabela,
                COUNT(*) as qtd_registros
            FROM agh.aac_consultas c
            LEFT JOIN agh.aac_grade_agendamen_consultas g ON g.seq = c.grd_seq
            WHERE c.numero = 515148

            UNION ALL

            SELECT
                'agh_especialidades' as tabela,
                COUNT(*) as qtd_registros
            FROM agh.aac_consultas c
            LEFT JOIN agh.aac_grade_agendamen_consultas g ON g.seq = c.grd_seq
            LEFT JOIN agh.agh_especialidades e ON e.seq = g.esp_seq
            WHERE c.numero = 515148

            UNION ALL

            SELECT
                'aip_pacientes (via journal)' as tabela,
                COUNT(*) as qtd_registros
            FROM agh.aac_consultas c
            INNER JOIN LATERAL (
                SELECT jn.pac_codigo
                FROM agh.aac_consultas_jn jn
                WHERE jn.numero = c.numero
                    AND jn.stc_situacao = 'M'
                    AND jn.jn_operation = 'UPD'
                    AND jn.pac_codigo IS NOT NULL
                ORDER BY jn.jn_date_time DESC
                LIMIT 1
            ) jn_marcacao ON true
            LEFT JOIN agh.aip_pacientes p ON p.codigo = jn_marcacao.pac_codigo
            WHERE c.numero = 515148;
        `;

        const resultJoins = await client.query(queryJoins);

        console.log('Quantidade de registros por JOIN:\n');
        resultJoins.rows.forEach(row => {
            console.log(`  ${row.tabela}: ${row.qtd_registros} registro(s)`);
        });

        client.release();
        await pool.end();
    } catch (err) {
        console.error('Erro:', err);
        await pool.end();
    }
}

testOrigemDuplicacao();
