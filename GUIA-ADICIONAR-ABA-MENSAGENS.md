# 🎨 Guia: Adicionar Aba "Mensagens" nas Configurações

## 📋 Objetivo

Adicionar uma nova sub-aba "Mensagens" na aba "Configurações" do sistema HMASP Chat para gerenciar mensagens WhatsApp centralizadas.

---

## 🛠️ Passos de Instalação

### 1. O componente já foi criado

O arquivo `src/components/configuracaoMensagens.js` já contém toda a interface pronta.

### 2. Adicionar HTML da aba no index.html (ou arquivo HTML principal)

**Localize a seção de Configurações** no seu arquivo HTML principal e adicione:

```html
<!-- Dentro da aba Configurações -->
<div id="config-tab" class="tab-content">
    <!-- Sub-abas de Configurações -->
    <div class="config-tabs">
        <button class="config-tab-btn active" data-config="usuarios">
            👥 Usuários
        </button>
        <button class="config-tab-btn" data-config="sistema">
            ⚙️ Sistema
        </button>
        <!-- ⭐ NOVA ABA: MENSAGENS ⭐ -->
        <button class="config-tab-btn" data-config="mensagens">
            📨 Mensagens
        </button>
    </div>

    <!-- Conteúdos das sub-abas -->
    <div class="config-content active" id="config-usuarios">
        <!-- Conteúdo existente de Usuários -->
    </div>

    <div class="config-content" id="config-sistema">
        <!-- Conteúdo existente de Sistema -->
    </div>

    <!-- ⭐ NOVO CONTEÚDO: MENSAGENS ⭐ -->
    <div class="config-content" id="config-mensagens">
        <div id="mensagens-container">
            <!-- O componente será renderizado aqui -->
        </div>
    </div>
</div>
```

### 3. Importar o componente no main.js

**No topo do arquivo `src/main.js`**, adicione o import:

```javascript
import * as ConfiguracaoMensagens from './components/configuracaoMensagens.js';
```

### 4. Inicializar o componente quando a aba for ativada

**No arquivo `src/main.js`**, localize a função que gerencia as abas de configuração e adicione:

```javascript
// Função que lida com mudança de sub-abas de configuração
function handleConfigTabChange(configName) {
    // Remove classe active de todos os botões e conteúdos
    document.querySelectorAll('.config-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelectorAll('.config-content').forEach(content => {
        content.classList.remove('active');
    });

    // Ativa botão e conteúdo selecionados
    const activeButton = document.querySelector(`[data-config="${configName}"]`);
    const activeContent = document.getElementById(`config-${configName}`);

    if (activeButton) activeButton.classList.add('active');
    if (activeContent) activeContent.classList.add('active');

    // ⭐ INICIALIZA COMPONENTE DE MENSAGENS ⭐
    if (configName === 'mensagens') {
        ConfiguracaoMensagens.init();
    }
}

// Event listeners para os botões de sub-abas
document.querySelectorAll('.config-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const configName = btn.getAttribute('data-config');
        handleConfigTabChange(configName);
    });
});
```

### 5. CSS adicional (opcional)

Se necessário, adicione estilos para as sub-abas em seu arquivo CSS principal:

```css
.config-tabs {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
    border-bottom: 2px solid #e0e0e0;
}

.config-tab-btn {
    padding: 12px 24px;
    border: none;
    background: none;
    cursor: pointer;
    border-bottom: 3px solid transparent;
    transition: all 0.3s;
    font-size: 16px;
}

.config-tab-btn:hover {
    background: #f8f9fa;
}

.config-tab-btn.active {
    border-bottom-color: #007bff;
    color: #007bff;
    font-weight: bold;
}

.config-content {
    display: none;
}

.config-content.active {
    display: block;
}
```

---

## 🚀 Testando a Instalação

1. **Inicie o servidor:**
   ```bash
   npm run dev
   ```

2. **Acesse o sistema:**
   - Abra `http://localhost:3000`

3. **Navegue para Configurações:**
   - Clique na aba "⚙️ Configurações"
   - Você verá 3 sub-abas: **Usuários**, **Sistema** e **📨 Mensagens**

