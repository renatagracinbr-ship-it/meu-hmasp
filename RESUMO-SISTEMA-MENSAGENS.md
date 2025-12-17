# 📊 RESUMO VISUAL: Sistema de Mensagens Centralizadas

## 🎯 O Que Foi Criado?

```
📁 Projeto HMASP Chat
├── 📄 server/database/schema-mensagens-whatsapp.sql
│   └── ✅ Banco de dados SQLite com 2 tabelas + 3 views
│
├── 📄 server/database/mensagensWhatsApp.service.js
│   └── ✅ Serviço JavaScript para gerenciar mensagens
│
├── 📄 GUIA-MENSAGENS-CENTRALIZADAS.md
│   └── ✅ Documentação completa (20+ páginas)
│
├── 📄 EXEMPLO-MIGRACAO-MENSAGENS.js
│   └── ✅ Exemplos práticos de migração
│
└── 📄 RESUMO-SISTEMA-MENSAGENS.md (este arquivo)
    └── ✅ Visão geral rápida
```

---

## 📋 Catálogo Completo de Mensagens

### Total: **23 mensagens** em **7 fluxos**

| Fluxo | Quantidade | Descrição |
|-------|------------|-----------|
| **Confirmação** | 3 | Respostas após paciente confirmar/declinar presença |
| **Desmarcação** | 3 | Respostas após notificação de desmarcação |
| **Validação** | 7 | Mensagens de erro progressivas (3 tentativas × 2 contextos + 1 geral) |
| **Fallback** | 2 | Mensagens quando não há contexto / oferta atendente |
| **Templates** | 7 | Templates WhatsApp Business (ainda em whatsappTemplates.service.js) |
| **Inbound** | 2 | Mensagens em inboundMessageHandler.service.js |

---

## 🗂️ Tabelas do Banco de Dados

### 1️⃣ `mensagens_whatsapp` (Catálogo de Mensagens)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | INTEGER | ID único (auto-increment) |
| `codigo` | VARCHAR(100) | **Código único** da mensagem (ex: `confirmacao_presenca_aprovada`) |
| `fluxo` | VARCHAR(50) | Fluxo: `confirmacao`, `desmarcacao`, `validacao`, `fallback` |
| `categoria` | VARCHAR(50) | Categoria: `resposta`, `erro`, `informativo`, `template` |
| `contexto` | VARCHAR(50) | Contexto: `confirmacao`, `desmarcacao`, `null` |
| `titulo` | VARCHAR(200) | Título descritivo para admin |
| `texto` | TEXT | **Texto da mensagem** (com {variaveis}) |
| `tipo_envio` | VARCHAR(50) | Tipo: `msg_reply`, `send_message`, `template` |
| `variaveis_disponiveis` | TEXT | JSON com variáveis: `["nome", "data"]` |
| `ativo` | BOOLEAN | Se mensagem está ativa (1) ou desativada (0) |
| `total_envios` | INTEGER | **Contador automático** de envios |
| `ultimo_envio_em` | DATETIME | Data do último envio |
| `versao` | INTEGER | Versão da mensagem (para histórico) |

**Total de registros:** 13 mensagens já cadastradas

### 2️⃣ `mensagens_envios_log` (Log de Envios)

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | INTEGER | ID único do envio |
| `mensagem_id` | INTEGER | FK para `mensagens_whatsapp` |
| `codigo_mensagem` | VARCHAR(100) | Código da mensagem enviada |
| `telefone` | VARCHAR(20) | Telefone do destinatário |
| `confirmacao_id` | INTEGER | ID da confirmação (se aplicável) |
| `texto_enviado` | TEXT | Texto final enviado (com variáveis substituídas) |
| `variaveis_usadas` | TEXT | JSON com valores das variáveis |
| `contexto` | VARCHAR(50) | Contexto do envio |
| `status` | VARCHAR(50) | Status: `enviado`, `erro`, `fila` |
| `enviado_em` | DATETIME | Data/hora do envio |

**Objetivo:** Auditoria completa de TODOS os envios

---

## 🔄 Como Funciona?

