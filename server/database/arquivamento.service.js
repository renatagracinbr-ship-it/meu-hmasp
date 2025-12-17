/**
 * Service: Gerenciamento de Arquivamento de Confirmações
 * Armazena confirmações antigas (72h+) em SQLite
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Caminho do banco de dados SQLite
const DB_PATH = path.join(__dirname, 'confirmacoes_arquivadas.db');

// Conexão com SQLite
let db = null;

/**
 * Inicializa conexão com SQLite
 */
function initializeConnection() {
    if (!db) {
        db = new Database(DB_PATH, { verbose: console.log });
        db.pragma('journal_mode = WAL'); // Write-Ahead Logging para melhor performance
        console.log('[Arquivamento] 🟢 Conectado ao SQLite:', DB_PATH);
    }
    return db;
}

/**
 * Inicializa o schema do banco de dados
 */
async function initializeSchema() {
    try {
        const db = initializeConnection();

        // Lê o schema SQL
        const schemaPath = path.join(__dirname, 'schema-arquivamento.sql');
        const schemaSql = fs.readFileSync(schemaPath, 'utf8');

        // Executa o schema (SQLite aceita múltiplos comandos)
        db.exec(schemaSql);

        console.log('[Arquivamento] ✅ Schema inicializado');
    } catch (error) {
        console.error('[Arquivamento] ❌ Erro ao inicializar schema:', error);
        throw error;
    }
}

/**
 * Arquiva uma confirmação no banco de dados
 */
async function arquivarConfirmacao(confirmacao) {
    try {
        const db = initializeConnection();

        const stmt = db.prepare(`
            INSERT INTO confirmacoes_arquivadas (
                id, prontuario, nome_paciente, consulta_numero, pac_codigo,
                especialidade, data_hora_formatada, profissional, local,
                tipo, status_geral, data_marcacao, data_apareceu_dashboard, data_resposta, dados_completos
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (id) DO UPDATE SET
                status_geral = excluded.status_geral,
                data_resposta = excluded.data_resposta,
                dados_completos = excluded.dados_completos,
                updated_at = CURRENT_TIMESTAMP
        `);

        const result = stmt.run(
            confirmacao.id,
            confirmacao.prontuario || null,
            confirmacao.nomePaciente,
            confirmacao.consultaNumero || null,
            confirmacao.pacCodigo || null,
            confirmacao.especialidade || null,
            confirmacao.dataHoraFormatada || null,
            confirmacao.profissional || null,
            confirmacao.local || null,
            confirmacao.tipo || 'marcada',
            confirmacao.statusGeral || 'pending',
            confirmacao.dataMarcacao || null,
            confirmacao.dataApareceuDashboard || new Date().toISOString(),
            confirmacao.dataResposta || null,
            JSON.stringify(confirmacao)
        );

        console.log(`[Arquivamento] ✅ Confirmação arquivada: ${confirmacao.nomePaciente} (${confirmacao.id})`);
        return { id: confirmacao.id };
    } catch (error) {
        console.error('[Arquivamento] ❌ Erro ao arquivar:', error);
        throw error;
    }
}

/**
 * Arquiva múltiplas confirmações em lote
 */
async function arquivarEmLote(confirmacoes) {
    let arquivadas = 0;
    let erros = 0;

    const db = initializeConnection();

    // Usa transação para melhor performance
    const transaction = db.transaction((confirmacoes) => {
        for (const confirmacao of confirmacoes) {
            try {
                const stmt = db.prepare(`
                    INSERT INTO confirmacoes_arquivadas (
                        id, prontuario, nome_paciente, consulta_numero, pac_codigo,
                        especialidade, data_hora_formatada, profissional, local,
                        tipo, status_geral, data_marcacao, data_apareceu_dashboard, data_resposta, dados_completos
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT (id) DO UPDATE SET
                        status_geral = excluded.status_geral,
                        data_resposta = excluded.data_resposta,
                        dados_completos = excluded.dados_completos,
                        updated_at = CURRENT_TIMESTAMP
                `);

                stmt.run(
                    confirmacao.id,
                    confirmacao.prontuario || null,
                    confirmacao.nomePaciente,
                    confirmacao.consultaNumero || null,
                    confirmacao.pacCodigo || null,
                    confirmacao.especialidade || null,
                    confirmacao.dataHoraFormatada || null,
                    confirmacao.profissional || null,
                    confirmacao.local || null,
                    confirmacao.tipo || 'marcada',
                    confirmacao.statusGeral || 'pending',
                    confirmacao.dataMarcacao || null,
                    confirmacao.dataApareceuDashboard || new Date().toISOString(),
                    confirmacao.dataResposta || null,
                    JSON.stringify(confirmacao)
                );
                arquivadas++;
            } catch (error) {
                console.error(`[Arquivamento] Erro ao arquivar ${confirmacao.id}:`, error.message);
                erros++;
            }
        }
    });

    transaction(confirmacoes);

    return { arquivadas, erros };
}

