const { Pool } = require('pg');

const pool = new Pool({
    host: '10.12.40.219',
    port: 5432,
    database: 'dbaghu',
    user: 'birm_read',
    password: 'birm@read',
    connectionTimeoutMillis: 5000,
});

async function checkPacienteRemoval() {
    try {
        console.log('\n=== INVESTIGANDO: Por que pac_codigo é NULL? ===\n');

        console.log('1. Verificando o histórico do pac_codigo da consulta 523560:\n');

        const history = await pool.query(`
            SELECT
                jn_operation,
                stc_situacao,
                pac_codigo,
                jn_date_time,
                jn_user
            FROM agh.aac_consultas_jn
            WHERE numero = 523560
                AND jn_date_time >= NOW() - INTERVAL '24 hours'
            ORDER BY jn_date_time DESC
        `);

        history.rows.forEach((row, index) => {
            console.log(`${index + 1}. ${row.jn_operation} | Status: ${row.stc_situacao} | pac_codigo: ${row.pac_codigo || 'NULL'} | ${row.jn_date_time} | ${row.jn_user}`);
        });

        console.log('\n2. Comparando consultas LIVRE com e sem paciente:\n');

        const livreComPaciente = await pool.query(`
            SELECT COUNT(*) as total
            FROM agh.aac_consultas
            WHERE stc_situacao = 'L'
                AND pac_codigo IS NOT NULL
                AND dt_consulta >= NOW()
        `);

        const livreSemPaciente = await pool.query(`
            SELECT COUNT(*) as total
            FROM agh.aac_consultas
            WHERE stc_situacao = 'L'
                AND pac_codigo IS NULL
                AND dt_consulta >= NOW()
        `);

        console.log(`  Consultas LIVRE com paciente: ${livreComPaciente.rows[0].total}`);
        console.log(`  Consultas LIVRE sem paciente: ${livreSemPaciente.rows[0].total}`);

        console.log('\n3. Buscando desmarcações onde o pac_codigo foi preservado no journal:\n');

        const query = `
            WITH desmarcadas AS (
                SELECT DISTINCT ON (jn1.numero)
                    jn1.numero,
                    jn1.grd_seq,
                    jn1.dt_consulta,
                    jn1.pac_codigo as pac_codigo_journal,
                    jn1.jn_date_time as data_hora_desmarcacao,
                    jn1.jn_user as usuario_desmarcacao,
                    (
                        SELECT jn2.pac_codigo
                        FROM agh.aac_consultas_jn jn2
                        WHERE jn2.numero = jn1.numero
                            AND jn2.jn_date_time < jn1.jn_date_time
                            AND jn2.stc_situacao = 'M'
                            AND jn2.jn_operation != 'DEL'
                            AND jn2.pac_codigo IS NOT NULL
                        ORDER BY jn2.jn_date_time DESC
                        LIMIT 1
                    ) as pac_codigo_marcacao_anterior
                FROM agh.aac_consultas_jn jn1
                WHERE jn1.jn_operation = 'UPD'
                    AND jn1.jn_date_time >= NOW() - INTERVAL '120 minutes'
                    AND jn1.stc_situacao = 'L'
                ORDER BY jn1.numero, jn1.jn_date_time DESC
            )
            SELECT
                d.numero,
                d.pac_codigo_journal,
                d.pac_codigo_marcacao_anterior,
                c.pac_codigo as pac_codigo_atual,
                c.stc_situacao as situacao_atual,
                d.data_hora_desmarcacao,
                p.nome as nome_paciente,
                p.prontuario,
                e.nome_especialidade
            FROM desmarcadas d
            LEFT JOIN agh.aac_consultas c ON c.numero = d.numero
            LEFT JOIN agh.aip_pacientes p ON p.codigo = COALESCE(d.pac_codigo_marcacao_anterior, d.pac_codigo_journal, c.pac_codigo)
            LEFT JOIN agh.aac_grade_agendamen_consultas g ON g.seq = d.grd_seq
            LEFT JOIN agh.agh_especialidades e ON e.seq = g.esp_seq
            WHERE COALESCE(d.pac_codigo_marcacao_anterior, d.pac_codigo_journal, c.pac_codigo) IS NOT NULL
            ORDER BY d.data_hora_desmarcacao DESC
            LIMIT 10
        `;

        const result = await pool.query(query);

        console.log(`  Encontradas ${result.rows.length} desmarcações com informação de paciente:\n`);

        result.rows.forEach((row, index) => {
            console.log(`${index + 1}. Consulta ${row.numero}`);
            console.log(`   Paciente: ${row.nome_paciente} (Pront: ${row.prontuario})`);
            console.log(`   Especialidade: ${row.nome_especialidade}`);
            console.log(`   pac_codigo no journal: ${row.pac_codigo_journal || 'NULL'}`);
            console.log(`   pac_codigo na marcação anterior: ${row.pac_codigo_marcacao_anterior || 'NULL'}`);
            console.log(`   pac_codigo atual: ${row.pac_codigo_atual || 'NULL'}`);
            console.log(`   Situação atual: ${row.situacao_atual}`);
            console.log(`   Desmarcada em: ${row.data_hora_desmarcacao}\n`);
        });

        // Busca específica por RENATA
        console.log('=== BUSCA ESPECÍFICA: RENATA (Consulta 523560) ===\n');
        const renata = result.rows.find(r => r.numero === 523560);
        if (renata) {
            console.log('✅ ENCONTRADA!');
            console.log(`   Paciente: ${renata.nome_paciente}`);
            console.log(`   Prontuário: ${renata.prontuario}`);
            console.log(`   Especialidade: ${renata.nome_especialidade}`);
        } else {
            console.log('❌ NÃO ENCONTRADA - vamos buscar no histórico qual era o pac_codigo\n');

            const renataPacCodigo = await pool.query(`
                SELECT pac_codigo, jn_date_time, stc_situacao
                FROM agh.aac_consultas_jn
                WHERE numero = 523560
                    AND pac_codigo IS NOT NULL
                ORDER BY jn_date_time DESC
                LIMIT 1
            `);

            if (renataPacCodigo.rows.length > 0) {
                const pac = renataPacCodigo.rows[0];
                console.log(`   ✅ pac_codigo encontrado no histórico: ${pac.pac_codigo}`);
                console.log(`   Última vez visto: ${pac.jn_date_time} (status: ${pac.stc_situacao})`);

                const pacienteInfo = await pool.query(`
                    SELECT nome, prontuario
                    FROM agh.aip_pacientes
                    WHERE codigo = $1
                `, [pac.pac_codigo]);

                if (pacienteInfo.rows.length > 0) {
                    console.log(`   Nome: ${pacienteInfo.rows[0].nome}`);
                    console.log(`   Prontuário: ${pacienteInfo.rows[0].prontuario}`);
                }
            }
        }

    } catch (error) {
        console.error('Erro:', error.message);
        console.error(error);
    } finally {
        await pool.end();
    }
}

checkPacienteRemoval();
