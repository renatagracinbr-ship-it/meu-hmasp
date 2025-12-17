/**
 * Serviço de Desmarcação de Consultas
 *
 * Responsável por:
 * - Monitorar consultas desmarcadas em tempo real
 * - Gerenciar lista de consultas desmarcadas
 * - Preparar dados para exibição
 * - Integrar AGHUse + WhatsApp
 */

import * as AghuseService from './aghuse.service.js';
import * as WhatsAppTemplates from './whatsappTemplates.service.js';
import * as WhatsAppQueue from './whatsappQueue.service.js';
import * as MonitoramentoLog from './monitoramentoLog.service.js';
import * as DesmarcacaoLinker from './desmarcacaoLinker.service.js';
import { PhoneNormalizer } from '../utils/phoneNormalizer.js';
import { generateConfirmacaoId } from '../utils/idGenerator.js';

// Estado do monitoramento
let monitoringInterval = null;
let lastCheck = null;

// Storage temporário de desmarcações
const desmarcacoesStore = new Map();

/**
 * Inicia monitoramento de consultas desmarcadas
 *
 * @param {Function} callback - Função chamada quando novas desmarcações são encontradas
 * @param {number} intervalMs - Intervalo de verificação em ms (padrão: 30 segundos)
 */
export async function startMonitoring(callback, intervalMs = 30000) {
    if (monitoringInterval) {
        console.log('[Desmarcação] Monitoramento já está ativo');
        return;
    }

    console.log('[Desmarcação] Iniciando monitoramento de consultas desmarcadas...');

    lastCheck = new Date();

    // Verifica imediatamente
    await checkCancelledAppointments(callback);

    // Verifica periodicamente
    monitoringInterval = setInterval(async () => {
        await checkCancelledAppointments(callback);
    }, intervalMs);
}

/**
 * Para o monitoramento
 */
export async function stopMonitoring() {
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
        console.log('[Desmarcação] Monitoramento parado');
    }
}

/**
 * Verifica consultas desmarcadas
 *
 * @param {Function} callback - Função de retorno
 */
async function checkCancelledAppointments(callback) {
    try {
        // Busca consultas desmarcadas nos últimos 60 minutos
        const appointments = await AghuseService.fetchRecentlyCancelledAppointments(60);

        if (appointments.length > 0) {
            console.log(`[Desmarcação] ${appointments.length} consultas desmarcadas encontradas`);

            // ✅ VALIDAÇÃO TEMPORAL: Filtra consultas já passadas
            const agora = new Date();
            const margemTresHoras = 3 * 60 * 60 * 1000; // 3 horas em ms

            const appointmentsFuturos = appointments.filter(app => {
                if (!app.dataConsulta) {
                    console.warn(`[Desmarcação] ⚠️ Consulta ${app.consultaNumero} sem data - pulando`);
                    return false;
                }

                const dataConsulta = new Date(app.dataConsulta);
                const jaPassou = dataConsulta.getTime() < (agora.getTime() - margemTresHoras);

                if (jaPassou) {
                    console.log(`[Desmarcação] ⏭️ Consulta ${app.consultaNumero} já passou (${app.dataHoraFormatada}) - pulando`);
                    return false;
                }

                return true;
            });

            if (appointmentsFuturos.length < appointments.length) {
                const passadas = appointments.length - appointmentsFuturos.length;
                console.log(`[Desmarcação] 🕐 ${passadas} consultas já passadas foram filtradas`);
            }

            // Processa cada consulta
            const desmarcacoes = [];

            for (const appointment of appointmentsFuturos) {
                try {
                    // Gera ID único usando o gerador centralizado
                    // Formato: desm-{consultaNumero}-{timestamp}-{uuid}
                    const desmarcacaoId = generateConfirmacaoId(appointment.consultaNumero, 'desmarcacao');

                    // Prepara desmarcação com ID único
                    const desmarcacao = prepareDesmarcacao(appointment, desmarcacaoId);

                    // ✅ SEMPRE adiciona TODAS as desmarcações no dashboard
                    // Removido filtro que estava impedindo consultas reagendadas de aparecerem
                    console.log(`[Desmarcação] Adicionando consulta ${desmarcacao.consultaNumero} no dashboard`);
                    desmarcacoes.push(desmarcacao);

                } catch (error) {
                    console.error(`[Desmarcação] Erro ao processar consulta ${appointment.consultaNumero}:`, error);
                }
            }

            // Retorna para o callback apenas novas desmarcações
            if (callback && desmarcacoes.length > 0) {
                callback(desmarcacoes);
            }

            // Marca consultas desmarcadas como processadas para não reaparecerem
            try {
                await MonitoramentoLog.marcarConsultasProcessadas(appointments);
            } catch (error) {
                console.error('[Desmarcação] Erro ao marcar consultas como processadas:', error);
            }
        }

        lastCheck = new Date();

    } catch (error) {
        console.error('[Desmarcação] Erro ao verificar consultas desmarcadas:', error);
    }
}

