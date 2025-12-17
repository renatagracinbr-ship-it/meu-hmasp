/**
 * Script de diagnóstico para encontrar consultas desmarcadas
 * Busca especificamente pela paciente RENATA GRACIN RUSSEL SEIXAS
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

async function diagnosticar() {
    const pool = new Pool(DB_CONFIG);

    try {
        console.log('\n=== DIAGNÓSTICO DE DESMARCAÇÃO ===\n');

        // 1. Buscar por nome da paciente
        console.log('1. Buscando paciente por nome...\n');
        const queryPaciente = `
            SELECT
                codigo,
                prontuario,
                nome,
                cpf
            FROM agh.aip_pacientes
            WHERE UPPER(nome) LIKE '%RENATA%GRACIN%RUSSEL%SEIXAS%'
            LIMIT 5;
        `;

        const resultPaciente = await pool.query(queryPaciente);
        console.log(`Pacientes encontradas: ${resultPaciente.rows.length}`);
        resultPaciente.rows.forEach(row => {
            console.log(`  - Código: ${row.codigo} | Prontuário: ${row.prontuario} | Nome: ${row.nome}`);
        });

        if (resultPaciente.rows.length === 0) {
            console.log('\n❌ Paciente não encontrada! Verifique o nome.');
            return;
        }

        const pacCodigo = resultPaciente.rows[0].codigo;
        console.log(`\n✓ Usando paciente código: ${pacCodigo}\n`);

        // 2. Buscar todas as consultas dessa paciente
        console.log('2. Buscando todas as consultas da paciente...\n');
        const queryConsultas = `
            SELECT
                c.numero as consulta_numero,
                c.dt_consulta,
                c.dthr_marcacao,
                c.dthr_desmarcacao,
                c.stc_situacao,
                sit.descricao as situacao_descricao,
                e.nome_especialidade as especialidade,
                c.pac_codigo
            FROM agh.aac_consultas c
            LEFT JOIN agh.aac_situacao_consultas sit ON sit.situacao = c.stc_situacao
            LEFT JOIN agh.aac_grade_agendamen_consultas g ON g.seq = c.grd_seq
            LEFT JOIN agh.agh_especialidades e ON e.seq = g.esp_seq
            WHERE c.pac_codigo = $1
            ORDER BY c.dthr_marcacao DESC
            LIMIT 20;
        `;

        const resultConsultas = await pool.query(queryConsultas, [pacCodigo]);
        console.log(`Total de consultas encontradas: ${resultConsultas.rows.length}\n`);

        resultConsultas.rows.forEach((row, index) => {
            console.log(`--- Consulta ${index + 1} ---`);
            console.log(`  Número: ${row.consulta_numero}`);
            console.log(`  Especialidade: ${row.especialidade}`);
            console.log(`  Situação: ${row.stc_situacao} - ${row.situacao_descricao}`);
            console.log(`  Data Consulta: ${row.dt_consulta}`);
            console.log(`  Data Marcação: ${row.dthr_marcacao}`);
            console.log(`  Data Desmarcação: ${row.dthr_desmarcacao || 'NULL'}`);
            console.log('');
        });

        // 3. Filtrar consultas de MASTOLOGIA desmarcadas
        console.log('3. Filtrando consultas de MASTOLOGIA desmarcadas...\n');
        const consultasMastologia = resultConsultas.rows.filter(row =>
            row.especialidade && row.especialidade.toUpperCase().includes('MASTOLOGIA')
        );

        console.log(`Consultas de MASTOLOGIA encontradas: ${consultasMastologia.length}\n`);

        if (consultasMastologia.length > 0) {
            consultasMastologia.forEach((row, index) => {
                console.log(`--- MASTOLOGIA ${index + 1} ---`);
                console.log(`  Número: ${row.consulta_numero}`);
                console.log(`  Situação: ${row.stc_situacao} - ${row.situacao_descricao}`);
                console.log(`  Data Desmarcação: ${row.dthr_desmarcacao || 'NULL'}`);
                console.log('');
            });
        }

        // 4. Testar a query original que o sistema usa
        console.log('4. Testando query original do sistema (últimos 60 minutos)...\n');
        const queryOriginal = `
            SELECT
                c.numero as consulta_numero,
                c.dt_consulta as data_hora_consulta,
                c.dthr_marcacao as data_hora_marcacao,
                c.dthr_desmarcacao as data_hora_desmarcacao,
                c.pac_codigo,
                p.prontuario::text as prontuario,
                p.nome as nome_paciente,
                c.stc_situacao as situacao_codigo,
                sit.descricao as situacao_descricao,
                e.nome_especialidade as especialidade
            FROM agh.aac_consultas c
            LEFT JOIN agh.aip_pacientes p ON p.codigo = c.pac_codigo
            LEFT JOIN agh.aac_grade_agendamen_consultas g ON g.seq = c.grd_seq
            LEFT JOIN agh.agh_especialidades e ON e.seq = g.esp_seq
            LEFT JOIN agh.aac_situacao_consultas sit ON sit.situacao = c.stc_situacao
            WHERE c.dthr_desmarcacao >= NOW() - INTERVAL '60 minutes'
                AND c.pac_codigo IS NOT NULL
                AND c.stc_situacao = 'D'
            ORDER BY c.dthr_desmarcacao DESC
            LIMIT 100;
        `;

        const resultOriginal = await pool.query(queryOriginal);
        console.log(`Consultas encontradas pela query original: ${resultOriginal.rows.length}\n`);

        if (resultOriginal.rows.length > 0) {
            console.log('Primeiras 5 consultas desmarcadas recentemente:');
            resultOriginal.rows.slice(0, 5).forEach((row, index) => {
                console.log(`${index + 1}. ${row.nome_paciente} - ${row.especialidade} - Desmarcada em: ${row.data_hora_desmarcacao}`);
            });
        } else {
            console.log('⚠️ Nenhuma consulta desmarcada nos últimos 60 minutos!');
        }

        // 5. Verificar situações possíveis no banco
        console.log('\n5. Verificando todas as situações de consulta disponíveis...\n');
        const querySituacoes = `
            SELECT DISTINCT
                sit.situacao,
                sit.descricao,
                COUNT(c.numero) as total_consultas
            FROM agh.aac_situacao_consultas sit
            LEFT JOIN agh.aac_consultas c ON c.stc_situacao = sit.situacao
            GROUP BY sit.situacao, sit.descricao
            ORDER BY total_consultas DESC
            LIMIT 20;
        `;

        const resultSituacoes = await pool.query(querySituacoes);
        console.log('Situações de consulta no sistema:');
        resultSituacoes.rows.forEach(row => {
            console.log(`  ${row.situacao} - ${row.descricao} (${row.total_consultas} consultas)`);
        });

    } catch (error) {
        console.error('\n❌ ERRO:', error);
    } finally {
        await pool.end();
        console.log('\n=== FIM DO DIAGNÓSTICO ===\n');
    }
}

diagnosticar();
