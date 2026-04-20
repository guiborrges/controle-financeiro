# Controle Financeiro com login protegido

Este projeto roda com backend em Node.js + Express, suporta múltiplos usuários com sessão individual e mantém os dados financeiros separados por conta.

## Estrutura principal

- `server.js`: servidor Express, sessão, rotas de login, cadastro, logout e proteção do app
- `server/password.js`: hash e verificação de senha com PBKDF2
- `server/user-store.js`: leitura e escrita do cadastro de usuários
- `server/app-state-store.js`: persistência isolada do ambiente financeiro por usuário
- `auth/users.json`: base de usuários e hashes de senha
- `data/users/`: dados financeiros separados por usuário
- `public/login/`: tela de login
- `public/app/`: sistema financeiro protegido
- `scripts/set-password.js`: atualiza a senha de forma segura

## Como rodar localmente

1. Instale o Node.js 20 ou superior.
2. Abra a pasta do projeto no terminal.
3. Instale as dependências:

```bash
npm install
```

4. Inicie o servidor:

```bash
npm start
```

5. Abra no navegador:

```text
http://localhost:3000
```

## Deploy no Render

1. Envie este projeto para um repositório Git.
2. No Render, crie um novo `Blueprint` ou `Web Service`.
3. Se usar blueprint, o arquivo `render.yaml` já está pronto.
4. Garanta que o serviço use:

```text
Build Command: npm install
Start Command: npm start
```

5. Garanta também estas variáveis:

```text
NODE_ENV=production
FIN_STORAGE_DIR=/var/data/controle-financeiro
FIN_SESSION_SECRET=<uma-chave-longa-e-secreta>
```

6. Monte um disco persistente no Render em `/var/data`.

Observação importante:
- `FIN_STORAGE_DIR` é o local onde ficam `auth/users.json`, `data/users/` e os backups.
- Sem disco persistente, os usuários e dados podem ser perdidos a cada deploy ou reinício.
- No blueprint atual, o `FIN_SESSION_SECRET` já é gerado automaticamente pelo Render com `generateValue: true`.

## Conta inicial

- E-mail: `guisilvaah@gmail.com`
- Senha inicial: `Controle@123`

## Como definir a senha correta

Depois do primeiro acesso, troque a senha executando:

```bash
node scripts/set-password.js --password "SuaSenhaNova"
```

## Observações importantes

- A senha não fica em texto puro no frontend.
- O backend valida a senha contra hash salvo em `auth/users.json`.
- A sessão usa cookie `HttpOnly`.
- Os dados financeiros salvos no backend ficam criptografados.
- O app principal só abre pela rota protegida `/app`.
- Os assets do sistema financeiro são servidos pela rota autenticada `/app-assets`.
- Cada usuário tem um arquivo de dados próprio em `data/users/`.
- O usuário `guilherme` tem acesso especial a `Fechamentos ESO`.
- Novos usuários começam com um ambiente limpo e sem dados do `guilherme`.

## Fluxo de acesso

- Sem login: só a tela `/login` fica acessível
- Com login válido: o sistema abre em `/app`
- Logout: encerra a sessão e volta para `/login`

## Como criar e testar um novo usuário

1. Abra http://localhost:3000/login
2. Clique em `Criar conta`
3. Preencha nome completo, e-mail, telefone, data de nascimento, dica da senha e senha
4. Conclua o cadastro
5. O sistema vai abrir em um ambiente novo e independente
