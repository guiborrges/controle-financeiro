# PROJECT_CONTEXT — Controle Financeiro (Atualizado em 2026-05-19)

Este documento descreve o estado **real atual** do sistema para handoff técnico entre IAs e desenvolvedores.

## 1) Escopo e objetivo do produto
O sistema é um gestor financeiro pessoal multiusuário com:
- autenticação por sessão
- isolamento forte por usuário (dados, backups, staging, integrações)
- controle mensal de lançamentos (planejamento, gastos, renda, metas)
- patrimônio (contas e movimentações)
- histórico
- integração de internet banking via Pluggy em fluxo de pré-visualização (staging)
- widget iPhone (Scriptable) com snapshot seguro por token

Não existe importação automática cega para o mês: no internet banking, entrada em dados financeiros depende de ação do usuário (adicionar item/Adicionar todos).

---

## 2) Workspace canônico e estrutura
Caminho canônico de desenvolvimento/deploy:
- `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online`

Principais diretórios:
- `server/` backend modular (HTTP, segurança, stores, integrações)
- `public/app/` frontend principal autenticado
- `public/login/` frontend de login/cadastro
- `workers/` workers independentes (Pluggy e Oracle AI)
- `tests/` suíte Node test runner (`node --test`)
- `docs/` documentação técnica

Entrypoint backend:
- `server.js`

---

## 3) Arquitetura backend
### 3.1 HTTP e segurança
Componentes centrais:
- `server/http/security.js`: sessão, cookies, CSRF, headers, regras de auth
- middlewares de proteção por rota autenticada

Premissas:
- `/app` é protegido por sessão
- assets de app em rota autenticada (`/app-assets`)
- mutações exigem CSRF

### 3.2 Persistência de usuários e estado
- `server/user-store.js`: cadastro/atualização de usuários
- `server/app-state-store.js`: estado financeiro por usuário
- `server/backup-store.js`: backup/restore por usuário
- `auth/users.json` + `data/users/` (ou diretório definido por env)

Características:
- estado isolado por `userId`
- controles de revisão/concorrência em `app-state`
- cobertura de restore completo sem merge residual

### 3.3 Rotas relevantes
- Auth/sessão (login, logout, sessão atual)
- App-state (read/write, revisão, recovery)
- Backup (criar/listar/restaurar com ownership)
- Pluggy preview/import/webhook
- Widget (token/status/snapshot/script)

---

## 4) Modelo funcional do domínio financeiro (frontend)
Tela principal: `public/app/index.html` + módulos JS em `public/app/`.

### 4.1 Mês Atual
Base moderna de lançamentos unificados (`outflows`) com flags para:
- recorrência
- parcelamento
- compartilhamento
- inclusão no planejamento

Há compatibilidade com legado (normalização/migração) no carregamento.

### 4.2 Categorias e metas
- categorias normalizadas por helper central (`resolveCategoryName` e helpers correlatos)
- metas por categoria em `dailyGoals`
- cálculos e exibição reconciliados para reduzir divergências

### 4.3 Totais
O sistema usa helpers de totais para:
- despesas do mês
- total de planejamento
- impacto de compartilhamento (parte efetiva do dono)
- prevenção de duplicação entre fatura e lançamentos de cartão

### 4.4 Patrimônio
- contas patrimoniais (`patrimonioAccounts`)
- movimentações (`patrimonioMovements`)
- tipos de movimento (aporte, retirada, transferência)

---

## 5) Integração Pluggy (Internet Banking)
### 5.1 Conceito operacional
A integração Pluggy é separada da trilha de PDF/Oracle AI.

Pluggy alimenta staging/preview para revisão manual antes da entrada no financeiro.

### 5.2 Fluxos
- sincronização de itens/transações via worker + webhook
- persistência por usuário/tenant
- modal/tela “Internet banking (pré-visualização)” para revisão
- ações por item e em lote (Adicionar/Adicionar todos)

### 5.3 Regras críticas implementadas
- deduplicação por `pluggyTransactionId` e fallback composto
- memória de categoria/tag por descrição original normalizada
- separação conta corrente x cartão
- ocultação de itens já importados (status e marcadores)
- filtros para não exibir entradas técnicas (ex.: saldo sincronizado)
- isolamento multiusuário nos endpoints e no staging

### 5.4 Webhook
Endpoint usado na Pluggy:
- `https://meufin.duckdns.org/api/pluggy/webhook`

Observação importante:
- o sistema suporta modo estrito com secret e modo de compatibilidade sem header secret (conforme configuração)

---

## 6) Trilha Oracle AI (PDF)
Existe pipeline paralela para PDF/faturas em worker próprio, sem conciliação obrigatória com Pluggy.

Arquitetura independente:
- `workers/worker_oracle_ai.js`
- jobs/rotas de upload/status/import para processamento assíncrono

A operação recente do produto prioriza Pluggy para internet banking e mantém trilha de PDF separada.

---

