/**
 * Script para Verificar e Adicionar Campos Faltantes
 *
 * Verifica quais campos existem e adiciona apenas os que faltam
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'hmasp_consultas.db');

console.log('='.repeat(80));
console.log('VERIFICAÇÃO E ADIÇÃO DE CAMPOS FALTANTES');
console.log('='.repeat(80));
console.log();

// Conecta ao banco
console.log('📦 Conectando ao banco de dados...');
const db = new Database(DB_PATH);
console.log('✅ Conectado!\n');

// Define campos necessários para cada tabela
const camposNecessarios = {
    consultas_ativas: [
        { name: 'profissional', type: 'TEXT', default: null },
        { name: 'local', type: 'TEXT', default: null },
        { name: 'pac_codigo', type: 'TEXT', default: null },
        { name: 'nome_exibicao', type: 'TEXT', default: null },
        { name: 'data_resposta', type: 'TEXT', default: null },
        { name: 'badge_status', type: 'TEXT', default: null },
        { name: 'badge_info', type: 'TEXT', default: null },
    ],
    desmarcacoes_ativas: [
        { name: 'resposta_em', type: 'TEXT', default: null },
        { name: 'status_geral', type: 'TEXT', default: "'pending'" },
        { name: 'data_marcacao', type: 'TEXT', default: null },
        { name: 'contexto', type: 'TEXT', default: "'desmarcacao'" },
        { name: 'data_desmarcacao_formatada', type: 'TEXT', default: null },
    ]
};

// Função para verificar se campo existe
function campoExiste(tabela, campo) {
    const campos = db.prepare(`PRAGMA table_info('${tabela}')`).all();
    return campos.some(c => c.name === campo);
}

// Função para adicionar campo
function adicionarCampo(tabela, campo, tipo, valorPadrao) {
    try {
        const defaultClause = valorPadrao ? ` DEFAULT ${valorPadrao}` : '';
        const sql = `ALTER TABLE ${tabela} ADD COLUMN ${campo} ${tipo}${defaultClause}`;
        console.log(`   SQL: ${sql}`);
        db.exec(sql);
        console.log(`   ✅ Campo ${campo} adicionado`);
        return true;
    } catch (error) {
        console.log(`   ⚠️  Erro ao adicionar ${campo}: ${error.message}`);
        return false;
    }
}

// Processa cada tabela
let totalAdicionados = 0;
let totalJaExistentes = 0;

for (const [tabela, campos] of Object.entries(camposNecessarios)) {
    console.log('-'.repeat(80));
    console.log(`📋 Tabela: ${tabela.toUpperCase()}`);
    console.log('-'.repeat(80));

    for (const campo of campos) {
        if (campoExiste(tabela, campo.name)) {
            console.log(`✓  ${campo.name} - JÁ EXISTE`);
            totalJaExistentes++;
        } else {
            console.log(`➕ ${campo.name} - ADICIONANDO...`);
            if (adicionarCampo(tabela, campo.name, campo.type, campo.default)) {
                totalAdicionados++;
            }
        }
    }
    console.log();
}

// Cria índices se não existirem
console.log('-'.repeat(80));
console.log('📊 CRIANDO ÍNDICES');
console.log('-'.repeat(80));

const indices = [
    'CREATE INDEX IF NOT EXISTS idx_consultas_ativas_badge ON consultas_ativas(badge_status)',
    'CREATE INDEX IF NOT EXISTS idx_consultas_ativas_data_resposta ON consultas_ativas(data_resposta)',
    'CREATE INDEX IF NOT EXISTS idx_desmarcacoes_ativas_resposta_em ON desmarcacoes_ativas(resposta_em)',
    'CREATE INDEX IF NOT EXISTS idx_desmarcacoes_ativas_contexto ON desmarcacoes_ativas(contexto)',
];

for (const sql of indices) {
    try {
        db.exec(sql);
        const indexName = sql.match(/idx_[\w]+/)[0];
        console.log(`✅ Índice ${indexName} criado/verificado`);
    } catch (error) {
        console.log(`⚠️  Erro ao criar índice: ${error.message}`);
    }
}
console.log();

// Resumo final
console.log('='.repeat(80));
console.log('RESUMO');
console.log('='.repeat(80));
console.log(`✅ Campos adicionados: ${totalAdicionados}`);
console.log(`📋 Campos já existentes: ${totalJaExistentes}`);
console.log(`📊 Total verificado: ${totalAdicionados + totalJaExistentes}`);
console.log();

// Mostra estrutura final
console.log('📋 ESTRUTURA FINAL');
console.log('='.repeat(80));

for (const tabela of Object.keys(camposNecessarios)) {
    console.log(`\n🔹 ${tabela.toUpperCase()}:`);
    const campos = db.prepare(`PRAGMA table_info('${tabela}')`).all();
    console.log(`   Total de campos: ${campos.length}\n`);

    // Agrupa campos por categoria
    const camposBasicos = campos.filter(c => ['id', 'consulta_numero', 'nome_paciente', 'prontuario'].includes(c.name));
    const camposTelefone = campos.filter(c => c.name.includes('telefone'));
    const camposData = campos.filter(c => c.name.includes('data') || c.name.includes('criado') || c.name.includes('atualizado'));
    const camposStatus = campos.filter(c => c.name.includes('status') || c.name === 'tipo' || c.name === 'tipo_desmarcacao');
    const camposNovos = campos.filter(c =>
        ['profissional', 'local', 'pac_codigo', 'nome_exibicao', 'data_resposta', 'badge_status', 'badge_info', 'resposta_em', 'contexto', 'data_desmarcacao_formatada'].includes(c.name)
    );
    const camposOutros = campos.filter(c =>
        !camposBasicos.includes(c) &&
        !camposTelefone.includes(c) &&
        !camposData.includes(c) &&
        !camposStatus.includes(c) &&
        !camposNovos.includes(c)
    );

    if (camposBasicos.length > 0) {
        console.log('   📌 Identificação:');
        camposBasicos.forEach(c => console.log(`      - ${c.name} (${c.type})`));
    }

    if (camposTelefone.length > 0) {
        console.log('\n   📞 Telefone:');
        camposTelefone.forEach(c => console.log(`      - ${c.name} (${c.type})`));
    }

    if (camposStatus.length > 0) {
        console.log('\n   🏷️  Status:');
        camposStatus.forEach(c => console.log(`      - ${c.name} (${c.type})`));
    }

    if (camposData.length > 0) {
        console.log('\n   📅 Datas:');
        camposData.forEach(c => console.log(`      - ${c.name} (${c.type})`));
    }

    if (camposNovos.length > 0) {
        console.log('\n   ✨ CAMPOS NOVOS:');
        camposNovos.forEach(c => console.log(`      - ${c.name} (${c.type})`));
    }

    if (camposOutros.length > 0) {
        console.log('\n   📋 Outros:');
        camposOutros.forEach(c => console.log(`      - ${c.name} (${c.type})`));
    }
}

console.log('\n' + '='.repeat(80));

// Verifica se tabelas de telefones existem
const tabelas = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%telefones%'").all();
if (tabelas.length > 0) {
    console.log('\n✅ TABELAS DE TELEFONES CRIADAS:');
    tabelas.forEach(t => console.log(`   - ${t.name}`));
} else {
    console.log('\n⚠️  TABELAS DE TELEFONES NÃO EXISTEM');
    console.log('   Execute a migração 002-criar-tabela-telefones.sql para criá-las');
}

console.log('\n' + '='.repeat(80));
console.log('✅ Verificação concluída!');
console.log('='.repeat(80));

// Fecha conexão
db.close();

process.exit(0);
