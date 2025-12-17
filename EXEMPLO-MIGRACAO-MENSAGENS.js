/**
 * ============================================================
 * EXEMPLO DE MIGRAÇÃO: Sistema de Mensagens Centralizadas
 * ============================================================
 *
 * Este arquivo demonstra COMO migrar o código existente do
 * server.js para usar o novo sistema de mensagens centralizadas.
 *
 * Não execute este arquivo - use como referência para migração.
 * ============================================================
 */

// ============================================================
// PASSO 1: IMPORTAR O SERVIÇO (no topo do server.js)
// ============================================================

const MensagensWhatsApp = require('./server/database/mensagensWhatsApp.service');

// ============================================================
// PASSO 2: INICIALIZAR (após conectar ao banco de dados)
// ============================================================

// Inicializa o serviço de mensagens
console.log('[Sistema] Inicializando sistema de mensagens...');
MensagensWhatsApp.initialize();
console.log('[Sistema] ✅ Sistema de mensagens pronto');

// ============================================================
// EXEMPLO 1: MIGRAÇÃO DE RESPOSTAS DE CONFIRMAÇÃO
// ============================================================

// ❌ CÓDIGO ANTIGO (server.js linhas 796-802)
/*
if (respostaDetectada === 'confirmed') {
    await msg.reply('✅ *Presença confirmada!* Obrigado. Aguardamos você na data e horário marcados.\n\n_HMASP - Central de Marcação de Consultas_');
} else if (respostaDetectada === 'declined') {
    await msg.reply('❌ *Entendido.* Sua consulta foi desmarcada. Em caso de dúvidas, entre em contato com a Central de Marcação de Consultas.\n\n_HMASP - Central de Marcação de Consultas_');
} else if (respostaDetectada === 'not_scheduled') {
    await msg.reply('⚠️ *Obrigado pelo retorno.* Verificaremos o agendamento. Se necessário, entraremos em contato.\n\n_HMASP - Central de Marcação de Consultas_');
}
*/

// ✅ CÓDIGO NOVO (RECOMENDADO)
if (respostaDetectada) {
    // Mapeia resposta para código de mensagem
    const mapRespostaParaCodigo = {
        'confirmed': 'confirmacao_presenca_aprovada',
        'declined': 'confirmacao_presenca_declinada',
        'not_scheduled': 'confirmacao_nao_agendada'
    };

    const codigoMensagem = mapRespostaParaCodigo[respostaDetectada];

    if (codigoMensagem) {
        // Busca e renderiza mensagem
        const textoMensagem = MensagensWhatsApp.renderMensagem(codigoMensagem);

        if (textoMensagem) {
            // Envia mensagem
            await msg.reply(textoMensagem);

            // Registra envio para auditoria
            MensagensWhatsApp.registrarEnvio({
                codigo: codigoMensagem,
                telefone: phoneNumber,
                confirmacaoId: confirmacaoId,
                textoEnviado: textoMensagem,
                contexto: 'confirmacao',
                status: 'enviado',
                enviadoPor: 'sistema'
            });

            console.log(`[WhatsApp] ✅ Mensagem ${codigoMensagem} enviada para ${phoneNumber}`);
        } else {
            console.error(`[WhatsApp] ❌ Mensagem ${codigoMensagem} não encontrada`);
        }
    }
}

// ============================================================
// EXEMPLO 2: MIGRAÇÃO DE RESPOSTAS DE DESMARCAÇÃO
// ============================================================

// ❌ CÓDIGO ANTIGO (server.js linhas 787-794)
/*
if (tipoDesmarcacao === 'reagendamento') {
    await msg.reply('✅ *Agradecemos o retorno!*\n\nSua consulta será reagendada...');
} else if (tipoDesmarcacao === 'sem_reagendamento') {
    await msg.reply('✅ *Agradecemos pela informação!*\n\nCaso precise...');
} else if (tipoDesmarcacao === 'paciente_solicitou') {
    await msg.reply('✅ *Agradecemos o retorno!*\n\nCompreendemos...');
}
*/

