const Database = require('better-sqlite3');

// Abre o banco
const db = new Database('./server/database/hmasp_consultas.db', { readonly: true });

console.log('\n===== DESMARCAÇÕES COM STATUS = reagendamento =====\n');
const desmarcacoes = db.prepare(`
    SELECT
        id,
        consulta_numero,
        nome_paciente,
        prontuario,
        especialidade,
        status,
        reagendada,
        nova_consulta_numero,
        datetime(criado_em, 'localtime') as criado_em,
        datetime(reagendada_em, 'localtime') as reagendada_em
    FROM desmarcacoes_ativas
    WHERE status = 'reagendamento'
    ORDER BY criado_em DESC
    LIMIT 10
`).all();

console.log(`Total: ${desmarcacoes.length} desmarcações`);
desmarcacoes.forEach(d => {
    console.log(`\n- Consulta ${d.consulta_numero}`);
    console.log(`  Paciente: ${d.nome_paciente} (Prontuário: ${d.prontuario})`);
    console.log(`  Especialidade: ${d.especialidade}`);
    console.log(`  Status: ${d.status}`);
    console.log(`  Reagendada: ${d.reagendada ? 'SIM' : 'NÃO'}`);
    console.log(`  Nova consulta: ${d.nova_consulta_numero || 'N/A'}`);
    console.log(`  Criada em: ${d.criado_em}`);
    console.log(`  Reagendada em: ${d.reagendada_em || 'N/A'}`);
});

console.log('\n===== CONSULTAS ATIVAS RECENTES =====\n');
const consultas = db.prepare(`
    SELECT
        consulta_numero,
        nome_paciente,
        prontuario,
        especialidade,
        datetime(data_marcacao, 'localtime') as data_marcacao,
        datetime(criado_em, 'localtime') as criado_em
    FROM consultas_ativas
    WHERE consulta_numero = '737890'
`).all();

console.log(`Total: ${consultas.length} consultas`);
consultas.forEach(c => {
    console.log(`\n- Consulta ${c.consulta_numero}`);
    console.log(`  Paciente: ${c.nome_paciente} (Prontuário: ${c.prontuario})`);
    console.log(`  Especialidade: ${c.especialidade}`);
    console.log(`  Marcada em: ${c.data_marcacao}`);
    console.log(`  Criada no sistema em: ${c.criado_em}`);
});

console.log('\n===== VERIFICANDO MATCH =====\n');

// Busca desmarcações de CARDIOLOGIA com status reagendamento
const desmCARDIO = db.prepare(`
    SELECT
        consulta_numero,
        nome_paciente,
        prontuario,
        especialidade,
        reagendada,
        datetime(data_desmarcacao, 'localtime') as data_desmarcacao
    FROM desmarcacoes_ativas
    WHERE especialidade = 'CARDIOLOGIA'
    AND status = 'reagendamento'
    ORDER BY data_desmarcacao DESC
    LIMIT 5
`).all();

console.log(`Desmarcações de CARDIOLOGIA: ${desmCARDIO.length}`);
desmCARDIO.forEach(d => {
    console.log(`\n- Consulta ${d.consulta_numero}`);
    console.log(`  Prontuário: ${d.prontuario}`);
    console.log(`  Reagendada: ${d.reagendada ? 'SIM' : 'NÃO'}`);
    console.log(`  Data desmarcação: ${d.data_desmarcacao}`);

    // Verifica se tem match com a consulta 737890
    if (d.prontuario === '204165' && !d.reagendada) {
        console.log(`  ✅ MATCH COM 737890! Prontuário: 204165, Especialidade: CARDIOLOGIA`);
    }
});

db.close();
