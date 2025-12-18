/**
 * Serviço de Classificação de Intenções (Intent Classifier)
 *
 * Responsável por:
 * - Detectar intenção de mensagens recebidas (NLP + Keywords + Números)
 * - Normalizar texto antes da análise
 * - Retornar intent + confidence score
 * - Priorizar números diretos (1, 2, 3) sobre keywords
 *
 * Intenções suportadas:
 * - Confirmação: confirmed
 * - Não poderá: declined
 * - Não agendou: not_scheduled
 * - Reagendamento: reagendamento
 * - Paciente solicitou: paciente_solicitou
 * - Sem reagendamento: sem_reagendamento
 * - Conversa livre: free_talk
 * - Atendente humano: human_agent
 */

/**
 * Normaliza texto para análise
 * Remove espaços extras, pontuação desnecessária, lowercase, normaliza acentos
 *
 * @param {string} text - Texto original
 * @returns {string} - Texto normalizado
 */
function normalizeText(text) {
    if (!text || typeof text !== 'string') {
        return '';
    }

    return text
        .toLowerCase()
        .trim()
        // Remove múltiplos espaços
        .replace(/\s+/g, ' ')
        // Remove pontuação (mas mantém números)
        .replace(/[^\w\sáàâãéêíóôõúçñ]/g, ' ')
        // Normaliza acentos
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .trim();
}

/**
 * Detecta números diretos (1, 2, 3)
 * Maior prioridade na detecção
 *
 * @param {string} text - Texto normalizado
 * @returns {Object|null} - {intent, confidence} ou null
 */
function detectDirectNumber(text) {
    // Padrões exatos de números
    const patterns = [
        /^1$/,           // exato
        /^1\s*$/,        // com espaços
        /^1\.$/,         // com ponto
        /^1\)$/,         // com parêntese
        /^\s*1\s*$/,     // com espaços ao redor
    ];

    // Testa 1
    if (patterns.some(pattern => pattern.test(text))) {
        return { intent: 'number_1', confidence: 1.0 };
    }

    // Testa 2
    const patterns2 = patterns.map(p =>
        new RegExp(p.source.replace(/1/g, '2'))
    );
    if (patterns2.some(pattern => pattern.test(text))) {
        return { intent: 'number_2', confidence: 1.0 };
    }

    // Testa 3
    const patterns3 = patterns.map(p =>
        new RegExp(p.source.replace(/1/g, '3'))
    );
    if (patterns3.some(pattern => pattern.test(text))) {
        return { intent: 'number_3', confidence: 1.0 };
    }

    return null;
}

/**
 * Detecta keywords por categoria de intenção
 *
 * @param {string} text - Texto normalizado
 * @returns {Object|null} - {intent, confidence, matches} ou null
 */
function detectKeywords(text) {
    // Dicionários de keywords por intenção
    const keywordDictionaries = {
        confirmed: {
            keywords: [
                'confirmo', 'sim', 'vou', 'presenca', 'confirmada',
                'ok', 'confirmado', 'estarei', 'irei', 'vou sim',
                'confirmar', 'certo', 'tranquilo', 'pode ser',
                'com certeza', 'claro'
            ],
            baseConfidence: 0.85
        },
        declined: {
            keywords: [
                'nao', 'naovou', 'nao poderei', 'nao vou', 'faltarei',
                'desmarcar', 'cancelar', 'nao posso', 'impossivel',
                'impedimento', 'nao consigo', 'nao conseguirei',
                'tenho compromisso', 'nao da'
            ],
            baseConfidence: 0.85
        },
        not_scheduled: {
            keywords: [
                'nao agendei', 'nao solicitei', 'nao marquei',
                'nao fui eu', 'erro', 'engano', 'nao pedi',
                'nao era pra mim', 'numero errado'
            ],
            baseConfidence: 0.90
        },
        reagendamento: {
            keywords: [
                'reagendamento', 'reagendar', 'preciso',
                'por favor reagendar', 'remarcar', 'nova data',
                'outra data', 'mudar data', 'marcar novamente',
                'agendar de novo', 'solicito reagendamento'
            ],
            baseConfidence: 0.85
        },
        paciente_solicitou: {
            keywords: [
                'fui eu', 'foi eu', 'eu pedi', 'eu solicitei',
                'eu que desmarcou', 'eu mesmo', 'fui eu mesmo',
                'solicitei a desmarcacao', 'eu desmarcou'
            ],
            baseConfidence: 0.90
        },
        sem_reagendamento: {
            keywords: [
                'nao e necessario', 'nao precisa', 'sem reagendamento',
                'nao quero', 'nao preciso', 'esta tudo bem',
                'tudo certo', 'sem necessidade', 'pode deixar'
            ],
            baseConfidence: 0.85
        },
        human_agent: {
            keywords: [
                'humano', 'atendente', 'pessoa', 'operador',
                'falar com alguem', 'preciso falar', 'quero falar',
                'atendimento humano', 'nao entendi', 'nao estou entendendo'
            ],
            baseConfidence: 0.95
        }
    };

    let bestMatch = null;

    // Procura keywords em cada categoria
    for (const [intent, config] of Object.entries(keywordDictionaries)) {
        const matches = config.keywords.filter(keyword => text.includes(keyword));

        if (matches.length > 0) {
            // Calcula confidence baseado em número de matches
            const confidence = Math.min(
                config.baseConfidence + (matches.length * 0.05),
                0.98
            );

            if (!bestMatch || confidence > bestMatch.confidence) {
                bestMatch = {
                    intent,
                    confidence,
                    matches,
                    matchCount: matches.length
                };
            }
        }
    }

    return bestMatch;
}

