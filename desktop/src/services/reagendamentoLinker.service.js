/**
 * Serviço de Vinculação de Reagendamentos (Seção 8 do Prompt)
 *
 * Responsável por:
 * - Monitorar novas consultas criadas no AGHUse
 * - Vincular novas consultas a pedidos de reagendamento (janela de 72h)
 * - Enviar mensagem MARCACAO_CONFIRMACAO quando reagendamento é vinculado
 * - Atualizar badges (REAGENDAR vermelho → REAGENDADA verde)
 *
 * Heurística de vinculação:
 * 1. Mesmo prontuarioNr OU mesmo pacienteId
 * 2. Mesma especialidade
 * 3. Pedido de reagendamento nas últimas 72h
 * → Então vincular e enviar confirmação
 */

import * as ConversationContext from './conversationContext.service.js';
import * as BadgeManager from './badgeManager.service.js';
import * as DesmarcacaoService from './desmarcacao.service.js';
import * as ChatAudit from './chatAudit.service.js';
import { PhoneNormalizer } from '../utils/phoneNormalizer.js';

// Storage de vinculações realizadas
const linkedReagendamentos = new Map();

/**
 * Tenta vincular nova consulta a pedidos de reagendamento
 *
 * @param {Object} novaConsulta - Nova consulta criada no AGHUse
 * @param {string} novaConsulta.consultaNumero - ID da nova consulta
 * @param {string} novaConsulta.pacCodigo - Código do paciente
 * @param {string} novaConsulta.prontuario - Prontuário do paciente
 * @param {string} novaConsulta.especialidade - Especialidade
 * @param {string} novaConsulta.nomeCompleto - Nome do paciente
 * @param {string} novaConsulta.dataHoraFormatada - Data/hora formatada
 * @param {string} novaConsulta.profissional - Nome do profissional
 * @param {Array} novaConsulta.telefones - Lista de telefones
 * @returns {Promise<Object>} - Resultado da vinculação
 */
export async function tryLinkNovaConsulta(novaConsulta) {
    const result = {
        linked: false,
        consultaId: novaConsulta.consultaNumero,
        pedidoReagendamento: null,
        telefone: null,
        messageSent: false,
        error: null
    };

    try {
        console.log(`[ReagendamentoLinker] Verificando vinculação para nova consulta ${novaConsulta.consultaNumero}`);

        // Busca telefone principal do paciente
        if (!novaConsulta.telefones || novaConsulta.telefones.length === 0) {
            console.log(`[ReagendamentoLinker] Consulta ${novaConsulta.consultaNumero} sem telefones, não pode vincular`);
            return result;
        }

        const telefonePrincipal = novaConsulta.telefones[0].normalized;
        result.telefone = telefonePrincipal;

        // Obtém pedidos de reagendamento pendentes para este telefone
        const pedidosPendentes = ConversationContext.getPendingReagendamentoRequests(
            telefonePrincipal,
            novaConsulta.especialidade
        );

        if (pedidosPendentes.length === 0) {
            console.log(`[ReagendamentoLinker] Nenhum pedido de reagendamento pendente para ${telefonePrincipal} / ${novaConsulta.especialidade}`);
            return result;
        }

        console.log(`[ReagendamentoLinker] Encontrados ${pedidosPendentes.length} pedidos pendentes`);

        // Aplica heurística de vinculação
        const pedidoVinculado = findMatchingPedido(novaConsulta, pedidosPendentes);

        if (!pedidoVinculado) {
            console.log(`[ReagendamentoLinker] Nenhum pedido compatível encontrado`);
            return result;
        }

        console.log(`[ReagendamentoLinker] Pedido compatível encontrado: ${pedidoVinculado.pedidoId}`);

        // Vincula o pedido
        result.linked = true;
        result.pedidoReagendamento = pedidoVinculado;

        // Marca pedido como atendido no contexto
        ConversationContext.fulfillReagendamentoRequest(
            telefonePrincipal,
            pedidoVinculado.pedidoId,
            novaConsulta.consultaNumero
        );

        // ✅ Marca consulta como reagendamento (proteção anti-loop por 48h)
        ConversationContext.markConsultaAsReagendamento(
            telefonePrincipal,
            novaConsulta.consultaNumero,
            pedidoVinculado.consultaOriginalId
        );

        // Processa reagendamento (envia mensagem SEM botões + atualiza badge)
        const processResult = await BadgeManager.processOperatorReagendamento(
            pedidoVinculado.consultaOriginalId,
            novaConsulta,
            telefonePrincipal
        );

        result.messageSent = processResult.messageSent;

        // Registra vinculação
        linkedReagendamentos.set(novaConsulta.consultaNumero, {
            pedidoId: pedidoVinculado.pedidoId,
            consultaOriginalId: pedidoVinculado.consultaOriginalId,
            novaConsultaId: novaConsulta.consultaNumero,
            telefone: telefonePrincipal,
            linkedAt: new Date().toISOString(),
            messageSent: result.messageSent
        });

        // Registra no audit log
        ChatAudit.logReagendamento({
            telefone: telefonePrincipal,
            consultaOriginalId: pedidoVinculado.consultaOriginalId,
            novaConsultaId: novaConsulta.consultaNumero,
            especialidade: novaConsulta.especialidade,
            pedidoTimestamp: pedidoVinculado.timestamp,
            vinculadoTimestamp: new Date().toISOString(),
            vinculadoEm72h: true,
            operadorId: null, // AGHUse não informa operador
            success: true
        });

        console.log(`[ReagendamentoLinker] Reagendamento vinculado com sucesso: ${pedidoVinculado.consultaOriginalId} → ${novaConsulta.consultaNumero}`);

    } catch (error) {
        console.error(`[ReagendamentoLinker] Erro ao vincular consulta ${novaConsulta.consultaNumero}:`, error);
        result.error = error.message;
    }

    return result;
}

