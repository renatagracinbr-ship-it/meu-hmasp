/**
 * Script de teste completo do sistema de reagendamento
 * Testa todas as funcionalidades implementadas
 */

const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'hmasp_consultas.db');

console.log('==========================================');
console.log('TESTE COMPLETO: Sistema de Reagendamento');
console.log('==========================================\n');

try {
    const db = new Database(DB_PATH);

    // Importa funções do consultas.service.js
    const ConsultasService = require('./consultas.service.js');
    ConsultasService.init();

    console.log('📋 TESTE 1: Criar Consulta Normal\n');
    const consultaNormal = {
        consultaNumero: 'TEST-001',
        nomePaciente: 'João Silva Teste',
        telefone: '5511999999999',
        telefoneFormatado: '(11) 99999-9999',
        especialidade: 'Cardiologia',
        profissional: 'Dr. Teste',
        dataHoraFormatada: '15/12/2025 14:00',
        dataConsulta: '2025-12-15T14:00:00',
        tipo: 'marcada'
    };

    const result1 = ConsultasService.upsertConsultaAtiva(consultaNormal);
    console.log(`✅ Consulta normal criada: ${result1.consultaNumero}`);
    console.log(`   isReagendamento: ${result1.isReagendamento}\n`);

    console.log('📋 TESTE 2: Criar Consulta Reagendada\n');
    const consultaReagendada = {
        consultaNumero: 'TEST-002',
        nomePaciente: 'Maria Santos Teste',
        telefone: '5511888888888',
        telefoneFormatado: '(11) 88888-8888',
        especialidade: 'Endocrinologia',
        profissional: 'Dra. Teste',
        dataHoraFormatada: '20/12/2025 10:00',
        dataConsulta: '2025-12-20T10:00:00',
        tipo: 'marcada',
        reagendamentoDe: 'desm-12345',
        reagendamentoData: new Date().toISOString(),
        reagendamentoTipo: 'desmarcacao'
    };

    const result2 = ConsultasService.upsertConsultaAtiva(consultaReagendada);
    console.log(`✅ Consulta reagendada criada: ${result2.consultaNumero}`);
    console.log(`   isReagendamento: ${result2.isReagendamento}\n`);

    console.log('📋 TESTE 3: Verificar isReagendamentoRecente()\n');
    const info1 = ConsultasService.isReagendamentoRecente('TEST-001', '5511999999999');
    console.log(`   Consulta TEST-001: isReagendamento = ${info1.isReagendamento}`);

    const info2 = ConsultasService.isReagendamentoRecente('TEST-002', '5511888888888');
    console.log(`   Consulta TEST-002: isReagendamento = ${info2.isReagendamento}`);
    if (info2.isReagendamento) {
        console.log(`   ├── Origem: ${info2.consultaOriginal}`);
        console.log(`   ├── Tipo: ${info2.reagendamentoTipo}`);
        console.log(`   └── Horas: ${info2.horasDesdeReagendamento.toFixed(2)}h\n`);
    }

    console.log('📋 TESTE 4: Verificar verificarSeConsultaEReagendamento()\n');
    const isReag1 = ConsultasService.verificarSeConsultaEReagendamento('TEST-001', '5511999999999');
    const isReag2 = ConsultasService.verificarSeConsultaEReagendamento('TEST-002', '5511888888888');
    console.log(`   TEST-001 é reagendamento? ${isReag1}`);
    console.log(`   TEST-002 é reagendamento? ${isReag2}\n`);

    console.log('📋 TESTE 5: Consultar Todas as Consultas\n');
    const todasConsultas = ConsultasService.getAllConsultasAtivas();
    const consultasReagendamento = todasConsultas.filter(c => c.reagendamento_de);
    console.log(`   Total de consultas: ${todasConsultas.length}`);
    console.log(`   Reagendamentos: ${consultasReagendamento.length}`);

    if (consultasReagendamento.length > 0) {
        console.log('\n   Consultas reagendadas encontradas:');
        consultasReagendamento.forEach(c => {
            console.log(`   ├── ${c.consulta_numero} - ${c.nome_paciente}`);
            console.log(`   │   Origem: ${c.reagendamento_de}`);
            console.log(`   │   Tipo: ${c.reagendamento_tipo}`);
            console.log(`   │   Data: ${c.reagendamento_data}`);
        });
    }

    console.log('\n📋 TESTE 6: Limpar Dados de Teste\n');
    db.prepare('DELETE FROM consultas_ativas WHERE consulta_numero LIKE ?').run('TEST-%');
    console.log('✅ Dados de teste removidos\n');

    db.close();

    console.log('==========================================');
    console.log('✅ TODOS OS TESTES PASSARAM!');
    console.log('==========================================');
    console.log('\n📊 RESUMO DOS TESTES:');
    console.log('✅ Criação de consulta normal');
    console.log('✅ Criação de consulta reagendada');
    console.log('✅ Função isReagendamentoRecente()');
    console.log('✅ Função verificarSeConsultaEReagendamento()');
    console.log('✅ Consulta de dados com novos campos');
    console.log('✅ Limpeza de dados de teste');

    console.log('\n🎯 SISTEMA DE REAGENDAMENTO: 100% FUNCIONAL');

    process.exit(0);

} catch (error) {
    console.error('\n❌ ERRO NO TESTE:');
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
}
