/**
 * Servidor AGHUse Standalone - Porta 3001
 * Backend dedicado para AGHUse que roda independente
 */

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = 3000; // NOVA PORTA 3000!

// Middlewares
app.use(cors());
app.use(express.json());

// Configuração do banco AGHUse
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

let pool = null;

/**
 * Obtém ou cria o pool de conexões
 */
function getPool() {
    if (!pool) {
        pool = new Pool(DB_CONFIG);
        pool.on('error', (err) => {
            console.error('[AGHUse] Erro no pool de conexões:', err);
        });
        console.log('[AGHUse] Pool de conexões criado');
    }
    return pool;
}

// ============================================================================
// ENDPOINTS AGHUse
// ============================================================================

/**
 * Testa conexão com o banco AGHUse
 */
app.get('/api/aghuse/test-connection', async (req, res) => {
    try {
        const client = getPool();
        const result = await client.query('SELECT NOW() as current_time, version() as version');

        console.log('[AGHUse] Teste de conexão OK');

        res.json({
            success: true,
            timestamp: result.rows[0].current_time,
            version: result.rows[0].version
        });
    } catch (error) {
        console.error('[AGHUse] Erro ao testar conexão:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Busca consultas marcadas recentes
 */
app.get('/api/aghuse/recent-appointments', async (req, res) => {
    try {
        const client = getPool();

        const query = `
            SELECT
                ac.seq AS id,
                ac.pac_codigo AS paciente_codigo,
                p.nome AS paciente_nome,
                TO_CHAR(ac.dt_consulta, 'DD/MM/YYYY') AS data_consulta,
                TO_CHAR(ac.dt_consulta, 'HH24:MI') AS hora_consulta,
                ac.situacao,
                e.nome_especialidade AS especialidade,
                prof.nome AS profissional,
                ac.sala
            FROM
                agh.aac_consultas ac
                LEFT JOIN agh.aip_pacientes p ON p.codigo = ac.pac_codigo
                LEFT JOIN agh.aac_especialidades e ON e.seq = ac.esp_seq
                LEFT JOIN agh.rap_servidores prof ON prof.matricula = ac.srv_matricula
            WHERE
                ac.dt_consulta >= CURRENT_DATE
                AND ac.dt_consulta <= CURRENT_DATE + INTERVAL '7 days'
                AND ac.situacao IN ('A', 'M')  -- A=Agendada, M=Marcada
            ORDER BY
                ac.dt_consulta ASC
            LIMIT 50
        `;

        const result = await client.query(query);

        console.log(`[AGHUse] ${result.rows.length} consultas recentes encontradas`);

        res.json({
            success: true,
            count: result.rows.length,
            appointments: result.rows
        });
    } catch (error) {
        console.error('[AGHUse] Erro ao buscar consultas recentes:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Busca consultas canceladas recentes
 */
app.get('/api/aghuse/recent-cancellations', async (req, res) => {
    try {
        const client = getPool();

        const query = `
            SELECT
                ac.seq AS id,
                ac.pac_codigo AS paciente_codigo,
                p.nome AS paciente_nome,
                TO_CHAR(ac.dt_consulta, 'DD/MM/YYYY') AS data_consulta,
                TO_CHAR(ac.dt_consulta, 'HH24:MI') AS hora_consulta,
                ac.situacao,
                e.nome_especialidade AS especialidade,
                TO_CHAR(ac.criado_em, 'DD/MM/YYYY HH24:MI') AS data_cancelamento
            FROM
                agh.aac_consultas ac
                LEFT JOIN agh.aip_pacientes p ON p.codigo = ac.pac_codigo
                LEFT JOIN agh.aac_especialidades e ON e.seq = ac.esp_seq
            WHERE
                ac.situacao = 'C'  -- C=Cancelada
                AND ac.criado_em >= CURRENT_DATE - INTERVAL '7 days'
            ORDER BY
                ac.criado_em DESC
            LIMIT 50
        `;

        const result = await client.query(query);

        console.log(`[AGHUse] ${result.rows.length} cancelamentos recentes encontrados`);

        res.json({
            success: true,
            count: result.rows.length,
            cancellations: result.rows
        });
    } catch (error) {
        console.error('[AGHUse] Erro ao buscar cancelamentos:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Busca consultas para lembrete 72h (próximos 3 dias)
 */
app.get('/api/aghuse/appointments-72h', async (req, res) => {
    try {
        const client = getPool();

        const query = `
            SELECT
                ac.seq AS id,
                ac.pac_codigo AS paciente_codigo,
                p.nome AS paciente_nome,
                p.fone_residencial AS telefone,
                p.fone_celular AS celular,
                TO_CHAR(ac.dt_consulta, 'DD/MM/YYYY') AS data_consulta,
                TO_CHAR(ac.dt_consulta, 'HH24:MI') AS hora_consulta,
                e.nome_especialidade AS especialidade,
                prof.nome AS profissional,
                ac.sala
            FROM
                agh.aac_consultas ac
                LEFT JOIN agh.aip_pacientes p ON p.codigo = ac.pac_codigo
                LEFT JOIN agh.aac_especialidades e ON e.seq = ac.esp_seq
                LEFT JOIN agh.rap_servidores prof ON prof.matricula = ac.srv_matricula
            WHERE
                ac.dt_consulta >= CURRENT_DATE + INTERVAL '2 days'
                AND ac.dt_consulta <= CURRENT_DATE + INTERVAL '3 days'
                AND ac.situacao IN ('A', 'M')
            ORDER BY
                ac.dt_consulta ASC
        `;

        const result = await client.query(query);

        console.log(`[AGHUse] ${result.rows.length} consultas para lembrete 72h`);

        res.json({
            success: true,
            count: result.rows.length,
            appointments: result.rows
        });
    } catch (error) {
        console.error('[AGHUse] Erro ao buscar consultas 72h:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Health check
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'AGHUse Standalone',
        port: PORT,
        timestamp: new Date().toISOString()
    });
});

// ============================================================================
// INICIALIZAÇÃO
// ============================================================================

app.listen(PORT, '0.0.0.0', () => {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║         SERVIDOR AGHUse STANDALONE - PORTA 3001              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`✅ Servidor rodando em: http://localhost:${PORT}`);
    console.log(`🔗 Conectando ao banco: ${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}`);
    console.log('');
    console.log('📋 Endpoints disponíveis:');
    console.log('   GET /api/aghuse/test-connection');
    console.log('   GET /api/aghuse/recent-appointments');
    console.log('   GET /api/aghuse/recent-cancellations');
    console.log('   GET /api/aghuse/appointments-72h');
    console.log('   GET /health');
    console.log('');
    console.log('⏹️  Para parar: Ctrl+C');
    console.log('══════════════════════════════════════════════════════════════');

    // Testar conexão ao iniciar
    getPool().query('SELECT NOW()')
        .then(() => {
            console.log('✅ Conexão com PostgreSQL estabelecida!');
        })
        .catch((err) => {
            console.error('❌ Erro ao conectar PostgreSQL:', err.message);
        });
});

// Tratamento de erros
process.on('uncaughtException', (error) => {
    console.error('[ERRO]', error);
});

process.on('unhandledRejection', (reason) => {
    console.error('[ERRO]', reason);
});

// Fechar pool ao encerrar
process.on('SIGTERM', async () => {
    console.log('Encerrando servidor...');
    if (pool) {
        await pool.end();
    }
    process.exit(0);
});
