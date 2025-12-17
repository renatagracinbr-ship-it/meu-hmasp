/**
 * Cliente AGHUse - Frontend
 *
 * ARQUITETURA HMASP:
 * - Backend AGHUse em VM3 (Intranet)
 * - Acesso direto ao banco PostgreSQL AGHUse (10.12.40.219)
 * - Requer VPN/Intranet do HMASP
 *
 * DESENVOLVIMENTO:
 * - Backend local: http://localhost:3001 (Electron app)
 *
 * PRODUÇÃO:
 * - Backend VM3: IP da VM3 no HMASP (porta 3001)
 */

// Backend AGHUse
import CONFIG from '../config/backend.config.js';
const BACKEND_URL = `${CONFIG.AGHUSE_BACKEND}/api`;

console.log('[AGHUse] Usando backend:', BACKEND_URL);

/**
 * Testa conexão com o banco AGHUse
 */
export async function testConnection() {
    try {
        const response = await fetch(`${BACKEND_URL}/aghuse/test-connection`);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('[AGHUse Client] Erro ao testar conexão:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Busca consultas marcadas recentemente (últimos N minutos)
 */
export async function fetchRecentlyScheduledAppointments(minutes = 5) {
    try {
        const response = await fetch(`${BACKEND_URL}/aghuse/recent-appointments?minutes=${minutes}`);

        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch (e) {
                throw new Error(`Erro HTTP ${response.status}: ${errorText}`);
            }
            throw new Error(errorData.error || `Erro HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Erro desconhecido ao buscar consultas');
        }

        // Transforma os dados
        return data.appointments.map(row => transformAppointmentData(row));

    } catch (error) {
        // Só loga erro detalhado se não for timeout/conexão
        const isTimeoutError = error.message && (
            error.message.includes('Connection terminated') ||
            error.message.includes('ETIMEDOUT') ||
            error.message.includes('ECONNREFUSED') ||
            error.message.includes('timeout')
        );

        if (!isTimeoutError) {
            console.error('[AGHUse Client] Erro ao buscar consultas:', error.message);
        }
        throw error;
    }
}

/**
 * Transforma dados brutos do banco para o formato da aplicação
 */
function transformAppointmentData(row) {
    // DEBUG: Log dos telefones brutos do banco
    console.log(`[AGHUse] Consulta ${row.consulta_numero} - Telefones brutos:`, {
        celular: row.telefone_celular,
        fixo: row.telefone_fixo,
        recado: row.telefone_adicional
    });

    // Prioridade: Celular > Fixo > Recado
    // (alguns pacientes cadastram celular no campo errado)
    const phones = [
        { type: 'Celular', number: row.telefone_celular },
        { type: 'Fixo', number: row.telefone_fixo },
        { type: 'Recado', number: row.telefone_adicional }
    ].filter(phone => phone.number);

    // Normalização básica aqui (ou importar PhoneNormalizer se precisar)
    const normalizedPhones = phones.map(phone => {
        const isMobile = isValidMobile(phone.number);
        console.log(`[AGHUse] Telefone ${phone.number} -> Tipo: ${isMobile ? 'mobile' : 'landline'}`);

        return {
            original: phone.number,
            normalized: normalizePhone(phone.number),
            type: phone.type,
            phoneType: isMobile ? 'mobile' : 'landline'
        };
    }).filter(p => p.normalized);

    console.log(`[AGHUse] Consulta ${row.consulta_numero} - Telefones normalizados:`, normalizedPhones);

    // Extrai primeiro e último nome
    const nomeCompleto = row.nome_paciente || '';
    const partesNome = nomeCompleto.trim().split(' ').filter(p => p);
    const primeiroNome = partesNome[0] || '';
    const ultimoNome = partesNome.length > 1 ? partesNome[partesNome.length - 1] : '';
    const nomeExibicao = ultimoNome ? `${primeiroNome} ${ultimoNome}` : primeiroNome;

    // Formata data e hora
    const dataConsulta = new Date(row.data_hora_consulta);
    const dataFormatada = dataConsulta.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        timeZone: 'America/Sao_Paulo'
    });
    const horaFormatada = dataConsulta.toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo'
    });

    // Ajusta nome do profissional para MEDICINA DE EMERGÊNCIA
    const especialidadeNormalizada = (row.especialidade || '').toUpperCase().trim();
    const isPAM = especialidadeNormalizada.includes('MEDICINA DE EMERGÊNCIA') ||
                  especialidadeNormalizada.includes('MEDICINA DE EMERGENCIA');
    const profissionalNome = isPAM ? 'PLANTONISTA DO PAM' : (row.profissional_nome || 'Não informado');

    // Debug: Log profissional para investigar
    if (!row.profissional_nome && !isPAM) {
        console.log(`[AGHUse] Consulta ${row.consulta_numero} - profissional_nome: ${row.profissional_nome}, especialidade: ${row.especialidade}`);
    }

    return {
        consultaNumero: row.consulta_numero,
        pacCodigo: row.pac_codigo,
        prontuario: row.prontuario,
        cpf: row.cpf_paciente || null,
        nomeCompleto: nomeCompleto,
        nomeExibicao: nomeExibicao,
        primeiroNome: primeiroNome,
        ultimoNome: ultimoNome,
        telefones: normalizedPhones,
        telefonesPrincipais: normalizedPhones.map(p => p.normalized),
        especialidade: row.especialidade || 'Não informada',
        dataConsulta: dataConsulta,
        dataFormatada: dataFormatada,
        horaFormatada: horaFormatada,
        dataHoraFormatada: `${dataFormatada} ${horaFormatada}`,
        profissional: profissionalNome,
        local: row.local_descricao || 'Não informado',
        dataMarcacao: row.data_hora_marcacao ? new Date(row.data_hora_marcacao) : null,
        dataDesmarcacao: row.data_hora_desmarcacao ? new Date(row.data_hora_desmarcacao) : null,
        usuarioDesmarcacao: row.usuario_desmarcacao || null,
        situacao: row.situacao_codigo,
        situacaoDescricao: row.situacao_descricao
    };
}

/**
 * Normalização básica de telefone (versão simplificada)
 */
function normalizePhone(phone) {
    if (!phone) return null;

    // Remove caracteres não numéricos
    let cleaned = phone.toString().replace(/\D/g, '');

    // Remove zeros à esquerda
    cleaned = cleaned.replace(/^0+/, '');

    // Remove código do país se tiver
    if (cleaned.startsWith('55')) {
        cleaned = cleaned.substring(2);
    }

    // Se tem 9 dígitos e começa com 9, adiciona DDD 11 (São Paulo)
    if (cleaned.length === 9 && cleaned.startsWith('9')) {
        cleaned = '11' + cleaned;
        console.log('[AGHUse] Telefone sem DDD detectado, adicionado DDD 11:', cleaned);
    }

    // Se tem 8 dígitos (telefone fixo), adiciona DDD 11
    if (cleaned.length === 8) {
        cleaned = '11' + cleaned;
        console.log('[AGHUse] Telefone fixo sem DDD detectado, adicionado DDD 11:', cleaned);
    }

    // Deve ter pelo menos 10 dígitos (DDD + número)
    if (cleaned.length < 10) {
        console.warn('[AGHUse] Telefone inválido (menos de 10 dígitos):', cleaned);
        return null;
    }

    // Adiciona +55
    return `+55${cleaned}`;
}

/**
 * Verifica se é celular válido
 */
function isValidMobile(phone) {
    const cleaned = (phone || '').replace(/\D/g, '');

    // Se tem 9 dígitos e começa com 9 = celular (sem DDD)
    if (cleaned.length === 9 && cleaned.charAt(0) === '9') {
        return true;
    }

    // Se tem 11 dígitos (com DDD), o terceiro dígito deve ser 9
    // Exemplo: 11974878925 -> posição [2] = '9'
    if (cleaned.length === 11 && cleaned.charAt(2) === '9') {
        return true;
    }

    // Se tem 10 dígitos (DDD + 8 dígitos) = fixo
    return false;
}

/**
 * Busca consultas desmarcadas recentemente (últimos N minutos)
 */
export async function fetchRecentlyCancelledAppointments(minutes = 60) {
    try {
        const response = await fetch(`${BACKEND_URL}/aghuse/cancelled-appointments?minutes=${minutes}`);

        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch (e) {
                throw new Error(`Erro HTTP ${response.status}: ${errorText}`);
            }
            throw new Error(errorData.error || `Erro HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Erro desconhecido ao buscar consultas desmarcadas');
        }

        // Transforma os dados
        return data.appointments.map(row => transformAppointmentData(row));

    } catch (error) {
        // Só loga erro detalhado se não for timeout/conexão
        const isTimeoutError = error.message && (
            error.message.includes('Connection terminated') ||
            error.message.includes('ETIMEDOUT') ||
            error.message.includes('ECONNREFUSED') ||
            error.message.includes('timeout')
        );

        if (!isTimeoutError) {
            console.error('[AGHUse Client] Erro ao buscar consultas desmarcadas:', error.message);
        }
        throw error;
    }
}

/**
 * Busca consultas que acontecerão em 72 horas (para envio de lembrete)
 */
export async function fetchAppointmentsIn72Hours() {
    try {
        const response = await fetch(`${BACKEND_URL}/aghuse/appointments-72h`);

        if (!response.ok) {
            const errorText = await response.text();
            let errorData;
            try {
                errorData = JSON.parse(errorText);
            } catch (e) {
                throw new Error(`Erro HTTP ${response.status}: ${errorText}`);
            }
            throw new Error(errorData.error || `Erro HTTP ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(data.error || 'Erro desconhecido ao buscar consultas 72h');
        }

        // Transforma os dados
        return data.appointments.map(row => transformAppointmentData(row));

    } catch (error) {
        // Só loga erro detalhado se não for timeout/conexão
        const isTimeoutError = error.message && (
            error.message.includes('Connection terminated') ||
            error.message.includes('ETIMEDOUT') ||
            error.message.includes('ECONNREFUSED') ||
            error.message.includes('timeout')
        );

        if (!isTimeoutError) {
            console.error('[AGHUse Client] Erro ao buscar consultas 72h:', error.message);
        }
        throw error;
    }
}

export default {
    testConnection,
    fetchRecentlyScheduledAppointments,
    fetchRecentlyCancelledAppointments,
    fetchAppointmentsIn72Hours
};
