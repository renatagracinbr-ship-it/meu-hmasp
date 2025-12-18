/**
 * Serviço de Consultas SQLite (Frontend)
 *
 * Centraliza todas as chamadas à API de consultas do backend SQLite.
 * Substitui localStorage por chamadas HTTP ao servidor.
 *
 * Benefícios:
 * - Código centralizado e reutilizável
 * - Tratamento de erros consistente
 * - Fácil manutenção
 * - Multi-usuário automático
 */

import CONFIG from '../config/backend.config.js';

// ============================================================================
// CONSULTAS ATIVAS (Aba Confirmação)
// ============================================================================

/**
 * Busca todas as consultas ativas
 * @param {Object} filtros - Filtros opcionais (tipo, statusGeral, nomePaciente)
 * @returns {Promise<Array>} - Array de consultas
 */
export async function getAllConsultasAtivas(filtros = {}) {
    try {
        const params = new URLSearchParams();
        if (filtros.tipo) params.append('tipo', filtros.tipo);
        if (filtros.statusGeral) params.append('statusGeral', filtros.statusGeral);
        if (filtros.nomePaciente) params.append('nomePaciente', filtros.nomePaciente);

        const url = `${CONFIG.DATABASE_BACKEND}/api/consultas/ativas${params.toString() ? '?' + params.toString() : ''}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return data.consultas || [];
    } catch (error) {
        console.error('[SQLite] Erro ao buscar consultas ativas:', error);
        return [];
    }
}

/**
 * Busca consulta ativa por ID
 * @param {string} id - ID da consulta
 * @returns {Promise<Object|null>} - Consulta ou null
 */
export async function getConsultaAtiva(id) {
    try {
        const response = await fetch(`${CONFIG.DATABASE_BACKEND}/api/consultas/ativas/${id}`);

        if (!response.ok) {
            if (response.status === 404) return null;
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return data.consulta || null;
    } catch (error) {
        console.error('[SQLite] Erro ao buscar consulta:', error);
        return null;
    }
}

/**
 * Salva consulta ativa (cria ou atualiza)
 * @param {Object} consulta - Dados da consulta
 * @returns {Promise<Object>} - Resultado da operação
 */
export async function saveConsultaAtiva(consulta) {
    try {
        // Mapeia campos do frontend para o backend
        const payload = {
            id: consulta.id,
            consultaNumero: consulta.consultaNumero,
            nomePaciente: consulta.nomePaciente,
            prontuario: consulta.prontuario || '',
            telefone: consulta.telefone || consulta.mensagens?.[0]?.telefone || '',
            telefoneFormatado: consulta.telefoneFormatado || '',
            especialidade: consulta.especialidade || '',
            profissional: consulta.profissional || 'Não informado',
            local: consulta.local || null,
            dataHoraFormatada: consulta.dataHoraFormatada || '',
            dataConsulta: consulta.dataConsulta || '',
            tipo: consulta.tipo || 'marcada',
            statusGeral: consulta.statusGeral || 'pending',
            mensagemTemplate: consulta.mensagemTemplate || '',
            mensagemEnviada: consulta.mensagemEnviada || false,
            dataEnvio: consulta.dataEnvio || null,
            whatsappMessageId: consulta.whatsappMessageId || null,
            dataMarcacao: consulta.dataMarcacao || null,
            dataApareceuDashboard: consulta.dataApareceuDashboard || new Date().toISOString(),
            contextoId: consulta.contextoId || null,
            contextoExpiresAt: consulta.contextoExpiresAt || null,
            // NOVOS CAMPOS ADICIONADOS
            pacCodigo: consulta.pacCodigo || null,
            nomeExibicao: consulta.nomeExibicao || null,
            dataResposta: consulta.dataResposta || null,
            badgeStatus: consulta.badgeStatus || null,
            badgeInfo: (() => {
                try {
                    return consulta.badgeInfo ? JSON.stringify(consulta.badgeInfo) : null;
                } catch (e) {
                    console.error('[SQLite] Erro ao serializar badgeInfo:', e);
                    return null;
                }
            })(),
            contexto: consulta.contexto || 'confirmacao',
            // Campos de reagendamento
            reagendamentoDe: consulta.reagendamentoDe || null,
            reagendamentoData: consulta.reagendamentoData || null,
            reagendamentoTipo: consulta.reagendamentoTipo || null,
            // Metadados
            criadoPor: consulta.criadoPor || 'sistema'
        };

        const response = await fetch(`${CONFIG.DATABASE_BACKEND}/api/consultas/ativas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        // Salva telefones separadamente (array de telefones)
        if (consulta.telefones && Array.isArray(consulta.telefones) && consulta.telefones.length > 0) {
            try {
                const telefonesResult = await saveTelefones(consulta.id, consulta.telefones);
                if (!telefonesResult.success) {
                    console.error('[SQLite] ❌ FALHA ao salvar telefones:', telefonesResult);
                    // IMPORTANTE: Registra erro mas não quebra operação
                    data.telefonesError = telefonesResult.error || 'Telefones não salvos';
                }
            } catch (telError) {
                console.error('[SQLite] ❌ EXCEÇÃO ao salvar telefones:', telError);
                // Registra erro mas não quebra operação principal
                data.telefonesError = telError.message;
            }
        }

        return data;
    } catch (error) {
        console.error('[SQLite] Erro ao salvar consulta:', error);
        throw error;
    }
}

