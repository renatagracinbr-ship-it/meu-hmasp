const { Pool } = require('pg');

const pool = new Pool({
    host: '10.12.40.219',
    port: 5432,
    database: 'dbaghu',
    user: 'birm_read',
    password: 'birm@read',
    connectionTimeoutMillis: 5000,
});

async function investigar() {
    try {
        console.log('\n=== INVESTIGANDO DESMARCAÇÕES ===\n');

        // 1. Busca RENATA especificamente
        console.log('1. RENATA GRACIN RUSSEL SEIXAS (Consulta 523560):\n');

        const renata = await pool.query(`
            SELECT
                jn_operation,
                stc_situacao,
                jn_date_time,
                jn_user
            FROM agh.aac_consultas_jn
            WHERE numero = 523560
            ORDER BY jn_date_time DESC
            LIMIT 10
        `);

        renata.rows.forEach((row, i) => {
            console.log(`   ${i+1}. ${row.jn_operation} | ${row.stc_situacao} | ${row.jn_date_time} | ${row.jn_user}`);
        });

        // 2. Verifica distribuição de datas nas últimas desmarcações
        console.log('\n\n2. DISTRIBUIÇÃO DE DATAS DAS DESMARCAÇÕES (últimos 60 min):\n');

        const dist60 = await pool.query(`
            SELECT
                DATE(jn_date_time) as data,
                COUNT(*) as total
            FROM agh.aac_consultas_jn
            WHERE jn_operation = 'UPD'
                AND jn_date_time >= NOW() - INTERVAL '60 minutes'
                AND stc_situacao = 'L'
            GROUP BY DATE(jn_date_time)
            ORDER BY data DESC
        `);

        console.log('   Desmarcações nos últimos 60 minutos:');
        dist60.rows.forEach(row => {
            console.log(`   ${row.data}: ${row.total} desmarcações`);
        });

        // 3. Últimas 20 desmarcações com detalhes
        console.log('\n\n3. ÚLTIMAS 20 DESMARCAÇÕES ENCONTRADAS:\n');

        const ultimas = await pool.query(`
            SELECT DISTINCT ON (jn1.numero)
                jn1.numero,
                jn1.jn_date_time as data_desmarcacao,
                jn1.jn_user,
                c.stc_situacao as situacao_atual,
                p.nome as paciente
            FROM agh.aac_consultas_jn jn1
            LEFT JOIN agh.aac_consultas c ON c.numero = jn1.numero
            LEFT JOIN agh.aip_pacientes p ON p.codigo = c.pac_codigo
            WHERE jn1.jn_operation = 'UPD'
                AND jn1.jn_date_time >= NOW() - INTERVAL '60 minutes'
                AND jn1.stc_situacao = 'L'
            ORDER BY jn1.numero, jn1.jn_date_time DESC
            LIMIT 20
        `);

        ultimas.rows.forEach((row, i) => {
            const agora = new Date();
            const desmarcacao = new Date(row.data_desmarcacao);
            const diffMin = Math.round((agora - desmarcacao) / (1000 * 60));

            console.log(`   ${i+1}. Consulta ${row.numero}`);
            console.log(`      Paciente: ${row.paciente || 'NULL'}`);
            console.log(`      Desmarcada há: ${diffMin} minutos`);
            console.log(`      Data: ${row.data_desmarcacao}`);
            console.log(`      Situação atual: ${row.situacao_atual}`);
            console.log(`      Usuário: ${row.jn_user}`);
            console.log('');
        });

        // 4. Conta por situação atual
        console.log('\n4. SITUAÇÕES ATUAIS DAS CONSULTAS "DESMARCADAS":\n');

        const situacoes = await pool.query(`
            WITH desmarcadas AS (
                SELECT DISTINCT ON (jn1.numero)
                    jn1.numero,
                    jn1.jn_date_time as data_desmarcacao
                FROM agh.aac_consultas_jn jn1
                WHERE jn1.jn_operation = 'UPD'
                    AND jn1.jn_date_time >= NOW() - INTERVAL '60 minutes'
                    AND jn1.stc_situacao = 'L'
                ORDER BY jn1.numero, jn1.jn_date_time DESC
            )
            SELECT
                c.stc_situacao,
                COUNT(*) as total
            FROM desmarcadas d
            LEFT JOIN agh.aac_consultas c ON c.numero = d.numero
            GROUP BY c.stc_situacao
            ORDER BY total DESC
        `);

        situacoes.rows.forEach(row => {
            const situacao = row.stc_situacao || 'NULL';
            console.log(`   ${situacao}: ${row.total}`);
        });

        console.log('\n\n=== CONCLUSÃO ===');
        console.log('Se muitas consultas têm situação atual "M" (MARCADA) ou "G" (GERADA),');
        console.log('significa que foram remarcadas/reutilizadas após a desmarcação.');
        console.log('\nTalvez devamos filtrar para mostrar APENAS consultas que:');
        console.log('1. Foram desmarcadas recentemente (últimos 60 min)');
        console.log('2. E ainda estão com situação "L" (LIVRE) atualmente');

        await pool.end();

    } catch (error) {
        console.error('Erro:', error);
        await pool.end();
    }
}

investigar();
