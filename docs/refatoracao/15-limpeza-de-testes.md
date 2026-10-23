# Analise e limpeza da suite

Data: 23/10/2026. Base: 3458915, apos a etapa 3C. Escopo: testes, seu comando
de execucao e documentacao. Nenhuma regra financeira ou codigo do aplicativo
foi alterado. Publicacao autorizada pela orientacao vigente do usuario.

## Criterios

Retirar duplicacao quando a mesma regra tem cobertura equivalente ou mais forte;
retirar verificacoes sobre detalhes de codigo removido sem responsabilidade atual;
substituir busca de texto por comportamento quando ja existe infraestrutura segura.
Nao apagar um teste apenas porque seu nome contem legacy, migration ou removed.
Compatibilidade com backups antigos e remocoes explicitamente pedidas continuam
sendo responsabilidades do produto.

## Decisoes e cobertura restante

| Alteracao | Motivo e protecao mantida |
|---|---|
| Nove casos isolados de precedencia de fatura consolidados | Seus valores esperados fixos foram movidos integralmente para refactor-helpers-contract; permanecem independentes da formula da matriz de 2.904 combinacoes. Objetos congelados detectam mutacao. |
| Caso duplicado de zero manual/previsao ausente em mes-atual-extracted-modules removido | Coberto pelos valores fixos e pela matriz. Reconciliacao com normalizacao e importacao continua em unified-card-bill-reconcile. |
| Assercao duplicada de fatura no teste de soma recorrente retirada | O teste agora fica focado em somar recorrentes e ignorar compras avulsas; a fachada MesAtualCardBill continua exercitada. |
| removed-obsolete-styles.test.js removido | Verificava nomes antigos de seletores CSS, nao comportamento ou estilo calculado. Nao era prova de aparencia correta. |
| canonical-workspace.test.js removido | Conferia existencia de arquivos ja carregados por outros testes e ausencia de duas pastas antigas. Uma pasta de trabalho temporaria nao determina qual aplicativo e servido. Guard de caminhos legados e smoke real continuam. |
| Segundo caso de removed-month-copy-flow removido | Prendia funcoes e seletores ao nome antigo, incluindo resolveIncomeName e modal de titulos. Mantido o guard da ausencia dos controles manuais no HTML; calendario continuo continua testado por projecao real. |
| mobile-outflow-edit-visibility.test.js removido | Dois testes de texto sobre ordem de atributos e nome de chamada substituidos pelo clique real no botao editar e verificacao da janela visivel no smoke. Cancelar preserva os registros. |
| Caso de texto do salvamento Mobile em mobile-final-ux removido | Chamada direta, espera e estados invalid/cancelled/pending continuam em mobile-save-contract; comportamento de criar/retry/editar esta no smoke. |
| Teste de datas Mobile acrescentado | Executa o adaptador com DateUtils real: dia simples passa para o mes seguinte, data completa conserva mes/ano e datas impossiveis sao rejeitadas. Substitui a busca por texto do offset. |
| Nome do caso de valores invalidos de fatura atualizado | O helper agora e compartilhado; o teste continua garantindo politicas distintas de NaN e rejeicao de infinito na consulta financeira. Nenhuma assercao retirada desse caso. |
| Alias test:ux:15points removido | O arquivo scripts/ux-15points-improver.js nao existe. test:smoke passa a executar o harness atual mantido. |

## O que foi preservado

Calculos de compromissos/consumo/caixa, valores fixos de resultado, metas,
compartilhamento, datas, recorrencias e parcelas. Tambem permanecem autenticacao,
isolamento de usuarios, privacidade dos seeds, conflitos/revisoes, backups,
restore e falhas de escrita com releitura em processo novo. Testes de formatos
anteriores continuam necessarios e nao foram eliminados.

Os contratos de carregamento/arquitetura ainda relevantes nao foram apagados em
bloco. O guard de nao reintroduzir o painel de recorrencias continua, pois isso
foi pedido explicitamente pelo usuario. Outros testes estaticos com cobertura
unica de UX permanecem; nao sao apresentados como prova visual ou E2E.

## Verificacao

Antes: npm test, 413 aprovados em 68 arquivos, zero falhas/skips/cancelamentos.
Depois: npm test, 398 aprovados em 65 arquivos, zero falhas/skips/cancelamentos.
Foram retirados/consolidados 16 registros de teste e acrescentado um registro;
menos casos no relatorio nao significa menos combinacoes verificadas de fatura.

Smoke: 10 cenarios aprovados, zero pageErrors, fontes sinteticas do servidor
intactas e nenhuma escrita financeira enviada. Inclui seletores reais, clique
no editor Mobile, cancelamento, criar/editar/excluir Desktop e falha/retry/editar
Mobile. Persistencia nos dois cenarios de comando continua simulada no navegador.

```powershell
npm test
$env:MEUFIN_SMOKE_VENDOR_DIR = (Resolve-Path 'tmp/m01-preview/vendor').Path
npm run test:smoke
```

Nao foi medida nova porcentagem global de cobertura ou ganho de desempenho.
Nenhum teste com falha foi retirado para obter aprovacao. Nao houve acesso a
contas reais, bancos, IA externa ou alteracao de dados do usuario.

## Limites

Scripts manuais como test:load e test:e2e:import-bill nao fazem parte de npm test
e nao foram executados nesta limpeza. O harness de carga ainda precisa adotar
baseRevision, conforme o diagnostico do documento 06; nao e evidencia valida
de desempenho do contrato atual. Nao foi removido, pois o objetivo de testar
carga continua relevante e deve ser atualizado em lote proprio.

F03 a F06 e as etapas seguintes da refatoracao nao foram iniciados nem resolvidos
por esta limpeza. Reversao envolve apenas os arquivos de testes/configuracao,
sem reescrever dados ou modificar o formato dos backups.
