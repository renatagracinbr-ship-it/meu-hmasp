/**
 * Sistema de Autenticação Local - HMASP Chat
 *
 * Sem dependência de Firebase/Google
 * Usa arquivos JSON locais para persistência
 * Suporta auto-login para VM
 */

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcrypt');

// Configuração do bcrypt
const SALT_ROUNDS = 10;

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');
const AUTO_LOGIN_FILE = path.join(DATA_DIR, 'auto-login.json');

// ============================================================================
// Funções auxiliares para ler/escrever arquivos JSON
// ============================================================================

async function readJSON(filePath) {
    try {
        const data = await fs.readFile(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error(`[Auth] Erro ao ler ${filePath}:`, error.message);
        return null;
    }
}

async function writeJSON(filePath, data) {
    try {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error(`[Auth] Erro ao escrever ${filePath}:`, error.message);
        return false;
    }
}

// ============================================================================
// Gerenciamento de Sessões
// ============================================================================

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

async function createSession(username, role) {
    const sessionsData = await readJSON(SESSIONS_FILE);
    if (!sessionsData) return null;

    const token = generateToken();
    const session = {
        token,
        username,
        role,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 dias
        lastActivity: new Date().toISOString()
    };

    sessionsData.sessions.push(session);
    await writeJSON(SESSIONS_FILE, sessionsData);

    return token;
}

async function validateSession(token) {
    const sessionsData = await readJSON(SESSIONS_FILE);
    if (!sessionsData) return null;

    const session = sessionsData.sessions.find(s => s.token === token);
    if (!session) return null;

    // Verifica se expirou
    if (new Date(session.expiresAt) < new Date()) {
        await deleteSession(token);
        return null;
    }

    // Atualiza última atividade
    session.lastActivity = new Date().toISOString();
    await writeJSON(SESSIONS_FILE, sessionsData);

    return session;
}

async function deleteSession(token) {
    const sessionsData = await readJSON(SESSIONS_FILE);
    if (!sessionsData) return false;

    sessionsData.sessions = sessionsData.sessions.filter(s => s.token !== token);
    return await writeJSON(SESSIONS_FILE, sessionsData);
}

// ============================================================================
// Gerenciamento de Usuários
// ============================================================================

async function authenticateUser(username, password) {
    const usersData = await readJSON(USERS_FILE);
    if (!usersData) return null;

    const user = usersData.users.find(u =>
        u.username === username &&
        u.status === 'active'
    );

    if (!user) return null;

    // Verifica senha com bcrypt
    // Suporta tanto senhas antigas (plain text) quanto novas (hash)
    let passwordValid = false;

    if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$')) {
        // Senha já está em hash bcrypt
        passwordValid = await bcrypt.compare(password, user.password);
    } else {
        // Senha ainda em plain text (migração)
        passwordValid = (user.password === password);

        // Se senha correta, migra para hash automaticamente
        if (passwordValid) {
            console.log(`[Auth] Migrando senha do usuário ${username} para bcrypt`);
            user.password = await bcrypt.hash(password, SALT_ROUNDS);
            await writeJSON(USERS_FILE, usersData);
        }
    }

    if (!passwordValid) return null;

    // Atualiza último login
    user.lastLogin = new Date().toISOString();
    await writeJSON(USERS_FILE, usersData);

    return {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role
    };
}

async function requestAccess(username, password, name, requestedRole = 'viewer', deviceInfo = '') {
    const usersData = await readJSON(USERS_FILE);
    if (!usersData) return { success: false, error: 'Erro ao acessar dados' };

    // Verifica se usuário já existe
    const existingUser = usersData.users.find(u => u.username === username);
    if (existingUser) {
        return { success: false, error: 'Usuário já existe' };
    }

    // Verifica se já há pedido pendente
    const pendingRequest = usersData.pendingApprovals.find(p => p.username === username);
    if (pendingRequest) {
        return { success: false, error: 'Já existe um pedido pendente para este usuário' };
    }

    // Hash da senha antes de armazenar
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Cria pedido de acesso
    const request = {
        id: `req_${Date.now()}`,
        username,
        password: hashedPassword,
        name,
        requestedRole,
        deviceInfo,
        requestDate: new Date().toISOString(),
        status: 'pending'
    };

    usersData.pendingApprovals.push(request);
    await writeJSON(USERS_FILE, usersData);

    return { success: true, message: 'Pedido de acesso enviado. Aguarde aprovação do administrador.' };
}

async function getPendingApprovals() {
    const usersData = await readJSON(USERS_FILE);
    if (!usersData) return [];
    return usersData.pendingApprovals || [];
}

