/**
 * Utilitários para manipulação de datas
 * Fuso horário oficial: America/Sao_Paulo
 * Formato padrão: dd/MM/yyyy HH:mm
 */

export class DateUtils {
    static TIMEZONE = 'America/Sao_Paulo';
    static DISPLAY_FORMAT = 'dd/MM/yyyy HH:mm';

    /**
     * Retorna a data/hora atual no fuso horário de São Paulo
     * @returns {Date}
     */
    static now() {
        return new Date(new Date().toLocaleString('en-US', { timeZone: DateUtils.TIMEZONE }));
    }

    /**
     * Formata uma data para o formato padrão dd/MM/yyyy HH:mm
     * @param {Date|string|number} date - Data a ser formatada
     * @returns {string}
     */
    static format(date) {
        if (!date) return '';

        const d = new Date(date);

        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');

        return `${day}/${month}/${year} ${hours}:${minutes}`;
    }

    /**
     * Formata apenas a data (sem hora)
     * @param {Date|string|number} date
     * @returns {string} - Formato: dd/MM/yyyy
     */
    static formatDate(date) {
        if (!date) return '';

        const d = new Date(date);

        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();

        return `${day}/${month}/${year}`;
    }

    /**
     * Formata apenas a hora
     * @param {Date|string|number} date
     * @returns {string} - Formato: HH:mm
     */
    static formatTime(date) {
        if (!date) return '';

        const d = new Date(date);

        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');

        return `${hours}:${minutes}`;
    }

    /**
     * Converte string no formato dd/MM/yyyy HH:mm para Date
     * @param {string} dateString
     * @returns {Date|null}
     */
    static parse(dateString) {
        if (!dateString) return null;

        const regex = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/;
        const match = dateString.match(regex);

        if (!match) return null;

        const [, day, month, year, hours, minutes] = match;
        return new Date(year, month - 1, day, hours, minutes);
    }

    /**
     * Adiciona minutos a uma data
     * @param {Date} date
     * @param {number} minutes
     * @returns {Date}
     */
    static addMinutes(date, minutes) {
        const result = new Date(date);
        result.setMinutes(result.getMinutes() + minutes);
        return result;
    }

    /**
     * Adiciona horas a uma data
     * @param {Date} date
     * @param {number} hours
     * @returns {Date}
     */
    static addHours(date, hours) {
        const result = new Date(date);
        result.setHours(result.getHours() + hours);
        return result;
    }

    /**
     * Adiciona dias a uma data
     * @param {Date} date
     * @param {number} days
     * @returns {Date}
     */
    static addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    /**
     * Calcula a diferença em minutos entre duas datas
     * @param {Date} date1
     * @param {Date} date2
     * @returns {number}
     */
    static diffInMinutes(date1, date2) {
        const diff = Math.abs(new Date(date1) - new Date(date2));
        return Math.floor(diff / 60000);
    }

    /**
     * Calcula a diferença em horas entre duas datas
     * @param {Date} date1
     * @param {Date} date2
     * @returns {number}
     */
    static diffInHours(date1, date2) {
        return Math.floor(DateUtils.diffInMinutes(date1, date2) / 60);
    }

    /**
     * Verifica se uma data está no passado
     * @param {Date} date
     * @returns {boolean}
     */
    static isPast(date) {
        return new Date(date) < DateUtils.now();
    }

    /**
     * Verifica se uma data está no futuro
     * @param {Date} date
     * @returns {boolean}
     */
    static isFuture(date) {
        return new Date(date) > DateUtils.now();
    }

    /**
     * Retorna timestamp ISO para logs
     * @param {Date} date
     * @returns {string}
     */
    static toISOString(date = null) {
        const d = date ? new Date(date) : DateUtils.now();
        return d.toISOString();
    }

    /**
     * Formata data relativa (ex: "há 5 minutos", "em 2 horas")
     * @param {Date} date
     * @returns {string}
     */
    static formatRelative(date) {
        const now = DateUtils.now();
        const diffMs = new Date(date) - now;
        const diffMins = Math.floor(Math.abs(diffMs) / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        const isPast = diffMs < 0;
        const prefix = isPast ? 'há' : 'em';

        if (diffMins < 1) return 'agora';
        if (diffMins < 60) return `${prefix} ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
        if (diffHours < 24) return `${prefix} ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
        if (diffDays < 7) return `${prefix} ${diffDays} dia${diffDays > 1 ? 's' : ''}`;

        return DateUtils.formatDate(date);
    }
}

export default DateUtils;