/**
 * Prepara desmarcação para exibição
 *
 * @param {Object} appointment - Dados da consulta
 * @param {string} customId - ID customizado (opcional, se não fornecido gera novo)
 * @returns {Object} - Dados da desmarcação preparada
 */
export function prepareDesmarcacao(appointment, customId = null) {
    // Usa ID customizado ou gera novo ID único
    const desmarcacaoId = customId || generateConfirmacaoId(appointment.consultaNumero, 'desmarcacao');

    // Prepara telefones
    let telefones = [];

    if (appointment.telefones && appointment.telefones.length > 0) {
        telefones = appointment.telefones.map((telefone, index) => {
            // Formata ID do chat WhatsApp
            const chatId = WhatsAppTemplates.formatWhatsAppChatId(telefone.normalized);

            return {
                telefone: telefone.normalized,
                telefoneFormatado: PhoneNormalizer.formatForDisplay(telefone.normalized),
                telefoneType: telefone.type,
                telefoneOrigem: telefone.original,
                chatId: chatId,
                prioridade: index + 1
            };
        });
    } else {
        // Paciente NÃO tem telefones
        telefones = [{
            telefone: null,
            telefoneFormatado: '⚠️ SEM TELEFONE CADASTRADO',
            telefoneType: 'none',
            telefoneOrigem: null,
            chatId: null,
            prioridade: 1
        }];
    }

    // Formata data de desmarcação
    let dataDesmarcacaoFormatada = 'Não informada';
    if (appointment.dataDesmarcacao) {
        const dataDesmarcacao = new Date(appointment.dataDesmarcacao);
        const dia = String(dataDesmarcacao.getDate()).padStart(2, '0');
        const mes = String(dataDesmarcacao.getMonth() + 1).padStart(2, '0');
        const ano = dataDesmarcacao.getFullYear();
        const hora = String(dataDesmarcacao.getHours()).padStart(2, '0');
        const minuto = String(dataDesmarcacao.getMinutes()).padStart(2, '0');
        dataDesmarcacaoFormatada = `${dia}/${mes}/${ano} ${hora}:${minuto}`;
    }

    // Cria objeto de desmarcação
    const desmarcacao = {
        id: desmarcacaoId,
        contexto: 'desmarcacao',  // Contexto para identificação (confirmacao ou desmarcacao)
        consultaNumero: appointment.consultaNumero,
        pacCodigo: appointment.pacCodigo,
        prontuario: appointment.prontuario,
        nomePaciente: appointment.nomeCompleto,
        nomeExibicao: appointment.nomeExibicao,
        especialidade: appointment.especialidade,
        dataConsulta: appointment.dataConsulta,
        dataHoraFormatada: appointment.dataHoraFormatada,
        dataMarcacao: appointment.dataMarcacao,
        dataDesmarcacao: appointment.dataDesmarcacao,
        dataDesmarcacaoFormatada: dataDesmarcacaoFormatada,
        profissional: appointment.profissional || 'Não informado',
        local: appointment.local || null,
        dataApareceuDashboard: new Date().toISOString(),
        telefones: telefones,
        mensagens: telefones,  // Alias para compatibilidade com confirmação
        status: null, // Status da resposta do paciente: null (pendente), 'reagendamento', 'sem_reagendamento', 'paciente_solicitou'
        statusGeral: 'pending',  // Status geral para compatibilidade
        criadoEm: new Date(),
        atualizadoEm: new Date(),
        criadoPor: 'sistema'  // Quem criou a desmarcação
    };

    // Armazena no store
    desmarcacoesStore.set(desmarcacaoId, desmarcacao);

    return desmarcacao;
}

