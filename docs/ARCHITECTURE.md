# Arquitetura do MeuFin

Atualizado em 27/10/2026. Base anterior ao redesign: `67fa380`.
Este guia descreve o sistema implementado. Relatorios em `refatoracao/` sao
historicos: suas contagens e limites correspondem a cada etapa, nao ao presente.
Indice: [README.md](README.md). Resumo: [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md).

Para reconstrucao independente do repositorio, consultar
[MEUFIN-RECONSTRUCAO-COMPLETA.md](MEUFIN-RECONSTRUCAO-COMPLETA.md), com contratos,
formulas, exemplos e pacote-fonte sanitizado. Este guia e o mapa resumido.

## 1. Visao geral

### Mobile: revisao visual de 27/10/2026

MobileV2 usa os mesmos comandos e consultas financeiros. Os ajustes mobile em
`mobile-design.css` ficam restritos a `html.mobile-v2`: periodo explicito,
resumos adaptaveis, ranking com expansao, categorias/metas com distribuicao
recolhida, duas trilhas de visoes/meios e historico agrupado por ano.
`sheet-accessibility.js` coordena foco, fundo inerte e ordem de sheets e modais
de confirmacao, preservando o z-index original ao fechar. Avisos sao espelhados
como alertas no dialogo ativo. O modulo nao salva nem altera dados financeiros.
Esc/toque externo/Voltar no editor solicitam confirmacao para descartar rascunho;
salvar confirmado continua fechando, enquanto pending/retry mantem o contrato.
Pesquisa mobile reaproveita `getUnifiedFilterRows` no mes atual, sem mudar a
consulta financeira nem fazer aproximacao numerica. Testes adicionais:
`npm run test:mobile-design`. Emulacao nao homologa aparelho/teclado fisico.

### Apresentacao visual vigente (27/10/2026)

`public/app/product-design.css` concentra
os tokens claro/escuro e os ajustes visuais compartilhados. Nao altera contratos
de estado, calculos ou persistencia. Inter continua sendo a fonte da interface.
O seletor de competencia tambem usa esses tokens, incluindo painel, ano,
mes selecionado e acoes, sem alterar a janela de anos ou a selecao financeira.
Dashboard usa grade fluida quando o layout e o padrao; um layout personalizado
continua sendo aplicado, inclusive depois de concluir a organizacao. O botao
Organizar painel somente exibe os controles de mover/redimensionar. O modo de
edicao e temporario; as posicoes continuam na preferencia existente.

Categorias mostram ranking com valores completos e barras proporcionais,
mantendo compromissos/consumo distintos e a pizza em uma area recolhivel.
As tabelas acessiveis dos graficos permanecem. O resumo de resultado explicita
a reserva em metas incluidas, obtida dos totais canonicos do periodo.
No formulario Desktop, copiar lancamento e um details/summary recolhivel.
No calendario Mobile, celulas mostram dia e indicador; valores completos ficam
no nome acessivel do dia e na lista do dia selecionado. Nenhum registro e removido.

Aplicacao web multiusuario em Node.js/Express, sem framework SPA ou compilacao
do frontend. Desktop e MobileV2 apresentam o mesmo estado financeiro.

```text
Desktop / MobileV2
  -> consultas e comandos financeiros compartilhados
  -> estado local por usuario / fila de sincronizacao
  -> HTTP: sessao, CSRF, identidade, validacao e limites
  -> servicos de app-state e backup
  -> stores JSON particionado (padrao) / SQLite opcional

Pluggy -> staging Oracle -> revisao explicita -> dominio financeiro
PDF/Oracle AI -> extracao/plano -> revisao explicita -> dominio financeiro
App-state -> projecao/snapshot -> widget individual
```

Oracle Cloud e hospedagem; Oracle Database e usado nas integracoes, nao e o
banco principal de todo o app-state. SQLite nao e o padrao nem esta aprovado
irrestritamente. Nenhuma integracao deve decidir sozinha o financeiro final.

## 2. Mapa de responsabilidades

