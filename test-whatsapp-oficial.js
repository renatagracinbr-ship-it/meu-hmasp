/**
 * Script de teste para a API Oficial do WhatsApp
 * Execute: node test-whatsapp-oficial.js
 */

const WhatsAppAPI = require('./server/services/whatsappOfficialAPI.service');

async function runTests() {
    console.log('='.repeat(60));
    console.log('🧪 TESTE DA API OFICIAL DO WHATSAPP');
    console.log('='.repeat(60));

    // Mostra configurações atuais
    console.log('\n📋 Configurações:');
    console.log(WhatsAppAPI.getConfig());

    // Teste 1: Verificar status da conta
    console.log('\n' + '-'.repeat(60));
    console.log('📡 Teste 1: Verificando status da conta...');
    try {
        const status = await WhatsAppAPI.getAccountStatus();
        console.log('✅ Conta ativa!');
        console.log('   - ID:', status.id);
        console.log('   - Número:', status.display_phone_number);
        console.log('   - Status:', status.quality_rating);
    } catch (error) {
        console.error('❌ Erro:', error.message);
    }

    // Teste 2: Enviar mensagem de texto
    console.log('\n' + '-'.repeat(60));
    console.log('📤 Teste 2: Enviando mensagem de texto...');

    const numeroDestino = '5511974878925'; // Seu número

    try {
        const result = await WhatsAppAPI.sendTextMessage(
            numeroDestino,
            '🏥 *HMASP - Teste API Oficial*\n\nOlá! Esta é uma mensagem de teste da API Oficial do WhatsApp.\n\nSe você recebeu esta mensagem, a integração está funcionando! ✅'
        );

        console.log('✅ Mensagem enviada com sucesso!');
        console.log('   - Message ID:', result.messageId);
        console.log('   - WhatsApp ID:', result.waId);
    } catch (error) {
        console.error('❌ Erro ao enviar:', error.message);

        // Se for erro de template, tenta com template hello_world
        if (error.message.includes('template') || error.message.includes('24')) {
            console.log('\n⚠️ Tentando com template hello_world...');
            try {
                const result = await WhatsAppAPI.sendTemplateMessage(
                    numeroDestino,
                    'hello_world',
                    'en_US'
                );
                console.log('✅ Template enviado com sucesso!');
                console.log('   - Message ID:', result.messageId);
            } catch (err2) {
                console.error('❌ Erro no template:', err2.message);
            }
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log('🏁 Testes concluídos!');
    console.log('='.repeat(60));
}

// Executa os testes
runTests().catch(console.error);
