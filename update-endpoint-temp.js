// ============================================
// SCRIPT TEMPORÁRIO DE ATUALIZAÇÃO
// Execute: node update-endpoint-temp.js
// ============================================

const express = require('express');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

const app = express();
const PORT = 3001; // Porta diferente para não conflitar

app.use(express.json());

console.log('============================================');
console.log('  Servidor de Atualização Temporário');
console.log('============================================');

app.post('/update', async (req, res) => {
    console.log('[UPDATE] Recebida solicitação de atualização...');

    try {
        const commands = [
            'cd /opt/hmasp/hmasp-chat-v2',
            'git reset --hard',
            'git pull origin main',
            'npm install --production'
        ];

        const command = commands.join(' && ');
        console.log('[UPDATE] Executando:', command);

        const { stdout, stderr } = await execAsync(command, {
            timeout: 120000
        });

        console.log('[UPDATE] ✓ Atualização concluída!');
        console.log('stdout:', stdout);
        if (stderr) console.log('stderr:', stderr);

        res.json({
            success: true,
            message: 'Atualização concluída! Execute: sudo systemctl restart hmasp-chat',
            output: stdout
        });

        // Auto-encerrar após responder
        setTimeout(() => {
            console.log('[UPDATE] Encerrando servidor temporário...');
            process.exit(0);
        }, 2000);

    } catch (error) {
        console.error('[UPDATE] ✗ Erro:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            stderr: error.stderr,
            stdout: error.stdout
        });
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor temporário rodando na porta ${PORT}`);
    console.log(`Para atualizar, execute:`);
    console.log(`  curl -X POST http://localhost:${PORT}/update`);
    console.log('============================================');
});
