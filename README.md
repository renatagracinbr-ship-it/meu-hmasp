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
|   +-- package.json           # Dependencias mobile
|
+-- desktop/                   # Interface do Operador (Desktop)
|   +-- (a ser configurado - usa index.html atual)
|
+-- server/                    # Backend Node.js
|   +-- aghuse-server.js       # Integracao com banco AGHUse
|   +-- database/              # Schemas e servicos de banco
|   +-- middleware/            # Middlewares Express
|   +-- services/              # Servicos de negocio
|
+-- src/                       # Codigo fonte compartilhado
|   +-- services/              # Servicos do frontend
|   +-- components/            # Componentes UI
|   +-- styles/                # Estilos CSS
|
+-- index.html                 # Interface do operador (atual)
+-- server.js                  # Servidor principal
+-- package.json               # Dependencias do projeto
```

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

**Backend + Desktop:**
```bash
npm run dev
```

**App Mobile:**
```bash
cd mobile
npm run dev
```

## Deploy

### Firebase (App Mobile)
```bash
cd mobile
npm run build
firebase deploy --only hosting
```

### VM HMASP (Backend)
O backend sera implantado na VM do HMASP com acesso ao banco AGHUse.

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
