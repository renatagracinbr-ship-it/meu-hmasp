/**
 * Utilitário para normalização de telefones no padrão E.164 (Brasil)
 * Conforme especificado na OS
 */

export class PhoneNormalizer {
    /**
     * Normaliza um número de telefone brasileiro para o formato E.164
     * @param {string} phone - Número de telefone a ser normalizado
     * @returns {object} - { normalized: string, valid: boolean, type: 'mobile'|'landline'|'invalid' }
     */
    static normalize(phone) {
        if (!phone) {
            return { normalized: null, valid: false, type: 'invalid' };
        }

        // Remove todos os caracteres não numéricos
        let cleaned = phone.toString().replace(/\D/g, '');

        // Remove zeros à esquerda
        cleaned = cleaned.replace(/^0+/, '');

        // Se começar com 55 (código do Brasil), remove
        if (cleaned.startsWith('55')) {
            cleaned = cleaned.substring(2);
        }

        // Valida tamanho mínimo (DDD + número)
        if (cleaned.length < 10) {
            return { normalized: null, valid: false, type: 'invalid' };
        }

        // Extrai DDD (2 primeiros dígitos)
        const ddd = cleaned.substring(0, 2);

        // Valida DDD brasileiro (11-99)
        const validDDDs = [
            '11', '12', '13', '14', '15', '16', '17', '18', '19', // SP
            '21', '22', '24', // RJ
            '27', '28', // ES
            '31', '32', '33', '34', '35', '37', '38', // MG
            '41', '42', '43', '44', '45', '46', // PR
            '47', '48', '49', // SC
            '51', '53', '54', '55', // RS
            '61', // DF
            '62', '64', // GO
            '63', // TO
            '65', '66', // MT
            '67', // MS
            '68', // AC
            '69', // RO
            '71', '73', '74', '75', '77', // BA
            '79', // SE
            '81', '87', // PE
            '82', // AL
            '83', // PB
            '84', // RN
            '85', '88', // CE
            '86', '89', // PI
            '91', '93', '94', // PA
            '92', '97', // AM
            '95', // RR
            '96', // AP
            '98', '99'  // MA
        ];

        if (!validDDDs.includes(ddd)) {
            return { normalized: null, valid: false, type: 'invalid' };
        }

        let number = cleaned.substring(2);
        let type = 'landline';

        // Celular: 9 dígitos (9XXXX-XXXX)
        if (number.length === 9) {
            if (!number.startsWith('9')) {
                return { normalized: null, valid: false, type: 'invalid' };
            }
            type = 'mobile';
        }
        // Celular sem o 9: adiciona o nono dígito
        else if (number.length === 8) {
            // Verifica se é celular (começa com 6, 7, 8 ou 9)
            const firstDigit = number.charAt(0);
            if (['6', '7', '8', '9'].includes(firstDigit)) {
                number = '9' + number;
                type = 'mobile';
            } else {
                // É fixo
                type = 'landline';
            }
        }
        // Fixo: 8 dígitos
        else if (number.length === 10 && number.startsWith('9')) {
            // Pode ser um celular com DDD incluído novamente, ajusta
            number = number.substring(2);
            type = 'mobile';
        }
        else {
            return { normalized: null, valid: false, type: 'invalid' };
        }

        // Monta o número no formato E.164
        const normalized = `+55${ddd}${number}`;

        return {
            normalized,
            valid: true,
            type,
            ddd,
            number
        };
    }

    /**
     * Normaliza múltiplos telefones e remove duplicatas
     * @param {Array} phones - Array de objetos { type: 'Celular'|'Adicional'|'Fixo', number: string }
     * @returns {Array} - Array de telefones normalizados e priorizados
     */
    static normalizeMultiple(phones) {
        if (!Array.isArray(phones) || phones.length === 0) {
            return [];
        }

        const normalized = [];
        const seen = new Set();

        // Ordem de prioridade conforme OS
        const priority = { 'Celular': 1, 'Adicional': 2, 'Fixo': 3 };

        // Ordena por prioridade
        const sorted = phones.sort((a, b) => {
            return (priority[a.type] || 99) - (priority[b.type] || 99);
        });

        for (const phone of sorted) {
            const result = PhoneNormalizer.normalize(phone.number);

            if (result.valid && !seen.has(result.normalized)) {
                seen.add(result.normalized);
                normalized.push({
                    original: phone.number,
                    normalized: result.normalized,
                    type: phone.type,
                    phoneType: result.type,
                    ddd: result.ddd,
                    number: result.number
                });
            } else if (!result.valid) {
                // Log quando telefone é descartado
                console.warn('[PhoneNormalizer] ⚠️  Telefone DESCARTADO (inválido)');
                console.warn('[PhoneNormalizer] Telefone original:', phone.number);
                console.warn('[PhoneNormalizer] Tipo:', phone.type);
                console.warn('[PhoneNormalizer] Motivo: Formato inválido ou DDD inválido');
                console.warn('[PhoneNormalizer] ℹ️  AÇÃO NECESSÁRIA: Paciente precisará atualizar telefone no AGHUse');
            } else if (seen.has(result.normalized)) {
                // Log quando telefone é duplicado
                console.log('[PhoneNormalizer] ℹ️  Telefone duplicado (ignorado):', phone.number, '→', result.normalized);
            }
        }

        return normalized;
    }

    /**
     * Formata um número E.164 para exibição amigável
     * @param {string} e164 - Número no formato E.164
     * @returns {string} - Número formatado para exibição
     */
    static formatForDisplay(e164) {
        if (!e164 || !e164.startsWith('+55')) {
            return e164;
        }

        const cleaned = e164.replace('+55', '');
        const ddd = cleaned.substring(0, 2);
        const number = cleaned.substring(2);

        if (number.length === 9) {
            // Celular: (XX) 9XXXX-XXXX
            return `(${ddd}) ${number.substring(0, 5)}-${number.substring(5)}`;
        } else if (number.length === 8) {
            // Fixo: (XX) XXXX-XXXX
            return `(${ddd}) ${number.substring(0, 4)}-${number.substring(4)}`;
        }

        return e164;
    }

    /**
     * Valida se um número é válido para chat (celular)
     * @param {string} phone - Número de telefone
     * @returns {boolean}
     */
    static isWhatsAppValid(phone) {
        const result = PhoneNormalizer.normalize(phone);
        // Chat só funciona em celulares
        return result.valid && result.type === 'mobile';
    }
}

export default PhoneNormalizer;
