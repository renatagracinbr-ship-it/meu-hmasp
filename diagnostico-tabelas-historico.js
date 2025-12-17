/**
 * Script para investigar tabelas de histórico/auditoria de consultas
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

async function investigarHistorico() {
    const pool = new Pool(DB_CONFIG);

    try {
        console.log('\n=== INVESTIGANDO HISTÓRICO DE CONSULTAS ===\n');

        // 1. Listar TODAS as tabelas relacionadas a consultas
        console.log('1. Tabelas relacionadas a consultas:\n');
        const queryTabelas = `
            SELECT
                table_schema,
                table_name
            FROM information_schema.tables
            WHERE table_schema = 'agh'
                AND (
                    table_name LIKE '%aac%'
                    OR table_name LIKE '%consulta%'
                )
            ORDER BY table_name;
        `;

        const resultTabelas = await pool.query(queryTabelas);
        console.log(`Total de tabelas: ${resultTabelas.rows.length}\n`);
        resultTabelas.rows.forEach(row => {
            console.log(`  - ${row.table_schema}.${row.table_name}`);
        });

        // 2. Procurar especificamente por tabelas de histórico/jornal
        console.log('\n\n2. Tabelas de histórico/jornal:\n');
        const queryHistorico = `
            SELECT
                table_schema,
                table_name
            FROM information_schema.tables
            WHERE table_schema = 'agh'
                AND (
                    table_name LIKE '%jn%'
                    OR table_name LIKE '%journal%'
                    OR table_name LIKE '%hist%'
                    OR table_name LIKE '%log%'
                    OR table_name LIKE '%audit%'
                )
            ORDER BY table_name;
        `;

        const resultHistorico = await pool.query(queryHistorico);
        if (resultHistorico.rows.length > 0) {
            console.log('Tabelas encontradas:');
            resultHistorico.rows.forEach(row => {
                console.log(`  - ${row.table_schema}.${row.table_name}`);
            });
        } else {
            console.log('❌ Nenhuma tabela de histórico encontrada');
        }

        // 3. Verificar se existe tabela específica aac_consultas_jn
        console.log('\n\n3. Verificando tabela aac_consultas_jn...\n');
        const queryConsultasJN = `
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'agh'
                AND table_name = 'aac_consultas_jn'
            ORDER BY ordinal_position
            LIMIT 20;
        `;

        try {
            const resultJN = await pool.query(queryConsultasJN);
            if (resultJN.rows.length > 0) {
                console.log('✓ Tabela aac_consultas_jn existe!');
                console.log('\nPrimeiros 20 campos:');
                resultJN.rows.forEach(row => {
                    console.log(`  - ${row.column_name} (${row.data_type})`);
                });

                // Buscar mudanças de situação da RENATA na tabela de histórico
                console.log('\n\n4. Buscando mudanças de situação da RENATA no histórico...\n');
                const queryRenatHistorico = `
                    SELECT
                        numero,
                        stc_situacao,
                        dthr_marcacao,
                        jn_operation,
                        jn_datetime,
                        jn_user
                    FROM agh.aac_consultas_jn
                    WHERE pac_codigo = 7567
                    ORDER BY jn_datetime DESC
                    LIMIT 30;
                `;

                const resultRenatHist = await pool.query(queryRenatHistorico);
                console.log(`Registros de histórico: ${resultRenatHist.rows.length}\n`);

                resultRenatHist.rows.forEach((row, i) => {
                    const operacao = row.jn_operation === 'INS' ? '➕ INSERT'
                        : row.jn_operation === 'UPD' ? '✏️ UPDATE'
                        : row.jn_operation === 'DEL' ? '❌ DELETE'
                        : row.jn_operation;

                    console.log(`${i + 1}. ${operacao} - Consulta ${row.numero}`);
                    console.log(`   Situação: ${row.stc_situacao}`);
                    console.log(`   Data operação: ${row.jn_datetime}`);
                    console.log(`   Usuário: ${row.jn_user}`);
                    console.log('');
                });

            } else {
                console.log('❌ Tabela aac_consultas_jn não existe ou está vazia');
            }
        } catch (error) {
            console.log('❌ Erro ao acessar aac_consultas_jn:', error.message);
        }

        // 5. Buscar consultas que mudaram de M para L recentemente
        console.log('\n\n5. Buscando consultas que podem ter sido desmarcadas (situação L)...\n');
        const queryLivres = `
            SELECT
                c.numero,
                c.dt_consulta,
                c.dthr_marcacao,
                c.alterado_em,
                c.stc_situacao,
                sit.descricao,
                e.nome_especialidade
            FROM agh.aac_consultas c
            LEFT JOIN agh.aac_situacao_consultas sit ON sit.situacao = c.stc_situacao
            LEFT JOIN agh.aac_grade_agendamen_consultas g ON g.seq = c.grd_seq
            LEFT JOIN agh.agh_especialidades e ON e.seq = g.esp_seq
            WHERE c.stc_situacao = 'L'
                AND c.alterado_em >= NOW() - INTERVAL '1 hour'
            ORDER BY c.alterado_em DESC
            LIMIT 20;
        `;

        const resultLivres = await pool.query(queryLivres);
        console.log(`Consultas com situação L alteradas na última hora: ${resultLivres.rows.length}\n`);

        if (resultLivres.rows.length > 0) {
            resultLivres.rows.forEach((row, i) => {
                console.log(`${i + 1}. ${row.nome_especialidade || 'N/A'}`);
                console.log(`   Número: ${row.numero}`);
                console.log(`   Situação: ${row.stc_situacao} - ${row.descricao}`);
                console.log(`   Alterado em: ${row.alterado_em}`);
                console.log('');
            });
        }

    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        console.error(error);
    } finally {
        await pool.end();
        console.log('\n=== FIM DA INVESTIGAÇÃO ===\n');
    }
}

investigarHistorico();
