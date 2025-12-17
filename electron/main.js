/**
 * HMASP Chat - Aplicativo Desktop
 * Inicia servidor local e abre navegador automaticamente
 */

const { app, BrowserWindow, Tray, Menu, shell } = require('electron');
const path = require('path');
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

// Configuração
const SERVER_PORT = 3001;
const FRONTEND_URL = 'https://hmasp-chat.web.app';

let tray = null;
let serverInstance = null;

// Pool de conexão PostgreSQL AGHUse
const pool = new Pool({
    host: '10.12.40.219',
    port: 5432,
    database: 'dbaghu',
    user: 'birm_read',
    password: 'birm@read',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

/**
 * Inicia servidor Express local
 */
function startLocalServer() {
    const server = express();

    server.use(cors());
    server.use(express.json());

    // Health check
    server.get('/api/health', (req, res) => {
        res.json({
            status: 'ok',
            message: 'HMASP Chat Desktop - Servidor Local',
            timestamp: new Date().toISOString()
        });
    });

    // Testa conexão com AGHUse
    server.get('/api/aghuse/test-connection', async (req, res) => {
        try {
            const result = await pool.query('SELECT NOW() as current_time, version() as version');
            res.json({
                success: true,
                message: 'Conexão com AGHUse estabelecida',
                data: result.rows[0],
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('[AGHUse] Erro ao testar conexão:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                hint: 'Verifique se está conectado na VPN/Intranet'
            });
        }
    });

    // Busca consultas recentes
    server.get('/api/aghuse/recent-appointments', async (req, res) => {
        try {
            const minutes = parseInt(req.query.minutes) || 5;

            const query = `
                SELECT
                    c.numero as consulta_numero,
                    c.dt_consulta as data_hora_consulta,
                    c.dthr_marcacao as data_hora_marcacao,
                    c.pac_codigo,
                    p.prontuario::text as prontuario,
                    p.nome as nome_paciente,
                    p.cpf::text as cpf_paciente,
                    p.fone_residencial::text as telefone_fixo,
                    p.fone_celular::text as telefone_celular,
                    p.fone_recado as telefone_adicional,
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
                WHERE c.dthr_marcacao >= NOW() - INTERVAL '${minutes} minutes'
                    AND c.pac_codigo IS NOT NULL
                    AND c.stc_situacao = 'M'
                ORDER BY c.dthr_marcacao DESC
                LIMIT 100
            `;

            const result = await pool.query(query);
            console.log(`[AGHUse] ${result.rowCount} consultas marcadas nos últimos ${minutes} minutos`);

            res.json({
                success: true,
                appointments: result.rows
            });
        } catch (error) {
            console.error('[AGHUse] Erro ao buscar consultas:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

    // Inicia servidor
    serverInstance = server.listen(SERVER_PORT, () => {
        console.log('============================================');
        console.log('  HMASP Chat - Servidor Local');
        console.log('============================================');
        console.log(`✓ Servidor: http://localhost:${SERVER_PORT}`);
        console.log('✓ Conectando ao AGHUse: 10.12.40.219:5432');
        console.log('============================================');
    });

    return serverInstance;
}

/**
 * Cria ícone na bandeja do sistema
 */
function createTray() {
    // Criar ícone simples (você pode substituir por um .ico customizado)
    tray = new Tray(path.join(__dirname, 'icon.png'));

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Abrir HMASP Chat',
            click: () => shell.openExternal(FRONTEND_URL)
        },
        { type: 'separator' },
        {
            label: 'Servidor Local',
            click: () => shell.openExternal(`http://localhost:${SERVER_PORT}/api/health`)
        },
        { type: 'separator' },
        {
            label: 'Sair',
            click: () => {
                app.quit();
            }
        }
    ]);

    tray.setToolTip('HMASP Chat - Servidor Ativo');
    tray.setContextMenu(contextMenu);
}

/**
 * Quando o app estiver pronto
 */
app.whenReady().then(() => {
    console.log('[App] Iniciando HMASP Chat Desktop...');

    // Inicia servidor local
    startLocalServer();

    // Cria ícone na bandeja
    createTray();

    // Aguarda 2 segundos e abre navegador
    setTimeout(() => {
        console.log('[App] Abrindo navegador...');
        shell.openExternal(FRONTEND_URL);
    }, 2000);
});

/**
 * Cleanup ao fechar
 */
app.on('before-quit', () => {
    console.log('[App] Encerrando servidor...');

    if (serverInstance) {
        serverInstance.close();
    }

    if (pool) {
        pool.end();
    }
});

/**
 * Previne fechar completamente no macOS
 */
app.on('window-all-closed', (e) => {
    // Não faz nada - mantém app rodando na bandeja
});

/**
 * Log de erros
 */
process.on('uncaughtException', (error) => {
    console.error('[Erro]', error);
});
