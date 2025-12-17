const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function test() {
    try {
        const client = await pool.connect();

        console.log('\n=== EXECUTANDO QUERY COMPLETA DE DESMARCAÇÃO ===\n');

        // Query exata do código
        const query = `
            SELECT
                c.numero as consulta_numero,
                c.dt_consulta as data_hora_consulta,
                jn_marcacao.jn_date_time as data_hora_marcacao,
                c.alterado_em as data_hora_desmarcacao,
                jn_marcacao.pac_codigo as pac_codigo,
                c.stc_situacao as situacao_codigo,
                p.nome as nome_paciente
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
            LEFT JOIN agh.aip_pacientes p ON p.codigo = jn_marcacao.pac_codigo
            WHERE c.stc_situacao IN ('L', 'G')  -- Agora está LIVRE/GERADA
                AND c.pac_codigo IS NULL  -- Perdeu o paciente
                AND c.alterado_em >= NOW() - INTERVAL '60 minutes'  -- Desmarcada recentemente
                AND jn_marcacao.jn_date_time IS NOT NULL  -- Teve marcação no journal
            ORDER BY c.alterado_em DESC;
        `;

        const result = await client.query(query);

        console.log(`Total de desmarcações encontradas: ${result.rows.length}\n`);

        result.rows.forEach((row, i) => {
            console.log(`[${i + 1}] Consulta ${row.consulta_numero}`);
            console.log(`    Paciente: ${row.nome_paciente}`);
            console.log(`    Data Consulta: ${row.data_hora_consulta}`);
            console.log(`    Data Marcação: ${row.data_hora_marcacao}`);
            console.log(`    Data Desmarcação: ${row.data_hora_desmarcacao}`);
            console.log(`    Pac Código (marcação): ${row.pac_codigo}`);
            console.log(`    Situação Atual: ${row.situacao_codigo}`);
            console.log('');
        });

        client.release();
        await pool.end();
    } catch (err) {
        console.error('Erro:', err);
        await pool.end();
    }
}

test();
