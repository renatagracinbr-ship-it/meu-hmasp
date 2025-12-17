// Testa a query corrigida do servidor
const aghuseServer = require('./server/aghuse-server.js');

async function testQuery() {
    try {
        console.log('\n=== TESTANDO QUERY CORRIGIDA DO SERVIDOR ===\n');

        // Testa conexão
        const conn = await aghuseServer.testConnection();
        console.log('✅ Conexão OK:', conn.timestamp);

        // Busca consultas desmarcadas
        console.log('\nBuscando consultas desmarcadas nas últimas 2 horas...\n');
        const cancelled = await aghuseServer.fetchRecentlyCancelledAppointments(120);

        console.log(`✅ Encontradas ${cancelled.length} consultas desmarcadas\n`);

        // Mostra as primeiras 5
        cancelled.slice(0, 5).forEach((cons, index) => {
            console.log(`${index + 1}. Consulta ${cons.consulta_numero}`);
            console.log(`   Paciente: ${cons.nome_paciente} (Pront: ${cons.prontuario})`);
            console.log(`   Especialidade: ${cons.especialidade}`);
            console.log(`   Data consulta: ${cons.data_hora_consulta}`);
            console.log(`   Desmarcada em: ${cons.data_hora_desmarcacao}`);
            console.log(`   Situação atual: ${cons.situacao_codigo} - ${cons.situacao_descricao}`);
            console.log(`   Telefones: Cel: ${cons.telefone_celular || 'N/A'}, Fixo: ${cons.telefone_fixo || 'N/A'}`);
            console.log('');
        });

        // Busca específica por RENATA
        console.log('=== BUSCA ESPECÍFICA: RENATA (Consulta 523560) ===\n');
        const renata = cancelled.find(c => c.consulta_numero === 523560);
        if (renata) {
            console.log('✅ ENCONTRADA!');
            console.log(`   Paciente: ${renata.nome_paciente}`);
            console.log(`   Prontuário: ${renata.prontuario}`);
            console.log(`   Especialidade: ${renata.especialidade}`);
            console.log(`   Desmarcada em: ${renata.data_hora_desmarcacao}`);
            console.log(`   Situação atual: ${renata.situacao_codigo} - ${renata.situacao_descricao}`);
        } else {
            console.log('❌ NÃO ENCONTRADA na lista');
        }

        await aghuseServer.closeConnection();
        console.log('\n✅ Teste concluído com sucesso!');

    } catch (error) {
        console.error('\n❌ Erro no teste:', error.message);
        console.error(error);
        await aghuseServer.closeConnection();
        process.exit(1);
    }
}

testQuery();
