# Arquitetura do Sistema

Este documento resume a estrutura atual do projeto após a reorganização técnica.

## Backend

### Camada HTTP
- `server.js`
  - ponto de entrada do servidor Express
  - registra middlewares globais e rotas
  - mantém apenas composição de infraestrutura e regras de alto nível

- `server/http/security.js`
  - middlewares e utilitários de segurança HTTP
  - CSRF, rate limit, sessão, cookies de remember-me
  - validações de entrada comuns (e-mail, telefone, data)

- `server/http/month-recovery.js`
  - normalização cronológica de meses
  - recuperação de meses ausentes a partir de backups legados

- `server/http/routes/`
  - `pages.js`: rotas de entrada (`/`, `/login`, `/app`, `/developer`)
  - `auth.js`: login, sessão, cadastro, logout e dica de senha
  - `profile.js`: perfil, senha, exclusão de conta e backup manual
  - `app-state.js`: bootstrap e persistência do estado financeiro
  - `developer.js`: rotas administrativas de auditoria/backups

### Serviços de domínio/persistência
- `server/user-store.js`
  - cadastro de usuários
  - leitura e atualização de perfil

- `server/app-state-store.js`
  - estado financeiro isolado por usuário
  - leitura/escrita de `state.json` por usuário

- `server/backup-store.js`
  - backup manual/automático
  - restauração e logs de integridade

- `server/developer-store.js`
  - autenticação e configuração da área do desenvolvedor

- `server/data-crypto.js` e `server/password.js`
  - criptografia de estado e hash de senha

## Frontend

### Aplicação principal
- `public/app/index.html`
  - shell da aplicação
  - composição das páginas e modais
  - carregamento dos scripts de domínio

- `public/app/modules/category-editor.js`
  - módulo dedicado para edição/mesclagem de categorias
  - cache de leitura para reduzir custo de render

- `public/app/core.js`, `public/app/state.js`, `public/app/storage.js`
  - núcleo de navegação, estado e persistência

- `public/app/mes-atual.js`, `public/app/dashboard.js`, `public/app/patrimonio-clean.js`, `public/app/historico-eso.js`
  - lógica por domínio/página

### Segurança no cliente
- `public/shared/crypto-client.js`
  - suporte à camada de criptografia do estado no cliente

## Dados

- `auth/`
  - metadados de autenticação/sessão

- `data/users/<usuario>/state.json`
  - estado financeiro isolado por usuário

- `data/user-backups/`
  - snapshots de restauração por usuário

- `migration-backups/`
  - trilha de segurança para migrações estruturais

## Diretrizes de manutenção

- Não misturar forma de saída com categoria.
- Não alterar meses passados em regras de recorrência.
- Toda nova regra de cálculo deve ser centralizada e reaproveitável.
- Toda mudança crítica deve manter backup restaurável antes de migração.
- Evitar renders globais quando apenas um submódulo for alterado.

## Workspace Canonico (Atualizacao 2026-04-23)

- Pasta oficial de edicao e deploy: `C:\Users\guisi\OneDrive\Controle Financeiro\DIretorio Online`
- Fonte ativa:
  - backend: `server/`
  - frontend: `public/`
- Arquivos da raiz (app.js, core.js, mes-atual.js, index.html, styles.css e similares) estao neutralizados e nao sao fonte ativa.
- Pastas `render-deploy/` e `render-upload/` sao snapshots auxiliares e nao devem ser usadas como base principal de alteracoes.