| Local | Responsabilidade |
|---|---|
| `server.js` | Composicao Express, dependencias, middlewares, rotas e assets |
| `server/http/security.js` | Protecoes HTTP, sessao, cookies, CSRF e limites |
| `server/http/routes/` | Contratos HTTP, identidade da sessao e validacao |
| `server/services/app-state-service.js` | Bootstrap/recuperacao, revisao, perda de meses, commit e widget auxiliar |
| `server/services/backup-service.js` | Criacao manual/automatica e cooldown |
| `server/state-store-factory.js` | Selecao do backend de app-state |
| `server/app-state-store.js` | JSON, compatibilidade, particoes e publicacao atomica |
| `server/backup-store.js` | Backup/restore, ownership, retencao e ancoras |
| `server/repositories/pluggy-staging.js` | DDL e MERGEs comuns ao webhook/worker |
| `server/jobs/serial-queue.js` | Serializacao, admissao e compartilhamento de job ativo |
| `server/integrations/` | Prazos HTTP e processos externos assincronos |
| `public/app/modules/shared/` | Valores, datas, fatos financeiros, catalogos e projecao |
| `public/app/modules/mes-atual/` | Comandos, seletores, filtros, cartoes, recorrencia e totais |
| `public/app/modules/mobile-v2/` | Telas e adaptadores Mobile |
| `tests/`, `scripts/` | Contratos, fixtures e ferramentas de validacao |

Servicos recebem funcoes por injecao, nao `req/res`, Express ou caminhos de
arquivos. Stores persistem; rotas traduzem erros/resultados para HTTP.
Nem toda rota foi esvaziada: autenticacao, perfil e partes da importacao ainda
possuem orquestracao nos modulos existentes.

## 3. Estado, bootstrap e sincronizacao

A fonte persistida oficial e o app-state por usuario autenticado. O schema e
normalizado em `server/state-schema.js`. `server/paths.js` usa `FIN_STORAGE_DIR`;
sem essa variavel, usa a raiz do projeto. Dados reais nao devem ser versionados.

Chaves relevantes de `public/app/storage.js`:

- `finData`: meses materializados e excecoes persistidas.
- `finCalendarModel`: regras do calendario continuo.
- `finPatrimonioAccounts` / `finPatrimonioMovements`: patrimonio.
- `finMetas`, `finEsoData`, `finPluggyBankingState`: dominios especificos.
- Preferencias, catalogos, cores, versoes e migracoes de UI.

Storage local e separado por usuario; partes financeiras passam pela camada de
criptografia. O cliente ainda usa scripts globais e variaveis lexicais:
`window.data` nao e acessor obrigatorio. Usar `getCurrentMonth`,
`getAllFinanceMonths` e os adaptadores existentes.

Fluxo de escrita:

1. Comando valida o rascunho e altera o dominio em memoria.
2. `save` atualiza snapshot local e agenda/aguarda flush conforme a chamada.
3. A requisicao leva a revisao conhecida; a rota usa a identidade da sessao.
4. O servico verifica revisao antes da protecao contra perda de meses.
5. O store publica o estado e o cliente recebe a nova revisao.

`save(true)` aguarda confirmacao. Resultado `pending` nao e sucesso; retry nao
deve aplicar novamente o mesmo lancamento. Conflitos retornam `409`, nao devem
ser contornados sobrescrevendo automaticamente. Falha auxiliar do widget nao
desfaz um commit confirmado. `mobileDataChanged` informa mudanca LOCAL, nao
gravacao no servidor. `AppEvents` emite eventos sem reinstalar wrappers de save/nav.

JSON e o padrao. `FIN_STATE_BACKEND=sqlite` seleciona SQLite quando disponivel,
com leitura prioritaria SQLite e mirror JSON. Esse caminho possui ressalvas de
restore/revisao; nao presumir o backend online sem verificar sua configuracao.
Publicacao atomica de arquivos: `server/fs-atomic.js`.

## 4. Modelo financeiro e calculos

Saidas usam `month.outflows`; cartoes usam `outflowCards` e `cardBills`.
Rendas e projetos/entradas extras continuam em fluxos proprios. Campos legados
permanecem por compatibilidade, nao como novos motores concorrentes.

