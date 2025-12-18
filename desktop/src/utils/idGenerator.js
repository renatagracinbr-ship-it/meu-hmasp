/**
 * Utilitário para Geração de IDs Únicos
 *
 * Gera IDs únicos para rastreamento fim-a-fim de confirmações e desmarcações
 * Formato: {prefix}-{consultaNumero}-{timestamp}-{random}
 *
 * Exemplos:
 * - conf-12345-1733849845000-a1b2c3d4 (confirmação)
 * - desm-67890-1733850000000-e5f6g7h8 (desmarcação)
 */

/**
 * Gera string aleatória hexadecimal (8 caracteres)
 * @returns {string}
 */
function generateRandomHex() {
    return Math.random().toString(16).substring(2, 10).padEnd(8, '0');
}

/**
 * Gera ID único para confirmação ou desmarcação
 *
 * @param {string} consultaNumero - Número da consulta do AGHUse
 * @param {string} tipo - Tipo: 'confirmacao' ou 'desmarcacao'
 * @returns {string} - ID único no formato {prefix}-{consultaNumero}-{timestamp}-{random}
 */
export function generateConfirmacaoId(consultaNumero, tipo = 'confirmacao') {
    const timestamp = Date.now();
    const randomHex = generateRandomHex();
    const prefix = tipo === 'confirmacao' ? 'conf' : 'desm';

    return `${prefix}-${consultaNumero}-${timestamp}-${randomHex}`;
}

/**
 * Valida formato de ID de confirmação
 *
 * @param {string} id - ID a validar
 * @returns {boolean} - true se válido
 */
export function isValidConfirmacaoId(id) {
    if (!id || typeof id !== 'string') {
        return false;
    }

    // Formato: {prefix}-{numero}-{timestamp}-{uuid}
    const pattern = /^(conf|desm)-\d+-\d{13}-[a-f0-9]{8}$/;
    return pattern.test(id);
}

/**
 * Extrai informações do ID
 *
 * @param {string} id - ID da confirmação
 * @returns {Object|null} - Objeto com {tipo, consultaNumero, timestamp, uuid} ou null
 */
export function parseConfirmacaoId(id) {
    if (!isValidConfirmacaoId(id)) {
        return null;
    }

    const parts = id.split('-');

    return {
        tipo: parts[0] === 'conf' ? 'confirmacao' : 'desmarcacao',
        consultaNumero: parts[1],
        timestamp: parseInt(parts[2]),
        uuid: parts[3],
        date: new Date(parseInt(parts[2]))
    };
}

export default {
    generateConfirmacaoId,
    isValidConfirmacaoId,
    parseConfirmacaoId
};
