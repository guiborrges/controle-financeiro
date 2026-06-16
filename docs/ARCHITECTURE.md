# ARCHITECTURE — Controle Financeiro

Atualizado em 2026-06-16.

Este documento resume a arquitetura atual do sistema, com foco em responsabilidades, fontes de dados e limites entre backend, desktop, mobile e integrações.

## 1. Visão geral

O sistema é uma aplicação web multiusuário composta por:

- servidor Node.js/Express
- frontend desktop em módulos JavaScript
- camada mobile-v2 sobre a mesma aplicação
- stores locais/servidor para usuários, app-state e backups
- integrações separadas com Pluggy e Oracle/PDF

Arquitetura-alvo:

- uma verdade de dados
- múltiplas apresentações
- regras financeiras centralizadas

## 2. Camadas do backend

## 2.1 Entrada HTTP

Arquivo principal:

- `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online\server.js`

Responsabilidades:

- subir o servidor
- registrar middlewares
- configurar segurança
- servir páginas e assets
- injetar dependências nas rotas

## 2.2 Segurança e sessão

Arquivo principal:

- `server/http/security.js`

Responsabilidades:

- sessão
- remember-me
- cookies
- CSRF
- validações compartilhadas
- rate limiting

## 2.3 Rotas

As rotas ficam em `server/http/routes/`.

Principais grupos:

- páginas
- autenticação
- perfil
- estado do app
- área do desenvolvedor
- widget
- Pluggy preview/webhook
- importação de fatura/PDF/AI

## 2.4 Persistência

Serviços/stores principais:

- `server/user-store.js`
- `server/app-state-store.js`
- `server/backup-store.js`
- `server/developer-store.js`

Camadas auxiliares:

- `server/data-crypto.js`
- `server/password.js`

## 3. Estado financeiro

## 3.1 Fonte central

O núcleo do sistema é o app-state por usuário.

Ele concentra:

- meses
- patrimônio
- cartões
- categorias
- tags
- metas
- preferências
- marcações auxiliares do produto

## 3.2 Estratégia atual

O sistema já sofreu evolução para reduzir gargalo de um estado totalmente monolítico.

Direção atual:

- manter compatibilidade com dados antigos
- suportar bundles/partições
- evitar leitura/gravação custosa demais
- preservar restore e integridade

## 3.3 Regra arquitetural

Qualquer cálculo importante deve nascer de helper central e não de uma tela específica.

Exemplos de áreas que não podem divergir:

- total do mês
- planejamento
- gasto por categoria
- calendário
- patrimônio
- pendências do Internet Banking

## 4. Frontend desktop

## 4.1 Shell

Arquivo principal:

- `public/app/index.html`

Ele compõe:

- páginas
- modais
- assets
- scripts do desktop
- bootstrap da camada mobile-v2 quando aplicável

## 4.2 Núcleo

Arquivos centrais:

- `public/app/core.js`
- `public/app/state.js`
- `public/app/storage.js`

Responsabilidades:

- navegação
- bootstrap
- estado global em memória
- persistência no cliente
- eventos compartilhados

## 4.3 Domínios principais

Arquivos importantes:

- `public/app/dashboard.js`
- `public/app/mes-atual.js`
- `public/app/patrimonio-clean.js`
- `public/app/historico-eso.js`
- `public/app/pluggy-banking.js`

## 5. Frontend mobile-v2

## 5.1 Arquitetura da shell mobile

Arquivos base:

- `public/app/mobile-v2.js`
- `public/app/mobile-v2.css`
- `public/app/mobile-v2-enhancements.js`

O mobile-v2 não é um app separado. É uma camada de apresentação mobile sobre o mesmo sistema.

## 5.2 Módulos mobile

Pasta:

- `public/app/modules/mobile-v2/`

Módulos principais:

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
- `data-bridge.js`

## 5.3 Regra de arquitetura mobile

O mobile deve:

- consumir o mesmo estado
- reutilizar os mesmos helpers do desktop sempre que possível
- divergir só em render, navegação e UX

