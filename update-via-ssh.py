#!/usr/bin/env python3
"""Script para atualizar o servidor GCE via SSH"""

import subprocess
import time
import sys

GCLOUD = r'C:\Program Files (x86)\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd'
SERVER_FILE = r'c:\Users\user\Projetos VS Code\HMASPChat - Marcação de Consultas\server.js'
INSTANCE = 'hmasp-whatsapp-server'
ZONE = 'us-west1-b'

def run_command(cmd, description):
    """Executa um comando e mostra o resultado"""
    print(f'\n[*] {description}...')
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=120)
        if result.returncode == 0:
            print(f'[✓] {description} - OK')
            if result.stdout:
                print(result.stdout)
            return True
        else:
            print(f'[✗] {description} - ERRO')
            if result.stderr:
                print(result.stderr)
            return False
    except Exception as e:
        print(f'[✗] Erro: {e}')
        return False

def main():
    print('=' * 50)
    print('  Atualizando servidor GCE')
    print('=' * 50)

    # 1. Copiar arquivo
    if not run_command(
        f'"{GCLOUD}" compute scp "{SERVER_FILE}" {INSTANCE}:~/server.js --zone={ZONE}',
        'Copiando server.js'
    ):
        sys.exit(1)

    # 2. Reiniciar serviço
    if not run_command(
        f'"{GCLOUD}" compute ssh {INSTANCE} --zone={ZONE} --command="sudo systemctl restart hmasp-whatsapp"',
        'Reiniciando serviço'
    ):
        sys.exit(1)

    # 3. Aguardar
    print('\n[*] Aguardando 5 segundos...')
    time.sleep(5)

    # 4. Verificar status
    run_command(
        f'"{GCLOUD}" compute ssh {INSTANCE} --zone={ZONE} --command="sudo systemctl status hmasp-whatsapp --no-pager -l"',
        'Verificando status'
    )

    print('\n' + '=' * 50)
    print('  Atualização concluída!')
    print('=' * 50)

if __name__ == '__main__':
    main()
