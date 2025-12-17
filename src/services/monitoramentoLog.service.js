/**
 * Serviço de Log de Monitoramento de Consultas
 *
 * Registra e gerencia logs de monitoramento para garantir que
 * nenhuma consulta seja perdida quando o sistema é desligado
 *
 * SISTEMA DE PERSISTÊNCIA: PostgreSQL (HMASP)
 * - Banco de dados local do hospital
 * - Sem dependências de serviços externos (Firebase removido)
 * - Dados completamente sob controle do HMASP
 */

import CONFIG from '../config/backend.config.js';

const DATABASE_BACKEND = `${CONFIG.DATABASE_BACKEND || 'http://localhost:3000'}/api/database/monitoramento`;

console.log('[MonitoramentoLog] Usando backend:', DATABASE_BACKEND);

/**
 * Gera chave única para identificar consulta
 *
 * CHAVE COMPOSTA: consultaNumero + dataConsulta + dataMarcacao
 *
 * IMPORTANTE: Inclui dataMarcacao para permitir que a mesma consulta
 * marcada várias vezes apareça cada vez (não seja filtrada como duplicata)
 *
 * @param {Object} consulta - Objeto da consulta
 * @returns {string} - Chave única (ex: "12345_2024-12-15T14:00:00_2024-12-10T16:00:00")
 */
function gerarChaveUnica(consulta) {
    const numero = consulta.consultaNumero || consulta.consulta_numero;
    const dataConsulta = consulta.dataConsulta || consulta.data_consulta || consulta.data_hora_consulta || consulta.dataHoraFormatada;
    // IMPORTANTE: AGHUse retorna como data_hora_marcacao (com _hora_)
    const dataMarcacao = consulta.dataMarcacao || consulta.data_marcacao || consulta.data_hora_marcacao || '';

    if (!numero) {
        console.error('[MonitoramentoLog] Consulta sem consultaNumero:', consulta);
        return null;
    }

    if (!dataConsulta) {
        console.error('[MonitoramentoLog] ❌ Consulta sem dataConsulta - IMPOSSÍVEL gerar chave composta:', numero);
        return null; // Retorna null para forçar erro explícito
    }

    // Normaliza dataConsulta para ISO 8601 (se ainda não estiver)
    let dataConsultaISO = dataConsulta;
    if (dataConsulta instanceof Date) {
        dataConsultaISO = dataConsulta.toISOString();
    } else if (typeof dataConsulta === 'string' && !dataConsulta.includes('T')) {
        const parsed = new Date(dataConsulta);
        if (!isNaN(parsed.getTime())) {
            dataConsultaISO = parsed.toISOString();
        }
    }

    // Normaliza dataMarcacao para ISO 8601 (se existir)
    let dataMarcacaoISO = dataMarcacao;
    if (dataMarcacao instanceof Date) {
        dataMarcacaoISO = dataMarcacao.toISOString();
    } else if (typeof dataMarcacao === 'string' && dataMarcacao && !dataMarcacao.includes('T')) {
        const parsed = new Date(dataMarcacao);
        if (!isNaN(parsed.getTime())) {
            dataMarcacaoISO = parsed.toISOString();
        }
    }

    // CHAVE: numero + dataConsulta + dataMarcacao
    return `${numero}_${dataConsultaISO}_${dataMarcacaoISO}`;
}

/**
 * Salva estado atual do monitoramento
 *
 * @param {Object} estado - Estado do monitoramento
 * @returns {Promise<void>}
 */
export async function saveMonitoramentoState(estado) {
    try {
        const { ultimaVerificacao, totalEnviadas, totalFalhas } = estado;

        const response = await fetch(`${DATABASE_BACKEND}/state`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ativo: true,
                ultimaVerificacao: ultimaVerificacao || new Date().toISOString(),
                totalEnviadas: totalEnviadas || 0,
                totalFalhas: totalFalhas || 0
            })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error);
        }

        console.log('[MonitoramentoLog] Estado salvo no PostgreSQL');

    } catch (error) {
        console.error('[MonitoramentoLog] Erro ao salvar estado:', error);
        throw error;
    }
}

/**
 * Carrega estado do monitoramento
 *
 * @returns {Promise<Object>} - Estado do monitoramento
 */
export async function loadMonitoramentoState() {
    try {
        const response = await fetch(`${DATABASE_BACKEND}/state`);
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error);
        }

        console.log('[MonitoramentoLog] Estado carregado do PostgreSQL:', data.state);

        return data.state;

    } catch (error) {
        console.error('[MonitoramentoLog] Erro ao carregar estado:', error);

        // Retorna estado inicial em caso de erro
        return {
            ativo: false,
            ultimaVerificacao: null,
            totalEnviadas: 0,
            totalFalhas: 0
        };
    }
}

/**
 * Registra consulta como processada
 *
 * @param {string} consultaNumero - Número da consulta
 * @param {string} status - Status do processamento ('enviado' ou 'falha')
 * @param {Object} detalhes - Detalhes adicionais
 * @returns {Promise<void>}
 */
export async function registrarConsultaProcessada(consultaNumero, status, detalhes = {}) {
    try {
        const response = await fetch(`${DATABASE_BACKEND}/consulta`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                consultaNumero,
                status,
                detalhes: {
                    paciente: detalhes.paciente || '',
                    telefone: detalhes.telefone || '',
                    messageId: detalhes.messageId || '',
                    queueId: detalhes.queueId || '',
                    erro: detalhes.erro || '',
                    tentativas: detalhes.tentativas || 1
                }
            })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error);
        }

        console.log(`[MonitoramentoLog] Consulta ${consultaNumero} registrada como ${status}`);

    } catch (error) {
        console.error('[MonitoramentoLog] Erro ao registrar consulta:', error);
        throw error;
    }
}

