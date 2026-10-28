# MeuFin - Especificacao Completa de Reconstrucao

Edicao de 27/10/2026. Base anterior ao redesign visual: 67fa380.
Finalidade: permitir reconstruir o produto, entender suas regras e conferir seus
numeros sem depender de uma conversa anterior.

Este texto e a parte explicativa. O documento MEUFIN-RECONSTRUCAO-COMPLETA.md
reune este texto e o pacote-fonte integral da edicao reconstruivel, descrito
no Anexo A. Esse documento completo e a entrega independente do repositorio.

## Como interpretar

### Complemento Mobile de 27/10/2026

A apresentacao mobile conserva o azul MeuFin e Inter, com estilos limitados a
`html.mobile-v2` e login em largura mobile. O cabecalho agrupa acoes secundarias
em menu nativo details/summary. A barra inferior conserva cinco destinos e
nomes acessiveis; Painel e Agenda sao rotulos curtos de Dashboard e Calendario.
Os indicadores acomodam valores grandes sem alterar precisao ou sinais.

Dashboard imprime o intervalo resolvido pelo contrato de periodos existente.
O ranking mostra inicialmente cinco categorias, com expansao para todas e
tabela integral; barras tem geometria real. A soma financeira usa todas as
categorias, nao apenas as cinco visiveis. A distribuicao em categorias/metas
fica recolhida; a lista de metas e prioridade. Historico agrupa meses por ano,
preservando todos os registros. Nenhuma formula e modificada por isso.

`modules/mobile-v2/sheet-accessibility.js` controla a pilha de sheets e modais
legados abertos em MobileV2. O foco pertence a camada superior, com ciclos de
Tab/ShiftTab, Esc, retorno ao acionador e fundo inerte. O z-index anterior e
restaurado ao fechar. Confirmacoes de recorrencia entram nessa mesma pilha.
Avisos globais sao espelhados como alertas no dialogo ativo para nao ficarem
inacessiveis. Nao ha dependencia externa para essa coordenacao.

O editor protege rascunhos ao sair por Esc, fundo ou Voltar; Cancelar explicito
continua descartando. Arrastar conteudo nao fecha o formulario: o gesto fica
na alca. Sucesso fecha somente apos confirmacao de persistencia; pending/retry
e escolha de escopo de recorrencia continuam seguindo os comandos canonicos.
Busca mobile utiliza `getUnifiedFilterRows` e nao consulta outro mes; a visao
selecionada continua restringindo os itens apresentados. Datas e dinheiro nao
recebem aproximacao textual. Emojis e caixa alta das rendas sao preservados.

Validacao adicional: `npm run test:mobile-design`. Testes em browser emulado
nao equivalem a teclado virtual, leitor de tela ou aparelho fisico homologado.

### Apresentacao aprovada em 27/10/2026

O aplicativo carrega `product-design.css` depois dos estilos base. Esse
arquivo concentra tokens de cor claro/escuro, superficies opacas, bordas,
tipografia Inter e alinhamento tabular de valores. Azul identifica acoes
principais nas duas apresentacoes. Emojis de categoria e caixa alta dos nomes
de renda fora da edicao continuam preservados.

Depois carregam `modules/mobile-v2/styles/banking.css`, com estrutura estatica
do Internet Banking, e `mobile-design.css`, responsavel pelo acabamento mobile.
Ambos limitam as regras a `html.mobile-v2` e largura maxima de 900 px; abrir o
banking nao injeta mais CSS nem altera estilos de outras telas.
Cartoes mostram vencimento calculado pelo helper canonico e parcela/recorrencia
nos metadados. Metas mostram saldo restante ou excedido sem gravar novo campo.
A legenda do calendario usa a mesma funcao de intensidade dos dias.
Internet Banking informa a competencia de destino, nomeia selects e bloqueia
acoes concorrentes durante importacao. `saved` confirma sucesso; outros estados
nao confirmam. Falha ao atualizar a lista depois de `saved` nao anula o sucesso.
Falha de conexao/carregamento oferece nova tentativa; nao vira desconexao falsa.

Finalizacao de 28/10/2026: a busca Mobile guarda search/tag/kind por competencia
e conserva o limite da visao/metodo. Limpar filtros nao troca mes ou cartao.
O sheet de filtros chama MobileV2MesAtual.setFilters, nao o filtro Desktop.
Renda recebida soma registros incluidos e pagos; pendente e esperado menos
recebido. Reembolsos usam os grupos canonicos, excluem titular e separam linhas
pagas e pendentes, sem registrar receita nova. Somatorios exibidos usam centavos.
Editores de meta/fatura aguardam save(true)===true para fechar. Pending bloqueia
o campo ja aplicado; retry chama flushServerStorage, sem reaplicar a alteracao.
Fechamento durante operacao e resultado tardio de outro editor sao protegidos.
Ajuda inicial cancela timers antigos; busca universal entra na pilha modal;
notificacoes preservam foco ao reconstruir conteudo. Toasts usam texto literal.
Graficos ignoram interpolacao em reduced-motion e exportam com tokens do tema.
Teste complementar: npm run test:mobile-completion. Validacao fisica continua
nao executada; a matriz final registra essa limitacao explicitamente.

Dashboard usa grade fluida no layout padrao. Quando ha coordenadas/dimensoes
personalizadas, elas continuam sendo aplicadas na leitura, nao so na edicao.
Organizar painel alterna um estado temporario que mostra alcas e controles;
concluir nao apaga posicoes. Ajustes responsivos continuam sem regravar o
layout. Em largura reduzida continuam valendo os fallbacks anteriores.

Ranking de categorias mostra nome, valor completo e participacao proporcional.
Compromissos e consumo continuam consultas distintas. A pizza e opcional em
details/summary, redimensionada ao abrir, e as tabelas dos graficos permanecem.
O resultado explicita a soma de totalFinancialGoals dos meses do periodo,
excluindo metas nao incluidas. A formula financeira nao muda.

O editor de lancamento Desktop e opaco e agrupa as opcoes existentes. A lista
de copiar lancamentos fica recolhida inicialmente, sem alterar os comandos de
copia/salvamento. Checkboxes de inclusao no total e de pago continuam distintos;
os primeiros recebem nomes acessiveis e as acoes editar/excluir, tooltips.
O calendario Mobile deixa de escrever valores dentro de cada celula: conserva
dia, intensidade/ponto e selecao. O nome acessivel do dia contem valor e numero
de registros; a lista do dia selecionado conserva todos os valores.

Nao ha migracao de registros, novo formato de backup, troca de framework ou
integracao externa decorrente desse redesign. Testes financeiros permanecem;
snapshots integrais de HTML foram substituidos por valores independentes de
series, categorias, reservas e limites de chamadas. Testes de navegador cobrem
organizacao, pizza opcional, formulario recolhivel e calendario.

- **Vigente**: comportamento encontrado no codigo, inclusive particularidades.
- **Invariante**: propriedade que uma implementacao equivalente deve preservar.
- **Ressalva**: divergencia ou limitacao conhecida, nao uma correcao ja realizada.
- Valores de exemplos sao ficticios. Nenhum dado de conta real e necessario.
- Competencia e o mes ao qual o usuario atribuiu o lancamento. Nao e
  obrigatoriamente o mes da data da compra, cobranca ou recebimento.
- Esta especificacao nao concede acesso a Oracle, Pluggy, SMTP ou outros
  provedores. Quem reconstruir precisa fornecer suas proprias credenciais.
- Dependencias npm e bibliotecas CDN continuam externas; versoes npm estao
  fixadas no lockfile do pacote. Nao se promete instalacao sem internet.
- Reconstruir o funcionamento nao significa restaurar o historico privado.
  O pacote foi intencionalmente privado desse historico.

## Sumario

1. Produto, usuarios e telas.
2. Arquitetura executavel.
3. Dicionario de dados.
4. Valores, datas e classificacoes.
5. Motor financeiro e formulas.
6. Exemplos numericos completos.
7. Cartoes e faturas.
8. Criar, editar, pagar, excluir e desfazer.
9. Recorrencia, parcelas e calendario continuo.
10. Rendas, projetos e metas.
11. Patrimonio e conciliacao.
12. Categorias, tags, simbolos e visibilidade.
13. Filtros e buscas.
14. Dashboard, historico e graficos.
15. Calendario de eventos e compartilhamentos.
16. Internet Banking e identidade de importacao.
17. PDF, Oracle AI e filas.
18. Persistencia, concorrencia e recuperacao.
19. Autenticacao, permissoes e criptografia.
20. Contratos HTTP.
21. Interface Desktop/Mobile e eventos.
22. Backup, exportacao, widget e operacao.
23. Plano de reconstrucao.
24. Casos de aceitacao e verificacao.
25. Divergencias conhecidas e limites de equivalencia.
26. Manutencao do proprio documento.
Anexo A, na edicao completa: inventario, extrator e pacote de reconstrucao.

# 1. Produto, usuarios e telas

O produto organiza financas pessoais em competencias mensais e contas
patrimoniais. Ele combina planejamento e realizado, sem considerar que toda
entrada prevista ja foi recebida ou que toda despesa prevista ja foi paga.

Usuarios possuem identidade, perfil, credencial, estado financeiro e backups
proprios. Um usuario novo deve comecar sem financas de outro usuario.
A permissao canAccessESO libera um dominio adicional de fechamentos de projetos.
A area de desenvolvedor tem autenticacao/rotas proprias; nao e uma conta comum.

Telas e finalidade:

| Tela | O que apresenta | O que nao deve fazer |
|---|---|---|
| Dashboard | Indicadores de um periodo, series e categorias | Gravar dados por abrir grafico |
| Controle dos Meses | Lancamentos, renda, metas e resultado da competencia | Mover lancamento de competencia apenas por sua data |
| Patrimonio | Contas/ativos, saldos e movimentacoes | Tratar transferencia entre contas como renda nova |
| Historico | Comparacao de competencias elegiveis | Criar dados pessoais faltantes usando seed de outro usuario |
| Calendario | Datas financeiras e eventos com orcamento | Duplicar lancamentos ao exibi-los em outra visao |
| Internet Banking | Revisao de itens de origem externa | Importar automaticamente sem revisao |
| Perfil/preferencias | Dados pessoais, configuracoes, backup e widget | Alterar owner financeiro pelo corpo de uma requisicao |
| Fechamentos ESO | Projetos/clientes e estados comerciais | Somar fechamento automaticamente como renda pessoal |

