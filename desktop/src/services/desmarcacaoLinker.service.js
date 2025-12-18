/**
 * Serviço de Vinculação de Desmarcações (Confirmação → Desmarcação)
 *
 * Responsável por:
 * - Detectar quando consulta desmarcada veio de badge "Desmarcar" da aba Confirmação
 * - Atualizar badge VERMELHO "Desmarcar" → VERDE "Desmarcada"
 * - Bloquear envio de mensagem de desmarcação (paciente já sabe)
 *
 * Fluxo:
 * 1. Paciente responde "2 - Não poderei comparecer" na aba Confirmação
 * 2. Sistema cria badge vermelho "Desmarcar"
 * 3. Operador desmarca consulta no AGHUse
 * 4. Consulta aparece na aba Desmarcação
 * 5. Este serviço detecta que veio da aba Confirmação (mesmo consultaNumero)
 * 6. Badge muda para verde "Desmarcada"
 * 7. NÃO envia mensagem (evita duplicação - paciente já foi avisado)
 *
 * Diferença do reagendamentoLinker:
 * - Mais simples: usa consultaNumero exato (não precisa heurística complexa)
 * - Não envia mensagem (apenas bloqueia envio)
 * - Não precisa janela de tempo (é imediato)
 */

import CONFIG from '../config/backend.config.js';
import * as ConfirmacaoService from './confirmacao.service.js';
import * as BadgeManager from './badgeManager.service.js';
import * as ChatAudit from './chatAudit.service.js';

/**
 * Verifica se desmarcação veio da aba de Confirmação
 *
 * Lógica:
 * 1. Busca todas confirmações com status 'declined' ou 'not_scheduled'
 * 2. IMPORTANTE: Só considera confirmações que tiveram RESPOSTA VIA CHAT
 *    (dataResposta ou badgeStatus definidos)
 * 3. Procura match por consultaNumero (ID exato da consulta)
 * 4. Se match → retorna confirmação vinculada
 *
 * NOTA: Se paciente marcou/desmarcou pela internet sem interagir com Chat,
 * NÃO deve fazer vinculação - nosso sistema só monitora interações via Chat.
 *
 * @param {Object} desmarcacao - Objeto de desmarcação do AGHUse
 * @param {string} desmarcacao.consultaNumero - ID da consulta desmarcada
 * @param {string} desmarcacao.prontuario - Prontuário do paciente
 * @param {string} desmarcacao.nomePaciente - Nome do paciente
 * @param {string} desmarcacao.especialidade - Especialidade
 * @returns {Promise<Object>} - Resultado da vinculação
 */
