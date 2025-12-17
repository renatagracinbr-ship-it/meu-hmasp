# ✅ Checklist Pré-Deploy - HMASP Chat

Use este checklist antes de fazer deploy em produção (VM do HMASP).

---

## 📋 Preparação no Desenvolvimento (Windows/WSL)

### Código e Configurações

- [x] ✅ Linha 333 do server.js corrigida (executablePath removido)
- [x] ✅ Todos os caminhos usam `path.join(__dirname)`
- [x] ✅ Não há caminhos hardcoded do Windows (C:\\, D:\\)
- [ ] ⚠️ Arquivo `.env` configurado com dados do banco HMASP
- [x] ✅ Auto-login habilitado (sem necessidade de senha)
- [x] ✅ `.gitignore` protege arquivos sensíveis (.env, server/data/, .wwebjs_auth/)

### Build e Testes

- [ ] ⚠️ Frontend compilado (`npm run build`)
- [ ] ⚠️ `dist/` contém arquivos compilados
- [ ] ⚠️ Testado localmente com `bash start.sh`
- [ ] ⚠️ WhatsApp conectou e enviou mensagem de teste
- [ ] ⚠️ Conexão com banco AGHUse testada

### Documentação

- [x] ✅ `README.md` atualizado
- [x] ✅ `DEPLOY-LINUX.md` criado
- [x] ✅ `INICIO-RAPIDO-LINUX.md` criado
- [x] ✅ `install-linux.sh` criado e testável
- [x] ✅ `.env.example` atualizado

---

## 🖥️ Preparação no Linux de Teste

### Sistema Operacional

- [ ] ⚠️ Ubuntu 20.04+ ou Debian 11+ instalado
- [ ] ⚠️ Sistema atualizado (`sudo apt update && sudo apt upgrade`)
- [ ] ⚠️ Usuário com permissões sudo configurado

### Instalação Automática

- [ ] ⚠️ Projeto transferido para Linux (git clone ou scp)
- [ ] ⚠️ Executado `bash install-linux.sh` com sucesso
- [ ] ⚠️ Node.js 20 instalado corretamente
- [ ] ⚠️ Dependências do Chrome/Puppeteer instaladas
- [ ] ⚠️ `npm install` executado sem erros
- [ ] ⚠️ Frontend compilado (`dist/` populado)

### Configuração

- [ ] ⚠️ `.env` criado e configurado
- [ ] ⚠️ `DB_HOST` aponta para servidor de teste/desenvolvimento
- [ ] ⚠️ Pastas criadas: `logs/`, `server/data/`, `.wwebjs_auth/`
- [ ] ⚠️ Permissões corretas (chmod 755)

### Testes

