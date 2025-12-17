/**
 * Sistema de Notificações Toast
 * Notificações que aparecem no canto superior direito e fecham automaticamente
 */

let toastContainer = null;

/**
 * Inicializa o container de toasts
 */
function initToastContainer() {
    if (toastContainer) return;

    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 12px;
        pointer-events: none;
    `;
    document.body.appendChild(toastContainer);
}

/**
 * Mostra uma notificação toast
 *
 * @param {Object} options - Opções da notificação
 * @param {string} options.type - Tipo: 'success', 'error', 'warning', 'info'
 * @param {string} options.title - Título da notificação
 * @param {string} options.message - Mensagem da notificação
 * @param {number} options.duration - Duração em ms (padrão: 4000)
 */
export function showToast({ type = 'info', title, message, duration = 4000 }) {
    initToastContainer();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    // Define ícone e cores baseado no tipo
    let icon, bgColor, borderColor;
    switch (type) {
        case 'success':
            icon = '✓';
            bgColor = '#10b981';
            borderColor = '#059669';
            break;
        case 'error':
            icon = '✕';
            bgColor = '#ef4444';
            borderColor = '#dc2626';
            break;
        case 'warning':
            icon = '⚠';
            bgColor = '#f59e0b';
            borderColor = '#d97706';
            break;
        case 'info':
        default:
            icon = 'ℹ';
            bgColor = '#0cb7f2';
            borderColor = '#0891b2';
            break;
    }

    toast.innerHTML = `
        <div class="toast-icon" style="
            background: ${bgColor};
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            font-weight: 700;
            flex-shrink: 0;
        ">${icon}</div>
        <div class="toast-content" style="
            flex: 1;
            min-width: 0;
        ">
            <div class="toast-title" style="
                font-weight: 600;
                font-size: 14px;
                color: #1e293b;
                margin-bottom: 2px;
            ">${title}</div>
            ${message ? `
                <div class="toast-message" style="
                    font-size: 13px;
                    color: #64748b;
                    line-height: 1.4;
                ">${message}</div>
            ` : ''}
        </div>
        <button class="toast-close" style="
            background: none;
            border: none;
            color: #94a3b8;
            cursor: pointer;
            padding: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 4px;
            transition: all 0.2s;
            flex-shrink: 0;
        ">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
        </button>
    `;

    // Estilos do toast
    toast.style.cssText = `
        background: white;
        border-left: 4px solid ${borderColor};
        border-radius: 12px;
        padding: 16px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15), 0 4px 6px rgba(0, 0, 0, 0.1);
        display: flex;
        align-items: flex-start;
        gap: 12px;
        min-width: 320px;
        max-width: 420px;
        pointer-events: auto;
        transform: translateX(450px);
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        opacity: 0;
    `;

    // Botão de fechar
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.background = '#f1f5f9';
        closeBtn.style.color = '#475569';
    });
    closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.background = 'none';
        closeBtn.style.color = '#94a3b8';
    });
    closeBtn.addEventListener('click', () => {
        removeToast(toast);
    });

    // Adiciona ao container
    toastContainer.appendChild(toast);

    // Anima entrada
    requestAnimationFrame(() => {
        toast.style.transform = 'translateX(0)';
        toast.style.opacity = '1';
    });

    // Remove automaticamente após duração
    if (duration > 0) {
        setTimeout(() => {
            removeToast(toast);
        }, duration);
    }

    return toast;
}

/**
 * Remove um toast com animação
 */
function removeToast(toast) {
    toast.style.transform = 'translateX(450px)';
    toast.style.opacity = '0';

    setTimeout(() => {
        if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
        }
    }, 300);
}

/**
 * Atalhos para tipos específicos
 */
export const Toast = {
    success: (title, message, duration) => showToast({ type: 'success', title, message, duration }),
    error: (title, message, duration) => showToast({ type: 'error', title, message, duration }),
    warning: (title, message, duration) => showToast({ type: 'warning', title, message, duration }),
    info: (title, message, duration) => showToast({ type: 'info', title, message, duration })
};

export default {
    showToast,
    Toast
};
