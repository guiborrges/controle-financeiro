# PROJECT_CONTEXT — Controle Financeiro

Atualizado em 2026-06-16.

Este documento descreve o estado real do produto e do código para handoff entre IAs e devs. Ele deve refletir o sistema online, não planos antigos.

## 1. O que é o produto

Controle Financeiro é um sistema web multiusuário de gestão financeira pessoal, com foco em:

- controle mensal de lançamentos
- leitura rápida de renda, despesas, resultado e planejamento
- patrimônio por conta/ativo
- histórico longitudinal
- importação revisada de Internet Banking via Pluggy
- experiência desktop completa
- experiência mobile-v2 dedicada

O posicionamento atual não é de "super app bancário". O núcleo do produto continua sendo:

- planejamento manual inteligente
- patrimônio conectado ao mês
- clareza visual e operacional

Regra central:

- nada do Internet Banking entra no financeiro sem ação explícita do usuário

## 2. Princípios de produto e regras de negócio

### 2.1 Multiusuário

O isolamento por usuário é regra estrutural:

- estado financeiro separado por `userId`
- backups separados por `userId`
- memória do Internet Banking separada por `userId`
- staging Pluggy separado por `tenant_user_id`
- widget iPhone separado por token individual

Nunca é aceitável vazar:

- lançamentos
- tags
- categorias
- vínculos bancários
- backups
- tokens

### 2.2 Modelo financeiro atual

O sistema caminha para um modelo unificado de `lançamentos`.

Na prática hoje:

- saídas mensais são tratadas como `outflows`
- renda continua separada em fluxos próprios
- recorrência, parcelamento, compartilhamento e planejamento são flags/comportamentos sobre lançamentos
- cartão exige tratamento especial para não duplicar fatura e subitens

Não reintroduzir a separação antiga como regra paralela de domínio se já existir helper unificado.

### 2.3 Cartão de crédito

Cartão é uma entidade própria do sistema e não uma categoria.

Regras importantes:

- valor de fatura pode ser manual/autoritativo
- valor de fatura também pode ser derivado pelos lançamentos vencidos do cartão
- a configuração de "fatura automática por lançamentos" passou a respeitar corte temporal por mês
- mudanças futuras não devem reescrever meses passados automaticamente

### 2.4 Internet Banking / Pluggy

O PC é a referência funcional principal do Internet Banking.

Regras obrigatórias:

- itens já importados não podem reaparecer como pendentes
- itens ignorados não podem reaparecer como pendentes
- mobile deve usar a mesma fonte de dados e o mesmo filtro do desktop
- descrição original Pluggy é a base da memória de categoria/tag
- o usuário sempre revisa antes de importar

## 3. Estrutura canônica do workspace

Workspace oficial:

- `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online`

Fontes principais:

- backend: `server/`
- frontend autenticado: `public/app/`
- login/cadastro: `public/login/`
- testes: `tests/`
- documentação: `docs/`

Entrypoint do servidor:

- `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online\server.js`

## 4. Backend

## 4.1 Servidor HTTP

O backend é Express e a composição principal acontece em `server.js`.

Responsabilidades:

- middlewares globais
- sessão
- CSRF
- autenticação
- montagem das rotas
- assets do app
- integração com stores e helpers

### 4.2 Segurança

Camada principal:

- `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online\server\http\security.js`

Responsabilidades:

- sessão
- cookies
- remember-me
- CSRF
- validações comuns
- políticas HTTP
- rate limiting

### 4.3 Rotas principais

Em `server/http/routes/` ficam as rotas centrais do sistema, incluindo:

- `auth.js`
- `pages.js`
- `app-state.js`
- `profile.js`
- `developer.js`
- `widget.js`
- `pluggy-preview.js`
- `pluggy-webhook.js`
- `bill-import-ai.js`

### 4.4 Persistência e stores

Arquivos principais:

- `server/user-store.js`
- `server/app-state-store.js`
- `server/backup-store.js`
- `server/developer-store.js`
- `server/data-crypto.js`
- `server/password.js`

Responsabilidades:

- usuários
- estado financeiro
- backups
- credenciais e criptografia
- chaves de sessão e recuperação

## 5. Estado financeiro