/**
 * Envia mensagem sobre desmarcação
 *
 * IMPORTANTE: Verifica flag shouldSendMessage antes de enviar
 * Se desmarcação veio da aba Confirmação (badge DESMARCAR), NÃO envia mensagem
 *
 * @param {Object} desmarcacao - Dados da desmarcação
 * @param {number} telefoneIndex - Índice do telefone (0 = principal)
 * @returns {Promise<Object>} - Resultado do envio
 */
export async function sendDesmarcacaoMessage(desmarcacao, telefoneIndex = 0) {
    // ✅ Verifica se deve enviar mensagem
    if (desmarcacao.shouldSendMessage === false) {
        console.log(`[Desmarcação] ⚠️ NÃO enviar mensagem para consulta ${desmarcacao.consultaNumero}`);
        console.log(`[Desmarcação]    Motivo: Desmarcação veio da aba Confirmação (paciente já sabe)`);

        return {
            success: true,
            skipped: true,
            reason: 'origem_confirmacao',
            timestamp: new Date().toISOString()
        };
    }

    const telefone = desmarcacao.telefones[telefoneIndex];

    if (!telefone) {
        console.warn(`[Desmarcação] ⚠️ Telefone não encontrado no índice ${telefoneIndex}`);
        return {
            success: false,
            skipped: true,
            reason: 'telefone_nao_encontrado',
            message: 'Telefone não encontrado',
            timestamp: new Date().toISOString()
        };
    }

    if (!telefone.telefone) {
        console.warn(`[Desmarcação] ⚠️ Paciente ${desmarcacao.nomePaciente} não possui telefone cadastrado`);
        return {
            success: false,
            skipped: true,
            reason: 'sem_telefone',
            message: 'Paciente não possui telefone cadastrado',
            timestamp: new Date().toISOString()
        };
    }

    try {
        // Gera mensagem usando template profissional
        const mensagem = WhatsAppTemplates.generateMessage('desmarcacao_notificacao', {
            nomePaciente: desmarcacao.nomePaciente,
            especialidade: desmarcacao.especialidade,
            dataHora: desmarcacao.dataHoraFormatada,
            medico: desmarcacao.profissional
        });

        // Adiciona à fila com proteção anti-banimento
        const queueId = await WhatsAppQueue.addToQueue({
            chatId: telefone.chatId,
            texto: mensagem.texto,
            botoes: mensagem.botoes,
            metadata: {
                confirmacaoId: desmarcacao.id,  // ID único para rastreamento (mesmo campo para unificar)
                contexto: desmarcacao.contexto || 'desmarcacao',  // 'desmarcacao' (garantido com fallback)
                consultaNumero: desmarcacao.consultaNumero,
                paciente: desmarcacao.nomePaciente,
                telefone: telefone.telefone,
                type: 'desmarcacao_notificacao'
            }
        });

        console.log(`[Desmarcação] ✅ Mensagem adicionada à fila: ${queueId}`);

        desmarcacao.atualizadoEm = new Date();
        desmarcacoesStore.set(desmarcacao.id, desmarcacao);

        // 🔧 FIX: Marca mensagem como enviada no SQLite
        try {
            const ConsultasSQLite = await import('./consultasSQLite.service.js');
            // Usa API específica para desmarcações
            const response = await fetch(`${import.meta.env.VITE_DATABASE_BACKEND || 'http://localhost:3001'}/api/desmarcacoes/ativas/${desmarcacao.id}/mensagem-enviada`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ whatsappMessageId: queueId })
            });
            if (response.ok) {
                console.log(`[Desmarcação] ✅ Flag mensagem_enviada atualizada no banco`);
            }
        } catch (error) {
            console.error('[Desmarcação] ⚠️ Erro ao atualizar flag mensagem_enviada:', error);
            // Não quebra o fluxo - mensagem foi adicionada à fila com sucesso
        }

        return {
            success: true,
            skipped: false,
            queueId: queueId,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        console.error('[Desmarcação] Erro ao enviar mensagem:', error);
        throw error;
    }
}

