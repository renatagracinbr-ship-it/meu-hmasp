const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function testQuery() {
    try {
        const client = await pool.connect();

        // Query simplificada que está no código
        const query = `
            SELECT
                c.numero as consulta_numero,
                c.dt_consulta as data_hora_consulta,
                c.alteradoem as data_hora_marcacao,
                c.pac_codigo,
                c.stc_situacao,
                NOW() - c.alteradoem as tempo_desde_atualizacao,
                p.nome as nome_paciente
            FROM agh.aac_consultas c
            LEFT JOIN agh.aip_pacientes p ON p.codigo = c.pac_codigo
            WHERE c.numero = 515148;
        `;

        const result = await client.query(query);

        console.log('\n=== CONSULTA 515148 ===');
        console.log(JSON.stringify(result.rows[0], null, 2));

        // Testar se entra no filtro
        const query2 = `
            SELECT
                c.numero as consulta_numero,
                c.stc_situacao,
                c.pac_codigo,
                c.alteradoem,
                NOW() - c.alteradoem as tempo_desde_atualizacao
            FROM agh.aac_consultas c
            WHERE c.stc_situacao = 'M'
                AND c.pac_codigo IS NOT NULL
                AND c.alteradoem >= NOW() - INTERVAL '60 minutes'
                AND c.numero = 515148;
        `;

        const result2 = await client.query(query2);

        console.log('\n=== ENTRA NO FILTRO DE 60 MINUTOS? ===');
        if (result2.rows.length > 0) {
            console.log('✅ SIM - Consulta deveria aparecer!');
            console.log(JSON.stringify(result2.rows[0], null, 2));
        } else {
            console.log('❌ NÃO - Consulta NÃO passa no filtro');
            console.log('Motivos possíveis:');
            console.log('- stc_situacao != M');
            console.log('- pac_codigo IS NULL');
            console.log('- alteradoem > 60 minutos atrás');
        }

        client.release();
        await pool.end();
    } catch (err) {
        console.error('Erro:', err);
        await pool.end();
    }
}

testQuery();