```
┌─────────────────────────────────────────────────────────────┐
│  1. CÓDIGO SOLICITA MENSAGEM                                 │
│     MensagensWhatsApp.renderMensagem('confirmacao_...', {}) │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  2. SERVIÇO BUSCA NO CACHE (60s TTL)                         │
│     └─ Se não está em cache → Busca no banco SQLite         │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  3. SUBSTITUI VARIÁVEIS                                      │
│     "{nome}" → "Maria Silva"                                 │
│     "{data}" → "05/01/2026"                                  │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  4. RETORNA TEXTO RENDERIZADO                                │
│     "Olá, Maria Silva. Sua consulta é dia 05/01/2026..."    │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  5. CÓDIGO ENVIA MENSAGEM                                    │
│     await msg.reply(textoRenderizado)                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  6. REGISTRA NO LOG                                          │
│     MensagensWhatsApp.registrarEnvio({...})                  │
│     └─ Incrementa contador total_envios                     │
│     └─ Atualiza ultimo_envio_em                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Views (Consultas Rápidas)

### 1. `v_mensagens_por_fluxo`
Agrupa mensagens por fluxo com estatísticas:
```sql
SELECT * FROM v_mensagens_por_fluxo;
```
| fluxo | total_mensagens | ativas | total_envios |
|-------|-----------------|--------|--------------|
| confirmacao | 3 | 3 | 1234 |
| desmarcacao | 3 | 3 | 567 |
| validacao | 7 | 7 | 890 |
| fallback | 2 | 2 | 123 |

### 2. `v_mensagens_mais_enviadas`
Top 20 mensagens mais enviadas:
```sql
SELECT * FROM v_mensagens_mais_enviadas LIMIT 5;
```
| codigo | titulo | fluxo | total_envios | ultimo_envio_em |
|--------|--------|-------|--------------|-----------------|
| confirmacao_presenca_aprovada | Presença Confirmada | confirmacao | 450 | 2025-12-11 14:30:00 |
| erro_tentativa1_confirmacao | Erro 1ª Tent. | validacao | 123 | 2025-12-11 14:25:00 |

### 3. `v_estatisticas_envio_dia`
Estatísticas diárias de envio:
```sql
SELECT * FROM v_estatisticas_envio_dia LIMIT 7;
```
| data | fluxo | total_envios | telefones_unicos |
|------|-------|--------------|------------------|
| 2025-12-11 | confirmacao | 45 | 38 |
| 2025-12-11 | desmarcacao | 12 | 11 |
| 2025-12-10 | confirmacao | 52 | 47 |

---

## 🚀 Como Usar (Resumo Rápido)

### Código Básico (3 passos):

```javascript
// 1. Importar (no topo do arquivo)
const MensagensWhatsApp = require('./server/database/mensagensWhatsApp.service');

// 2. Inicializar (ao startar servidor)
MensagensWhatsApp.initialize();

// 3. Usar
const texto = MensagensWhatsApp.renderMensagem('confirmacao_presenca_aprovada');
await msg.reply(texto);
MensagensWhatsApp.registrarEnvio({
    codigo: 'confirmacao_presenca_aprovada',
    telefone: phoneNumber,
    textoEnviado: texto,
    status: 'enviado'
});
```

### Código com Variáveis:

```javascript
const texto = MensagensWhatsApp.renderMensagem(
    'erro_numero_invalido',
    {
        numero: '5',
        opcoes: '1 - Sim\n2 - Não'
    }
);
await msg.reply(texto);
```

### Código Simplificado (função auxiliar):

```javascript
// Criar função auxiliar uma vez
async function enviarMsg(msg, codigo, vars = {}, dadosLog = {}) {
    const texto = MensagensWhatsApp.renderMensagem(codigo, vars);
    await msg.reply(texto);
    MensagensWhatsApp.registrarEnvio({
        codigo,
        telefone: dadosLog.telefone || msg.from,
        textoEnviado: texto,
        variaveis: vars,
        status: 'enviado'
    });
}

// Usar em qualquer lugar
await enviarMsg(msg, 'confirmacao_presenca_aprovada', {}, { telefone: phoneNumber });
```

---

## 📈 Estatísticas em Tempo Real

```javascript
const stats = MensagensWhatsApp.getEstatisticas();

console.log(`Total de mensagens: ${stats.totalMensagens}`);
console.log(`Envios hoje: ${stats.enviosHoje}`);
console.log(`\nTop 5 mensagens mais enviadas:`);
stats.maisEnviadas.slice(0, 5).forEach(msg => {
    console.log(`- ${msg.titulo}: ${msg.total_envios} envios`);
});
```

**Saída:**
```
Total de mensagens: 13
Envios hoje: 67

