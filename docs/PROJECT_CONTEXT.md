# PROJECT_CONTEXT — Controle Financeiro (Atualizado em 2026-05-20)

Este documento descreve o estado real do sistema para handoff técnico entre IAs e devs.

## 1) Objetivo do produto
Sistema de gestão financeira pessoal multiusuário, com:
- autenticação por sessão
- isolamento estrito por usuário (dados, backups, integrações, staging)
- gestão mensal de lançamentos (planejamento, gastos, renda, metas)
- patrimônio (contas e movimentações)
- histórico
- internet banking via Pluggy em modo revisão (staging)
- trilha separada para PDF/Oracle AI
- widget iPhone (Scriptable) por token + snapshot seguro

Regra central: nada do Internet Banking entra no financeiro sem ação explícita do usuário.

---

## 2) Workspace canônico
- `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online`

Estrutura principal:
- `server/` backend
- `public/app/` frontend autenticado
- `public/login/` login/cadastro
- `workers/` workers Pluggy/Oracle
- `tests/` suíte automatizada
- `docs/` documentação

Entrypoint:
- `server.js`

---

## 3) Backend e segurança
### 3.1 Segurança HTTP
- Sessão e CSRF em mutações
- Rotas protegidas por auth (exceto endpoints públicos específicos, como widget por token)
- Headers de segurança e validações de payload em rotas críticas

### 3.2 Persistência
- `server/user-store.js`: usuários
- `server/app-state-store.js`: estado financeiro por usuário
- `server/backup-store.js`: backup/restore por usuário
- Dados em `auth/users.json` + `data/users/*`

Características:
- isolamento por `userId`
- controle de revisão/conflito no app-state (409)
- restore com ownership

### 3.3 Mudanças recentes importantes (produção)
1. Isolamento desktop/mobile reforçado
- evitado crossover de assets e shell mobile no desktop.

2. `/app-assets` servido corretamente
- alterado para evitar retorno HTML em CSS/JS (erro MIME `text/html` em stylesheet/script).

3. Service worker/cache legado mobile desativado/limpo
- removida contaminação de cache mobile no desktop.

4. Pluggy connection/preview resilientes
- rotas Pluggy retornam degradado controlado em indisponibilidade de storage ao invés de 500 bruto em alguns cenários transitórios.

---

## 4) Modelo financeiro (frontend)
Tela base: `public/app/index.html` + módulos em `public/app/*.js`.

### 4.1 Mês Atual
- modelo principal com lançamentos unificados (`outflows`)
- suporte a recorrência, parcelamento, compartilhamento e planejamento
- compatibilidade com legado via normalização/migração

### 4.2 Categorias, metas e filtros
- categorias normalizadas por helpers centrais
- metas por categoria (`dailyGoals`)
- filtros por tag/categoria em contextos suportados

### 4.3 Totais
- helpers de cálculo para evitar divergência entre:
  - despesas do mês
  - total de planejamento
  - resultado
- cuidado anti-duplicação em cenários de cartão (fatura vs itens)

### 4.4 Patrimônio
- contas (`patrimonioAccounts`)
- movimentos (`patrimonioMovements`)
- tipos: aporte/retirada/transferência

---

## 5) Pluggy (Internet Banking)
### 5.1 Arquitetura funcional
- Pluggy e Oracle AI são trilhas independentes
- Pluggy alimenta staging/revisão antes de entrar no financeiro

### 5.2 Regras atuais
- dedupe por `pluggyTransactionId` + fallback composto
- memória de categoria/tag por descrição original normalizada
- separação crédito x conta corrente
- ocultação de itens já importados na revisão
- isolamento multiusuário em endpoints, staging e vínculos

### 5.3 Endpoint de webhook
- `https://meufin.duckdns.org/api/pluggy/webhook`

Observação:
- como o dashboard atual da Pluggy não fornece secret no webhook do plano atual, o sistema opera em modo de compatibilidade (sem validação por secret header).

---

## 6) Oracle AI (PDF)
Pipeline separado de Pluggy:
- worker e rotas de processamento assíncrono de documentos/faturas
- sem conciliação obrigatória com transações Pluggy

Arquivos principais:
- `workers/worker_oracle_ai.js`

---

## 7) Mobile — funcionamento completo (estado atual)

### 7.1 Camadas existentes
Há duas camadas históricas:
1. Legado mobile (`mobile-ui`):
- `public/app/modules/mobile/*`
- `public/app/mobile-layout.css`

2. Atual (`mobile-v2`):
- `public/app/mobile-v2.js`
- `public/app/mobile-v2.css`
- `public/app/modules/mobile-v2/*`

Meta atual: `mobile-v2` como experiência principal, sem invadir desktop.

