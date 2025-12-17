# Guia: Executar HMASP Chat no Ubuntu/WSL

Este guia mostra como executar o aplicativo HMASP Chat no Ubuntu instalado via WSL (Windows Subsystem for Linux).

## Pré-requisitos

- Windows 10/11 com WSL2 instalado
- Ubuntu instalado no WSL
- Acesso ao terminal

## 📋 Passo a Passo

### 1. Iniciar o Ubuntu/WSL

Abra o PowerShell ou CMD no Windows e execute:

```bash
wsl
```

Ou abra o Ubuntu diretamente do menu Iniciar.

### 2. Navegar até o Projeto

Dentro do Ubuntu, navegue até a pasta do projeto. Os arquivos do Windows ficam em `/mnt/c/`:

```bash
cd "/mnt/c/Users/user/Projetos VS Code/HMASPChat - Marcação de Consultas"
```

### 3. Executar o Setup (Primeira vez)

Execute o script de instalação:

```bash
chmod +x setup-ubuntu.sh
./setup-ubuntu.sh
```

Este script irá:
- ✅ Atualizar o sistema
- ✅ Instalar Node.js 20.x LTS (suporte até 2026)
- ✅ Instalar dependências do sistema (chromium, build-essential, etc.)
- ✅ Instalar dependências do Node.js (npm install)
- ✅ Criar diretórios necessários
- ✅ Criar arquivo .env (se não existir)

### 4. Configurar o Arquivo .env

Edite o arquivo .env se necessário:

```bash
nano .env
```

Configurações importantes:
```env
PORT=3000
NODE_ENV=production
AGHUSE_URL=http://localhost:3001
```

Pressione `Ctrl+X`, depois `Y` e `Enter` para salvar.

### 5. Executar o Servidor

#### Opção A: Execução Normal (Terminal fica aberto)

```bash
node server.js
```

#### Opção B: Execução em Background (Modo daemon)

```bash
nohup node server.js > server.log 2>&1 &
```

Para ver os logs:
```bash
tail -f server.log
```

Para parar o servidor:
```bash
pkill -f "node server.js"
```

### 6. Acessar o Aplicativo

#### Do próprio Ubuntu/WSL:
```
http://localhost:3000
```

#### Do Windows (navegador):
```
http://localhost:3000
```

Ou descubra o IP do WSL:
```bash
ip addr show eth0 | grep inet
```
E acesse: `http://[IP_DO_WSL]:3000`

## 🔧 Comandos Úteis

### Verificar se o servidor está rodando
```bash
ps aux | grep "node server.js" | grep -v grep
```

### Ver logs em tempo real
```bash
tail -f server.log
```

### Parar o servidor
```bash
# Se estiver em background
pkill -f "node server.js"

# Se estiver no terminal
Ctrl+C
```

### Reiniciar o servidor
```bash
pkill -f "node server.js" && nohup node server.js > server.log 2>&1 &
```

### Verificar porta em uso
```bash
netstat -tulpn | grep 3000
# ou
lsof -i :3000
```

## 🐛 Solução de Problemas

### Erro: "Cannot find module"
```bash
npm install
```

### Erro: "Permission denied"
```bash
chmod +x setup-ubuntu.sh
chmod +x server.js
```

### Erro: "Port already in use"
```bash
# Descobrir o processo usando a porta 3000
lsof -i :3000

# Matar o processo
kill -9 [PID]
```

### Erro com Puppeteer/Chromium
```bash
# Reinstalar chromium
sudo apt update
sudo apt install -y chromium-browser

# Verificar instalação
which chromium-browser
```

### WSL não inicia
No PowerShell (Windows):
```powershell
# Iniciar WSL
wsl --start

# Verificar status
wsl --list --verbose

# Reiniciar WSL
wsl --shutdown
wsl
```

## 📁 Estrutura de Arquivos no Ubuntu

```
/mnt/c/Users/user/Projetos VS Code/HMASPChat - Marcação de Consultas/
├── server.js                    # Servidor principal
├── .env                         # Configurações
├── setup-ubuntu.sh              # Script de instalação
├── server/
│   ├── database/               # Banco SQLite
│   │   └── confirmacoes_arquivadas.db
│   └── data/                   # Dados do aplicativo
├── .wwebjs_auth/               # Sessão WhatsApp
└── node_modules/               # Dependências
```

## 🚀 Scripts Automatizados

### Script de Start Rápido

Crie um script `start.sh`:

```bash
#!/bin/bash
cd "/mnt/c/Users/user/Projetos VS Code/HMASPChat - Marcação de Consultas"
nohup node server.js > server.log 2>&1 &
echo "Servidor iniciado!"
echo "Logs: tail -f server.log"
echo "Parar: pkill -f 'node server.js'"
```

Tornar executável:
```bash
chmod +x start.sh
```

Executar:
```bash
./start.sh
```

### Script de Stop

Crie um script `stop.sh`:

```bash
#!/bin/bash
pkill -f "node server.js"
echo "Servidor parado!"
```

## 💡 Dicas

1. **Manter WSL rodando em background**: O WSL fecha quando você fecha a janela. Use `nohup` para manter o servidor rodando.

2. **Acesso do Windows**: O `localhost` do WSL é acessível diretamente do Windows na maioria dos casos.

3. **Performance**: WSL2 tem melhor performance que WSL1 para aplicações Node.js.

4. **Backup do banco**:
```bash
cp server/database/confirmacoes_arquivadas.db ~/backup-$(date +%Y%m%d).db
```

5. **Atualizar dependências**:
```bash
npm update
```

6. **Limpar cache do npm**:
```bash
npm cache clean --force
```

## 🔐 Segurança

- O arquivo `.env` contém configurações sensíveis. Nunca compartilhe!
- Use `chmod 600 .env` para proteger o arquivo
- Mantenha o sistema atualizado: `sudo apt update && sudo apt upgrade`

## 📞 Suporte

Se encontrar problemas:

1. Verifique os logs: `tail -f server.log`
2. Verifique se todas as dependências estão instaladas
3. Reinicie o WSL: `wsl --shutdown` (no Windows)
4. Execute o setup novamente: `./setup-ubuntu.sh`

## 🎯 Próximos Passos

Após ter o servidor rodando:

1. Acesse `http://localhost:3000` no navegador
2. Configure o WhatsApp (escanear QR Code)
3. Teste o envio de mensagens
4. Configure backup automático do banco de dados

---

**Versão**: 1.0
**Última atualização**: Dezembro 2025
