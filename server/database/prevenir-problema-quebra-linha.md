# Problema: \n Literal nas Mensagens WhatsApp

## Causa Raiz
O schema SQL (`schema-mensagens-whatsapp.sql`) contém textos com `\n` que é interpretado como **literal** (barra + n) ao invés de quebra de linha.

## Solução Aplicada
1. ✅ Script `corrigir-quebras-linha.js` - Converte `\\n` para quebras reais
2. ✅ Executa após qualquer reaplicação do schema

## Prevenção Futura

### Opção 1: Não reaplicar o schema completo
- Usar apenas INSERTs específicos para novas mensagens
- Não executar `db.exec(schema)` que sobrescreve tudo

### Opção 2: Corrigir automaticamente após schema
- Sempre executar `corrigir-quebras-linha.js` após aplicar schema
- Adicionar ao fluxo de deploy/atualização

### Opção 3: Modificar schema para usar REPLACE
```sql
-- Ao invés de:
'Olá\n\nTexto'

-- Usar:
REPLACE('Olá##Texto', '##', CHAR(10))
```

## Scripts Disponíveis

### Verificar Problemas
```bash
node server/database/verificar-quebras-linha.js
```

### Corrigir Problemas
```bash
node server/database/corrigir-quebras-linha.js
```

## Status Atual
✅ Todos os 5 templates foram corrigidos
✅ Quebras de linha funcionando corretamente
⚠️  Cuidado ao reaplicar o schema SQL
