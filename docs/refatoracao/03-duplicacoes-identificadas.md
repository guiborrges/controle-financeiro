# Duplicacoes e contratos a consolidar

Atualizacao 3B: regras de categorias/tags mensais, nomes escalares, prefixos
antigos e simbolos extraidos para MonthSelectionCatalog. Fachadas mantidas.
Sem cache persistente ou mudanca nas listas oferecidas. Detalhes no documento 13.

Atualizacao 3A: a precedencia de fatura foi extraida para OutflowAmounts;
FinancialQuery e MesAtualCards mantem suas fachadas e politicas anteriores para
NaN. Contratos de exibicao monetaria foram caracterizados, nao unificados onde
ha diferencas intencionais de sinal. Detalhes no documento 12.

Nomes iguais nao provam duplicacao. A busca de declaracoes foi usada apenas
para selecionar candidatos; os casos abaixo foram comparados por responsabilidade.

## Duplicacoes reais ou riscos de divergencia

| Area | Evidencias | Situacao e tratamento proposto |
|---|---|---|
| Fatura efetiva | `shared/financial-query.js:13` e `mes-atual/cards.js:26` | Mesma precedencia: manual inclusive zero; valor positivo nao forecast; senao previsao. Extrair helper puro e testar os dois consumidores antes da troca. |
| Recorrencia / datas de ocorrencia | `server/calendar-projection.js:9` e `continuous-calendar-app.js:52` | Motor comum, adaptadores diferentes. Browser limpa participantes/pagamento e usa normalizadores; servidor cria objetos por outro caminho. Caracterizar antes de compartilhar; nao presumir equivalencia atual. |
| Valores efetivos de saida | `mes-atual/cards.js:4`, `mes-atual/totals.js:4`, `calendar-events.js:16`, bridge `:76` | Ja delegam em grande parte a OutflowAmounts; fallbacks e prioridades repetidos. Consolidar contrato, sem mudar cota do titular. |
| Resultado mensal | `core.js:907`, `mobile-v2/data-bridge.js:50`, `mes-atual.js:4203`, `historico-mobile.js:22` | Subtracao de entradas, saidas e reservas repetida. Consomem hoje dados comuns, mas recompoem a formula. Usar o resultado do resumo, preservando bases de cada tela. |
| Percentuais / metas | `mes-atual.js:2073`, `mobile-v2/mes-atual-mobile.js:504`, `server/widget-snapshot.js:62` | Apresentacoes e denominadores diferentes. Separar calculo de percentual da escolha de quais fatos entram; nao unificar consumo e compromissos indevidamente. |
| Categorias e simbolos | `core.js:123`, `pluggy-banking.js:65`, `import-bills-review.js:327`, `outflow-form-mobile.js:86` | Lista mensal ja central; traducao de icon ID e montagens de opcoes repetidas. Extrair contrato `{id,name,symbol}` e testar emoji/ID desconhecido. |
| Normalizacao textual | `import-bills-schema.js:7`, `import-bills-utils.js:4`, `pluggy-banking.js:47`, `state.js:24` | Nem todas tem mesma semantica: preservar acentos em tag != comparar descricao bancaria. Helpers devem ter nomes/contratos distintos. |
| Escape HTML / dinheiro | `shared/html.js:2`, `shared/formatters.js:2`, `mobile-v2/data-bridge.js:4`, `pluggy-banking.js:38`, `universal-search.js:52` | Varias implementacoes/fallbacks. Preservar diferencas de sinal e null; centralizar por contexto, nao substituir escape HTML por escape de JavaScript em atributo. |
| SQL Pluggy | `workers/worker_pluggy.js:47`, `server/http/routes/pluggy-webhook.js:7`, `scripts/sql/create_independent_pipelines.sql` | DDL e MERGE repetidos. Um repositorio SQL com tenant obrigatorio, transacao explicita e testes com conn falso. Manter chaves e multiplicidade. |
| Estado persistido | `server/app-state-store.js:663`, `sqlite-app-state-store.js:30`, `state-store-factory.js:13` | Saneamento, revisao e payload distintos; backup conhece diretamente o formato JSON. Priorizar contrato do store antes de reduzir duplicacao. |

## Maiores concentracoes

1. `mes-atual.js`: 6.297 linhas / 285 declaracoes de funcao nomeadas pela busca.
   Migracao, normalizacao, criacao/edicao/exclusao, parcelas, recorrencia, patrimonio,
   mensagens e renderizacao ainda convivem no mesmo controlador.
2. `core.js` + `state.js` + `storage.js`: combinam estado, catalogos, preferencias,
   sincronizacao, helpers de tela e calculos. Dependencias por globais escondem o grafo.
3. `pluggy-banking.js` (2.038 linhas) + importacao/revisao: a interface usa regras
   de identidade comuns, mas ainda monta categorias, memoria e mutacoes localmente.
4. `server/http/routes/bill-import-ai.js` (1.196 linhas): HTTP, arquivos, jobs,
   filas em memoria, OCI, providers, parsing e persistencia.

## Coisas que NAO devem ser removidas como duplicacao

- Fachadas de `MesAtualNotifications`, `MesAtualCards`, `MesAtualModals` etc.
  As funcoes do controlador delegam aos modulos extraidos e sao chamadas pelo HTML.
- `getTotals` do bridge mobile delega ao core; nao e outro motor financeiro.
- Modulos distintos `render`, `open` e `close` sao APIs locais de telas diferentes.
- HTML/CSS Desktop e Mobile devem continuar distintos.
- `despesas` / `gastosVar` sao adaptadores de compatibilidade; sua remocao imediata
  quebraria consumidores e backups. Precisam de mapa de leitores/gravadores.
- `FinancialQuery` distingue `commitments`, `cash` e `consumption`. Diferenca de
  total entre essas bases nao e por si so bug.
- Regras de datas aceitam dia simples e data completa com semanticas distintas.
  A receita/despesa do proximo mes nao deve ser movida silenciosamente.

## Regra de categorias a preservar

Padroes do sistema + categorias com valor positivo no mes anterior. O codigo
tambem preserva categorias usadas/materializadas no mes atual, metas/seeds e
marcacoes explicitas de visibilidade. Os testes atuais exigem essas excecoes.
Uma leitura literal que apagasse categorias atuais de valor zero seria mudanca
funcional, nao refatoracao. Essa compatibilidade deve entrar no contrato formal.

Banco de dados de categorias por ID imutavel seria outra evolucao de produto,
nao esta proposto como migracao automatica nesta etapa.
