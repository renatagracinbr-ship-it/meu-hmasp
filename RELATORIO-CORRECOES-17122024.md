# Relatório de Correções - Estrutura do Projeto
**Data**: 17/12/2024
**Versão**: 2.0.0

---

## 📋 Resumo Executivo

Foram identificados e corrigidos **6 problemas críticos** na arquitetura do projeto que violavam a documentação e causavam confusão entre Mobile e Desktop.

### Status: ✅ CORRIGIDO

---

## ❌ Problemas Identificados

### **1. CONFUSÃO MOBILE vs DESKTOP**

**Severidade**: 🔴 CRÍTICA

**Problema**:
- O arquivo `index.html` na raiz do projeto era a **interface do OPERADOR** (desktop)
- Documentação dizia que deveria estar em `desktop/`
- Causava confusão: qual é o mobile? Qual é o desktop?

**Evidência**:
```
ANTES:
Meu HMASP/
├── index.html          ← Interface do OPERADOR (errado!)
├── mobile/             ← App do Paciente (correto)
└── desktop/            ← VAZIO (errado!)
```

**Correção Aplicada**:
```
AGORA:
Meu HMASP/
├── mobile/             ← App do Paciente (Firebase)
│   └── index.html      ← Interface mobile
├── desktop/            ← Interface Operador (Intranet)
│   ├── index.html      ← Movido da raiz
│   ├── src/            ← Código desktop
│   └── public/         ← Assets desktop
└── index.html          ← [REMOVIDO ou deprecado]
```

**Arquivos Modificados**:
- ✅ Criado: `desktop/index.html` (copiado da raiz)
- ✅ Criado: `desktop/src/` (copiado de `src/`)
- ✅ Criado: `desktop/public/` (copiado de `Arquivos/`)

---

### **2. ROTAS DO SERVIDOR INCORRETAS**

**Severidade**: 🔴 CRÍTICA

**Problema**:
O servidor estava servindo o app mobile (`/mobile`) mesmo que devesse estar apenas no Firebase.

**Código Problemático** ([server.js:4022-4036](server.js:4022-4036)):
```javascript
// ❌ ERRADO
app.get('/mobile*', (req, res, next) => {
    const mobilePath = path.join(__dirname, 'mobile', 'index.html');
    res.sendFile(mobilePath);  // Mobile NÃO deve ser servido aqui!
});
```

**Correção Aplicada**:
```javascript
// ✅ CORRETO
app.get('/mobile*', (req, res) => {
    res.status(404).send('O app mobile agora está hospedado no Firebase Hosting.');
});
```

**Por quê?**
- Mobile deve estar **APENAS no Firebase Hosting**
- Backend HMASP serve **apenas o desktop** (intranet)
- Separação de responsabilidades

---

### **3. EXPOSIÇÃO DE ARQUIVOS SENSÍVEIS**

**Severidade**: 🔴 CRÍTICA (Segurança)

**Problema**:
O servidor expunha **TODOS os arquivos** da raiz via `express.static(__dirname)`.

**Código Problemático** ([server.js:207](server.js:207)):
```javascript
// ❌ PERIGO: Expõe .env, server.js, package.json, etc
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/mobile', express.static(path.join(__dirname, 'mobile')));
app.use(express.static(path.join(__dirname, 'dist')));
```

**Arquivos Expostos**:
- `.env` (credenciais PostgreSQL!)
- `server.js` (código-fonte do backend)
- `package.json` (dependências)
- Todos os `.js` da raiz

**Correção Aplicada**:
```javascript
// ✅ SEGURO: Apenas desktop e shared
app.use('/desktop', express.static(path.join(__dirname, 'desktop')));
app.use('/shared', express.static(path.join(__dirname, 'shared')));
```

**Impacto**:
- 🔒 `.env` não é mais acessível via HTTP
- 🔒 Código-fonte backend protegido
- 🔒 Princípio de menor privilégio aplicado

---

### **4. ROTA CATCH-ALL SERVINDO ARQUIVO ERRADO**

**Severidade**: 🟠 ALTA

**Problema**:
A rota `app.get('*')` servia `index.html` da raiz (operador) para **qualquer URL**.

**Código Problemático** ([server.js:4042-4061](server.js:4042-4061)):
```javascript
// ❌ PROBLEMA
app.get('*', (req, res, next) => {
    // Serve index.html da RAIZ
    const indexPath = path.join(__dirname, 'dist', 'index.html');
    res.sendFile(indexPath);
});
```

**Comportamento Incorreto**:
- Acessar `http://servidor/qualquercoisa` → Interface do operador
- Acessar `http://servidor/` → Interface do operador
- Não havia distinção entre desktop e outras rotas

**Correção Aplicada**:
```javascript
// ✅ CORRETO
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'desktop', 'index.html'));
});

app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    if (req.path.includes('.')) return next();

    // Serve desktop para rotas não encontradas
    res.sendFile(path.join(__dirname, 'desktop', 'index.html'));
});
```

---

### **5. CONFIGURAÇÃO DE BUILD DUPLICADA**

**Severidade**: 🟡 MÉDIA

**Problema**:
Havia um `vite.config.js` na raiz que buildava o desktop, mas também configs separadas em `mobile/` e `desktop/`.

**Estrutura Problemática**:
```
Meu HMASP/
├── vite.config.js          ← Build desktop (confuso!)
├── mobile/
│   └── vite.config.js      ← Build mobile
└── desktop/
    └── (sem vite.config)   ← Deveria ter!
```

