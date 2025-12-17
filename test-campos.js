const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
});

async function verCampos() {
    try {
        const client = await pool.connect();

        console.log('\n=== CAMPOS DE DATA/HORA na tabela aac_consultas ===\n');

        // Ver TODOS os campos da consulta 515148
        const result = await client.query(`
            SELECT *
            FROM agh.aac_consultas
            WHERE numero = 515148;
        `);

        if (result.rows.length > 0) {
            const campos = Object.keys(result.rows[0]);
            console.log('Todos os campos disponíveis:');
            campos.forEach(campo => {
                const valor = result.rows[0][campo];
                if (valor instanceof Date || campo.includes('dt') || campo.includes('data') || campo.includes('criado') || campo.includes('alterado') || campo.includes('modificado')) {
                    console.log(`  ${campo}: ${valor}`);
                }
            });
        }

        client.release();
        await pool.end();
    } catch (err) {
        console.error('Erro:', err);
        await pool.end();
    }
}

verCampos();
