# Etapa 3B - Categorias, tags e simbolos

Base: a6ef665. Implementada em 23/10/2026. Publicacao autorizada pelo usuario
apos concluir a entrega e conferir todos os testes. Sem inicio da 3C.

## O que mudou

As regras que montam as listas de categorias e tags foram movidas do core para
`public/app/modules/shared/month-selection-catalog.js`. As funcoes antigas
continuam disponiveis e delegam ao novo modulo. Desktop, Mobile e importacoes
continuam usando o mesmo catalogo mensal, sem alterar suas interfaces.

Nomes recebidos como objetos, prefixos antigos e conversao de simbolos passaram
a compartilhar implementacao com o Internet Banking. A verificacao de emoji,
antes repetida nos formularios Desktop/Mobile e na revisao de importacao, tambem
foi centralizada. Nao foi ampliada a conversao de IDs nas telas que anteriormente
mostravam somente emojis. Essa diferenca de apresentacao foi preservada.

O modulo recebe explicitamente os dados e as funcoes de normalizacao de cada
consulta. Nao guarda dados de usuario ou resultados entre chamadas. Por isso,
alteracoes diretas, renomeacoes, importacoes, restore e troca da fonte de dados
sao refletidos na proxima consulta, sem depender de timer ou invalidacao manual.

Nao foi criado indice persistente. O plano permite consolidar primeiro sem cache;
na ausencia de revisao comum para todas as mutacoes, persistir um indice traria
risco de listas desatualizadas. Os Maps/Sets locais existentes foram preservados.
Nao se alega ganho de velocidade ou reducao do tamanho dos backups nesta etapa.

## Regras preservadas

- Categorias padrao, uso positivo no mes anterior e excecoes materializadas no
  mes atual, incluindo categorias zeradas, metas e escolhas explicitas.
- Ordem, IDs, aliases e contrato dos campos id/value/name/label/icon/symbol.
- Visibilidade individual de cada mes; historico ainda pode consultar ocultas.
- Tags com acentos e normalizacao Unicode, sem misturar tags acentuadas com
  suas versoes sem acento; ordenacao e deduplicacao existentes preservadas.
- Nenhuma regravacao ou migracao de meses, lancamentos, categorias ou tags.
- M10 e o painel de recorrencias continuam removidos. F03 a F06 continuam pendentes.

## Verificacao

Quatro testes de caracterizacao passaram antes da extracao. Depois, foram
adicionados dois testes de API isolada e delegacao das fachadas. Os seis cobrem
virada de ano, ordem, zeros, exclusoes, Unicode, visibilidade, renomeacao, troca
de fonte e independencia entre contextos, alem de simbolos conhecidos/desconhecidos.
Os testes anteriores continuam com suas assercoes; seus ambientes isolados
carregam agora o novo modulo antes dos consumidores, como faz o HTML real.

Comandos:

```powershell
node --test tests/refactor-catalog-contract.test.js
npm test
$env:MEUFIN_SMOKE_VENDOR_DIR = (Resolve-Path 'tmp/m01-preview/vendor').Path
node scripts/test-refactor-smoke.js
```

O smoke de oito cenarios foi ampliado para comparar os seletores reais de
categorias/tags Desktop e Mobile com o catalogo do mes. Tambem verifica totais,
cancelamento de rascunhos e isolamento entre contas ficticias, sem escrita.

Resultado final: 385 testes aprovados; 8 cenarios de navegador aprovados,
zero erros de pagina, dados ficticios intactos e nenhuma escrita financeira.
Nao houve acesso bancario/IA externa ou alteracao da conta real durante os testes.

## Limites e reversao

Nao e uma auditoria E2E de todos os comandos de todas as telas. O fluxo bancario
real e a gravacao de importacoes em producao nao foram exercitados nesta etapa.
Reverter este lote exige apenas reverter o codigo; o formato dos dados e backups
nao mudou. Confirmar o workflow e a disponibilidade dos arquivos apos o deploy.