// ✅ CÓDIGO NOVO (RECOMENDADO)
if (tipoDesmarcacao) {
    // Mapeia tipo de desmarcação para código de mensagem
    const mapDesmarcacaoParaCodigo = {
        'reagendamento': 'desmarcacao_solicita_reagendamento',
        'sem_reagendamento': 'desmarcacao_sem_reagendamento',
        'paciente_solicitou': 'desmarcacao_paciente_solicitou'
    };

    const codigoMensagem = mapDesmarcacaoParaCodigo[tipoDesmarcacao];

    if (codigoMensagem) {
        const textoMensagem = MensagensWhatsApp.renderMensagem(codigoMensagem);

        if (textoMensagem) {
            await msg.reply(textoMensagem);

            MensagensWhatsApp.registrarEnvio({
                codigo: codigoMensagem,
                telefone: phoneNumber,
                confirmacaoId: confirmacaoId,
                textoEnviado: textoMensagem,
                contexto: 'desmarcacao',
                status: 'enviado',
                enviadoPor: 'sistema'
            });

            console.log(`[WhatsApp] ✅ Mensagem ${codigoMensagem} enviada`);
        }
    }
}

// ============================================================
// EXEMPLO 3: MIGRAÇÃO DE MENSAGENS DE ERRO (COM VARIÁVEIS)
// ============================================================

// ❌ CÓDIGO ANTIGO (server.js linhas 853-857)
/*
await msg.reply(`⚠️ *Número inválido.*\n\n` +
    `Você digitou "${body}", mas as opções disponíveis são apenas:\n\n` +
    opcoesTexto +
    `\n\nPor favor, responda com *1*, *2* ou *3*.\n\n` +
    `_HMASP - Central de Marcação de Consultas_`);
*/

// ✅ CÓDIGO NOVO (COM SUBSTITUIÇÃO DE VARIÁVEIS)
const opcoesTexto = contexto === 'desmarcacao'
    ? '1️⃣ - Quero reagendar\n2️⃣ - Eu que desmarcou\n3️⃣ - Não quero reagendar'
    : '1️⃣ - Confirmo minha presença\n2️⃣ - Não poderei ir\n3️⃣ - Não agendei essa consulta';

const textoMensagem = MensagensWhatsApp.renderMensagem(
    'erro_numero_invalido',
    {
        numero: body,
        opcoes: opcoesTexto
    }
);

if (textoMensagem) {
    await msg.reply(textoMensagem);

    MensagensWhatsApp.registrarEnvio({
        codigo: 'erro_numero_invalido',
        telefone: phoneNumber,
        textoEnviado: textoMensagem,
        variaveis: { numero: body, opcoes: opcoesTexto },
        contexto: contexto,
        status: 'enviado'
    });
}

// ============================================================
// EXEMPLO 4: MENSAGENS DE ERRO PROGRESSIVAS (TENTATIVAS)
// ============================================================

// ❌ CÓDIGO ANTIGO (server.js linhas 919-935)
/*
if (attempts === 1) {
    await msg.reply('❓ *Desculpe, não entendi sua resposta.*\n\nPor favor...');
} else if (attempts === 2) {
    await msg.reply('⚠️ *Por favor, digite apenas o número: 1, 2 ou 3*\n\nExemplo...');
} else if (attempts > 2) {
    await msg.reply('❌ *Não conseguimos processar sua resposta automaticamente.*...');
}
*/

// ✅ CÓDIGO NOVO (USANDO getMensagemErro)
const mensagemErro = MensagensWhatsApp.getMensagemErro(contexto, attempts);

if (mensagemErro) {
    await msg.reply(mensagemErro.texto);

    MensagensWhatsApp.registrarEnvio({
        codigo: mensagemErro.codigo,
        telefone: phoneNumber,
        confirmacaoId: confirmacaoId,
        textoEnviado: mensagemErro.texto,
        contexto: contexto,
        status: 'enviado',
        enviadoPor: 'sistema'
    });

    console.log(`[WhatsApp] Mensagem de erro tentativa ${attempts} enviada`);
}

// ============================================================
// EXEMPLO 5: MENSAGEM SEM CONTEXTO (FALLBACK)
// ============================================================

// ❌ CÓDIGO ANTIGO (server.js linhas 943-952)
/*
await msg.reply('✅ *Olá! Agradecemos o contato.*\n\n' +
    'Este é nosso sistema automatizado de confirmação de presença...');
*/

