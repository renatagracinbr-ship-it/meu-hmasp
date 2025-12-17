# 🖥️ INSTRUÇÕES - VM Ubuntu para HMASP Chat

## ✅ Por que VM é melhor que WSL?

- Claude Code trabalha DIRETAMENTE dentro do Linux
- Sem problemas de compatibilidade Windows/Linux
- Mais rápido (sem mount /mnt/c/)
- Claude vê logs, processos e arquivos em tempo real
- Instalação automática de tudo

---

## 📥 PASSO 1: Download (Faça os 2 downloads em paralelo)

### 1.1 VirtualBox
- Link: https://www.virtualbox.org/wiki/Downloads
- Clique em **"Windows hosts"**
- Tamanho: ~100MB
- Instalar: Next, Next, Install

### 1.2 Ubuntu Desktop 22.04 LTS
- Link: https://ubuntu.com/download/desktop
- Baixe **Ubuntu 22.04.5 LTS**
- Tamanho: ~4.7GB (vai demorar uns 5-10 minutos)
- Salve em: Downloads

---

## 🔧 PASSO 2: Criar a VM no VirtualBox

### 2.1 Abrir VirtualBox
1. Abra o VirtualBox
2. Clique em **"Novo"** (botão azul)

### 2.2 Configurações da VM

**Nome e Sistema Operacional:**
```
Nome: Ubuntu-HMASP
Pasta: C:\VMs (ou deixe padrão)
Tipo: Linux
Versão: Ubuntu (64-bit)
```

**Memória RAM:**
```
4096 MB (4GB)
```
*Se seu PC tem 16GB+, pode colocar 8192 MB (8GB)*

**Disco Rígido:**
```
☑ Criar um disco rígido virtual agora
Tamanho: 25 GB
Tipo: VDI (VirtualBox Disk Image)
Armazenamento: Dinamicamente alocado
```

Clique em **"Criar"**

---

## 💿 PASSO 3: Instalar Ubuntu

### 3.1 Iniciar VM
1. Selecione a VM **"Ubuntu-HMASP"**
2. Clique em **"Iniciar"** (seta verde)
3. Vai pedir para selecionar um disco de inicialização
4. Clique no ícone de pasta 📁
5. Clique em **"Acrescentar"**
6. Navegue até Downloads
7. Selecione o arquivo **ubuntu-22.04.5-desktop-amd64.iso**
8. Clique em **"Escolher"**
9. Clique em **"Iniciar"**

### 3.2 Instalação do Ubuntu
Aguarde o Ubuntu carregar (1-2 minutos), depois:

1. **Try or Install Ubuntu** → pressione ENTER
2. Aguarde carregar (2 minutos)
3. Escolha idioma: **Português do Brasil**
4. Clique em **"Instalar Ubuntu"**
5. Layout do teclado: **Portuguese (Brazil)**
6. Atualizações: **Instalação normal** + ☑ Baixar atualizações
7. Tipo de instalação: **Apagar disco e instalar Ubuntu**
   - *Não se preocupe, é o disco VIRTUAL, não vai mexer no Windows!*
8. Fuso horário: **São Paulo**
9. Suas informações:
   ```
   Seu nome: HMASP
   Nome do computador: hmasp-vm
   Nome de usuário: hmasp
   Senha: (escolha uma senha simples, tipo: hmasp123)
   ☑ Solicitar senha para entrar
   ```
10. Clique em **"Continuar"**

**Aguarde a instalação (~10-15 minutos)**

11. Quando terminar, clique em **"Reiniciar Agora"**
12. Pressione ENTER quando pedir

---

## 🚀 PASSO 4: Primeiro Boot (após reiniciar)

1. Faça login com sua senha
2. Pule o "Online Accounts"
3. Pule o "Livepatch"
4. **NÃO** envie informações para Canonical
5. Clique em **"Concluído"**
6. Pule o tour

---

