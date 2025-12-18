/**
 * Serviço de Confirmação de Presença
 *
 * Responsável por:
 * - Monitorar consultas marcadas em tempo real
 * - Preparar mensagens de confirmação
 * - Gerenciar status de confirmações
 * - Integrar AGHUse + Chat Próprio (Push Notifications)
 * - Registrar logs de monitoramento
 */

import * as AghuseService from './aghuse.service.js';
import * as MonitoramentoLog from './monitoramentoLog.service.js';
import * as ReagendamentoLinker from './reagendamentoLinker.service.js';
import { PhoneNormalizer } from '../utils/phoneNormalizer.js';
import { generateConfirmacaoId } from '../utils/idGenerator.js';

// URL base da API do servidor
const API_BASE = window.API_BASE_URL || 'http://localhost:3000';

// Status das mensagens (compatível com o sistema anterior)
const STATUS = {
    PENDING: 'pending',
    QUEUED: 'queued',
    SENT: 'sent',
    DELIVERED: 'delivered',
    READ: 'read',
    FAILED: 'failed',
    CONFIRMED: 'confirmed',
    DECLINED: 'declined'
};

// Estado do monitoramento
let monitoringInterval = null;
let lastCheck = null;

// Storage temporário de confirmações
// TODO: Migrar para PostgreSQL no HMASP
const confirmationsStore = new Map();

/**
 * Inicia monitoramento de novas consultas marcadas
 *
 * @param {Function} callback - Função chamada quando novas consultas são encontradas
 * @param {number} intervalMs - Intervalo de verificação em ms (padrão: 30 segundos)
 */
export async function startMonitoring(callback, intervalMs = 30000) {
    if (monitoringInterval) {
        console.log('[Confirmação] Monitoramento já está ativo');
        return;
    }

    console.log('[Confirmação] Iniciando monitoramento de consultas marcadas...');

    // Carrega estado anterior
    const estadoAnterior = await MonitoramentoLog.loadMonitoramentoState();
    console.log('[Confirmação] Estado anterior carregado:', estadoAnterior);

    // Marca como ativo
    await MonitoramentoLog.setMonitoramentoAtivo(true);

    lastCheck = new Date();

    // Verifica imediatamente (incluindo consultas não processadas)
    await checkNewAppointments(callback);

    // Verifica periodicamente
    monitoringInterval = setInterval(async () => {
        await checkNewAppointments(callback);
    }, intervalMs);
}

/**
 * Para o monitoramento
 */
export async function stopMonitoring() {
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;

        // Salva estado
        await MonitoramentoLog.setMonitoramentoAtivo(false);

        console.log('[Confirmação] Monitoramento parado e estado salvo');
    }
}

/**
 * Verifica novas consultas marcadas
 *
 * @param {Function} callback - Função de retorno
 */