// ✅ CÓDIGO NOVO
const textoMensagem = MensagensWhatsApp.renderMensagem('sem_contexto_boasvindas');

if (textoMensagem) {
    await msg.reply(textoMensagem);

    MensagensWhatsApp.registrarEnvio({
        codigo: 'sem_contexto_boasvindas',
        telefone: phoneNumber,
        textoEnviado: textoMensagem,
        contexto: null,
        status: 'enviado'
    });
}

// ============================================================
// EXEMPLO 6: FUNÇÃO AUXILIAR PARA SIMPLIFICAR ENVIOS
// ============================================================

/**
 * Função auxiliar para enviar mensagem centralizada
 * @param {Object} msg - Objeto de mensagem do WhatsApp
 * @param {string} codigo - Código da mensagem
 * @param {Object} variaveis - Variáveis para substituição (opcional)
 * @param {Object} dadosLog - Dados adicionais para log (opcional)
 */
async function enviarMensagemCentralizada(msg, codigo, variaveis = {}, dadosLog = {}) {
    try {
        // Renderiza mensagem
        const textoMensagem = MensagensWhatsApp.renderMensagem(codigo, variaveis);

        if (!textoMensagem) {
            console.error(`[WhatsApp] ❌ Mensagem ${codigo} não encontrada`);
            return false;
        }

        // Envia
        await msg.reply(textoMensagem);

        // Registra
        MensagensWhatsApp.registrarEnvio({
            codigo: codigo,
            telefone: dadosLog.telefone || msg.from,
            confirmacaoId: dadosLog.confirmacaoId || null,
            textoEnviado: textoMensagem,
            variaveis: variaveis,
            contexto: dadosLog.contexto || null,
            status: 'enviado',
            enviadoPor: dadosLog.enviadoPor || 'sistema'
        });

        console.log(`[WhatsApp] ✅ Mensagem ${codigo} enviada`);
        return true;

    } catch (error) {
        console.error(`[WhatsApp] ❌ Erro ao enviar mensagem ${codigo}:`, error);

        // Registra erro
        MensagensWhatsApp.registrarEnvio({
            codigo: codigo,
            telefone: dadosLog.telefone || msg.from,
            textoEnviado: null,
            variaveis: variaveis,
            status: 'erro',
            erro_detalhes: error.message
        });

        return false;
    }
}

// ============================================================
// EXEMPLO 7: USO DA FUNÇÃO AUXILIAR (SIMPLIFICADO)
// ============================================================

// Confirmação de presença
if (respostaDetectada === 'confirmed') {
    await enviarMensagemCentralizada(
        msg,
        'confirmacao_presenca_aprovada',
        {},
        {
            telefone: phoneNumber,
            confirmacaoId: confirmacaoId,
            contexto: 'confirmacao'
        }
    );
}

// Erro com variáveis
const opcoesTexto = '1️⃣ - Confirmo\n2️⃣ - Não poderei\n3️⃣ - Não agendei';
await enviarMensagemCentralizada(
    msg,
    'erro_numero_invalido',
    { numero: body, opcoes: opcoesTexto },
    { telefone: phoneNumber, contexto: 'confirmacao' }
);

// Erro progressivo
const mensagemErro = MensagensWhatsApp.getMensagemErro('confirmacao', attempts);
if (mensagemErro) {
    await enviarMensagemCentralizada(
        msg,
        mensagemErro.codigo,
        {},
        {
            telefone: phoneNumber,
            confirmacaoId: confirmacaoId,
            contexto: 'confirmacao'
        }
    );
}

// ============================================================
// EXEMPLO 8: BLOCO COMPLETO MIGRADO
// ============================================================

// Este é um exemplo completo de como ficaria o bloco de respostas
// no server.js após a migração