O Desktop usa navegacao lateral. O Mobile usa shell, navegacao inferior e
sheets proprios, consumindo os mesmos contratos financeiros.

# 2. Arquitetura executavel

## 2.1 Tecnologias e distribuicao

Node.js >=20 e o requisito declarado. Servidor Express, sessao por cookie e
session-file-store. Frontend HTML/CSS/JavaScript sem compilacao obrigatoria.
Chart.js desenha graficos; Fuse.js implementa aproximacao textual.

Principais dependencias declaradas:

| Pacote | Faixa declarada |
|---|---|
| express | ^4.21.2 |
| express-session | ^1.18.1 |
| session-file-store | ^1.5.0 |
| nodemailer | ^9.0.1 |
| oracledb | ^6.8.0 |
| playwright, desenvolvimento | ^1.59.1 |

O lockfile, e nao apenas essas faixas, define o conjunto reproduzivel.

## 2.2 Camadas

1. **Apresentacao**: le formularios, mostra linhas, indicadores e mensagens.
2. **Comandos**: validam e aplicam mudancas no dominio.
3. **Consultas**: calculam fatos e totais, sem exigir DOM.
4. **Sincronizacao cliente**: snapshot, fila, revisao e estado pendente.
5. **HTTP**: identidade de sessao, CSRF, validacao e traducao de erros.
6. **Servicos**: coordenam bootstrap/commit/backup por dependencias injetadas.
7. **Stores**: leitura, gravacao, isolamento, particoes e arquivos atomicos.
8. **Integracoes**: staging, provedores, filas, prazos e extracao.

Nao confundir hospedagem Oracle Cloud com Oracle Database ou SQLite.
O app-state usa JSON por padrao. Oracle Database atende staging/integracoes.
SQLite e uma alternativa opcional com ressalvas registradas no capitulo 25.

## 2.3 Inicializacao

A pagina /app exige sessao e carrega scripts na ordem declarada em index.html.
Ha dependencias globais e variaveis lexicais: nao reorganizar como se fossem ESM.
Bootstrap recupera sessao/permissoes, estado e revisao.
Normalizadores/migracoes preservam compatibilidade antes da apresentacao.
O Mobile e carregado sob demanda e nao constitui um segundo banco de dados.

Uma reconstrucao limpa deve poder cadastrar usuario sem seed historico privado.
Na edicao reconstruivel, o adaptador de seed privado retorna null.

# 3. Dicionario de dados

## 3.1 Envelope persistido e chaves

O app-state e um objeto de chaves, nao somente uma lista de meses.
As propriedades desconhecidas compativeis nao devem desaparecer numa leitura.

| Chave | Conteudo |
|---|---|
| finData | Meses materializados e representacoes compactadas |
| finCalendarModel | Modelo de series, revisoes e configuracoes por competencia |
| finPatrimonioAccounts | Contas/ativos |
| finPatrimonioMovements | Movimentacoes patrimoniais |
| finMetas | Estado adicional de metas/preferencias do dominio |
| finEsoData | Fechamentos ESO |
| finPluggyBankingState | Vinculos, memoria e marcadores de importacao/ignorados |
| finCategoryRenameMap | Aliases/renomeacoes de categoria |
| finCategoryColors / finCategoryEmojis | Aparencia das categorias |
| finUIState | Navegacao, filtros, selecoes e preferencias |
| finStateSchemaVersion | Versao do estado; padrao do servidor 3 |
| finDataMigrationVersion | Migracoes do modelo mensal |
| finSelectionVisibilityMigrationVersion | Migracao de visibilidade de selecoes |

O cliente ainda declara STATE_SCHEMA_VERSION 2; o servidor usa padrao 3.
Nao confundir esse numero com partitionVersion 3, nem com versao 1 do calendario.

Envelope do servidor:

```json
{
  "userId": "usuario-ficticio",
  "generation": "identificador-aleatorio",
  "updatedAt": "2026-10-26T12:00:00.001Z",
  "monthCount": 1,
  "schemaVersion": "3",
  "encrypted": true,
  "partitioned": true,
  "partitionVersion": 3,
  "state": null,
  "parts": {},
  "totalSize": 12345
}
```

Na leitura logica o store devolve state reconstruido. No disco, parts aponta
para arquivos da geracao publicada.

## 3.2 Mes

```json
{
  "id": "outubro_2026",
  "nome": "OUTUBRO 2026",
  "outflows": [],
  "outflowCards": [],
  "cardBills": [],
  "renda": [],
  "projetos": [],
  "financialGoals": [],
  "dailyGoals": {},
  "dailyCategorySeeds": [],
  "dailyGoalManualCats": [],
  "selectionVisibility": {
    "version": 2,
    "categories": { "MORADIA": true },
    "tags": { "casa": true }
  },
  "calendarEvents": [],
  "patrimonioTransfers": [],
  "obs": "",
  "unifiedOutflowUi": {
    "filter": "expense",
    "tagFilter": "",
    "allSearch": "",
    "sortField": "categoria",
    "sortDirection": "asc"
  }
}
```

Campos legados despesas, gastosVar, categorias e _catOrig podem existir.
Normalizar nao autoriza somar legado e outflows duas vezes.

## 3.3 Lancamento de saida

| Campo | Tipo/finalidade |
|---|---|
| id | Identidade local; preservar numa edicao |
| description | Descricao do usuario |
| type | spend ou expense; fixed/launch sao tratados na compatibilidade/entrada |
| category / tag | Categoria canonica e tag textual |
| amount | Valor salvo; em compartilhamento costuma ser parcela do proprietario |
| outputKind | method, card ou account |
| outputMethod | boleto, dinheiro, pix ou debito |
| outputRef | ID de cartao ou conta, quando aplicavel |
| date | Data normalizada dd/mm/aa |
| status | planned ou done; nao substitui paid |
| paid | Confirmacao financeira de pagamento |
| countsInPrimaryTotals | Exclusao explicita do total principal quando false |
| includeInTotals | Flag de inclusao consultada pelo motor financeiro |
| belongsToCard | Compatibilidade para pertencimento ao cartao |
| recurringSpend / expenseRecurring / launchRecurring | Recorrencia |
| recurringGroupId | Identidade de serie mensal |
| installmentsTotal / installmentIndex | Total e posicao da parcela |
| installmentsGroupId | Identidade da serie parcelada |
| showInMonthPlanning / includeInMonthPlanning | Participacao na visao de planejamento |
| entryKind / launchInstallment / launchShared | Flags normalizadas de apresentacao/semantica |
| sharedExpense / sharedSplitMode | Compartilhado, divisao equal ou manual |
| sharedOriginalAmount / sharedOthersAmount | Total original e parcela de terceiros |
| sharedOwnerAmount | Valor explicito quando presente em payload compativel |
| sharedParticipants | Participantes com id, name, amount, isOwner e paid |
| createdAt | Criacao; nao alterar por simples edicao |
| importIdentity e campos source* | Proveniencia; preservar ao editar |

Flags diferentes nao sao sinonimos universais. Especialmente:
type=spend em cartao pode coexistir com expenseRecurring=true e aparecer
no planejamento, sem virar despesa principal duas vezes.

## 3.4 Renda e entrada extra

Renda: fonte, valor, paid, includeInTotals, dataRecebimento,
recurringFixed, recurringGroupId e patrimonioMovementId.
recurringFixed diferente de false considera a renda recorrente quando ha fonte.

Projeto/extra: nome, valor, paid, includeInTotals, dataRecebimento e dados
recurringExtra, recurringGroupId, recurringInstallmentsTotal,
recurringInstallmentIndex quando aplicaveis. Nao e um fechamento ESO.

## 3.5 Cartao e fatura

Cartao possui id, name, identificacao visual/instituicao, closingDay,
paymentDay, closingDate e paymentDate e configuracoes de previsao do dominio.
Fatura: id, cardId, amount, forecastAmount, source, manualAmountSet, paid e
flags de inclusao. Cada compra aponta para cartao por outputRef, nao pelo nome.

## 3.6 Meta financeira, evento e patrimonio

Meta financeira: id, nome, valor, includeInTotals, patrimonioAccountId,
patrimonioMovementId e patrimonioTransferredAt.
Orcamento de categoria e outro conceito: dailyGoals[categoria].

Evento: id, name, startDate, endDate, budget, color, tagId.
Datas de evento sao chaves ISO yyyy-mm-dd.

Conta patrimonial: id, nome, tipo, observacao, kind institution/custom,
institution, color, reconciliationCheckpoints e createdAt.
Checkpoint: id, date, balance, createdAt.

Movimento: id, type aporte/retirada/transferencia/atualizacao, accountId,
fromAccountId, toAccountId, value, description, date, createdAt, sourceType,
sourceMonthId, sourceGoalId e proveniencia externa.

# 4. Valores, datas e classificacoes

## 4.1 Conversao monetaria

O motor de consultas converte cada fato em centavos:

```text
n = Number(valor ou 0)
rejeitar se n nao finito
centavos = round((n + Number.EPSILON) * 100)
rejeitar se centavos nao e inteiro seguro
soma = soma de centavos, e nao soma de strings formatadas
apresentacao = centavos / 100, formatada em BRL
```

A maioria dos normalizadores de saida limita valores a nao negativos.
Valores negativos de origem bancaria nao devem ser transformados cegamente
em despesas positivas; estornos exigem revisao.

Nem todas as funcoes legadas somam inteiros: varios resumos de UI usam Number
e arredondam na exibicao. Para equivalencia literal usar os algoritmos anexados.

## 4.2 Valor efetivo compartilhado

Para saida nao compartilhada: max(0, Number(amount ?? valor)), nao finito vira 0.
Para sharedExpense=true:

1. Se sharedOwnerAmount sanitizado for maior que zero, usa-lo.
2. Senao, se existe participante isOwner=true, usar seu amount, inclusive zero.
3. Senao, usar max(0, sharedOriginalAmount ou amount/valor - sharedOthersAmount).
4. Sem valor original valido, retornar zero.