| Modulo | Contrato |
|---|---|
| `shared/outflow-amounts.js` | Valor efetivo de saida/fatura e compartilhamento |
| `shared/financial-query.js` | Fatos financeiros e somas em centavos |
| `shared/financial-guards.js` | Protecoes de totalizacao, inclusive fatura versus compras |
| `mes-atual/totals.js` | Adaptacao dos totais mensais |
| `mes-atual/outflow-commands.js` | Criacao, edicao, exclusao e resultado de persistencia |
| `mes-atual/shared-expense.js` | Participantes e responsabilidade compartilhada |
| `shared/dashboard-rules.js` | Regras compartilhadas do Dashboard |

Fatura e compra do cartao nao podem ser somadas duas vezes na despesa principal.
Consumo e compromissos sao bases distintas, nao devem ser forcadas a ter o
mesmo total. Mudanca visual nao deve recalcular faturas manuais, pagamentos ou
historico. Recorrencia, planejamento, parcelas e compartilhamento sao
comportamentos sobre lancamentos. Desktop/Mobile reutilizam comandos; o
formulario Mobile nao depende de um modal Desktop escondido.

## 5. Calendario continuo

O seletor oferece ano atual e seguinte, mais historico persistido. Navegar nao
cria anos infinitos, nao grava todos os meses e nao gera backups.

- `modules/continuous-calendar.js`: motor de regras, revisoes e excecoes.
- `modules/continuous-calendar-app.js`: adaptador navegador e serializacao.
- `modules/shared/calendar-projection.js`: datas/parcelas sem DOM.
- `server/calendar-projection.js`: adaptador servidor.

Meses virtuais intactos sao omitidos de `finData`. Edicoes e exclusoes locais
sao excecoes. Series possuem revisoes por competencia e encerramento; mudancas
futuras respeitam mes inicial e excecoes. Projecoes iniciam nao pagas/nao
recebidas. Ativacao inicial exige backup confirmado.
Detalhes: [CONTINUOUS_CALENDAR.md](CONTINUOUS_CALENDAR.md).

O helper compartilhado nao torna todas as politicas dos adaptadores identicas:
diferencas de datas permanecem caracterizadas na etapa 3D.

## 6. Catalogos e pesquisas

`shared/month-selection-catalog.js` centraliza categorias/tags por mes,
visibilidade e simbolos. Consulta referencias atuais apos edicoes/restores.
Categoria global nao significa categoria selecionada em todas as competencias.
Consultar historico nao significa oferecer categoria oculta para novo registro.

`toVisualCategorySymbol` converte IDs de icone e infere emojis pelo nome.
Formulario Desktop/Mobile e Internet Banking usam esse resolver. Emoji e
apresentacao, nao parte do nome/valor salvo.

Duas pesquisas distintas:

- Universal: `modules/universal-search.js`, indice de varios periodos e tipos.
- Mensal: `mes-atual/filters.js`, campo `unifiedOutflowSearch`, restrito ao mes,
  metodo/cartao e tag selecionados, inclusive planejamento, Todos e Gastos.

Busca mensal normaliza acentos/caixa e consulta descricao, categoria, tag,
cartao/metodo, valores e datas. Fuse.js ja carregado tolera pequenos erros em
palavras de pelo menos quatro caracteres. Numeros/datas nao usam aproximacao;
aceitam ponto/virgula e datas curtas/completas/ISO. Sem Fuse, permanece o match
textual exato. Nao consulta banco nem altera lancamentos. Categorias com
resultados abrem durante a busca; cabecalhos de cartao permanecem para subitens.

## 7. Renderizacao e MobileV2

`index.html` declara ordem de scripts defer e modais. `bootstrap.js`, `app.js`,
`auth-client.js`, `state.js`, `storage.js` e `core.js` participam do bootstrap.
Nao reordenar esses scripts como imports ESM. Loader carrega Mobile sob demanda.

`mes-atual.js`, `dashboard.js`, `patrimonio-clean.js` e `historico-eso.js`
orquestram telas Desktop. `renderAll` atualiza pagina ativa. Dashboard reaproveita
totais por objeto de mes durante cada render; o mapa nao e cache persistente
nem sobrevive a novo filtro/edicao/render.