### 5.1 Fonte oficial

A fonte oficial do financeiro é o app-state persistido por usuário.

Hoje o sistema já passou por trabalho de performance para sair de um único arquivo grande para bundles/partições de estado.

Consequências práticas:

- o sistema não deve depender de uma única leitura monolítica sempre que possível
- leitura e escrita precisam continuar compatíveis com o estado já salvo dos usuários
- qualquer otimização nova deve preservar integridade e restore

### 5.2 Regras de persistência

- app-state pertence ao usuário autenticado
- mudanças críticas precisam continuar restauráveis por backup
- bootstrap do app precisa montar exatamente o mesmo estado no PC e no mobile

## 6. Backups

O sistema mantém backup restaurável por usuário.

Direção atual:

- reduzir backup automático excessivo
- preservar no máximo 50 backups recentes por usuário
- preservar retenção mensal de fechamento com no máximo 12 âncoras mensais
- não criar tempestade de backup a cada pequena atualização

Fluxos relevantes:

- backup manual
- backup em saída/fechamento conforme regras atuais
- restore com ownership

## 7. Frontend desktop

Shell principal:

- `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online\public\app\index.html`

Núcleo:

- `public/app/core.js`
- `public/app/state.js`
- `public/app/storage.js`
- `public/app/styles.css`
- `public/app/dark-mode.css`

Páginas/módulos importantes:

- `public/app/dashboard.js`
- `public/app/mes-atual.js`
- `public/app/patrimonio-clean.js`
- `public/app/historico-eso.js`
- `public/app/pluggy-banking.js`
- `public/app/preferences.js`

## 8. Mobile-v2

### 8.1 Situação atual

O mobile atual não é mais o mobile legado baseado só em CSS comprimido. A experiência ativa é `mobile-v2`, com runtime e módulos próprios.

Arquivos base:

- `public/app/mobile-v2.js`
- `public/app/mobile-v2.css`
- `public/app/mobile-v2-enhancements.js`
- `public/app/modules/mobile-v2/data-bridge.js`

Módulos atuais:

- `bottom-nav.js`
- `home-screen.js`
- `mes-atual-mobile.js`
- `patrimonio-mobile.js`
- `historico-mobile.js`
- `perfil-mobile.js`
- `add-sheet.js`
- `outflow-form-mobile.js`
- `filters-sheet.js`
- `calendario-mobile.js`
- `internet-banking-mobile.js`
- `date-picker-mobile.js`

### 8.2 Regra de ouro do mobile

O mobile não pode ter cálculo financeiro próprio divergente do desktop.

Objetivo arquitetural atual:

- mesma fonte de dados
- mesmos helpers centrais
- render diferente
- lógica de negócio igual

### 8.3 Ativação

`mobile-v2.js` ativa a camada mobile quando o ambiente é touch/mobile e não está em modo desktop solicitado.

Ele controla classes como:

- `html.mobile-v2`
- `body.mobile-v2`

Também existe cuidado específico para evitar que layout desktop e mobile apareçam juntos ou "pisquem" um sobre o outro.

### 8.4 Navegação mobile

A shell mobile atual usa bottom nav com:

- Dashboard
- Mês
- Patrimônio
- Histórico
- Calendário

O botão vermelho `+` no mês usa FAB expandido para ações:

- `Lançamentos`
- `Cartão de Crédito`
- `Renda`

### 8.5 Adição no mobile

Dentro de `Adicionar lançamento`, o fluxo atual foi refinado para:

- Gasto
- Gasto Recorrente
- Gasto Parcelado
- Gasto Compartilhado

O Internet Banking deixou de ser item de lista e passou para um botão pequeno ao lado do título do modal.

### 8.6 Estado de paridade

O mobile ainda está em evolução, mas a meta atual é:

- puxar tudo da mesma base do PC
- reduzir diferenças de totalização
- reduzir telas simplificadas com dado incompleto

## 9. Internet Banking / Pluggy

### 9.1 Visão geral

Há duas trilhas independentes no sistema:

- Pluggy / Internet Banking
- PDF / Oracle AI

Pluggy serve para revisão de lançamentos bancários/cartão antes da entrada manual no financeiro.

