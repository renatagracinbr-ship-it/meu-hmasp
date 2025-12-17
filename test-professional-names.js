// Testa se os nomes dos profissionais estão vindo
const aghuseServer = require('./server/aghuse-server.js');

async function testProfessionalNames() {
    try {
        console.log('\n=== TESTANDO NOMES DOS PROFISSIONAIS ===\n');

        // Busca consultas desmarcadas
        const cancelled = await aghuseServer.fetchRecentlyCancelledAppointments(120);

        console.log(`✅ Encontradas ${cancelled.length} consultas desmarcadas\n`);

        // Mostra as primeiras 10 com o nome do profissional
        cancelled.slice(0, 10).forEach((cons, index) => {
            console.log(`${index + 1}. Consulta ${cons.consulta_numero}`);
            console.log(`   Paciente: ${cons.nome_paciente}`);
            console.log(`   Especialidade: ${cons.especialidade}`);
            console.log(`   👨‍⚕️ Profissional: ${cons.profissional_nome || 'NULL'}`);
            console.log(`   📍 Local: ${cons.local_descricao || 'NULL'}`);
            console.log('');
        });

        // Conta quantos têm nome de profissional
        const comNome = cancelled.filter(c => c.profissional_nome && c.profissional_nome !== 'Não informado').length;
        const semNome = cancelled.length - comNome;

        console.log('\n=== ESTATÍSTICAS ===');
        console.log(`Total: ${cancelled.length}`);
        console.log(`Com nome do profissional: ${comNome} (${(comNome/cancelled.length*100).toFixed(1)}%)`);
        console.log(`Sem nome do profissional: ${semNome} (${(semNome/cancelled.length*100).toFixed(1)}%)`);

        await aghuseServer.closeConnection();

    } catch (error) {
        console.error('\n❌ Erro:', error.message);
        console.error(error);
        await aghuseServer.closeConnection();
        process.exit(1);
    }
}

testProfessionalNames();