/**
 * Encontra pedido de reagendamento compatível usando heurística
 *
 * Critérios (conforme seção 8 do prompt):
 * - Mesmo prontuarioNr OU mesmo pacienteId
 * - Mesma especialidade
 * - Pedido nas últimas 72h
 *
 * OTIMIZADO: Agora usa dados diretos do pedido (mais rápido)
 * Fallback: Se dados não estiverem no pedido, busca na desmarcação (compatibilidade)
 *
 * @param {Object} novaConsulta - Nova consulta
 * @param {Array} pedidosPendentes - Pedidos pendentes
 * @returns {Object|null} - Pedido vinculado ou null
 */
function findMatchingPedido(novaConsulta, pedidosPendentes) {
    // Pedidos já estão filtrados por especialidade e janela de 72h no getPendingReagendamentoRequests

    for (const pedido of pedidosPendentes) {
        // ✅ OTIMIZADO: Tenta match direto com dados do pedido
        if (pedido.prontuarioNr || pedido.pacienteId) {
            const prontuarioMatch = pedido.prontuarioNr &&
                                   novaConsulta.prontuario === pedido.prontuarioNr;
            const pacienteMatch = pedido.pacienteId &&
                                 novaConsulta.pacCodigo === pedido.pacienteId;

            if (prontuarioMatch || pacienteMatch) {
                console.log(`[ReagendamentoLinker] ✅ Match encontrado (dados diretos): pedido ${pedido.pedidoId}`);
                console.log(`[ReagendamentoLinker]    Match por: ${prontuarioMatch ? 'prontuário' : 'paciente ID'}`);
                console.log(`[ReagendamentoLinker]    Prontuário: ${pedido.prontuarioNr || 'N/A'}`);
                return pedido;
            }
        }

        // ⚠️ FALLBACK: Busca na desmarcação (compatibilidade com pedidos antigos)
        else {
            console.log(`[ReagendamentoLinker] ⚠️ Pedido ${pedido.pedidoId} sem dados diretos, buscando na desmarcação...`);
            const desmarcacao = findDesmarcacaoByConsultaId(pedido.consultaOriginalId);

            if (!desmarcacao) {
                console.warn(`[ReagendamentoLinker] ⚠️ Desmarcação ${pedido.consultaOriginalId} não encontrada`);
                continue;
            }

            const prontuarioMatch = novaConsulta.prontuario === desmarcacao.prontuario;
            const pacienteMatch = novaConsulta.pacCodigo === desmarcacao.pacCodigo;

            if (prontuarioMatch || pacienteMatch) {
                console.log(`[ReagendamentoLinker] ✅ Match encontrado (fallback): pedido ${pedido.pedidoId}`);
                return pedido;
            }
        }
    }

    return null;
}