Valor da compra nao e necessariamente valor que pesa para o proprietario.

## 4.3 Datas

Datas completas aceitam dia/mes/ano com barras ou hifens, ano de 2 ou 4 digitos.
Validar o calendario real: 31/02 e invalido. Normalizar para dd/mm/aa.
Ano de dois digitos e interpretado como 2000 + ano.

Dia isolado entre 1 e 31:
- Usa competencia selecionada como contexto.
- Os fluxos mensais existentes usam, em geral, deslocamento +1 mes.
- Limita ao ultimo dia real do mes de destino.
- Data completa explicita e mantida, nao deslocada automaticamente.

Exemplo: competencia outubro/2026, entrada "10" -> 10/11/26.
Entrada "10/10/2026" -> 10/10/26.
Dia 31 projetado em fevereiro/2027 -> 28/02/27 pelo helper de clamp.

Mes ordinal: ano * 12 + indice zero-based.
Deslocamento = ordinal da data - ordinal da competencia de origem.
Data projetada = dia original, no ordinal destino + deslocamento, com clamp
pelo adaptador aplicavel.

Ressalva: ha politicas divergentes de datas entre adaptadores; capitulo 25.

## 4.4 Classificar lancamentos

Expense verdadeiro se tipo normalizado expense, ou expenseRecurring=true,
ou showInMonthPlanning/includeInMonthPlanning=true.
Parcelado se installmentsTotal >1 ou ha installmentsGroupId.
Recorrente se flag de recorrencia ou recurringGroupId sem parcelamento.
Compartilhado se flag sharedExpense/launchShared ou mais de um participante.

No predicado isUnifiedLaunchOfType, spend e verdadeiro quando type=spend OU
quando o item nao e expense/fixed/recorrente planejado. Assim, um item type=spend
com flag de planejamento pode satisfazer as duas consultas. Nao assumir uma
particao exclusiva entre esses predicados. Os conjuntos de filtro legados podem
refletir essa sobreposicao; nao corrigi-la silenciosamente na reconstrucao.

Na criacao, cartao forca type=spend. Para outros meios, tipo pedido spend/expense
pode ser mantido; pedido generico launch vira expense se recorrente/planejado,
caso contrario spend.

# 5. Motor financeiro e formulas

## 5.1 Transformacao em fatos

Um fato contem id composto, kind, direction income/expense/reserve, amount,
category, included, paid, description, date, sourceId e tag.

| Origem | kind | Regra especial |
|---|---|---|
| Saida cartao | purchase | consumptionOnly=true |
| Saida nao cartao planejada/fixa | fixed | Usa valor efetivo e inclusao |
| Saida nao cartao restante | spend | Usa valor efetivo e inclusao |
| Fatura | bill | commitmentOnly=true, categoria FATURAS DE CARTAO |
| Renda | income | includeInTotals diferente de false |
| Projeto/extra | project | includeInTotals diferente de false |
| Meta financeira | goal | direction=reserve |

Nao-cartao so entra se countsInPrimaryTotals e includeInTotals nao forem false
e a selecao correspondente em despesas legadas permitir.
Fatura respeita as mesmas flags aplicaveis e selecao.
Compra cartao usa includeInTotals e nao pesa como compromisso individual.
paid do fato considera paid=true OU pago=true. status=done nao basta.

Sem outflows, adaptar despesas e gastosVar legados; nao repetir despesa
cujo ID ja corresponde a uma fatura existente.
Cartao sem fatura recebe fatura virtual forecast pela soma de recorrentes
recurringSpend=true no cartao.

Normalizar categoria; rótulos de meio/tipo (PIX, DEBITO, DINHEIRO, CARTAO,
DESPESAS, GASTOS e variantes fixas/variaveis) viram OUTROS na categorizacao
financeira generica. Meio de pagamento nao e categoria real de consumo.

## 5.2 Tres bases

| Base | Inclui compras de cartao | Inclui fatura | Exige paid |
|---|---:|---:|---:|
| commitments | Nao | Sim | Nao |
| consumption | Sim | Nao | Nao |
| cash | Nao | Sim | Sim, para todos os fatos da consulta |

Filtrar included=false antes de totalizar.
cash tambem filtra rendas e metas nao pagas; nao presumir que toda meta tem paid.

## 5.3 Equacoes da consulta

```text
I = soma income + project incluidos na base
E = soma expense incluidos na base
G = soma goal incluidos na base, ou 0 se includeGoals=false
resultado = I - E - G
pendencias = soma das despesas da base cujo paid e false
categorias[c] = soma das despesas da base na categoria c
```

Metas financeiras nao sao despesa E; sao reserva G.
Metas de categoria dailyGoals nao entram como G.

Retorno em reais de getTotals:

```text
rendaFixa = soma income
totalProj = soma project
rendaTotal = rendaFixa + totalProj
totalFixas = soma fixed + bill
totalVar = soma spend
totalGastos = E
totalFinancialGoals = G
resultadoMes = I - E - G
availableForVariableSpending = I - totalFixas - G
catTotals = categorias
dinheiroVal = 0 (compatibilidade, nao novo saldo de caixa)
```

## 5.4 Quatro indicadores do Controle dos Meses

1. Renda total = renda fixa incluida + extras incluidos.
2. Despesas planejadas = despesas expense nao-cartao elegiveis +
   metas financeiras incluidas + alvo ativo de orcamento por categoria.
3. Despesas do mes = expenseCents/100 da base commitments.
4. Resultado = renda total - Despesas do mes - metas financeiras incluidas.

O nome interno calculateUnifiedPlanningTotal retorna atualmente a despesa da
base commitments. Nao usar o nome antigo como evidencia de que seria a soma
dos limites planejados por categoria.

No plannedExpenses, excluir cartoes, referencias explicitas a cardId/cardName,
categorias de cartao e countsInPrimaryTotals=false. A selecao e verificada por ID;
a implementacao usa teste selectedDespesaIds.size >0 antes de rejeitar ID ausente.
Preservar esse detalhe se a meta for equivalencia literal.

## 5.5 Orcamentos por categoria

O alvo getDailyGoalTarget soma somente limites positivos de categorias com
gasto comparavel positivo. Gasto comparavel e o predicado spend com
recurringSpend diferente de true; parcelas nao sao excluidas por si so.
A soma de gasto usada para ativar o
limite usa amount, nao automaticamente o valor efetivo compartilhado.

Um limite de 500 numa categoria ainda sem gasto comparavel nao soma 500 no alvo.
Meta financeira de poupanca e diferente de limite de alimentacao.

Percentual de categoria = total da categoria / meta *100, se meta>0.
Widget arredonda esse percentual para inteiro. Barra visual nao deve alterar
valor salvo e nao implica que limite foi convertido em despesa.

## 5.6 Pagamento e resumos auxiliares

fixedDoneTotal soma despesas selecionadas fixas/faturas; para expense de
pix/dinheiro/debito exige paid=true, mas nao aplica o mesmo teste a toda fatura.
spendsDoneOutsideCard exige spend, status=done, nao-cartao, flag incluida e,
para pix/dinheiro/debito, paid=true.
doneExpenses = fixedDoneTotal + metas incluidas + spendsDoneOutsideCard.

paidOut soma fixas/faturas explicitamente pagas e gastos done nao-cartao
efetivamente pagos. Nao substituir por expenseCents total.

"Total" da visao Todos usa o guard atual: soma amount de linhas nao-bill e
ignora bill. Portanto nao e o mesmo total de compromisso do topo.
Exibir uma fatura e seus subitens nao autoriza somar ambos.

# 6. Exemplos numericos completos

## 6.1 Competencia de referencia

Todos incluidos:
- Salario 5.000, recebido.
- Extra 500, ainda nao recebido.
- Aluguel expense/boleto 1.000, nao pago.
- Alimentacao spend/pix 200, pago.
- Assinatura cartao 50, nao paga, consumo.
- Compra cartao 300, nao paga, consumo.
- Fatura manual do cartao 800, nao paga.
- Meta financeira 400, sem paid.
- Orcamento Alimentacao 500 e Lazer 100 sem gasto em Lazer.

Resultado esperado:

| Consulta | I | E | G | Resultado |
|---|---:|---:|---:|---:|
| commitments | 5.500 | 2.000 | 400 | 3.100 |
| consumption | 5.500 | 1.550 | 400 | 3.550 |
| cash | 5.000 | 200 | 0 | 4.800 |

Por que: compromisso usa 1.000+200+800. Consumo usa 1.000+200+50+300.
cash usa somente o salario e PIX pagos.
totalFixas=1.800, totalVar=200 e disponivel para variaveis=3.300.
Despesas planejadas=1.000+400+500=1.900.
Despesas do mes=2.000 e resultado do topo=3.100.
Total Todos, com essas linhas, soma compras/saidas 1.550 e ignora a fatura.
Pendencias commitments=1.800.

Essas diferencas sao de base, nao necessariamente erro de calculo.

## 6.2 Compartilhamento

Compra 120 dividida igualmente entre tres pessoas:
parcela do proprietario=40; terceiros=80.
Se manual: proprietario 30, outra pessoa 50, outra 40 -> peso pessoal=30.
A soma manual deve diferir do total em no maximo 0,01.
A interface aceita entre 1 e 20 pessoas; o caso especial count<=1 cria
proprietario com zero e um terceiro com o total.
Pagamento dos terceiros nao se transforma automaticamente numa nova renda.

## 6.3 Fatura manual zero

amount=0, manualAmountSet=true, forecastAmount=90 -> efetivo=0.
amount=0, manualAmountSet=false, source=forecast -> efetivo=90.
amount=200, source=manual -> efetivo=200.
Nao usar operador "valor || previsao" para implementar essa regra.

## 6.4 Conciliacao

Conta sem checkpoint: aporte 1.000, retirada 200 -> saldo 800.
Checkpoint em 20/10 com saldo 750, aporte 100 em 21/10 -> saldo 850.
Movimento de 20/10 ou anterior nao soma novamente depois do checkpoint.
Transferir 50 para outra conta reduz origem e aumenta destino, total inalterado.

