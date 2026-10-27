---
name: meufin-financial-engine
description: Alterar ou auditar calculos do MeuFin, recorrencias, parcelas, cartoes, faturas, rendas e reembolsos preservando competencia e evitando dupla contabilizacao.
---

# Motor financeiro do MeuFin

Leia `docs/ARCHITECTURE.md`, secao Modelo financeiro, e a implementacao afetada.
Use `public/app/modules/shared/financial-query.js`, `outflow-amounts.js` e
`financial-guards.js` como contratos; `modules/mes-atual/totals.js` adapta a UI.
Nao crie uma segunda formula no Desktop, Mobile ou servidor.

- `commitments`, `consumption` e `cash` sao bases diferentes. Compra no cartao
  participa do consumo; fatura, dos compromissos. Nunca some as duas no total principal.
- O resultado canonico e receita incluida menos despesas incluidas menos reservas
  em metas incluidas, somados em centavos. Pago/recebido nao significa incluido.
- Fatura manual e previsao tem valores efetivos diferentes; use o resolver existente.
- Compartilhamento usa a responsabilidade efetiva do titular, nao o valor bruto.
- Reembolsos possuem fluxo proprio: trace seus consumidores e testes antes de
  atribuir efeito em renda, despesa, caixa ou patrimonio. Nao invente compensacao.
- A competencia escolhida pode diferir da data de compra/cobranca/recebimento.
  Preserve ambas e o comportamento caracterizado de datas dos adaptadores.
- Calendario continuo: regras/revisoes por competencia, meses virtuais e excecoes.
  Nao materialize anos infinitos nem reescreva historico ao propagar recorrencias.
  Projecoes novas nao herdam pagamento/recebimento confirmado do mes de origem.

Trace `modules/continuous-calendar.js`, `continuous-calendar-app.js`,
`shared/calendar-projection.js` e `server/calendar-projection.js` quando houver
propagacao. Para comandos, preserve `mes-atual/outflow-commands.js` e seus
contratos de persistencia: `pending` nao e sucesso; retry nao duplica aplicacao.

Antes de corrigir, reproduza em fixture sintetica e teste valores independentes
em centavos, inclusao, cartao, parcela final, revisao futura e excecao local.
Selecione os testes reais em `tests/financial-query.test.js`,
`outflow-amounts.test.js`, `financial-guards.test.js`,
`refactor-financial-characterization.test.js`, `continuous-calendar.test.js`,
`recurrence-calendar.test.js`, `income-recurrence.test.js`,
`unified-card-bill-reconcile.test.js` e `outflow-command-contract.test.js`.
Conclua com `npm test` e smoke proporcional ao fluxo. Relate diferencas por
competencia e base, nao apenas um total agregado que possa esconder compensacoes.
