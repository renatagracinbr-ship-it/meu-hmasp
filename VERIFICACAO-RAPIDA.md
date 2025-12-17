# ⚡ VERIFICAÇÃO RÁPIDA - HMASP CHAT

Use estes comandos para verificar rapidamente se tudo está funcionando:

---

## 🔍 VERIFICAÇÕES ANTES DE INICIAR

### 1. Verificar se está na pasta correta:
```bash
pwd
# Deve mostrar: .../HMASPChat - Marcação de Consultas
```

### 2. Verificar se o build está atualizado:
```bash
ls -lh dist/assets/main-*.js | head -1
# Deve mostrar data de hoje (06 dez)
```

### 3. Verificar credenciais AGHUse no .env:
```bash
grep "DB_HOST" .env
# Deve mostrar: DB_HOST=10.12.40.219
```

---

## 🚀 INICIAR SERVIDOR

### Windows:
```bash
node server.js
```

### Linux/Ubuntu VM:
```bash
bash start.sh
```

**Aguardar mensagem:**
```
[Server] ✅ Servidor HTTP rodando na porta 3000
```

---

## ✅ TESTES PÓS-INICIALIZAÇÃO

### 1. Testar Conexão AGHUse:
```bash
curl http://localhost:3000/api/aghuse/test-connection
```

**Resposta esperada:**
```json
{
  "success": true,
  "timestamp": "2024-12-06T...",
  "version": "PostgreSQL 11..."
}
```

### 2. Verificar Status do WhatsApp:
```bash
curl http://localhost:3000/api/whatsapp/status
```

**Respostas possíveis:**
- `isReady: true` → WhatsApp conectado ✅
- `hasQr: true` → Precisa escanear QR Code
- Outro → Verificar logs

### 3. Testar Consultas Recentes (últimos 60 min):
```bash
curl http://localhost:3000/api/aghuse/recent-appointments?minutes=60
```

**Resposta esperada:**
```json
{
  "success": true,
  "appointments": [...]
}
```

---

## 🌐 VERIFICAR INTERFACES NO NAVEGADOR

### Interface Principal (Operadores):
```
http://localhost:3000/
```

**O que verificar:**
- ✅ Página carrega sem erros no console
- ✅ Abas: Chat | Confirmação | Desmarcação | Lembrete 72h
- ✅ NENHUM log de "TabMaster"
- ✅ NENHUM log de "Firebase"

### Interface Admin (VM):
```
http://localhost:3000/admin.html
```

**O que verificar:**
- ✅ Mesmas abas da interface principal
- ✅ Sistema de envio automático ativo
- ✅ Console limpo (sem erros de timeout repetidos)

### WhatsApp Admin:
```
http://localhost:3000/whatsapp-admin.html
```

**O que verificar:**
- ✅ Status do WhatsApp visível
- ✅ QR Code aparece (se não conectado)
- ✅ Botão "Gerar Novo QR Code" funciona

---

## 🐛 VERIFICAR LOGS DO CONSOLE

### Console do Navegador (F12):

**✅ CORRETO - Deve aparecer:**
```
[App] Iniciando aplicação HMASP Chat...
[AGHUse] Usando backend: http://localhost:3000/api
[WhatsApp] Verificando status...
```

**❌ NÃO DEVE APARECER:**
```
TabMaster iniciado
Firebase initialized
Connection terminated (repetido 100x)
```

### Console do Servidor (terminal):

**✅ CORRETO - Deve aparecer:**
```
[Server] ✅ Servidor HTTP rodando na porta 3000
[AGHUse] ✅ Pool de conexões criado
[WhatsApp] Cliente iniciado
```

**❌ NÃO DEVE APARECER:**
```
❌ Erro ao conectar: ETIMEDOUT (repetido)
❌ Connection terminated (repetido)
Firebase error
```

---

## 🔧 TROUBLESHOOTING

### Problema: "Cannot connect to AGHUse"

**Verificar:**
1. Está conectado na VPN do HMASP?
2. IP correto no .env? (10.12.40.219)
3. Firewall bloqueando porta 5432?

**Teste:**
```bash
ping 10.12.40.219
# Deve responder
```

### Problema: "WhatsApp not connected"

**Solução:**
1. Abrir WhatsApp Admin: http://localhost:3000/whatsapp-admin.html
2. Escanear QR Code com WhatsApp do celular
3. Aguardar mensagem "WhatsApp conectado"

### Problema: "Consultas não aparecem"

**Verificar:**
1. Há consultas marcadas nos últimos 60 minutos?
2. Conexão AGHUse OK?
3. Console mostra erros?

**Teste:**
```bash
curl http://localhost:3000/api/aghuse/recent-appointments?minutes=1440
# Testa últimas 24h
```

### Problema: "TabMaster logs ainda aparecem"

**Solução:**
```bash
# Frontend desatualizado, refazer build:
npm run build
# Depois reiniciar servidor
```

---

## 📊 CHECKLIST COMPLETO

Use este checklist após iniciar o servidor:

```
□ Servidor iniciou sem erros
□ Conexão AGHUse OK (curl test-connection)
□ Interface Principal carrega (http://localhost:3000/)
□ Interface Admin carrega (admin.html)
□ WhatsApp Admin carrega (whatsapp-admin.html)
□ Console navegador SEM "TabMaster"
□ Console navegador SEM "Firebase"
□ Console servidor SEM timeout repetidos
□ Consultas recentes carregam (se houver)
□ WhatsApp conectado OU QR Code aparece
```

**Se TODOS os itens estão ✅:** Sistema funcionando perfeitamente!

---

## 📞 COMANDOS ÚTEIS

### Ver últimas 20 linhas do log:
```bash
tail -20 logs/app.log
```

### Ver logs em tempo real:
```bash
tail -f logs/app.log
```

### Parar servidor (Ctrl+C não funciona):
```bash
# Windows
taskkill /F /IM node.exe

# Linux
pkill -f "node server.js"
```

### Limpar sessão WhatsApp (forçar novo QR):
```bash
# Parar servidor primeiro!
rm -rf server/.wwebjs_auth
```

---

**Última verificação:** 06/12/2024 às 06:54
**Status:** ✅ Tudo funcionando