/**
 * Busca confirmações arquivadas por nome do paciente
 */
async function buscarPorNome(nomeBusca) {
    try {
        const db = initializeConnection();

        const stmt = db.prepare(`
            SELECT dados_completos
            FROM confirmacoes_arquivadas
            WHERE LOWER(nome_paciente) LIKE LOWER(?)
            ORDER BY data_marcacao DESC
            LIMIT 100
        `);

        const rows = stmt.all(`%${nomeBusca}%`);

        // Retorna os dados completos parseados
        return rows.map(row => JSON.parse(row.dados_completos));
    } catch (error) {
        console.error('[Arquivamento] ❌ Erro ao buscar:', error);
        throw error;
    }
}

/**
 * Busca todas as confirmações arquivadas (paginado)
 */
async function buscarTodas(limit = 100, offset = 0) {
    try {
        const db = initializeConnection();

        const stmt = db.prepare(`
            SELECT dados_completos
            FROM confirmacoes_arquivadas
            ORDER BY data_marcacao DESC
            LIMIT ? OFFSET ?
        `);

        const rows = stmt.all(limit, offset);

        return rows.map(row => JSON.parse(row.dados_completos));
    } catch (error) {
        console.error('[Arquivamento] ❌ Erro ao buscar todas:', error);
        throw error;
    }
}

/**
 * Arquiva automaticamente confirmações com mais de 72 horas
 * IMPORTANTE: Usa dataApareceuDashboard (quando apareceu no dashboard) e NÃO dataMarcacao
 * Isso garante que tanto consultas marcadas quanto lembretes 72h sejam arquivados corretamente
 */
async function arquivarAntigas(confirmacoes) {
    const agora = new Date();
    const HORAS_72 = 72 * 60 * 60 * 1000; // 72 horas em milissegundos

    const paraArquivar = confirmacoes.filter(c => {
        // Usa dataApareceuDashboard se existir, senão tenta dataMarcacao (fallback para dados antigos)
        const dataReferencia = c.dataApareceuDashboard || c.dataMarcacao;

        if (!dataReferencia) {
            console.warn(`[Arquivamento] ⚠️ Confirmação ${c.id} sem dataApareceuDashboard nem dataMarcacao - ignorando`);
            return false;
        }

        const dataRef = new Date(dataReferencia);
        const diffMs = agora - dataRef;

        const deveArquivar = diffMs >= HORAS_72;

        if (deveArquivar) {
            const horasDecorridas = Math.floor(diffMs / (1000 * 60 * 60));
            console.log(`[Arquivamento] 📦 ${c.nomePaciente} (${c.tipo}) - ${horasDecorridas}h no dashboard - será arquivada`);
        }

        return deveArquivar;
    });

    if (paraArquivar.length === 0) {
        console.log('[Arquivamento] Nenhuma confirmação com 72h+ no dashboard para arquivar');
        return { arquivadas: 0, erros: 0 };
    }

    console.log(`[Arquivamento] 📦 Arquivando ${paraArquivar.length} confirmações com 72h+ no dashboard...`);
    return await arquivarEmLote(paraArquivar);
}

/**
 * Remove confirmação arquivada
 */
async function removerArquivada(id) {
    try {
        const db = initializeConnection();

        const stmt = db.prepare('DELETE FROM confirmacoes_arquivadas WHERE id = ?');
        const result = stmt.run(id);

        if (result.changes > 0) {
            console.log(`[Arquivamento] ✅ Confirmação removida: ${id}`);
            return true;
        }
        return false;
    } catch (error) {
        console.error('[Arquivamento] ❌ Erro ao remover:', error);
        throw error;
    }
}

/**
 * Conta total de confirmações arquivadas
 */
async function contarArquivadas() {
    try {
        const db = initializeConnection();

        const stmt = db.prepare('SELECT COUNT(*) as total FROM confirmacoes_arquivadas');
        const result = stmt.get();

        return result.total;
    } catch (error) {
        console.error('[Arquivamento] ❌ Erro ao contar:', error);
        throw error;
    }
}

module.exports = {
    initializeSchema,
    arquivarConfirmacao,
    arquivarEmLote,
    arquivarAntigas,
    buscarPorNome,
    buscarTodas,
    removerArquivada,
    contarArquivadas
};