/**
 * Classificador NLP simples (sem dependências externas)
 * Analisa padrões de linguagem natural
 *
 * @param {string} text - Texto normalizado
 * @returns {Object|null} - {intent, confidence} ou null
 */
function nlpClassify(text) {
    // Padrões de confirmação
    const confirmationPatterns = [
        /\b(vou|irei|estarei)\s+(la|presente|ai)\b/,
        /\b(pode|podem)\s+confirmar\b/,
        /\b(esta|tudo)\s+confirmado\b/
    ];

    // Padrões de recusa
    const declinePatterns = [
        /\bnao\s+(vou|poderei|consigo|posso)\b/,
        /\b(impossivel|impedido|impedimento)\b/,
        /\btenho\s+compromisso\b/
    ];

    // Padrões de não agendamento
    const notScheduledPatterns = [
        /\bnao\s+(agendei|marquei|solicitei)\b/,
        /\b(engano|erro)\b/
    ];

    // Testa padrões
    if (confirmationPatterns.some(pattern => pattern.test(text))) {
        return { intent: 'confirmed', confidence: 0.75 };
    }

    if (declinePatterns.some(pattern => pattern.test(text))) {
        return { intent: 'declined', confidence: 0.75 };
    }

    if (notScheduledPatterns.some(pattern => pattern.test(text))) {
        return { intent: 'not_scheduled', confidence: 0.75 };
    }

    return null;
}

/**
 * Classifica intenção de uma mensagem
 * Pipeline: Números diretos > Keywords > NLP > Free talk
 *
 * @param {string} rawText - Texto original da mensagem
 * @param {string} context - Contexto da conversa ('confirmacao' ou 'desmarcacao')
 * @returns {Object} - {intent, confidence, rawIntent, normalized}
 */
export function classifyIntent(rawText, context = null) {
    // Normaliza texto
    const normalized = normalizeText(rawText);

    if (!normalized) {
        return {
            intent: 'unknown',
            confidence: 0,
            rawIntent: null,
            normalized: '',
            context
        };
    }

    // 1. PRIORIDADE MÁXIMA: Números diretos (1, 2, 3)
    const numberDetection = detectDirectNumber(normalized);
    if (numberDetection) {
        // Mapeia número para intent baseado no contexto
        const intent = mapNumberToIntent(numberDetection.intent, context);
        return {
            intent,
            confidence: numberDetection.confidence,
            rawIntent: numberDetection.intent,
            normalized,
            context,
            method: 'direct_number'
        };
    }

    // 2. KEYWORDS: Alta confiança
    const keywordDetection = detectKeywords(normalized);
    if (keywordDetection && keywordDetection.confidence >= 0.75) {
        return {
            intent: keywordDetection.intent,
            confidence: keywordDetection.confidence,
            rawIntent: keywordDetection.intent,
            normalized,
            context,
            method: 'keyword',
            matches: keywordDetection.matches
        };
    }

    // 3. NLP: Média confiança
    const nlpDetection = nlpClassify(normalized);
    if (nlpDetection && nlpDetection.confidence >= 0.55) {
        return {
            intent: nlpDetection.intent,
            confidence: nlpDetection.confidence,
            rawIntent: nlpDetection.intent,
            normalized,
            context,
            method: 'nlp'
        };
    }

    // 4. Se teve keyword mas baixa confiança, retorna mesmo assim com flag
    if (keywordDetection) {
        return {
            intent: keywordDetection.intent,
            confidence: keywordDetection.confidence,
            rawIntent: keywordDetection.intent,
            normalized,
            context,
            method: 'keyword_low_confidence',
            matches: keywordDetection.matches,
            needsConfirmation: true
        };
    }

    // 5. FALLBACK: Conversa livre
    return {
        intent: 'free_talk',
        confidence: 0.3,
        rawIntent: 'free_talk',
        normalized,
        context,
        method: 'fallback'
    };
}