async function approveUser(requestId, approvedBy) {
    const usersData = await readJSON(USERS_FILE);
    if (!usersData) return { success: false, error: 'Erro ao acessar dados' };

    const requestIndex = usersData.pendingApprovals.findIndex(p => p.id === requestId);
    if (requestIndex === -1) {
        return { success: false, error: 'Pedido não encontrado' };
    }

    const request = usersData.pendingApprovals[requestIndex];

    // Cria novo usuário
    const newUser = {
        id: `user_${Date.now()}`,
        username: request.username,
        password: request.password,
        name: request.name,
        role: request.requestedRole,
        status: 'active',
        createdAt: new Date().toISOString(),
        approvedBy,
        lastLogin: null
    };

    usersData.users.push(newUser);
    usersData.pendingApprovals.splice(requestIndex, 1);
    await writeJSON(USERS_FILE, usersData);

    return { success: true, message: 'Usuário aprovado com sucesso', user: newUser };
}

async function rejectUser(requestId) {
    const usersData = await readJSON(USERS_FILE);
    if (!usersData) return { success: false, error: 'Erro ao acessar dados' };

    const requestIndex = usersData.pendingApprovals.findIndex(p => p.id === requestId);
    if (requestIndex === -1) {
        return { success: false, error: 'Pedido não encontrado' };
    }

    usersData.pendingApprovals.splice(requestIndex, 1);
    await writeJSON(USERS_FILE, usersData);

    return { success: true, message: 'Pedido rejeitado' };
}

async function getUsers() {
    const usersData = await readJSON(USERS_FILE);
    if (!usersData) return [];

    // Retorna usuários sem a senha
    return usersData.users.map(u => ({
        id: u.id,
        username: u.username,
        name: u.name,
        role: u.role,
        status: u.status,
        createdAt: u.createdAt,
        lastLogin: u.lastLogin
    }));
}

async function updateUserStatus(userId, newStatus) {
    const usersData = await readJSON(USERS_FILE);
    if (!usersData) return { success: false, error: 'Erro ao acessar dados' };

    const user = usersData.users.find(u => u.id === userId);
    if (!user) {
        return { success: false, error: 'Usuário não encontrado' };
    }

    user.status = newStatus;
    await writeJSON(USERS_FILE, usersData);

    return { success: true, message: 'Status atualizado' };
}

async function updateUserRole(userId, newRole) {
    const usersData = await readJSON(USERS_FILE);
    if (!usersData) return { success: false, error: 'Erro ao acessar dados' };

    const user = usersData.users.find(u => u.id === userId);
    if (!user) {
        return { success: false, error: 'Usuário não encontrado' };
    }

    // Valida role
    const validRoles = ['admin', 'operator', 'viewer'];
    if (!validRoles.includes(newRole)) {
        return { success: false, error: 'Perfil inválido' };
    }

    user.role = newRole;
    await writeJSON(USERS_FILE, usersData);

    return { success: true, message: 'Perfil atualizado' };
}

async function createUser(username, password, name, role) {
    const usersData = await readJSON(USERS_FILE);
    if (!usersData) return { success: false, error: 'Erro ao acessar dados' };

    // Verifica se username já existe
    const existingUser = usersData.users.find(u => u.username === username);
    if (existingUser) {
        return { success: false, error: 'Nome de usuário já existe' };
    }

    // Gera novo ID
    const maxId = usersData.users.reduce((max, u) => Math.max(max, parseInt(u.id) || 0), 0);
    const newId = (maxId + 1).toString();

    // Hash da senha antes de armazenar
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Cria novo usuário
    const newUser = {
        id: newId,
        username,
        password: hashedPassword,
        name,
        role,
        status: 'active',
        createdAt: new Date().toISOString(),
        lastLogin: null
    };

    usersData.users.push(newUser);
    await writeJSON(USERS_FILE, usersData);

    return {
        success: true,
        message: 'Usuário criado com sucesso',
        user: {
            id: newUser.id,
            username: newUser.username,
            name: newUser.name,
            role: newUser.role,
            status: newUser.status,
            createdAt: newUser.createdAt
        }
    };
}

// ============================================================================
// Auto-Login (VM)
// ============================================================================

async function checkAutoLogin() {
    const autoLoginData = await readJSON(AUTO_LOGIN_FILE);
    if (!autoLoginData || !autoLoginData.enabled) return null;

    const usersData = await readJSON(USERS_FILE);
    if (!usersData) return null;

    const user = usersData.users.find(u =>
        u.username === autoLoginData.username &&
        u.status === 'active'
    );

    if (!user) return null;

    // Atualiza último login
    autoLoginData.lastLogin = new Date().toISOString();
    await writeJSON(AUTO_LOGIN_FILE, autoLoginData);

    return {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        autoLogin: true
    };
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
    authenticateUser,
    createSession,
    validateSession,
    deleteSession,
    requestAccess,
    getPendingApprovals,
    approveUser,
    rejectUser,
    createUser,
    getUsers,
    updateUserStatus,
    updateUserRole,
    checkAutoLogin
};
