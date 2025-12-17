# 📋 REGRAS DE ORGANIZAÇÃO - HMASP CHAT
**DOCUMENTO PERMANENTE - LEIA ANTES DE MODIFICAR CÓDIGO**

---

## 🎯 OBJETIVO

Este documento define as REGRAS ESTRITAS de organização do código.
**NUNCA viole estas regras, mesmo que pareça "mais rápido".**

---

## 📁 ESTRUTURA OBRIGATÓRIA

### `src/` - CÓDIGO FONTE (DESENVOLVIMENTO)

```
src/
├── main.js                    ✅ Arquivo principal
├── auth-client.js             ✅ STUB autenticação
├── components/                ✅ Componentes UI
│   ├── confirmacaoPresenca.js
│   └── desmarcacaoConsultas.js
├── services/                  ✅ Serviços de negócio
│   ├── aghuse.service.js      → Backend AGHUse
│   ├── whatsapp.service.js    → Cliente WhatsApp
│   ├── confirmacao.service.js → Lógica confirmação
│   ├── desmarcacao.service.js → Lógica desmarcação
│   ├── lembrete72h.service.js → Lembretes
│   ├── whatsappQueue.service.js → Fila anti-ban
│   ├── whatsappTemplates.service.js → Templates
│   ├── monitoramentoGlobal.service.js → Monitor central
│   ├── monitoramentoLog.service.js → Logs
│   ├── usuarios.service.js    → STUB usuários
│   ├── agenda.service.js      → STUB agenda
│   ├── pacientes.service.js   → STUB pacientes
│   └── auditService.js        → STUB auditoria
├── config/                    ✅ Configurações
│   └── backend.config.js      → URLs backend
├── utils/                     ✅ Utilitários
│   ├── dateUtils.js           → Formatação datas
│   ├── phoneNormalizer.js     → Normalização telefones
│   ├── headerClone.js         → Clone headers
│   └── toast.js               → Notificações
└── styles/                    ✅ CSS
    ├── main.css
    └── confirmacao.css
```

### `dist/` - CÓDIGO COMPILADO (PRODUÇÃO)

**🚨 NUNCA EDITE `dist/` MANUALMENTE!**

```
dist/
├── index.html                 ✅ HTML compilado
└── assets/                    ✅ Assets compilados
    ├── main-[hash].js         → 1 arquivo JS (mais recente)
    ├── main-[hash].css        → 1 arquivo CSS (mais recente)
    ├── Fundo Zap HMASP-[hash].jpg
    ├── Logotipo Central de Regulacao-[hash].jpg
    └── Novo simbolo HMASP-[hash].png
```

**O que NÃO PODE TER em `dist/`:**
- ❌ Documentos Word (.docx, .doc)
- ❌ Imagens duplicadas (fora de assets/)
- ❌ Pastas de backup
- ❌ Arquivos JS/CSS antigos (só o mais recente!)

---

## 🚫 REGRAS PROIBIDAS - NUNCA FAÇA ISSO

### 1. ❌ NUNCA crie arquivos fora da estrutura
```bash
# ❌ ERRADO
touch src/meu-arquivo.js
touch src/test.js
touch src/temp.js

# ✅ CORRETO
touch src/services/meu-servico.service.js
touch src/utils/minhaUtil.js
touch src/components/meuComponente.js
```

### 2. ❌ NUNCA deixe código morto
```javascript
// ❌ ERRADO - Código comentado
// import * as Firebase from 'firebase';
// const oldFunction = () => { ... }

// ✅ CORRETO - Código limpo
import * as AghuseService from './aghuse.service.js';
```

### 3. ❌ NUNCA deixe imports não utilizados
```javascript
// ❌ ERRADO
import * as TabMaster from '../utils/tabMaster.js'; // Não usado
import * as Firebase from 'firebase'; // Não usado

// ✅ CORRETO
import * as AghuseService from './services/aghuse.service.js';
```

### 4. ❌ NUNCA deixe TODOs sem data/responsável
```javascript
// ❌ ERRADO
// TODO: Fazer isso

// ✅ CORRETO
// TODO [2024-12-06]: Migrar para PostgreSQL (responsável: TI HMASP)
```

### 5. ❌ NUNCA edite `dist/` diretamente
```bash
# ❌ ERRADO
nano dist/assets/main-xyz.js

# ✅ CORRETO
nano src/main.js
npm run build
```

---

## ✅ REGRAS OBRIGATÓRIAS - SEMPRE FAÇA ISSO

