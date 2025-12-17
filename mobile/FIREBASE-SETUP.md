# Configuracao do Firebase - Meu HMASP

## 1. Criar Projeto no Firebase

1. Acesse https://console.firebase.google.com
2. Clique em "Adicionar projeto"
3. Nome do projeto: `meu-hmasp` (ou similar)
4. Desabilite o Google Analytics (opcional)
5. Clique em "Criar projeto"

## 2. Configurar Web App

1. No console do Firebase, va em "Configuracoes do projeto" (icone de engrenagem)
2. Role ate "Seus apps" e clique no icone Web `</>`
3. Nome do app: `Meu HMASP`
4. Marque "Tambem configure o Firebase Hosting"
5. Clique em "Registrar app"
6. Copie as credenciais do `firebaseConfig`

## 3. Atualizar Configuracao

Edite o arquivo `mobile/src/config/firebase.config.js` com suas credenciais:

```javascript
export const firebaseConfig = {
    apiKey: "SUA_API_KEY_AQUI",
    authDomain: "seu-projeto.firebaseapp.com",
    projectId: "seu-projeto",
    storageBucket: "seu-projeto.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef123456"
};
```

## 4. Configurar Authentication (Opcional)

Para usar autenticacao por telefone (SMS):

1. Va em "Authentication" > "Sign-in method"
2. Habilite "Telefone"
3. Adicione numeros de teste para desenvolvimento

## 5. Deploy no Firebase Hosting

### Primeiro deploy:

```bash
cd mobile
firebase login
firebase init hosting
# Selecione o projeto criado
# Diretorio publico: dist
# SPA: Yes
# GitHub Actions: No

npm run deploy
```

### Deploys subsequentes:

```bash
npm run deploy
```

## 6. Dominio Personalizado (Opcional)

1. Va em "Hosting" no console Firebase
2. Clique em "Adicionar dominio personalizado"
3. Siga as instrucoes para configurar DNS

## Comandos Uteis

```bash
# Login no Firebase
firebase login

# Ver projetos
firebase projects:list

# Selecionar projeto
firebase use seu-projeto

# Build e deploy
npm run deploy

# Apenas build
npm run build

# Preview local do build
npm run preview
```

## Estrutura do Deploy

```
mobile/
├── dist/           # Build (gerado por npm run build)
├── public/         # Assets estaticos
├── src/            # Codigo fonte
├── firebase.json   # Config do Firebase Hosting
└── package.json    # Scripts
```

## Custos

Firebase Hosting oferece gratuitamente:
- 10GB de armazenamento
- 360MB/dia de transferencia
- SSL gratuito
- Dominio .web.app gratuito

Para a maioria dos casos de uso do HMASP, isso sera suficiente.
