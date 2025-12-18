/**
 * Script para aplicar migração dos templates WhatsApp → Chat Próprio
 * Remove opções numeradas e adiciona templates para sistema com botões
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'mensagens-whatsapp.db');
const migrationPath = path.join(__dirname, 'migration-chat-proprio-templates.sql');

console.log('📋 Aplicando migração: Templates Chat Próprio\n');
console.log(`   Banco: ${dbPath}`);
console.log(`   Script: ${migrationPath}\n`);

try {
    // Abre banco
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');

    // Lê script SQL
    const sql = fs.readFileSync(migrationPath, 'utf8');

    // Separa comandos (split por ponto-e-vírgula)
    const commands = sql
        .split(';')
        .map(cmd => cmd.trim())
        .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

    console.log('🔄 Executando migração...\n');

    // Executa cada comando
    let updates = 0;
    let inserts = 0;

    for (const command of commands) {
        if (command.includes('UPDATE')) {
            const result = db.prepare(command).run();
            updates += result.changes;
            console.log(`   ✅ ${result.changes} templates antigos desativados`);
        } else if (command.includes('INSERT')) {
            try {
                const result = db.prepare(command).run();
                inserts += result.changes;
                console.log(`   ✅ Novo template inserido`);
            } catch (e) {
                if (e.message.includes('UNIQUE')) {
                    console.log(`   ℹ️  Template já existe (pulado)`);
                } else {
                    throw e;
                }
            }
        }
    }

    console.log('\n📊 Resumo da migração:');
    console.log(`   • Templates desativados: ${updates}`);
    console.log(`   • Novos templates: ${inserts}`);

    // Mostra templates ativos após migração
    console.log('\n📄 Templates ativos para Chat Próprio:');
    const ativos = db.prepare(`
        SELECT codigo, titulo, categoria
        FROM mensagens_whatsapp
        WHERE ativo = 1 AND codigo LIKE 'chat_%'
        ORDER BY fluxo, codigo
    `).all();

    ativos.forEach(t => {
        console.log(`   • ${t.codigo} - ${t.titulo}`);
    });

    db.close();
    console.log('\n✅ Migração concluída com sucesso!');

} catch (error) {
    console.error('\n❌ Erro ao aplicar migração:', error);
    process.exit(1);
}
