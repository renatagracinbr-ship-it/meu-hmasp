/**
 * Testa a query corrigida de consultas desmarcadas
 */

const { Pool } = require('pg');

const DB_CONFIG = {
    host: '10.12.40.219',
    port: 5432,
    database: 'dbaghu',
    user: 'birm_read',
    password: 'birm@read',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
};

async function testarQuery() {
    const pool = new Pool(DB_CONFIG);
    const minutes = 120; // 2 horas para pegar a desmarcação da RENATA

    try {
        console.log('\n=== TESTANDO QUERY CORRIGIDA ===\n');
        console.log(`Buscando consultas desmarcadas nos últimos ${minutes} minutos...\n`);

        const query = `
            WITH desmarcadas AS (
                SELECT
                    jn1.numero,
                    jn1.pac_codigo,
                    jn1.grd_seq,
                    jn1.dt_consulta,
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
                    AND jn1.jn_date_time >= NOW() - INTERVAL '${minutes} minutes'
                    AND jn1.stc_situacao = 'L'
            )
            SELECT
                d.numero as consulta_numero,
                d.dt_consulta as data_hora_consulta,
                d.data_hora_marcacao_original as data_hora_marcacao,
                d.data_hora_desmarcacao,
                d.usuario_desmarcacao,
                d.pac_codigo,
                p.prontuario::text as prontuario,
                p.nome as nome_paciente,
                p.cpf::text as cpf_paciente,
                e.nome_especialidade as especialidade,
                'Não informado' as profissional_nome,
                u.descricao as local_descricao
            FROM desmarcadas d
            LEFT JOIN agh.aip_pacientes p ON p.codigo = d.pac_codigo
            LEFT JOIN agh.aac_grade_agendamen_consultas g ON g.seq = d.grd_seq
            LEFT JOIN agh.agh_especialidades e ON e.seq = g.esp_seq
            LEFT JOIN agh.agh_unidades_funcionais u ON u.seq = g.usl_unf_seq
            WHERE d.pac_codigo IS NOT NULL
                AND d.data_hora_marcacao_original IS NOT NULL
            ORDER BY d.data_hora_desmarcacao DESC
            LIMIT 100;
        `;

        const result = await pool.query(query);

        console.log(`✅ Encontradas ${result.rows.length} consultas desmarcadas\n`);

        if (result.rows.length > 0) {
            console.log('CONSULTAS DESMARCADAS:\n');
            result.rows.forEach((row, i) => {
                console.log(`${i + 1}. ${row.nome_paciente}`);
                console.log(`   Prontuário: ${row.prontuario}`);
                console.log(`   Consulta: ${row.consulta_numero}`);
                console.log(`   Especialidade: ${row.especialidade || 'N/A'}`);
                console.log(`   Data Consulta: ${row.data_hora_consulta}`);
                console.log(`   📅 Marcada em: ${row.data_hora_marcacao}`);
                console.log(`   ❌ Desmarcada em: ${row.data_hora_desmarcacao}`);
                console.log(`   Por: ${row.usuario_desmarcacao}`);
                console.log('');
            });

            // Verificar se encontrou a RENATA
            const renata = result.rows.find(row =>
                row.nome_paciente && row.nome_paciente.toUpperCase().includes('RENATA')
            );

            if (renata) {
                console.log('\n🎯 CONSULTA DA RENATA ENCONTRADA:');
                console.log(`   Consulta: ${renata.consulta_numero}`);
                console.log(`   Especialidade: ${renata.especialidade}`);
                console.log(`   Desmarcada em: ${renata.data_hora_desmarcacao}`);
                console.log(`   Por: ${renata.usuario_desmarcacao}`);
            } else {
                console.log('\n⚠️ Consulta da RENATA não encontrada nos resultados');
            }
        }

    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        console.error(error);
    } finally {
        await pool.end();
        console.log('\n=== FIM DO TESTE ===\n');
    }
}

testarQuery();