- [ ] ⚠️ Servidor inicia sem erros (`bash start.sh`)
- [ ] ⚠️ Interface Principal acessível (http://localhost:3000/)
- [ ] ⚠️ WhatsApp Admin acessível (http://localhost:3000/whatsapp-admin.html)
- [ ] ⚠️ QR Code gerado e escaneado com sucesso
- [ ] ⚠️ WhatsApp conectou
- [ ] ⚠️ Conexão com banco de dados funcionando
- [ ] ⚠️ Busca de consultas funciona
- [ ] ⚠️ Envio de mensagem de teste funciona
- [ ] ⚠️ Logs sendo gravados em `logs/app.log`

---

## 🏥 Deploy na VM do HMASP (Produção)

### Pré-Requisitos na VM

- [ ] ⚠️ VM do HMASP provisionada e acessível via SSH
- [ ] ⚠️ Ubuntu 20.04+ instalado
- [ ] ⚠️ IP fixo configurado
- [ ] ⚠️ Acesso à rede interna do HMASP
- [ ] ⚠️ Conectividade com servidor de banco AGHUse testada
  ```bash
  ping 10.12.40.219
  telnet 10.12.40.219 5432
  ```

### Transferência do Projeto

**Opção A: Via Git**
- [ ] ⚠️ Git instalado na VM (`sudo apt install git`)
- [ ] ⚠️ Repositório clonado: `git clone https://github.com/renatagracinbr-ship-it/HMASP-Chat.git`

**Opção B: Via SCP (se sem acesso Git)**
- [ ] ⚠️ Zip do projeto transferido: `scp hmasp-chat-deploy-CORRETO.zip usuario@IP_VM:~/`
- [ ] ⚠️ Descompactado: `unzip hmasp-chat-deploy-CORRETO.zip`

### Instalação

- [ ] ⚠️ Executado `bash install-linux.sh` na VM
- [ ] ⚠️ Node.js 20 instalado
- [ ] ⚠️ Dependências instaladas sem erros
- [ ] ⚠️ Chrome/Puppeteer configurado

### Configuração de Produção

- [ ] ⚠️ `.env` editado com dados REAIS do banco HMASP
  ```env
  NODE_ENV=production
  PORT=3000
  DB_HOST=10.12.40.219  # IP REAL do banco HMASP
  DB_PORT=5432
  DB_NAME=dbaghu
  DB_USER=birm_read
  DB_PASSWORD=birm@read
  ```
- [ ] ⚠️ Auto-login habilitado em `server/data/auto-login.json`

### Firewall e Rede

- [ ] ⚠️ Porta 3000 liberada no firewall
  ```bash
  sudo ufw allow 3000/tcp
  sudo ufw enable
  ```
- [ ] ⚠️ Firewall da rede HMASP configurado (se necessário)
- [ ] ⚠️ Acesso testado de outras máquinas da rede interna

### Inicialização

**Teste Inicial**
- [ ] ⚠️ Servidor iniciado manualmente: `bash start.sh`
- [ ] ⚠️ Todas as interfaces acessíveis (trocar localhost por IP da VM)
- [ ] ⚠️ WhatsApp conectado e testado
- [ ] ⚠️ Busca de consultas AGHUse funcionando
- [ ] ⚠️ Envio de mensagens testado

**Configuração para Produção (PM2)**
- [ ] ⚠️ PM2 instalado: `sudo npm install -g pm2`
- [ ] ⚠️ Servidor iniciado via PM2: `pm2 start server.js --name hmasp-chat`
- [ ] ⚠️ Auto-start configurado:
  ```bash
  pm2 startup systemd
  # EXECUTAR O COMANDO QUE APARECER
  pm2 save
  ```
- [ ] ⚠️ Testado reinício da VM (servidor inicia automaticamente?)

### Monitoramento e Logs

- [ ] ⚠️ Logs sendo gravados: `tail -f logs/app.log`
- [ ] ⚠️ PM2 monitoramento configurado: `pm2 monit`
- [ ] ⚠️ Sistema de backup configurado (opcional mas recomendado)

### Testes Finais em Produção

- [ ] ⚠️ Interface carrega automaticamente (auto-login)
- [ ] ⚠️ Busca de consultas marcadas funciona
- [ ] ⚠️ Busca de consultas desmarcadas funciona
- [ ] ⚠️ Busca de lembretes 72h funciona
- [ ] ⚠️ Envio de mensagem WhatsApp funciona
- [ ] ⚠️ Envio em lote funciona
- [ ] ⚠️ Fila de mensagens processa corretamente
- [ ] ⚠️ Interface Admin funciona (envio automático)
- [ ] ⚠️ Logs de auditoria sendo gravados

---

## 🔐 Segurança

- [ ] ⚠️ Firewall configurado (apenas rede interna pode acessar porta 3000)
- [ ] ⚠️ Arquivo `.env` com permissões restritas: `chmod 600 .env`
- [ ] ⚠️ SSH do servidor configurado com chave (desabilitar senha, se possível)
- [ ] ⚠️ Atualizações de segurança do sistema aplicadas
- [ ] ⚠️ Backup automático configurado

---

## 📞 Pós-Deploy

### Documentação

- [ ] ⚠️ IP da VM documentado
- [ ] ⚠️ Dados de conexão do banco documentados em local seguro
- [ ] ⚠️ Procedimentos de backup documentados
- [ ] ⚠️ Procedimentos de atualização documentados
- [ ] ⚠️ Contatos de suporte documentados

### Treinamento

- [ ] ⚠️ Equipe treinada para usar interface principal
- [ ] ⚠️ Equipe treinada para usar interface admin
- [ ] ⚠️ TI treinada para monitorar logs e resolver problemas
- [ ] ⚠️ Procedimento de QR Code explicado (reconexão WhatsApp)

### Monitoramento Contínuo

- [ ] ⚠️ Verificar logs diariamente (primeiros 7 dias)
- [ ] ⚠️ Monitorar uso de recursos (CPU, RAM, disco)
- [ ] ⚠️ Verificar se mensagens estão sendo enviadas
- [ ] ⚠️ Coletar feedback dos usuários

---

## 🆘 Contatos de Emergência

| Problema | Ação | Comando |
|----------|------|---------|
| Servidor não responde | Reiniciar PM2 | `pm2 restart hmasp-chat` |
| WhatsApp desconectou | Escanear QR novamente | Acessar `/whatsapp-admin.html` |
| Erro de banco | Verificar conectividade | `ping 10.12.40.219` |
| Porta ocupada | Verificar processo | `sudo lsof -i :3000` |
| Logs cheios | Limpar logs antigos | `find logs/ -mtime +30 -delete` |

---

## ✅ Aprovação Final

- [ ] ⚠️ Todos os itens acima foram verificados
- [ ] ⚠️ Testes em produção passaram
- [ ] ⚠️ Equipe aprovou para uso
- [ ] ⚠️ Backups configurados
- [ ] ⚠️ Monitoramento em operação

**Data do Deploy:** ___/___/______

**Responsável:** _________________________

**Aprovado por:** _________________________

---

**Última atualização:** Dezembro 2024
