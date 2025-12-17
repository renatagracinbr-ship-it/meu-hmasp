# Correções de Segurança - HMASP Chat
**Data:** 2025-12-12

## Resumo das Correções Aplicadas

Este documento detalha as correções de segurança críticas aplicadas ao sistema HMASP Chat.

---

## 1. Exposição de Credenciais - CORRIGIDO ✅

### Problema
Credenciais do banco de dados AGHUse estavam em plain text no arquivo `.env`:
- IP do servidor: 10.12.40.219
- Usuário: birm_read
- Senha: birm@read (exposta)

### Correção Aplicada
- ✅ Arquivo `.env` modificado para usar variáveis de ambiente do sistema
- ✅ Arquivo `.env.example` já existe como template seguro
- ✅ `.gitignore` já configurado para ignorar `.env`

### Ação Necessária do Administrador
```bash
# Configure as variáveis de ambiente no sistema:
export DB_HOST=10.12.40.219
export DB_PORT=5432
export DB_NAME=dbaghu
export DB_USER=birm_read
export DB_PASSWORD=sua_senha_aqui

# Ou adicione ao arquivo de perfil do usuário:
echo 'export DB_HOST=10.12.40.219' >> ~/.bashrc
echo 'export DB_PASSWORD=sua_senha_aqui' >> ~/.bashrc
source ~/.bashrc
```

---

## 2. Senhas em Plain Text - CORRIGIDO ✅

### Problema
Senhas de usuários armazenadas sem hash em `server/data/users.json`

### Correção Aplicada
- ✅ Bcrypt instalado (`npm install bcrypt`)
- ✅ Função `authenticateUser()` atualizada para usar bcrypt
- ✅ Funções `createUser()` e `requestAccess()` atualizam para hash de senhas
- ✅ **Migração automática**: Senhas antigas em plain text serão convertidas para hash no primeiro login

### Como Funciona
```javascript
// Ao fazer login, o sistema:
1. Verifica se a senha está em hash (começa com $2b$ ou $2a$)
2. Se SIM: Valida com bcrypt.compare()
3. Se NÃO: Compara plain text E automaticamente converte para hash
4. Próximo login já usa hash
```

### Ação Necessária
**NENHUMA** - A migração é automática quando os usuários fizerem login.

---

## 3. Vulnerabilidade RCE (Remote Code Execution) - CORRIGIDO ✅

### Problema
Endpoints executavam comandos do sistema sem validação:
- `/api/force-update`
- `/api/fix-git`
- `/api/full-sync`
- `/api/rebuild-frontend`
- `/api/admin/update`

### Correção Aplicada
- ✅ **Todos os endpoints de controle remoto foram DESABILITADOS**
- ✅ Retornam HTTP 403 (Forbidden) com mensagens informativas
- ✅ Função `executeSecureCommand()` criada usando `execFile()` (mais segura)
- ✅ Whitelist de comandos permitidos implementada
- ✅ Validação de argumentos contra caracteres perigosos

### Endpoints Desabilitados
```javascript
POST /api/force-update      → 403 Forbidden
POST /api/fix-git           → 403 Forbidden
POST /api/full-sync         → 403 Forbidden
POST /api/rebuild-frontend  → 403 Forbidden
POST /api/admin/update      → 403 Forbidden
```

### Alternativas para Deploy/Atualização
Use **SSH direto no servidor**:

```bash
# Conectar ao servidor
ssh usuario@servidor

# Atualizar aplicação
cd /opt/hmasp/hmasp-chat-v2
git pull origin main
npm install
npm run build
systemctl restart hmasp-chat
```

Ou crie um script de deploy seguro:
```bash
# deploy-update.sh
#!/bin/bash
set -e

echo "Atualizando HMASP Chat..."
cd /opt/hmasp/hmasp-chat-v2
git pull origin main
npm install --production
npm run build
systemctl restart hmasp-chat
echo "Atualização concluída!"
```

---

## 4. Função Segura de Abertura de URLs - CORRIGIDO ✅

### Problema
Uso de `exec()` com `start` para abrir navegador (vulnerável)

### Correção Aplicada
- ✅ Substituído por `execFile()` com argumentos separados
- ✅ Detecção de plataforma (Windows/macOS/Linux)
- ✅ Comandos específicos por plataforma com argumentos validados

---

## Endpoints de Diagnóstico - PARCIALMENTE CORRIGIDO ⚠️

### `/api/diagnostic` - Mantido com Melhorias
- ✅ Substituído `exec()` por `executeSecureCommand()`
- ✅ Validação de argumentos
- ✅ Informações de processo via API do Node (sem `ps aux`)

---

## Verificação das Correções

### Teste 1: Bcrypt Funcionando
```bash
# Faça login com um usuário existente
# Verifique nos logs:
[Auth] Migrando senha do usuário XXX para bcrypt
```

### Teste 2: Endpoints Desabilitados
```bash
curl -X POST http://localhost:3000/api/force-update
# Deve retornar:
# {"success":false,"error":"Este endpoint foi desabilitado por questões de segurança",...}
```

### Teste 3: Variáveis de Ambiente
```bash
# No servidor, verifique:
echo $DB_HOST
echo $DB_PASSWORD
# Devem mostrar os valores corretos (não devem estar vazios)
```

---

## Recomendações Adicionais

### Próximos Passos (NÃO implementados ainda)
1. **Autenticação em endpoints sensíveis** (não foram corrigidos conforme solicitado)
2. **Rate limiting** para prevenir ataques de força bruta
3. **Logs estruturados** (JSON) para melhor auditoria
4. **HTTPS/TLS** para criptografia em trânsito
5. **Validação de entrada** em todos os endpoints de API

### Monitoramento
Fique atento nos logs para:
- Tentativas de acesso aos endpoints desabilitados
- Migrações automáticas de senha
- Erros de autenticação

---

## Responsável
Correções aplicadas em: 2025-12-12
Por: Claude Code (Análise Automática de Segurança)

