const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function testTabelaPrincipal() {
    try {
        const client = await pool.connect();

        console.log('\n=== TABELA PRINCIPAL - CONSULTA 515148 ===\n');

        const result = await client.query(`
            SELECT
                numero,
                stc_situacao,
                pac_codigo,
                dthr_marcacao,
                alterado_em,
                criado_em,
                NOW() as agora,
                NOW() - alterado_em as tempo_desde_alteracao
            FROM agh.aac_consultas
            WHERE numero = 515148;
        `);

        if (result.rows.length > 0) {
            const row = result.rows[0];
            console.log('Número:', row.numero);
            console.log('Situação:', row.stc_situacao, row.stc_situacao === 'M' ? '(MARCADA)' : row.stc_situacao === 'L' ? '(LIVRE)' : '');
            console.log('Pac Código:', row.pac_codigo);
            console.log('Data/Hora Marcação:', row.dthr_marcacao);
            console.log('Alterado em:', row.alterado_em);
            console.log('Criado em:', row.criado_em);
            console.log('Agora:', row.agora);
            console.log('Tempo desde alteração:', row.tempo_desde_alteracao);
        }

        client.release();
        await pool.end();
    } catch (err) {
        console.error('Erro:', err);
        await pool.end();
    }
}

testTabelaPrincipal();
