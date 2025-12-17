/**
 * Serviço de Auditoria e Logs - STUB
 * Firebase completamente removido do projeto.
 * Mantido apenas para compatibilidade com código existente.
 */

export class AuditService {
    static COLLECTION_NAME = 'audit_logs';

    static ACTION_TYPES = {
        MESSAGE_SENT: 'message_sent',
        MESSAGE_RECEIVED: 'message_received',
        MESSAGE_DELIVERED: 'message_delivered',
        MESSAGE_READ: 'message_read',
        MESSAGE_FAILED: 'message_failed',
        WHATSAPP_CONNECTED: 'whatsapp_connected',
        WHATSAPP_DISCONNECTED: 'whatsapp_disconnected',
        WHATSAPP_QR_GENERATED: 'whatsapp_qr_generated',
        WHATSAPP_AUTHENTICATED: 'whatsapp_authenticated',
        CHAT_OPENED: 'chat_opened',
        CHAT_CLOSED: 'chat_closed',
        CHAT_INACTIVITY_CLOSED: 'chat_inactivity_closed',
        CONFIRMATION_SENT: 'confirmation_sent',
        CONFIRMATION_RECEIVED: 'confirmation_received',
        CONFIRMATION_TIMEOUT: 'confirmation_timeout',
        CANCELLATION_SENT: 'cancellation_sent',
        CANCELLATION_ACKNOWLEDGED: 'cancellation_acknowledged',
        NO_SHOW_NOTIFICATION_SENT: 'no_show_notification_sent',
        NO_SHOW_RESPONSE_RECEIVED: 'no_show_response_received',
        SYSTEM_ERROR: 'system_error',
        PHONE_NORMALIZED: 'phone_normalized',
        DATA_ANONYMIZED: 'data_anonymized',
        DATA_DELETED: 'data_deleted',
        USER_LOGIN: 'user_login',
        USER_LOGOUT: 'user_logout'
    };

    static async log(actionType, details = {}, userId = null) {
        // STUB: Firebase removido
        console.debug('[Audit] STUB:', actionType, details);
        return null;
    }

    static async getLogsByUser(userId, limitCount = 50) {
        // STUB: Firebase removido
        return [];
    }

    static async getLogsByAction(actionType, limitCount = 50) {
        // STUB: Firebase removido
        return [];
    }

    static async getLogsByDateRange(startDate, endDate, limitCount = 100) {
        // STUB: Firebase removido
        return [];
    }

    static async getRecentLogs(limitCount = 50) {
        // STUB: Firebase removido
        return [];
    }
}

export default AuditService;