/**
 * Salva múltiplas consultas ativas (batch)
 * @param {Array} consultas - Array de consultas
 * @returns {Promise<Object>} - Resultado com total salvo
 */
export async function saveConsultasAtivasBatch(consultas) {
    try {
        let salvos = 0;
        let erros = 0;

        for (const consulta of consultas) {
            try {
                await saveConsultaAtiva(consulta);
                salvos++;
            } catch (error) {
                console.error('[SQLite] Erro ao salvar consulta em batch:', consulta.consultaNumero, error);
                erros++;
            }
        }

        console.log(`[SQLite] Batch concluído: ${salvos} salvos, ${erros} erros`);

        return {
            success: true,
            salvos,
            erros,
            total: consultas.length
        };
    } catch (error) {
        console.error('[SQLite] Erro no batch:', error);
        throw error;
    }
}

/**
 * Atualiza status de uma consulta
 * @param {string} consultaNumero - Número da consulta
 * @param {string} novoStatus - Novo status
 * @returns {Promise<boolean>} - Sucesso ou falha
 */
export async function updateConsultaStatus(consultaNumero, novoStatus) {
    try {
        const response = await fetch(`${CONFIG.DATABASE_BACKEND}/api/consultas/ativas/${consultaNumero}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ novoStatus })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return true;
    } catch (error) {
        console.error('[SQLite] Erro ao atualizar status:', error);
        return false;
    }
}

/**
 * Marca mensagem como enviada
 * @param {string} consultaNumero - Número da consulta
 * @param {string} whatsappMessageId - ID da mensagem WhatsApp (opcional)
 * @returns {Promise<boolean>} - Sucesso ou falha
 */
export async function markMensagemEnviada(consultaNumero, whatsappMessageId = null) {
    try {
        const response = await fetch(`${CONFIG.DATABASE_BACKEND}/api/consultas/ativas/${consultaNumero}/mensagem-enviada`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ whatsappMessageId })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return true;
    } catch (error) {
        console.error('[SQLite] Erro ao marcar mensagem:', error);
        return false;
    }
}

/**
 * Arquiva uma consulta
 * @param {string} id - ID da consulta
 * @param {string} motivo - Motivo do arquivamento
 * @param {string} arquivadoPor - Quem arquivou
 * @returns {Promise<boolean>} - Sucesso ou falha
 */
export async function arquivarConsulta(id, motivo = 'manual', arquivadoPor = 'operador') {
    try {
        const response = await fetch(`${CONFIG.DATABASE_BACKEND}/api/consultas/ativas/${id}/arquivar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ motivo, arquivadoPor })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return true;
    } catch (error) {
        console.error('[SQLite] Erro ao arquivar consulta:', error);
        return false;
    }
}

/**
 * Deleta uma consulta
 * @param {string} id - ID da consulta
 * @returns {Promise<boolean>} - Sucesso ou falha
 */