# 7. Cartoes e faturas

Valor efetivo da fatura:
- Se manualAmountSet=true, usar max(0, amount), inclusive zero.
- Senao, se source nao e forecast e amount>0, usar amount.
- Caso contrario, usar forecastAmount nao negativo.

Previsao recorrente: somar valor efetivo das compras do cartao com
recurringSpend=true. A apresentacao de "lancamentos do cartao" soma compras
cuja data nao e futura em relacao ao dia real; sem data interpretavel o item
nao e descartado por esse teste. Esse subtotal nao substitui a fatura manual.

A compatibilidade sincroniza cartoes/faturas e estruturas legadas antes de
consultar getTotals. Mudancas na fatura nao devem reescrever compras historicas.

Transferencia de cartao em series:
1. Identificar series que apontam para o cartao de origem.
2. Criar revisao na competencia escolhida.
3. Projetar a ocorrencia nessa competencia para preservar posicao/data.
4. Trocar outputRef pelo novo cartao nas revisoes afetadas.
5. Preservar passado e excecoes mensais.
Excluir sem destino encerra as series correspondentes.

Fechamento, pagamento, data de compra e competencia sao campos distintos.
A regra de datas do adaptador atual esta no codigo embarcado. Nao inventar uma
regra bancaria unica substituindo as diferencas listadas no capitulo 25.

# 8. Comandos de lancamentos

## 8.1 Criar

```text
ler rascunho
normalizar descricao, categoria, tag, valor e meio
se categoria "nova", usar newCategory
se tag "nova", usar newTag
categoria de meio/tipo nao real -> OUTROS
resolver flags, tipo, recorrencia, parcelas e planejamento
resolver data no contexto da competencia
validar descricao nao vazia e valor>0
coletar e validar participantes, se compartilhado
normalizar registro e gerar IDs locais/serie
registrar snapshot de desfazer
marcar novas selecoes visiveis conforme escopo vigente
inserir ocorrencia
atualizar regra continua ou fallback legado
sincronizar previsao de fatura e espelhos legados
await save(true)
se confirmado -> status saved
senao -> status pending, sem reaplicar a insercao
```

Planejado/recorrente usa status=planned; entrada simples usa done.
Parcelas guardam valor informado por ocorrencia: o comando nao divide
automaticamente amount por installmentsTotal.

## 8.2 Auto-pagamento

Na criacao, somente outputKind=method com pix/dinheiro/debito e elegivel.
Sem date retorna true no helper; data invalida retorna false.
Data valida anterior ou igual ao inicio do dia real atual -> true.
Data futura -> false. Boleto e cartao -> false.

Edicao preserva paid anterior, em vez de reaplicar automaticamente a regra.
Projecao de serie comeca paid=false, mesmo em metodo de pagamento direto.
Portanto compra no debito passada pode nascer paga; nao e erro por si so.

## 8.3 Editar e escopo

Preservar id, proveniencia e campos semanticos que o comando declara manter.
Para uma serie alterada, se propagacao e permitida, perguntar:
somente este mes, este mes e proximos, ou cancelar.
Cancelamento nao deve persistir o rascunho.

Propagacao e permitida da competencia atual real em diante. Se a competencia
real nao for localizada pelo predicado, a compatibilidade permite propagar.
Mudanca futura nao deve reescrever mes anterior nem item futuro pago/excecao.

Edicao Mobile usa a mesma camada de comando, com adaptacao de rascunho.

Regra de encerramento: depois de confirmar o salvamento de um item existente,
fechar a caixa de edicao. Vale tambem para gasto, compromisso, recorrencia,
parcela e compartilhamento. Nao reabrir o editor de categorias como efeito do
sucesso; o retorno anterior continua disponivel ao cancelar/fechar manualmente.
Erro, invalidacao, cancelamento de escopo ou persistencia pendente mantem a
edicao aberta. Nao fechar outro item/competencia aberto durante a requisicao.
Inclusao nova conserva a experiencia de adicionar outros lancamentos, sem
aplicar automaticamente a regra de fechamento de edicao.

Saida invalida no Mobile cai em method:boleto.
Em compartilhamento manual existente, o ultimo participante recebe a diferenca
residual nao negativa apos preservar os anteriores.

## 8.4 Excluir

Sem serie: remover por id e sincronizar legado.
Serie, somente mes: ocultar/remover ocorrencia como excecao mensal.
Serie, futuros: registrar stop a partir da competencia e atualizar motor.
Fallback sem calendario continuo remove futuras ocorrencias materializadas.
Nao remover entradas de outras series com descricoes parecidas.

## 8.5 Estados e mensagens

Estados relevantes: invalid, cancelled, pending, saved.
A interface de pending conserva retry; sucesso remoto nao e inferido pelo
fechamento do modal. Internet Banking so remove pendencia depois de confirmacao.
Desfazer/refazer usa snapshots incluindo modelo de calendario e dominio;
nao deve restaurar somente tabela visual deixando regra antiga ativa.

# 9. Series, parcelas e calendario continuo

## 9.1 Janela

Oferecer 12 meses do ano real atual e 12 do seguinte, mais historico gravado.
A janela e recalculada; nao precriar infinitos anos.
Mudar de competencia pode criar objeto virtual em memoria, mas nao deve
salvar esse mes nem fazer backup somente por navegar.

## 9.2 Modelo

```json
{
  "version": 1,
  "recurrenceRevision": 2,
  "start": 24321,
  "rules": [{
    "id": "outflows:rec_exemplo",
    "collection": "outflows",
    "key": "rec_exemplo",
    "versions": [{
      "from": 24321,
      "sourceMonth": "outubro_2026",
      "payload": {}
    }]
  }],
  "settings": [{
    "from": 24321,
    "cardsSourceMonth": "outubro_2026",
    "payload": { "outflowCards": [] }
  }]
}
```

24321 corresponde a 2026*12+9.
Versionamento escolhe ultima versao com from<=competencia.
stopped=true significa nao projetar a partir daquela revisao.
Collections: renda, outflows, projetos.
Settings: cartoes, selectionVisibility, dailyGoals, dailyGoalTarget,
dailyGoalManualCats e dailyCategorySeeds.

## 9.3 Identidade e template

Renda: recurringGroupId, senao income_ + fonte normalizada.
Projeto: recurringGroupId.
Saida: installmentsGroupId, senao recurringGroupId; legado recorrente pode
usar chave composta de descricao, meio/ref e categoria.

Template clona registro e remove id, createdAt, _calendarRule.
Reinicia paid=false e patrimonioMovementId vazio.
Saida recebe status=planned e participantes nao pagos.
IDs projetados de saida sao deterministas por regra e competencia.
Nao usar ID aleatorio a cada abertura, pois isso quebraria excecoes/dedupe.

## 9.4 Projecao

```text
criar mes vazio
aplicar ultima settings anterior/igual ao destino
se destino < start: retornar sem ocorrencias de series
para cada regra:
  selecionar versao ativa
  ignorar ausente/stopped
  offset = ordinalDestino - versao.from
  posicao = indiceBase + offset
  se parcelado/projeto limitado e posicao > total: nao gerar
  projetar payload via adaptador
  associar _calendarRule e ID determinista
normalizar selecoes e mes
```

Series nao dependem de o usuario ter aberto o mes predecessor.
Parcela 3/5 em outubro -> novembro 4/5, dezembro 5/5, janeiro ausente.

## 9.5 Hidratacao e compactacao

Ao carregar, projetar base e mesclar os registros salvos.
_calendarSparse identifica mes compactado.
_calendarHidden guarda chaves de ocorrencias excluidas naquele mes.
Registro salvo com mesma identidade vence sobre a ocorrencia projetada.

Sessao guarda baseline gerado e estado de referencia:
- Virtual igual ao gerado: omitir por inteiro ao salvar.
- Registro gerado intacto: nao gravar de novo.
- Novo/alterado: gravar diferenca.
- Gerado removido: gravar chave em hidden.
- Registro legado original: preservar.

Ao atualizar regra, recalcular futuros, mas nao sobrescrever pago ou
diferente do baseline. Nao ressuscitar ocorrencia excluida localmente.

## 9.6 Migracoes

Ativacao inicial exige backup manual confirmado e grava versao no app-state.
Reparos de continuidade e cartoes legados sao versionados/idempotentes.
Nao reexecutar a mesma migracao indefinidamente nem usar calendario como
justificativa para apagar meses historicos.

# 10. Rendas, extras e metas

Renda recorrente e padrao quando recurringFixed nao e false e ha fonte.
Clonagem mantem fonte/valor/inclusao/dia e reinicia recebido/vinculo patrimonial.
Alteracoes de serie nao propagam paid ou patrimonioMovementId; renda futura
ja recebida deve ser protegida.

Data completa de recebimento e respeitada. Dia simples de renda fixa usa mes
seguinte da competencia na apresentacao vigente.
Extra recorrente/parcelado avanca recurringInstallmentIndex ate seu total.
Extra comum nao vira serie automaticamente.

Incluir/desmarcar renda/extra muda a base de totais, nao apaga o registro.
Marcar recebido e independente de prever renda no resultado.

Meta financeira diminui resultado como reserva quando includeInTotals nao e false.
Transferir para patrimonio:
1. Exigir conta destino existente.
2. Bloquear nova transferencia quando ja ha timestamp e movimento associado.
3. Criar aporte com valor da meta, data atual e sourceGoalId/sourceMonthId.
4. Guardar patrimonioMovementId e patrimonioTransferredAt.
5. Nao criar uma segunda renda pessoal.

Depois de transferir, alterar destino exige desfazer a movimentacao vinculada.
Excluir meta trata o movimento associado conforme o fluxo existente.
Nao confundir reserva prevista com patrimonio efetivamente transferido.

# 11. Patrimonio e conciliacao

## 11.1 Saldo por conta

```text
limite = data de consulta ou infinito
checkpoint = mais recente com data<=limite, excluindo ID solicitado
desempatar mesma data por createdAt descendente
saldoBase = checkpoint.balance, senao 0
para movimentos:
  ignorar se data > limite
  ignorar se data <= data do checkpoint
  aporte na conta: somar
  retirada na conta: subtrair
  transferencia de origem: subtrair
  transferencia de destino: somar
  atualizacao: nao somar como aporte
arredondar saldo para 2 casas
```