/**
 * Busca desmarcação por consultaId
 *
 * @param {string} consultaId - ID da consulta
 * @returns {Object|null} - Desmarcação encontrada
 */
function findDesmarcacaoByConsultaId(consultaId) {
    const allDesmarcacoes = DesmarcacaoService.getAllDesmarcacoes();
    const matches = allDesmarcacoes.filter(d => d.consultaNumero === consultaId);

    if (matches.length === 0) {
        return null;
    }

    // Retorna a mais recente
    return matches.sort((a, b) => new Date(b.criadoEm) - new Date(a.criadoEm))[0];
}

/**
 * Tenta vincular nova consulta a desmarcação recente (SEM pedido via Chat)
 *
 * Caso de uso: Operador desmarcou consulta por indisponibilidade do profissional
 * e agora está marcando nova consulta para o mesmo paciente.
 *
 * Heurística:
 * - Mesmo prontuário
 * - Mesma especialidade
 * - Desmarcação nas últimas 72 horas
 * - Badge "REAGENDAR" vermelho na desmarcação
 *
 * @param {Object} novaConsulta - Nova consulta criada no AGHUse
 * @returns {Promise<Object>} - Resultado da vinculação
 */
export async function tryLinkToRecentDesmarcacao(novaConsulta) {
    const result = {
        linked: false,
        desmarcacaoId: null,
        consultaOriginalId: null,
        badgeUpdated: false,
        messageSent: false
    };

    try {
        console.log(`[ReagendamentoLinker] Verificando desmarcações recentes para consulta ${novaConsulta.consultaNumero}`);

        // Busca todas as desmarcações
        const allDesmarcacoes = DesmarcacaoService.getAllDesmarcacoes();

        // Filtra desmarcações recentes (últimas 72h)
        const now = new Date();
        const last72h = new Date(now.getTime() - 72 * 60 * 60 * 1000);

        const desmarcacoesRecentes = allDesmarcacoes.filter(d => {
            const dataApareceu = new Date(d.dataApareceuDashboard || d.dataDesmarcacao || d.criadoEm);
            return dataApareceu >= last72h;
        });

        if (desmarcacoesRecentes.length === 0) {
            console.log(`[ReagendamentoLinker] Nenhuma desmarcação recente nas últimas 72h`);
            return result;
        }

        console.log(`[ReagendamentoLinker] ${desmarcacoesRecentes.length} desmarcações recentes encontradas`);

        // ✅ CRITÉRIOS PARA REAGENDAMENTO:
        // 1. Mesmo prontuário (mesma pessoa)
        // 2. Mesma especialidade
        // 3. Dentro de 72 horas
        // 4. ⚠️ OBRIGATÓRIO: Paciente SOLICITOU reagendamento via Chat (status = 'reagendamento')
        //
        // REGRA DE NEGÓCIO: Só é considerado reagendamento se o paciente respondeu "1"
        // (Solicito reagendamento) via Chat. Consultas marcadas/desmarcadas pelo
        // sistema, internet ou balcão NÃO são consideradas reagendamentos!
        const matchedDesmarcacao = desmarcacoesRecentes.find(d => {
            // Data de desmarcação
            const dataDesmarcacao = new Date(d.dataDesmarcacao || d.dataApareceuDashboard || d.criadoEm);

            // Data de marcação da nova consulta (quando foi criada no AGHUse)
            const dataMarcacaoNova = new Date(novaConsulta.dataMarcacao || novaConsulta.criadoEm || Date.now());

            // ⚠️ CRÍTICO: Verifica se paciente SOLICITOU reagendamento via Chat
            const pacienteSolicitouReagendamento = d.status === 'reagendamento';

            return d.prontuario === novaConsulta.prontuario &&  // ✅ MESMO PACIENTE
                   d.especialidade === novaConsulta.especialidade &&  // ✅ MESMA ESPECIALIDADE
                   pacienteSolicitouReagendamento &&  // ✅ PACIENTE SOLICITOU VIA CHAT
                   !d.reagendada &&  // ✅ Ainda não foi reagendada
                   dataMarcacaoNova > dataDesmarcacao;  // ✅ Nova consulta marcada DEPOIS da desmarcação
        });

        if (!matchedDesmarcacao) {
            console.log(`[ReagendamentoLinker] 📋 Desmarcações recentes encontradas:`, desmarcacoesRecentes.length);
            console.log(`[ReagendamentoLinker] 🔍 Procurando por: prontuário=${novaConsulta.prontuario}, especialidade=${novaConsulta.especialidade}`);
            desmarcacoesRecentes.forEach(d => {
                console.log(`[ReagendamentoLinker]    - Consulta ${d.consultaNumero}: prontuário=${d.prontuario}, especialidade=${d.especialidade}, status=${d.status}, reagendada=${d.reagendada}`);
            });
            console.log(`[ReagendamentoLinker] ❌ Nenhuma desmarcação com solicitação de reagendamento (status='reagendamento') encontrada`);
            return result;
        }

        // ✅ MATCH ENCONTRADO - Paciente solicitou reagendamento via Chat (respondeu "1")!
        console.log(`[ReagendamentoLinker] ✅ Match encontrado! Paciente SOLICITOU reagendamento via Chat`);
        console.log(`[ReagendamentoLinker]    Desmarcação ID: ${matchedDesmarcacao.id}`);
        console.log(`[ReagendamentoLinker]    Consulta original: ${matchedDesmarcacao.consultaNumero}`);
        console.log(`[ReagendamentoLinker]    Nova consulta: ${novaConsulta.consultaNumero}`);
        console.log(`[ReagendamentoLinker]    Paciente: ${novaConsulta.nomeCompleto}`);
        console.log(`[ReagendamentoLinker]    Especialidade: ${novaConsulta.especialidade}`);
        console.log(`[ReagendamentoLinker]    Status: ${matchedDesmarcacao.status}`);

        result.linked = true;
        result.desmarcacaoId = matchedDesmarcacao.id;
        result.consultaOriginalId = matchedDesmarcacao.consultaNumero;

        // ✅ PROCESSA REAGENDAMENTO AUTOMATICAMENTE
        // - Envia mensagem de reagendamento (sem botões) ao paciente
        // - Atualiza badge vermelho "REAGENDAR" → verde "REAGENDADA"
        const telefone = novaConsulta.telefones?.[0]?.normalized;

        if (telefone) {
            const processResult = await BadgeManager.processOperatorReagendamento(
                matchedDesmarcacao.consultaNumero,
                novaConsulta,
                telefone
            );

            result.badgeUpdated = processResult.success;
            result.messageSent = processResult.messageSent;

            console.log(`[ReagendamentoLinker] ✅ Reagendamento processado automaticamente`);
            console.log(`[ReagendamentoLinker]    Badge atualizado: ${result.badgeUpdated}`);
            console.log(`[ReagendamentoLinker]    Mensagem enviada: ${result.messageSent}`);
        } else {
            console.warn(`[ReagendamentoLinker] ⚠️ Paciente sem telefone, não pode enviar mensagem`);
            result.badgeUpdated = false;
            result.messageSent = false;
        }

        // Registra no audit log
        ChatAudit.logReagendamento({
            telefone: telefone || 'sem_telefone',
            consultaOriginalId: matchedDesmarcacao.consultaNumero,
            novaConsultaId: novaConsulta.consultaNumero,
            especialidade: novaConsulta.especialidade,
            pedidoTimestamp: matchedDesmarcacao.dataDesmarcacao || matchedDesmarcacao.criadoEm,
            vinculadoTimestamp: new Date().toISOString(),
            vinculadoEm72h: true,
            operadorId: 'sistema',
            tipoVinculacao: 'desmarcacao_recente',
            success: true
        });

        console.log(`[ReagendamentoLinker] ✅ Reagendamento vinculado com sucesso (desmarcação recente)`);

    } catch (error) {
        console.error(`[ReagendamentoLinker] Erro ao vincular com desmarcação recente:`, error);
        result.error = error.message;
    }

    return result;
}

