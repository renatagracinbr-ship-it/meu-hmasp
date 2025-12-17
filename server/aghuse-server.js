/**
 * Servidor AGHUse - Backend
 * Integração com PostgreSQL (só funciona no Node.js, não no navegador)
 */

const { Pool } = require('pg');

// Configuração do banco AGHUse (usa variáveis de ambiente .env)
const DB_CONFIG = {
    host: process.env.DB_HOST || '10.12.40.219',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'dbaghu',
    user: process.env.DB_USER || 'birm_read',
    password: process.env.DB_PASSWORD || 'birm@read',
    max: parseInt(process.env.DB_POOL_MAX || '10'),
    min: parseInt(process.env.DB_POOL_MIN || '2'),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000, // Aumentado para 30s
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000
};

let pool = null;
let isConnected = false;

/**
 * Obtém ou cria o pool de conexões
 */
function getPool() {
    if (!pool) {
        pool = new Pool(DB_CONFIG);

        pool.on('error', (err) => {
            console.error('[AGHUse] ⚠️ Erro no pool de conexões:', err.message);
            isConnected = false;
        });

        pool.on('connect', () => {
            isConnected = true;
        });

        pool.on('remove', () => {
            console.log('[AGHUse] Cliente removido do pool');
        });

        console.log('[AGHUse] ✅ Pool de conexões criado');
    }
    return pool;
}

/**
 * Verifica se o pool está conectado
 */
function isPoolConnected() {
    return isConnected;
}

/**
 * Executa query com retry automático
 */
