#!/usr/bin/env node
/**
 * Script para fazer deploy do server.js atualizado para o GCE
 */

const { execSync } = require('child_process');
const path = require('path');

const GCLOUD = 'C:\\Program Files (x86)\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd';
const SERVER_FILE = path.join(__dirname, 'server.js');
const INSTANCE = 'hmasp-whatsapp-server';
const ZONE = 'us-west1-b';

function runCommand(cmd, description) {
    console.log(`\n[*] ${description}...`);
    try {
        const output = execSync(cmd, {
            encoding: 'utf8',
            stdio: 'pipe',
            timeout: 120000
        });
        console.log(`[✓] ${description} - OK`);
        if (output) console.log(output);
        return true;
    } catch (error) {
        console.error(`[✗] ${description} - ERRO`);
        if (error.stdout) console.log(error.stdout);
        if (error.stderr) console.error(error.stderr);
        return false;
    }
}

console.log('==================================================');
console.log('  Atualizando servidor GCE');
console.log('==================================================');

// 1. Copiar arquivo para o diretório temporário
if (!runCommand(
    `"${GCLOUD}" compute scp "${SERVER_FILE}" ${INSTANCE}:/tmp/server.js --zone=${ZONE}`,
    'Copiando server.js para /tmp'
)) {
    process.exit(1);
}

// 1b. Mover para diretório correto com sudo
if (!runCommand(
    `"${GCLOUD}" compute ssh ${INSTANCE} --zone=${ZONE} --command="sudo mv /tmp/server.js /home/centralderegulacaohmasp/hmasp-chat/server.js && sudo chown centralderegulacaohmasp:centralderegulacaohmasp /home/centralderegulacaohmasp/hmasp-chat/server.js"`,
    'Movendo e ajustando permissões'
)) {
    process.exit(1);
}

// 2. Reiniciar serviço
if (!runCommand(
    `"${GCLOUD}" compute ssh ${INSTANCE} --zone=${ZONE} --command="sudo systemctl restart hmasp-whatsapp"`,
    'Reiniciando serviço'
)) {
    process.exit(1);
}

// 3. Aguardar
console.log('\n[*] Aguardando 5 segundos...');
setTimeout(() => {
    // 4. Verificar status
    runCommand(
        `"${GCLOUD}" compute ssh ${INSTANCE} --zone=${ZONE} --command="sudo systemctl status hmasp-whatsapp --no-pager | head -20"`,
        'Verificando status do serviço'
    );

    console.log('\n==================================================');
    console.log('  Atualização concluída!');
    console.log('==================================================');
    console.log('\nTestando API...\n');

    // 5. Testar API
    runCommand(
        'curl -s http://136.118.10.24:3000/api/status',
        'Status da API'
    );

    console.log('');

    runCommand(
        'curl -s http://136.118.10.24:3000/api/chats',
        'Listando chats'
    );
}, 5000);
