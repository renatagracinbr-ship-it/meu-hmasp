# Estratégia de Desenvolvimento - Chat vs Admin

## 📌 DECISÃO TOMADA: 06/12/2025

### Abordagem escolhida:
**Desenvolver APENAS a interface PRINCIPAL primeiro, depois clonar para ADMIN**

---

## 🎯 FASE ATUAL: FASE 1 - Desenvolvimento da Interface Principal

### O que fazer AGORA:
- ✅ Trabalhar SOMENTE em `index.html` (interface principal - http://localhost:3000/)
- ✅ Implementar e testar TODAS as funcionalidades na interface principal
- ✅ Corrigir TODOS os bugs
- ❌ **NÃO MEXER** em `public/admin.html` ainda

### Arquivos que estamos editando:
- `index.html` (raiz)
- `src/components/confirmacaoPresenca.js`
- `src/components/desmarcacaoConsultas.js`
- `src/services/*.js`
- `src/styles/*.css`

---

## 📋 FASES DO PROJETO

### FASE 1: Desenvolver Interface Principal ⏳ EM ANDAMENTO
- [ ] Botões de arquivamento funcionando
- [ ] Badges (M e 72h) funcionando
- [ ] Filtros funcionando
- [ ] Desmarcação funcionando
- [ ] Layout 100% correto
- [ ] Sem bugs

### FASE 2: Clonar para Admin ⏸️ AGUARDANDO FASE 1
Quando a Fase 1 estiver 100% completa:
1. Copiar `index.html` → `public/admin.html`
2. Copiar componentes JS necessários
3. Adicionar APENAS funcionalidade de envio automático
4. Ajustar título/textos se necessário
5. Testar admin.html

### FASE 3: Manutenção ⏸️ AGUARDANDO FASE 2
- Mudanças estruturais (layout/CSS) → editar ambas
- Mudanças funcionais → editar apenas a necessária

---

## 🔧 WORKFLOW ATUAL

1. Editar arquivos fonte (`src/` e `index.html` raiz)
2. Rodar `npm run build` (atualiza `dist/`)
3. Dar F5 no navegador
4. Testar
5. Repetir até funcionar 100%

---

## ⚠️ LEMBRETE IMPORTANTE

**NÃO EDITAR `public/admin.html` ATÉ A FASE 1 ESTAR COMPLETA!**

Focamos primeiro em fazer a interface principal funcionar perfeitamente.
Depois clonamos tudo que já funciona para o admin.

---

## 📝 Diferenças entre Principal e Admin

### Interface Principal (index.html):
- Usuários visualizam
- **SEM** envio automático de mensagens
- Apenas visualização e arquivamento manual

### Interface Admin (admin.html):
- VM/Administradores
- **COM** envio automático de mensagens
- Toggle para ativar/desativar auto-envio
- Mesma estrutura visual da principal

---

## 🎯 Objetivo Final

Ter duas interfaces:
1. **Principal**: Perfeita, sem bugs, só visualização
2. **Admin**: Clone da principal + funcionalidade de envio automático

Essa abordagem economiza tempo e evita bugs duplicados!
