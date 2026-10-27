---
name: meufin-dashboard-audit
description: Conferir totais, graficos, filtros de periodo, ranking de categorias e layout do Dashboard MeuFin, sem alterar dados financeiros na auditoria.
---

# Auditoria do Dashboard

Leia `public/app/dashboard.js`, `modules/shared/dashboard-rules.js`,
`modules/shared/chart-presentation.js` e `modules/mobile-v2/home-screen.js`.
Escolha a conta e periodo em fixture isolada; nao use conta pessoal por padrao.

Compare os totais com um oraculo independente, nao apenas com a mesma funcao
chamada duas vezes. A fixture de `scripts/audit-responsive.js` caracteriza
R$ 5.500 de entrada, R$ 1.400 de despesa e R$ 3.700 de resultado por mes, com
R$ 400 de metas; confira a fixture atual antes de reutilizar esses valores.

Verifique periodo vazio, mes selecionado, ano, personalizado e 1/3/6/12 meses.
O periodo elegivel e definido pelas regras compartilhadas, nao pela existencia
de um objeto de mes virtual. Nao marque todos os meses futuros como realizados.
Preserve indicadores especificos por perfil e a distincao compromissos/consumo.

Compare cards, series/datasets, ranking, valores completos e tabelas acessiveis.
Metas excluidas nao entram na reserva explicada no resumo. Abreviar eixo nao
pode arredondar dados. Abra a pizza opcional e confira pixels nao vazios e DPR.
Teste teclado, foco, tema claro/escuro e labels extensos.

Layout padrao usa grade fluida; layout personalizado continua aplicado apos
Concluir organizacao. Redimensionar nao pode salvar posicoes nem alterar finData.
Confirme ida e volta pelos breakpoints, nao so uma carga inicial pequena.

Use `npm run test:responsive`, `npm run test:smoke` e os testes
`dashboard-render-budget`, `dashboard-empty-period`, `dashboard-rules` e
`chart-presentation`. Preserve o orcamento de uma consulta de totais por mes;
nao alegue ganho de desempenho sem benchmark. Registre periodo, base, viewport,
tema, valores esperados/observados e limites da emulacao.