### 1. ✅ SEMPRE organize por tipo/funcionalidade

**Services (lógica de negócio):**
- Nome: `<nome>.service.js`
- Local: `src/services/`
- Exemplo: `aghuse.service.js`, `whatsapp.service.js`

**Components (UI):**
- Nome: `<nome>.js`
- Local: `src/components/`
- Exemplo: `confirmacaoPresenca.js`

**Utils (utilitários):**
- Nome: `<nome>.js`
- Local: `src/utils/`
- Exemplo: `phoneNormalizer.js`

### 2. ✅ SEMPRE limpe após build

```bash
# Após fazer build
npm run build

# Limpar arquivos antigos
cd dist/assets
ls -t main-*.js | tail -n +2 | xargs rm -f
ls -t main-*.css | tail -n +2 | xargs rm -f
```

### 3. ✅ SEMPRE use imports relativos corretos

```javascript
// ✅ CORRETO - De src/main.js
import * as AghuseService from './services/aghuse.service.js';

// ✅ CORRETO - De src/services/confirmacao.service.js
import * as WhatsAppService from './whatsapp.service.js';
import { PhoneNormalizer } from '../utils/phoneNormalizer.js';

// ❌ ERRADO - Import absoluto
import * as AghuseService from '/services/aghuse.service.js';
```

### 4. ✅ SEMPRE documente mudanças importantes

Em `CHANGELOG.md` (criar se não existir):
```markdown
## [2024-12-06] - Limpeza Estrutura
### Removido
- tabMaster.js (funcionalidade removida)
- Imports Firebase (removido do projeto)
- Arquivos antigos em dist/

### Organizado
- usuarios.service.js movido para src/services/
- dist/ limpo (apenas arquivos essenciais)
```

---

## 🔄 WORKFLOW DE DESENVOLVIMENTO

### Modificar Frontend:

```bash
# 1. Editar código fonte
nano src/main.js

# 2. Testar localmente (opcional)
npm run dev

# 3. Compilar para produção
npm run build

# 4. Limpar arquivos antigos
cd dist/assets
ls -t main-*.js | tail -n +2 | xargs rm -f
ls -t main-*.css | tail -n +2 | xargs rm -f
cd ../..

# 5. Reiniciar servidor
node server.js
```

### Criar novo Service:

```bash
# 1. Criar arquivo no local correto
touch src/services/novoServico.service.js

# 2. Estrutura base
cat > src/services/novoServico.service.js << 'EOF'
/**
 * Serviço Novo
 * Descrição do que faz
 */

export async function funcaoPrincipal() {
    // Implementação
}

export default {
    funcaoPrincipal
};
EOF

# 3. Importar onde necessário
# Em src/main.js ou outro arquivo:
# import * as NovoServico from './services/novoServico.service.js';
```

### Remover código legado:

```bash
# 1. Procurar imports
grep -r "nomeDoArquivo" src/

# 2. Se não houver imports, remover
rm src/utils/nomeDoArquivo.js

# 3. Rebuild
npm run build
```

---

## 🧹 LIMPEZA PERIÓDICA

### A cada build importante:

```bash
# Limpar dist/assets/
cd dist/assets
ls -t main-*.js | tail -n +2 | xargs rm -f
ls -t main-*.css | tail -n +2 | xargs rm -f
cd ../..

# Verificar arquivos órfãos em dist/
find dist/ -type f ! -path "dist/assets/*" ! -name "index.html"
# Se aparecer algo, investigar e remover se for lixo
```

### Mensalmente:

```bash
# Procurar TODOs antigos
grep -rn "TODO" src/ | grep -v "2024-12"

# Procurar imports não utilizados
# Usar ferramenta: npx eslint src/ --ext .js

# Procurar código comentado
grep -rn "^[[:space:]]*//.*import" src/
grep -rn "^[[:space:]]*/\*" src/
```

---

## 📊 CHECKLIST DE QUALIDADE

Antes de cada commit importante:

```
□ Estrutura de pastas correta (src/services/, src/utils/, etc)
□ Sem arquivos fora da estrutura padrão
□ Sem imports não utilizados
□ Sem código comentado (exceto documentação)
□ Sem TODOs sem data/responsável
□ dist/ limpo (apenas arquivos essenciais)
□ dist/assets/ sem arquivos duplicados
□ Build executado: npm run build
□ Servidor testado: node server.js
□ Console sem erros
```

---

