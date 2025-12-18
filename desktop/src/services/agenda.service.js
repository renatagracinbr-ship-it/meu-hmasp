/**
 * Serviço de Agenda de Contatos - STUB
 *
 * Firebase removido do projeto.
 * Mantido apenas para compatibilidade com código existente.
 */

// Firebase/Firestore removido - funções stub mantidas para compatibilidade
const COLLECTION_NAME = 'agenda_contatos';

export async function createOrUpdateContato(dadosContato) {
    // STUB: Firebase removido
    console.debug('[Agenda] STUB: createOrUpdateContato - Firebase removido');
    return null;
}

export async function syncContatoComPaciente(cpf) {
    // STUB: Firebase removido
    console.debug('[Agenda] STUB: syncContatoComPaciente - Firebase removido');
    return null;
}

export async function getContatoByCpf(cpf) {
    // STUB: Firebase removido
    return null;
}

export async function searchContatosByNome(nomeBusca) {
    // STUB: Firebase removido
    return [];
}

export async function getContatosByTag(tag) {
    // STUB: Firebase removido
    return [];
}

export async function listarContatos(limite = 100) {
    // STUB: Firebase removido
    return [];
}

export async function deleteContato(cpf) {
    // STUB: Firebase removido
    return;
}

export async function addTag(cpf, tag) {
    // STUB: Firebase removido
    return;
}

export async function removeTag(cpf, tag) {
    // STUB: Firebase removido
    return;
}

export async function syncTodaAgenda() {
    // STUB: Firebase removido
    return { total: 0, sincronizados: 0, erros: 0 };
}

export default {
    createOrUpdateContato,
    syncContatoComPaciente,
    getContatoByCpf,
    searchContatosByNome,
    getContatosByTag,
    listarContatos,
    deleteContato,
    addTag,
    removeTag,
    syncTodaAgenda
};
