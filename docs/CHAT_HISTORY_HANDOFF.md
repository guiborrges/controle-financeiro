# CHAT HISTORY HANDOFF (CONTEXT PACK)

## Purpose
Arquivo de transferência de contexto para novo chat/projeto, com histórico consolidado das decisões, mudanças e estado atual.

## Canonical Workspace
- **Pasta principal definida pelo usuário**: `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online`
- Durante parte do histórico houve duas pastas em paralelo (`Controle Financeiro` e `DIretório Online`).
- Foi definido que **somente `DIretório Online`** deve ser usada para edição/subida.

## Mandatory Working Rules (from user)
- Não quebrar funcionalidades existentes.
- Preservar dados e histórico dos usuários.
- Manter coerência com arquitetura nova.
- Manter proteção de conflito/revisão (`409`) ativa.
- Integridade > velocidade.
- Após mudanças: subir para GitHub (`main`) e manter Oracle atualizado.

## High-Level Product Model (evolved)
- Evolução de UX/fluxos do mês atual, modais e recorrência.
- Forte foco em:
  - `Compromissos do mês` (Resumo / Gastos / Todos)
  - modal de adição avançado
  - separação clara entre criação x edição
  - importação por fatura com revisão obrigatória
  - calendário financeiro com painel e gráfico
  - robustez online (Oracle + SQLite + PM2 + multi-aba)

## Major Feature/Rule Milestones Implemented During Chat

### 1) Modal de adicionar gasto/despesa
- Painel persistente e foco em lançamentos em sequência.
- Botão principal e textos ajustados.
- Lista inferior para **copiar** lançamentos do mês (não editar o original).
- Vários ajustes de ordenação/listagem.
- Adição de comportamento de rascunho.
- Ajustes de layout e interações.

### 2) Categorias/Tags
- Consolidação de categorias com emoji.
- Edição de categorias/tags com melhorias de visual e largura de modal.
- Tooltips para nomes longos.
- Correções de UX no editor.

### 3) Recorrência e passado/futuro
- Regra geral reforçada: passado não propaga para futuro, com exceções definidas.
- Ajustes para cartões/recorrência em múltiplos cenários.
- Correções de propagação e de efeitos colaterais.

### 4) Cartões e somatórias
- Correções de duplicidade entre fatura x lançamentos.
- Ajustes de previsão futura e prevalência de valor manual.
- Várias correções de bugs no resumo/cartões após regressões.

### 5) Importação por fatura (IA)
- Fluxo completo implementado:
  - gerar contexto para IA
  - receber JSON estruturado
  - validar schema/semântica
  - revisão obrigatória antes de importar
  - deduplicação e status por item
- Regras críticas:
  - IA não cria categoria nova
  - tags iniciam vazias
  - ignorar ressarcimentos na importação de gastos
- Correções específicas:
  - parser de datas (incluindo formatos variantes)
  - inferência de mês/cartão
  - dropdowns de cartão/tag na revisão
  - import final usando estado canônico editado na revisão

### 6) Calendário financeiro
- Modal e layout estruturado em blocos:
  - calendário base
  - painel lateral
  - gráfico inferior
- Correções de z-index, acoplamento e scroll.
- Regras de abertura/fechamento, clique em dia e foco em evento.
- Eventos com edição/exclusão e integração com tags.
- Problemas de linha de evento e render foram iterados diversas vezes.

### 7) Mobile (iPhone/Safari)
- Rodadas de responsividade e UX mobile.
- Necessidade de modo mobile mais robusto foi recorrente.
- Implementado reforço de mobile runtime em rodada recente:
  - classe mobile por viewport + touch
  - ajustes de sidebar compacta, modais, listas/tabelas e calendário.

### 8) Robustez online / Oracle
- Erro crítico investigado: conflitos `409` em `/api/app-state`.
- Manutenção da proteção de conflito (sem remover `409`).
- Melhorias de serialização/fluxo de save e logs diagnósticos.
- Diretriz operacional reforçada: SQLite com instância única.

### 9) Backup e restauração
- Diversas solicitações de endurecimento:
  - restore confiável por usuário
  - prevenção de vazamento cross-user
  - retenção e segurança operacional
- Política de “não perder backup” foi prioridade do usuário.

### 10) Refatoração/fatiamento de `mes-atual.js`
- Fatiamento parcial em módulos ocorreu ao longo das rodadas.
- Porém `mes-atual.js` ainda permanece como orquestrador com blocos críticos.
- Diretório de módulos existente: `public/app/modules/mes-atual/`
  - `outflows.js`
  - `shared-expense.js`
  - `card-bill.js`
  - `month-totals.js`
  - `outflow-filters.js`
  - outros módulos auxiliares

## Recent Fixes (latest phase)
- Correção de crash em produção:
  - `notificationsPopoverOpen is not defined`
  - resolvido em `public/app/interactions.js` com checagem DOM-safe.
- Ajustes no modal unificado:
  - toggles alinhados horizontalmente.
- Atualização da lógica de despesa:
  - labels dinâmicos (gasto x despesa)
  - data de despesa aceita:
    - dia simples (aplica próximo mês)
    - data completa (respeita mês/ano)
  - continuidade de parcelamento/recorrência com base na primeira data real.
- Correção para todos os usuários selecionarem `despesa` no modal:
  - removido forçamento indevido para `gasto` ao detectar cartão.
  - tipo permanece `despesa`; saída é ajustada para método compatível quando necessário.

## Known Sensitive Areas (do not break)
- Cálculo de Resumo (`Compromissos`) e deduplicação cartão/fatura.
- Regras de recorrência e propagação (passado/futuro).
- Importação por fatura: estado canônico da revisão precisa ser o estado importado.
- Calendário: layout dos 3 blocos + dados por mês/data.
- Mobile: tabelas/listas e modais em iPhone Safari.
- Multiusuário: ownership, backup/restore, app-state.

## Operational/Deploy Notes
- Repositório remoto: `https://github.com/guiborrges/controle-financeiro.git`
- Branch usada: `main`
- Ambiente Oracle em produção.
- Recomendação arquitetural já adotada em contexto: SQLite com processo único (`pm2 -i 1`), evitando cluster sobre mesmo arquivo.

## Suggested Startup Checklist for New Chat
1. Confirmar `workdir` em `DIretório Online`.
2. Validar `git status`, `git rev-parse HEAD`, `git rev-parse origin/main`.
3. Ler:
   - `docs/PROJECT_CONTEXT.md`
   - este arquivo (`docs/CHAT_HISTORY_HANDOFF.md`)
4. Rodar testes base:
   - `npm.cmd test -- --runInBand`
5. Atacar pendências por prioridade:
   - bugs de produção
   - integridade de dados
   - regressões mobile
   - depois refinamentos visuais.

## Notes About Completeness
- Este arquivo consolida o histórico técnico e decisões.
- Não é transcrição literal mensagem-a-mensagem.
- Serve como contexto operacional para continuidade sem perda de direção.