async function checkNewAppointments(callback) {
    try {
        // Busca consultas marcadas nos últimos 60 minutos (temporário para testes)
        const appointments = await AghuseService.fetchRecentlyScheduledAppointments(60);

        if (appointments.length > 0) {
            // Filtra consultas que ainda não foram processadas
            const newAppointments = await MonitoramentoLog.getConsultasNaoProcessadas(appointments);

            if (newAppointments.length > 0) {
                console.log(`[Confirmação] ${newAppointments.length} novas consultas encontradas`);

                // ✅ VALIDAÇÃO TEMPORAL: Filtra consultas já passadas
                const agora = new Date();
                const appointmentsFuturos = newAppointments.filter(app => {
                    if (!app.dataConsulta) {
                        console.warn(`[Confirmação] ⚠️ Consulta ${app.consultaNumero} sem data - pulando`);
                        return false;
                    }

                    const dataConsulta = new Date(app.dataConsulta);
                    const margemTresHoras = 3 * 60 * 60 * 1000; // 3 horas em ms

                    if (dataConsulta.getTime() < (agora.getTime() - margemTresHoras)) {
                        console.log(`[Confirmação] ⏭️ Consulta ${app.consultaNumero} já passou (${app.dataHoraFormatada}) - pulando`);
                        return false;
                    }

                    return true;
                });

                if (appointmentsFuturos.length < newAppointments.length) {
                    const passadas = newAppointments.length - appointmentsFuturos.length;
                    console.log(`[Confirmação] 🕐 ${passadas} consultas já passadas foram filtradas`);
                }

                // 🚫 FILTRO: Bloqueia consultas de FISIOTERAPIA na marcação
                // (evita enviar 30+ mensagens quando marcam múltiplas sessões de fisio)
                // Lembretes 72h de fisioterapia NÃO são bloqueados (são enviados normalmente)
                const consultasFiltradasFisio = appointmentsFuturos.filter(apt => {
                    const isFisio = /\bfisio/i.test(apt.especialidade || '');

                    if (isFisio) {
                        console.log(`[Confirmação] 🚫 BLOQUEADO: Fisioterapia "${apt.especialidade}" (consulta ${apt.consultaNumero})`);
                        console.log(`[Confirmação]    ℹ️ Paciente ${apt.nomeCompleto} receberá apenas lembrete 72h antes da sessão`);
                        return false; // Bloqueia
                    }

                    return true; // Permite
                });

                console.log(`[Confirmação] ✅ ${consultasFiltradasFisio.length} consultas após filtros (temporal + fisioterapia)`);

                // Processa cada consulta
                const confirmations = [];

                for (const appointment of consultasFiltradasFisio) {
                    try {
                        // Avisa se não tem telefones (mas continua processando)
                        if (!appointment.telefones || appointment.telefones.length === 0) {
                            console.warn(`[Confirmação] ⚠️ Consulta ${appointment.consultaNumero} - Paciente sem telefones cadastrados no AGHUse`);
                        }

                        // ✅ NOVO: Verifica se é reagendamento de desmarcação recente (últimas 72h)
                        const reagendamentoResult = await ReagendamentoLinker.tryLinkToRecentDesmarcacao(appointment);

                        if (reagendamentoResult.linked) {
                            console.log(`[Confirmação] ✅ Consulta ${appointment.consultaNumero} vinculada a reagendamento`);
                            console.log(`[Confirmação]    Desmarcação: ${reagendamentoResult.consultaOriginalId}`);
                            console.log(`[Confirmação]    Badge atualizado: ${reagendamentoResult.badgeUpdated}`);
                            console.log(`[Confirmação]    Mensagem enviada: ${reagendamentoResult.messageSent}`);
                        }

                        // Cria/atualiza paciente no banco (mesmo sem telefone)
                        // DESABILITADO - Pacientes gerenciados via AGHUse
                        /*
                        if (appointment.cpf) {
                            const telefoneUsado = appointment.telefones?.[0]?.normalized || null;

                            await PacientesService.createOrUpdatePaciente({
                                cpf: appointment.cpf,
                                prontuario: appointment.prontuario,
                                nomeCompleto: appointment.nomeCompleto,
                                telefones: appointment.telefones || []
                            }, telefoneUsado);

                            // Sincroniza agenda de contatos (apenas se tiver telefone)
                            if (telefoneUsado) {
                                try {
                                    await AgendaService.syncContatoComPaciente(appointment.cpf);
                                } catch (error) {
                                    console.warn(`[Confirmação] Erro ao sincronizar agenda para ${appointment.cpf}:`, error.message);
                                }
                            }
                        }
                        */

                        // Prepara confirmação (SEMPRE, mesmo sem telefone)
                        const confirmation = prepareConfirmation(appointment, 'MARCACAO');
                        confirmations.push(confirmation);

                    } catch (error) {
                        console.error(`[Confirmação] Erro ao processar consulta ${appointment.consultaNumero}:`, error);
                    }
                }

                // Retorna para o callback
                if (callback && confirmations.length > 0) {
                    callback(confirmations);
                }

                // Marca consultas como processadas para não reaparecerem
                try {
                    await MonitoramentoLog.marcarConsultasProcessadas(newAppointments);
                } catch (error) {
                    console.error('[Confirmação] Erro ao marcar consultas como processadas:', error);
                }
            }
        }

        lastCheck = new Date();

        // Salva estado
        await MonitoramentoLog.saveMonitoramentoState({
            ultimaVerificacao: lastCheck.toISOString()
        });

    } catch (error) {
        // Reduz poluição de logs - só mostra erro se não for de conexão/timeout
        const isTimeoutError = error.message && (
            error.message.includes('Connection terminated') ||
            error.message.includes('ETIMEDOUT') ||
            error.message.includes('ECONNREFUSED') ||
            error.message.includes('timeout')
        );

        if (!isTimeoutError) {
            console.error('[Confirmação] Erro ao verificar consultas:', error.message || error);
        }
    }
}