### 9.2 Backend Pluggy

Rotas principais:

- `server/http/routes/pluggy-preview.js`
- `server/http/routes/pluggy-webhook.js`

O sistema já trabalha com:

- preview
- connection status
- transactions
- webhook
- persistência em staging
- resiliência para indisponibilidade transitória

### 9.3 Frontend Pluggy desktop

Módulo principal:

- `public/app/pluggy-banking.js`

Responsabilidades:

- carregar grupos por conta/cartão
- deduplicar
- ocultar itens importados/ignorados
- persistir memória por usuário
- renderizar revisão do desktop

### 9.4 Frontend Pluggy mobile

Módulo principal:

- `public/app/modules/mobile-v2/internet-banking-mobile.js`

Regra arquitetural:

- o mobile não inventa uma segunda lista
- ele precisa derivar o snapshot móvel a partir da mesma base canônica do desktop

### 9.5 Dedupe e memória

O sistema já possui estrutura para marcar:

- `importedTxIds`
- `importedTxKeys`
- `ignoredTxIds`
- `ignoredTxKeys`

Além disso:

- descrição original Pluggy normalizada é usada para memória de categoria/tag
- estado canônico é combinado com cache local de compatibilidade quando necessário

Objetivo:

- importado uma vez = não reaparece
- ignorado uma vez = não reaparece
- PC e mobile mostram o mesmo conjunto pendente

## 10. Widget para iPhone

O projeto possui widget para Scriptable/iPhone com snapshot seguro por usuário.

Arquivos principais:

- `server/http/routes/widget.js`
- `server/widget-snapshot.js`
- `server/widget-script-template.js`
- `public/app/preferences.js`

Fluxo:

- token individual por usuário
- snapshot seguro em `data/widget-snapshots/`
- endpoint público só por token
- preferência no frontend para gerar/copiar/revogar

## 11. Busca universal

O sistema possui buscador universal e há esforço recente para deixá-lo utilizável também no mobile.

Arquivos relevantes:

- `public/app/modules/universal-search.js`
- `public/app/modules/universal-search.css`

Direção atual:

- indexação unificada
- filtros consistentes
- somatórias coerentes com o restante do sistema
- experiência mobile inspirada em Spotlight

## 12. Fechamentos ESO

Existe um módulo de Fechamentos ESO disponível apenas no contexto permitido pelo sistema.

Ele deve continuar:

- isolado
- sem impactar usuários comuns
- funcional sem vazar regras para outros módulos

## 13. Branding e UI

O produto hoje já possui uma identidade visual própria com:

- logo circular minimalista
- favicon/app icon atualizados
- aplicação progressiva em login, topo do sistema e símbolos do app
- biblioteca crescente de ícones SVG

Objetivo de interface:

- elegante
- clara
- sem aparência genérica
- consistente entre desktop e mobile-v2

## 14. Testes

A suíte `tests/` cobre parte importante do sistema, incluindo:

- Pluggy helpers
- preview/webhook Pluggy
- importação de faturas
- reconciliação de cartão
- widget
- rotas e stores críticas

Sempre que mexer em:

- auth
- app-state
- Pluggy
- cálculos financeiros
- patrimônio
- mobile que dependa de helper do desktop

devem ser executados testes relevantes e, quando a área for ampla, `npm test`.

## 15. Riscos e sensibilidades atuais

Áreas mais sensíveis do sistema hoje:

- bootstrap e leitura do app-state
- compatibilidade entre estado legado e estado particionado
- não duplicação entre cartão e lançamentos
- paridade PC/mobile
- memória e dedupe do Internet Banking
- retenção e limpeza correta de backups
- telas híbridas onde desktop e mobile-v2 ainda coexistem

## 16. Regra para qualquer mudança futura

Antes de introduzir lógica nova, validar:

1. já existe helper central?
2. PC e mobile vão usar a mesma fonte?
3. isso altera mês passado sem querer?
4. isso pode duplicar cartão/fatura/lançamento?
5. isso quebra multiusuário?
6. isso reapresenta item Pluggy já importado ou ignorado?

Se a resposta for "sim" para qualquer risco acima, a mudança precisa ser redesenhada antes de entrar.
