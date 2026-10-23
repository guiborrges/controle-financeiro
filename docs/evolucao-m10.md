# M10 - Detalhamento dos indicadores

Os valores do Dashboard e do Historico abrem uma lista de lancamentos que
explica sua soma. A consulta utiliza o mesmo motor financeiro da M01, o mesmo
periodo e a mesma base do indicador original, no computador e no celular.

- Entradas, despesas, renda fixa, projetos e resultado podem ser detalhados.
- Categorias respeitam a base escolhida e os agrupamentos exibidos no grafico.
- O resultado mostra entradas positivas e despesas e reservas de metas negativas.
- Faturas e compras nao sao somadas duas vezes; transferencias ficam excluidas.
- A soma em centavos e conferida antes de mostrar a lista. Se o indicador estiver
  desatualizado, o sistema pede para atualizar a tela.
- O painel e somente leitura. Fechar preserva filtros e devolve o foco a origem.
- Botoes e graficos oferecem acesso por teclado; Escape fecha o painel.

## Verificacao

Testes automatizados cobrem seis indicadores nas tres bases financeiras,
categorias agrupadas, participacao em despesas compartilhadas, reservas,
isolamento entre contas e divergencias de soma.

No navegador isolado, foram conferidos 528 detalhamentos (88 meses e seis
indicadores), abertura por graficos, categorias e Historico, retorno por teclado,
estado financeiro inalterado e layout mobile sem rolagem horizontal. Dados
privados, copias de conta e capturas nao integram esta entrega.
