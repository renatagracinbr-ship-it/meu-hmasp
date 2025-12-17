/**
 * Script de Diagnóstico - Telefones do AGHUse
 *
 * Execute este script quando estiver na VPN para ver o que está vindo do banco
 *
 * COMO USAR:
 * 1. Conecte na VPN
 * 2. Execute: node diagnostico-telefones.js
 * 3. Copie o resultado e cole aqui quando voltar com internet
 */

const { Pool } = require('pg');

// Configuração do banco AGHUse
const pool = new Pool({
    host: '10.12.40.219',
    port: 5432,
    database: 'dbaghu',
    user: 'birm_read',
    password: 'birm@read',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000
});

async function diagnosticar() {
    try {
        console.log('===================================');
        console.log('DIAGNÓSTICO DE TELEFONES - AGHUse');
        console.log('===================================\n');

        // Busca as últimas 3 consultas marcadas
        const query = `
            SELECT
                c.numero as consulta_numero,
                c.pac_codigo,
                p.nome as nome_paciente,
                -- Campos SEPARADOS (antes da concatenação)
                p.ddd_fone_celular as ddd_celular,
                p.fone_celular as num_celular,
                p.ddd_fone_residencial as ddd_fixo,
                p.fone_residencial as num_fixo,
                p.ddd_fone_recado as ddd_recado,
                p.fone_recado as num_recado,
                -- Campos CONCATENADOS (como o sistema usa)
                CASE
                    WHEN p.fone_celular IS NOT NULL AND p.ddd_fone_celular IS NOT NULL
                    THEN CONCAT(p.ddd_fone_celular::text, p.fone_celular::text)
                    WHEN p.fone_celular IS NOT NULL
                    THEN p.fone_celular::text
                    ELSE NULL
                END as telefone_celular_final,
                CASE
                    WHEN p.fone_residencial IS NOT NULL AND p.ddd_fone_residencial IS NOT NULL
                    THEN CONCAT(p.ddd_fone_residencial::text, p.fone_residencial::text)
                    WHEN p.fone_residencial IS NOT NULL
                    THEN p.fone_residencial::text
                    ELSE NULL
                END as telefone_fixo_final,
                CASE
                    WHEN p.fone_recado IS NOT NULL AND p.ddd_fone_recado IS NOT NULL
                    THEN CONCAT(p.ddd_fone_recado::text, p.fone_recado::text)
                    WHEN p.fone_recado IS NOT NULL
                    THEN p.fone_recado::text
                    ELSE NULL
                END as telefone_recado_final
            FROM agh.aac_consultas c
            LEFT JOIN agh.aip_pacientes p ON p.codigo = c.pac_codigo
            WHERE c.dthr_marcacao >= NOW() - INTERVAL '60 minutes'
                AND c.pac_codigo IS NOT NULL
                AND c.stc_situacao = 'M'
            ORDER BY c.dthr_marcacao DESC
            LIMIT 3;
        `;

        const result = await pool.query(query);

        console.log(`Encontradas ${result.rows.length} consultas marcadas na última hora:\n`);

        result.rows.forEach((row, index) => {
            console.log(`\n--- CONSULTA ${index + 1} ---`);
            console.log(`Número: ${row.consulta_numero}`);
            console.log(`Paciente: ${row.nome_paciente}`);
            console.log(`Código Paciente: ${row.pac_codigo}`);
            console.log('\nTELEFONES SEPARADOS (campos do banco):');
            console.log(`  DDD Celular: ${row.ddd_celular || 'NULL'}`);
            console.log(`  Num Celular: ${row.num_celular || 'NULL'}`);
            console.log(`  DDD Fixo: ${row.ddd_fixo || 'NULL'}`);
            console.log(`  Num Fixo: ${row.num_fixo || 'NULL'}`);
            console.log(`  DDD Recado: ${row.ddd_recado || 'NULL'}`);
            console.log(`  Num Recado: ${row.num_recado || 'NULL'}`);
            console.log('\nTELEFONES CONCATENADOS (como o sistema recebe):');
            console.log(`  Celular: ${row.telefone_celular_final || 'NULL'}`);
            console.log(`  Fixo: ${row.telefone_fixo_final || 'NULL'}`);
            console.log(`  Recado: ${row.telefone_recado_final || 'NULL'}`);

            // Verifica se tem pelo menos um telefone
            const temTelefone = row.telefone_celular_final || row.telefone_fixo_final || row.telefone_recado_final;
            if (!temTelefone) {
                console.log('\n⚠️  PROBLEMA: Nenhum telefone concatenado!');
            } else {
                console.log('\n✓ OK: Pelo menos um telefone encontrado');
            }
        });

        console.log('\n===================================');
        console.log('FIM DO DIAGNÓSTICO');
        console.log('===================================\n');

        await pool.end();

    } catch (error) {
        console.error('ERRO ao diagnosticar:', error);
        await pool.end();
        process.exit(1);
    }
}

diagnosticar();