MobileV2 usa `data-bridge.js`, telas, sheets e eventos proprios. Inicializacao
e listeners possuem guardas contra duplicacao. Caches mensais devem invalidar
mesmo quando uma edicao nao muda a quantidade de itens. Ainda ha adaptadores
legados de haptics/loading; nem todos os wrappers foram removidos.

`mobile-v2.css` importa seis partes em `public/app/modules/mobile-v2/styles/`:
onboarding, feedback, navigation, forms-and-charts, shell e screens.
A ordem preserva a cascata; styles.css e dark-mode.css continuam ativos.
Chart.js e Fuse.js sao bibliotecas externas da pagina, nao um bundler.

## 8. Internet Banking, PDF e integracoes

`pluggy-banking.js` controla a revisao canonica. Mobile consome snapshot e
comandos `addOne/addAll` da mesma base, sem segunda fila financeira.
Rotas preview/webhook, worker e staging sao separados do app-state.
Repositorio SQL preserva diferencas: worker atualiza saldo, webhook nao.
Commit pertence ao chamador.

`server/import-identity.js` adapta `shared/import-identity.js`. Identidade e
escopada por usuario/conta e IDs de origem, preservando transacoes distintas
com mesmos textos/valores/datas. Legado ambiguo nao vira importacao silenciosa.
Memoria de categoria/tag usa descricao original da origem.

Ausencia de identificador confiavel nao exibe mais aviso nem exige decisao
extra, por escolha do usuario. Isso nao elimina risco de repeticao sem ID.
Duplicatas exatas, candidatos confiaveis e reembolsos mantem protecoes.
Somente apos `save(true) === true` o item sai da revisao e aparece o sucesso
"Lancamento adicionado com sucesso."; lote informa quantidade.
Pendencia permite retry sem duplicar a aplicacao local.

PDF usa `import-bills-*`, rotas de jobs/parser, Oracle AI e
`server/invoice-import-plan.js`. Extracao nao e gravacao automatica.
As trilhas sao independentes, sem conciliacao global automatica entre elas.

Filas limitam pendencias por chave/processo e compartilham Promise de job
ativo quando aplicavel. Sobrecarga e rejeitada antes de criar trabalho extra.
HTTP tem prazo incluindo corpo; OCI usa processo assincrono sem shell; Oracle
usa pool/fila finita, callTimeout, rollback/close e nenhum commit implicito.
Nao sao locks distribuidos, quotas de disco ou retomada apos restart.
Parametros: [refatoracao/20-etapa-6-integracoes.md](refatoracao/20-etapa-6-integracoes.md).

## 9. Seguranca e dominios auxiliares

Identidade vem da sessao, nao de owner arbitrario do cliente. Rotas protegidas
aplicam auth/CSRF conforme contrato. `/app` exige sessao; `/app-assets` serve
codigo estatico sem requireAuth. Assets nao podem conter dados pessoais/seeds.
ESO e restrito; novos usuarios iniciam sem historico pessoal de outro usuario.

`password.js`, `data-crypto.js`, `user-store.js` e `operation-token-store.js`
cuidam de credenciais, criptografia e operacoes sensiveis. Nao documentar
senhas/tokens reais. Recuperar dados criptografados exige suas chaves.

Patrimonio usa contas/ativos e movimentacoes no mesmo app-state. Importar conta
bancaria usa dominio patrimonial; cartao usa lancamentos/faturas. Atualizar
saldo deve manter diferenca/movimentacao coerente.

Backups pertencem ao usuario. Padroes: 50 recentes e ate 12 ancoras mensais,
com cooldown automatico configuravel. `FIN_MAX_BACKUPS_PER_USER=0` NAO desativa
poda: cai no padrao. Restore JSON publica revisao nova e invalida abas antigas;
nao estender essa garantia ao SQLite antes de corrigir as pendencias.

Widget usa token individual, `server/widget-snapshot.js`, projecao e rotas
`server/http/routes/widget.js`. Snapshot derivado nao e fonte primaria.

## 10. Testes e publicacao

