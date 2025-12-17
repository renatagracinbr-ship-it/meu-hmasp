# 👋 LEIA-ME - TI do HMASP

**Bem-vindo! Este é o ponto de partida para a equipe de TI do HMASP.**

---

## 📌 Resumo Executivo

O **HMASP Chat** é um sistema web para gerenciar comunicação via WhatsApp com pacientes (confirmação de consultas, cancelamentos, faltas).

**Situação atual**: Hospedado na nuvem (Google Cloud + Firebase) apenas para demonstração.

**Objetivo**: Migrar 100% para servidores internos do HMASP.

---

## 🎯 O Que Precisa Ser Feito?

### Provisionar Infraestrutura

Criar **3 VMs + 1 Servidor PostgreSQL** com as seguintes especificações:

| Recurso | Função | Specs | IP Sugerido |
|---------|--------|-------|-------------|
| **VM1** | Frontend (Nginx) | 2 vCPU, 2GB RAM, 20GB | 10.12.40.50 |
| **VM2** | Backend WhatsApp | 2 vCPU, 2GB RAM, 20GB | 10.12.40.51 |
| **VM3** | Backend AGHUse | 2 vCPU, 2GB RAM, 10GB | 10.12.40.52 |
| **Servidor BD** | PostgreSQL | 4 vCPU, 4GB RAM, 100GB | 10.12.40.60 |

**SO**: Ubuntu Server 22.04 LTS (todas as VMs)

**Total**: 10GB RAM, 8 vCPUs, 150GB disco

---

## 📂 Documentação Completa

**COMECE POR AQUI**:
1. **[INFRAESTRUTURA-HMASP.md](INFRAESTRUTURA-HMASP.md)** ← Documento principal (leia primeiro!)
2. **[PLANO-MIGRACAO.md](PLANO-MIGRACAO.md)** ← Cronograma e tarefas detalhadas

**Guias de Instalação (passo a passo)**:
3. [INSTALACAO-VM-WHATSAPP.md](INSTALACAO-VM-WHATSAPP.md) - Instalar backend WhatsApp (VM2)
4. [INSTALACAO-POSTGRESQL.md](INSTALACAO-POSTGRESQL.md) - Instalar banco de dados

**Operação e Suporte**:
5. [TROUBLESHOOTING.md](TROUBLESHOOTING.md) - Resolver problemas comuns

---

## ⏱️ Quanto Tempo Vai Levar?

**Total**: ~3 semanas (15 dias úteis)

| Fase | Duração | Responsável |
|------|---------|-------------|
| Preparação (desenvolvimento local) | 1 semana | Desenvolvedor |
| Provisionar infraestrutura | 1 semana | **TI HMASP** |
| Deploy e testes | 1 semana | Dev + TI |

---

## 💰 Quanto Vai Custar?

**R$ 0,00** (infraestrutura existente + software open-source)

Custo recorrente: ~R$ 50/mês (energia das VMs)

---

## 🚀 Próximos Passos

### 1. Reunião de Alinhamento
- Apresentar projeto para equipe de TI
- Esclarecer dúvidas técnicas
- Definir responsáveis

### 2. Aprovar Especificações
- Validar specs das VMs (tabela acima)
- Confirmar IPs disponíveis (10.12.40.50-60)
- Verificar acesso ao banco AGHUse (10.12.40.219)

### 3. Provisionar VMs
- Criar 3 VMs Ubuntu 22.04 LTS
- Configurar IPs fixos
- Configurar firewall (ver [INFRAESTRUTURA-HMASP.md](INFRAESTRUTURA-HMASP.md))

### 4. Fornecer Acesso
- Acesso SSH para desenvolvedor
- Credenciais de administrador

### 5. Iniciar Instalação
- Seguir guias em `docs/INSTALACAO-*.md`
- Desenvolvedor + TI trabalhando juntos

---

## 🔒 Segurança e Firewall

### Portas a Abrir (UFW)

**VM1 - Frontend**:
- Porta 80/443 ← Rede interna (10.12.40.0/24)

**VM2 - WhatsApp**:
- Porta 3000 ← VM1 apenas (10.12.40.50)
- Internet ← Para conectar no WhatsApp Web

**VM3 - AGHUse**:
- Porta 3001 ← VM1 apenas (10.12.40.50)

**Servidor BD**:
- Porta 5432 ← VM2 e VM3 (10.12.40.51-52)

**Ver detalhes completos em**: [CONFIGURACAO-REDE.md](CONFIGURACAO-REDE.md) (a ser criado)

---

## 📋 Checklist Rápido (Para TI)

- [ ] Ler [INFRAESTRUTURA-HMASP.md](INFRAESTRUTURA-HMASP.md)
- [ ] Aprovar especificações das VMs
- [ ] Verificar disponibilidade de IPs (10.12.40.50-60)
- [ ] Criar VM1 (Frontend) - Ubuntu 22.04 LTS
- [ ] Criar VM2 (WhatsApp) - Ubuntu 22.04 LTS
- [ ] Criar VM3 (AGHUse) - Ubuntu 22.04 LTS
- [ ] Provisionar Servidor PostgreSQL (ou VM4)
- [ ] Configurar IPs fixos
- [ ] Configurar firewall conforme especificações
- [ ] Fornecer acesso SSH para desenvolvedor
- [ ] Agendar kick-off com equipe

---

## 📞 Contatos

**Desenvolvedor**:
- Email: centralderegulacaohmasp@gmail.com
- Nome: [A DEFINIR]

**TI HMASP**:
- Responsável: [A DEFINIR]
- Email: [A DEFINIR]

---

## ❓ Dúvidas Frequentes

### 1. Por que migrar da nuvem?
- ✅ Controle total sobre dados sensíveis (LGPD)
- ✅ Melhor performance (rede interna)
- ✅ Sem custos inesperados
- ✅ Integração direta com AGHUse (sem VPN)

### 2. O sistema atual funciona?
Sim! Está rodando na nuvem: https://hmasp-chat.web.app
Foi usado para demonstração e validação com a chefia.

### 3. Posso testar antes de migrar?
Sim! O sistema atual continua funcionando durante toda a migração.

### 4. E se algo der errado?
Temos backup completo + sistema atual na nuvem como fallback.

### 5. Quem vai dar suporte?
**TI do HMASP**: Infraestrutura, VMs, rede, backups
**Desenvolvedor**: Código, bugs, novas funcionalidades

### 6. Precisa de licenças?
Não! Todo software é open-source (Node.js, PostgreSQL, Nginx, Chromium).

### 7. Quanto de internet vai consumir?
Muito pouco. Apenas a VM2 (WhatsApp) precisa de internet (< 100MB/mês).

### 8. E se o WhatsApp desconectar?
É só escanear o QR Code novamente. Procedimento em [TROUBLESHOOTING.md](TROUBLESHOOTING.md).

### 9. Como funciona o backup?
Backup automático diário do PostgreSQL (script fornecido). Retenção de 30 dias.

### 10. Posso usar uma VM só para tudo?
Pode, mas não recomendamos. 3 VMs separadas facilitam manutenção e isolamento.

---

## 🎉 Vamos Começar!

**Passo 1**: Leia [INFRAESTRUTURA-HMASP.md](INFRAESTRUTURA-HMASP.md)
**Passo 2**: Agende reunião com desenvolvedor
**Passo 3**: Provisione as VMs conforme especificações
**Passo 4**: Siga os guias de instalação

**Sucesso! 🚀**

---

**Última atualização**: Dezembro 2025