Atualizacao de saldo salva checkpoint e movimento informativo de atualizacao.
Editar/remover atualizacao deve manter checkpoint correspondente coerente.
Nao tratar saldo conciliado como aporte, pois isso duplicaria patrimonio.

## 11.2 Validacoes e indicadores

Aporte/retirada/transferencia precisam de valor>0.
Atualizacao permite saldo zero. Transferencia exige contas distintas.
IDs e proveniencia sobrevivem a edicao.

Patrimonio total e soma dos saldos das contas filtradas.
Variacao no periodo soma impactos: aporte positivo, retirada negativa,
transferencia/atualizacao sem novo patrimonio liquido pelo helper de impacto.
Comparacao = variacao atual - variacao do periodo anterior.

Filtros 30/90/365 dias criam janelas consecutivas iguais; filtro all usa o mes
real corrente para a comparacao mensal. Variacao e fluxo, nao necessariamente
diferenca de saldo apos conciliacao.

# 12. Categorias, tags e simbolos

## 12.1 Catalogo

Normalizar aliases, remover prefixos de icone legados e descartar categorias
que na verdade sao meios/tipos de pagamento.
Construir lista ordenada sem duplicar por caixa/acentos a partir de:
presets, categorias usadas no predecessor disponivel, usadas no mes,
seeds/manuais/metas e mapas de categoria, e visibilidade explicita true.

O predecessor e o mes disponivel mais recente anterior, nao necessariamente
o mes civil imediatamente anterior.
Categorias com gasto positivo e flags validas alimentam heranca.

Version 2 da visibilidade: somente valor true oferece para novo lancamento.
Versoes anteriores: nao oferecer somente quando false.
Consulta historica pode ignorar visibilidade sem reativar categoria na edicao.
Edicao de registro antigo pode preservar opcao selecionada fora do catalogo.

Tags: trim e NFC; chave comparavel em minusculas pt-BR, sem remover
automaticamente todos os acentos. Descobrir tags nas saidas dos meses e aplicar
visibilidade da competencia. Ordenar por localeCompare pt-BR.

## 12.2 Renomear e mesclar

Renomeacao deve atualizar referencias, aliases, metas, selecoes e regras
do calendario, nao somente o texto da celula.
Mesclagem soma valores de mapas de metas quando ambas as chaves existem e
deduplica listas manuais. Seguir cadeias de alias com guarda de ciclo.
Nao mover dados entre usuarios.

## 12.3 Emojis

Resolver aceita emoji ou ID de icone: food, phone, market, shopping, education,
card, home, health, fun, tag, work, car, bank, invoice, gift.
Converte para simbolo visual; se ausente, infere pela categoria.
O option.value continua nome canonico; o rotulo recebe emoji + nome.
Nao salvar "emoji + categoria" como nova categoria.

# 13. Filtros e pesquisas

## 13.1 Escopo mensal

| Filtro | Conjunto inicial |
|---|---|
| expense/fixed | Planejadas/expense + gastos diretos pix/dinheiro/debito + faturas |
| spend | Apenas gastos segundo o predicado de tipo |
| all | Saidas + faturas |
| card:ID | Saidas do cartao, sem linha de fatura |
| method:METODO | Saidas desse metodo |
| account:ID | Saidas da conta de referencia |

Pesquisa e tag restringem esse conjunto, nunca ampliam para outro mes.
Tag e comparada com trim/minusculas; fatura nao tem tag direta. Planejamento
conserva fatura-cabecalho se uma compra planejada correspondente foi encontrada.

Trocar competencia reinicia a visao para expense, sem tag/busca e com sort
categoria asc no fluxo renderMes. Trocar somente metodo conserva o termo.

## 13.2 Algoritmo mensal

```text
consulta normalizada = NFD, retirar marcas de acento, minusculas, trim
remover R$ e quebrar em tokens por espacos
texto = descricao + categoria + tag + metodo + nome do cartao
numero = data e aliases + valor com 2 casas em ponto/virgula/formato pt-BR
para cada token (todos precisam casar):
  se contem digito: substring exata em numero OU texto
  senao: substring no texto
         OU, se comprimento>=4, busca Fuse nas palavras do texto
```

Fuse: threshold=0.28, ignoreLocation=true, minMatchCharLength=3.
Sem biblioteca, cai para substring exata. Nao aproximar valores ou datas.
Valores/datas permitem consulta parcial por substring, nao igualdade obrigatoria.
1234,57 nao deve casar com valor exclusivo 1234,56 por tolerancia.
Nome com digitos pode casar literalmente no texto.

Durante busca, abrir categorias com resultados e esconder grupos sem
resultado relevante. Estado vazio deve explicar mes/filtro, nao sugerir que
os registros foram apagados.
Digitar filtra a secao, sem salvar lancamentos ou recalcular toda a pagina.

## 13.3 Universal

Ferramenta separada com indice de periodos/tipos e filtros de categoria,
cartao, tag, metodo e intervalo de datas.
Fuse usa pesos descricao 0.5, categoria 0.22, valor 0.18, tag 0.06,
mes 0.04 e metodo 0.04; threshold 0.28, ignoreLocation=true,
minMatchCharLength=2. Nao aplicar implicitamente esse escopo global ao campo mensal.

# 14. Dashboard, historico e graficos

Somente competencias iniciadas ate o mes real sao elegiveis no Dashboard.
Deduplicar por ID. A existencia de um mes virtual futuro nao o torna realizado.
Filtro de ano/mes/periodo deve realmente selecionar competencias desse intervalo.

Para periodo P:
- Renda = soma de rendaTotal de cada mes.
- Despesas = soma de totalGastos.
- Reservas = soma de totalFinancialGoals.
- Saldo previsto = soma de resultadoMes.
- Media mensal de gasto = despesas / quantidade de meses elegiveis filtrados.
- Peso de metas no insight = reservas / renda fixa *100, se renda fixa>0.

Categorias de compromissos e consumo usam suas proprias bases.
Reutilizar totais calculados uma vez por objeto de mes dentro do render;
nao guardar cache eterno que ignore edicao in-place.
Nao renderizar Dashboard Desktop escondido durante uso Mobile.

Historico lista meses elegiveis e respectivas metricas; ordenacao nao muda
competencia nem regrava dados.
Graficos sao apresentacao: ocultar serie, trocar cor ou reordenar indicador
nao altera o motor financeiro.
Sem meses elegiveis, mostrar estado vazio em vez de erro JavaScript.

Ressalva F06: texto de insight de metas pode considerar meta excluida em caminho
legado; nao confundir esse texto com o total canonico.

# 15. Calendario de eventos e ESO

## 15.1 Evento

Normalizar start/end; se apenas um valido, usa-lo para ambos.
Se invertidos, ordenar. Nome vazio vira Evento; budget nao negativo.
O evento aparece em cada dia do intervalo inclusivo.

Gasto do evento consulta saidas e legado nas competencias disponiveis,
usa datas interpretadas e valor efetivo.
Sem tag vinculada, restringe ao intervalo.
Com tag, o algoritmo atual procura correspondencias de tag no conjunto
consultado; havendo correspondencias, usa-as; sem nenhuma, volta ao intervalo.
Isso pode incluir correspondencias fora do intervalo: comportamento vigente,
nao uma garantia de filtro estritamente temporal.

Orcamento do evento nao gera saida financeira.
Participantes compartilhados permitem mostrar recebiveis por pessoa e pendencia.
O calendario nao altera paid somente por a data ter passado.

## 15.2 ESO

Registro: id, data, cliente, tipo, valor, entrada, status, manual.
Status normalizado: Fechado, Aguardando ou Nao fechado.
Exige data, cliente, tipo, valor>0 e entrada ao salvar.

Metricas da lista filtrada:
- Projetos = quantidade.
- Valor = soma valor.
- Fechados = quantidade status Fechado.
- Valor fechado = soma valor desses.
- Em aberto = quantidade total - fechados.
- Aguardando = quantidade status Aguardando.

Modulo e independente de renda/projetos pessoais; so disponivel com permissao.
Nao reconstituir dados reais de clientes do seed privado.

# 16. Internet Banking

## 16.1 Caminho dos dados

Provedor -> worker/webhook -> staging por tenant -> preview/transacoes ->
vinculo conta/cartao interno -> revisao -> comando -> save confirmado.
Preview nao e importacao.
Grupo externo de CREDIT exige cartao interno; conta bancaria usa patrimonio.
Memoria de descricao/categoria/tag utiliza descricao original da origem,
nao apenas a descricao renomeada pelo usuario.

## 16.2 Identidade persistente

```text
partes = [tenantId, provider, accountId, externalId], todas nao vazias
key = "fi1:" + JSON.stringify(partes)
version = 1
quality = native ou source-row
```

Duas compras com mesma data/descricao/valor mas IDs nativos diferentes sao
distintas. Nao deduplicar apenas por texto/valor.
Editar descricao ou categoria conserva importIdentity e proveniencia.

Matcher:
1. Identidade igual -> exact.
2. Sem exact, procurar candidato nao consumido com assinatura igual.
3. Dois IDs native diferentes nunca viram candidato por assinatura.
4. Cada candidato legado so pode ser consumido uma vez no lote.
5. Sem candidato -> new.

Assinatura considera contexto, data, centavos, direcao e descricao normalizada
sem acentos, minusculas e espacos repetidos.
Campos de origem incluem ibImportKey, internetBankingImportKey,
pluggyTransactionId, sourceAccountName, ibAccountNameOriginal, sourceImportId,
sourceRowId, sourceDirection e sourceDescription.

## 16.3 Decisao e confirmacao

Duplicata exata nao cria novo lancamento. Candidato confiavel exige decisao
de importar como novo ou desmarcar. Ausencia de identificador confiavel nao
exibe mais aviso extra, por decisao expressa do usuario; risco de repeticao
sem ID nao desapareceu.

