// Testa a query com filtro de situação = 'L'
const aghuseServer = require('./server/aghuse-server.js');

async function testFiltroLivre() {
    try {
        console.log('\n=== TESTANDO QUERY COM FILTRO DE CONSULTAS LIVRES ===\n');

        // Busca consultas desmarcadas (apenas LIVRES)
        const cancelled = await aghuseServer.fetchRecentlyCancelledAppointments(120);

        console.log(`✅ Encontradas ${cancelled.length} consultas desmarcadas E AINDA LIVRES\n`);

        if (cancelled.length === 0) {
            console.log('⚠️ Nenhuma consulta desmarcada encontrada que ainda esteja LIVRE');
            console.log('   (consultas que foram remarcadas não aparecem mais)\n');
        } else {
            // Mostra todas
            cancelled.forEach((cons, index) => {
                const dataDesm = new Date(cons.data_hora_desmarcacao);
                const dia = String(dataDesm.getDate()).padStart(2, '0');
                const mes = String(dataDesm.getMonth() + 1).padStart(2, '0');
                const hora = String(dataDesm.getHours()).padStart(2, '0');
                const min = String(dataDesm.getMinutes()).padStart(2, '0');

                console.log(`${index + 1}. Consulta ${cons.consulta_numero}`);
                console.log(`   Paciente: ${cons.nome_paciente}`);
                console.log(`   Especialidade: ${cons.especialidade}`);
                console.log(`   🗓️ Desmarcada em: ${dia}/${mes} às ${hora}:${min}`);
                console.log(`   Situação atual: ${cons.situacao_codigo} - ${cons.situacao_descricao}`);
                console.log('');
            });

            // Busca RENATA
            const renata = cancelled.find(c => c.consulta_numero === 523560);
            if (renata) {
                console.log('✅ RENATA ENCONTRADA!');
                console.log(`   Data de desmarcação: ${renata.data_hora_desmarcacao}`);
            } else {
                console.log('❌ RENATA NÃO ENCONTRADA (pode ter sido remarcada)');
            }
        }

        await aghuseServer.closeConnection();

    } catch (error) {
        console.error('\n❌ Erro:', error.message);
        await aghuseServer.closeConnection();
        process.exit(1);
    }
}

testFiltroLivre();