## 7) Mobile V2/V3 (estado atual)
O app mobile usa detecção por viewport/touch e ativa shell dedicado (`mobile-v2`).

Arquivos principais:
- `public/app/mobile-v2.js`
- `public/app/mobile-v2.css`
- `public/app/modules/mobile-v2/*`

Navegação mobile atual:
- bottom nav com 4 abas: Início, Mês, Patrimônio, Histórico
- FAB central para adicionar na aba Mês

Refinamentos V3 já aplicados:
- Home com dashboard consolidado (hero + mini-cards + categorias + metas + recentes)
- Mês com abas: Planejamento, Gastos e Metas, Todos, Renda
- lista simplificada no mobile (menos ruído visual; delete por swipe)
- fluxo de adição redesenhado em bottom sheets por tipo
- patrimônio mobile integrado com fontes reais e refresh por eventos
- ajustes de contraste/dark mode

Compatibilidade:
- versão desktop deve aparecer quando navegador mobile solicita “versão para computador” (UA desktop-like)

---

## 8) Widget iPhone (Scriptable)
### 8.1 Segurança e token
- token por usuário (`widgetToken`) salvo no user store
- geração/revogação via rotas autenticadas
- endpoint público de leitura por token (somente snapshot)

### 8.2 Snapshot
- snapshot em `data/widget-snapshots/{userId}.json`
- atualizado quando estado principal é salvo
- contém somente dados necessários do widget (sem segredos)

### 8.3 Rotas widget
- `POST /api/widget/generate-token`
- `POST /api/widget/revoke-token`
- `GET /api/widget/token-status`
- `GET /api/widget/finance-summary?token=...`
- `GET /api/widget/script/latest?token=...`

---

## 9) Segurança (estado prático)
Fortalezas atuais:
- autenticação por sessão + CSRF em mutações
- isolamento multiusuário amplamente testado
- backup/restore com ownership estrito
- validações de payload em rotas críticas
- proteção contra acessos cruzados em pluggy preview/staging

Pontos de atenção operacionais:
- variáveis sensíveis devem ficar somente em `.env`/secrets do host
- webhook Pluggy deve seguir modo configurado (compatibilidade sem secret ou estrito com secret)
- manter política de rotação/revogação de tokens de widget

---

## 10) Testes automatizados
Comando padrão:
- `npm test` (`node --test tests/*.test.js`)

Estado recente validado:
- suíte ampla passando (142 testes / 0 falhas no último ciclo)

Coberturas relevantes:
- auth/sessão
- app-state (roundtrip, conflito, recuperação)
- backup (isolamento e restore)
- importação (CSV/PDF)
- Pluggy (helpers, rotas, dedupe, multiusuário, webhook)
- calendário/totais/compartilhamento
- widget token/snapshot/endpoints
- regressões de utilitários centrais

---

## 11) Operação em VM (produção)
Ambiente com PM2 usando processo principal e workers separados.

Processos usuais:
- `financeiro` (web app)
- `sync-pluggy` (worker Pluggy)
- `process-pdf-ai` (worker Oracle AI)

Fluxo padrão de deploy já utilizado:
- `git pull`
- restart PM2 com update env
- `pm2 save`

---

## 12) Convenções importantes para futuras mudanças
1. Não quebrar isolamento multiusuário.
2. Não introduzir duplicação de lançamentos entre fontes.
3. Não alterar regra financeira sem alinhar helper único de totais.
4. Reaproveitar helpers centrais (categoria, datas, compartilhado, dedupe).
5. Rodar `npm test` em toda mudança de fluxo financeiro/internet banking/mobile.
6. Em mobile, priorizar UX de lista e ações por toque/swipe sem regressão desktop.

---

## 13) Arquivos-chave para onboarding rápido
Backend:
- `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online\server.js`
- `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online\server\http\security.js`
- `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online\server\http\routes\pluggy-*.js`
- `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online\server\http\routes\widget.js`
- `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online\server\widget-snapshot.js`

Frontend:
- `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online\public\app\index.html`
- `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online\public\app\mes-atual.js`
- `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online\public\app\pluggy-banking.js`
- `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online\public\app\mobile-v2.js`
- `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online\public\app\mobile-v2.css`
- `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online\public\app\modules\mobile-v2\*.js`

Workers:
- `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online\workers\worker_pluggy.js`
- `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online\workers\worker_oracle_ai.js`

Tests:
- `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online\tests\*.test.js`

---

## 14) Estado de maturidade atual (resumo executivo)
- Core financeiro: estável e com regressões cobertas por testes.
- Internet banking Pluggy: funcional com staging, memória, dedupe e isolamento por usuário.
- Mobile V3: refinado e funcional, com nova UX de dashboard/mês/adicionar.
- Widget iPhone: funcional com segurança por token e snapshot dedicado.
- Segurança: boa base (sessão/CSRF/isolamento), com atenção contínua em segredos e configuração de webhook.