Adicionar um:
- Bloquear concorrencia duplicada de commit.
- Validar grupo, vinculo, linha, categoria e decisoes.
- Aplicar credito em outflow, conta em movimento patrimonial.
- Registrar marcadores e protecao de retry local.
- Aguardar save(true).
- Pendente: manter na lista e mostrar aviso de salvamento pendente.
- Confirmado: remover linha, limpar staging local e mostrar sucesso.
- Erro: indicar linha/mensagem, nao anunciar sucesso.

Adicionar todos processa elegiveis e informa adicionados, duplicados,
sem categoria e erros. Sucesso parcial nao deve esconder falhas.
Mobile usa o mesmo controlador e snapshot, nao outra lista canonica.

Importados/ignorados persistem por usuario. Ao reconstruir marcadores, ler
identidades dos registros salvos; renomear registro nao faz origem reaparecer.
Estorno/reembolso nao vira nova despesa positiva silenciosamente.

# 17. PDF, Oracle AI e concorrencia externa

PDF e Pluggy sao trilhas independentes. Nao existe conciliacao universal
automatica entre os dois conjuntos.
Documento/job -> extracao estruturada -> esquema/revisao -> plano de importacao
-> validacao de categoria/cartao/mes -> persistencia confirmada.

Identidade de linha de fatura:
provider=invoice, tenant autenticado, accountId=cartao,
externalId=jobId + ":" + sourceRowId (ou indice de origem).
Decisao candidate exige duplicateDecision=new para importar como novo.
Credito/estorno, sourceDirection=credit ou amount<0 exige revisao.

Reprocessar job ativo nao zera resultado nem enfileira copia.
Fila cheia responde 503 antes de criar arquivo/trabalho extra.
Evento webhook excessivo responde 413 antes de SQL.

Limites padrao:

| Configuracao | Valor |
|---|---:|
| PLUGGY_HTTP_TIMEOUT_MS | 45000 |
| ORACLE_AI_TIMEOUT_MS | 45000 |
| ORACLE_AI_CLI_TIMEOUT_MS | 120000 |
| ORACLE_DB_QUEUE_TIMEOUT_MS | 30000 |
| ORACLE_DB_QUEUE_MAX | 100 |
| ORACLE_DB_CALL_TIMEOUT_MS | 45000 |
| INVOICE_MAX_PENDING_PER_USER / TOTAL | 10 / 100 |
| INVOICE_PARSE_MAX_PENDING_PER_USER / TOTAL | 5 / 20 |
| ORACLE_AI_MAX_PENDING | 20 |
| PLUGGY_WEBHOOK_MAX_PENDING_PER_USER / TOTAL | 20 / 100 |
| PLUGGY_WEBHOOK_MAX_TRANSACTIONS | 1000 |

Fila conta trabalho em execucao como pendencia. Mesmo tenant/job ativo
compartilha Promise; tenants distintos nao. Falha libera contadores e sucessores.
Fila de usuario preserva retry adicional legado; fila PDF nao repete falha extra.
HTTP inclui headers/corpo no prazo. OCI usa processo assincrono sem shell,
limite de stdout e terminacao. Oracle faz rollback/close em falha, sem commit
automatico no sucesso; callTimeout e por round trip, nao prazo total do job.

SQL usa tenant + identidade externa. Worker atualiza balance_amount, webhook
nao. Persistencia financeira principal continua fora desse staging.

# 18. Persistencia e recuperacao

## 18.1 Guardas

Revisao conflita quando existe revisao atual e baseRevision difere dela,
inclusive quando cliente manda revisao vazia.

Protecao contra perda de meses:
```text
previous = quantidade anterior
next = quantidade proposta
bloquear se previous>=10
        E next<previous-2
        E next<ceil(previous*0.8)
```

Verificar revisao ANTES dessa protecao.
De 10 para 8 nao bloqueia por essa guarda; de 10 para 7 bloqueia.
De 9 para 0 nao bloqueia por essa guarda especifica, embora outras validacoes
possam falhar. Nao anunciar protecao absoluta contra toda exclusao.

## 18.2 Publicacao JSON

Estado logico e normalizado, finData invalido vira [], schema resolvido.
Geracao aleatoria de 12 bytes em hexadecimal.
Nova revisao = ISO(max(agora, revisaoAnterior+1ms)).
Limite logico de armazenamento: 15 MiB.
Body de app-state tem limite HTTP configuravel, padrao 20mb.

Particoes:
- months: finData, particionamento anual by-year-v1.
- patrimonio: contas/movimentos.
- eso: finEsoData.
- rules: calendario, aliases, regras, cores e emojis.
- ui: titulos, filtros, series, layout e preferencias.
- core: demais chaves, inclusive compativeis desconhecidas.

Gravar arquivos de nova geracao e conferir hashes antes de publicar manifest.
Falha antes da publicacao remove somente arquivos dessa nova geracao.
Manifest antigo continua valido. Limpeza de arquivos nao referenciados e
posterior; falha de limpeza nao desfaz o commit confirmado.
Leitura valida owner do envelope.

## 18.3 Cliente e varias abas

Manter cache, dirtyKeys, revisao, snapshot em envio e Promise do flush.
Se outra gravacao acontece durante flush, comparar snapshots. Um save forcado
deve aguardar sua versao, nao apenas retornar sucesso da versao anterior.

Ao responder sucesso, limpar so chaves ainda iguais ao snapshot enviado.
Emitir revisao para outras abas. Em conflito:
- proteger pendencia local;
- pausar autosave;
- pedir recarga/reconciliacao;
- nao sobrescrever silenciosamente.

Erro de rede protege pendencia e retorna false.
PendingSync usa IndexedDB meufin-pending-sync/drafts, chave por usuario/aba,
AES-GCM 256, IV 12 bytes e CryptoKey nao exportavel.
E protecao local de rascunho, nao backup remoto ou defesa contra XSS.

Bootstrap falho nao deve substituir financas por ambiente vazio e salvar.
Migracao legada so escreve quando ainda nao ha app-state; corrida exige
recarregar estado/revisao oficiais.

# 19. Auth, permissoes e criptografia

Hash de senha:
PBKDF2 SHA-512, 210000 iteracoes, salt aleatorio 16 bytes, chave 32 bytes.
Formato pbkdf2$algoritmo$iteracoes$saltBase64$hashBase64.
Comparar com timingSafeEqual apos verificar tamanhos.
Comprimento minimo configurado tem piso de 8 caracteres.

Chave de dados:
PBKDF2 SHA-512, 210000 iteracoes, 32 bytes, salt de criptografia do usuario.
AES-256-GCM com IV aleatorio de 12 bytes.
Envelope enc$ + Base64(JSON com v, alg, iv, tag, data).
Senha de login, chave de dados e segredo de sessao sao conceitos diferentes.
Trocar/resetar senha exige preservar/reencriptar dados conforme fluxo,
nao somente trocar o hash e tornar o estado indecifravel.

Sessao: cookie HttpOnly, regras secure/SameSite conforme ambiente/proxy.
Persistencia de sessao em arquivo. Remember-me usa token opaco e hash HMAC,
com chave de wrapping para recuperar contexto conforme implementacao.
Nao guardar senha em cookie ou log.
CSRF exige token da sessao nos endpoints mutantes aplicaveis.
Validar novamente permissoes no servidor; esconder botao nao e autorizacao.

Limites de tentativas usam janela de 15 minutos:
login 10, cadastro 5, dica 10, pedido reset 6, confirmacao reset 8,
login desenvolvedor 8, conforme configuracao de rota.

Perfil valida e-mail, telefone brasileiro e avatar PNG/JPEG/WebP Base64 com
limite de 600000 caracteres. Nome de pasta pode mudar sem perder ownership.
Nao usar nome exibido como unica chave de seguranca.

Ressalvas de seguranca conhecidas nao devem ser copiadas como recomendacao:
configuracao de webhook, logs de reset e origem do host de links exigem revisao.

# 20. Contratos HTTP

JSON UTF-8; erro normalmente usa message. Owner financeiro vem da sessao.
Nao enviar credenciais reais nos exemplos.

## 20.1 Bootstrap e gravacao

GET /api/app/bootstrap retorna:
```json
{
  "session": {
    "authenticated": true,
    "id": "usuario-ficticio",
    "username": "usuario-teste",
    "displayName": "Pessoa Teste",
    "csrfToken": "token-da-sessao",
    "permissions": { "canAccessESO": false }
  },
  "profile": {},
  "permissions": { "canAccessESO": false },
  "isPrimaryUser": false,
  "legacySeed": null,
  "appState": { "finData": [] },
  "stateRevision": "2026-10-26T12:00:00.001Z",
  "hasServerState": true,
  "shouldStartEmpty": false
}
```

PUT /api/app-state recebe state e baseRevision, com X-CSRF-Token.
Retorna ok=true e updatedAt quando persistido.
409 de revisao inclui conflict=true e currentRevision.
409 de perda de meses inclui contagens anterior/proposta.
Erro de leitura segura no bootstrap retorna 500, nao estado vazio substituto.

POST /api/app-state/migrate-legacy:
state; se ja existe estado, ok=true/migrated=false, sem sobrescrita.

## 20.2 Grupos de rotas

