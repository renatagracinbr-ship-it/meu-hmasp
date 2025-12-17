/**
 * SERVIDOR PROXY TEMPORÁRIO - AGHUse
 * Redireciona chamadas da porta 3001 para 3000
 * Executa localmente para corrigir problema de configuração
 */

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
const PORT = 3001;
const TARGET = 'http://10.12.40.105:3000';

// CORS para permitir frontend acessar
app.use(cors({
    origin: '*',
    credentials: true
}));

// Proxy todas as requisições para o servidor real
app.use('/', createProxyMiddleware({
    target: TARGET,
    changeOrigin: true,
    ws: true,
    logLevel: 'info',
    onProxyReq: (proxyReq, req, res) => {
        console.log(`[PROXY] ${req.method} ${req.url} -> ${TARGET}${req.url}`);
    },
    onProxyRes: (proxyRes, req, res) => {
        console.log(`[PROXY] ${req.method} ${req.url} <- ${proxyRes.statusCode}`);
    },
    onError: (err, req, res) => {
        console.error('[PROXY] Erro:', err.message);
        res.status(500).json({
            error: 'Proxy error',
            message: err.message
        });
    }
}));

app.listen(PORT, '0.0.0.0', () => {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║        SERVIDOR PROXY TEMPORÁRIO - AGHUse                    ║');
    console.log('╚══════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(`✅ Proxy rodando em: http://localhost:${PORT}`);
    console.log(`🔄 Redirecionando para: ${TARGET}`);
    console.log('');
    console.log('📋 Todas as requisições para porta 3001 vão para porta 3000');
    console.log('');
    console.log('⚠️  TEMPORÁRIO: Rodar até atualizar servidor principal');
    console.log('');
    console.log('Para parar: Ctrl+C');
    console.log('══════════════════════════════════════════════════════════════');
});