client.on('message', async msg => {
    const body = msg.body.trim().toLowerCase();
    const phoneNumber = msg.from.replace('@c.us', '');

    // ... (código de detecção de resposta permanece igual) ...

    // RESPOSTAS PARA DESMARCAÇÃO
    if (tipoDesmarcacao) {
        const mapDesmarcacaoParaCodigo = {
            'reagendamento': 'desmarcacao_solicita_reagendamento',
            'sem_reagendamento': 'desmarcacao_sem_reagendamento',
            'paciente_solicitou': 'desmarcacao_paciente_solicitou'
        };

        await enviarMensagemCentralizada(
            msg,
            mapDesmarcacaoParaCodigo[tipoDesmarcacao],
            {},
            { telefone: phoneNumber, confirmacaoId, contexto: 'desmarcacao' }
        );
    }
    // RESPOSTAS PARA CONFIRMAÇÃO DE PRESENÇA
    else if (respostaDetectada) {
        const mapRespostaParaCodigo = {
            'confirmed': 'confirmacao_presenca_aprovada',
            'declined': 'confirmacao_presenca_declinada',
            'not_scheduled': 'confirmacao_nao_agendada'
        };

        await enviarMensagemCentralizada(
            msg,
            mapRespostaParaCodigo[respostaDetectada],
            {},
            { telefone: phoneNumber, confirmacaoId, contexto: 'confirmacao' }
        );
    }
    // VALIDAÇÃO DE ENTRADA
    else {
        // Incrementa tentativas
        const attempts = (contextAttempts.get(chatId) || 0) + 1;
        contextAttempts.set(chatId, attempts);

        // Mensagens progressivas de erro
        const mensagemErro = MensagensWhatsApp.getMensagemErro(contexto, attempts);

        if (mensagemErro) {
            await enviarMensagemCentralizada(
                msg,
                mensagemErro.codigo,
                {},
                { telefone: phoneNumber, confirmacaoId, contexto }
            );
        }

        // Se passar de 3 tentativas, limpa contexto
        if (attempts > 3) {
            contextAttempts.delete(chatId);
            // ... (resto do código de limpeza)
        }
    }
});

// ============================================================
// BENEFÍCIOS DA MIGRAÇÃO
// ============================================================

/*
✅ Código mais limpo e organizado
✅ Mensagens centralizadas e fáceis de manter
✅ Auditoria completa de envios
✅ Estatísticas de uso automáticas
✅ Versionamento de mensagens
✅ Facilita tradução futura
✅ Reduz duplicação de código
✅ Permite A/B testing
✅ Facilita testes automatizados
*/

// ============================================================
// CHECKLIST DE MIGRAÇÃO
// ============================================================

/*
PASSO A PASSO PARA MIGRAR:

□ 1. Adicionar import do serviço no topo do server.js
□ 2. Inicializar serviço após conectar ao banco
□ 3. Criar função auxiliar enviarMensagemCentralizada()
□ 4. Migrar respostas de confirmação (linhas 796-802)
□ 5. Migrar respostas de desmarcação (linhas 787-794)
□ 6. Migrar mensagens de erro (linhas 853-952)
□ 7. Migrar mensagem sem contexto (linhas 943-952)
□ 8. Testar cada fluxo migrado
□ 9. Verificar logs de envio no banco
□ 10. Analisar estatísticas de uso

TESTES NECESSÁRIOS:
□ Confirmar presença (opção 1)
□ Declinar presença (opção 2)
□ Informar não agendou (opção 3)
□ Reagendar desmarcação (opção 1)
□ Desmarcação paciente solicitou (opção 2)
□ Sem reagendamento (opção 3)
□ Resposta inválida (tentativa 1)
□ Resposta inválida (tentativa 2)
□ Resposta inválida (tentativa 3+)
□ Mensagem sem contexto
*/

// ============================================================
// OBSERVAÇÕES IMPORTANTES
// ============================================================

/*
1. NÃO DELETE O CÓDIGO ANTIGO IMEDIATAMENTE
   - Comente o código antigo e mantenha por alguns dias
   - Facilita rollback se necessário

2. MIGRE GRADUALMENTE
   - Comece com um fluxo (ex: confirmação)
   - Teste bem antes de migrar o próximo
   - Monitore logs e estatísticas

3. VERIFIQUE LOGS
   - Acompanhe tabela mensagens_envios_log
   - Certifique-se que todos envios são registrados
   - Use estatísticas para identificar problemas

4. MANTENHA COMPATIBILIDADE
   - Se algo falhar, código deve degradar graciosamente
   - Sempre tenha fallback para mensagem hard-coded

5. DOCUMENTE MUDANÇAS
   - Atualize comentários no código
   - Mantenha CHANGELOG atualizado
   - Informe equipe sobre mudanças
*/

module.exports = {
    enviarMensagemCentralizada
};
