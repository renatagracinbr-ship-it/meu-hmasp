# 📞 Sistema de Agenda de Contatos - HMASP Chat

## Visão Geral

Sistema completo e robusto de gerenciamento de contatos integrado com WhatsApp e AGHUse. Funciona como uma agenda de telefones avançada com recursos de CRM para gestão de pacientes.

---

## 🎯 Funcionalidades Principais

### 1. **Gerenciamento de Contatos**
- ✅ CRUD completo (Criar, Ler, Atualizar, Desativar)
- ✅ Dados pessoais (nome, CPF, data de nascimento, gênero)
- ✅ Múltiplos telefones (principal + secundário)
- ✅ Endereço completo (CEP, logradouro, número, etc)
- ✅ Informações médicas (plano de saúde, carteirinha)
- ✅ Integração AGHUse (prontuário, código do paciente)
- ✅ Integração WhatsApp (ID, foto de perfil, pushname, about)

### 2. **Sistema de Grupos/Labels**
Grupos pré-configurados para categorização:
- ⭐ **VIP** - Pacientes prioritários
- 👴 **Idoso** - Pacientes 60+ anos
- 🤰 **Gestante** - Pacientes gestantes
- ♿ **Deficiência** - Mobilidade reduzida
- 💊 **Crônico** - Doenças crônicas
- 🆕 **Primeira Consulta** - Novos pacientes
- 📅 **Alta Frequência** - Consultas frequentes
- ❌ **Sem Resposta** - Não respondem mensagens

### 3. **Histórico de Interações**
- 📝 Registro completo de mensagens enviadas/recebidas
- 🎯 Classificação de intenções (confirmação, desmarcação, etc)
- 📊 Confidence score das classificações
- 🔗 Vinculação com consultas e confirmações
- 📈 Estatísticas de engajamento

### 4. **Sistema de Notas**
- 📌 Notas fixadas (importantes)
- 🔒 Notas privadas (apenas para quem criou)
- 🏷️ Tipos: importante, alerta, info, historico
- 📝 Histórico completo de observações

### 5. **Auditoria Completa**
- 📋 Log de todas as alterações
- 👤 Rastreamento de usuário responsável
- 🕐 Timestamps de todas as ações
- 🔄 Histórico de bloqueios/desbloqueios

### 6. **Estatísticas e Relatórios**
- 📊 Taxa de resposta por contato
- 📈 Total de interações
- 🎯 Contatos sem resposta
- ⭐ Contatos prioritários
- 📉 Análise de engajamento

---

## 🗄️ Estrutura do Banco de Dados

### Tabela: `contatos`
**Campos principais:**
- Identificação: id, telefone, whatsapp_id
- Pessoais: nome_completo, nome_preferido, cpf, data_nascimento, genero
- AGHUse: prontuario, codigo_paciente
- Contatos: telefone_secundario, email
- Endereço: cep, logradouro, numero, complemento, bairro, cidade, estado
- WhatsApp: tem_whatsapp, foto_perfil_url, pushname, about
- Preferências: aceita_mensagens, data_opt_in, idioma_preferido
- Médicas: plano_saude, numero_carteirinha
- Estatísticas: total_consultas, total_confirmacoes, total_respostas, taxa_resposta
- Status: ativo, bloqueado, motivo_bloqueio
- Auditoria: criado_em, atualizado_em, criado_por, atualizado_por
- Sincronização: sincronizado_aghuse, sincronizado_whatsapp

### Tabela: `contatos_interacoes`
Registro de todas as mensagens trocadas com o contato.

### Tabela: `contatos_grupos`
Grupos/labels para categorização.

### Tabela: `contatos_grupos_rel`
Relacionamento N:N entre contatos e grupos.

### Tabela: `contatos_notas`
Notas e observações sobre contatos.

### Tabela: `contatos_auditoria`
Log completo de alterações.

---

## 🔌 API REST - Endpoints

### **Contatos - CRUD**

