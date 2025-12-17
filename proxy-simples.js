/**
 * PROXY SIMPLES - AGHUse
 * Redireciona porta 3001 -> 3000
 * SEM dependências extras
 */

const http = require('http');
const https = require('https');
const url = require('url');

const PORT = 3001;
const TARGET_HOST = '10.12.40.105';
const TARGET_PORT = 3000;

const server = http.createServer((req, res) => {
    console.log(`[PROXY] ${req.method} ${req.url}`);

    // Headers CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // Preflight OPTIONS
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Configurar proxy
    const options = {
        hostname: TARGET_HOST,
        port: TARGET_PORT,
        path: req.url,
        method: req.method,
        headers: {
            ...req.headers,
            host: `${TARGET_HOST}:${TARGET_PORT}`
        }
    };

    // Fazer requisição para servidor real
    const proxyReq = http.request(options, (proxyRes) => {
        console.log(`[PROXY] <- ${proxyRes.statusCode}`);

        // Copiar headers
        Object.keys(proxyRes.headers).forEach(key => {
            res.setHeader(key, proxyRes.headers[key]);
        });

        // Adicionar CORS novamente (sobrescreve se necessário)
        res.setHeader('Access-Control-Allow-Origin', '*');

        res.writeHead(proxyRes.statusCode);
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
        console.error('[PROXY] Erro:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            error: 'Proxy error',
            message: err.message
        }));
    });

    // Pipe do body da requisição
    req.pipe(proxyReq);
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║           PROXY AGHUse - SOLUÇÃO TEMPORÁRIA                  ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`✅ Rodando em: http://localhost:${PORT}`);
    console.log(`🔄 Redirecionando para: http://${TARGET_HOST}:${TARGET_PORT}`);
    console.log('');
    console.log('💡 Agora o frontend consegue acessar AGHUse via porta 3001');
    console.log('');
    console.log('📱 Recarregue a página do sistema e o AGHUse vai conectar!');
    console.log('');
    console.log('⏹️  Para parar: Ctrl+C');
    console.log('══════════════════════════════════════════════════════════════');
});
