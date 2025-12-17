const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'aghuse',
    user: 'postgres',
    password: 'majrenata'
});

async function checkColumns() {
    try {
        // Verifica as colunas da tabela aac_consultas
        const result = await pool.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'agh'
            AND table_name = 'aac_consultas'
            AND column_name LIKE '%marc%'
            ORDER BY column_name;
        `);

        console.log('=== Colunas com "marc" na tabela aac_consultas ===');
        result.rows.forEach(row => {
            console.log(`${row.column_name} (${row.data_type})`);
        });

        // Busca uma consulta específica para ver os valores
        const consulta = await pool.query(`
            SELECT *
            FROM agh.aac_consultas
            WHERE pac_codigo = (SELECT codigo FROM agh.aip_pacientes WHERE nome LIKE '%FATIMA NORONHA%' LIMIT 1)
            LIMIT 1;
        `);

        console.log('\n=== Dados da consulta de FATIMA NORONHA ===');
        if (consulta.rows.length > 0) {
            const cols = Object.keys(consulta.rows[0]);
            cols.filter(c => c.includes('marc') || c.includes('dt') || c.includes('criado')).forEach(col => {
                console.log(`${col}: ${consulta.rows[0][col]}`);
            });
        }

        // Verifica também todas as colunas de data
        const dateCols = await pool.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'agh'
            AND table_name = 'aac_consultas'
            AND (data_type LIKE '%timestamp%' OR data_type LIKE '%date%')
            ORDER BY column_name;
        `);

        console.log('\n=== Todas as colunas de data na tabela aac_consultas ===');
        dateCols.rows.forEach(row => {
            console.log(`${row.column_name} (${row.data_type})`);
        });

        await pool.end();
    } catch (error) {
        console.error('Erro:', error.message);
        process.exit(1);
    }
}

checkColumns();
