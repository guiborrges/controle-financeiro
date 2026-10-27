---
name: meufin-pluggy-reconciliation
description: Auditar ou corrigir Pluggy, staging Oracle, importacoes e conciliacao do MeuFin, preservando competencia, identidade, isolamento e idempotencia.
---

# Pluggy e conciliacao

Mapeie `server/http/routes/pluggy-preview.js`, `pluggy-webhook.js`,
`server/repositories/pluggy-staging.js`, `server/import-identity.js`,
`workers/worker_pluggy.js` e `public/app/pluggy-banking.js`.
Confirme caminhos com rg: partes da revisao/importacao podem estar em outros
modulos. Nao introduza outra implementacao de DDL/MERGE em paralelo ao repository.

Staging nao e o lancamento final. Importacao financeira exige revisao explicita
do usuario e deve respeitar a competencia escolhida, mesmo que a compra tenha
outra data. Preserve categoria, cartao, metodo e tags escolhidos na revisao.
Nao reinstale o aviso descartado de origem sem identificador como regra de UI.
Ausencia desse aviso nao remove controles de identidade/idempotencia.

Reutilize as identidades existentes: tenant, conta, ID externo e comportamento
de fallback/colisao precisam ser rastreados. Descricoes e valores iguais nao
provam duplicidade; retry do mesmo evento/importacao nao pode duplicar aplicacao.
Conciliacao de fatura e compra nao pode duplicar despesa principal.
Pagamento de debito pode ser imediato; nao copie esse status para projecao futura.

Verifique assinatura/segredo do webhook conforme o contrato real, mapeamento de
tenant, prazos de rede, filas limitadas e falhas Oracle. Configuracoes opcionais
nao sao garantias de protecao. Nao troque esse protocolo por exemplo Stripe.
Use payloads sinteticos e dependencias injetadas, sem tokens nem bancos reais.

Testes: `import-identity`, `pluggy-preview-routes`, `pluggy-webhook-routes`,
`pluggy-banking-helpers`, `import-save-contract`, `import-bills-review-date`,
`unified-card-bill-reconcile`, `integration-runtime-contract`.
Confira falha de save, retry, reabertura e conta B antes de concluir conciliacao.
