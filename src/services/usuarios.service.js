/**
 * Usuarios Service - STUB
 * Firebase completamente removido do projeto.
 * Autenticação removida - acesso direto sem login.
 */

export async function listarUsuarios() {
    // STUB: Firebase removido
    return { success: true, usuarios: [] };
}

export function observarUsuarios(callback) {
    // STUB: Firebase removido
    return () => {}; // Retorna função vazia para unsubscribe
}

export async function atualizarUsuario(uid, dados) {
    // STUB: Firebase removido
    return { success: false, error: 'Firebase removido' };
}

export default {
    listarUsuarios,
    observarUsuarios,
    atualizarUsuario
};