```http
# Criar novo contato
POST /api/contatos
Content-Type: application/json

{
  "telefone": "11999999999",
  "nome_completo": "João Silva",
  "cpf": "123.456.789-00",
  "prontuario": "A000123",
  "email": "joao@email.com",
  "aceita_mensagens": true
}

# Listar todos (com paginação)
GET /api/contatos?offset=0&limit=100&ativo=true&orderBy=nome_completo&orderDir=ASC

# Buscar por ID
GET /api/contatos/1

# Buscar por telefone
GET /api/contatos/telefone/11999999999

# Buscar por nome
GET /api/contatos/buscar/João?limit=50

# Atualizar contato
PUT /api/contatos/1
Content-Type: application/json

{
  "nome_preferido": "João",
  "email": "novo@email.com"
}

# Desativar contato
DELETE /api/contatos/1
Content-Type: application/json

{
  "motivo": "Paciente falecido"
}

# Bloquear contato
POST /api/contatos/1/bloquear
Content-Type: application/json

{
  "motivo": "Spam"
}
```

### **Interações**

```http
# Registrar interação
POST /api/contatos/interacoes
Content-Type: application/json

{
  "telefone": "11999999999",
  "tipo": "confirmacao",
  "direcao": "enviada",
  "texto": "Mensagem enviada...",
  "template_usado": "notificacao_confirmacao_presenca",
  "consulta_id": 123,
  "confirmacao_id": 456
}
```

### **Grupos**

```http
# Adicionar ao grupo
POST /api/contatos/1/grupos/2
Content-Type: application/json

{
  "adicionado_por": "admin"
}

# Remover do grupo
DELETE /api/contatos/1/grupos/2

# Listar grupos do contato
GET /api/contatos/1/grupos
```

### **Notas**

```http
# Adicionar nota
POST /api/contatos/1/notas
Content-Type: application/json

{
  "nota": "Paciente prefere ligação ao invés de mensagem",
  "tipo": "importante",
  "criado_por": "admin"
}

# Listar notas
GET /api/contatos/1/notas
```

### **Relatórios e Estatísticas**

```http
# Estatísticas gerais
GET /api/contatos/stats/geral

# Contatos sem resposta
GET /api/contatos/relatorios/sem-resposta?limit=50

# Contatos prioritários
GET /api/contatos/relatorios/prioritarios?limit=100
```

---

## 💻 Uso Programático

### Importar o serviço

```javascript
const ContatosService = require('./server/database/contatos.service');
```

### Exemplos de uso

```javascript
// Criar contato
const id = ContatosService.criarContato({
    telefone: '11999999999',
    nome_completo: 'Maria Santos',
    prontuario: 'A000456',
    aceita_mensagens: true
});

// Buscar por telefone
const contato = ContatosService.buscarPorTelefone('11999999999');

// Atualizar
ContatosService.atualizarContato(id, {
    email: 'maria@email.com',
    atualizado_por: 'sistema'
});

// Registrar interação
ContatosService.registrarInteracao({
    telefone: '11999999999',
    tipo: 'confirmacao',
    direcao: 'enviada',
    texto: 'Mensagem de confirmação...',
    template_usado: 'marcacao_confirmacao',
    consulta_id: 123
});

// Atualizar estatísticas
ContatosService.atualizarEstatisticas('11999999999', 'confirmacao_enviada');
ContatosService.atualizarEstatisticas('11999999999', 'resposta_recebida');

// Sincronizar dados do WhatsApp
ContatosService.atualizarDadosWhatsApp('11999999999', {
    profilePicUrl: 'https://...',
    pushname: 'Maria',
    about: 'Status do WhatsApp'
});

// Adicionar ao grupo VIP (ID 1)
ContatosService.adicionarAoGrupo(id, 1, 'admin');

// Adicionar nota
ContatosService.adicionarNota(id, 'Paciente VIP - atendimento prioritário', 'importante', 'admin');

// Buscar estatísticas
const stats = ContatosService.getEstatisticasGerais();
console.log(`Taxa de resposta média: ${stats.taxa_resposta_media}%`);
```

---

## 🔄 Integração com WhatsApp

### Atualização automática de dados

Quando uma mensagem é enviada ou recebida, o sistema pode:

1. **Criar contato automaticamente** se não existir
2. **Atualizar foto de perfil** do WhatsApp
3. **Atualizar pushname** (nome no WhatsApp)
4. **Atualizar about** (status/bio)
5. **Registrar interação** no histórico
6. **Calcular taxa de resposta** automaticamente

### Exemplo de integração