/**
 * Prepara confirmação para uma consulta
 *
 * @param {Object} appointment - Dados da consulta
 * @param {string} tipo - Tipo de confirmação ('MARCACAO' ou 'LEMBRETE_72H')
 * @returns {Object} - Dados da confirmação preparada
 */
export function prepareConfirmation(appointment, tipo = 'MARCACAO') {
    // Gera ID único usando o gerador centralizado
    // Formato: conf-{consultaNumero}-{timestamp}-{uuid}
    const confirmationId = generateConfirmacaoId(appointment.consultaNumero, 'confirmacao');

    // Prepara dados do telefone para exibição
    let telefones = [];

    if (appointment.telefones && appointment.telefones.length > 0) {
        // Paciente TEM telefones cadastrados
        telefones = appointment.telefones.map((telefone, index) => {
            return {
                telefone: telefone.normalized,
                telefoneFormatado: PhoneNormalizer.formatForDisplay(telefone.normalized),
                telefoneType: telefone.type,
                telefoneOrigem: telefone.original,
                // Dados para envio via Chat Próprio (não mais WhatsApp)
                dadosMensagem: {
                    nomePaciente: appointment.nomeCompleto,
                    especialidade: appointment.especialidade,
                    dataHora: appointment.dataHoraFormatada,
                    medico: appointment.profissional,
                    local: appointment.local
                },
                tipoTemplate: tipo === 'MARCACAO' ? 'marcacao' : 'lembrete72h',
                status: STATUS.PENDING,
                prioridade: index + 1,
                tentativas: 0,
                logs: []
            };
        });
    } else {
        // Paciente NÃO tem telefones - cria entrada especial para aparecer na lista
        telefones = [{
            telefone: null,
            telefoneFormatado: '⚠️ SEM TELEFONE CADASTRADO',
            telefoneType: 'none',
            telefoneOrigem: null,
            status: 'no_phone',
            prioridade: 1,
            tentativas: 0,
            logs: [{
                timestamp: new Date().toISOString(),
                status: 'no_phone',
                mensagem: 'Paciente sem telefone cadastrado no AGHUse'
            }]
        }];
    }

    // Determina status geral baseado nos telefones
    let statusGeral = 'pending';
    if (telefones.length > 0 && telefones[0].status === 'no_phone') {
        statusGeral = 'no_phone';
    }

    // Cria objeto de confirmação
    const confirmation = {
        id: confirmationId,
        tipo: tipo,
        contexto: 'confirmacao',
        consultaNumero: appointment.consultaNumero,
        pacCodigo: appointment.pacCodigo,
        prontuario: appointment.prontuario,
        nomePaciente: appointment.nomeCompleto,
        nomeExibicao: appointment.nomeExibicao,
        especialidade: appointment.especialidade,
        dataConsulta: appointment.dataConsulta,
        dataHoraFormatada: appointment.dataHoraFormatada,
        dataMarcacao: appointment.dataMarcacao,
        profissional: appointment.profissional,
        local: appointment.local,
        telefones: telefones,
        mensagens: telefones,  // Alias para compatibilidade
        statusGeral: statusGeral,
        dataApareceuDashboard: new Date().toISOString(),
        criadoEm: new Date(),
        atualizadoEm: new Date(),
        criadoPor: 'sistema'
    };

    // Armazena no store
    confirmationsStore.set(confirmationId, confirmation);

    return confirmation;
}