async function executeWithRetry(queryFn, retries = 3, delay = 1000) {
    let lastError;

    for (let i = 0; i < retries; i++) {
        try {
            const client = await getPool().connect();
            try {
                const result = await queryFn(client);
                isConnected = true;
                return result;
            } finally {
                client.release();
            }
        } catch (error) {
            lastError = error;
            isConnected = false;

            if (i < retries - 1) {
                console.log(`[AGHUse] ⚠️ Tentativa ${i + 1}/${retries} falhou, aguardando ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Backoff exponencial
            }
        }
    }

    throw lastError;
}

/**
 * Testa conexão com o banco AGHUse
 */
async function testConnection() {
    try {
        const result = await executeWithRetry(async (client) => {
            return await client.query('SELECT NOW() as current_time, version() as version');
        });

        console.log('[AGHUse] ✅ Conexão OK');
        isConnected = true;

        return {
            success: true,
            timestamp: result.rows[0].current_time,
            version: result.rows[0].version
        };
    } catch (error) {
        console.error('[AGHUse] ❌ Erro ao conectar:', error.message);
        isConnected = false;
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Busca consultas marcadas recentemente
 */
async function fetchRecentlyScheduledAppointments(minutes = 5, options = {}) {
    try {
        const limit = options.limit || 100;
        const offset = options.offset || 0;

        const result = await executeWithRetry(async (client) => {
            // BUSCA DIRETA: Consultas MARCADAS com dthr_marcacao recente
            // O AGHUse não grava todas as mudanças no journal, então usamos a tabela principal
            const query = `
                SELECT
                    c.numero as consulta_numero,
                    c.dt_consulta as data_hora_consulta,
                    COALESCE(c.dthr_marcacao, c.alterado_em) as data_hora_marcacao,
                    c.pac_codigo,
                    COALESCE(p.prontuario::text, '') as prontuario,
                    p.nome as nome_paciente,
                    COALESCE(p.cpf::text, '') as cpf_paciente,
                    -- Telefones com DDD concatenado
                    CASE
                        WHEN p.fone_residencial IS NOT NULL AND p.ddd_fone_residencial IS NOT NULL
                        THEN CONCAT(p.ddd_fone_residencial::text, p.fone_residencial::text)
                        WHEN p.fone_residencial IS NOT NULL
                        THEN p.fone_residencial::text
                        ELSE NULL
                    END as telefone_fixo,
                    CASE
                        WHEN p.fone_celular IS NOT NULL AND p.ddd_fone_celular IS NOT NULL
                        THEN CONCAT(p.ddd_fone_celular::text, p.fone_celular::text)
                        WHEN p.fone_celular IS NOT NULL
                        THEN p.fone_celular::text
                        ELSE NULL
                    END as telefone_celular,
                    CASE
                        WHEN p.fone_recado IS NOT NULL AND p.ddd_fone_recado IS NOT NULL
                        THEN CONCAT(p.ddd_fone_recado::text, p.fone_recado::text)
                        WHEN p.fone_recado IS NOT NULL
                        THEN p.fone_recado::text
                        ELSE NULL
                    END as telefone_adicional,
                    c.stc_situacao as situacao_codigo,
                    sit.descricao as situacao_descricao,
                    g.esp_seq,
                    e.nome_especialidade as especialidade,
                    COALESCE(c.ser_matricula_atendido, g.pre_ser_matricula, g.ser_matricula) as ser_matricula,
                    COALESCE(c.ser_vin_codigo_atendido, g.pre_ser_vin_codigo, g.ser_vin_codigo) as ser_vin_codigo,
                    COALESCE(pf_atendido.nome, pf_pre.nome, pf_grade.nome) as profissional_nome,
                    u.descricao as local_descricao
                FROM agh.aac_consultas c
                LEFT JOIN agh.aip_pacientes p ON p.codigo = c.pac_codigo
                LEFT JOIN agh.aac_grade_agendamen_consultas g ON g.seq = c.grd_seq
                LEFT JOIN agh.agh_especialidades e ON e.seq = g.esp_seq
                LEFT JOIN agh.aac_situacao_consultas sit ON sit.situacao = c.stc_situacao
                LEFT JOIN agh.rap_servidores s_grade ON s_grade.matricula = g.ser_matricula AND s_grade.vin_codigo = g.ser_vin_codigo
                LEFT JOIN agh.rap_pessoas_fisicas pf_grade ON pf_grade.codigo = s_grade.pes_codigo
                LEFT JOIN agh.rap_servidores s_pre ON s_pre.matricula = g.pre_ser_matricula AND s_pre.vin_codigo = g.pre_ser_vin_codigo
                LEFT JOIN agh.rap_pessoas_fisicas pf_pre ON pf_pre.codigo = s_pre.pes_codigo
                LEFT JOIN agh.rap_servidores s_atendido ON s_atendido.matricula = c.ser_matricula_atendido AND s_atendido.vin_codigo = c.ser_vin_codigo_atendido
                LEFT JOIN agh.rap_pessoas_fisicas pf_atendido ON pf_atendido.codigo = s_atendido.pes_codigo
                LEFT JOIN agh.agh_unidades_funcionais u ON u.seq = g.usl_unf_seq
                WHERE c.stc_situacao = 'M'  -- Status atual é MARCADA
                    AND c.pac_codigo IS NOT NULL  -- Tem paciente
                    AND COALESCE(c.dthr_marcacao, c.alterado_em) >= NOW() - INTERVAL '${minutes} minutes'  -- Marcada recentemente
                ORDER BY COALESCE(c.dthr_marcacao, c.alterado_em) DESC
                LIMIT ${limit} OFFSET ${offset};
            `;

            return await client.query(query);
        });

        console.log(`[AGHUse] ✅ ${result.rows.length} consultas marcadas encontradas (offset: ${offset}, limit: ${limit})`);
        return result.rows;

    } catch (error) {
        console.error('[AGHUse] ❌ Erro ao buscar consultas recentes:', error.message);
        throw error;
    }
}

/**
 * Busca consultas desmarcadas recentemente
 *
 * IMPORTANTE: No AGHUse, não existe campo dthr_desmarcacao.
 * Quando uma consulta é desmarcada, a situação muda de 'M' para 'L' na tabela de histórico.
 * Buscamos na tabela aac_consultas_jn (histórico) consultas que mudaram de M para L.
 */
async function fetchRecentlyCancelledAppointments(minutes = 60, options = {}) {
    try {
        const limit = options.limit || 100;
        const offset = options.offset || 0;

        const result = await executeWithRetry(async (client) => {
            // BUSCA HÍBRIDA: Consultas que foram MARCADAS (journal) mas agora estão LIVRES (tabela principal)
            // DESMARCAÇÃO = tinha 'M' no journal + agora está 'L' na tabela + alterado_em recente
            const query = `
                SELECT DISTINCT ON (c.numero)
                    c.numero as consulta_numero,
                    c.dt_consulta as data_hora_consulta,
                    jn_marcacao.jn_date_time as data_hora_marcacao,
                    c.alterado_em as data_hora_desmarcacao,
                    jn_marcacao.pac_codigo as pac_codigo,
                    c.stc_situacao as situacao_codigo,
                    CASE
                        WHEN c.stc_situacao = 'M' THEN 'MARCADA'
                        WHEN c.stc_situacao = 'L' THEN 'LIVRE'
                        WHEN c.stc_situacao = 'G' THEN 'GERADA'
                        ELSE c.stc_situacao
                    END as situacao_descricao,
                    COALESCE(p.prontuario::text, '') as prontuario,
                    p.nome as nome_paciente,
                    COALESCE(p.cpf::text, '') as cpf_paciente,
                    -- Telefones com DDD concatenado
                    CASE
                        WHEN p.fone_residencial IS NOT NULL AND p.ddd_fone_residencial IS NOT NULL
                        THEN CONCAT(p.ddd_fone_residencial::text, p.fone_residencial::text)
                        WHEN p.fone_residencial IS NOT NULL
                        THEN p.fone_residencial::text
                        ELSE NULL
                    END as telefone_fixo,
                    CASE
                        WHEN p.fone_celular IS NOT NULL AND p.ddd_fone_celular IS NOT NULL
                        THEN CONCAT(p.ddd_fone_celular::text, p.fone_celular::text)
                        WHEN p.fone_celular IS NOT NULL
                        THEN p.fone_celular::text
                        ELSE NULL
                    END as telefone_celular,
                    CASE
                        WHEN p.fone_recado IS NOT NULL AND p.ddd_fone_recado IS NOT NULL
                        THEN CONCAT(p.ddd_fone_recado::text, p.fone_recado::text)
                        WHEN p.fone_recado IS NOT NULL
                        THEN p.fone_recado::text
                        ELSE NULL
                    END as telefone_adicional,
                    g.esp_seq,
                    e.nome_especialidade as especialidade,
                    COALESCE(c.ser_matricula_atendido, g.pre_ser_matricula, g.ser_matricula) as ser_matricula,
                    COALESCE(c.ser_vin_codigo_atendido, g.pre_ser_vin_codigo, g.ser_vin_codigo) as ser_vin_codigo,
                    COALESCE(pf_atendido.nome, pf_pre.nome, pf_grade.nome) as profissional_nome,
                    u.descricao as local_descricao
                FROM agh.aac_consultas c
                -- Buscar última MARCAÇÃO no journal
                INNER JOIN LATERAL (
                    SELECT
                        jn.jn_date_time,
                        jn.pac_codigo,
                        jn.jn_user
                    FROM agh.aac_consultas_jn jn
                    WHERE jn.numero = c.numero
                        AND jn.stc_situacao = 'M'  -- Foi MARCADA
                        AND jn.jn_operation = 'UPD'
                        AND jn.pac_codigo IS NOT NULL
                    ORDER BY jn.jn_date_time DESC
                    LIMIT 1
                ) jn_marcacao ON true
                LEFT JOIN agh.aip_pacientes p ON p.codigo = jn_marcacao.pac_codigo
                LEFT JOIN agh.aac_grade_agendamen_consultas g ON g.seq = c.grd_seq
                LEFT JOIN agh.agh_especialidades e ON e.seq = g.esp_seq
                LEFT JOIN agh.rap_servidores s_grade ON s_grade.matricula = g.ser_matricula AND s_grade.vin_codigo = g.ser_vin_codigo
                LEFT JOIN agh.rap_pessoas_fisicas pf_grade ON pf_grade.codigo = s_grade.pes_codigo
                LEFT JOIN agh.rap_servidores s_pre ON s_pre.matricula = g.pre_ser_matricula AND s_pre.vin_codigo = g.pre_ser_vin_codigo
                LEFT JOIN agh.rap_pessoas_fisicas pf_pre ON pf_pre.codigo = s_pre.pes_codigo
                LEFT JOIN agh.rap_servidores s_atendido ON s_atendido.matricula = c.ser_matricula_atendido AND s_atendido.vin_codigo = c.ser_vin_codigo_atendido
                LEFT JOIN agh.rap_pessoas_fisicas pf_atendido ON pf_atendido.codigo = s_atendido.pes_codigo
                LEFT JOIN agh.agh_unidades_funcionais u ON u.seq = g.usl_unf_seq
                WHERE c.stc_situacao IN ('L', 'G')  -- Agora está LIVRE/GERADA
                    AND c.pac_codigo IS NULL  -- Perdeu o paciente
                    AND c.alterado_em >= NOW() - INTERVAL '${minutes} minutes'  -- Desmarcada recentemente
                    AND jn_marcacao.jn_date_time IS NOT NULL  -- Teve marcação no journal
                ORDER BY c.numero, c.alterado_em DESC
                LIMIT ${limit} OFFSET ${offset};
            `;

            return await client.query(query);
        });

        console.log(`[AGHUse] ✅ ${result.rows.length} consultas desmarcadas encontradas (offset: ${offset}, limit: ${limit})`);
        return result.rows;

    } catch (error) {
        console.error('[AGHUse] ❌ Erro ao buscar consultas desmarcadas:', error.message);
        throw error;
    }
}

/**
 * Busca consultas que acontecerão em 72 horas (para envio de lembrete)
 * Retorna consultas marcadas cuja data/hora está entre 71h e 73h no futuro
 */
async function fetchAppointmentsIn72Hours() {
    try {
        const result = await executeWithRetry(async (client) => {
            const query = `
                SELECT
                    c.numero as consulta_numero,
                    c.dt_consulta as data_hora_consulta,
                    c.dthr_marcacao as data_hora_marcacao,
                    c.pac_codigo,
                    c.stc_situacao as situacao_codigo,
                    CASE
                        WHEN c.stc_situacao = 'M' THEN 'MARCADA'
                        WHEN c.stc_situacao = 'L' THEN 'LIVRE'
                        WHEN c.stc_situacao = 'G' THEN 'GERADA'
                        ELSE c.stc_situacao
                    END as situacao_descricao,
                    COALESCE(p.prontuario::text, '') as prontuario,
                    p.nome as nome_paciente,
                    COALESCE(p.cpf::text, '') as cpf_paciente,
                    -- Telefones com DDD concatenado
                    CASE
                        WHEN p.fone_residencial IS NOT NULL AND p.ddd_fone_residencial IS NOT NULL
                        THEN CONCAT(p.ddd_fone_residencial::text, p.fone_residencial::text)
                        WHEN p.fone_residencial IS NOT NULL
                        THEN p.fone_residencial::text
                        ELSE NULL
                    END as telefone_fixo,
                    CASE
                        WHEN p.fone_celular IS NOT NULL AND p.ddd_fone_celular IS NOT NULL
                        THEN CONCAT(p.ddd_fone_celular::text, p.fone_celular::text)
                        WHEN p.fone_celular IS NOT NULL
                        THEN p.fone_celular::text
                        ELSE NULL
                    END as telefone_celular,
                    CASE
                        WHEN p.fone_recado IS NOT NULL AND p.ddd_fone_recado IS NOT NULL
                        THEN CONCAT(p.ddd_fone_recado::text, p.fone_recado::text)
                        WHEN p.fone_recado IS NOT NULL
                        THEN p.fone_recado::text
                        ELSE NULL
                    END as telefone_adicional,
                    g.esp_seq,
                    e.nome_especialidade as especialidade,
                    COALESCE(c.ser_matricula_atendido, g.pre_ser_matricula, g.ser_matricula) as ser_matricula,
                    COALESCE(c.ser_vin_codigo_atendido, g.pre_ser_vin_codigo, g.ser_vin_codigo) as ser_vin_codigo,
                    COALESCE(pf_atendido.nome, pf_pre.nome, pf_grade.nome) as profissional_nome,
                    u.descricao as local_descricao
                FROM agh.aac_consultas c
                LEFT JOIN agh.aip_pacientes p ON p.codigo = c.pac_codigo
                LEFT JOIN agh.aac_grade_agendamen_consultas g ON g.seq = c.grd_seq
                LEFT JOIN agh.agh_especialidades e ON e.seq = g.esp_seq
                LEFT JOIN agh.rap_servidores s_grade ON s_grade.matricula = g.ser_matricula AND s_grade.vin_codigo = g.ser_vin_codigo
                LEFT JOIN agh.rap_pessoas_fisicas pf_grade ON pf_grade.codigo = s_grade.pes_codigo
                LEFT JOIN agh.rap_servidores s_pre ON s_pre.matricula = g.pre_ser_matricula AND s_pre.vin_codigo = g.pre_ser_vin_codigo
                LEFT JOIN agh.rap_pessoas_fisicas pf_pre ON pf_pre.codigo = s_pre.pes_codigo
                LEFT JOIN agh.rap_servidores s_atendido ON s_atendido.matricula = c.ser_matricula_atendido AND s_atendido.vin_codigo = c.ser_vin_codigo_atendido
                LEFT JOIN agh.rap_pessoas_fisicas pf_atendido ON pf_atendido.codigo = s_atendido.pes_codigo
                LEFT JOIN agh.agh_unidades_funcionais u ON u.seq = g.usl_unf_seq
                WHERE c.stc_situacao = 'M'
                    AND c.pac_codigo IS NOT NULL
                    AND c.dt_consulta >= NOW() + INTERVAL '71 hours'
                    AND c.dt_consulta <= NOW() + INTERVAL '73 hours'
                ORDER BY c.dt_consulta ASC
                LIMIT 200;
            `;

            return await client.query(query);
        });

        console.log(`[AGHUse] ✅ ${result.rows.length} consultas para lembrete 72h encontradas`);
        return result.rows;

    } catch (error) {
        console.error('[AGHUse] ❌ Erro ao buscar consultas 72h:', error.message);
        throw error;
    }
}

/**
 * Fecha o pool de conexões
 */
async function closeConnection() {
    if (pool) {
        await pool.end();
        pool = null;
        console.log('[AGHUse] Pool de conexões fechado');
    }
}

module.exports = {
    testConnection,
    fetchRecentlyScheduledAppointments,
    fetchRecentlyCancelledAppointments,
    fetchAppointmentsIn72Hours,
    closeConnection
};