```javascript
// Após enviar mensagem de confirmação
const confirmation = { /* dados da confirmação */ };
const telefone = confirmation.telefone;

// Registra interação
ContatosService.registrarInteracao({
    telefone: telefone,
    tipo: 'confirmacao',
    direcao: 'enviada',
    texto: mensagem.texto,
    template_usado: 'marcacao_confirmacao',
    consulta_id: confirmation.consultaId,
    confirmacao_id: confirmation.id
});

// Atualiza estatísticas
ContatosService.atualizarEstatisticas(telefone, 'confirmacao_enviada');

// Quando recebe resposta
ContatosService.registrarInteracao({
    telefone: telefone,
    tipo: 'confirmacao',
    direcao: 'recebida',
    resposta_texto: respostaTexto,
    intencao_detectada: 'confirmado',
    confidence: 0.95,
    consulta_id: confirmation.consultaId
});

ContatosService.atualizarEstatisticas(telefone, 'resposta_recebida');
```

---

## 📊 Views e Relatórios

### Views criadas automaticamente

1. **`vw_contatos_estatisticas`** - Contatos com todas as estatísticas calculadas
2. **`vw_contatos_sem_resposta`** - Contatos que não respondem (< 30% de taxa)
3. **`vw_contatos_prioritarios`** - Contatos VIP, Gestante, Idoso, Deficiência

### Uso das views

```javascript
// No serviço
const semResposta = ContatosService.getContatosSemResposta(50);
const prioritarios = ContatosService.getContatosPrioritarios(100);

// Direto no SQL
const db = require('better-sqlite3')('./server/database/contatos.db');
const contatos = db.prepare('SELECT * FROM vw_contatos_estatisticas').all();
```

---

## 🔐 Segurança e Privacidade

### LGPD/GDPR Compliance

- ✅ **Opt-in/Opt-out** - Campo `aceita_mensagens` com data de consentimento
- ✅ **Auditoria completa** - Log de quem acessou/modificou
- ✅ **Soft delete** - Desativação ao invés de exclusão
- ✅ **Dados sensíveis** - CPF, dados médicos armazenados de forma controlada
- ✅ **Bloqueio** - Sistema de bloqueio com motivo registrado

### Boas práticas

```javascript
// Verificar consentimento antes de enviar
const contato = ContatosService.buscarPorTelefone(telefone);
if (!contato || !contato.aceita_mensagens || contato.bloqueado) {
    console.log('Contato não aceita mensagens ou está bloqueado');
    return;
}

// Registrar quem fez a ação
ContatosService.atualizarContato(id, {
    email: 'novo@email.com',
    atualizado_por: req.user.id // ID do usuário logado
});
```

---

## 🚀 Inicialização

```bash
# Criar e inicializar banco
node server/database/init-contatos.js

# O banco será criado em:
# server/database/contatos.db
```

---

## 📝 Notas Importantes

1. **Cache de 5 minutos** - Busca por telefone usa cache para performance
2. **Triggers automáticos** - Taxa de resposta calculada automaticamente
3. **Normalização de telefone** - Remove formatação automaticamente
4. **WhatsApp ID** - Gerado automaticamente no formato `55XXXXXXXXXXX@c.us`
5. **Grupos pré-definidos** - 8 grupos já criados no schema
6. **SQLite WAL mode** - Melhor performance em operações concorrentes

---

## 🔧 Manutenção

### Verificar integridade

```javascript
const stats = ContatosService.getEstatisticasGerais();
console.log(stats);
```

### Limpar cache

```javascript
// No serviço (linha 14)
this.cache.clear();
```

### Backup

```bash
# Fazer backup do banco
cp server/database/contatos.db server/database/contatos.db.backup
```

---

## 📚 Arquivos Criados

1. **`server/database/schema-contatos.sql`** - Schema completo do banco
2. **`server/database/contatos.service.js`** - Serviço Node.js
3. **`server/database/init-contatos.js`** - Script de inicialização
4. **`server/database/contatos.db`** - Banco de dados SQLite
5. **Rotas adicionadas em `server.js`** - API REST completa

---

## ✅ Funcionalidades Completas

- [x] CRUD completo de contatos
- [x] Integração WhatsApp (foto, pushname, about)
- [x] Integração AGHUse (prontuário, código)
- [x] Sistema de grupos/labels
- [x] Histórico de interações
- [x] Sistema de notas
- [x] Auditoria completa
- [x] Estatísticas e relatórios
- [x] Cache de performance
- [x] Triggers automáticos
- [x] Views otimizadas
- [x] API REST completa
- [x] Documentação completa

---

**Sistema criado em: 2025-12-12**
**Versão: 1.0.0**
**Autor: Claude (Anthropic)**
