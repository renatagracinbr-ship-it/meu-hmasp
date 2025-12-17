const { Pool } = require('pg');

const DB_CONFIG = {
    host: '10.12.40.219',
    port: 5432,
    database: 'dbaghu',
    user: 'birm_read',
    password: 'birm@read'
};

async function debug() {
    const pool = new Pool(DB_CONFIG);

    try {
        // Testar a query WITH desmarcadas
        console.log('\n3. Testando query WITH completa:\n');
        const q3 = `
            WITH desmarcadas AS (
                SELECT
                    jn1.numero,
                    jn1.pac_codigo,
                    jn1.jn_date_time as data_hora_desmarcacao,
                    jn1.jn_user as usuario_desmarcacao,
                    jn2.jn_date_time as data_hora_marcacao_original
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
            )
            SELECT
                d.numero,
                d.pac_codigo,
                d.data_hora_desmarcacao,
                d.data_hora_marcacao_original,
                p.nome
            FROM desmarcadas d
            LEFT JOIN agh.aip_pacientes p ON p.codigo = d.pac_codigo
            WHERE d.pac_codigo IS NOT NULL
            ORDER BY d.data_hora_desmarcacao DESC
            LIMIT 20;
        `;
        const r3 = await pool.query(q3);
        console.log(`Total: ${r3.rows.length}\n`);
        r3.rows.forEach((row, i) => {
            console.log(`${i+1}. Consulta ${row.numero} | ${row.nome || 'N/A'}`);
            console.log(`   Desmarcada: ${row.data_hora_desmarcacao}`);
            console.log(`   Marcação orig: ${row.data_hora_marcacao_original || 'NULL'}`);
            console.log('');
        });

    } catch (error) {
        console.error('\nERRO:', error.message);
        console.error(error);
    } finally {
        await pool.end();
    }
}

debug();