/**
 * Mapeia número para intent baseado no contexto
 *
 * @param {string} numberIntent - 'number_1', 'number_2' ou 'number_3'
 * @param {string} context - 'confirmacao' ou 'desmarcacao'
 * @returns {string} - Intent mapeado
 */
function mapNumberToIntent(numberIntent, context) {
    const mappings = {
        confirmacao: {
            'number_1': 'confirmed',
            'number_2': 'declined',
            'number_3': 'not_scheduled'
        },
        desmarcacao: {
            'number_1': 'reagendamento',
            'number_2': 'paciente_solicitou',
            'number_3': 'sem_reagendamento'
        }
    };

    if (context && mappings[context]) {
        return mappings[context][numberIntent] || 'unknown';
    }

    // Sem contexto, retorna o número puro para decisão posterior
    return numberIntent;
}

/**
 * Valida se a intenção é compatível com o contexto
 *
 * @param {string} intent - Intenção detectada
 * @param {string} context - Contexto da conversa
 * @returns {boolean} - true se compatível
 */
export function isIntentCompatibleWithContext(intent, context) {
    const compatibilityMap = {
        confirmacao: ['confirmed', 'declined', 'not_scheduled', 'human_agent'],
        desmarcacao: ['reagendamento', 'paciente_solicitou', 'sem_reagendamento', 'human_agent']
    };

    if (!context || !compatibilityMap[context]) {
        return true; // Sem contexto, aceita tudo
    }

    return compatibilityMap[context].includes(intent);
}

/**
 * Gera mensagem de clarificação quando confidence é baixo
 *
 * @param {Object} classification - Resultado da classificação
 * @param {Object} lastSystemMessage - Última mensagem do sistema
 * @returns {string} - Mensagem de clarificação
 */
export function generateClarificationMessage(classification, lastSystemMessage) {
    if (classification.confidence >= 0.75) {
        return null; // Não precisa clarificação
    }

    if (classification.confidence >= 0.55 && lastSystemMessage) {
        // Confiança média: pede confirmação rápida
        return `Você quis dizer "${getIntentLabel(classification.intent)}"? Responda *1* para sim, *2* para não.`;
    }

    // Confiança baixa: pede para responder com número
    if (lastSystemMessage) {
        const { especialidade, dataHoraFormatada, type } = lastSystemMessage;

        if (type === 'confirmacao') {
            return `❓ *Desculpe, não entendi sua resposta.*\n\n` +
                `Por favor, escolha uma das opções abaixo respondendo apenas com o número:\n\n` +
                `1️⃣ - Confirmo minha presença\n` +
                `2️⃣ - Não poderei ir\n` +
                `3️⃣ - Não agendei essa consulta\n\n` +
                `_HMASP - Central de Marcação de Consultas_`;
        } else if (type === 'desmarcacao') {
            return `❓ *Desculpe, não entendi sua resposta.*\n\n` +
                `Por favor, escolha uma das opções abaixo respondendo apenas com o número:\n\n` +
                `1️⃣ - Quero reagendar\n` +
                `2️⃣ - Eu que desmarcou\n` +
                `3️⃣ - Não quero reagendar\n\n` +
                `_HMASP - Central de Marcação de Consultas_`;
        }
    }

    return `⚠️ *Por favor, digite apenas o número: 1, 2 ou 3*\n\n` +
        `Exemplo: digite apenas *1* para confirmar sua presença.\n\n` +
        `_HMASP - Central de Marcação de Consultas_`;
}

/**
 * Retorna label legível da intenção
 *
 * @param {string} intent - Intenção
 * @returns {string} - Label legível
 */
function getIntentLabel(intent) {
    const labels = {
        confirmed: 'Confirmo presença',
        declined: 'Não poderei comparecer',
        not_scheduled: 'Não agendei essa consulta',
        reagendamento: 'Solicito reagendamento',
        paciente_solicitou: 'Fui eu quem solicitei',
        sem_reagendamento: 'Não é necessário reagendar',
        human_agent: 'Falar com atendente',
        free_talk: 'Conversa livre'
    };

    return labels[intent] || intent;
}

export default {
    classifyIntent,
    isIntentCompatibleWithContext,
    generateClarificationMessage,
    normalizeText
};