export async function tryLinkDesmarcacao(desmarcacao) {
    const result = {
        linked: false,
        confirmacaoId: null,
        shouldSendMessage: true,  // Por padrão, envia mensagem
        badgeUpdate: null
    };

    try {
        console.log(`[DesmarcacaoLinker] Verificando vinculação para desmarcação ${desmarcacao.consultaNumero}`);

        // Busca todas as confirmações
        const todasConfirmacoes = ConfirmacaoService.getAllConfirmations();

        // Filtra confirmações com badge "Desmarcar" (status declined ou not_scheduled)
        // IMPORTANTE: Só considera confirmações que tiveram RESPOSTA VIA CHAT
        // Isso evita vincular desmarcações de pacientes que marcaram/desmarcaram pela internet
        const confirmacoesComBadgeDesmarcar = todasConfirmacoes.filter(c => {
            const temStatusDesmarcacao = c.statusGeral === 'declined' || c.statusGeral === 'not_scheduled';
            // ✅ NOVA CONDIÇÃO: Só vincula se houve resposta via Chat
            const houveRespostaChat = c.dataResposta || c.badgeStatus;

            if (temStatusDesmarcacao && !houveRespostaChat) {
                console.log(`[DesmarcacaoLinker] ⏭️ Ignorando confirmação ${c.consultaNumero} - sem resposta Chat`);
            }

            return temStatusDesmarcacao && houveRespostaChat;
        });

        if (confirmacoesComBadgeDesmarcar.length === 0) {
            console.log(`[DesmarcacaoLinker] Nenhuma confirmação com badge "Desmarcar" (e resposta Chat) encontrada`);
            return result;
        }

        console.log(`[DesmarcacaoLinker] ${confirmacoesComBadgeDesmarcar.length} confirmações com badge "Desmarcar" (e resposta Chat) encontradas`);

        // Procura match por consultaNumero (ID exato)
        const matchedConfirmacao = confirmacoesComBadgeDesmarcar.find(c =>
            c.consultaNumero === desmarcacao.consultaNumero
        );

        if (!matchedConfirmacao) {
            console.log(`[DesmarcacaoLinker] Nenhum match encontrado para consulta ${desmarcacao.consultaNumero}`);
            return result;
        }

        // ✅ MATCH ENCONTRADO!
        console.log(`[DesmarcacaoLinker] ✅ Match encontrado! Consulta ${desmarcacao.consultaNumero} veio da aba Confirmação`);
        console.log(`[DesmarcacaoLinker]    Paciente: ${matchedConfirmacao.nomePaciente}`);
        console.log(`[DesmarcacaoLinker]    Status anterior: ${matchedConfirmacao.statusGeral}`);
        console.log(`[DesmarcacaoLinker]    Badge: DESMARCAR (vermelho) → DESMARCADA (verde)`);

        // Atualiza resultado
        result.linked = true;
        result.confirmacaoId = matchedConfirmacao.id;
        result.shouldSendMessage = false;  // ✅ NÃO enviar mensagem (paciente já sabe)
        result.badgeUpdate = {
            oldBadge: BadgeManager.BADGES.DESMARCAR,
            newBadge: BadgeManager.BADGES.DESMARCADA
        };

        // Atualiza confirmação com novo badge
        await updateConfirmacaoBadge(matchedConfirmacao.id, 'desmarcada');

        // ✅ Remove consulta da lista de "processadas" para permitir remarcação
        await desmarcarConsultaComoProcessada(desmarcacao.consultaNumero);

        // Registra no audit log
        ChatAudit.logOperatorAction({
            operadorId: 'aghuse_system',
            operadorNome: 'Sistema AGHUse',
            action: 'desmarcar_aghuse',
            consultaId: desmarcacao.consultaNumero,
            confirmacaoId: matchedConfirmacao.id,
            description: 'Operador desmarcou consulta no AGHUse (vinculada à aba Confirmação)',
            badgeTransition: 'DESMARCAR → DESMARCADA',
            sendMessageToPaciente: false,
            reason: 'Paciente solicitou desmarcação via Chat (resposta 2 - Não poderei comparecer)'
        });

        console.log(`[DesmarcacaoLinker] ✅ Vinculação concluída - NÃO enviar mensagem de desmarcação`);

    } catch (error) {
        console.error(`[DesmarcacaoLinker] Erro ao verificar vinculação:`, error);
        result.error = error.message;
    }

    return result;
}

/**
 * Remove consulta da lista de "processadas" para permitir remarcação
 *
 * Quando uma consulta é desmarcada (especialmente quando veio da aba Confirmação),
 * precisamos remover ela da lista de "processadas" no PostgreSQL.
 * Assim, se o operador remarcar a consulta no AGHUse, ela aparecerá novamente.
 *
 * @param {string} consultaNumero - Número da consulta
 * @returns {Promise<void>}
 */
