# 🚀 Início Rápido - Meu HMASP

## ⚡ Execução Rápida (Windows)

### **Opção 1: Duplo-clique**
```
📁 Abra a pasta do projeto
🖱️ Duplo-clique em: INICIAR.bat
✅ Escolha a opção desejada
```

### **Opção 2: Linha de comando**
```bash
INICIAR.bat
```

---

## 🎯 Modos de Execução

### **1️⃣ Backend + Desktop (Operador - Intranet)**
**Recomendado para**: Operadores da Central de Regulação

**O que inicia**:
- ✅ Backend API (porta 3000)
- ✅ Desktop Dev Server (porta 5174)

**URLs**:
- Desktop Dev: http://localhost:5174
- Desktop Prod: http://localhost:3000/desktop
- API: http://localhost:3000/api/status

---

### **2️⃣ Mobile Dev (Desenvolvimento Local)**
**Recomendado para**: Desenvolver/testar app mobile

**O que inicia**:
- ✅ Mobile Dev Server (porta 5173)

**URLs**:
- Mobile Dev: http://localhost:5173

**⚠️ IMPORTANTE**:
- Mobile em **produção** está no Firebase Hosting
- Este modo é apenas para desenvolvimento local
- Requer backend rodando em localhost:3000

---

### **3️⃣ Ambos (Desenvolvimento Completo)**
**Recomendado para**: Desenvolvimento full-stack

**O que inicia**:
- ✅ Backend API (porta 3000)
- ✅ Desktop Dev Server (porta 5174)
- ✅ Mobile Dev Server (porta 5173)

**URLs**:
- Backend: http://localhost:3000
- Desktop: http://localhost:5174
- Mobile: http://localhost:5173

---

### **4️⃣ Apenas Backend (API)**
**Recomendado para**: Testar apenas API ou produção

**O que inicia**:
- ✅ Backend API (porta 3000)

**URLs**:
- API: http://localhost:3000/api/status
- Desktop Prod: http://localhost:3000/desktop

---

## 🔧 Execução Manual (Alternativa)

### **Backend**
```bash
npm start
# ou
node server.js
```

### **Desktop (Desenvolvimento)**
```bash
cd desktop
npm run dev
```
Abre em: http://localhost:5174

### **Mobile (Desenvolvimento)**
```bash
cd mobile
npm run dev
```
Abre em: http://localhost:5173

---

## 📦 Deploy (Produção)

### **Mobile → Firebase Hosting**
```bash
cd mobile
npm run build
firebase deploy --only hosting
```

### **Desktop + Backend → VM HMASP**
```bash
# Build desktop
cd desktop
npm run build
cd ..

# Inicia servidor
npm start
```

Acesso: http://[IP-VM]:3000

---

## ❓ Troubleshooting

### **Problema: "Node.js não instalado"**
**Solução**: Instale Node.js em https://nodejs.org

### **Problema: "Porta 3000 em uso"**
**Solução**:
```bash
# Ver processo na porta 3000
netstat -ano | findstr :3000

# Matar processo (substitua PID)
taskkill /F /PID [PID]
```

### **Problema: "Erro ao instalar dependências"**
**Solução**:
```bash
# Limpar e reinstalar
rd /s /q node_modules
npm install

# Mobile
cd mobile
rd /s /q node_modules
npm install
cd ..

# Desktop (se houver package.json)
cd desktop
rd /s /q node_modules
npm install
cd ..
```

### **Problema: "Desktop não carrega CSS/JS"**
**Solução**: Verifique se os caminhos estão corretos
- CSS: `/desktop/src/styles/main.css`
- JS: `/desktop/src/main.js`
- Assets: `/desktop/public/`

---

## 📚 Documentação

- [README.md](README.md) - Visão geral do projeto
- [ESTRUTURA-PROJETO.md](ESTRUTURA-PROJETO.md) - Arquitetura detalhada
- [RELATORIO-CORRECOES-17122024.md](RELATORIO-CORRECOES-17122024.md) - Correções aplicadas
- [VERIFICACAO-COMPLETA.md](VERIFICACAO-COMPLETA.md) - Checklist de conformidade

---

## 🎯 Próximos Passos

1. ✅ Execute `INICIAR.bat`
2. ✅ Escolha o modo desejado
3. ✅ Acesse as URLs indicadas
4. ✅ Comece a desenvolver!

---

**Desenvolvido para HMASP São Paulo**
**Última atualização**: 17/12/2024