/**
 * Obtém todas as desmarcações
 *
 * @returns {Array} - Lista de desmarcações
 */
export function getAllDesmarcacoes() {
    return Array.from(desmarcacoesStore.values());
}

/**
 * Obtém desmarcação por ID
 *
 * @param {string} desmarcacaoId - ID da desmarcação
 * @returns {Object|null} - Desmarcação encontrada
 */
export function getDesmarcacao(desmarcacaoId) {
    return desmarcacoesStore.get(desmarcacaoId) || null;
}

/**
 * Retorna desmarcações filtradas por status
 * @param {string} status - Status a filtrar ('reagendamento', 'sem_reagendamento', 'paciente_solicitou', ou null para pendentes)
 * @returns {Array} Lista de desmarcações com o status especificado
 */
export function getByStatus(status) {
    return Array.from(desmarcacoesStore.values()).filter(d => d.status === status);
}

/**
 * Registra resposta do paciente sobre desmarcação
 *
 * @param {string} desmarcacaoId - ID da desmarcação
 * @param {string} botaoId - ID do botão clicado ('1', '2' ou '3')
 * @returns {Object} - Desmarcação atualizada
 */
export function registerResponse(desmarcacaoId, botaoId) {
    const desmarcacao = desmarcacoesStore.get(desmarcacaoId);

    if (!desmarcacao) {
        throw new Error('Desmarcação não encontrada');
    }

    // Mapeia botão clicado para status (nova ordem: 1=reagendamento, 2=paciente, 3=sem)
    const statusMap = {
        '1': 'reagendamento',
        '2': 'paciente_solicitou',
        '3': 'sem_reagendamento'
    };

    const novoStatus = statusMap[botaoId];

    if (!novoStatus) {
        throw new Error(`Botão inválido: ${botaoId}`);
    }

    // Atualiza status E tipoDesmarcacao (para exibir badge correto)
    desmarcacao.status = novoStatus;
    desmarcacao.tipoDesmarcacao = novoStatus; // ✅ ESSENCIAL: badge vermelho depende deste campo
    desmarcacao.respostaEm = new Date();
    desmarcacao.atualizadoEm = new Date();

    // Atualiza no store
    desmarcacoesStore.set(desmarcacaoId, desmarcacao);

    // ✅ SALVA NO BANCO SQLite para persistir o tipo_desmarcacao
    import('../services/consultasSQLite.service.js').then(({ updateDesmarcacaoStatus }) => {
        updateDesmarcacaoStatus(desmarcacaoId, novoStatus, novoStatus);
    }).catch(err => {
        console.error('[Desmarcação] Erro ao salvar status no SQLite:', err);
    });

    console.log(`[Desmarcação] Resposta registrada: ${botaoId} (${novoStatus}) para consulta ${desmarcacao.consultaNumero}`);

    return desmarcacao;
}

export default {
    startMonitoring,
    stopMonitoring,
    prepareDesmarcacao,
    sendDesmarcacaoMessage,
    registerResponse,
    getAllDesmarcacoes,
    getByStatus,
    getDesmarcacao
};
