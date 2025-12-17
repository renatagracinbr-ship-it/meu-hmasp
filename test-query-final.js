const { Pool } = require('pg');

const pool = new Pool({
    host: '10.12.40.219',
    port: 5432,
    database: 'dbaghu',
    user: 'birm_read',
    password: 'birm@read',
    connectionTimeoutMillis: 5000,
});

async function testFinalQuery() {
    try {
        console.log('\n=== QUERY FINAL CORRIGIDA ===\n');

        const query = `
            WITH desmarcadas AS (
                SELECT DISTINCT ON (jn1.numero)
                    jn1.numero,
                    jn1.grd_seq,
                    jn1.dt_consulta,
                    jn1.jn_date_time as data_hora_desmarcacao,
                    jn1.jn_user as usuario_desmarcacao,
                    (
                        SELECT jn2.jn_date_time
                        FROM agh.aac_consultas_jn jn2
                        WHERE jn2.numero = jn1.numero
                            AND jn2.jn_date_time < jn1.jn_date_time
                            AND jn2.stc_situacao = 'M'
                            AND jn2.jn_operation != 'DEL'
                        ORDER BY jn2.jn_date_time DESC
                        LIMIT 1
                    ) as data_hora_marcacao_original
                FROM agh.aac_consultas_jn jn1
                WHERE jn1.jn_operation = 'UPD'
                    AND jn1.jn_date_time >= NOW() - INTERVAL '120 minutes'
                    AND jn1.stc_situacao = 'L'
                ORDER BY jn1.numero, jn1.jn_date_time DESC
            )
            SELECT
                d.numero,
                d.grd_seq,
                d.dt_consulta,
                d.data_hora_desmarcacao,
                d.data_hora_marcacao_original,
                d.usuario_desmarcacao,
                c.pac_codigo,
                p.nome as nome_paciente,
                p.prontuario,
                c.stc_situacao as situacao_atual,
                e.nome_especialidade
            FROM desmarcadas d
            INNER JOIN agh.aac_consultas c ON c.numero = d.numero
            LEFT JOIN agh.aip_pacientes p ON p.codigo = c.pac_codigo
            LEFT JOIN agh.aac_grade_agendamen_consultas g ON g.seq = d.grd_seq
            LEFT JOIN agh.agh_especialidades e ON e.seq = g.esp_seq
            WHERE c.pac_codigo IS NOT NULL
            ORDER BY d.data_hora_desmarcacao DESC
        `;

        const result = await pool.query(query);

        console.log(`✅ Encontradas ${result.rows.length} consultas desmarcadas\n`);

        result.rows.forEach((row, index) => {
            console.log(`${index + 1}. Consulta ${row.numero}`);
            console.log(`   Paciente: ${row.nome_paciente} (Código: ${row.pac_codigo}, Pront: ${row.prontuario})`);
            console.log(`   Especialidade: ${row.nome_especialidade || 'N/A'}`);
            console.log(`   Data da consulta: ${row.dt_consulta}`);
            console.log(`   Desmarcada em: ${row.data_hora_desmarcacao}`);
            console.log(`   Marcada originalmente em: ${row.data_hora_marcacao_original || 'N/A (consulta gerada como LIVRE)'}`);
            console.log(`   Situação atual: ${row.situacao_atual}`);
            console.log(`   Usuário: ${row.usuario_desmarcacao}\n`);
        });

        // Teste específico: RENATA
        console.log('=== BUSCA ESPECÍFICA: RENATA (Consulta 523560) ===\n');
        const renata = result.rows.find(r => r.numero === 523560);
        if (renata) {
            console.log('✅ ENCONTRADA!');
            console.log(`   Paciente: ${renata.nome_paciente}`);
            console.log(`   Prontuário: ${renata.prontuario}`);
            console.log(`   Especialidade: ${renata.nome_especialidade}`);
            console.log(`   Desmarcada em: ${renata.data_hora_desmarcacao}`);
        } else {
            console.log('❌ NÃO ENCONTRADA na lista');
        }

    } catch (error) {
        console.error('❌ Erro:', error.message);
        console.error(error);
    } finally {
        await pool.end();
    }
}

testFinalQuery();
