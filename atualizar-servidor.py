#!/usr/bin/env python3
"""
HMASP Chat - Atualização Automática do Servidor
Executa via SSH com senha
"""

import subprocess
import time
import sys

def executar_ssh():
    print("="*60)
    print("  HMASP CHAT - ATUALIZAÇÃO DO SERVIDOR")
    print("="*60)
    print()

    servidor = "10.12.40.105"
    usuario = "sistema-whats"
    senha = "Sistema@whats"

    print(f"Servidor: {servidor}")
    print(f"Usuário: {usuario}")
    print()

    comandos = """
cd /opt/hmasp/hmasp-chat-v2 && \
echo '===== [1/4] Atualizando código do GitHub =====' && \
git pull origin main && \
echo '' && \
echo '===== [2/4] Instalando dependências =====' && \
npm install --production && \
echo '' && \
echo '===== [3/4] Compilando frontend azul =====' && \
npm run build && \
echo '' && \
echo '===== [4/4] Reiniciando servidor =====' && \
sudo systemctl restart hmasp-chat && \
sleep 5 && \
echo '' && \
echo '===== Status do Servidor =====' && \
sudo systemctl status hmasp-chat --no-pager | head -20
"""

    print("Conectando via SSH...")
    print("IMPORTANTE: Digite a senha quando solicitado: Sistema@whats")
    print()

    try:
        # Executar SSH
        processo = subprocess.Popen(
            ['ssh', f'{usuario}@{servidor}', comandos],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True
        )

        # Aguardar conclusão
        output, _ = processo.communicate(timeout=300)

        print(output)

        if processo.returncode == 0:
            print()
            print("="*60)
            print("  ✅ ATUALIZAÇÃO CONCLUÍDA COM SUCESSO!")
            print("="*60)
            print()
            print("Verificando frontend...")
            time.sleep(3)

            # Testar frontend
            try:
                import requests
                response = requests.get(f'http://{servidor}:3000/', timeout=10)
                if "Hospital Militar" in response.text:
                    print("✅ Frontend azul está funcionando!")
                    print()
                    print(f"🎯 Acesse: http://{servidor}:3000")
                else:
                    print("⚠️  Servidor respondeu mas aguarde mais alguns segundos")
                    print(f"   Acesse: http://{servidor}:3000")
            except:
                print(f"⚠️  Verifique manualmente: http://{servidor}:3000")

        else:
            print()
            print("❌ Erro na execução")
            print(f"Código de saída: {processo.returncode}")

    except subprocess.TimeoutExpired:
        print("❌ Timeout: Operação demorou mais de 5 minutos")
    except FileNotFoundError:
        print("❌ SSH não encontrado!")
        print("   Certifique-se que o OpenSSH está instalado")
    except Exception as e:
        print(f"❌ Erro: {e}")

if __name__ == "__main__":
    try:
        executar_ssh()
    except KeyboardInterrupt:
        print("\n\nOperação cancelada pelo usuário")
        sys.exit(1)