O mobile não deve:

- recalcular totais de forma própria
- manter lista paralela de pendências do banco
- exibir categorias/planejamento por outra lógica

## 6. Busca universal

Arquivos:

- `public/app/modules/universal-search.js`
- `public/app/modules/universal-search.css`

Papel arquitetural:

- montar índice pesquisável sobre múltiplos tipos de item
- unificar consulta por texto, período, categoria, tag, cartão e meio
- servir desktop e, progressivamente, mobile

## 7. Pluggy / Internet Banking

## 7.1 Backend

Rotas principais:

- `server/http/routes/pluggy-preview.js`
- `server/http/routes/pluggy-webhook.js`

Papel:

- receber staging bruto
- consultar conexão
- expor preview e transações ao frontend
- persistir sem quebrar multiusuário

## 7.2 Frontend desktop

Arquivo:

- `public/app/pluggy-banking.js`

Esse módulo é a referência de comportamento do Internet Banking.

Responsabilidades:

- agrupar por conta/cartão
- filtrar itens pendentes
- registrar importados e ignorados
- renderizar revisão
- aplicar memória de categoria/tag
- expor snapshot móvel quando necessário

## 7.3 Fonte única entre PC e mobile

O caminho desejado e já parcialmente implementado é:

1. Pluggy desktop monta estado canônico do usuário
2. importados/ignorados são persistidos no app-state do usuário
3. mobile consome snapshot derivado da mesma base

Isso evita:

- reaparecimento de item já importado
- reaparecimento de item ignorado
- diferença de lista entre PC e celular

## 8. Patrimônio

Desktop e mobile compartilham o mesmo domínio patrimonial.

Entidades principais:

- contas/ativos
- movimentações
- saldo atual
- transferências
- cartões ligados ao ecossistema do usuário

Regras importantes:

- atualizar saldo deve gerar diferença coerente como aporte ou retirada
- conta e cartão não podem se misturar como categoria

## 9. Backups e retenção

Camada principal:

- `server/backup-store.js`

Direção atual:

- retenção limitada de backups recentes por usuário
- retenção mensal histórica limitada
- evitar explosão de backups automáticos

Backups são parte da arquitetura, não apenas um extra.

## 10. Widget iPhone

Arquivos:

- `server/http/routes/widget.js`
- `server/widget-snapshot.js`
- `server/widget-script-template.js`

Arquitetura:

- token individual
- snapshot seguro por usuário
- endpoint público só por token
- geração de script no frontend

## 11. Branding e UI system

O sistema vem migrando para uma camada visual mais consistente com:

- ícones SVG centralizados
- logo própria
- favicon/app icon
- componentes reutilizáveis entre desktop e mobile

## 12. Testes e manutenção

Pasta:

- `tests/`

Áreas que exigem testes sempre que sofrerem mudança:

- auth
- app-state
- Pluggy
- patrimônio
- backup
- widget
- cálculos compartilhados entre PC e mobile

## 13. Decisões arquiteturais atuais

### 13.1 O desktop ainda é referência funcional

O mobile-v2 está avançado, mas o desktop segue como referência principal quando há divergência de comportamento.

### 13.2 A mesma fonte deve alimentar as duas superfícies

Quando existir diferença entre PC e mobile, a correção deve preferir:

- unificar helper
- unificar snapshot
- remover cálculo paralelo

### 13.3 Integrações não podem tomar controle do domínio

Pluggy, PDF e Oracle AI são integrações úteis, mas a lógica financeira final continua pertencendo ao sistema.

### 13.4 Compatibilidade com legado é obrigatória

Mudanças estruturais precisam continuar lendo:

- meses antigos
- backups antigos
- marcações antigas
- estados híbridos durante migração

## 14. Workspace canônico

Pasta oficial de edição e deploy:

- `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online`

Snapshots e diretórios auxiliares não devem ser tratados como fonte principal de mudança sem confirmação explícita.