## 📦 PASSO 5: Instalar Guest Additions (Importante!)

Isso permite:
- Copiar/colar entre Windows e Ubuntu
- Compartilhar pastas
- Tela cheia

### 5.1 Comandos
Abra o Terminal (Ctrl+Alt+T) e execute:

```bash
sudo apt update
sudo apt install -y build-essential dkms linux-headers-$(uname -r)
```

### 5.2 Inserir CD Guest Additions
1. No menu VirtualBox: **Dispositivos** → **Inserir imagem de CD dos Adicionais para Convidado**
2. Clique em **"Executar"** quando aparecer a janela
3. Digite sua senha
4. Aguarde terminar
5. Pressione ENTER
6. Reinicie a VM: `sudo reboot`

---

## 🔗 PASSO 6: Compartilhar Pasta do Projeto

### 6.1 No VirtualBox (com VM desligada)
1. Selecione a VM **"Ubuntu-HMASP"**
2. Clique em **"Configurações"** (engrenagem)
3. Vá em **"Pastas Compartilhadas"**
4. Clique no ícone de pasta com **+** (à direita)
5. Configure:
   ```
   Caminho da Pasta: C:\Users\user\Projetos VS Code\HMASPChat - Marcação de Consultas
   Nome da Pasta: HMASP-Chat
   ☑ Montar Automaticamente
   ☑ Tornar Permanente
   ```
6. Clique em **"OK"**
7. Clique em **"OK"** novamente

### 6.2 Iniciar VM e configurar acesso
Inicie a VM e abra o Terminal:

```bash
sudo usermod -aG vboxsf $USER
sudo reboot
```

Após reiniciar, a pasta estará em:
```
/media/sf_HMASP-Chat
```

---

## 💻 PASSO 7: Instalar Claude Code no Ubuntu

Abra o Terminal (Ctrl+Alt+T):

```bash
# Baixar Claude Code (versão Linux)
curl -fsSL https://raw.githubusercontent.com/anthropics/claude-code/main/install.sh | sh

# Ou baixe manualmente de:
# https://github.com/anthropics/claude-code/releases
```

Depois:
```bash
claude-code
```

---

## 🎯 PASSO 8: Configurar Projeto (Claude faz isso!)

Quando o Claude Code estiver rodando DENTRO do Ubuntu:

1. Abra a pasta: `/media/sf_HMASP-Chat`
2. **Claude vai fazer tudo automaticamente:**
   - Instalar Node.js 18
   - Instalar dependências
   - Instalar Chromium
   - Configurar .env
   - Rodar start.sh
   - Abrir navegador

**SEM PRECISAR EXECUTAR COMANDOS MANUALMENTE!**

---

## 📝 Resumo dos Downloads

1. **VirtualBox**: ~100MB - https://www.virtualbox.org/wiki/Downloads
2. **Ubuntu 22.04 LTS**: ~4.7GB - https://ubuntu.com/download/desktop

**Total**: ~4.8GB

**Tempo estimado total**: 30-40 minutos (depende da internet)

---

## ❓ Dúvidas Comuns

**P: Vai mexer no meu Windows?**
R: NÃO! Tudo acontece dentro da VM (computador virtual isolado)

**P: Posso deletar a VM depois?**
R: SIM! Só apagar a pasta da VM e pronto

**P: Preciso de muito espaço?**
R: ~30GB total (Ubuntu ISO 4.7GB + VM 25GB)

**P: Meu PC aguenta?**
R: Se tiver 8GB+ RAM e processador i5+, sim!

---

## 🚀 Próximos Passos

1. **AGORA**: Baixe VirtualBox e Ubuntu ISO (em paralelo)
2. **Me avise quando terminar os downloads**
3. **Depois**: Vou te guiar passo a passo na criação da VM
4. **Quando Ubuntu estiver rodando**: Claude Code entra direto no Ubuntu e faz tudo!

---

**Me chame quando os downloads terminarem!** 🎉
