# ============================================
# SCRIPT DE ATUALIZAÇÃO REMOTA
# Executa os 4 comandos no servidor HMASP
# ============================================

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  ATUALIZANDO SERVIDOR HMASP" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

$servidor = "10.12.40.105"
$usuario = "sistema-whats"
$senha = "Sistema@whats"

Write-Host "[1/4] Testando conectividade..." -ForegroundColor Yellow
$ping = Test-Connection -ComputerName $servidor -Count 2 -Quiet
if (-not $ping) {
    Write-Host "❌ ERRO: Servidor inacessível!" -ForegroundColor Red
    Write-Host "Verifique se você está conectado à VPN do HMASP" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Servidor acessível" -ForegroundColor Green
Write-Host ""

Write-Host "[2/4] Conectando via SSH..." -ForegroundColor Yellow
Write-Host "Servidor: $servidor" -ForegroundColor Gray
Write-Host "Usuário: $usuario" -ForegroundColor Gray
Write-Host ""

# Comandos a executar
$comandos = @(
    "cd /opt/hmasp/hmasp-chat-v2",
    "sudo systemctl stop hmasp-chat",
    "git pull origin main",
    "sudo systemctl start hmasp-chat",
    "sleep 5",
    "sudo systemctl status hmasp-chat"
)

$comandoCompleto = $comandos -join " && "

Write-Host "[3/4] Executando atualização..." -ForegroundColor Yellow
Write-Host "Comandos:" -ForegroundColor Gray
foreach ($cmd in $comandos) {
    Write-Host "  → $cmd" -ForegroundColor DarkGray
}
Write-Host ""

# Executar via SSH (requer senha interativa)
Write-Host "⚠️  VOCÊ PRECISARÁ DIGITAR A SENHA: Sistema@whats" -ForegroundColor Yellow
Write-Host ""

ssh "$usuario@$servidor" $comandoCompleto

Write-Host ""
Write-Host "[4/4] Verificando resultado..." -ForegroundColor Yellow
Write-Host ""

# Testar se o frontend está respondendo
Write-Host "Testando frontend..." -ForegroundColor Gray
try {
    $response = Invoke-WebRequest -Uri "http://$servidor:3000/" -UseBasicParsing -TimeoutSec 5
    if ($response.Content -match "Hospital Militar") {
        Write-Host "✅ SUCESSO! Frontend azul está funcionando!" -ForegroundColor Green
        Write-Host ""
        Write-Host "============================================" -ForegroundColor Cyan
        Write-Host "  🎯 ACESSE O SISTEMA:" -ForegroundColor Cyan
        Write-Host "============================================" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  Frontend Principal (tela azul):" -ForegroundColor White
        Write-Host "  http://$servidor:3000" -ForegroundColor Green
        Write-Host ""
        Write-Host "  Diagnóstico WhatsApp:" -ForegroundColor White
        Write-Host "  http://$servidor:3000/api/dashboard" -ForegroundColor Green
        Write-Host ""
    } else {
        Write-Host "⚠️  Servidor respondeu mas conteúdo inesperado" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Erro ao verificar: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