| Metodo | Caminho | Funcao |
|---|---|---|
| GET | /api/health | Disponibilidade |
| GET | /api/auth/login-config | Configuracao publica do login |
| GET | /api/auth/session | Estado de sessao |
| POST | /api/auth/login | Login e opcao de lembrar |
| POST | /api/auth/register | Cadastro independente |
| POST | /api/auth/logout | Encerrar sessao/lembranca |
| POST | /api/auth/password-hint | Dica conforme protecoes |
| POST | /api/auth/password-reset/request | Solicitar recuperacao |
| POST | /api/auth/password-reset/confirm | Confirmar token e senha |
| GET/PUT | /api/profile | Ler/atualizar perfil autenticado |
| POST | /api/profile/change-password | Troca de senha |
| POST | /api/profile/delete-account | Exclusao autenticada |
| POST | /api/backups/manual | Backup manual |
| POST | /api/backups/auto-exit | Backup de saida com protecoes especificas |
| GET | /api/pluggy/connection | Estado da conexao |
| GET | /api/pluggy/preview | Preview de staging |
| GET | /api/pluggy/transactions | Pendencias/transacoes externas |
| POST | /api/pluggy/webhook | Receber evento do provedor, auth propria |
| POST | /api/bill-import/parse | Parse direto de documento |
| POST | /api/invoice/upload | Criar job de fatura |
| GET | /api/invoice/status | Listar estado de jobs |
| GET | /api/invoice/result/:jobId | Resultado do job do usuario |
| POST | /api/invoice/reprocess/:jobId | Reprocessar elegivel |
| POST | /api/invoice/import | Aplicar revisao/plano |
| GET | /api/muplug/connection | Estado da integracao Muplug |
| POST | /api/muplug/upload | Upload Muplug |
| GET | /api/muplug/jobs | Jobs do usuario |
| GET | /api/muplug/status/:jobId | Status individual |
| GET | /api/muplug/result/:jobId | Resultado individual |
| POST | /api/muplug/reprocess/:jobId | Reprocessar |
| POST | /api/muplug/import | Importar revisao |
| POST | /api/widget/generate-token | Gerar token individual |
| POST | /api/widget/revoke-token | Revogar |
| POST | /api/widget/rebuild-snapshot | Atualizar derivado |
| GET | /api/widget/token-status | Consultar token |
| GET | /api/widget/finance-summary | Resumo por token |
| GET | /api/widget/script/latest | Script por token |
| GET | /api/developer/session | Sessao desenvolvedor |
| POST | /api/developer/login | Login especial |
| POST | /api/developer/logout | Logout especial |
| POST | /api/developer/change-password | Senha especial |
| GET | /api/developer/users | Administracao autorizada |
| GET | /api/developer/users/:userId/backups | Listar backups autorizados |
| POST | /api/developer/users/:userId/backups/:backupId/revalidate | Validar backup |
| POST | /api/developer/users/:userId/backups/:backupId/restore | Restaurar |
| GET | /api/developer/report | Relatorio operacional |

As rotas de sessao comum exigem autenticacao; mutacoes normalmente exigem CSRF.
Webhook e widget por token sao excecoes com mecanismo proprio.
Os corpos exatos e mensagens de cada rota constam no codigo completo embarcado,
evitando depender de inferencia deste resumo.
Retornos 400, 401, 403, 409, 413, 429, 500 e 503 precisam ser tratados pelo cliente.

# 21. Interface, eventos e estados

Desktop tem paginas, modais de lancamento/cartao/renda/metas/patrimonio e
edicao inline. Mobile tem telas equivalentes e formularios/sheets proprios.
Ambos devem oferecer cancelar sem alterar registro, loading, erro, vazio,
sucesso confirmado e tentativa de salvamento pendente.

AppEvents emite CustomEvent no document.
mobileDataChanged significa snapshot LOCAL atualizado.
app:navigated e emitido apos navegacao.
Inicializacao deve ser idempotente: nao duplicar listeners, botoes ou timers.
Nao envolver save/nav repetidamente para notificar telas.

Mobile tem cache por usuario, invalidacao mensal e refresh da tela ativa.
Uma edicao de valor sem mudar quantidade precisa invalidar metricas.
Nao renderizar todo Desktop escondido em cada acao Mobile.

CSS Mobile segue ordem: onboarding, feedback, navigation, forms-and-charts,
shell e screens. A cascata e parte da equivalencia visual.
Assets, fontes externas, Chart.js e Fuse.js sao definidos no HTML.
O pacote inclui recursos visuais locais; dependencias de CDN nao estao embutidas.

Status global tem role=status/aria-live=polite, aberto por classe open.
Sucesso usa classe ok; mensagem nao deve sumir atras do sheet.
Inputs/botoes precisam de rotulos acessiveis e layout sem overflow.

Nomes das rendas fixas/extras e cabecalhos dessas secoes aparecem em caixa alta
fora da edicao, inclusive depois de renomear. A transformacao e de apresentacao:
preservar a grafia original armazenada para mostrar no editor. Inputs nao devem
herdar caixa alta da celula/cabecalho. A regra vale no Desktop e Mobile e nao
altera valores, identificadores, aliases ou propagacao de recorrencia.

M10 foi revertido por decisao do usuario. O snapshot e o comportamento vigente,
nao a proposta descartada, sao a referencia de reconstrucao.

# 22. Backup, widget e operacao

## 22.1 Backups e exportacao

Backups sao isolados por userId, com ownership validado na restauracao.
ID de backup aceita somente letras/numeros/underscore/hifen, entre 6 e 120.
Padroes: 50 recentes e ate 12 ancoras mensais. Nao assumir limite absoluto de
50 incluindo todas as ancoras.
FIN_MAX_BACKUPS_PER_USER=0 cai no padrao; nao significa sem poda.
Cooldown automatico geral padrao 30 minutos.
Saida usa FIN_AUTO_EXIT_BACKUP_MIN_MS, padrao 6 horas e piso 5 segundos.

Restore JSON publica revisao nova, limpa caches e invalida abas antigas.
Nunca restaurar sob a revisao do backup, pois abas antigas poderiam gravar.
Backup/exportacao deve incluir calendario, excecoes, patrimonio e marcadores de
origem; nao exportar somente linhas visiveis da competencia.
Importacao respeita owner, formato/versao e valida estado antes de substituir.

Nao estender garantias de restore JSON ao SQLite antes de corrigir F03/F04.

## 22.2 Widget

Token individual gerado/revogado em rota autenticada.
Endpoint por token oferece snapshot derivado, nao app-state completo.
Selecionar mes real atual projetado, senao ultimo finData como fallback.
Calcular commitments e consumption usando motor compartilhado.
Retorno: updatedAt, monthLabel, monthlyExpenses, monthlyIncome, result,
reservedGoals, basis=commitments, currency=BRL, goals.

Widget inclui dailyGoals positivos; gasto de categoria vem da base consumption.
percentage=round(spent/goal*100). Ordenar metas por percentual descendente.
Aliases de categoria devem seguir cadeia com guarda de ciclo.
Falha ao gerar widget depois de commit nao desfaz o estado financeiro.

## 22.3 Hospedar e configurar

npm ci instala lockfile; npm start inicia server.js.
FIN_STORAGE_DIR define armazenamento persistente; sem valor usa raiz.
Nao colocar storage dentro de pasta que sera apagada na publicacao.
Definir FIN_SESSION_SECRET em producao e preservar chaves de dados.
PORT padrao 3000; proxy HTTPS deve ser configurado coerentemente.

Publicacao vigente:
main -> workflow GitHub -> npm ci -> audit critical -> SCP -> npm install
--omit=dev -> pm2 restart all, com fallback conforme script embarcado.
Workflow nao executa npm test/smoke. Nao possui rollback atomico automatico.
Pode reiniciar mais de um processo PM2.
Contas Oracle/Pluggy/SMTP e secrets GitHub precisam ser provisionados de novo.

# 23. Plano de reconstrucao

## Caminho A: recuperar a edicao funcional do pacote

1. Obter Node.js e acesso ao registro de dependencias.
2. Usar o extrator completo do Anexo A com este documento e pasta vazia.
3. Conferir hashes e inventario; nao extrair em diretorio com dados.
4. Executar npm ci na pasta reconstruida.
5. Definir FIN_STORAGE_DIR para pasta nova de teste e segredo de sessao proprio.
6. Executar npm test; observar teste de seed adaptado e quantidade diferente.
7. Iniciar npm start e cadastrar duas contas ficticias.
8. Reexecutar os casos do capitulo 24.
9. Configurar provedores somente depois de validar financeiro/local.
10. Revisar seguranca/ressalvas antes de expor ao publico.

Nenhum banco pessoal ou senha real e necessario para testar esse caminho.

## Caminho B: reimplementar em outra tecnologia

1. Implementar entidades, ownership, centavos e normalizacao de datas.
2. Implementar fatos e tres bases; aprovar exemplos numericos.
3. Implementar saidas/rendas/faturas/metas e comandos com resultado explicito.
4. Implementar modelo continuo, revisoes e compactacao de excecoes.
5. Implementar catalogos/visibilidade e busca escopada.
6. Implementar patrimonio/checkpoints e vinculos com metas.
7. Implementar HTTP, revisoes, backup, pendencia e protecoes de corrida.
8. Implementar telas Desktop/Mobile como adaptadores do mesmo dominio.
9. Implementar identidade externa/revisao e provedores substituiveis.
10. Aprovar testes de equivalencia sem copiar defeitos como recomendacoes.

Uma tecnologia diferente pode mudar organizacao interna, mas nao deve alterar
formulas, datas ou escopo sem decisao de produto documentada.
Compatibilidade byte a byte de armazenamento antigo exige preservar formatos
de criptografia/envelope e adapters, nao apenas os nomes dos campos.

# 24. Casos de aceitacao

