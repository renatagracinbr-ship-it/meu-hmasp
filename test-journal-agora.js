const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function testJournal() {
    try {
        const client = await pool.connect();

        console.log('\n=== JOURNAL COMPLETO DA CONSULTA 515148 (últimos 60 minutos) ===\n');

        const journal = await client.query(`
            SELECT
                jn_date_time,
                jn_operation,
                stc_situacao,
                pac_codigo
            FROM agh.aac_consultas_jn
            WHERE numero = 515148
                AND jn_date_time >= NOW() - INTERVAL '60 minutes'
            ORDER BY jn_date_time DESC;
        `);

        console.log(`Total de registros: ${journal.rows.length}\n`);

        journal.rows.forEach((row, i) => {
            console.log(`[${i + 1}] ${row.jn_date_time.toLocaleString('pt-BR')}`);
            console.log(`    Operação: ${row.jn_operation}`);
            console.log(`    Situação: ${row.stc_situacao} ${row.stc_situacao === 'M' ? '(MARCADA)' : row.stc_situacao === 'L' ? '(LIVRE)' : ''}`);
            console.log(`    Pac Código: ${row.pac_codigo}`);
            console.log('');
        });

        client.release();
        await pool.end();
    } catch (err) {
        console.error('Erro:', err);
        await pool.end();
    }
}

testJournal();
