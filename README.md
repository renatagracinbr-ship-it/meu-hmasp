# HMASP Chat - Marcação de Consultas

Sistema de mensageria WhatsApp para marcação e gestão de consultas do Hospital Municipal Arthur Saboya Pessoa (HMASP).

## 🚀 Início Rápido

### Requisitos
- Node.js 20 LTS
- Ubuntu/Linux 20.04+ (ou WSL2 no Windows)
- Acesso à rede interna do HMASP (para banco AGHUse)

### ⚡ Instalação Automática (Linux/Ubuntu)

```bash
# 1. Clone o repositório
git clone https://github.com/renatagracinbr-ship-it/HMASP-Chat.git
cd HMASP-Chat

# 2. Execute instalação automática (instala TUDO)
bash install-linux.sh

# 3. Configure banco de dados
nano .env

# 4. Inicie o servidor
bash start.sh
```

**O script `install-linux.sh` faz tudo automaticamente:**
- ✅ Instala Node.js 20 LTS
- ✅ Instala dependências do Chrome/Puppeteer
- ✅ Instala dependências do projeto (npm install)
- ✅ Cria estrutura de pastas
- ✅ Faz build do frontend
- ✅ Configura usuário admin padrão

**Após instalação, acesse:**
- 🏥 **Interface Principal:** http://localhost:3000/
- 📱 **WhatsApp Admin:** http://localhost:3000/whatsapp-admin.html
- ⚙️ **Admin (envio auto):** http://localhost:3000/admin.html

*Sem necessidade de login - sistema usa auto-login automático*

### 📚 Documentação Completa

- **[Guia Início Rápido Linux](INICIO-RAPIDO-LINUX.md)** - Resumo essencial
- **[Guia Completo Deploy Linux](DEPLOY-LINUX.md)** - Instalação detalhada, PM2, troubleshooting

## 📁 Estrutura do Projeto

```
HMASP-Chat/
├── server.js                  # Servidor principal Node.js + Express
├── install-linux.sh           # 🆕 Script de instalação automática Linux
├── start.sh                   # Script de inicialização do servidor
├── DEPLOY-LINUX.md            # 🆕 Guia completo de deploy Linux
├── INICIO-RAPIDO-LINUX.md     # 🆕 Guia rápido Linux
├── package.json               # Dependências do projeto
├── vite.config.js             # Configuração do build frontend
├── .env.example               # Exemplo de variáveis de ambiente
├── src/                       # Código fonte do frontend
│   ├── main.js               # Entry point da aplicação
│   ├── components/           # Componentes da interface
│   └── utils/                # Utilitários
├── server/                    # Backend modules
│   ├── auth.js               # Autenticação local (arquivos JSON)
│   ├── aghuse-server.js      # Integração com banco AGHUse
│   └── data/                 # Dados locais (usuários, sessões)
├── public/                    # Arquivos estáticos
│   ├── admin.html            # Interface Admin
│   └── whatsapp-admin.html   # Admin WhatsApp (QR Code)
├── dist/                      # Frontend compilado (gerado por build)
└── logs/                      # Logs da aplicação
```

## ⚙️ Configuração

### Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# PostgreSQL - AGHUse
DB_HOST=10.12.40.XXX
DB_PORT=5432
DB_USER=aghuse
DB_PASSWORD=sua_senha
DB_NAME=agh

# Porta do servidor
PORT=3000
```

### Configuração do Banco de Dados

O sistema se conecta ao banco de dados AGHUse (PostgreSQL) do HMASP. Certifique-se de ter acesso à rede interna e permissões adequadas.

## 🔧 Comandos Úteis

```bash
# Executar tudo (recomendado)
bash start.sh

# Instalar dependências
npm install

# Build do frontend
npm run build

# Executar apenas o servidor
node server.js
```

## 📦 Tecnologias

**Backend:**
- Node.js + Express.js
- whatsapp-web.js (integração WhatsApp)
- PostgreSQL (pg driver)

**Frontend:**
- Vue.js 3
- Vite (build tool)
- CSS puro

**Infraestrutura:**
- Ubuntu Server 20.04+ LTS
- PM2 (gerenciamento de processos - recomendado)
- Systemd (alternativa ao PM2)
- Puppeteer (automação WhatsApp Web)

## 🏥 Integração AGHUse

O sistema integra com o banco de dados AGHUse para:
- ✅ Buscar consultas agendadas
- ✅ Enviar mensagens de lembrete automáticas
- ✅ Confirmar presença de pacientes
- ✅ Gerenciar desmarcações e reagendamentos

## 📞 WhatsApp

Utiliza `whatsapp-web.js` para:
- Envio automatizado de mensagens em fila
- Autenticação via QR Code
- Persistência de sessão
- Monitoramento de status de envio

## 🛡️ Segurança

- Autenticação baseada em sessões
- Validação de permissões por função (admin/operador)
- Auto-login seguro para ambiente VM
- Sanitização de inputs do usuário
- Logs de auditoria completos

## 📄 Licença

Projeto proprietário do Hospital Municipal Arthur Saboya Pessoa (HMASP).
Uso interno exclusivo.

---

**Desenvolvido para HMASP São Paulo**
**Última atualização**: Dezembro 2025
