# ⚠️ LEIA-ME PRIMEIRO - Estrutura Atualizada

**Data da Atualização**: 17/12/2024
**Status**: ✅ PROJETO REORGANIZADO

---

## 🎯 O QUE MUDOU?

O projeto **Meu HMASP** foi completamente reorganizado para seguir a arquitetura documentada. Agora há **separação clara** entre Mobile, Desktop e Backend.

---

## 📁 NOVA ESTRUTURA

```
Meu HMASP/
│
├── mobile/          ☁️ App do PACIENTE (Firebase Hosting)
│   └── App mobile (PWA) para pacientes
│
├── desktop/         🖥️ Interface do OPERADOR (Intranet HMASP)
│   └── Interface web para operadores
│
└── server/          🔧 BACKEND (VM HMASP)
    └── API + Banco de Dados (SQLite + PostgreSQL)
```

---

## 🚀 COMO INICIAR O PROJETO?

### **Windows (Recomendado)**

**Duplo-clique em**: `INICIAR.bat`

Você verá um menu:
```
1. Backend + Desktop (Operador - Intranet)
2. Mobile Dev (Desenvolvimento Local)
3. Ambos (Backend + Desktop Dev + Mobile Dev)
4. Apenas Backend (API)
```

Escolha a opção conforme sua necessidade.

---

### **Linux/Mac ou Manual**

#### **Backend (Obrigatório)**
```bash
npm start
```

#### **Desktop (Desenvolvimento)**
```bash
cd desktop
npm run dev
```
Acesso: http://localhost:5174

#### **Mobile (Desenvolvimento)**
```bash
cd mobile
npm run dev
```
Acesso: http://localhost:5173

---

## 📊 ARQUITETURA

```
┌─────────────────────────────────────────┐
│         📱 PACIENTES (Mobile)           │
│     https://meu-hmasp.web.app          │
│         ☁️ Firebase Hosting              │
└──────────────┬──────────────────────────┘
               │ HTTPS API
               ↓
┌─────────────────────────────────────────┐
│       🔧 BACKEND (VM HMASP)             │
│       http://[IP]:3000                  │
│  ┌──────────────┐  ┌─────────────┐     │
│  │  Desktop     │  │   API       │     │
│  │  /desktop/   │  │   /api/*    │     │
│  └──────────────┘  └─────────────┘     │
│                                         │
│  SQLite (Chat) + PostgreSQL (AGHUse)   │
└──────────────▲──────────────────────────┘
               │ Intranet
               │
┌──────────────┴──────────────────────────┐
│      🖥️ OPERADORES (Desktop)            │
│      http://[IP]:3000/desktop          │
└─────────────────────────────────────────┘
```

---

## ⚡ PRINCIPAIS MUDANÇAS

### ✅ **ANTES vs DEPOIS**

| Item | ❌ ANTES | ✅ AGORA |
|------|---------|----------|
| **Interface Desktop** | `index.html` na raiz | `desktop/index.html` |
| **Mobile no Backend** | ❌ Servido pelo backend | ✅ Apenas no Firebase |
| **Arquivos Expostos** | ❌ `.env`, `server.js` | ✅ Protegidos |
| **Rotas** | ❌ Confusas | ✅ Organizadas |
| **Build** | ❌ Único config | ✅ Separado (mobile/desktop) |

---

## 📝 CORREÇÕES APLICADAS

1. ✅ **Desktop movido para pasta própria** (`desktop/`)
2. ✅ **Rotas do servidor corrigidas** (não serve mais mobile)
3. ✅ **Segurança melhorada** (arquivos sensíveis protegidos)
4. ✅ **Build configurations separadas** (mobile + desktop)
5. ✅ **Caminhos ajustados** (CSS, JS, Assets)
6. ✅ **Documentação atualizada**

---

## 📚 DOCUMENTAÇÃO COMPLETA

