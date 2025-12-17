const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function testDesmarcacao() {
    try {
        const client = await pool.connect();

        console.log('\n=== VERIFICANDO DESMARCAÇÃO DA CONSULTA 515148 ===\n');

        // 1. Status atual
        console.log('1. STATUS ATUAL:');
        const atual = await client.query(`
            SELECT
                numero,
                stc_situacao,
                pac_codigo,
                dthr_marcacao,
                alterado_em,
                criado_em
            FROM agh.aac_consultas
            WHERE numero = 515148;
        `);
        console.log(JSON.stringify(atual.rows[0], null, 2));

        // 2. Histórico no journal (últimas 2 horas)
        console.log('\n2. JOURNAL (últimas 2 horas):');
        const journal = await client.query(`
            SELECT
                jn_date_time,
                jn_operation,
                stc_situacao,
                pac_codigo,
                NOW() - jn_date_time as tempo_desde
            FROM agh.aac_consultas_jn
            WHERE numero = 515148
                AND jn_date_time >= NOW() - INTERVAL '2 hours'
            ORDER BY jn_date_time DESC;
        `);

        console.log(`Total de registros: ${journal.rows.length}`);
        journal.rows.forEach((row, i) => {
            console.log(`\n[${i + 1}] ${row.jn_date_time}`);
            console.log(`    Operação: ${row.jn_operation}`);
            console.log(`    Situação: ${row.stc_situacao}`);
            console.log(`    Pac Código: ${row.pac_codigo}`);
            console.log(`    Tempo desde: ${row.tempo_desde}`);
        });

        // 3. Testar query atual de desmarcação (baseada no journal)
        console.log('\n3. QUERY ATUAL DE DESMARCAÇÃO (baseada no journal):');
        const queryAtual = await client.query(`
            WITH desmarcadas AS (
                SELECT DISTINCT ON (jn1.numero)
                    jn1.numero,
                    jn1.jn_date_time as data_desmarcacao
                FROM agh.aac_consultas_jn jn1
                WHERE jn1.jn_operation = 'UPD'
                    AND jn1.jn_date_time >= NOW() - INTERVAL '60 minutes'
                    AND jn1.stc_situacao IN ('L', 'G')
                    AND jn1.numero = 515148
                    AND EXISTS (
                        SELECT 1
                        FROM agh.aac_consultas_jn jn_prev
                        WHERE jn_prev.numero = jn1.numero
                            AND jn_prev.jn_date_time < jn1.jn_date_time
                            AND jn_prev.stc_situacao = 'M'
                            AND jn_prev.jn_operation != 'DEL'
                    )
                ORDER BY jn1.numero, jn1.jn_date_time DESC
            )
            SELECT * FROM desmarcadas;
        `);

        if (queryAtual.rows.length > 0) {
            console.log('✅ ENCONTROU com query do journal');
            console.log(JSON.stringify(queryAtual.rows[0], null, 2));
        } else {
            console.log('❌ NÃO ENCONTROU com query do journal');
        }

        client.release();
        await pool.end();
    } catch (err) {
        console.error('Erro:', err);
        await pool.end();
    }
}

testDesmarcacao();
