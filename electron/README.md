# HMASP Chat - Aplicativo Desktop

Aplicativo desktop que roda servidor local para conectar no AGHUse e abre automaticamente o navegador.

## 🚀 Como Usar

### 1. Instalar dependências

```bash
cd electron
npm install
```

### 2. Executar aplicativo

```bash
npm start
```

O aplicativo vai:
- ✅ Iniciar servidor local na porta 3001
- ✅ Conectar no banco AGHUse (10.12.40.219)
- ✅ Abrir automaticamente https://hmasp-chat.web.app no navegador
- ✅ Ficar minimizado na bandeja do sistema

### 3. Gerar executável .exe (opcional)

```bash
npm run build
```

Vai gerar um instalador em `dist/HMASP Chat Setup.exe`

## 📋 Endpoints Disponíveis

Quando o app estiver rodando:

- `http://localhost:3001/api/health` - Status do servidor
- `http://localhost:3001/api/aghuse/test-connection` - Testa conexão AGHUse
- `http://localhost:3001/api/aghuse/recent-appointments` - Consultas recentes

## ⚙️ Configuração

Edite `main.js` se precisar alterar:
- Porta do servidor (padrão: 3001)
- Credenciais do banco AGHUse
- URL do frontend

## 🔒 Requisitos

- **VPN/Intranet**: Precisa estar conectado na rede interna para acessar AGHUse (10.12.40.219)
- **Node.js**: Versão 18 ou superior

## 🎯 Como Funciona

```
┌──────────────────┐
│  HMASP Chat.exe  │
└────────┬─────────┘
         │
    ┌────▼─────────────────────┐
    │  Servidor Local (3001)   │
    │  - Express + PostgreSQL  │
    └────┬─────────────────────┘
         │
    ┌────▼─────────────────┐
    │  Abre Navegador      │
    │  hmasp-chat.web.app  │
    └──────────────────────┘
```

## 📝 Notas

- O aplicativo **não fecha** quando você fecha o navegador
- Para encerrar: clique direito no ícone da bandeja → Sair
- Todos os logs aparecem no console onde você rodou `npm start`
