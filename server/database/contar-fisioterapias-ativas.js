/**
 * Script para contar quantas fisioterapias estão atualmente no banco
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'hmasp_consultas.db');

function contarFisioterapias() {
    console.log('========================================');
    console.log('FISIOTERAPIAS ATIVAS NO BANCO');
    console.log('========================================\n');

    const db = new Database(DB_PATH);

    try {
        // Conta fisioterapias ativas
        const total = db.prepare(`
            SELECT COUNT(*) as total
            FROM consultas_ativas
            WHERE LOWER(especialidade) LIKE '%fisio%'
        `).get();

        console.log(`Total de fisioterapias ativas: ${total.total}\n`);

        if (total.total === 0) {
            console.log('✅ Nenhuma fisioterapia ativa no banco!');
            console.log('   Todas já foram arquivadas ou não há fisioterapias recentes.\n');
            return;
        }

        // Lista fisioterapias por tipo
        const porTipo = db.prepare(`
            SELECT tipo, COUNT(*) as total
            FROM consultas_ativas
            WHERE LOWER(especialidade) LIKE '%fisio%'
            GROUP BY tipo
        `).all();

        console.log('Fisioterapias por tipo:');
        porTipo.forEach(t => {
            const tipo = t.tipo || '(sem tipo)';
            console.log(`  - ${tipo}: ${t.total}`);
        });

        console.log('\n========================================');
        console.log('RECOMENDAÇÃO');
        console.log('========================================\n');

        const marcadas = porTipo.find(t => t.tipo === 'marcada');
        const lembretes = porTipo.find(t => t.tipo === 'lembrete72h');

        if (marcadas && marcadas.total > 0) {
            console.log('⚠️ Você tem fisioterapias do tipo "marcada" no banco.');
            console.log('   Estas foram adicionadas ANTES do filtro ser implementado.\n');
            console.log('   Opções:');
            console.log('   1. Aguardar 72h → Serão arquivadas automaticamente');
            console.log('   2. Arquivar manualmente → Botão "Arquivar Todas" no dashboard\n');
        }

        if (lembretes && lembretes.total > 0) {
            console.log('✅ Fisioterapias do tipo "lembrete72h" são esperadas!');
            console.log('   Estas são os avisos 72h antes das sessões (comportamento correto).\n');
        }

        // Lista as 10 mais recentes
        console.log('\n10 fisioterapias mais recentes:\n');
        const recentes = db.prepare(`
            SELECT
                consulta_numero,
                nome_paciente,
                especialidade,
                tipo,
                data_apareceu_dashboard,
                data_marcacao
            FROM consultas_ativas
            WHERE LOWER(especialidade) LIKE '%fisio%'
            ORDER BY data_apareceu_dashboard DESC
            LIMIT 10
        `).all();

        console.log('Nº Consulta | Paciente                | Tipo        | Apareceu em');
        console.log('------------|-------------------------|-------------|------------------');

        recentes.forEach(c => {
            const num = String(c.consulta_numero).padEnd(11, ' ');
            const paciente = c.nome_paciente.substring(0, 23).padEnd(23, ' ');
            const tipo = (c.tipo || 'N/A').padEnd(11, ' ');
            const data = new Date(c.data_apareceu_dashboard);
            const dataFormatada = `${String(data.getDate()).padStart(2, '0')}/${String(data.getMonth() + 1).padStart(2, '0')} ${String(data.getHours()).padStart(2, '0')}:${String(data.getMinutes()).padStart(2, '0')}`;

            console.log(`${num} | ${paciente} | ${tipo} | ${dataFormatada}`);
        });

    } catch (error) {
        console.error('❌ Erro ao contar fisioterapias:', error);
    } finally {
        db.close();
    }
}

contarFisioterapias();