## 🚨 DETECÇÃO DE PROBLEMAS

### Comando para detectar problemas:

```bash
#!/bin/bash
# Salve como: check-organizacao.sh

echo "🔍 Verificando organização do código..."
echo ""

# 1. Arquivos fora da estrutura em src/
echo "❓ Arquivos fora da estrutura em src/:"
find src/ -maxdepth 1 -type f ! -name "main.js" ! -name "auth-client.js"
echo ""

# 2. Imports Firebase
echo "🔥 Imports Firebase (deve estar vazio):"
grep -r "from.*firebase\|import.*firebase" src/ --include="*.js"
echo ""

# 3. Código comentado
echo "💭 Código comentado (revisar):"
grep -rn "^[[:space:]]*//.*import\|^[[:space:]]*//.*const\|^[[:space:]]*//.*function" src/ --include="*.js"
echo ""

# 4. Arquivos antigos em dist/assets/
echo "📦 Arquivos duplicados em dist/assets/:"
ls dist/assets/main-*.js 2>/dev/null | wc -l
echo "   (Deve ser 1)"
ls dist/assets/main-*.css 2>/dev/null | wc -l
echo "   (Deve ser 1)"
echo ""

# 5. Lixo em dist/
echo "🗑️  Arquivos suspeitos em dist/:"
find dist/ -type f ! -path "dist/assets/*" ! -name "index.html"
echo ""

echo "✅ Verificação completa!"
```

---

## 📝 CONVENÇÕES DE NOMENCLATURA

### Arquivos:

- **Services:** `<nome>.service.js` (camelCase)
- **Components:** `<nome>.js` (camelCase)
- **Utils:** `<nome>.js` (camelCase)
- **Config:** `<nome>.config.js` (camelCase)
- **CSS:** `<nome>.css` (lowercase)

### Funções:

```javascript
// ✅ Funções públicas: camelCase
export async function fetchData() { }

// ✅ Funções privadas: camelCase com prefixo _
function _internFunction() { }

// ✅ Classes: PascalCase
export class MyService { }

// ✅ Constantes: UPPER_SNAKE_CASE
const MAX_RETRIES = 3;
```

### Variáveis:

```javascript
// ✅ Variáveis: camelCase
let userName = 'João';
const phoneNumber = '+5511999887766';

// ✅ Objetos de configuração: camelCase
const dbConfig = { host: '...', port: 5432 };

// ✅ Arrays: plural
const appointments = [];
const users = [];
```

---

## 🎓 EXEMPLOS PRÁTICOS

### ❌ ANTES (Desorganizado):

```
src/
├── main.js
├── test.js                    ← Arquivo solto
├── usuarios.service.js        ← Lugar errado
├── temp-fix.js                ← Arquivo temporário
├── components/
├── services/
│   ├── aghuse.service.js
│   └── old-service.js.bak     ← Backup
└── utils/
    └── tabMaster.js           ← Código morto

dist/
├── index.html
├── Mensagens.docx             ← Lixo
├── Fundo.jpg                  ← Duplicado
└── assets/
    ├── main-abc.js            ← Antigo
    ├── main-def.js            ← Antigo
    ├── main-xyz.js            ← Atual
    └── Fundo-hash.jpg
```

### ✅ DEPOIS (Organizado):

```
src/
├── main.js
├── auth-client.js
├── components/
│   ├── confirmacaoPresenca.js
│   └── desmarcacaoConsultas.js
├── services/
│   ├── aghuse.service.js
│   ├── whatsapp.service.js
│   ├── confirmacao.service.js
│   └── usuarios.service.js    ← Movido para cá
├── config/
│   └── backend.config.js
└── utils/
    ├── dateUtils.js
    └── phoneNormalizer.js

dist/
├── index.html
└── assets/
    ├── main-xyz.js            ← Só o mais recente
    ├── main-xyz.css           ← Só o mais recente
    └── Fundo-hash.jpg
```

---

## 🔒 REGRAS IMUTÁVEIS

**Estas regras NUNCA podem ser violadas:**

1. `dist/` é GERADO, nunca editado
2. `src/` segue estrutura de pastas ESTRITA
3. Zero Firebase no código
4. Zero código morto ou comentado
5. Zero arquivos temporários no repo
6. Build SEMPRE antes de commit importante
7. Limpeza de `dist/assets/` após build

---

**Data de criação:** 06/12/2024
**Última atualização:** 06/12/2024
**Status:** 🟢 Ativo e obrigatório
