const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function investigateConsulta() {
    try {
        const client = await pool.connect();

        console.log('\n=== INVESTIGANDO CONSULTA 515148 - MARCELO RIBEIRO BARBOZA ===\n');

        // 1. Ver dados atuais na tabela principal
        console.log('1. DADOS ATUAIS (tabela principal):');
        const atual = await client.query(`
            SELECT
                c.numero,
                c.dt_consulta,
                c.stc_situacao,
                c.pac_codigo,
                c.grd_seq,
                p.nome as paciente_nome,
                p.prontuario
            FROM agh.aac_consultas c
            LEFT JOIN agh.aip_pacientes p ON p.codigo = c.pac_codigo
            WHERE c.numero = 515148;
        `);
        console.log(JSON.stringify(atual.rows[0], null, 2));

        // 2. Ver TODOS os registros no journal para essa consulta
        console.log('\n2. HISTÓRICO COMPLETO NO JOURNAL (últimas 24 horas):');
        const journal = await client.query(`
            SELECT
                jn_date_time,
                jn_operation,
                stc_situacao,
                pac_codigo,
                grd_seq,
                NOW() - jn_date_time as tempo_desde
            FROM agh.aac_consultas_jn
            WHERE numero = 515148
                AND jn_date_time >= NOW() - INTERVAL '24 hours'
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

        // 3. Testar se entra na query de marcação (últimos 60 minutos)
        console.log('\n3. TESTE: Entra na query de MARCAÇÃO (últimos 60 minutos)?');
        const testeMarcacao = await client.query(`
            WITH marcadas AS (
                SELECT DISTINCT ON (jn1.numero)
                    jn1.numero,
                    jn1.jn_date_time,
                    jn1.stc_situacao,
                    jn1.pac_codigo,
                    NOW() - jn1.jn_date_time as tempo_desde
                FROM agh.aac_consultas_jn jn1
                WHERE jn1.jn_operation = 'UPD'
                    AND jn1.jn_date_time >= NOW() - INTERVAL '60 minutes'
                    AND jn1.stc_situacao = 'M'
                    AND jn1.numero = 515148
                    AND EXISTS (
                        SELECT 1
                        FROM agh.aac_consultas_jn jn_prev
                        WHERE jn_prev.numero = jn1.numero
                            AND jn_prev.jn_date_time < jn1.jn_date_time
                            AND jn_prev.stc_situacao IN ('L', 'G')
                            AND jn_prev.jn_operation != 'DEL'
                    )
                ORDER BY jn1.numero, jn1.jn_date_time DESC
            )
            SELECT * FROM marcadas;
        `);

        if (testeMarcacao.rows.length > 0) {
            console.log('✅ SIM - Deveria aparecer!');
            console.log(JSON.stringify(testeMarcacao.rows[0], null, 2));
        } else {
            console.log('❌ NÃO - Não passa no filtro');

            // Investigar o porquê
            console.log('\n4. INVESTIGANDO MOTIVOS:');

            // Verificar se tem UPDATE nos últimos 60 min
            const temUpdate = await client.query(`
                SELECT COUNT(*) as qtd
                FROM agh.aac_consultas_jn
                WHERE numero = 515148
                    AND jn_operation = 'UPD'
                    AND jn_date_time >= NOW() - INTERVAL '60 minutes'
                    AND stc_situacao = 'M';
            `);
            console.log(`   - UPDATE com situação M nos últimos 60 min: ${temUpdate.rows[0].qtd}`);

            // Verificar se tem registro anterior com L ou G
            const temAnterior = await client.query(`
                SELECT
                    jn_date_time,
                    stc_situacao,
                    jn_operation
                FROM agh.aac_consultas_jn
                WHERE numero = 515148
                    AND stc_situacao IN ('L', 'G')
                    AND jn_operation != 'DEL'
                ORDER BY jn_date_time DESC
                LIMIT 1;
            `);
            console.log(`   - Registro anterior com L ou G:`);
            if (temAnterior.rows.length > 0) {
                console.log(JSON.stringify(temAnterior.rows[0], null, 2));
            } else {
                console.log('     NENHUM encontrado!');
            }
        }

        client.release();
        await pool.end();
    } catch (err) {
        console.error('Erro:', err);
        await pool.end();
    }
}

investigateConsulta();
