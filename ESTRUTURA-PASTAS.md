# ESTRUTURA DE PASTAS - HMASP CHAT

**Data da última atualização:** 06/12/2024
**Status:** Organizado e sem Firebase

---

## 📁 PASTAS PRINCIPAIS (PRODUÇÃO)

### `src/` - CÓDIGO FONTE FRONTEND
**O QUE É:** Código-fonte JavaScript moderno e modular
**USADO EM:** Desenvolvimento (quando roda `npm run dev`)
**IMPORTANTE:** Modificações aqui NÃO aparecem em produção até rodar `npm run build`

**Conteúdo:**
- `main.js` - Arquivo principal da aplicação
- `auth-client.js` - Stub de autenticação (Firebase removido)
- `components/` - Componentes da interface
  - `confirmacaoPresenca.js` - Confirmação de consultas
  - `desmarcacaoConsultas.js` - Desmarcação de consultas
- `services/` - Serviços de integração
  - `aghuse.service.js` - Cliente AGHUse (10.12.40.219)
  - `whatsapp.service.js` - Cliente WhatsApp
  - `confirmacao.service.js` - Lógica de confirmação
  - `lembrete72h.service.js` - Lembretes 72h
  - `desmarcacao.service.js` - Lógica de desmarcação
  - ⚠️ **STUBS (Firebase removido):**
    - `agenda.service.js`
    - `pacientes.service.js`
    - `auditService.js`
- `utils/` - Utilitários
  - `phoneNormalizer.js` - Normalização de telefones
  - `dateUtils.js` - Formatação de datas

### `dist/` - CÓDIGO COMPILADO FRONTEND
**O QUE É:** Código otimizado e minificado para produção
**USADO EM:** Produção (quando roda `node server.js`)
**IMPORTANTE:** Gerado automaticamente por `npm run build`

**NÃO EDITE MANUALMENTE!** Sempre use:
```bash
npm run build
```

### `server/` - BACKEND NODE.JS
**O QUE É:** Servidor backend (Node.js + Express)
**USADO EM:** Sempre (desenvolvimento e produção)

**Conteúdo:**
- `aghuse-server.js` - Backend AGHUse PostgreSQL
  - **Credenciais:** 10.12.40.219:5432/dbaghu/birm_read
  - **Timeout:** 30s
  - **Retry:** 3 tentativas com backoff exponencial
- `auth.js` - Autenticação local (Firebase removido)

### `public/` - ARQUIVOS HTML ESTÁTICOS
**O QUE É:** Páginas HTML servidas diretamente
**USADO EM:** Produção

**Conteúdo:**
- `admin.html` - Interface Admin (VM - envio automático)
- `whatsapp-admin.html` - Admin WhatsApp (QR Code/Status)

---

## 📁 PASTAS DE CONFIGURAÇÃO

### `Arquivos/` - ASSETS PÚBLICOS
**O QUE É:** Imagens e documentos servidos pelo Vite
**Configurado em:** `vite.config.js` (publicDir)

### `.wwebjs_auth/` - SESSÃO WHATSAPP
**O QUE É:** Dados de autenticação do WhatsApp
**NÃO VERSIONAR** (está no .gitignore)

---

## 📁 PASTAS LEGADAS/TEMPORÁRIAS

### `_arquivos_antigos/` - BACKUP
Código antigo preservado por segurança

### `database/` - SCHEMAS SQL
Schemas de banco (não usado ativamente)

### `docs/` - DOCUMENTAÇÃO
Manuais e documentação do projeto

### `electron/` - ELECTRON APP
Aplicação desktop (legado, não usado)

### `extensao-chrome/` - EXTENSÃO CHROME
Extensão browser (legado, não usado)

---

## 📄 ARQUIVOS IMPORTANTES

### Arquivos de Configuração Ativos:
- `.env` - **CREDENCIAIS AGHUse** (10.12.40.219)
- `vite.config.js` - Build do frontend
- `package.json` - Dependências npm
- `server.js` - Servidor principal

### Arquivos de Inicialização:
- `INICIAR.bat` - Windows (abre 3 abas navegador)
- `start.sh` - Linux/Ubuntu VM (abre navegador automaticamente)

### Arquivos HTML:
- `index.html` - Interface Principal (Operadores)
- `public/admin.html` - Interface Admin (VM)
- `public/whatsapp-admin.html` - WhatsApp Status

---

## ⚠️ REGRAS IMPORTANTES

### 1. NUNCA EDITE `dist/` MANUALMENTE
```bash
# ❌ ERRADO
nano dist/assets/main-xyz.js

# ✅ CORRETO
nano src/main.js
npm run build
```

### 2. SEMPRE REBUILD APÓS MODIFICAR `src/`
```bash
# Modificou arquivos em src/?
npm run build
```

### 3. CREDENCIAIS AGHUse CORRETAS
```
Host: 10.12.40.219
Port: 5432
Database: dbaghu
User: birm_read
Password: birm@read
```

### 4. FIREBASE COMPLETAMENTE REMOVIDO
- ❌ Não tem mais Firebase
- ❌ Não tem mais autenticação Google
- ✅ Acesso direto sem login
- ✅ Stubs mantidos para compatibilidade

---

## 🔄 WORKFLOW DE DESENVOLVIMENTO

### Modificar Código:
1. Editar arquivos em `src/`
2. Rodar `npm run build`
3. Reiniciar servidor: `node server.js`

### Deploy para VM:
1. Fazer build: `npm run build`
2. Copiar arquivos via SCP/Git
3. Rodar `bash start.sh` na VM

---

## 🗑️ ARQUIVOS QUE PODEM SER REMOVIDOS

Estes arquivos são legados/temporários e podem ser deletados:
- `*.txt` (instruções antigas)
- `*.zip` (deploys antigos)
- `*.py`, `*.ps1` (scripts temporários)
- `diagnostico-*.js` (debug)
- `check-*.js` (debug)
- `test-*.js` (testes antigos)
- `server-*.js` (versões antigas do servidor)

---

## ✅ STATUS ATUAL (06/12/2024)

- ✅ Firebase **COMPLETAMENTE REMOVIDO**
- ✅ TabMaster **REMOVIDO**
- ✅ Credenciais AGHUse **CORRETAS** (10.12.40.219)
- ✅ Timeout errors **FILTRADOS**
- ✅ Retry logic **IMPLEMENTADO**
- ✅ Frontend **COMPILADO** (`dist/` atualizado)
- ✅ 2 navegadores separados (Principal + Admin)

**Última compilação:** `npm run build` executado com sucesso
**Pronto para produção:** Sim ✅