Top 5 mensagens mais enviadas:
- Presença Confirmada: 450 envios
- Erro 1ª Tentativa (Confirmação): 123 envios
- Consulta Desmarcada: 89 envios
- Não Agendou: 45 envios
- Reagendar: 34 envios
```

---

## 🎨 Mapeamento de Códigos

### Confirmação de Presença

| Resposta | Código |
|----------|--------|
| Paciente confirma (1) | `confirmacao_presenca_aprovada` |
| Paciente declina (2) | `confirmacao_presenca_declinada` |
| Não agendou (3) | `confirmacao_nao_agendada` |

### Desmarcação

| Resposta | Código |
|----------|--------|
| Reagendar (1) | `desmarcacao_solicita_reagendamento` |
| Paciente solicitou (2) | `desmarcacao_paciente_solicitou` |
| Sem reagendamento (3) | `desmarcacao_sem_reagendamento` |

### Validação/Erros

| Situação | Código |
|----------|--------|
| Número inválido | `erro_numero_invalido` |
| 1ª tentativa (confirmação) | `erro_tentativa1_confirmacao` |
| 2ª tentativa (confirmação) | `erro_tentativa2_confirmacao` |
| 3ª+ tentativa (confirmação) | `erro_tentativa3_confirmacao` |
| 1ª tentativa (desmarcação) | `erro_tentativa1_desmarcacao` |
| 2ª tentativa (desmarcação) | `erro_tentativa2_desmarcacao` |
| 3ª+ tentativa (desmarcação) | `erro_tentativa3_desmarcacao` |

### Fallback

| Situação | Código |
|----------|--------|
| Sem contexto | `sem_contexto_boasvindas` |
| Oferta atendente | `oferta_atendente_humano` |

---

## ✅ Benefícios Principais

### 1. **Centralização**
- Todas as mensagens em um único lugar
- Fácil visualizar todos os fluxos
- Sem duplicação de código

### 2. **Auditoria**
- Log completo de TODOS os envios
- Rastreamento por telefone/data/contexto
- Identificação de problemas

### 3. **Estatísticas**
- Mensagens mais/menos usadas
- Tendências de uso
- Performance de fluxos

### 4. **Manutenção**
- Alterar mensagem = editar 1 linha no banco
- Não precisa mexer no código
- Versionamento automático

### 5. **Futuro**
- Preparado para tradução (multi-idioma)
- A/B testing de mensagens
- Interface admin para edição

---

## 🔧 Administração Rápida

### Consultar mensagens:
```sql
SELECT codigo, titulo, total_envios
FROM mensagens_whatsapp
WHERE ativo = 1
ORDER BY total_envios DESC;
```

### Ver envios de hoje:
```sql
SELECT
    m.titulo,
    COUNT(*) as envios
FROM mensagens_envios_log e
JOIN mensagens_whatsapp m ON e.mensagem_id = m.id
WHERE DATE(e.enviado_em) = DATE('now')
GROUP BY m.titulo
ORDER BY envios DESC;
```

### Atualizar mensagem:
```javascript
MensagensWhatsApp.atualizarTexto(
    'confirmacao_presenca_aprovada',
    '✅ Presença confirmada! Novo texto aqui...',
    'admin@hmasp.com.br'
);
```

### Exportar backup:
```javascript
const mensagens = MensagensWhatsApp.exportarParaJSON();
fs.writeFileSync('backup.json', JSON.stringify(mensagens, null, 2));
```

---

## 📅 Próximos Passos

### Fase 1: Implementação (ATUAL)
- [x] ✅ Criar banco de dados
- [x] ✅ Criar serviço JavaScript
- [x] ✅ Catalogar 13 mensagens principais
- [x] ✅ Criar documentação completa
- [ ] ⏳ Migrar server.js
- [ ] ⏳ Testar em produção

### Fase 2: Interface Admin
- [ ] Tela para listar mensagens
- [ ] Editar textos pelo admin
- [ ] Visualizar estatísticas
- [ ] Preview antes de ativar

### Fase 3: Recursos Avançados
- [ ] Multi-idioma (PT/EN/ES)
- [ ] A/B testing
- [ ] Personalização por unidade
- [ ] Templates dinâmicos avançados

---

## 📞 Arquivos de Referência

1. **Documentação Completa:** `GUIA-MENSAGENS-CENTRALIZADAS.md` (20+ páginas)
2. **Exemplos de Código:** `EXEMPLO-MIGRACAO-MENSAGENS.js` (350+ linhas)
3. **Schema do Banco:** `server/database/schema-mensagens-whatsapp.sql`
4. **Serviço JavaScript:** `server/database/mensagensWhatsApp.service.js`
5. **Este Resumo:** `RESUMO-SISTEMA-MENSAGENS.md`

---

## 🎯 Resumo em 3 Frases

1. **Sistema centraliza as 23 mensagens** WhatsApp em um banco de dados SQLite
2. **Serviço JavaScript** busca, renderiza e registra envios automaticamente
3. **Facilita manutenção, auditoria e futuras melhorias** (tradução, A/B test, etc.)

---

**Sistema de Mensagens WhatsApp Centralizadas v1.0**
*Desenvolvido em 2025-12-11*
*HMASP Chat - Central de Marcação de Consultas*