/**
 * Envia mensagem de confirmação via Chat Próprio (Push Notification + Chat)
 *
 * @param {Object} confirmation - Dados da confirmação
 * @param {number} telefoneIndex - Índice do telefone (0 = principal, ignorado no Chat Próprio)
 * @returns {Promise<Object>} - Resultado do envio
 */
export async function sendConfirmationMessage(confirmation, telefoneIndex = 0) {
    // No Chat Próprio, não dependemos de telefone - usamos prontuário
    if (!confirmation.prontuario) {
        console.warn(`[Confirmação] ⚠️ Consulta ${confirmation.consultaNumero} sem prontuário`);
        return {
            success: false,
            skipped: true,
            reason: 'sem_prontuario',
            message: 'Consulta sem prontuário',
            timestamp: new Date().toISOString()
        };
    }

    // Determina endpoint baseado no tipo
    let endpoint;
    if (confirmation.reagendamentoDe) {
        // É reagendamento - usa endpoint de marcação com flag
        endpoint = '/api/push/notify-marcacao';
    } else if (confirmation.tipo === 'MARCACAO' || confirmation.tipo === 'marcada') {
        endpoint = '/api/push/notify-marcacao';
    } else {
        // LEMBRETE_72H
        endpoint = '/api/push/notify-lembrete72h';
    }

    const payload = {
        prontuario: confirmation.prontuario,
        pacienteNome: confirmation.nomePaciente,
        consultaId: confirmation.consultaNumero,
        consultaInfo: {
            especialidade: confirmation.especialidade,
            dataHora: confirmation.dataHoraFormatada,
            profissional: confirmation.profissional,
            local: confirmation.local
        }
    };

    // Se for reagendamento, adiciona flag
    if (confirmation.reagendamentoDe) {
        payload.isReagendamento = true;
        payload.consultaOriginalId = confirmation.reagendamentoDe;
    }

    console.log(`[Confirmação] Enviando via Chat Próprio: ${endpoint}`);
    console.log(`[Confirmação] Paciente: ${confirmation.nomePaciente}, Consulta: ${confirmation.consultaNumero}`);

    try {
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || `HTTP ${response.status}`);
        }

        console.log(`[Confirmação] ✅ Mensagem enviada via Chat Próprio`);

        // Atualiza status
        const telefone = confirmation.telefones[telefoneIndex];
        if (telefone) {
            telefone.status = STATUS.SENT;
            telefone.tentativas++;
            telefone.logs.push({
                timestamp: new Date().toISOString(),
                status: STATUS.SENT,
                metodo: 'chat_proprio',
                endpoint: endpoint
            });
        }

        confirmation.statusGeral = STATUS.SENT;
        confirmation.atualizadoEm = new Date();
        confirmationsStore.set(confirmation.id, confirmation);

        // Marca mensagem como enviada no SQLite
        try {
            const ConsultasSQLite = await import('./consultasSQLite.service.js');
            await ConsultasSQLite.markMensagemEnviada(confirmation.consultaNumero, `chat-${Date.now()}`);
            console.log(`[Confirmação] ✅ Flag mensagem_enviada atualizada no banco`);
        } catch (error) {
            console.error('[Confirmação] ⚠️ Erro ao atualizar flag mensagem_enviada:', error);
        }

        // Registra no log
        await MonitoramentoLog.registrarConsultaProcessada(
            confirmation.consultaNumero,
            'enviado',
            {
                paciente: confirmation.nomePaciente,
                prontuario: confirmation.prontuario,
                metodo: 'chat_proprio'
            }
        );

        return {
            success: true,
            method: 'chat_proprio',
            pushSent: result.pushSent || false,
            chatMessageSent: result.chatMessageSent || false,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('[Confirmação] ❌ Erro ao enviar via Chat Próprio:', error);

        // Atualiza status para falha
        const telefone = confirmation.telefones[telefoneIndex];
        if (telefone) {
            telefone.status = STATUS.FAILED;
            telefone.logs.push({
                timestamp: new Date().toISOString(),
                status: STATUS.FAILED,
                metodo: 'chat_proprio',
                erro: error.message
            });
        }

        confirmation.statusGeral = STATUS.FAILED;
        confirmation.atualizadoEm = new Date();
        confirmationsStore.set(confirmation.id, confirmation);

        // Registra falha no log
        await MonitoramentoLog.registrarConsultaProcessada(
            confirmation.consultaNumero,
            'falha',
            {
                paciente: confirmation.nomePaciente,
                prontuario: confirmation.prontuario,
                erro: error.message
            }
        );

        throw error;
    }
}

