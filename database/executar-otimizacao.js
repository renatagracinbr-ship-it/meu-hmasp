/**
 * Script para executar otimizações de índices no PostgreSQL
 *
 * Uso:
 *   node database/executar-otimizacao.js
 */

const fs = require('fs');
const path = require('path');

// Importa configuração do pool PostgreSQL
const aghuseServer = require('../server/aghuse-server.js');

async function executarOtimizacao() {
    console.log('========================================');
    console.log('  OTIMIZAÇÃO DE PERFORMANCE - HMASP');
    console.log('========================================');
    console.log('');

    try {
        // Lê o arquivo SQL
        const sqlPath = path.join(__dirname, 'otimizacao-indices.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('[1/4] 📖 Arquivo SQL carregado');
        console.log('');

        // Separa comandos (split por ponto-e-vírgula)
        const comandos = sql
            .split(';')
            .map(cmd => cmd.trim())
            .filter(cmd => cmd.length > 0 && !cmd.startsWith('--') && !cmd.startsWith('/*'));

        console.log(`[2/4] 🔧 ${comandos.length} comandos encontrados`);
        console.log('');

        // Obtém pool de conexão
        const pool = aghuseServer.getPool();

        let sucessos = 0;
        let erros = 0;

        // Executa cada comando
        for (let i = 0; i < comandos.length; i++) {
            const comando = comandos[i];

            // Pula comandos vazios ou comentários
            if (comando.length < 5) continue;

            // Identifica tipo de comando
            const tipo = comando.substring(0, 50).replace(/\n/g, ' ');

            try {
                console.log(`[3/${i+1}] Executando: ${tipo}...`);
                await pool.query(comando + ';');
                console.log(`     ✅ Sucesso`);
                sucessos++;
            } catch (error) {
                // Se for erro de "já existe", ignora
                if (error.message.includes('already exists')) {
                    console.log(`     ⚠️  Índice já existe (ignorado)`);
                    sucessos++;
                } else {
                    console.error(`     ❌ Erro: ${error.message}`);
                    erros++;
                }
            }
            console.log('');
        }

        console.log('========================================');
        console.log('  RESULTADO DA OTIMIZAÇÃO');
        console.log('========================================');
        console.log(`✅ Sucesso: ${sucessos} comandos`);
        console.log(`❌ Erros: ${erros} comandos`);
        console.log('');

        // Verifica índices criados
        console.log('[4/4] 🔍 Verificando índices criados...');
        console.log('');

        const resultado = await pool.query(`
            SELECT
                indexname,
                indexdef
            FROM pg_indexes
            WHERE tablename = 'aac_consultas_jn'
                AND indexname LIKE 'idx_consultas_jn_%'
            ORDER BY indexname
        `);

        if (resultado.rows.length > 0) {
            console.log('✅ Índices encontrados:');
            resultado.rows.forEach(row => {
                console.log(`   - ${row.indexname}`);
            });
        } else {
            console.log('⚠️  Nenhum índice encontrado (pode ter havido erro)');
        }

        console.log('');
        console.log('========================================');
        console.log('  OTIMIZAÇÃO CONCLUÍDA!');
        console.log('========================================');
        console.log('');
        console.log('💡 Dica: Reinicie o servidor Node.js para aplicar');
        console.log('   as otimizações completamente.');
        console.log('');

        process.exit(0);

    } catch (error) {
        console.error('');
        console.error('========================================');
        console.error('  ERRO CRÍTICO');
        console.error('========================================');
        console.error(error);
        console.error('');
        console.error('❌ Não foi possível executar a otimização.');
        console.error('');
        console.error('Possíveis causas:');
        console.error('1. PostgreSQL não está acessível');
        console.error('2. Usuário sem permissões de CREATE INDEX');
        console.error('3. Schema/tabela não encontrada');
        console.error('');
        console.error('Solução: Execute o SQL manualmente via psql/DBeaver');
        console.error('');
        process.exit(1);
    }
}

// Executa
executarOtimizacao();
