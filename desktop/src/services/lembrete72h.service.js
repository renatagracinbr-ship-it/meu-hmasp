/**
 * Serviço de Lembrete 72 Horas
 *
 * Responsável por:
 * - Monitorar consultas que acontecerão em 72 horas
 * - Enviar mensagens de lembrete de confirmação de presença
 * - Reutilizar todo o fluxo de confirmação existente
 * - Integrar AGHUse + WhatsApp + Fila anti-banimento
 */

import * as AghuseService from './aghuse.service.js';
import * as ConfirmacaoService from './confirmacao.service.js';

// Estado do monitoramento
let monitoringInterval = null;
let lastCheck = null;

// Storage de consultas já processadas (para evitar enviar múltiplas vezes)
const processedAppointments = new Set();

/**
 * Inicia monitoramento de consultas que acontecerão em 72 horas
 *
 * @param {Function} callback - Função chamada quando lembretes são enviados
 * @param {number} intervalMs - Intervalo de verificação em ms (padrão: 1 hora)
 */
export async function startMonitoring(callback, intervalMs = 3600000) {
    if (monitoringInterval) {
        console.log('[Lembrete 72h] Monitoramento já está ativo');
        return;
    }

    console.log('[Lembrete 72h] Iniciando monitoramento de lembretes 72h...');

    lastCheck = new Date();

    // Verifica imediatamente
    await checkAppointmentsIn72Hours(callback);

    // Verifica periodicamente (a cada 1 hora por padrão)
    monitoringInterval = setInterval(async () => {
        await checkAppointmentsIn72Hours(callback);
    }, intervalMs);
}

/**
 * Para o monitoramento
 */
export async function stopMonitoring() {
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
        console.log('[Lembrete 72h] Monitoramento parado');
    }
}

/**
 * Verifica consultas que acontecerão em 72 horas
 *
 * @param {Function} callback - Função de retorno
 */
async function checkAppointmentsIn72Hours(callback) {
    try {
        // Busca consultas que acontecerão em 72 horas
        const appointments = await AghuseService.fetchAppointmentsIn72Hours();

        if (appointments.length > 0) {
            console.log(`[Lembrete 72h] ${appointments.length} consultas encontradas para lembrete`);

            // ✅ VALIDAÇÃO TEMPORAL: Filtra consultas já passadas
            const agora = new Date();
            const appointmentsFuturos = appointments.filter(app => {
                if (!app.dataConsulta) {
                    console.warn(`[Lembrete 72h] ⚠️ Consulta ${app.consultaNumero} sem data - pulando`);
                    return false;
                }

                const dataConsulta = new Date(app.dataConsulta);
                const margemTresHoras = 3 * 60 * 60 * 1000; // 3 horas em ms

                if (dataConsulta.getTime() < (agora.getTime() - margemTresHoras)) {
                    console.log(`[Lembrete 72h] ⏭️ Consulta ${app.consultaNumero} já passou (${app.dataHoraFormatada}) - pulando`);
                    return false;
                }

                return true;
            });

            if (appointmentsFuturos.length < appointments.length) {
                const passadas = appointments.length - appointmentsFuturos.length;
                console.log(`[Lembrete 72h] 🕐 ${passadas} consultas já passadas foram filtradas`);
            }

            // Filtra apenas consultas que ainda não foram processadas
            // e exclui MEDICINA DE EMERGÊNCIA (são consultas imediatas, não precisam lembrete)
            const newAppointments = appointmentsFuturos.filter(app => {
                const key = `${app.consultaNumero}_72h`;
                const especialidadeNorm = (app.especialidade || '').toUpperCase().trim();
                const isEmergencia = especialidadeNorm.includes('MEDICINA DE EMERGÊNCIA') ||
                                     especialidadeNorm.includes('MEDICINA DE EMERGENCIA');

                if (isEmergencia) {
                    console.log(`[Lembrete 72h] ⏭️ Pulando consulta ${app.consultaNumero} (MEDICINA DE EMERGÊNCIA - atendimento imediato)`);
                    return false;
                }

                return !processedAppointments.has(key);
            });

            if (newAppointments.length > 0) {
                console.log(`[Lembrete 72h] ${newAppointments.length} novas consultas para processar`);

                // Processa cada consulta
                const confirmations = [];

                for (const appointment of newAppointments) {
                    try {
                        // Prepara confirmação usando o serviço existente
                        const confirmation = ConfirmacaoService.prepareConfirmation(appointment, 'LEMBRETE_72H');

                        // Marca como "lembrete 72h" para diferenciar
                        confirmation.tipoEnvio = 'lembrete_72h';
                        confirmation.dataEnvio = new Date();
                        // contexto já é definido como 'confirmacao' no prepareConfirmation

                        confirmations.push(confirmation);

                        // Marca como processada
                        const key = `${appointment.consultaNumero}_72h`;
                        processedAppointments.add(key);

                        console.log(`[Lembrete 72h] Consulta ${appointment.consultaNumero} preparada para lembrete`);

                    } catch (error) {
                        console.error(`[Lembrete 72h] Erro ao processar consulta ${appointment.consultaNumero}:`, error);
                    }
                }

                // Retorna para o callback
                if (callback && confirmations.length > 0) {
                    callback(confirmations);
                }

                console.log(`[Lembrete 72h] ✅ ${confirmations.length} lembretes preparados`);
            }
        }

        lastCheck = new Date();

    } catch (error) {
        // Reduz poluição de logs - só mostra erro se não for de conexão/timeout
        const isTimeoutError = error.message && (
            error.message.includes('Connection terminated') ||
            error.message.includes('ETIMEDOUT') ||
            error.message.includes('ECONNREFUSED') ||
            error.message.includes('timeout')
        );

        if (!isTimeoutError) {
            console.error('[Lembrete 72h] Erro ao verificar consultas 72h:', error.message || error);
        }
    }
}

/**
 * Limpa histórico de consultas processadas
 * Útil para testes ou reset
 */
export function clearProcessedHistory() {
    const count = processedAppointments.size;
    processedAppointments.clear();
    console.log(`[Lembrete 72h] ${count} consultas removidas do histórico`);
    return count;
}

/**
 * Obtém estatísticas do serviço
 */
export function getStats() {
    return {
        monitoringActive: !!monitoringInterval,
        lastCheck: lastCheck,
        processedCount: processedAppointments.size
    };
}

export default {
    startMonitoring,
    stopMonitoring,
    clearProcessedHistory,
    getStats
};
