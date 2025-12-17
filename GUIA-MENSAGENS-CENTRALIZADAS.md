# 📨 Sistema de Mensagens WhatsApp Centralizadas

> **Sistema centralizado para gerenciar todas as mensagens WhatsApp do HMASP Chat**

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Como Usar](#como-usar)
4. [Migração do Código Existente](#migração-do-código-existente)
5. [Exemplos Práticos](#exemplos-práticos)
6. [Administração](#administração)
7. [Benefícios](#benefícios)

---

## 🎯 Visão Geral

### Problema Anterior
Antes, as mensagens WhatsApp estavam **espalhadas** em 3 locais diferentes:
- ❌ **server.js** (linhas 789-952) - msg.reply() hard-coded
- ❌ **whatsappTemplates.service.js** - Templates estruturados
- ❌ **inboundMessageHandler.service.js** - Mensagens de fallback

**Dificuldades:**
- Difícil manutenção
- Impossível visualizar todos os fluxos
- Dificulta tradução futura
- Sem auditoria de envios
- Sem estatísticas de uso

### Solução Atual
Agora temos um **sistema centralizado**:
- ✅ **Banco de dados SQLite** (`mensagens-whatsapp.db`)
- ✅ **Serviço unificado** (`mensagensWhatsApp.service.js`)
- ✅ **23 mensagens catalogadas** em 7 fluxos diferentes
- ✅ **Auditoria completa** de envios
- ✅ **Estatísticas** de uso em tempo real
- ✅ **Cache inteligente** para performance

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                    SISTEMA DE MENSAGENS                      │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
        ┌───────▼────────┐         ┌────────▼────────┐
        │  BANCO DE DADOS│         │   SERVIÇO JS    │
        │  mensagens-    │◄────────┤  mensagensWhats │
        │  whatsapp.db   │         │  App.service.js │
        └────────────────┘         └─────────────────┘
                                            │
                    ┌───────────────────────┼───────────────────────┐
                    │                       │                       │
            ┌───────▼────────┐     ┌────────▼───────┐     ┌────────▼───────┐
            │  server.js     │     │ confirmacao    │     │  desmarcacao   │
            │  (msg.reply)   │     │  .service.js   │     │  .service.js   │
            └────────────────┘     └────────────────┘     └────────────────┘
```

### Componentes

#### 1. **schema-mensagens-whatsapp.sql**
- Define estrutura do banco de dados
- 2 tabelas principais:
  - `mensagens_whatsapp` - Catálogo de mensagens
  - `mensagens_envios_log` - Log de envios
- 3 views úteis:
  - `v_mensagens_por_fluxo`
  - `v_mensagens_mais_enviadas`
  - `v_estatisticas_envio_dia`
- Triggers automáticos para contadores

#### 2. **mensagensWhatsApp.service.js**
- Singleton para gerenciar mensagens
- Cache em memória (60s TTL)
- Métodos principais:
  - `getMensagem(codigo)` - Busca mensagem
  - `renderMensagem(codigo, variaveis)` - Substitui variáveis
  - `registrarEnvio(dados)` - Registra log
  - `getEstatisticas()` - Estatísticas de uso

#### 3. **mensagens-whatsapp.db**
- Banco SQLite criado automaticamente
- 23 mensagens pré-cadastradas
- Persistência de logs e estatísticas

---

## 🚀 Como Usar

### Instalação/Inicialização

```javascript
// No server.js, após importações
const MensagensWhatsApp = require('./server/database/mensagensWhatsApp.service');

// Inicializa ao startar servidor
MensagensWhatsApp.initialize();
```

### Buscar e Enviar Mensagem

#### **Método 1: Buscar + Renderizar + Enviar**

```javascript
// Busca a mensagem
const mensagem = MensagensWhatsApp.getMensagem('confirmacao_presenca_aprovada');

if (mensagem) {
    // Envia
    await msg.reply(mensagem.texto);

    // Registra envio
    MensagensWhatsApp.registrarEnvio({
        codigo: 'confirmacao_presenca_aprovada',
        telefone: phoneNumber,
        confirmacaoId: confirmacaoId,
        textoEnviado: mensagem.texto,
        status: 'enviado'
    });
}
```

#### **Método 2: Renderizar com Variáveis**

```javascript
// Renderiza mensagem com variáveis substituídas
const textoRenderizado = MensagensWhatsApp.renderMensagem(
    'erro_numero_invalido',
    {
        numero: body,  // "5"
        opcoes: '1 - Confirmo\n2 - Não poderei\n3 - Não agendei'
    }
);

// Envia
await msg.reply(textoRenderizado);

// Registra
MensagensWhatsApp.registrarEnvio({
    codigo: 'erro_numero_invalido',
    telefone: phoneNumber,
    textoEnviado: textoRenderizado,
    variaveis: { numero: body, opcoes: '...' },
    status: 'enviado'
});
```

### Buscar Mensagens de Erro Progressivas

```javascript
// Para mensagens de erro com tentativas
const tentativa = 1; // ou 2, ou 3
const contexto = 'confirmacao'; // ou 'desmarcacao'

const mensagemErro = MensagensWhatsApp.getMensagemErro(contexto, tentativa);

if (mensagemErro) {
    await msg.reply(mensagemErro.texto);
}
```

---

## 🔄 Migração do Código Existente

### Passo 1: Substituir msg.reply() Hard-coded

**ANTES (server.js:797):**
```javascript
await msg.reply('✅ *Presença confirmada!* Obrigado. Aguardamos você na data e horário marcados.\n\n_HMASP - Central de Marcação de Consultas_');
```

**DEPOIS:**
```javascript
const textoMensagem = MensagensWhatsApp.renderMensagem('confirmacao_presenca_aprovada');
await msg.reply(textoMensagem);

MensagensWhatsApp.registrarEnvio({
    codigo: 'confirmacao_presenca_aprovada',
    telefone: phoneNumber,
    confirmacaoId: confirmacaoId,
    textoEnviado: textoMensagem,
    contexto: 'confirmacao',
    status: 'enviado'
});
```

### Passo 2: Substituir Mensagens de Erro

**ANTES (server.js:919):**
```javascript
await msg.reply('❓ *Desculpe, não entendi sua resposta.*\n\n' +
    'Por favor, escolha uma das opções abaixo respondendo apenas com o número:\n\n' +
    '1️⃣ - Confirmo minha presença\n' +
    '2️⃣ - Não poderei ir\n' +
    '3️⃣ - Não agendei essa consulta\n\n' +
    '_HMASP - Central de Marcação de Consultas_');
```

**DEPOIS:**
```javascript
const textoMensagem = MensagensWhatsApp.renderMensagem('erro_tentativa1_confirmacao');
await msg.reply(textoMensagem);

MensagensWhatsApp.registrarEnvio({
    codigo: 'erro_tentativa1_confirmacao',
    telefone: phoneNumber,
    textoEnviado: textoMensagem,
    contexto: 'confirmacao',
    status: 'enviado'
});
```

### Passo 3: Exemplo Completo de Migração

**ANTES:**
```javascript
if (respostaDetectada === 'confirmed') {
    await msg.reply('✅ *Presença confirmada!* Obrigado. Aguardamos você na data e horário marcados.\n\n_HMASP - Central de Marcação de Consultas_');
} else if (respostaDetectada === 'declined') {
    await msg.reply('❌ *Entendido.* Sua consulta foi desmarcada. Em caso de dúvidas, entre em contato com a Central de Marcação de Consultas.\n\n_HMASP - Central de Marcação de Consultas_');
} else if (respostaDetectada === 'not_scheduled') {
    await msg.reply('⚠️ *Obrigado pelo retorno.* Verificaremos o agendamento. Se necessário, entraremos em contato.\n\n_HMASP - Central de Marcação de Consultas_');
}
```

**DEPOIS:**
```javascript
const mapRespostaParaCodigo = {
    'confirmed': 'confirmacao_presenca_aprovada',
    'declined': 'confirmacao_presenca_declinada',
    'not_scheduled': 'confirmacao_nao_agendada'
};

const codigoMensagem = mapRespostaParaCodigo[respostaDetectada];
if (codigoMensagem) {
    const textoMensagem = MensagensWhatsApp.renderMensagem(codigoMensagem);

    await msg.reply(textoMensagem);

    MensagensWhatsApp.registrarEnvio({
        codigo: codigoMensagem,
        telefone: phoneNumber,
        confirmacaoId: confirmacaoId,
        textoEnviado: textoMensagem,
        contexto: 'confirmacao',
        status: 'enviado'
    });
}
```

---

## 💡 Exemplos Práticos

### Exemplo 1: Mensagem de Confirmação com Variáveis

```javascript
// Futuramente, se quisermos adicionar nome do paciente
const textoPersonalizado = MensagensWhatsApp.renderMensagem(
    'confirmacao_presenca_aprovada',
    {
        nome_paciente: 'Maria Silva'
    }
);

// Resultado: "✅ Presença confirmada, Maria Silva! Obrigado..."
```

### Exemplo 2: Buscar Todas Mensagens de um Fluxo

```javascript
// Lista todas mensagens do fluxo de confirmação
const mensagensConfirmacao = MensagensWhatsApp.getMensagensPorFluxo('confirmacao');

console.log(`Total de mensagens: ${mensagensConfirmacao.length}`);
mensagensConfirmacao.forEach(msg => {
    console.log(`- ${msg.codigo}: ${msg.titulo}`);
});
```

### Exemplo 3: Estatísticas de Uso

```javascript
// Obtém estatísticas completas
const stats = MensagensWhatsApp.getEstatisticas();

console.log(`Total de mensagens: ${stats.totalMensagens}`);
console.log(`Envios hoje: ${stats.enviosHoje}`);
console.log(`\nMensagens mais enviadas:`);
stats.maisEnviadas.forEach(msg => {
    console.log(`- ${msg.titulo}: ${msg.total_envios} envios`);
});
```

### Exemplo 4: Adicionar Nova Mensagem

```javascript
MensagensWhatsApp.adicionarMensagem({
    codigo: 'nova_funcionalidade_boas_vindas',
    fluxo: 'onboarding',
    categoria: 'informativo',
    titulo: 'Boas-vindas - Nova Funcionalidade',
    texto: 'Olá! Bem-vindo ao nosso novo sistema de {funcionalidade}.',
    tipoEnvio: 'send_message',
    variaveisDisponiveis: ['funcionalidade'],
    gatilhoCondicao: 'Paciente acessa pela primeira vez',
    ativo: true,
    criadoPor: 'admin'
});
```

### Exemplo 5: Atualizar Texto de Mensagem

```javascript
// Atualiza texto sem perder histórico (versionamento automático)
MensagensWhatsApp.atualizarTexto(
    'confirmacao_presenca_aprovada',
    '✅ *Presença confirmada!* Obrigado, {nome_paciente}. Aguardamos você na data e horário marcados.\n\n_HMASP - Central de Marcação de Consultas_',
    'admin@hmasp.com.br'
);
```

---

## 🛠️ Administração

### Consultar Mensagens no Banco

```sql
-- Listar todas mensagens ativas
SELECT codigo, titulo, fluxo, categoria, total_envios
FROM mensagens_whatsapp
WHERE ativo = 1
ORDER BY fluxo, categoria;

-- Mensagens mais enviadas
SELECT * FROM v_mensagens_mais_enviadas;

-- Estatísticas por fluxo
SELECT * FROM v_mensagens_por_fluxo;

-- Envios dos últimos 7 dias
SELECT
    DATE(enviado_em) as data,
    COUNT(*) as total,
    COUNT(DISTINCT telefone) as telefones_unicos
FROM mensagens_envios_log
WHERE DATE(enviado_em) >= DATE('now', '-7 days')
GROUP BY DATE(enviado_em)
ORDER BY data DESC;
```

### Exportar Mensagens (Backup/Tradução)

```javascript
// Exporta todas mensagens para JSON
const mensagens = MensagensWhatsApp.exportarParaJSON();
const fs = require('fs');

fs.writeFileSync(
    'backup-mensagens.json',
    JSON.stringify(mensagens, null, 2)
);

console.log(`✅ ${mensagens.length} mensagens exportadas`);
```

### Desativar Mensagem (sem deletar)

```javascript
// Desativa mensagem antiga mantendo histórico
MensagensWhatsApp.desativarMensagem('mensagem_antiga_v1');
```

---

## ✨ Benefícios

### 1. **Centralização**
- ✅ Todas as mensagens em um único lugar
- ✅ Fácil visualização de todos os fluxos
- ✅ Manutenção simplificada

### 2. **Auditoria Completa**
- ✅ Log de todos os envios
- ✅ Rastreamento por telefone, data, contexto
- ✅ Identificação de mensagens problemáticas

### 3. **Estatísticas**
- ✅ Mensagens mais enviadas
- ✅ Tendências de uso
- ✅ Performance de cada fluxo

### 4. **Versionamento**
- ✅ Histórico de alterações
- ✅ Rollback fácil
- ✅ Comparação de versões

### 5. **Tradução Futura**
- ✅ Exportação para JSON
- ✅ Importação de traduções
- ✅ Suporte multi-idioma preparado

### 6. **Performance**
- ✅ Cache em memória (60s TTL)
- ✅ Índices otimizados
- ✅ Queries rápidas

### 7. **Flexibilidade**
- ✅ Variáveis dinâmicas
- ✅ Substituição automática
- ✅ Templates reutilizáveis

---

## 📊 Catálogo de Mensagens

### Fluxo: Confirmação de Presença

| Código | Título | Gatilho |
|--------|--------|---------|
| `confirmacao_presenca_aprovada` | Presença Confirmada | Paciente responde "1" |
| `confirmacao_presenca_declinada` | Consulta Desmarcada | Paciente responde "2" |
| `confirmacao_nao_agendada` | Não Agendou | Paciente responde "3" |

### Fluxo: Desmarcação

| Código | Título | Gatilho |
|--------|--------|---------|
| `desmarcacao_solicita_reagendamento` | Solicita Reagendamento | Paciente responde "1" |
| `desmarcacao_sem_reagendamento` | Sem Reagendamento | Paciente responde "3" |
| `desmarcacao_paciente_solicitou` | Paciente Solicitou | Paciente responde "2" |

### Fluxo: Validação (Erros)

| Código | Título | Gatilho |
|--------|--------|---------|
| `erro_numero_invalido` | Número Inválido | Paciente digita número > 3 |
| `erro_tentativa1_confirmacao` | Erro 1ª Tent. (Conf.) | 1ª resposta inválida |
| `erro_tentativa2_confirmacao` | Erro 2ª Tent. (Conf.) | 2ª resposta inválida |
| `erro_tentativa3_confirmacao` | Erro 3ª+ Tent. (Conf.) | 3ª+ resposta inválida |
| `erro_tentativa1_desmarcacao` | Erro 1ª Tent. (Desm.) | 1ª resposta inválida |
| `erro_tentativa2_desmarcacao` | Erro 2ª Tent. (Desm.) | 2ª resposta inválida |
| `erro_tentativa3_desmarcacao` | Erro 3ª+ Tent. (Desm.) | 3ª+ resposta inválida |

### Fluxo: Fallback

| Código | Título | Gatilho |
|--------|--------|---------|
| `sem_contexto_boasvindas` | Boas-vindas | Mensagem sem contexto |
| `oferta_atendente_humano` | Oferta Atendente | Após 3 falhas |

---

## 🔮 Próximos Passos

### Fase 1: Migração Gradual (Atual)
- [x] Criar schema do banco de dados
- [x] Criar serviço de mensagens
- [x] Catalogar todas as 23 mensagens
- [ ] Migrar server.js para usar o serviço
- [ ] Migrar outros serviços

### Fase 2: Interface Admin
- [ ] Criar tela no admin para gerenciar mensagens
- [ ] Permitir edição de textos
- [ ] Visualizar estatísticas
- [ ] Testar mensagens antes de ativar

### Fase 3: Recursos Avançados
- [ ] Suporte a múltiplos idiomas
- [ ] A/B testing de mensagens
- [ ] Personalização por unidade
- [ ] Templates dinâmicos avançados

---

## 📞 Suporte

Para dúvidas ou sugestões sobre o sistema de mensagens:
- Consulte a documentação em `GUIA-MENSAGENS-CENTRALIZADAS.md`
- Veja exemplos em `server/database/mensagensWhatsApp.service.js`
- Analise o schema em `server/database/schema-mensagens-whatsapp.sql`

---

**Sistema de Mensagens WhatsApp Centralizadas v1.0**
*HMASP Chat - Central de Marcação de Consultas*
*Desenvolvido em 2025-12-11*
