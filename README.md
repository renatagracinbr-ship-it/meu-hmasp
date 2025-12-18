# Meu HMASP - Aplicativo do Paciente

Sistema de comunicacao e gestao de consultas para pacientes do Hospital Militar de Area de Sao Paulo (HMASP).

## Arquitetura do Sistema

```
                         PACIENTES
                    (App Mobile - Firebase)
         +----------+----------+------------------+
         |   Home   |   Chat   | Minhas Consultas |
         +----------+----------+------------------+
                            |
                            | API (HTTPS)
                            v
+-------------------------------------------------------------+
|                    BACKEND (VM HMASP)                        |
|  +---------------+  +---------------+  +---------------+     |
|  | Chat Service  |  | Consultas API |  | Auth Service  |     |
|  +---------------+  +---------------+  +---------------+     |
|                            |                                 |
|              +-------------+-------------+                   |
|              v                           v                   |
|     +---------------+          +---------------+             |
|     |  SQLite Local |          |  AGHUse (PG)  |             |
|     |  (Mensagens)  |          |  (Consultas)  |             |
|     +---------------+          +---------------+             |
+-------------------------------------------------------------+
                            |
                            v
+-------------------------------------------------------------+
|                    OPERADOR (Desktop Web)                    |
|  +------+-------------+-------------+-----------+-----------+|
|  | Chat | Confirmacao | Desmarcacao | Consultas | Notificao ||
|  |      |  Presenca   |             | Paciente  | Faltantes ||
|  +------+-------------+-------------+-----------+-----------+|
+-------------------------------------------------------------+
```

## Estrutura do Projeto

```
Meu HMASP/
+-- mobile/                    # App do Paciente (Firebase Hosting)
|   +-- index.html             # Pagina principal mobile
|   +-- src/
|   |   +-- main.js            # Logica do app mobile
|   |   +-- styles/
|   |       +-- mobile.css     # Estilos mobile
|   +-- public/
|   |   +-- manifest.json      # PWA manifest
|   +-- firebase.json          # Config Firebase Hosting
|   +-- vite.config.js         # Build mobile
|   +-- package.json           # Dependencias mobile
|
+-- desktop/                   # Interface do Operador (Intranet)
|   +-- index.html             # Interface desktop do operador
|   +-- src/                   # Codigo fonte desktop
|   |   +-- main.js            # Logica desktop
|   |   +-- components/        # Componentes UI
|   |   +-- services/          # Servicos frontend
|   |   +-- styles/            # Estilos CSS
|   +-- public/                # Assets (logos, imagens)
|   +-- vite.config.js         # Build desktop
|
+-- server/                    # Backend Node.js (VM HMASP)
|   +-- aghuse-server.js       # Integracao com banco AGHUse
|   +-- database/              # Schemas e servicos de banco
|   +-- middleware/            # Middlewares Express
|   +-- services/              # Servicos de negocio
|
+-- src/                       # [LEGADO] Sera movido para desktop/src
+-- shared/                    # Codigo compartilhado (a implementar)
+-- server.js                  # Servidor principal
+-- package.json               # Dependencias do projeto
```

**⚠️ IMPORTANTE**: A estrutura foi reorganizada em 17/12/2024. Veja [ESTRUTURA-PROJETO.md](ESTRUTURA-PROJETO.md) para detalhes.

## Funcionalidades

### App Mobile (Paciente)
- **Home**: Tela de boas-vindas, cadastro de dependentes
- **Chat**: Comunicacao direta com a Central de Regulacao
- **Minhas Consultas**: Visualizacao e confirmacao de consultas

### Interface Desktop (Operador)
- **Chat**: Conversar com pacientes conectados
- **Confirmacao de Presenca**: Confirmar presenca em consultas
- **Desmarcacao de Consultas**: Gerenciar cancelamentos
- **Consultas do Paciente**: Buscar consultas por paciente
- **Notificacao aos Faltantes**: Notificar pacientes que faltaram
- **Configuracoes**: Configurar mensagens e sistema

## Tecnologias

### Frontend Mobile
- HTML5 + CSS3 + JavaScript ES6
- PWA (Progressive Web App)
- Firebase Hosting

### Frontend Desktop
- Vite + JavaScript
- CSS puro (identidade visual HMASP)

### Backend
- Node.js + Express
- SQLite (mensagens e dados locais)
- PostgreSQL (AGHUse - consultas)

## Configuracao

### 1. Instalar dependencias do projeto principal
```bash
npm install
```

### 2. Instalar dependencias do app mobile
```bash
cd mobile
npm install
```

### 3. Configurar variaveis de ambiente
Crie um arquivo `.env` na raiz:
```env
# PostgreSQL - AGHUse
DB_HOST=10.12.40.XXX
DB_PORT=5432
DB_USER=birm_read
DB_PASSWORD=sua_senha
DB_NAME=dbaghu

# Porta do servidor
PORT=3000
```

### 4. Executar em desenvolvimento

**Backend (obrigatorio):**
```bash
npm start
# ou
node server.js
```

**Desktop (desenvolvimento):**
```bash
cd desktop
npm run dev
# Abre em http://localhost:5174
```

**App Mobile (desenvolvimento):**
```bash
cd mobile
npm run dev
# Abre em http://localhost:5173
```

## Deploy

### Firebase (App Mobile)
```bash
cd mobile
npm run build
firebase deploy --only hosting
```

### VM HMASP (Backend + Desktop)
```bash
# Build desktop
cd desktop
npm run build
cd ..

# Inicia servidor (serve desktop + API)
npm start
```

O backend sera implantado na VM do HMASP com acesso ao banco AGHUse.
A interface desktop sera servida pelo mesmo servidor em http://[IP-VM]:3000/

## Paleta de Cores

| Cor | Hex | Uso |
|-----|-----|-----|
| Azul Principal | #0cb7f2 | Fundo, botoes principais |
| Bege | #E6E1C9 | Caixas internas, destaques |
| Branco | #FFFFFF | Textos, backgrounds |

## Proximos Passos

1. [ ] Finalizar sistema de chat proprio (substituir WhatsApp)
2. [ ] Implementar autenticacao Firebase
3. [ ] Criar aba "Consultas do Paciente" no operador
4. [ ] Configurar notificacoes push
5. [ ] Testes de integracao

---

**Desenvolvido para HMASP Sao Paulo**
**Versao**: 1.0.0
**Ultima atualizacao**: Dezembro 2024
