// ============================================
// SERVIDOR DE ATUALIZAÇÃO REMOTA
// Roda em paralelo ao servidor principal
// Porta 3001 - Acesso via HTTP
// ============================================

const express = require('express');
const { exec } = require('child_process');
const { promisify } = require('util');
const cors = require('cors');
const execAsync = promisify(exec);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

console.log('============================================');
console.log('  HMASP - Servidor de Atualização Remota');
console.log('============================================');
console.log(`Porta: ${PORT}`);
console.log('Aguardando solicitações de atualização...');
console.log('============================================');

// Página principal com instruções
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>HMASP - Servidor de Atualização</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
                    color: white;
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                }
                .container {
                    background: rgba(255, 255, 255, 0.1);
                    backdrop-filter: blur(10px);
                    border-radius: 20px;
                    padding: 40px;
                    max-width: 800px;
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                }
                h1 {
                    font-size: 2.5em;
                    margin-bottom: 20px;
                    text-align: center;
                }
                .status {
                    background: rgba(255, 255, 255, 0.2);
                    padding: 20px;
                    border-radius: 10px;
                    margin: 20px 0;
                }
                .button {
                    background: #4CAF50;
                    color: white;
                    padding: 15px 30px;
                    border: none;
                    border-radius: 10px;
                    font-size: 1.2em;
                    cursor: pointer;
                    width: 100%;
                    margin: 10px 0;
                    transition: all 0.3s;
                }
                .button:hover {
                    background: #45a049;
                    transform: translateY(-2px);
                    box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
                }
                .button:disabled {
                    background: #666;
                    cursor: not-allowed;
                    transform: none;
                }
                .log {
                    background: #000;
                    color: #0f0;
                    padding: 20px;
                    border-radius: 10px;
                    font-family: 'Courier New', monospace;
                    max-height: 400px;
                    overflow-y: auto;
                    display: none;
                    margin-top: 20px;
                }
                .log.show { display: block; }
                .info {
                    margin: 20px 0;
                    line-height: 1.6;
                }
                .code {
                    background: rgba(0, 0, 0, 0.3);
                    padding: 10px;
                    border-radius: 5px;
                    font-family: 'Courier New', monospace;
                    margin: 10px 0;
                    overflow-x: auto;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🚀 Servidor de Atualização HMASP</h1>

                <div class="status">
                    <h2>📊 Status</h2>
                    <p>✅ Servidor de atualização online</p>
                    <p>🔗 Porta: ${PORT}</p>
                    <p>📡 Endpoint: POST /update</p>
                </div>

                <div class="info">
                    <h2>📝 Como Usar</h2>
                    <p>Este servidor permite atualizar o sistema principal remotamente via HTTP.</p>

                    <h3 style="margin-top: 20px;">Via Interface Web:</h3>
                    <button class="button" id="updateBtn" onclick="atualizarSistema()">
                        🔄 Atualizar Sistema Agora
                    </button>

                    <h3 style="margin-top: 20px;">Via Linha de Comando:</h3>
                    <div class="code">
curl -X POST http://10.12.40.105:${PORT}/update
                    </div>
                </div>

                <div class="log" id="log">
                    <div id="logContent">Aguardando atualização...</div>
                </div>
            </div>

            <script>
                function addLog(message) {
                    const log = document.getElementById('log');
                    const content = document.getElementById('logContent');
                    log.classList.add('show');
                    content.innerHTML += message + '\\n';
                    log.scrollTop = log.scrollHeight;
                }

                async function atualizarSistema() {
                    const btn = document.getElementById('updateBtn');
                    btn.disabled = true;
                    btn.textContent = '⏳ Atualizando...';

                    document.getElementById('logContent').innerHTML = '';
                    addLog('🚀 Iniciando atualização...');

                    try {
                        const response = await fetch('/update', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' }
                        });

                        const data = await response.json();

                        if (data.success) {
                            addLog('✅ ' + data.message);
                            addLog('');
                            addLog('📋 Saída do comando:');
                            addLog(data.output);
                            addLog('');
                            addLog('✅ Atualização concluída com sucesso!');
                            addLog('🔄 Sistema principal será reiniciado automaticamente...');
                            addLog('');
                            addLog('🎯 Acesse: http://10.12.40.105:3000');

                            btn.textContent = '✅ Atualização Concluída!';
                            btn.style.background = '#4CAF50';

                            setTimeout(() => {
                                btn.disabled = false;
                                btn.textContent = '🔄 Atualizar Sistema Novamente';
                            }, 5000);
                        } else {
                            addLog('❌ Erro na atualização: ' + data.error);
                            btn.disabled = false;
                            btn.textContent = '🔄 Tentar Novamente';
                        }
                    } catch (error) {
                        addLog('❌ Erro de conexão: ' + error.message);
                        btn.disabled = false;
                        btn.textContent = '🔄 Tentar Novamente';
                    }
                }
            </script>
        </body>
        </html>
    `);
});

// Endpoint de atualização
app.post('/update', async (req, res) => {
    console.log('\n[UPDATE] ⏳ Recebida solicitação de atualização...');
    console.log('[UPDATE] Data/Hora:', new Date().toISOString());

    try {
        // Comandos de atualização
        const commands = [
            'cd /opt/hmasp/hmasp-chat-v2',
            'git fetch origin',
            'git reset --hard origin/main',
            'npm install --production',
            'npm run build'
        ];

        const command = commands.join(' && ');
        console.log('[UPDATE] Executando comandos...');
        console.log('[UPDATE] Comando:', command);

        const { stdout, stderr } = await execAsync(command, {
            timeout: 180000, // 3 minutos
            maxBuffer: 10 * 1024 * 1024 // 10MB
        });

        console.log('[UPDATE] ✅ Atualização concluída!');
        if (stdout) console.log('[UPDATE] stdout:', stdout);
        if (stderr) console.log('[UPDATE] stderr:', stderr);

        // Responder sucesso
        res.json({
            success: true,
            message: 'Atualização concluída! O sistema principal será reiniciado automaticamente pelo systemd.',
            output: stdout,
            timestamp: new Date().toISOString()
        });

        // Reiniciar servidor principal após 3 segundos
        console.log('[UPDATE] Aguardando 3s para reiniciar servidor principal...');
        setTimeout(async () => {
            try {
                console.log('[UPDATE] Reiniciando servidor principal...');
                await execAsync('sudo systemctl restart hmasp-chat');
                console.log('[UPDATE] ✅ Servidor principal reiniciado!');
            } catch (error) {
                console.error('[UPDATE] ⚠️ Erro ao reiniciar (executar manualmente):', error.message);
            }
        }, 3000);

    } catch (error) {
        console.error('[UPDATE] ❌ Erro ao atualizar:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            stderr: error.stderr,
            stdout: error.stdout,
            timestamp: new Date().toISOString()
        });
    }
});

// Status do servidor
app.get('/status', (req, res) => {
    res.json({
        status: 'online',
        service: 'HMASP Update Server',
        port: PORT,
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ healthy: true });
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Servidor online em http://0.0.0.0:${PORT}`);
    console.log(`🌐 Acesso web: http://10.12.40.105:${PORT}`);
    console.log(`📡 Endpoint: POST http://10.12.40.105:${PORT}/update`);
    console.log('============================================');
});

// Tratamento de erros
process.on('uncaughtException', (error) => {
    console.error('[ERRO] uncaughtException:', error);
});

process.on('unhandledRejection', (reason) => {
    console.error('[ERRO] unhandledRejection:', reason);
});