/**
 * Inicia monitoramento de novas consultas do AGHUse
 * Verifica a cada 30 segundos se há novas consultas para vincular
 *
 * @param {Function} fetchNewConsultasCallback - Callback que retorna novas consultas do AGHUse
 * @param {number} intervalMs - Intervalo de verificação (padrão: 30 segundos)
 */
export function startMonitoring(fetchNewConsultasCallback, intervalMs = 30000) {
    console.log('[ReagendamentoLinker] Iniciando monitoramento de reagendamentos...');

    // Verifica imediatamente
    checkNewConsultas(fetchNewConsultasCallback);

    // Verifica periodicamente
    setInterval(async () => {
        await checkNewConsultas(fetchNewConsultasCallback);
    }, intervalMs);
}

/**
 * Verifica novas consultas e tenta vincular
 *
 * @param {Function} fetchNewConsultasCallback - Callback para buscar consultas
 */
async function checkNewConsultas(fetchNewConsultasCallback) {
    try {
        const novasConsultas = await fetchNewConsultasCallback();

        if (!novasConsultas || novasConsultas.length === 0) {
            return;
        }

        console.log(`[ReagendamentoLinker] ${novasConsultas.length} novas consultas detectadas`);

        for (const consulta of novasConsultas) {
            // Pula se já foi vinculada
            if (linkedReagendamentos.has(consulta.consultaNumero)) {
                continue;
            }

            // Tenta vincular
            await tryLinkNovaConsulta(consulta);
        }

    } catch (error) {
        console.error('[ReagendamentoLinker] Erro ao verificar novas consultas:', error);
    }
}