| ID | Acao/cenario | Resultado obrigatorio |
|---|---|---|
| R01 | Cadastrar duas contas | Estados independentes |
| R02 | Abrir usuario novo | Sem financas/ESO de outra pessoa |
| R03 | Somar 0,10 e 0,20 como fatos | 30 centavos |
| R04 | Exemplo completo 6.1 commitments | I=5500, E=2000, G=400, R=3100 |
| R05 | Exemplo 6.1 consumption | E=1550, R=3550 |
| R06 | Exemplo 6.1 cash | I=5000, E=200, G=0 |
| R07 | ManualAmountSet zero e forecast 90 | Fatura efetiva zero |
| R08 | Compartilhar 120 por 3 | Peso pessoal 40 |
| R09 | Participante owner zero explicito | Nao cair em valor total da compra |
| R10 | Manual soma fora de tolerancia | Recusar sem salvar |
| R11 | Debito passado novo | Pago automaticamente |
| R12 | Debito futuro novo | Nao pago |
| R13 | Editar pago existente | Preservar paid |
| R14 | Projetar recorrencia | Reiniciar paid/participantes pagos |
| R15 | Dia isolado 10 em outubro | 10/11/26 no fluxo +1 |
| R16 | Data explicita em outubro | Preservar data completa |
| R17 | 31/02 explicito | Recusar |
| R18 | Parcela 3/5 em outubro | 4/5 novembro, 5/5 dezembro, ausente janeiro |
| R19 | Abrir mes distante sem predecessor | Renda/serie continua disponivel |
| R20 | Navegar 24 meses sem editar | Nao materializar todos no save |
| R21 | Excluir ocorrencia local | Nao reaparecer no reload |
| R22 | Editar serie daqui para frente | Preservar passado e excecoes |
| R23 | Trocar cartao da recorrencia | Proximas ocorrencias no novo cartao |
| R24 | Fatura+compras no compromisso | Nao somar duas vezes |
| R25 | Catalogo v2 false/ausente | Nao oferecer como nova selecao |
| R26 | Consulta historica categoria oculta | Continuar encontravel |
| R27 | Categoria com emoji | Valor salvo sem emoji prefixado |
| R28 | Buscar condomnio | Encontrar Condominio por Fuse |
| R29 | Buscar 1234,57 | Nao aproximar para 1234,56 |
| R30 | Buscar em PIX | Nao mostrar dinheiro/cartao/mes diferente |
| R31 | Buscar em Gastos | Abrir categorias com resultados |
| R32 | Busca sem match | Estado vazio, sem apagar dados |
| R33 | Dashboard ano anterior | So meses elegiveis daquele ano |
| R34 | Mes futuro no Dashboard | Nao tratar como iniciado |
| R35 | Checkpoint 750 + aporte posterior100 | Saldo 850 |
| R36 | Movimento no dia do checkpoint | Nao somar novamente |
| R37 | Transferencia entre contas | Patrimonio liquido nao aumenta |
| R38 | Meta transferida duas vezes | Bloquear segundo aporte |
| R39 | Dois IDs nativos distintos com mesmos fatos | Duas compras validas |
| R40 | Mesmo ID importado novamente | Nenhuma compra nova |
| R41 | Candidato legado repetido num lote | Consumo do candidato no maximo uma vez |
| R42 | Falha de save apos importar local | Manter revisao e retry sem duplicar |
| R43 | Sucesso de Internet Banking | Avisar so depois de confirmar save |
| R44 | Estorno PDF negativo/credit | Exigir revisao, nao criar despesa positiva |
| R45 | Mesma chave de job ativo | Reutilizar Promise, nao resetar job |
| R46 | Fila cheia | 503 antes de gerar trabalho |
| R47 | Revisao antiga ou vazia sobre estado existente | 409 |
| R48 | Reducao de 10 para 7 meses | Bloqueio de perda |
| R49 | Dois saves JSON no mesmo milissegundo | Revisoes distintas |
| R50 | Falha antes do manifest | Estado anterior legivel |
| R51 | Restore JSON | Nova revisao; aba antiga nao sobrescreve |
| R52 | Outro usuario tenta acessar job/backup | Recusar ownership |
| R53 | Falha de widget depois de commit | Estado continua salvo |
| R54 | Init Mobile repetido | Sem listeners duplicados |
| R55 | Editar renda sem aumentar lista | Metricas Mobile invalidam cache |
| R56 | Evento/tag sem matches | Fallback temporal vigente |
| R57 | Fechamento ESO | Nao virar renda pessoal automaticamente |
| R58 | Extrair documento em pasta ocupada | Recusar sem sobrescrever |
| R59 | Alterar byte do pacote | Detectar corrupcao |
| R60 | Caminho ../ no pacote | Recusar extracao |

Suite do produto antes desta entrega: 481 testes Node e 15 cenarios de navegador.
Esta entrega acrescenta testes do extrator. Edicao sem seed privado substitui
os testes especificos de dados historicos privados; nao esperar mesma contagem.
Smoke usa contas sinteticas, nao bancos ou dados reais.
Benchmark antigo requer historico Git adicional; o documento nao inclui esse
historico. Ferramentas audit:system podem escrever e nao sao testes inocuos.

# 25. Ressalvas: o que nao esta resolvido

A reconstrução literal tambem herdaria problemas. Eles nao devem ser confundidos
com requisitos desejaveis:

- SQLite: restore JSON pode nao atualizar a copia SQLite prioritaria.
- SQLite: revisao pode repetir com relogio congelado.
- Dependencias: etapa 7 registrou alerta alto de Nodemailer; deploy critical
  aprovado nao significa audit high limpo.
- Datas renda 31/01 projetada em fevereiro: navegador faz clamp, servidor pode
  preservar data explicita original.
- Projeto com data completa: adaptadores divergem entre preservar e projetar.
- Parcela com compra dia 10 e fechamento20: navegador pode usar20, servidor10.
- Origem de parcela sem cartoes: navegador pode cair em dia1; servidor preserva
  deslocamento original.
- Payload bruto incoerente de parcela unica/participante pago pode ser
  normalizado diferentemente nos adaptadores.
- F06: texto de metas excluidas pode divergir do calculo canonico.
- Webhook sem segredo estrito, origem de host em recuperacao e logs de link
  de reset exigem revisao especifica; nao reproduzir como pratica segura.
- Locks nao distribuidos e jobs nao retomados automaticamente apos restart.
- Ausencia de ID de origem pode permitir duplicata mesmo sem aviso.
- Teste de edicao Mobile apresentou intermitencia de foco na revisao documental
  anterior e passou ao repetir; causa nao foi corrigida nesta entrega.
- Nao ha certificacao de Oracle real, SMTP, latencia de producao, dispositivo
  fisico ou recuperacao operacional sob desastre.

Nao promover o sistema reconstruido para uso real antes de revisar esses itens.
Este documento explica e preserva o comportamento, nao concede selo de seguranca.

# 26. Como manter esta especificacao viva

Parte explicativa editavel: docs/MEUFIN-ESPECIFICACAO.md.
Gerador: scripts/build-reconstruction-manual.js.
Documento independente gerado: docs/MEUFIN-RECONSTRUCAO-COMPLETA.md.
Verificador/extrator: scripts/reconstruct-from-manual.js.

Quando mudar uma regra, atualizar explicacao, exemplo e caso de aceitacao.
Depois regenerar o documento completo e conferir integridade. Nao editar o
Base64 manualmente. O pacote e snapshot, nao segue automaticamente o repositorio.
Regenerar nao incorpora usuarios, backups ou credenciais de ambiente.

Comandos da entrega:
```powershell
node scripts/build-reconstruction-manual.js
node scripts/reconstruct-from-manual.js docs/MEUFIN-RECONSTRUCAO-COMPLETA.md
npm test
npm run test:smoke
```

O codigo completo anexado fornece detalhes literais de validacao, UI, rotas,
formatacao e adaptadores nao transcritos linha por linha nos capitulos.
As explicacoes permitem reimplementar a logica; o pacote permite recuperar
os arquivos da edicao sem adivinhar os detalhes de implementacao.

## Evidencia desta entrega

- 487 testes Node aprovados no workspace original, incluindo os seis novos
  testes do extrator e dos exemplos numericos.
- Extracao de 258 arquivos a partir exclusivamente do pacote no documento.
- 484 testes Node aprovados na copia reconstruida. A diferenca de tres testes
  ocorre porque os quatro testes do seed privado sao substituidos por um teste
  de ausencia de seed; o historico pessoal nao foi copiado.
- 15 cenarios de navegador aprovados na copia reconstruida, zero erros de
  pagina e zero escritas financeiras no servidor da fixture.
- Servidor da copia iniciou com storage sintetico isolado: health, login e
  asset financeiro responderam 200; bootstrap sem sessao respondeu 401.
- Dependencias npm ja disponiveis na maquina foram reutilizadas na verificacao
  da copia. Nao foi ensaiada uma instalacao npm ci em outra maquina sem cache.
- O smoke da copia obteve as bibliotecas externas necessarias; nao certifica
  execucao sem internet ou disponibilidade futura dos CDNs.

O manual completo deve ser preservado como arquivo de entrada: nao e incluido
recursivamente dentro de seu proprio pacote. O gerador inclui fontes versionadas
das pastas permitidas e os novos arquivos explicitos desta entrega. Novos modulos
devem estar versionados antes de uma futura regeneracao.
Os hashes do inventario representam a edicao sanitizada, nao o seed original.

## Atualizacao: responsividade e sessao restaurada

O Dashboard continua usando os mesmos totais e series financeiras. Seu layout
visual agora observa a largura real do conteiner. Com menos de 1040 px, os
widgets passam a grid; abaixo de 720 px, uma coluna. A disposicao ampla salva
nao e substituida por esses ajustes temporarios. Redimensionar nao deve gravar
dados financeiros nem gerar backups. O fallback de layout nunca deve exceder
a largura recebida, mesmo se a largura minima de edicao ampla for maior.

`ChartPresentation` oferece apresentacao compartilhada: tabela com caption e
cabecalhos, escape de textos, cores do tema, abreviacao de escalas e tamanho
do bitmap proporcional ao DPR (limitado a 3). Valores completos continuam
na tabela, sem arredondar o modelo financeiro para abreviar o eixo.
Mobile mede o texto do eixo Y e espaça os rotulos X. Desktop e Mobile
associam canvas e tabela por aria-describedby. Essa implementacao nao substitui
homologacao por leitor de tela e aparelho fisico.

O controlador de inicializacao permanece atento ao breakpoint Mobile depois
da primeira carga. O loader reutiliza sua promessa e nao carrega outra copia
dos mesmos modulos ao cruzar novamente o limite.

Na recuperacao de pending draft, revisao divergente nao bloqueia edicao quando
as unicas diferencas efetivas sao preferencias visuais permitidas. Somente essas
chaves sao aplicadas ao estado atual; finData e demais valores financeiros do
snapshot antigo nao sao copiados. Se qualquer diferenca pendente for financeira,
o bloqueio de conflito permanece e exige intervencao/recuperacao protegida.
Um snapshot sem diferencas efetivas pode ser descartado sem perder alteracoes.

Remember-me nao cria uma sessao a partir de mutacoes POST/PUT de pagina antiga.
Uma navegacao GET/HEAD pode restaurar a sessao; a nova pagina recebe seu token
CSRF. Nunca aceitar token antigo ou remover CSRF para contornar essa transicao.

Testes novos: helpers de apresentacao, recuperacao de preferencias sem
sobrescrita financeira e `npm run test:responsive`. O historico de evidencias
anteriores acima nao e reescrito como se tivesse exercitado essas mudancas.