4. **Clique em "📨 Mensagens":**
   - A interface de gerenciamento de mensagens será carregada
   - Você verá todas as mensagens WhatsApp cadastradas
   - Poderá editar, visualizar e ver estatísticas

---

## 📊 Funcionalidades Disponíveis

### 1. **Listagem de Mensagens**
   - Visualize todas as mensagens organizadas por fluxo
   - Filtros por fluxo e categoria
   - Informações de envio (total de envios, último envio)

### 2. **Edição de Mensagens**
   - Edite o texto de qualquer mensagem
   - Visualize variáveis disponíveis
   - Versionamento automático

### 3. **Estatísticas**
   - Total de mensagens no sistema
   - Envios do dia
   - Top 10 mensagens mais enviadas

### 4. **Visualização Detalhada**
   - Veja todos os detalhes de uma mensagem
   - Histórico de uso
   - Informações técnicas (código, fluxo, contexto)

---

## 🔍 Verificação de Funcionamento

### APIs Disponíveis

Teste se as APIs estão funcionando:

```bash
# Listar todas as mensagens
curl http://localhost:3000/api/mensagens

# Buscar mensagem específica
curl http://localhost:3000/api/mensagens/confirmacao_presenca_aprovada

# Estatísticas
curl http://localhost:3000/api/mensagens/stats/overview
```

### Console do Navegador

Abra o console (F12) e você deve ver:

```
[ConfigMensagens] Inicializando...
[ConfigMensagens] Mensagens carregadas: 13
[ConfigMensagens] Inicializado com sucesso
```

---

## 🐛 Solução de Problemas

### Problema: "Container não encontrado"
**Solução:** Certifique-se de que o HTML tem o elemento `<div id="mensagens-container"></div>`

### Problema: "Erro ao carregar mensagens"
**Solução:** Verifique se o servidor está rodando e se as APIs estão respondendo

### Problema: "Estilos não aplicados"
**Solução:** Os estilos são aplicados automaticamente pelo componente. Verifique se há conflitos com CSS existente.

### Problema: "Modal não abre"
**Solução:** Verifique o console do navegador por erros. Certifique-se de que as funções globais estão sendo exportadas corretamente.

---

## 📝 Estrutura de Arquivos

```
src/
├── components/
│   ├── confirmacaoPresenca.js
│   ├── desmarcacaoConsultas.js
│   └── configuracaoMensagens.js  ← NOVO
├── main.js                        ← MODIFICADO
└── ...

server/
└── database/
    ├── mensagensWhatsApp.service.js
    └── schema-mensagens-whatsapp.sql

server.js                           ← MODIFICADO
```

---

## ✅ Checklist de Instalação

- [ ] Componente criado: `src/components/configuracaoMensagens.js`
- [ ] HTML atualizado com nova aba
- [ ] Import adicionado no `main.js`
- [ ] Event listeners configurados
- [ ] CSS adicional aplicado (se necessário)
- [ ] Servidor reiniciado
- [ ] Testado no navegador
- [ ] APIs funcionando
- [ ] Edição de mensagens funcionando
- [ ] Estatísticas carregando

---

## 🎯 Próximos Passos

1. **Personalização:**
   - Ajuste cores e estilos conforme identidade visual do HMASP
   - Adicione mais filtros se necessário

2. **Funcionalidades Extras:**
   - Preview de mensagem antes de salvar
   - Histórico de alterações
   - Comparação de versões

3. **Segurança:**
   - Adicione autenticação nas APIs
   - Limite quem pode editar mensagens
   - Log de auditoria de alterações

---

## 📞 Suporte

Para dúvidas ou problemas:
- Consulte a documentação completa em `GUIA-MENSAGENS-CENTRALIZADAS.md`
- Veja exemplos em `EXEMPLO-MIGRACAO-MENSAGENS.js`
- Verifique o resumo em `RESUMO-SISTEMA-MENSAGENS.md`

---

**Sistema de Mensagens WhatsApp Centralizadas v1.0**
*HMASP Chat - Central de Marcação de Consultas*
*Instalação da Interface Admin - 2025-12-11*