async function desmarcarConsultaComoProcessada(consultaNumero) {
    try {
        console.log(`[DesmarcacaoLinker] Removendo consulta ${consultaNumero} da lista de processadas...`);

        const response = await fetch(`${CONFIG.DATABASE_BACKEND}/api/database/monitoramento/consulta/${consultaNumero}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            console.warn(`[DesmarcacaoLinker] Erro ao remover consulta da lista de processadas: HTTP ${response.status}`);
            return;
        }

        const data = await response.json();

        if (data.success) {
            console.log(`[DesmarcacaoLinker] ✅ Consulta ${consultaNumero} removida da lista de processadas`);
            console.log(`[DesmarcacaoLinker]    Consulta poderá reaparecer se for remarcada no AGHUse`);
        } else {
            console.warn(`[DesmarcacaoLinker] Falha ao remover consulta: ${data.error || 'Erro desconhecido'}`);
        }

    } catch (error) {
        console.error(`[DesmarcacaoLinker] Erro ao desmarcar consulta como processada:`, error);
        // Não propaga erro - não é crítico
    }
}

/**
 * Atualiza badge da confirmação
 *
 * @param {string} confirmacaoId - ID da confirmação
 * @param {string} newBadgeStatus - Novo status do badge ('desmarcada', 'reagendada')
 * @returns {Promise<void>}
 */
async function updateConfirmacaoBadge(confirmacaoId, newBadgeStatus) {
    try {
        const confirmation = ConfirmacaoService.getConfirmation(confirmacaoId);

        if (!confirmation) {
            console.warn(`[DesmarcacaoLinker] Confirmação ${confirmacaoId} não encontrada`);
            return;
        }

        // Atualiza badge status
        confirmation.badgeStatus = newBadgeStatus;
        confirmation.badgeUpdatedAt = new Date().toISOString();

        // Salva confirmação atualizada
        // Nota: ConfirmacaoService usa Map, então já está atualizado na memória

        console.log(`[DesmarcacaoLinker] ✅ Badge atualizado: ${confirmacaoId} → ${newBadgeStatus}`);

        // ✅ ATUALIZA BADGE NO SQLITE (Sistema Multi-Usuário)
        if (confirmation.consultaNumero) {
            try {
                const response = await fetch(`${CONFIG.DATABASE_BACKEND}/api/badges/${confirmation.consultaNumero}/verde`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        operadorId: 'aghuse_system',
                        operadorNome: 'Sistema AGHUse (Detecção Automática)'
                    })
                });

                if (!response.ok) {
                    console.warn(`[Badges] Erro ao atualizar badge no SQLite:`, response.status);
                } else {
                    const data = await response.json();
                    console.log(`[Badges] ✅ Badge atualizado no SQLite: Consulta ${confirmation.consultaNumero} → VERDE`);
                }
            } catch (error) {
                console.error(`[Badges] Erro ao atualizar badge no SQLite:`, error);
                // Não propaga erro - atualização local já foi feita
            }
        }

    } catch (error) {
        console.error(`[DesmarcacaoLinker] Erro ao atualizar badge:`, error);
        throw error;
    }
}

/**
 * Obtém estatísticas de vinculações
 *
 * NOTA: Só conta confirmações que tiveram resposta via Chat
 *
 * @returns {Object} - Estatísticas
 */
export function getStats() {
    const todasConfirmacoes = ConfirmacaoService.getAllConfirmations();

    const stats = {
        totalConfirmacoes: todasConfirmacoes.length,
        comBadgeDesmarcar: 0,
        comBadgeDesmarcada: 0,
        pendentes: 0
    };

    todasConfirmacoes.forEach(c => {
        // ✅ Só conta se houve resposta via Chat
        const houveRespostaChat = c.dataResposta || c.badgeStatus;

        if (c.statusGeral === 'declined' || c.statusGeral === 'not_scheduled') {
            // Só conta badges se houve resposta via Chat
            if (houveRespostaChat) {
                if (c.badgeStatus === 'desmarcada') {
                    stats.comBadgeDesmarcada++;
                } else {
                    stats.comBadgeDesmarcar++;
                }
            }
        }

        if (c.statusGeral === 'pending' || c.statusGeral === 'sent') {
            stats.pendentes++;
        }
    });

    return stats;
}

export default {
    tryLinkDesmarcacao,
    getStats
};
