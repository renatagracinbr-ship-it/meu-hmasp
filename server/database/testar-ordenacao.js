/**
 * Script para testar a ordenação das consultas
 * Mostra as primeiras 10 consultas ordenadas por data_apareceu_dashboard DESC
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'hmasp_consultas.db');

function formatarData(isoString) {
    if (!isoString) return 'N/A';
    const data = new Date(isoString);
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    const hora = String(data.getHours()).padStart(2, '0');
    const minuto = String(data.getMinutes()).padStart(2, '0');
    return `${dia}/${mes}/${ano} ${hora}:${minuto}`;
}

function testarOrdenacao() {
    console.log('========================================');
    console.log('TESTE DE ORDENAÇÃO - CONFIRMAÇÃO DE PRESENÇA');
    console.log('========================================\n');

    const db = new Database(DB_PATH);

    try {
        // Query igual à usada pelo sistema (com filtro de 72h)
        const consultas = db.prepare(`
            SELECT
                consulta_numero,
                nome_paciente,
                tipo,
                data_marcacao,
                data_apareceu_dashboard,
                criado_em
            FROM consultas_ativas
            WHERE datetime(data_apareceu_dashboard) >= datetime('now', '-72 hours')
            ORDER BY data_apareceu_dashboard DESC
            LIMIT 15
        `).all();

        if (consultas.length === 0) {
            console.log('❌ Nenhuma consulta encontrada (últimas 72h)');
            return;
        }

        console.log(`✅ ${consultas.length} consultas encontradas\n`);
        console.log('Ordenação por data_apareceu_dashboard (mais recente primeiro):\n');
        console.log('Nº  | Paciente                    | Tipo       | Apareceu no Dashboard | Marcada em');
        console.log('----|-----------------------------|-----------|-----------------------|------------------');

        consultas.forEach((c, index) => {
            const num = String(index + 1).padStart(3, ' ');
            const paciente = c.nome_paciente.substring(0, 27).padEnd(27, ' ');
            const tipo = (c.tipo || 'N/A').padEnd(9, ' ');
            const apareceu = formatarData(c.data_apareceu_dashboard);
            const marcada = formatarData(c.data_marcacao);

            console.log(`${num} | ${paciente} | ${tipo} | ${apareceu} | ${marcada}`);
        });

        console.log('\n========================================');
        console.log('RESUMO:');
        console.log('========================================');

        const marcadas = consultas.filter(c => c.tipo === 'marcada').length;
        const lembretes = consultas.filter(c => c.tipo === 'lembrete72h').length;
        const semTipo = consultas.filter(c => !c.tipo).length;

        console.log(`📊 Consultas marcadas (M):     ${marcadas}`);
        console.log(`📊 Lembretes 72h:              ${lembretes}`);
        console.log(`📊 Sem tipo (antigas):         ${semTipo}`);
        console.log(`📊 Total:                      ${consultas.length}\n`);

        // Verifica se a ordenação está correta
        let ordemCorreta = true;
        for (let i = 0; i < consultas.length - 1; i++) {
            const atual = new Date(consultas[i].data_apareceu_dashboard);
            const proxima = new Date(consultas[i + 1].data_apareceu_dashboard);

            if (atual < proxima) {
                ordemCorreta = false;
                console.log(`❌ ERRO: Consulta ${i + 1} está antes da ${i + 2}, mas é mais antiga!`);
            }
        }

        if (ordemCorreta) {
            console.log('✅ ORDENAÇÃO CORRETA: Mais recentes primeiro!\n');
        } else {
            console.log('❌ ORDENAÇÃO INCORRETA: Há consultas fora de ordem!\n');
        }

    } catch (error) {
        console.error('❌ Erro ao testar ordenação:', error);
    } finally {
        db.close();
    }
}

testarOrdenacao();
