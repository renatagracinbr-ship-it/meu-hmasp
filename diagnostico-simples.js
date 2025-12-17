/**
 * Script simplificado para encontrar consultas desmarcadas
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

async function buscarDesmarcadas() {
    const pool = new Pool(DB_CONFIG);

    try {
        console.log('\n=== BUSCANDO CONSULTAS DESMARCADAS ===\n');

        // 1. Buscar consulta da RENATA especificamente
        console.log('1. Consultando paciente RENATA...\n');
        const queryRenata = `
            SELECT
                c.numero,
                c.dt_consulta,
                c.dthr_marcacao,
                c.stc_situacao,
                sit.descricao as situacao_desc,
                e.nome_especialidade,
                p.nome as paciente
            FROM agh.aac_consultas c
            LEFT JOIN agh.aip_pacientes p ON p.codigo = c.pac_codigo
            LEFT JOIN agh.aac_situacao_consultas sit ON sit.situacao = c.stc_situacao
            LEFT JOIN agh.aac_grade_agendamen_consultas g ON g.seq = c.grd_seq
            LEFT JOIN agh.agh_especialidades e ON e.seq = g.esp_seq
            WHERE c.pac_codigo = 7567
            ORDER BY c.dthr_marcacao DESC
            LIMIT 10;
        `;

        const resultRenata = await pool.query(queryRenata);
        console.log(`Consultas da RENATA: ${resultRenata.rows.length}\n`);

        resultRenata.rows.forEach((row, i) => {
            const emoji = row.stc_situacao === 'D' ? '❌' : row.stc_situacao === 'M' ? '✅' : '⚪';
            console.log(`${emoji} ${i + 1}. ${row.nome_especialidade}`);
            console.log(`   Número: ${row.numero}`);
            console.log(`   Situação: ${row.stc_situacao} - ${row.situacao_desc}`);
            console.log(`   Data Consulta: ${row.dt_consulta}`);
            console.log(`   Data Marcação: ${row.dthr_marcacao}`);
            console.log('');
        });

        // 2. Buscar TODAS as consultas desmarcadas (situação = 'D')
        console.log('\n2. Todas as consultas com situação "D" (últimas 50)...\n');
        const queryTodasDesmarcadas = `
            SELECT
                c.numero,
                c.dt_consulta,
                c.dthr_marcacao,
                c.stc_situacao,
                sit.descricao as situacao_desc,
                p.nome as paciente,
                e.nome_especialidade
            FROM agh.aac_consultas c
            LEFT JOIN agh.aip_pacientes p ON p.codigo = c.pac_codigo
            LEFT JOIN agh.aac_situacao_consultas sit ON sit.situacao = c.stc_situacao
            LEFT JOIN agh.aac_grade_agendamen_consultas g ON g.seq = c.grd_seq
            LEFT JOIN agh.agh_especialidades e ON e.seq = g.esp_seq
            WHERE c.stc_situacao = 'D'
                AND c.pac_codigo IS NOT NULL
            ORDER BY c.dthr_marcacao DESC
            LIMIT 50;
        `;

        const resultTodas = await pool.query(queryTodasDesmarcadas);
        console.log(`Total de consultas desmarcadas: ${resultTodas.rows.length}\n`);

        console.log('Últimas 20 consultas desmarcadas:');
        resultTodas.rows.slice(0, 20).forEach((row, i) => {
            console.log(`${i + 1}. ${row.paciente} - ${row.nome_especialidade}`);
            console.log(`   Data marcação: ${row.dthr_marcacao}`);
        });

        // 3. Verificar se há campos de auditoria
        console.log('\n\n3. Verificando campos de auditoria...\n');
        const queryCamposAuditoria = `
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'agh'
                AND table_name = 'aac_consultas'
                AND (
                    column_name LIKE '%criado%'
                    OR column_name LIKE '%alterado%'
                    OR column_name LIKE '%modificado%'
                    OR column_name LIKE '%usuario%'
                    OR column_name LIKE '%criad%'
                    OR column_name LIKE '%modif%'
                )
            ORDER BY column_name;
        `;

        const resultAuditoria = await pool.query(queryCamposAuditoria);
        if (resultAuditoria.rows.length > 0) {
            console.log('Campos de auditoria encontrados:');
            resultAuditoria.rows.forEach(row => {
                console.log(`  - ${row.column_name} (${row.data_type})`);
            });
        } else {
            console.log('❌ Nenhum campo de auditoria encontrado');
        }

        // 4. Listar TODAS as situações possíveis
        console.log('\n\n4. Situações de consulta disponíveis no sistema:\n');
        const querySituacoes = `
            SELECT
                situacao,
                descricao,
                (SELECT COUNT(*) FROM agh.aac_consultas WHERE stc_situacao = sit.situacao) as total
            FROM agh.aac_situacao_consultas sit
            ORDER BY total DESC;
        `;

        const resultSituacoes = await pool.query(querySituacoes);
        console.log('Códigos de situação:');
        resultSituacoes.rows.forEach(row => {
            console.log(`  ${row.situacao} - ${row.descricao} (${row.total} consultas)`);
        });

    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
        console.error(error);
    } finally {
        await pool.end();
        console.log('\n=== FIM DA BUSCA ===\n');
    }
}

buscarDesmarcadas();
