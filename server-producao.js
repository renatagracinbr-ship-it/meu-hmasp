/**
 * Servidor de Produção - HMASP Chat
 * Servidor unificado que serve interface e APIs
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ============================================
// SERVIR ARQUIVOS ESTÁTICOS (Frontend)
// ============================================

// Serve arquivos da raiz do projeto
app.use(express.static(path.join(__dirname)));

// Serve especificamente os diretórios necessários
app.use('/src', express.static(path.join(__dirname, 'src')));
app.use('/Arquivos', express.static(path.join(__dirname, 'Arquivos')));

// ============================================
// API DE AUTENTICAÇÃO
// ============================================

const USERS_FILE = path.join(__dirname, 'server', 'data', 'users.json');
const SESSIONS_FILE = path.join(__dirname, 'server', 'data', 'sessions.json');
const AUTO_LOGIN_FILE = path.join(__dirname, 'server', 'data', 'auto-login.json');

// Carrega usuários
function loadUsers() {
    try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('[Auth] Erro ao carregar usuários:', error);
        return { users: [] };
    }
}

// Salva sessões
function saveSessions(sessions) {
    try {
        fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
    } catch (error) {
        console.error('[Auth] Erro ao salvar sessões:', error);
    }
}

// Carrega sessões
function loadSessions() {
    try {
        const data = fs.readFileSync(SESSIONS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return { sessions: [] };
    }
}

// Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const usersData = loadUsers();

    const user = usersData.users.find(u =>
        u.username === username && u.password === password
    );

    if (user) {
        const sessionToken = `session_${Date.now()}_${Math.random().toString(36)}`;
        const sessions = loadSessions();

        sessions.sessions.push({
            token: sessionToken,
            username: user.username,
            role: user.role,
            fullName: user.fullName,
            createdAt: new Date().toISOString()
        });

        saveSessions(sessions);

        res.json({
            success: true,
            token: sessionToken,
            user: {
                username: user.username,
                fullName: user.fullName,
                role: user.role
            }
        });
    } else {
        res.status(401).json({ success: false, message: 'Credenciais inválidas' });
    }
});

// Verificar sessão
app.post('/api/verify-session', (req, res) => {
    const { token } = req.body;
    const sessions = loadSessions();

    const session = sessions.sessions.find(s => s.token === token);

    if (session) {
        res.json({ success: true, user: session });
    } else {
        res.json({ success: false });
    }
});

// ============================================
// API DO BANCO DE DADOS (Monitoramento)
// ============================================

const DB_FILE = path.join(__dirname, 'database', 'monitoramento.json');

// Carrega banco
function loadDB() {
    try {
        const data = fs.readFileSync(DB_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return {
            config: { ativo: false, ultimaVerificacao: null },
            confirmacoes: [],
            desmarcacoes: [],
            lembretes72h: []
        };
    }
}

// Salva banco
function saveDB(data) {
    try {
        const dir = path.dirname(DB_FILE);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('[DB] Erro ao salvar:', error);
    }
}

// Rotas do banco
app.get('/api/database/config', (req, res) => {
    const db = loadDB();
    res.json(db.config || {});
});

app.post('/api/database/config', (req, res) => {
    const db = loadDB();
    db.config = { ...db.config, ...req.body };
    saveDB(db);
    res.json({ success: true, config: db.config });
});

app.get('/api/database/:collection', (req, res) => {
    const { collection } = req.params;
    const db = loadDB();
    res.json(db[collection] || []);
});

app.post('/api/database/:collection', (req, res) => {
    const { collection } = req.params;
    const db = loadDB();

    if (!db[collection]) {
        db[collection] = [];
    }

    db[collection].push(req.body);
    saveDB(db);

    res.json({ success: true, data: req.body });
});

app.put('/api/database/:collection/:id', (req, res) => {
    const { collection, id } = req.params;
    const db = loadDB();

    if (db[collection]) {
        const index = db[collection].findIndex(item => item.id === id);
        if (index !== -1) {
            db[collection][index] = { ...db[collection][index], ...req.body };
            saveDB(db);
            res.json({ success: true, data: db[collection][index] });
        } else {
            res.status(404).json({ success: false, message: 'Item não encontrado' });
        }
    } else {
        res.status(404).json({ success: false, message: 'Coleção não encontrada' });
    }
});

app.delete('/api/database/:collection', (req, res) => {
    const { collection } = req.params;
    const db = loadDB();

    if (db[collection]) {
        db[collection] = [];
        saveDB(db);
        res.json({ success: true });
    } else {
        res.status(404).json({ success: false, message: 'Coleção não encontrada' });
    }
});

// ============================================
// ROTA PRINCIPAL (index.html)
// ============================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Rota fallback para SPA
app.get('*', (req, res) => {
    // Se for requisição de arquivo, retorna 404
    if (req.url.includes('.')) {
        res.status(404).send('File not found');
    } else {
        res.sendFile(path.join(__dirname, 'index.html'));
    }
});

// ============================================
// INICIAR SERVIDOR
// ============================================

app.listen(PORT, () => {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('    HMASP CHAT - SERVIDOR DE PRODUÇÃO');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log(`✅ Servidor rodando em: http://localhost:${PORT}`);
    console.log('');
    console.log('📂 Servindo arquivos de:', __dirname);
    console.log('');
    console.log('🔧 APIs disponíveis:');
    console.log(`   - Login: http://localhost:${PORT}/api/login`);
    console.log(`   - Database: http://localhost:${PORT}/api/database/*`);
    console.log('');
    console.log('📱 Interface principal:');
    console.log(`   http://localhost:${PORT}`);
    console.log('');
    console.log('⚠️  IMPORTANTE:');
    console.log('   - Este servidor NÃO inclui o WhatsApp');
    console.log('   - Para WhatsApp, rode: node server.js');
    console.log('   - Para AGHUse, rode: node server/aghuse-server-local.js');
    console.log('');
    console.log('═══════════════════════════════════════════════════════════════');
});
