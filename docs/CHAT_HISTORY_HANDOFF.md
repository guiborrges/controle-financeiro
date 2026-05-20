# CHAT HISTORY HANDOFF (CONTEXT PACK)

## Purpose
Arquivo de transferência de contexto para novo chat/projeto, com histórico consolidado de decisões, mudanças e estado operacional atual.

## Canonical Workspace
- Pasta principal definida pelo usuário: `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online`
- Houve histórico de duas pastas em paralelo, mas hoje somente `DIretório Online` é canônica para edição/deploy.

## Mandatory Working Rules (from user)
- Não quebrar funcionalidades existentes.
- Preservar dados e histórico dos usuários.
- Manter coerência com arquitetura atual (lançamentos unificados + multiusuário).
- Manter proteção de conflito/revisão (`409`) no app-state.
- Integridade > velocidade.
- Após mudanças: subir para GitHub `main` e atualizar Oracle/PM2.
- “Sempre suba” após correções concluídas.

## High-Level Product Model (evolved)
Sistema de controle financeiro pessoal multiusuário com:
- Mês Atual (planejamento, gastos, renda, metas, recorrência, parcelamento, compartilhamento)
- Patrimônio
- Histórico
- Internet Banking (Pluggy) em staging/revisão manual
- Trilha paralela de PDF/Oracle AI (separada de Pluggy)
- Widget iPhone (Scriptable) baseado em snapshot por token

## Major Milestones Implemented

### 1) Mês Atual e lançamentos unificados
- Evolução do modelo para lançamentos unificados (`outflows`) e compatibilidade com legado.
- Regras de recorrência/parcelamento/compartilhamento ajustadas em várias rodadas.
- Correções de somas e anti-duplicação entre fatura manual e itens de cartão.
- Ajustes de “Despesas do mês”, “Total do planejamento” e “Resultado”.

### 2) Internet Banking / Pluggy
- Fluxo de pré-visualização com revisão manual (sem importação automática).
- Separação cartão de crédito vs conta corrente/patrimônio.
- Vínculo por grupo Pluggy com persistência por usuário.
- Memória de categoria/tag por descrição original da Pluggy.
- Deduplicação por `pluggyTransactionId` e fallback composto.
- Itens já importados marcados para não voltar como pendentes.

### 3) Calendário financeiro
- Refino de modal e interação.
- Inclusão de lançamentos reais do dia (com exclusão de recorrentes conforme regra).
- Ajustes de render, foco e compatibilidade com dados de lançamentos.

### 4) Backup / Restore / Integridade
- Endurecimento de restore por usuário.
- Priorização de “não perder dados financeiros”.
- Proteções de ownership e isolamento em rotas críticas.

### 5) Robustez online (Oracle + PM2)
- Investigação de conflitos (`409`) e manutenção da proteção.
- Operação com `financeiro`, `sync-pluggy`, `process-pdf-ai`.
- Fluxo padrão de atualização: `git pull` + `pm2 restart ... --update-env` + `pm2 save`.

### 6) Mobile V2/V3/V4 (evolutivo)
- Redesenho mobile por módulos (`mobile-v2`) com bottom nav, FAB e telas próprias.
- Ajustes contínuos de UX, filtros, internet banking mobile, lista/ações por toque.
- Correções de compatibilidade para “solicitar versão para computador”.

## Recent Production Fixes (latest)
- Isolamento desktop/mobile para evitar crossover de assets e cache mobile.
- Ajuste em `/app-assets` para evitar retorno HTML em CSS/JS (erros MIME).
- Desativação/limpeza de camada legado de service worker mobile que contaminava desktop.
- Correção de injeção de shell mobile legado em desktop (espaço no topo).
- Rota Pluggy resiliente: `/api/pluggy/connection|preview|transactions` evita `500` em indisponibilidade temporária de storage.

## Known Sensitive Areas (do not break)
- Cálculo financeiro: gastos do mês, planejamento, resultado.
- Anti-duplicação de cartão (fatura vs lançamentos).
- Regras de recorrência/parcelamento (especialmente legado).
- Internet Banking: staging por usuário + dedupe + vínculo.
- Calendário: soma diária por lançamentos reais.
- Backup/restore por usuário.
- App-state com proteção de conflito.

## Operational/Deploy Notes
- Repositório remoto: `https://github.com/guiborrges/controle-financeiro.git`
- Branch operacional: `main`
- Produção Oracle + PM2.
- Durante incidentes de frontend: sempre validar console para diferenciar:
  - erro real do sistema (API 4xx/5xx do domínio)
  - ruído de extensão de navegador/CSP/source map.

## Suggested Startup Checklist for New Chat
1. Confirmar `workdir` canônico (`DIretório Online`).
2. Validar `git status` e commit atual.
3. Ler `docs/PROJECT_CONTEXT.md` + este arquivo.
4. Rodar testes base (`npm test`) quando mudança tocar regra de negócio.
5. Priorizar: bugs de produção -> integridade -> regressões mobile -> refinos visuais.

---

## MOBILE — FUNCIONAMENTO COMPLETO (SEÇÃO PARA IA)

