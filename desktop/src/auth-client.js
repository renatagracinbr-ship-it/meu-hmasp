/**
 * Auth Client - STUB (Autenticação Removida)
 * Mantido apenas para compatibilidade com main.js
 */

export function checkAutoLogin() {
    return null;
}

export function getSession() {
    return null;
}

export function validateSession() {
    return Promise.resolve(false);
}

export function clearSession() {
    // Não faz nada
}

export function login(username, password) {
    return Promise.resolve({ success: false, error: 'Autenticação desabilitada' });
}

export function logout() {
    return Promise.resolve();
}

export function getCurrentUser() {
    return {
        username: 'admin',
        name: 'Administrador',
        role: 'admin'
    };
}

export function getUsers() {
    return Promise.resolve([]);
}

export function getPendingApprovals() {
    return Promise.resolve([]);
}

export function createNewUser() {
    return Promise.resolve({ success: false, error: 'Autenticação desabilitada' });
}

export function approveUser() {
    return Promise.resolve({ success: false, error: 'Autenticação desabilitada' });
}

export function rejectUser() {
    return Promise.resolve({ success: false, error: 'Autenticação desabilitada' });
}

export function updateUserRole() {
    return Promise.resolve({ success: false, error: 'Autenticação desabilitada' });
}

export function updateUserStatus() {
    return Promise.resolve({ success: false, error: 'Autenticação desabilitada' });
}