| Documento | Descrição |
|-----------|-----------|
| [INICIO-RAPIDO.md](INICIO-RAPIDO.md) | Como executar o projeto |
| [README.md](README.md) | Visão geral atualizada |
| [ESTRUTURA-PROJETO.md](ESTRUTURA-PROJETO.md) | Arquitetura detalhada |
| [RELATORIO-CORRECOES-17122024.md](RELATORIO-CORRECOES-17122024.md) | Todas as correções |
| [VERIFICACAO-COMPLETA.md](VERIFICACAO-COMPLETA.md) | Checklist de conformidade |

---

## 🔍 VERIFICAÇÃO RÁPIDA

### **Teste se está funcionando:**

```bash
# 1. Inicie o projeto
INICIAR.bat
# Escolha opção 1 ou 3

# 2. Verifique as URLs:

# Backend (deve retornar JSON)
curl http://localhost:3000/api/status

# Desktop Dev (deve abrir a interface)
start http://localhost:5174

# Desktop Produção (deve abrir a interface)
start http://localhost:3000/desktop
```

---

## ⚠️ IMPORTANTE

### **Mobile em PRODUÇÃO:**
- ✅ Hospedado no **Firebase Hosting**
- ❌ **NÃO** é servido pelo backend HMASP
- 🔗 URL: `https://meu-hmasp.web.app` (ou domínio customizado)

### **Desktop:**
- ✅ Servido pelo **Backend HMASP** (intranet)
- 🔗 URL: `http://[IP-SERVIDOR]:3000/desktop`
- 🔒 Acesso apenas na **intranet HMASP**

### **Backend:**
- ✅ API disponível para **mobile E desktop**
- 🔗 URL: `http://[IP-SERVIDOR]:3000/api`
- 💾 SQLite (chat) + PostgreSQL (AGHUse)

---

## 🎓 PARA NOVOS DESENVOLVEDORES

1. ✅ Leia este arquivo primeiro
2. ✅ Leia [INICIO-RAPIDO.md](INICIO-RAPIDO.md)
3. ✅ Execute `INICIAR.bat` (opção 3)
4. ✅ Explore a arquitetura em [ESTRUTURA-PROJETO.md](ESTRUTURA-PROJETO.md)
5. ✅ Comece a desenvolver!

---

## 🆘 PRECISA DE AJUDA?

### **Problema Comum #1: "Não consigo iniciar"**
- ✅ Certifique-se que Node.js está instalado
- ✅ Execute `npm install` na raiz, `mobile/` e `desktop/`
- ✅ Veja [INICIO-RAPIDO.md](INICIO-RAPIDO.md) → Troubleshooting

### **Problema Comum #2: "Desktop não carrega CSS"**
- ✅ Os caminhos agora são `/desktop/src/...`
- ✅ Verifique `desktop/index.html` (linhas 8, 21, 28, 759)

### **Problema Comum #3: "Mobile não funciona"**
- ✅ Mobile dev: `cd mobile && npm run dev`
- ✅ Mobile produção: Firebase Hosting (não no backend)

---

## 📞 CONTATO

- 📧 Reporte bugs no GitHub Issues
- 📝 Leia a documentação completa
- 🤝 Contribua com melhorias

---

## ✅ CHECKLIST DE INÍCIO

- [ ] Li este documento
- [ ] Li [INICIO-RAPIDO.md](INICIO-RAPIDO.md)
- [ ] Instalei Node.js
- [ ] Executei `INICIAR.bat`
- [ ] Testei backend (http://localhost:3000/api/status)
- [ ] Testei desktop (http://localhost:5174)
- [ ] Entendi a arquitetura (mobile/desktop/backend)

---

**🎉 Pronto! Agora você está preparado para trabalhar no projeto Meu HMASP!**

---

**Desenvolvido para HMASP São Paulo**
**Versão**: 2.0.0 (Estrutura Reorganizada)
**Data**: 17/12/2024