export async function deleteConsulta(id) {
    try {
        const response = await fetch(`${CONFIG.DATABASE_BACKEND}/api/consultas/ativas/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return true;
    } catch (error) {
        console.error('[SQLite] Erro ao deletar consulta:', error);
        return false;
    }
}

// ============================================================================
// DESMARCAÇÕES ATIVAS (Aba Desmarcação)
// ============================================================================

/**
 * Busca todas as desmarcações ativas
 * @param {Object} filtros - Filtros opcionais
 * @returns {Promise<Array>} - Array de desmarcações
 */
export async function getAllDesmarcacoesAtivas(filtros = {}) {
    try {
        const params = new URLSearchParams();
        if (filtros.tipoDesmarcacao) params.append('tipoDesmarcacao', filtros.tipoDesmarcacao);
        if (filtros.veioDeConfirmacao !== undefined) params.append('veioDeConfirmacao', filtros.veioDeConfirmacao);

        const url = `${CONFIG.DATABASE_BACKEND}/api/desmarcacoes/ativas${params.toString() ? '?' + params.toString() : ''}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return data.desmarcacoes || [];
    } catch (error) {
        console.error('[SQLite] Erro ao buscar desmarcações:', error);
        return [];
    }
}

/**
 * Salva desmarcação ativa
 * @param {Object} desmarcacao - Dados da desmarcação
 * @returns {Promise<Object>} - Resultado da operação
 */
export async function saveDesmarcacaoAtiva(desmarcacao) {
    try {
        // Extrai telefone do array telefones (estrutura do desmarcacao.service.js)
        const telefonePrincipal = desmarcacao.telefones?.[0];
        const telefone = telefonePrincipal?.telefone || desmarcacao.telefone || '';
        const telefoneFormatado = telefonePrincipal?.telefoneFormatado || desmarcacao.telefoneFormatado || '';

        const payload = {
            id: desmarcacao.id,
            consultaNumero: desmarcacao.consultaNumero,
            nomePaciente: desmarcacao.nomePaciente,
            nomeExibicao: desmarcacao.nomeExibicao || '',
            pacCodigo: desmarcacao.pacCodigo || '',
            prontuario: desmarcacao.prontuario || '',
            telefone: telefone,
            telefoneFormatado: telefoneFormatado,
            especialidade: desmarcacao.especialidade || '',
            profissional: desmarcacao.profissional || 'Não informado',
            local: desmarcacao.local || null,
            dataHoraFormatada: desmarcacao.dataHoraFormatada || '',
            dataConsulta: desmarcacao.dataConsulta || '',
            tipoDesmarcacao: desmarcacao.tipoDesmarcacao || null,
            veioDeConfirmacao: desmarcacao.veioDeConfirmacao || false,
            confirmacaoId: desmarcacao.confirmacaoId || null,
            mensagemTemplate: desmarcacao.mensagemTemplate || '',
            mensagemEnviada: desmarcacao.mensagemEnviada || false,
            enviarMensagem: desmarcacao.enviarMensagem !== undefined ? desmarcacao.enviarMensagem : true,
            dataEnvio: desmarcacao.dataEnvio || null,
            whatsappMessageId: desmarcacao.whatsappMessageId || null,
            dataDesmarcacao: desmarcacao.dataDesmarcacao || new Date().toISOString(),
            dataDesmarcacaoFormatada: desmarcacao.dataDesmarcacaoFormatada || 'Não informada',
            dataApareceuDashboard: desmarcacao.dataApareceuDashboard || new Date().toISOString(),
            contextoId: desmarcacao.contextoId || null,
            contextoExpiresAt: desmarcacao.contextoExpiresAt || null,
            // NOVOS CAMPOS ADICIONADOS
            respostaEm: desmarcacao.respostaEm || null,
            statusGeral: desmarcacao.statusGeral || 'pending',
            dataMarcacao: desmarcacao.dataMarcacao || null,
            contexto: desmarcacao.contexto || 'desmarcacao',
            status: desmarcacao.status || null,
            // Campos de reagendamento
            reagendada: desmarcacao.reagendada || false,
            reagendadaEm: desmarcacao.reagendadaEm || null,
            novaConsultaNumero: desmarcacao.novaConsultaNumero || null,
            reagendamentoComunicado: desmarcacao.reagendamentoComunicado || false,
            // Metadados
            criadoPor: desmarcacao.criadoPor || 'sistema'
        };

        const response = await fetch(`${CONFIG.DATABASE_BACKEND}/api/desmarcacoes/ativas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        // Salva telefones separadamente (array de telefones)
        if (desmarcacao.telefones && Array.isArray(desmarcacao.telefones) && desmarcacao.telefones.length > 0) {
            try {
                await saveDesmarcacaoTelefones(desmarcacao.id, desmarcacao.telefones);
            } catch (telError) {
                console.warn('[SQLite] Erro ao salvar telefones de desmarcação (desmarcação salva, telefones não):', telError);
            }
        }

        return data;
    } catch (error) {
        console.error('[SQLite] Erro ao salvar desmarcação:', error);
        throw error;
    }
}

/**
 * Salva múltiplas desmarcações ativas (batch)
 * @param {Array} desmarcacoes - Array de desmarcações
 * @returns {Promise<Object>} - Resultado com total salvo
 */
export async function saveDesmarcacoesAtivasBatch(desmarcacoes) {
    try {
        let salvos = 0;
        let erros = 0;

        for (const desmarcacao of desmarcacoes) {
            try {
                await saveDesmarcacaoAtiva(desmarcacao);
                salvos++;
            } catch (error) {
                console.error('[SQLite] Erro ao salvar desmarcação em batch:', desmarcacao.consultaNumero, error);
                erros++;
            }
        }

        console.log(`[SQLite] Batch concluído: ${salvos} salvos, ${erros} erros`);

        return {
            success: true,
            salvos,
            erros,
            total: desmarcacoes.length
        };
    } catch (error) {
        console.error('[SQLite] Erro no batch:', error);
        throw error;
    }
}

/**
 * Arquiva uma desmarcação
 * @param {string} id - ID da desmarcação
 * @param {string} motivo - Motivo do arquivamento
 * @param {string} arquivadoPor - Quem arquivou
 * @returns {Promise<boolean>} - Sucesso ou falha
 */
export async function arquivarDesmarcacao(id, motivo = 'manual', arquivadoPor = 'operador') {
    try {
        const response = await fetch(`${CONFIG.DATABASE_BACKEND}/api/desmarcacoes/ativas/${id}/arquivar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ motivo, arquivadoPor })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return true;
    } catch (error) {
        console.error('[SQLite] Erro ao arquivar desmarcação:', error);
        return false;
    }
}

