# Estrutura do Projeto Meu HMASP

## 📁 Arquitetura Corrigida (17/12/2024)

```
Meu HMASP/
│
├── mobile/                      # ☁️ App do Paciente (Firebase Hosting)
│   ├── index.html               # Página principal mobile
│   ├── src/
│   │   ├── main.js              # Lógica do app mobile
│   │   ├── styles/
│   │   │   └── mobile.css       # Estilos mobile
│   │   └── config/
│   │       └── firebase.config.js
│   ├── public/
│   │   ├── manifest.json        # PWA manifest
│   │   ├── icons/               # Ícones do app
│   │   └── assets/              # Recursos mobile
│   ├── firebase.json            # Config Firebase Hosting
│   ├── vite.config.js           # Build mobile
│   └── package.json             # Dependências mobile
│
├── desktop/                     # 🖥️ Interface do Operador (Intranet HMASP)
│   ├── index.html               # Interface desktop (movido da raiz)
│   ├── src/                     # Código fonte desktop
│   │   ├── main.js              # Lógica desktop
│   │   ├── styles/              # Estilos desktop
│   │   ├── services/            # Serviços frontend
│   │   └── components/          # Componentes UI
│   ├── public/                  # Assets desktop (Arquivos/)
│   │   ├── Novo simbolo HMASP.png
│   │   └── Logotipo Central de Regulacao.jpg
│   ├── vite.config.js           # Build desktop
│   └── package.json             # (a ser criado se necessário)
│
├── server/                      # 🔧 Backend Node.js (VM HMASP)
│   ├── aghuse-server.js         # Integração com banco AGHUse
│   ├── auth.js                  # Autenticação
│   ├── database/                # Schemas e serviços de banco
│   │   ├── badges.service.js
│   │   ├── consultas.service.js
│   │   ├── contatos.service.js
│   │   └── chat.service.js
│   ├── middleware/              # Middlewares Express
│   │   ├── rateLimiter.js
│   │   └── validators.js
│   ├── services/                # Serviços de negócio
│   └── utils/                   # Utilitários
│       └── logger.js
│
├── shared/                      # 🔗 Código compartilhado
│   └── (vazio - a ser implementado)
│
├── server.js                    # 🚀 Servidor principal
├── package.json                 # Dependências do projeto
└── .env                         # Variáveis de ambiente
```

## 🎯 Arquitetura de Deploy

### **1. Mobile (Paciente) - Firebase Hosting**
- **URL**: `https://meu-hmasp.web.app` (ou domínio customizado)
- **Tecnologia**: PWA (Progressive Web App)
- **Hosting**: Firebase Hosting
- **Build**: `cd mobile && npm run build && firebase deploy`
- **Acesso**: Internet pública (pacientes)

### **2. Desktop (Operador) - Intranet HMASP**
- **URL**: `http://[IP-SERVIDOR-HMASP]:3000`
- **Tecnologia**: SPA (Single Page Application)
- **Servidor**: Express.js (Node.js)
- **Build**: `cd desktop && npm run build`
- **Acesso**: Apenas intranet HMASP

### **3. Backend (API) - VM HMASP**
- **URL**: `http://[IP-SERVIDOR-HMASP]:3000/api`
- **Servidor**: Express.js + SQLite + PostgreSQL
- **Integração**: AGHUse (banco PostgreSQL)
- **Acesso**: Desktop (intranet) + Mobile (Firebase via HTTPS)

## 🔄 Fluxo de Comunicação

```
┌─────────────────┐
│  PACIENTE       │
│  (App Mobile)   │  ← Firebase Hosting (PWA)
│  Firebase URL   │
└────────┬────────┘
         │ HTTPS API
         ▼
┌─────────────────────────────────────────┐
│     BACKEND (VM HMASP)                  │
│     http://[IP]:3000                    │
│  ┌──────────────┐  ┌─────────────┐     │
│  │  Chat API    │  │ Consultas   │     │
│  │  /api/chat-  │  │ /api/aghuse │     │
│  │  proprio/    │  │             │     │
│  └──────────────┘  └──────┬──────┘     │
│                           │             │
│         ┌─────────────────┴────┐        │
│         ▼                      ▼        │
│   ┌──────────┐          ┌──────────┐   │
│   │ SQLite   │          │PostgreSQL│   │
│   │(Msgs)    │          │(AGHUse)  │   │
│   └──────────┘          └──────────┘   │
└─────────────────────────────────────────┘
         ▲
         │ Intranet
┌────────┴────────┐
│  OPERADOR       │
│  (Desktop Web)  │  ← Servido pelo backend
│  http://[IP]    │     Express static
└─────────────────┘
```

## 🚀 Como Executar

### **Desenvolvimento Local**

#### Backend (obrigatório):
```bash
npm start
# ou
node server.js
```

#### Desktop (desenvolvimento):
```bash
cd desktop
npm run dev
# Abre em http://localhost:5174
```

#### Mobile (desenvolvimento):
```bash
cd mobile
npm run dev
# Abre em http://localhost:5173
```

### **Produção**

#### Deploy Mobile (Firebase):
```bash
cd mobile
npm run build
firebase deploy --only hosting
```

#### Deploy Backend + Desktop (VM HMASP):
```bash
# Desktop build
cd desktop
npm run build
cd ..

# Inicia servidor (serve desktop + API)
npm start
```

## ⚠️ Mudanças Aplicadas (17/12/2024)

### ✅ Correções Realizadas:

1. **Separação Mobile/Desktop**
   - ❌ ANTES: `index.html` na raiz (confuso)
   - ✅ AGORA: `desktop/index.html` (organizado)

2. **Rotas do Servidor**
   - ❌ ANTES: Servia mobile e desktop misturados
   - ✅ AGORA: Apenas desktop (mobile no Firebase)

3. **Arquivos Estáticos**
   - ❌ ANTES: `app.use(express.static(__dirname))` (expunha tudo)
   - ✅ AGORA: Apenas `/desktop` e `/shared`

4. **Build Configuration**
   - ❌ ANTES: `vite.config.js` na raiz
   - ✅ AGORA: `desktop/vite.config.js` e `mobile/vite.config.js`

5. **Caminhos Desktop**
   - ❌ ANTES: `/src/`, `/Arquivos/`
   - ✅ AGORA: `/desktop/src/`, `/desktop/public/`

## 📝 Próximos Passos

- [ ] Criar `desktop/package.json` (se necessário build separado)
- [ ] Implementar código em `shared/` para reutilização
- [ ] Configurar HTTPS no backend para produção
- [ ] Adicionar autenticação no desktop
- [ ] Testar fluxo completo mobile → backend → desktop

## 🔐 Segurança

- Backend agora **NÃO expõe** arquivos sensíveis (.env, server.js)
- Mobile e Desktop separados (princípio de menor privilégio)
- Rotas de API protegidas por middleware
- Rate limiting aplicado

---

**Última atualização**: 17/12/2024
**Versão**: 2.0.0 (Arquitetura Corrigida)
