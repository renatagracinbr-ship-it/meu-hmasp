const { Pool } = require('pg');

const pool = new Pool({
    host: '10.12.40.219',
    port: 5432,
    database: 'dbaghu',
    user: 'birm_read',
    password: 'birm@read',
    connectionTimeoutMillis: 5000,
});

async function checkRenataStatus() {
    try {
        console.log('\n=== STATUS ATUAL DA CONSULTA 523560 (RENATA) ===\n');

        const current = await pool.query(`
            SELECT
                c.numero,
                c.pac_codigo,
                c.stc_situacao,
                c.dt_consulta,
                p.nome,
                p.prontuario,
                e.nome_especialidade
            FROM agh.aac_consultas c
            LEFT JOIN agh.aip_pacientes p ON p.codigo = c.pac_codigo
            LEFT JOIN agh.aac_grade_agendamen_consultas g ON g.seq = c.grd_seq
            LEFT JOIN agh.agh_especialidades e ON e.seq = g.esp_seq
            WHERE c.numero = 523560
        `);

        if (current.rows.length > 0) {
            const row = current.rows[0];
            console.log('Status atual da consulta:');
            console.log(`  Número: ${row.numero}`);
            console.log(`  Paciente: ${row.nome} (${row.pac_codigo})`);
            console.log(`  Prontuário: ${row.prontuario}`);
            console.log(`  Especialidade: ${row.nome_especialidade}`);
            console.log(`  Data da consulta: ${row.dt_consulta}`);
            console.log(`  ⚠️ SITUAÇÃO ATUAL: ${row.stc_situacao}`);

            if (row.stc_situacao === 'M') {
                console.log('\n  ✅ A consulta está MARCADA (foi remarcada após a desmarcação)');
            } else if (row.stc_situacao === 'L') {
                console.log('\n  ⚠️ A consulta está LIVRE (ainda desmarcada)');
            }
        } else {
            console.log('❌ Consulta não encontrada');
        }

        console.log('\n=== HISTÓRICO DE MUDANÇAS (últimas 24h) ===\n');

        const history = await pool.query(`
            SELECT
                jn_operation,
                stc_situacao,
                jn_date_time,
                jn_user
            FROM agh.aac_consultas_jn
            WHERE numero = 523560
                AND jn_date_time >= NOW() - INTERVAL '24 hours'
            ORDER BY jn_date_time ASC
        `);

        history.rows.forEach((row, index) => {
            console.log(`${index + 1}. ${row.jn_operation} | Status: ${row.stc_situacao} | ${row.jn_date_time} | Por: ${row.jn_user}`);
        });

        console.log('\n=== DECISÃO: O QUE FAZER? ===\n');
        console.log('Opção 1: Mostrar APENAS consultas que estão atualmente desmarcadas (status atual = "L")');
        console.log('  Prós: Não notifica sobre cancelamentos que foram corrigidos');
        console.log('  Contras: Não notifica se alguém desmarcar e remarcar em seguida\n');

        console.log('Opção 2: Mostrar TODAS as desmarcações, mesmo que remarcadas depois');
        console.log('  Prós: Notifica sobre todos os cancelamentos');
        console.log('  Contras: Pode notificar sobre cancelamentos que já foram resolvidos\n');

        console.log('Opção 3: Mostrar desmarcações recentes (ex: últimos 5-10 minutos) e que ainda estão desmarcadas');
        console.log('  Prós: Captura cancelamentos reais, ignora correções imediatas');
        console.log('  Contras: Pode perder alguns cancelamentos legítimos\n');

    } catch (error) {
        console.error('Erro:', error.message);
    } finally {
        await pool.end();
    }
}

checkRenataStatus();
