# Etapa 3A - Helpers financeiros

Atualizacao: publicacao autorizada apos a validacao. O usuario tambem autorizou
publicacoes futuras ao concluir entregas e conferir todos os testes. Os registros
abaixo descrevem a validacao local anterior a essa autorizacao.

Implementada e validada localmente em 23/10/2026. Nao publicada.
Base: b277cbc. Nenhuma migracao de dados, nova dependencia ou alteracao visual.

## Mudanca

OutflowAmounts, modulo UMD/CommonJS ja carregado antes dos consumidores, passa a
expor getEffectiveCardBillAmount. A regra de precedencia passa a ter uma unica
implementacao: manual (inclusive zero); valor positivo nao forecast; previsao.
FinancialQuery.billAmount e MesAtualCards.getUnifiedCardBillEffectiveAmount
continuam disponiveis, com os mesmos argumentos e resultados anteriores.

As implementacoes anteriores nao eram identicas para entradas invalidas.
A opcao nanAsZero preserva o comportamento da tela; a consulta usa a politica
anterior sem coercao adicional. Infinity nao passa a ser aceito como valor valido
na consulta: a validacao de centavos continua rejeitando-o. Nao houve correcao
silenciosa dessa divergencia nem mudanca de arredondamento.

Os valores de saida e a cota do titular ja usam OutflowAmounts. Nao foi criado
outro normalizador nem alteradas as prioridades desses caminhos. A formatacao
absoluta, com sinal e Mobile foi testada com seus contratos distintos preservados.
Fallbacks de ambientes parciais e escapes por contexto nao foram removidos como
se fossem implementacoes equivalentes. Catalogos, comandos, datas e resultado
mensal ficam fora desta extracao, conforme etapas posteriores do plano.

## Testes e comparacao

Antes da extracao, o novo teste de caracterizacao passou contra o codigo original.
Depois, a mesma matriz de 2.904 combinacoes passou nos dois consumidores:
ausente, null, vazio, zero, negativo, decimal, string numerica, texto invalido,
NaN e infinitos; origens manual/import/forecast, caixa e espacos; flag estrita.
Os objetos da matriz sao congelados para detectar mutacao.

Quatro testes novos cobrem matriz, compartilhamento/previsao sem dupla contagem,
delegacao efetiva das duas fachadas e formatos de dinheiro/sinal. Tres harnesses
antigos passaram a carregar OutflowAmounts antes de Cards, como o HTML real ja
faz. Nenhuma assercao anterior foi removida ou relaxada.

- `node --test tests/refactor-helpers-contract.test.js`: 4 aprovados.
- `npm test`: 379 aprovados, zero falhas, skips ou cancelamentos.
- `node scripts/test-refactor-smoke.js`: 8 aprovados, zero pageErrors,
  fixtureUnchanged=true, writes=0. MEUFIN_SMOKE_VENDOR_DIR definido como
  `tmp/m01-preview/vendor` para bibliotecas locais.
- Os testes 2A preservam os totais fixos de compromissos, consumo, caixa,
  reservas e resultado, incluindo contratos Desktop/Mobile/widget.

Somente contas ficticias e armazenamento temporario. Nao houve nova conferencia
da conta pessoal em producao nem teste de escrita por todas as telas. Sem
alegacao de ganho de desempenho: esta entrega reduz duplicacao da regra.

## Entrega e reversao

Codigo alterado: modules/shared/outflow-amounts.js,
modules/shared/financial-query.js e modules/mes-atual/cards.js em public/app.
Nao muda formato de backup ou salvamento; reversao e apenas de codigo.
M10 e o painel de recorrencias permanecem removidos. F03 a F06 da etapa 2B
continuam pendentes. Publicacao depende de autorizacao especifica.