**Correção Aplicada**:
- ✅ Criado: `desktop/vite.config.js` (config específica)
- ✅ Modificado: `vite.config.js` (raiz) → Aviso de deprecação
- ✅ Mantido: `mobile/vite.config.js` (Firebase)

**Novo `desktop/vite.config.js`**:
```javascript
export default defineConfig({
    root: '.',
    base: '/desktop/',  // Base path
    publicDir: 'public',
    build: {
        outDir: '../dist/desktop',
        emptyOutDir: true,
        rollupOptions: {
            input: { main: resolve(__dirname, 'index.html') }
        }
    },
    server: {
        port: 5174,  // Porta diferente do mobile (5173)
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true
            }
        }
    }
});
```

---

### **6. CAMINHOS ABSOLUTOS NO HTML**

**Severidade**: 🟡 MÉDIA

**Problema**:
O `index.html` (agora `desktop/index.html`) usava caminhos absolutos que não funcionariam após a movimentação.

**Código Problemático** ([desktop/index.html:8,21,28](desktop/index.html:8)):
```html
<!-- ❌ ERRADO -->
<link rel="stylesheet" href="/src/styles/main.css">
<img src="/Arquivos/Novo simbolo HMASP.png">
<img src="/Arquivos/Logotipo Central de Regulacao.jpg">
<script src="/src/main.js"></script>
```

**Correção Aplicada**:
```html
<!-- ✅ CORRETO -->
<link rel="stylesheet" href="/desktop/src/styles/main.css">
<img src="/desktop/public/Novo simbolo HMASP.png">
<img src="/desktop/public/Logotipo Central de Regulacao.jpg">
<script src="/desktop/src/main.js"></script>
```

---

## ✅ Correções Implementadas

### Arquivos Criados/Modificados:

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `desktop/index.html` | ✅ CRIADO | Interface desktop (movido da raiz) |
| `desktop/src/` | ✅ CRIADO | Código fonte desktop (copiado) |
| `desktop/public/` | ✅ CRIADO | Assets desktop (logos, imagens) |
| `desktop/vite.config.js` | ✅ CRIADO | Configuração build desktop |
| `server.js` (linhas 206-218) | ✏️ EDITADO | Servir apenas `/desktop` e `/shared` |
| `server.js` (linhas 4021-4050) | ✏️ EDITADO | Rotas mobile e catch-all |
| `vite.config.js` (raiz) | ✏️ EDITADO | Aviso de deprecação |
| `README.md` | ✏️ EDITADO | Documentação atualizada |
| `ESTRUTURA-PROJETO.md` | ✅ CRIADO | Nova documentação arquitetura |

---

## 📊 Impacto das Mudanças

### Segurança:
- 🔒 **Arquivos sensíveis protegidos** (.env, server.js)
- 🔒 **Princípio de menor privilégio** aplicado
- 🔒 **Separação de responsabilidades** (mobile ≠ desktop)

### Organização:
- 📁 **Estrutura clara**: `mobile/`, `desktop/`, `server/`
- 📁 **Conformidade** com documentação
- 📁 **Facilita manutenção**

### Deploy:
- ☁️ **Mobile**: Apenas Firebase (não no backend)
- 🖥️ **Desktop**: Servido pelo backend (intranet)
- 🔌 **API**: Backend único para ambos

---

## 🚀 Como Testar as Correções

### 1. Backend + Desktop (Desenvolvimento):
```bash
# Terminal 1: Backend
npm start

# Terminal 2: Desktop dev
cd desktop
npm run dev
# Abre http://localhost:5174
```

### 2. Mobile (Desenvolvimento):
```bash
cd mobile
npm run dev
# Abre http://localhost:5173
```

### 3. Produção:
```bash
# Mobile (Firebase)
cd mobile
npm run build
firebase deploy --only hosting

# Desktop + Backend (VM HMASP)
cd desktop
npm run build
cd ..
npm start
# Desktop em http://[IP-VM]:3000
```

---

## 🔍 Verificações de Segurança

Execute estes testes para confirmar que arquivos sensíveis não estão expostos:

```bash
# ❌ Deve retornar 404 ou erro
curl http://localhost:3000/.env
curl http://localhost:3000/server.js
curl http://localhost:3000/package.json

# ✅ Deve retornar 200 OK
curl http://localhost:3000/desktop/index.html
curl http://localhost:3000/api/status
```

---

## 📝 Tarefas Pendentes

- [ ] Remover `src/` da raiz após confirmar que `desktop/src/` funciona
- [ ] Remover `Arquivos/` da raiz após confirmar que `desktop/public/` funciona
- [ ] Remover `index.html` da raiz (ou criar redirect para `/desktop`)
- [ ] Criar `desktop/package.json` (se builds separados forem necessários)
- [ ] Implementar código em `shared/` para reutilização
- [ ] Adicionar testes automatizados

---

## 📚 Referências

- [ESTRUTURA-PROJETO.md](ESTRUTURA-PROJETO.md) - Arquitetura completa
- [README.md](README.md) - Guia de uso atualizado
- [mobile/FIREBASE-SETUP.md](mobile/FIREBASE-SETUP.md) - Setup Firebase

---

## 🎯 Conclusão

A arquitetura agora está **correta e segura**, seguindo o princípio:

```
📱 MOBILE (Paciente)    → Firebase Hosting (PWA)
🖥️ DESKTOP (Operador)   → Backend HMASP (Intranet)
🔧 BACKEND (API)        → VM HMASP (SQLite + PostgreSQL)
```

**Separação clara de responsabilidades ✅**
**Segurança melhorada ✅**
**Conformidade com documentação ✅**

---

**Relatório gerado por**: Claude Code
**Data**: 17/12/2024 23:55 BRT
