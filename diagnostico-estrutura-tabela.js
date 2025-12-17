/**
 * Script para investigar a estrutura da tabela de consultas
 * e descobrir como identificar consultas desmarcadas
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

async function investigarEstrutura() {
    const pool = new Pool(DB_CONFIG);

    try {
        console.log('\n=== INVESTIGANDO ESTRUTURA DA TABELA ===\n');

        // 1. Listar TODOS os campos da tabela aac_consultas
        console.log('1. Campos da tabela agh.aac_consultas:\n');
        const queryCampos = `
            SELECT
                column_name,
                data_type,
                character_maximum_length
            FROM information_schema.columns
            WHERE table_schema = 'agh'
                AND table_name = 'aac_consultas'
            ORDER BY ordinal_position;
        `;

        const resultCampos = await pool.query(queryCampos);
        console.log(`Total de campos: ${resultCampos.rows.length}\n`);

        // Procurar campos relacionados a data/hora
        console.log('Campos relacionados a DATA/HORA:');
        resultCampos.rows
            .filter(row => row.column_name.includes('dt') || row.column_name.includes('data'))
            .forEach(row => {
                console.log(`  - ${row.column_name} (${row.data_type})`);
            });

        console.log('\nCampos relacionados a MARCAÇÃO/DESMARCAÇÃO:');
        resultCampos.rows
            .filter(row =>
                row.column_name.includes('marca') ||
                row.column_name.includes('desmarca') ||
                row.column_name.includes('cancel') ||
                row.column_name.includes('alteracao') ||
                row.column_name.includes('modificacao')
            )
            .forEach(row => {
                console.log(`  - ${row.column_name} (${row.data_type})`);
            });

        console.log('\nCampos relacionados a SITUAÇÃO/STATUS:');
        resultCampos.rows
            .filter(row =>
                row.column_name.includes('stc') ||
                row.column_name.includes('situacao') ||
                row.column_name.includes('status')
            )
            .forEach(row => {
                console.log(`  - ${row.column_name} (${row.data_type})`);
            });

        // 2. Buscar a consulta específica da RENATA
        console.log('\n\n2. Buscando consultas da paciente RENATA...\n');
        const queryRenata = `
            SELECT
                c.numero,
                c.dt_consulta,
                c.dthr_marcacao,
                c.stc_situacao,
                sit.descricao as situacao_desc,
                e.nome_especialidade,
                c.criado_em,
                c.alterado_em,
                c.versao
            FROM agh.aac_consultas c
            LEFT JOIN agh.aac_situacao_consultas sit ON sit.situacao = c.stc_situacao
            LEFT JOIN agh.aac_grade_agendamen_consultas g ON g.seq = c.grd_seq
            LEFT JOIN agh.agh_especialidades e ON e.seq = g.esp_seq
            WHERE c.pac_codigo = 7567
            ORDER BY c.dthr_marcacao DESC
            LIMIT 10;
        `;

        const resultRenata = await pool.query(queryRenata);
        console.log(`Consultas encontradas: ${resultRenata.rows.length}\n`);

        resultRenata.rows.forEach((row, i) => {
            console.log(`--- Consulta ${i + 1} ---`);
            console.log(`  Número: ${row.numero}`);
            console.log(`  Especialidade: ${row.nome_especialidade}`);
            console.log(`  Situação: ${row.stc_situacao} - ${row.situacao_desc}`);
            console.log(`  Data Consulta: ${row.dt_consulta}`);
            console.log(`  Data/Hora Marcação: ${row.dthr_marcacao}`);
            console.log(`  Criado em: ${row.criado_em}`);
            console.log(`  Alterado em: ${row.alterado_em}`);
            console.log(`  Versão: ${row.versao}`);
            console.log('');
        });

        // 3. Verificar se existe tabela de histórico/auditoria
        console.log('3. Procurando tabelas de histórico/auditoria...\n');
        const queryHistorico = `
            SELECT
                table_name
            FROM information_schema.tables
            WHERE table_schema = 'agh'
                AND (
                    table_name LIKE '%consulta%'
                    OR table_name LIKE '%historico%'
                    OR table_name LIKE '%auditoria%'
                    OR table_name LIKE '%log%'
                )
            ORDER BY table_name;
        `;

        const resultHistorico = await pool.query(queryHistorico);
        console.log('Tabelas relacionadas a consultas/histórico:');
        resultHistorico.rows.forEach(row => {
            console.log(`  - ${row.table_name}`);
        });

        // 4. Testar busca por situação = 'D' sem filtro de data
        console.log('\n\n4. Buscando consultas com situação "D" (desmarcadas)...\n');
        const queryDesmarcadas = `
            SELECT
                c.numero,
                c.dt_consulta,
                c.dthr_marcacao,
                c.alterado_em,
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
            ORDER BY c.alterado_em DESC NULLS LAST
            LIMIT 20;
        `;

        const resultDesmarcadas = await pool.query(queryDesmarcadas);
        console.log(`Consultas desmarcadas encontradas: ${resultDesmarcadas.rows.length}\n`);

        console.log('Últimas 10 consultas desmarcadas (ordenadas por "alterado_em"):');
        resultDesmarcadas.rows.slice(0, 10).forEach((row, i) => {
            console.log(`${i + 1}. ${row.paciente} - ${row.nome_especialidade}`);
            console.log(`   Situação: ${row.stc_situacao} - ${row.situacao_desc}`);
            console.log(`   Alterado em: ${row.alterado_em || 'NULL'}`);
            console.log(`   Data marcação: ${row.dthr_marcacao}`);
            console.log('');
        });

    } catch (error) {
        console.error('\n❌ ERRO:', error.message);
    } finally {
        await pool.end();
        console.log('\n=== FIM DA INVESTIGAÇÃO ===\n');
    }
}

investigarEstrutura();
