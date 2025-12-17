/**
 * Script para inicializar banco de contatos
 * Executa: node server/database/init-contatos.js
 */

const ContatosService = require('./contatos.service');

console.log('📋 Inicializando banco de dados de contatos...\n');

// Teste: buscar estatísticas
const stats = ContatosService.getEstatisticasGerais();
console.log('📊 Estatísticas Gerais:');
console.log(`   Total de contatos: ${stats.total_contatos}`);
console.log(`   Ativos: ${stats.ativos}`);
console.log(`   Com WhatsApp: ${stats.com_whatsapp}`);
console.log(`   Aceitam mensagens: ${stats.aceitam_mensagens}`);
console.log(`   Bloqueados: ${stats.bloqueados}`);
console.log(`   Taxa de resposta média: ${stats.taxa_resposta_media?.toFixed(2) || 0}%\n`);

// Teste: criar contato de exemplo (apenas se não existir)
const telefoneExemplo = '5511999999999';
const contatoExistente = ContatosService.buscarPorTelefone(telefoneExemplo);

if (!contatoExistente) {
    console.log('➕ Criando contato de exemplo...');

    try {
        const id = ContatosService.criarContato({
            telefone: telefoneExemplo,
            nome_completo: 'João da Silva Exemplo',
            nome_preferido: 'João',
            cpf: '123.456.789-00',
            data_nascimento: '1985-05-15',
            genero: 'M',
            prontuario: 'A000001',
            codigo_paciente: 12345,
            email: 'joao.exemplo@email.com',
            cep: '01310-100',
            logradouro: 'Avenida Paulista',
            numero: '1000',
            bairro: 'Bela Vista',
            cidade: 'São Paulo',
            estado: 'SP',
            plano_saude: 'Unimed',
            numero_carteirinha: '123456789012',
            aceita_mensagens: true,
            observacoes: 'Contato de exemplo criado automaticamente',
            criado_por: 'init-script'
        });

        console.log(`   ✅ Contato criado com ID: ${id}`);

        // Adiciona ao grupo VIP
        ContatosService.adicionarAoGrupo(id, 1, 'init-script'); // 1 = VIP
        console.log(`   ✅ Adicionado ao grupo VIP`);

        // Adiciona nota
        ContatosService.adicionarNota(
            id,
            'Este é um contato de exemplo criado para demonstração do sistema',
            'info',
            'init-script'
        );
        console.log(`   ✅ Nota adicionada\n`);

    } catch (error) {
        console.error('   ❌ Erro ao criar contato de exemplo:', error.message);
    }
} else {
    console.log(`ℹ️  Contato de exemplo já existe (ID: ${contatoExistente.id})\n`);
}

// Lista grupos disponíveis
console.log('📑 Grupos disponíveis:');
const grupos = require('better-sqlite3')('./server/database/contatos.db')
    .prepare('SELECT * FROM contatos_grupos WHERE ativo = 1 ORDER BY nome')
    .all();

grupos.forEach(g => {
    console.log(`   ${g.icone} ${g.nome} (ID: ${g.id}) - ${g.descricao}`);
});

console.log('\n✅ Banco de contatos inicializado com sucesso!');
console.log('\n📌 Rotas da API disponíveis:');
console.log('   GET    /api/contatos - Listar todos');
console.log('   POST   /api/contatos - Criar novo');
console.log('   GET    /api/contatos/:id - Buscar por ID');
console.log('   GET    /api/contatos/telefone/:telefone - Buscar por telefone');
console.log('   GET    /api/contatos/buscar/:nome - Buscar por nome');
console.log('   PUT    /api/contatos/:id - Atualizar');
console.log('   DELETE /api/contatos/:id - Desativar');
console.log('   POST   /api/contatos/:id/bloquear - Bloquear');
console.log('   POST   /api/contatos/interacoes - Registrar interação');
console.log('   GET    /api/contatos/stats/geral - Estatísticas');
console.log('   GET    /api/contatos/relatorios/sem-resposta - Sem resposta');
console.log('   GET    /api/contatos/relatorios/prioritarios - Prioritários');
console.log('');

ContatosService.close();