/**
 * Deleta uma desmarcação
 * @param {string} id - ID da desmarcação
 * @returns {Promise<boolean>} - Sucesso ou falha
 */
export async function deleteDesmarcacao(id) {
    try {
        const response = await fetch(`${CONFIG.DATABASE_BACKEND}/api/desmarcacoes/ativas/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return true;
    } catch (error) {
        console.error('[SQLite] Erro ao deletar desmarcação:', error);
        return false;
    }
}

// ============================================================================
// CONSULTAS ARQUIVADAS
// ============================================================================

/**
 * Busca consultas arquivadas
 * @param {number} limite - Número máximo de resultados
 * @returns {Promise<Array>} - Array de consultas arquivadas
 */
export async function getConsultasArquivadas(limite = 100) {
    try {
        const response = await fetch(`${CONFIG.DATABASE_BACKEND}/api/consultas/arquivadas?limite=${limite}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return data.consultas || [];
    } catch (error) {
        console.error('[SQLite] Erro ao buscar arquivadas:', error);
        return [];
    }
}

// ============================================================================
// ESTATÍSTICAS
// ============================================================================

/**
 * Busca estatísticas de confirmações
 * @returns {Promise<Object>} - Estatísticas
 */
export async function getStatsConfirmacoes() {
    try {
        const response = await fetch(`${CONFIG.DATABASE_BACKEND}/api/consultas/stats/confirmacoes`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return data.stats || {};
    } catch (error) {
        console.error('[SQLite] Erro ao buscar stats:', error);
        return {};
    }
}

/**
 * Busca estatísticas de desmarcações
 * @returns {Promise<Object>} - Estatísticas
 */
export async function getStatsDesmarcacoes() {
    try {
        const response = await fetch(`${CONFIG.DATABASE_BACKEND}/api/consultas/stats/desmarcacoes`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return data.stats || {};
    } catch (error) {
        console.error('[SQLite] Erro ao buscar stats:', error);
        return {};
    }
}

/**
 * Atualiza status de uma desmarcação no banco SQLite
 * @param {string} desmarcacaoId - ID único da desmarcação (ex: desm-736288-...)
 * @param {string} status - Status da resposta ('reagendamento', 'paciente_solicitou', 'sem_reagendamento')
 * @param {string} tipoDesmarcacao - Tipo de desmarcação (mesmo valor do status)
 * @returns {Promise<boolean>} - True se atualizou com sucesso
 */
export async function updateDesmarcacaoStatus(desmarcacaoId, status, tipoDesmarcacao) {
    try {
        const response = await fetch(`${CONFIG.DATABASE_BACKEND}/api/desmarcacoes/update-status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: desmarcacaoId,
                status,
                tipo_desmarcacao: tipoDesmarcacao
            })
        });

        const data = await response.json();

        if (!data.success) {
            console.error('[SQLite] Erro ao atualizar status:', data.error);
            return false;
        }

        console.log(`[SQLite] Status atualizado: ${desmarcacaoId} → ${status}`);
        return true;

    } catch (error) {
        console.error('[SQLite] Erro ao atualizar status:', error);
        return false;
    }
}

// ============================================================================
// TELEFONES (Persistência de Arrays)
// ============================================================================

/**
 * Salva array de telefones de uma confirmação
 * @param {string} consultaId - ID da confirmação
 * @param {Array} telefones - Array de telefones
 */
export async function saveTelefones(consultaId, telefones) {
    try {
        const response = await fetch(`${CONFIG.DATABASE_BACKEND}/api/consultas/telefones`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                consultaId,
                telefones
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        console.log(`[SQLite] ✅ ${data.inserted} telefone(s) salvo(s) para confirmação ${consultaId}`);
        return data;
    } catch (error) {
        console.error('[SQLite] Erro ao salvar telefones:', error);
        throw error;
    }
}

/**
 * Busca telefones de uma confirmação
 * @param {string} consultaId - ID da confirmação
 */
export async function getTelefones(consultaId) {
    try {
        const response = await fetch(`${CONFIG.DATABASE_BACKEND}/api/consultas/telefones/${consultaId}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return data.telefones || [];
    } catch (error) {
        console.error('[SQLite] Erro ao buscar telefones:', error);
        return [];
    }
}

/**
 * Salva array de telefones de uma desmarcação
 * @param {string} desmarcacaoId - ID da desmarcação
 * @param {Array} telefones - Array de telefones
 */
export async function saveDesmarcacaoTelefones(desmarcacaoId, telefones) {
    try {
        const response = await fetch(`${CONFIG.DATABASE_BACKEND}/api/desmarcacoes/telefones`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                desmarcacaoId,
                telefones
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        console.log(`[SQLite] ✅ ${data.inserted} telefone(s) salvo(s) para desmarcação ${desmarcacaoId}`);
        return data;
    } catch (error) {
        console.error('[SQLite] Erro ao salvar telefones de desmarcação:', error);
        throw error;
    }
}

/**
 * Busca telefones de uma desmarcação
 * @param {string} desmarcacaoId - ID da desmarcação
 */
export async function getDesmarcacaoTelefones(desmarcacaoId) {
    try {
        const response = await fetch(`${CONFIG.DATABASE_BACKEND}/api/desmarcacoes/telefones/${desmarcacaoId}`);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        return data.telefones || [];
    } catch (error) {
        console.error('[SQLite] Erro ao buscar telefones de desmarcação:', error);
        return [];
    }
}

// ============================================================================
// UTILITÁRIOS
// ============================================================================

/**
 * Converte consulta do formato SQLite para formato do frontend
 * @param {Object} consultaSQLite - Consulta no formato do banco
 * @returns {Object} - Consulta no formato do frontend
 */
export function convertSQLiteToFrontend(consultaSQLite) {
    // Os nomes dos campos no SQLite usam snake_case
    // O frontend usa camelCase

    // ⚠️ IMPORTANTE: Não podemos usar import dinâmico aqui pois é função síncrona
    // A mensagem será gerada em sendConfirmationMessage() usando os dados salvos

    // Reconstrói telefone no formato esperado por sendConfirmationMessage
    let telefones;

    if (consultaSQLite.telefone) {
        // Determina templateId baseado no tipo
        // IMPORTANTE: Se é reagendamento, usa template específico!
        let templateId;
        if (consultaSQLite.reagendamento_de) {
            // É reagendamento - usa template com 3 botões que permite desmarcação
            templateId = 'reagendamento_confirmacao';
        } else if (consultaSQLite.tipo === 'MARCACAO' || consultaSQLite.tipo === 'marcada') {
            templateId = 'marcacao_confirmacao';
        } else {
            templateId = 'lembrete_72h';
        }

        telefones = [{
            telefone: consultaSQLite.telefone,
            telefoneFormatado: consultaSQLite.telefone_formatado || consultaSQLite.telefone,
            telefoneType: 'mobile',
            telefoneOrigem: consultaSQLite.telefone,
            chatId: consultaSQLite.telefone ? consultaSQLite.telefone.replace('+', '') + '@c.us' : null, // Formato WhatsApp
            // Mensagem será NULL - sendConfirmationMessage() vai gerar a mensagem na hora do envio
            mensagem: null,
            templateId: templateId, // Salva o templateId para gerar depois
            // Dados necessários para gerar mensagem depois
            dadosMensagem: {
                nomePaciente: consultaSQLite.nome_paciente,
                especialidade: consultaSQLite.especialidade || 'Não informada',
                dataHora: consultaSQLite.data_hora_formatada || 'Não informada',
                medico: consultaSQLite.profissional || 'Não informado'
            },
            status: consultaSQLite.mensagem_enviada ? 'sent' : 'pending',
            prioridade: 1,
            tentativas: consultaSQLite.mensagem_enviada ? 1 : 0,
            logs: []
        }];
    } else {
        telefones = [{
            telefone: null,
            telefoneFormatado: '⚠️ SEM TELEFONE CADASTRADO',
            telefoneType: 'none',
            telefoneOrigem: null,
            chatId: null,
            mensagem: null,
            status: 'no_phone',
            prioridade: 1,
            tentativas: 0,
            logs: []
        }];
    }

    return {
        id: consultaSQLite.id,
        consultaNumero: consultaSQLite.consulta_numero,
        nomePaciente: consultaSQLite.nome_paciente,
        prontuario: consultaSQLite.prontuario,
        telefone: consultaSQLite.telefone,
        telefoneFormatado: consultaSQLite.telefone_formatado,
        especialidade: consultaSQLite.especialidade,
        profissional: consultaSQLite.profissional || 'Não informado',
        dataHoraFormatada: consultaSQLite.data_hora_formatada,
        dataConsulta: consultaSQLite.data_consulta,
        tipo: consultaSQLite.tipo,
        statusGeral: consultaSQLite.status_geral,
        mensagemTemplate: consultaSQLite.mensagem_template,
        mensagemEnviada: consultaSQLite.mensagem_enviada === 1 || consultaSQLite.mensagem_enviada === '1',
        dataEnvio: consultaSQLite.data_envio,
        whatsappMessageId: consultaSQLite.whatsapp_message_id,
        dataMarcacao: consultaSQLite.data_marcacao,
        dataApareceuDashboard: consultaSQLite.data_apareceu_dashboard,
        contextoId: consultaSQLite.contexto_id,
        contextoExpiresAt: consultaSQLite.contexto_expires_at,
        criadoEm: consultaSQLite.criado_em,
        atualizadoEm: consultaSQLite.atualizado_em,
        criadoPor: consultaSQLite.criado_por,
        // Campo de resposta (indica que houve resposta via WhatsApp - necessário para badge vermelho)
        dataResposta: consultaSQLite.data_resposta,
        // Campos de badge (para exibir badge vermelho/verde)
        badgeStatus: consultaSQLite.badge_status,
        badgeInfo: consultaSQLite.badge_info ? JSON.parse(consultaSQLite.badge_info) : null,
        // Contexto da conversa WhatsApp
        contexto: consultaSQLite.contexto || 'confirmacao',
        // Campos adicionais do paciente
        pacCodigo: consultaSQLite.pac_codigo,
        nomeExibicao: consultaSQLite.nome_exibicao,
        local: consultaSQLite.local,
        // Campos de reagendamento (badge amarelo)
        reagendamentoDe: consultaSQLite.reagendamento_de,
        reagendamentoData: consultaSQLite.reagendamento_data,
        reagendamentoTipo: consultaSQLite.reagendamento_tipo,
        // Array de telefones (novo padrão igual Desmarcação)
        telefones: telefones,
        // Array de mensagens (mantido para compatibilidade)
        mensagens: telefones
    };
}
