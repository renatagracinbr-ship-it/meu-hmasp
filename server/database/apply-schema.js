/**
 * Script para aplicar o schema de mensagens WhatsApp
 * Usa INSERT OR REPLACE para atualizar mensagens existentes
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'mensagens-whatsapp.db');
const SCHEMA_PATH = path.join(__dirname, 'schema-mensagens-whatsapp.sql');

console.log('[ApplySchema] Iniciando aplicação do schema...');
console.log(`[ApplySchema] Database: ${DB_PATH}`);
console.log(`[ApplySchema] Schema: ${SCHEMA_PATH}`);

try {
    // Lê o schema
    const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');

    // Conecta ao banco
    const db = new Database(DB_PATH);

    // Executa o schema
    db.exec(schema);

    console.log('[ApplySchema] ✅ Schema aplicado com sucesso!');

    // Verifica a mensagem atualizada
    const mensagem = db.prepare('SELECT codigo, texto, variaveis_disponiveis, versao FROM mensagens_whatsapp WHERE codigo = ?')
        .get('consulta_reagendada_comunicacao');

    console.log('\n[ApplySchema] Mensagem consulta_reagendada_comunicacao:');
    console.log(`  Versão: ${mensagem.versao}`);
    console.log(`  Variáveis: ${mensagem.variaveis_disponiveis}`);
    console.log(`  Contém {local}: ${mensagem.texto.includes('{local}') ? 'SIM ❌' : 'NÃO ✅'}`);

    db.close();

} catch (error) {
    console.error('[ApplySchema] ❌ Erro:', error);
    process.exit(1);
}