/**
 * Verifica se consulta já foi processada
 *
 * @param {string} consultaNumero - Número da consulta
 * @returns {Promise<boolean>} - true se já foi processada
 */
export async function consultaJaProcessada(consultaNumero) {
    try {
        const response = await fetch(`${DATABASE_BACKEND}/consulta/${consultaNumero}`);
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error);
        }

        return data.processada;

    } catch (error) {
        console.error('[MonitoramentoLog] Erro ao verificar consulta:', error);
        return false;
    }
}

/**
 * Obtém consultas que precisam ser enviadas
 * (marcadas desde a última verificação)
 *
 * @param {Array} consultasRecentes - Consultas do AGHUse
 * @returns {Promise<Array>} - Consultas não processadas
 */
export async function getConsultasNaoProcessadas(consultasRecentes) {
    try {
        // Gera chaves compostas para cada consulta
        const consultasComChave = consultasRecentes.map(c => {
            const chave = gerarChaveUnica(c);
            return {
                ...c,
                chaveUnica: chave, // Adiciona chave composta
                consultaNumero: c.consultaNumero,
                dataConsulta: c.dataConsulta
            };
        }).filter(c => c.chaveUnica !== null);

        if (consultasComChave.length === 0) {
            console.warn('[MonitoramentoLog] Nenhuma consulta com chave válida para filtrar');
            return [];
        }

        const response = await fetch(`${DATABASE_BACKEND}/consultas/filtrar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                consultas: consultasComChave
            })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error);
        }

        console.log(`[MonitoramentoLog] ${data.naoProcessadasCount} consultas não processadas de ${data.total} total (chave: consultaNumero_dataConsulta)`);

        return data.naoProcessadas;

    } catch (error) {
        console.error('[MonitoramentoLog] Erro ao obter consultas não processadas:', error);
        throw error;
    }
}

/**
 * Obtém estatísticas do monitoramento
 *
 * @returns {Promise<Object>} - Estatísticas
 */
export async function getEstatisticas() {
    try {
        const response = await fetch(`${DATABASE_BACKEND}/stats`);
        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error);
        }

        return data.stats;

    } catch (error) {
        console.error('[MonitoramentoLog] Erro ao obter estatísticas:', error);
        throw error;
    }
}

/**
 * Reseta estado do monitoramento
 *
 * @returns {Promise<void>}
 */
export async function resetMonitoramento() {
    try {
        const response = await fetch(`${DATABASE_BACKEND}/reset`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error);
        }

        console.log('[MonitoramentoLog] Estado resetado');

    } catch (error) {
        console.error('[MonitoramentoLog] Erro ao resetar monitoramento:', error);
        throw error;
    }
}

/**
 * Marca monitoramento como ativo/inativo
 *
 * @param {boolean} ativo - true para ativo, false para inativo
 * @returns {Promise<void>}
 */
export async function setMonitoramentoAtivo(ativo) {
    try {
        const state = await loadMonitoramentoState();

        state.ativo = ativo;

        await saveMonitoramentoState(state);

        console.log(`[MonitoramentoLog] Monitoramento ${ativo ? 'ativado' : 'desativado'}`);

    } catch (error) {
        console.error('[MonitoramentoLog] Erro ao alterar status do monitoramento:', error);
        throw error;
    }
}

/**
 * Marca consultas como processadas no banco
 *
 * @param {Array} consultas - Consultas para marcar
 * @returns {Promise<Object>} - Resultado da marcação
 */
export async function marcarConsultasProcessadas(consultas) {
    try {
        if (!consultas || consultas.length === 0) {
            return { success: true, marcadas: 0 };
        }

        // Gera chaves compostas para cada consulta
        const consultasComChave = consultas.map(c => {
            const chave = gerarChaveUnica(c);
            return {
                ...c,
                chaveUnica: chave, // Adiciona chave composta
                consultaNumero: c.consultaNumero,
                dataConsulta: c.dataConsulta
            };
        }).filter(c => c.chaveUnica !== null); // Remove consultas sem chave válida

        if (consultasComChave.length === 0) {
            console.warn('[MonitoramentoLog] Nenhuma consulta com chave válida para marcar');
            return { success: true, marcadas: 0 };
        }

        const response = await fetch(`${DATABASE_BACKEND}/consultas/marcar`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ consultas: consultasComChave })
        });

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error);
        }

        console.log(`[MonitoramentoLog] ✅ ${data.marcadas} consultas marcadas como processadas (chave: consultaNumero_dataConsulta)`);

        return data;

    } catch (error) {
        console.error('[MonitoramentoLog] Erro ao marcar consultas:', error);
        throw error;
    }
}

/**
 * Limpa logs antigos (mais de 30 dias)
 * NOTA: Implementação no backend PostgreSQL
 *
 * @returns {Promise<Object>} - Estatísticas da limpeza
 */
export async function limparLogsAntigos() {
    console.warn('[MonitoramentoLog] limparLogsAntigos() - Implementar no backend se necessário');
    return { removidos: 0 };
}

// Exporta função helper para uso externo (backend pode usar a mesma lógica)
export { gerarChaveUnica };

export default {
    saveMonitoramentoState,
    loadMonitoramentoState,
    registrarConsultaProcessada,
    consultaJaProcessada,
    getConsultasNaoProcessadas,
    marcarConsultasProcessadas,
    limparLogsAntigos,
    getEstatisticas,
    resetMonitoramento,
    setMonitoramentoAtivo,
    gerarChaveUnica
};