Codigo de referencia: 481 testes Node e 15 cenarios de navegador aprovados,
zero erros de pagina; fixtures sinteticas, sem escrita financeira no servidor
do smoke. Nao equivale a testar conta/banco real.

```powershell
npm ci
npm test
npm run test:smoke
npm run check:legacy-paths
npm run test:perf:refactor
npm run check:refactor-risks
npm run audit:ci
```

Smoke aceita `MEUFIN_SMOKE_VENDOR_DIR` com chart.umd.js e fuse.min.js sem CDN;
`MEUFIN_SMOKE_PROFILE=1` ativa perfil. Benchmark exige historico Git.
Probe de riscos usa storage temporario. `audit:system` pode escrever/corrigir
arquivos: nao executar contra dados reais como se fosse somente leitura.

Push em main aciona `.github/workflows/deploy.yml`: npm ci, audit critical,
SCP, dependencias de producao e restart PM2 na Oracle. O workflow NAO executa
npm test/smoke; validar antes do push. Deploy verde nao significa seguranca
sem pendencias. Procedimento: [../DEPLOY.md](../DEPLOY.md).

## 11. Regras de manutencao

1. Reutilizar helper/comando antes de duplicar regra.
2. Preservar isolamento, revisoes, backups e leitura de estados antigos.
3. Separar dominio, apresentacao e integracao; nao calcular dominio lendo DOM.
4. Distinguir mudanca local de salvamento confirmado.
5. Testar Desktop/Mobile, escopo mensal e duplicacao de cartao/importacao.
6. Nao testar destrutivamente em contas reais ou versionar fixtures pessoais.
7. Atualizar este guia quando mudar contrato, responsabilidade ou operacao.

## 12. Ressalvas conhecidas

### Responsividade e recuperacao de preferencias (outubro/2026)

- `modules/shared/chart-presentation.js` centraliza tabela acessivel, tema,
  abreviacao de eixos e bitmap Canvas com DPR limitado a 3. Nao calcula totais.
- Dashboard observa a largura de `dashboardWidgets`. Abaixo de 1040 px de
  conteiner usa grid; abaixo de 720 px usa uma coluna. O layout salvo de
  widgets nao e regravado pelo resize e volta a valer em telas amplas.
- O bootstrap acompanha a entrada na faixa Mobile mesmo se a carga inicial
  foi Desktop; o loader mantem uma unica promessa de carregamento.
- Canvas Desktop/Mobile possuem tabelas equivalentes sincronizadas aos dados
  exibidos. Temas usam tokens, e rotulos Mobile medem a largura necessaria.
- Um pending draft com revisao antiga so e rebaseado quando todas as mudancas
  efetivas sao preferencias de apresentacao. Qualquer diferenca financeira
  continua bloqueada; o snapshot antigo inteiro nunca substitui o servidor.
- Remember-me restaura sessao em GET/HEAD, nao em autosave POST/PUT de pagina
  antiga. Mutacoes sem sessao continuam exigindo reautenticacao e CSRF.
- Regressao adicional: `npm run test:responsive`; auditoria e validacao em
  `docs/auditoria-responsividade/`. Emulacao nao certifica aparelhos fisicos.

Atualizar documentacao nao resolveu estas pendencias:

- F03/F04: restore JSON nao atualiza copia prioritaria SQLite; revisoes SQLite
  podem repetir sob relogio congelado. Backend online nao certificado.
- Etapa 7 registrou Nodemailer com alerta alto; conferir audit:ci. Deploy
  bloqueia criticos, nao todos os altos. Nao atualizar major silenciosamente.
- Datas: adaptadores browser/servidor possuem diferencas caracterizadas na 3D.
- F06: texto de metas pode considerar meta excluida; ver etapa 7.
- Webhook/recuperacao de senha/configuracao exigem revisao propria; nao houve
  certificacao irrestrita da seguranca de producao.
- Oracle real, dispositivos fisicos e recuperacao de desastre nao sao
  certificados pela suite sintetica.

Evidencias: [refatoracao/21-fechamento-validacao.md](refatoracao/21-fechamento-validacao.md).
