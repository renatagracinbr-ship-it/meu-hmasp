/**
 * Serviço de Gerenciamento de Pacientes - STUB
 * Firebase completamente removido do projeto.
 * Mantido apenas para compatibilidade com código existente.
 */

export async function createOrUpdatePaciente(dadosPaciente, telefoneUsado = null) {
    // STUB: Firebase removido
    return null;
}

export async function getPacienteByCpf(cpf) {
    // STUB: Firebase removido
    return null;
}

export async function getTelefonePreferencial(cpf) {
    // STUB: Firebase removido
    return null;
}

export async function listarPacientes(limite = 100) {
    // STUB: Firebase removido
    return [];
}

export async function updateHistoricoConsulta(cpf, consultaData) {
    // STUB: Firebase removido
    return;
}

export default {
    createOrUpdatePaciente,
    getPacienteByCpf,
    getTelefonePreferencial,
    listarPacientes,
    updateHistoricoConsulta
};