/**
 * Obtém estatísticas de vinculações
 *
 * @returns {Object} - Estatísticas
 */
export function getStats() {
    let totalLinked = 0;
    let totalMessagesSent = 0;
    let last24h = 0;

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    linkedReagendamentos.forEach(link => {
        totalLinked++;
        if (link.messageSent) {
            totalMessagesSent++;
        }

        const linkedDate = new Date(link.linkedAt);
        if (linkedDate >= oneDayAgo) {
            last24h++;
        }
    });

    return {
        totalLinked,
        totalMessagesSent,
        last24h,
        successRate: totalLinked > 0
            ? ((totalMessagesSent / totalLinked) * 100).toFixed(2) + '%'
            : '0%'
    };
}

/**
 * Limpa vinculações antigas (mais de 30 dias)
 */
export function cleanOldLinks() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    let removed = 0;

    linkedReagendamentos.forEach((link, consultaId) => {
        const linkedDate = new Date(link.linkedAt);
        if (linkedDate < thirtyDaysAgo) {
            linkedReagendamentos.delete(consultaId);
            removed++;
        }
    });

    if (removed > 0) {
        console.log(`[ReagendamentoLinker] ${removed} vinculações antigas removidas`);
    }

    return removed;
}

export default {
    tryLinkNovaConsulta,
    startMonitoring,
    getStats,
    cleanOldLinks
};