/**
 * Registra resposta do paciente
 *
 * @param {string} confirmationId - ID da confirmação
 * @param {string} botaoId - ID do botão clicado ('confirmar' ou 'nao_poderei')
 * @returns {Object} - Confirmação atualizada
 */
export function registerResponse(confirmationId, botaoId) {
    const confirmation = confirmationsStore.get(confirmationId);

    if (!confirmation) {
        throw new Error('Confirmação não encontrada');
    }

    // Atualiza status baseado na resposta
    const novoStatus = botaoId === 'confirmar'
        ? STATUS.CONFIRMED
        : STATUS.DECLINED;

    // Atualiza todas as mensagens
    confirmation.mensagens.forEach(mensagem => {
        if (mensagem.status === STATUS.SENT ||
            mensagem.status === STATUS.DELIVERED ||
            mensagem.status === STATUS.READ) {

            mensagem.status = novoStatus;
            mensagem.logs.push({
                timestamp: new Date().toISOString(),
                consultaNumero: confirmation.consultaNumero,
                status: novoStatus,
                botaoClicado: botaoId
            });
        }
    });

    confirmation.statusGeral = novoStatus;
    confirmation.atualizadoEm = new Date();

    // Atualiza no store
    confirmationsStore.set(confirmationId, confirmation);

    console.log(`[Confirmação] Resposta registrada: ${botaoId} para consulta ${confirmation.consultaNumero}`);

    return confirmation;
}

/**
 * Obtém todas as confirmações
 *
 * @returns {Array} - Lista de confirmações
 */
export function getAllConfirmations() {
    return Array.from(confirmationsStore.values());
}

/**
 * Obtém confirmação por ID
 *
 * @param {string} confirmationId - ID da confirmação
 * @returns {Object|null} - Confirmação encontrada
 */
export function getConfirmation(confirmationId) {
    return confirmationsStore.get(confirmationId) || null;
}

/**
 * Limpa confirmações antigas (mais de 7 dias)
 */
export function cleanOldConfirmations() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    let removidos = 0;

    confirmationsStore.forEach((confirmation, id) => {
        if (confirmation.criadoEm < sevenDaysAgo) {
            confirmationsStore.delete(id);
            removidos++;
        }
    });

    if (removidos > 0) {
        console.log(`[Confirmação] ${removidos} confirmações antigas removidas`);
    }
}

export default {
    startMonitoring,
    stopMonitoring,
    prepareConfirmation,
    sendConfirmationMessage,
    registerResponse,
    getAllConfirmations,
    getConfirmation,
    cleanOldConfirmations
};
