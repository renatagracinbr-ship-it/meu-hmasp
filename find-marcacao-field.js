const { Pool } = require('pg');

const pool = new Pool({
    host: '10.12.40.219',
    port: 5432,
    database: 'dbaghu',
    user: 'birm_read',
    password: 'birm@read'
});

async function findField() {
    try {
        // Busca a consulta da RENATA GRACIN RUSSEL SEIXAS em CIRURGIA VASCULAR
        const result = await pool.query(`
            SELECT c.*, p.nome as nome_paciente, e.nome_especialidade
            FROM agh.aac_consultas c
            LEFT JOIN agh.aip_pacientes p ON p.codigo = c.pac_codigo
            LEFT JOIN agh.aac_grade_agendamen_consultas g ON g.seq = c.grd_seq
            LEFT JOIN agh.agh_especialidades e ON e.seq = g.esp_seq
            WHERE p.nome LIKE '%RENATA GRACIN RUSSEL SEIXAS%'
            AND e.nome_especialidade LIKE '%CIRURGIA VASCULAR%'
            ORDER BY c.numero DESC
            LIMIT 1;
        `);

        if (result.rows.length === 0) {
            console.log('❌ Consulta não encontrada');
            await pool.end();
            return;
        }

        const consulta = result.rows[0];
        console.log('\n=== CONSULTA ENCONTRADA ===');
        console.log('Paciente:', consulta.nome_paciente);
        console.log('Especialidade:', consulta.nome_especialidade);
        console.log('Número da consulta:', consulta.numero);

        console.log('\n=== TODOS OS CAMPOS DE DATA/HORA ===');

        // Mostra todos os campos que contêm data ou timestamp
        Object.keys(consulta).forEach(key => {
            const value = consulta[key];
            // Verifica se é uma data ou se o campo tem "dt" ou "data" no nome
            if (value instanceof Date ||
                key.toLowerCase().includes('dt') ||
                key.toLowerCase().includes('data') ||
                key.toLowerCase().includes('criado') ||
                key.toLowerCase().includes('marc')) {
                if (value instanceof Date) {
                    console.log(`${key}: ${value} (ISO: ${value.toISOString()})`);
                } else {
                    console.log(`${key}: ${value}`);
                }
            }
        });

        // Procura especificamente por valores que batam com "02/12/2025 11:12"
        console.log('\n=== CAMPOS COM VALOR PRÓXIMO A 02/12/2025 11:12:00 ===');
        Object.keys(consulta).forEach(key => {
            const value = consulta[key];
            if (value instanceof Date) {
                const dateStr = value.toISOString();
                if (dateStr.includes('2025-12-02') && dateStr.includes('11:12')) {
                    console.log(`✅ ENCONTRADO: ${key} = ${value}`);
                }
            }
        });

        await pool.end();
    } catch (error) {
        console.error('Erro:', error);
        await pool.end();
        process.exit(1);
    }
}

findField();
