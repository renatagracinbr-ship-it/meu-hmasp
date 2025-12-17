#!/bin/bash
################################################################################
# SCRIPT DE VERIFICAÇÃO DE ORGANIZAÇÃO - HMASP CHAT
# Execute: bash check-organizacao.sh
################################################################################

echo "🔍 VERIFICANDO ORGANIZAÇÃO DO CÓDIGO..."
echo "========================================"
echo ""

PROBLEMAS=0

# 1. Arquivos fora da estrutura em src/
echo "📁 [1/8] Arquivos fora da estrutura em src/:"
ARQUIVOS_SOLTOS=$(find src/ -maxdepth 1 -type f ! -name "main.js" ! -name "auth-client.js" | wc -l)
if [ "$ARQUIVOS_SOLTOS" -gt 0 ]; then
    echo "   ❌ PROBLEMA: $ARQUIVOS_SOLTOS arquivo(s) fora da estrutura:"
    find src/ -maxdepth 1 -type f ! -name "main.js" ! -name "auth-client.js"
    PROBLEMAS=$((PROBLEMAS + 1))
else
    echo "   ✅ OK - Todos os arquivos na estrutura correta"
fi
echo ""

# 2. Imports Firebase
echo "🔥 [2/8] Procurando imports Firebase:"
FIREBASE_IMPORTS=$(grep -r "from.*firebase\|import.*firebase" src/ --include="*.js" 2>/dev/null | wc -l)
if [ "$FIREBASE_IMPORTS" -gt 0 ]; then
    echo "   ❌ PROBLEMA: Firebase encontrado em $FIREBASE_IMPORTS local(is):"
    grep -rn "from.*firebase\|import.*firebase" src/ --include="*.js"
    PROBLEMAS=$((PROBLEMAS + 1))
else
    echo "   ✅ OK - Nenhum import Firebase"
fi
echo ""

# 3. tabMaster
echo "📑 [3/8] Procurando referências a tabMaster:"
TABMASTER=$(find src/ -name "*tabMaster*" 2>/dev/null | wc -l)
TABMASTER_IMPORTS=$(grep -r "tabMaster" src/ --include="*.js" 2>/dev/null | wc -l)
if [ "$TABMASTER" -gt 0 ] || [ "$TABMASTER_IMPORTS" -gt 0 ]; then
    echo "   ❌ PROBLEMA: tabMaster ainda existe:"
    find src/ -name "*tabMaster*"
    grep -rn "tabMaster" src/ --include="*.js"
    PROBLEMAS=$((PROBLEMAS + 1))
else
    echo "   ✅ OK - tabMaster removido"
fi
echo ""

# 4. Código comentado suspeito
echo "💭 [4/8] Procurando código comentado:"
CODIGO_COMENTADO=$(grep -rn "^[[:space:]]*//.*import\|^[[:space:]]*//.*const.*=\|^[[:space:]]*//.*function" src/ --include="*.js" 2>/dev/null | wc -l)
if [ "$CODIGO_COMENTADO" -gt 5 ]; then
    echo "   ⚠️  ATENÇÃO: $CODIGO_COMENTADO linhas de código comentado encontradas"
    echo "   (Revisar manualmente)"
    PROBLEMAS=$((PROBLEMAS + 1))
else
    echo "   ✅ OK - Pouco código comentado"
fi
echo ""

# 5. Arquivos JS duplicados em dist/assets/
echo "📦 [5/8] Verificando duplicatas em dist/assets/:"
JS_COUNT=$(ls dist/assets/main-*.js 2>/dev/null | wc -l)
CSS_COUNT=$(ls dist/assets/main-*.css 2>/dev/null | wc -l)

if [ "$JS_COUNT" -gt 1 ]; then
    echo "   ❌ PROBLEMA: $JS_COUNT arquivos JS (deve ser 1):"
    ls -lh dist/assets/main-*.js
    PROBLEMAS=$((PROBLEMAS + 1))
else
    echo "   ✅ OK - 1 arquivo JS"
fi

if [ "$CSS_COUNT" -gt 1 ]; then
    echo "   ❌ PROBLEMA: $CSS_COUNT arquivos CSS (deve ser 1):"
    ls -lh dist/assets/main-*.css
    PROBLEMAS=$((PROBLEMAS + 1))
else
    echo "   ✅ OK - 1 arquivo CSS"
fi
echo ""

# 6. Lixo em dist/ (fora de assets/)
echo "🗑️  [6/8] Procurando lixo em dist/:"
LIXO=$(find dist/ -type f ! -path "dist/assets/*" ! -name "index.html" 2>/dev/null | wc -l)
if [ "$LIXO" -gt 0 ]; then
    echo "   ❌ PROBLEMA: $LIXO arquivo(s) suspeito(s):"
    find dist/ -type f ! -path "dist/assets/*" ! -name "index.html"
    PROBLEMAS=$((PROBLEMAS + 1))
else
    echo "   ✅ OK - dist/ limpo"
fi
echo ""

# 7. Verificar credenciais AGHUse
echo "🔐 [7/8] Verificando credenciais AGHUse:"
if grep -q "DB_HOST=10.12.40.219" .env 2>/dev/null; then
    echo "   ✅ OK - IP correto (10.12.40.219)"
else
    echo "   ❌ PROBLEMA: IP incorreto em .env"
    grep "DB_HOST" .env
    PROBLEMAS=$((PROBLEMAS + 1))
fi

if grep -q "DB_NAME=dbaghu" .env 2>/dev/null; then
    echo "   ✅ OK - Database correto (dbaghu)"
else
    echo "   ❌ PROBLEMA: Database incorreto em .env"
    grep "DB_NAME" .env
    PROBLEMAS=$((PROBLEMAS + 1))
fi
echo ""

# 8. Verificar build atualizado
echo "🔨 [8/8] Verificando última compilação:"
if [ -f "dist/index.html" ]; then
    DIST_AGE=$(find dist/index.html -mmin +60 2>/dev/null | wc -l)
    if [ "$DIST_AGE" -gt 0 ]; then
        echo "   ⚠️  ATENÇÃO: dist/ com mais de 1 hora (considere rebuild)"
        ls -lh dist/index.html
    else
        echo "   ✅ OK - Build recente"
    fi
else
    echo "   ❌ PROBLEMA: dist/index.html não encontrado"
    PROBLEMAS=$((PROBLEMAS + 1))
fi
echo ""

# RESUMO
echo "========================================"
echo "📊 RESUMO:"
echo ""

if [ "$PROBLEMAS" -eq 0 ]; then
    echo "✅ TUDO CERTO! Nenhum problema encontrado."
    echo ""
    echo "✨ Estrutura organizada:"
    echo "   • src/ estruturado corretamente"
    echo "   • dist/ limpo e atualizado"
    echo "   • Sem Firebase"
    echo "   • Sem tabMaster"
    echo "   • Credenciais corretas"
    echo ""
    exit 0
else
    echo "❌ ENCONTRADOS $PROBLEMAS PROBLEMA(S)"
    echo ""
    echo "📋 AÇÕES RECOMENDADAS:"
    echo ""
    echo "1. Corrigir problemas listados acima"
    echo "2. Executar: npm run build"
    echo "3. Limpar dist/assets/:"
    echo "   cd dist/assets"
    echo "   ls -t main-*.js | tail -n +2 | xargs rm -f"
    echo "   ls -t main-*.css | tail -n +2 | xargs rm -f"
    echo "4. Executar este script novamente"
    echo ""
    exit 1
fi
