/**
 * Script para listar todas as especialidades de fisioterapia no banco
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'hmasp_consultas.db');

function listarFisioterapias() {
    console.log('========================================');
    console.log('ESPECIALIDADES DE FISIOTERAPIA NO BANCO');
    console.log('========================================\n');

    const db = new Database(DB_PATH);

    try {
        // Busca todas as especialidades únicas que contêm "fisio" (case insensitive)
        const especialidades = db.prepare(`
            SELECT DISTINCT especialidade, COUNT(*) as total
            FROM consultas_ativas
            WHERE LOWER(especialidade) LIKE '%fisio%'
            GROUP BY especialidade
            ORDER BY total DESC
        `).all();

        if (especialidades.length === 0) {
            console.log('❌ Nenhuma especialidade de fisioterapia encontrada no banco atual\n');
            console.log('Buscando em todas as tabelas (incluindo arquivadas)...\n');

            // Tenta buscar em consultas_arquivadas
            const arquivadas = db.prepare(`
                SELECT DISTINCT
                    json_extract(dados_completos, '$.especialidade') as especialidade,
                    COUNT(*) as total
                FROM consultas_arquivadas
                WHERE tipo_original = 'consulta_ativa'
                    AND LOWER(json_extract(dados_completos, '$.especialidade')) LIKE '%fisio%'
                GROUP BY especialidade
                ORDER BY total DESC
            `).all();

            if (arquivadas.length === 0) {
                console.log('❌ Nenhuma fisioterapia encontrada nem em arquivadas');
                console.log('\nℹ️ Sugestão: Aguarde novas marcações de fisioterapia ou verifique o AGHUse');
                return;
            }

            console.log(`✅ ${arquivadas.length} especialidades de fisioterapia encontradas (arquivadas):\n`);
            console.log('Especialidade                                          | Total');
            console.log('-------------------------------------------------------|-------');

            arquivadas.forEach(e => {
                const esp = String(e.especialidade || 'N/A').padEnd(54, ' ');
                const total = String(e.total).padStart(5, ' ');
                console.log(`${esp} | ${total}`);
            });

            return;
        }

        console.log(`✅ ${especialidades.length} especialidades de fisioterapia encontradas:\n`);
        console.log('Especialidade                                          | Total');
        console.log('-------------------------------------------------------|-------');

        especialidades.forEach(e => {
            const esp = e.especialidade.padEnd(54, ' ');
            const total = String(e.total).padStart(5, ' ');
            console.log(`${esp} | ${total}`);
        });

        console.log('\n========================================');
        console.log('PADRÕES IDENTIFICADOS');
        console.log('========================================\n');

        // Identifica padrões comuns
        const padroes = new Set();
        especialidades.forEach(e => {
            const lower = e.especialidade.toLowerCase();
            if (lower.includes('fisioterapia')) padroes.add('fisioterapia');
            if (lower.includes('fisio ')) padroes.add('fisio');
            if (lower.includes('fisioterap')) padroes.add('fisioterap');
        });

        console.log('Palavras-chave encontradas:');
        padroes.forEach(p => console.log(`  - "${p}"`));

        console.log('\n========================================');
        console.log('REGEX SUGERIDO PARA FILTRO');
        console.log('========================================\n');

        console.log('Para cobrir todas as variações de fisioterapia, use:');
        console.log('  /fisio/i  (case insensitive)');
        console.log('\nOu mais específico:');
        console.log('  /\\bfisio\\w*/i  (fisio + qualquer coisa depois)');

    } catch (error) {
        console.error('❌ Erro ao listar fisioterapias:', error);
    } finally {
        db.close();
    }
}

listarFisioterapias();