### 7.2 Ativação mobile
`mobile-v2.js` ativa mobile quando:
- viewport <= 900
- dispositivo touch/pointer coarse
- user-agent não desktop-like

Classes de ativação:
- `html.mobile-v2`
- `body.mobile-v2`

Em desktop:
- classes mobile removidas
- shell legado não deve montar header/FAB

### 7.3 Estrutura de navegação mobile
`mobile-v2` monta root com abas/telas:
- Dashboard
- Mês
- Patrimônio
- Histórico
- Calendário (em evolução conforme branch/versão de mobile ativa)

FAB:
- aparece na aba de Mês para adicionar lançamento

### 7.4 Fontes de dados no mobile
- mobile usa a mesma fonte do desktop (`window.data` + helpers globais)
- sem engine financeira paralela
- persistência passa pelo pipeline canônico

### 7.5 Internet Banking no mobile
- abertura por módulo mobile específico (`internet-banking-mobile.js`)
- deve usar pendências reais (mesma base lógica do desktop)
- não reimportar itens marcados/importados
- manter dedupe e isolamento por usuário

### 7.6 Compatibilidade “versão para computador”
- se navegador mobile solicita desktop site, sistema não deve forçar layout mobile
- decisão controlada por heurística de UA desktop-like

### 7.7 Problemas já tratados recentemente
- espaço no topo do desktop causado por shell mobile legado
- crossover desktop/mobile por cache/service worker
- erros MIME por asset servido como HTML

### 7.8 Contrato funcional esperado
1. Mobile e desktop não se sobrepõem visualmente.
2. Dados financeiros são únicos (mesma base).
3. Ações no mobile persistem como no desktop.
4. Internet Banking mobile respeita pendência/importado.
5. Solicitar versão desktop em navegador mobile deve abrir desktop normal.

---

## 8) Widget iPhone (Scriptable)
- token por usuário (`widgetToken`)
- geração/revogação autenticadas
- endpoint público read-only por token
- snapshot por usuário em `data/widget-snapshots/{userId}.json`
- script dinâmico via endpoint `latest`

Rotas:
- `POST /api/widget/generate-token`
- `POST /api/widget/revoke-token`
- `GET /api/widget/token-status`
- `GET /api/widget/finance-summary?token=...`
- `GET /api/widget/script/latest?token=...`

---

## 9) Testes
Comando padrão:
- `npm test`

Cobertura relevante existente inclui:
- auth/sessão
- app-state (roundtrip, conflito, recovery)
- backup/restore
- Pluggy (helpers/rotas/dedupe/multiusuário)
- widget (token/snapshot/endpoint)
- partes críticas de calendário/totais/utilitários

---

## 10) Operação em produção (Oracle VM)
Processos PM2 usuais:
- `financeiro` (web)
- `sync-pluggy`
- `process-pdf-ai`

Fluxo operacional padrão:
- `git pull`
- restart com `pm2 restart ... --update-env`
- `pm2 save`

---

## 11) Convenções obrigatórias para novas mudanças
1. Nunca quebrar isolamento multiusuário.
2. Não introduzir duplicação de lançamento.
3. Não mudar regra financeira sem alinhar helper central de cálculo.
4. Reaproveitar helpers de normalização/dedupe/categoria.
5. Validar testes antes de subir alterações sensíveis.
6. Em mudanças mobile, validar desktop junto (isolamento bidirecional).

---

## 12) Arquivos-chave para onboarding
Backend:
- `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online\server.js`
- `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online\server\http\security.js`
- `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online\server\http\routes\pluggy-preview.js`
- `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online\server\http\routes\pluggy-webhook.js`
- `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online\server\http\routes\widget.js`
- `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online\server\widget-snapshot.js`

Frontend:
- `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online\public\app\index.html`
- `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online\public\app\mes-atual.js`
- `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online\public\app\pluggy-banking.js`
- `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online\public\app\mobile-v2.js`
- `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online\public\app\mobile-v2.css`
- `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online\public\app\mobile-v2-enhancements.js`
- `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online\public\app\modules\mobile\mobile-shell.js`
- `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online\public\app\modules\mobile-v2\*.js`

Workers:
- `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online\workers\worker_pluggy.js`
- `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online\workers\worker_oracle_ai.js`

Tests:
- `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online\tests\*.test.js`

---

## 13) Estado atual resumido
- Core financeiro: estável, com proteção de conflito e isolamento por usuário.
- Pluggy: funcional com revisão manual, dedupe e memória por usuário.
- Mobile: camada `mobile-v2` ativa e em evolução; isolamento com desktop reforçado.
- Widget iPhone: funcional por token/snapshot.
- Segurança: base sólida, com atenção contínua em segredos/env e políticas de webhook.
