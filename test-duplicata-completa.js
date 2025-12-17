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

        console.log('\n=== VERIFICANDO TODAS AS CONSULTAS SIMILARES ===\n');

        // Buscar TODAS as consultas para o paciente MARCELO RIBEIRO BARBOZA
        const queryPaciente = `
            SELECT
                c.numero,
                c.dt_consulta,
                c.stc_situacao,
                c.pac_codigo,
                c.alterado_em,
                c.grd_seq,
                p.nome
            FROM agh.aac_consultas c
            LEFT JOIN agh.aip_pacientes p ON p.codigo = c.pac_codigo OR p.codigo = (
                SELECT jn.pac_codigo
                FROM agh.aac_consultas_jn jn
                WHERE jn.numero = c.numero
                    AND jn.pac_codigo IS NOT NULL
                ORDER BY jn.jn_date_time DESC
                LIMIT 1
            )
            WHERE p.nome ILIKE '%MARCELO%RIBEIRO%BARBOZA%'
                OR c.numero = 515148
            ORDER BY c.numero DESC;
        `;

        const result = await client.query(queryPaciente);

        console.log(`Total de consultas encontradas: ${result.rows.length}\n`);

        result.rows.forEach((row, i) => {
            console.log(`[${i + 1}] Consulta ${row.numero}`);
            console.log(`    Data Consulta: ${row.dt_consulta}`);
            console.log(`    Situação: ${row.stc_situacao}`);
            console.log(`    Pac Código: ${row.pac_codigo}`);
            console.log(`    Alterado em: ${row.alterado_em}`);
            console.log(`    Grade: ${row.grd_seq}`);
            console.log(`    Paciente: ${row.nome}`);
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
