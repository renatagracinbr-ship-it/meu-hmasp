const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function testDuplicacao() {
    try {
        const client = await pool.connect();

        console.log('\n=== TESTANDO DUPLICAÇÃO - CONSULTA 515148 ===\n');

        // Executar a query atual
        const query = `
            SELECT
                c.numero as consulta_numero,
                c.dt_consulta as data_hora_consulta,
                jn_marcacao.jn_date_time as data_hora_marcacao,
                c.alterado_em as data_hora_desmarcacao,
                jn_marcacao.pac_codigo as pac_codigo,
                c.stc_situacao as situacao_codigo
            FROM agh.aac_consultas c
            -- Buscar última MARCAÇÃO no journal
            INNER JOIN LATERAL (
                SELECT
                    jn.jn_date_time,
                    jn.pac_codigo,
                    jn.jn_user
                FROM agh.aac_consultas_jn jn
                WHERE jn.numero = c.numero
                    AND jn.stc_situacao = 'M'  -- Foi MARCADA
                    AND jn.jn_operation = 'UPD'
                    AND jn.pac_codigo IS NOT NULL
                ORDER BY jn.jn_date_time DESC
                LIMIT 1
            ) jn_marcacao ON true
            WHERE c.numero = 515148
                AND c.stc_situacao IN ('L', 'G')  -- Agora está LIVRE/GERADA
                AND c.pac_codigo IS NULL  -- Perdeu o paciente
                AND c.alterado_em >= NOW() - INTERVAL '60 minutes'  -- Desmarcada recentemente
                AND jn_marcacao.jn_date_time IS NOT NULL  -- Teve marcação no journal
            ORDER BY c.alterado_em DESC;
        `;

        const result = await client.query(query);

        console.log(`Registros encontrados: ${result.rows.length}\n`);

        result.rows.forEach((row, i) => {
            console.log(`[${i + 1}]`);
            console.log(`  Número: ${row.consulta_numero}`);
            console.log(`  Data Consulta: ${row.data_hora_consulta}`);
            console.log(`  Data Marcação: ${row.data_hora_marcacao}`);
            console.log(`  Data Desmarcação: ${row.data_hora_desmarcacao}`);
            console.log(`  Pac Código: ${row.pac_codigo}`);
            console.log(`  Situação: ${row.situacao_codigo}`);
            console.log('');
        });

        // Verificar quantos registros de marcação existem no journal
        console.log('\n=== REGISTROS DE MARCAÇÃO NO JOURNAL ===\n');

        const journalQuery = `
            SELECT
                jn_date_time,
                stc_situacao,
                pac_codigo,
                jn_operation
            FROM agh.aac_consultas_jn
            WHERE numero = 515148
                AND stc_situacao = 'M'
                AND jn_operation = 'UPD'
                AND pac_codigo IS NOT NULL
            ORDER BY jn_date_time DESC;
        `;

        const journalResult = await client.query(journalQuery);
        console.log(`Total de marcações no journal: ${journalResult.rows.length}\n`);

        journalResult.rows.forEach((row, i) => {
            console.log(`[${i + 1}] ${row.jn_date_time}`);
            console.log(`    Situação: ${row.stc_situacao}`);
            console.log(`    Pac Código: ${row.pac_codigo}`);
            console.log(`    Operação: ${row.jn_operation}`);
            console.log('');
        });

        client.release();
        await pool.end();
    } catch (err) {
        console.error('Erro:', err);
        await pool.end();
    }
}

testDuplicacao();