Esta seção é intencionalmente detalhada para outra IA entender o mobile sem ambiguidade.

### A. Arquitetura mobile atual
- Existem duas camadas históricas:
  1. `mobile-ui` (legada): `public/app/modules/mobile/*` + `mobile-layout.css`
  2. `mobile-v2` (atual): `public/app/mobile-v2.js`, `public/app/mobile-v2.css`, `public/app/modules/mobile-v2/*`
- O objetivo atual é usar `mobile-v2` como experiência principal e evitar vazamento da camada legada no desktop.

### B. Ativação/desativação do modo mobile
- A ativação de `mobile-v2` ocorre quando:
  - viewport <= 900
  - dispositivo com toque/pointer coarse
  - user-agent não desktop-like
- `mobile-v2.js` controla classes:
  - `html.mobile-v2`
  - `body.mobile-v2`
- Em desktop, classes mobile devem ser removidas.
- Correção recente importante:
  - shell legado não deve montar header/FAB fora do mobile.

### C. Estrutura de UI mobile-v2
- `mobile-v2.js` monta root:
  - `#mobileV2Root`
  - telas (`dashboard`, `mes`, `patrimonio`, `historico`, `calendario`)
  - mount da bottom nav
  - FAB (`#mobileV2Fab`) visível apenas na aba `mes`
- Módulos principais:
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
  - `internet-banking-mobile.js` (lazy import)

### D. Fonte de dados mobile
- Mobile não mantém uma regra financeira paralela.
- Fonte principal:
  - `window.data`
  - helpers globais (`getCurrentMonth`, `getAllFinanceMonths`, etc.)
- A camada mobile é de apresentação e interação.
- Mutações críticas devem reaproveitar funções globais existentes para salvar/editar/excluir.

### E. Navegação e estado
- `state.currentTab` em `mobile-v2.js` determina tela ativa.
- `setTab` troca aba e chama `render()`.
- Ao entrar em mobile, faz sync da aba com `.page.active` desktop.
- Ao navegar no desktop (`window.nav`), patch em `mobile-v2.js` sincroniza tab quando mobile está ativo.

### F. FAB e adição de lançamento
- FAB no mobile abre `MobileV2AddSheet`.
- Fluxo de adição/edição usa bottom sheets (não modal desktop central).
- Salvar deve cair no mesmo pipeline canônico de persistência.

### G. Internet Banking no mobile
- Abertura via `openInternetBanking` (`mobile-v2.js`) com lazy import de `internet-banking-mobile.js`.
- Deve usar a mesma base de pendências do desktop (sem criar fonte paralela).
- Regras:
  - mostrar pendentes reais do usuário
  - não reimportar o que já foi marcado/importado
  - manter deduplicação e isolamento multiusuário

### H. Cache / PWA / Service Worker
- Houve incidente de crossover desktop/mobile por cache/service worker.
- Estado atual seguro:
  - limpeza de SW legacy mobile no bootstrap da página
  - registro PWA legado mobile desativado no `mobile-v2-enhancements.js`
  - `/app-assets` servido corretamente para não retornar HTML em CSS/JS
- Regra prática:
  - se reaplicar SW no futuro, usar escopo estrito e versionamento explícito.

### I. Compatibilidade “Solicitar versão para computador”
- Em navegador mobile com “Desktop site”, o sistema não deve forçar layout mobile.
- `isDesktopLikeUserAgent()` em `mobile-v2.js` foi usado para evitar ativação indevida.

### J. Erros comuns e diagnóstico
- Sintoma: “desktop em branco”
  - verificar MIME de assets (`text/html` em CSS/JS indica redirect/roteamento incorreto)
  - verificar se SW antigo está interceptando
  - confirmar classes `mobile-ui` / `mobile-v2` indevidas no desktop
- Sintoma: “espaço no topo do desktop”
  - geralmente shell mobile legado montado fora de mobile
- Sintoma: internet banking mobile mostrando itens já lançados
  - revisar marcadores importados e filtro de pendência

### K. Arquivos-chave mobile para onboarding
- `public/app/mobile-v2.js`
- `public/app/mobile-v2.css`
- `public/app/mobile-v2-enhancements.js`
- `public/app/modules/mobile-v2/bottom-nav.js`
- `public/app/modules/mobile-v2/home-screen.js`
- `public/app/modules/mobile-v2/mes-atual-mobile.js`
- `public/app/modules/mobile-v2/internet-banking-mobile.js`
- `public/app/modules/mobile/mobile-shell.js` (legado: manter isolado, não invadir desktop)
- `public/app/mobile-layout.css` (legado)

### L. Contrato funcional esperado (mobile)
1. Entrar em mobile ativa apenas UI mobile.
2. Entrar em desktop remove UI mobile.
3. Dados financeiros são os mesmos do desktop (fonte única).
4. Ações em mobile persistem no mesmo storage do desktop.
5. Internet banking mobile respeita pendência/importado e dedupe.

---

## Notes About Completeness
- Documento consolidado técnico-operacional.
- Não é transcrição literal mensagem-a-mensagem.
- Foco: permitir continuidade sem perda de contexto e sem regressão de regras críticas.
