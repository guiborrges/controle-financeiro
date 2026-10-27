# MeuFin: analise de design e experiencia

Data: 27/10/2026. Base: codigo atual apos as correcoes responsivas.
Escopo: analise e proposta. Nenhuma alteracao do aplicativo ou publicacao.

## Como foi analisado

Foram utilizadas as skills emil-design-eng, frontend-design e mobile-native,
com apoio de Playwright para observar a interface. Dez telas e dois formularios
foram capturados em ambiente local isolado, com dados ficticios:

- Desktop 1440 x 1000: Dashboard, mes, patrimonio, historico e perfil.
- Mobile emulado 390 x 844: Dashboard, mes, patrimonio, historico e calendario.
- Formulario de lancamento nas duas apresentacoes.

As imagens estao em `output/design-review-2026-10-27/`. O registro
`review-context.json` confirma zero erros de pagina, fixture inalterada e
zero gravacoes financeiras. As fontes Google foram permitidas nessa rodada.
Nao houve acesso a conta pessoal. Nao foi testado um aparelho fisico.

Esta e uma avaliacao qualitativa de design, nao pesquisa com usuarios,
certificacao de acessibilidade ou previsao de aumento de conversao.

## Diagnostico principal

O MeuFin ja tem organizacao reconhecivel: menu lateral no Desktop, navegacao
inferior no Mobile, indicadores, categorias e lancamentos. O maior ganho agora
e melhorar hierarquia e consistencia. A superficie visual tem muitos elementos
competindo: degradês, sombras, transparencias, cantos grandes e pequenos textos
em caixa alta. Na rotina financeira, as informacoes e acoes precisam se destacar
mais que seus contornos.

Nao recomendo uma reconstrução do frontend, troca de framework ou adicao de
biblioteca apenas para mudar a aparencia.

## Melhorias propostas

| ID / prioridade | Antes | Depois | Por que |
|---|---|---|---|
| D01 / alta | Secoes inteiras em grandes superficies arredondadas, com sombras e degradês; cartoes dentro de cartoes no patrimonio. | Fundo neutro; secoes sem moldura quando possivel; superficies opacas; bordas discretas; sombras principalmente em elementos sobrepostos. | Facilita perceber a estrutura sem tantas camadas visuais. |
| D02 / alta | Numeros importantes convivem com legendas pequenas, claras e muito espacadas; pesos altos no Mobile. | Escala tipografica coerente; corpo legivel; numeros alinhados a direita nas tabelas e com algarismos de largura uniforme. | Melhora comparacao de valores e leitura diaria. |
| D03 / alta | Dashboard mostra resultado, entradas e saidas; a reserva em metas nao fica explicita no resumo principal. | Explicacao compacta do resultado: entradas menos compromissos e reservas em metas, respeitando o periodo. | Ajuda a entender por que entradas menos despesas pode nao coincidir com o resultado. Nao muda a formula. |
| D04 / alta | Indicadores esticam na tela ampla, enquanto widgets ficam concentrados; controles Mover e alcas sempre visiveis. | Grade com proporcoes claras e modo explicito de organizar painel. Preservar posicoes personalizadas. | Melhora aproveitamento do espaco e retira controles de configuracao da leitura cotidiana. |
| D05 / alta | Modal Desktop deixa elementos de fundo aparecerem pela transparencia; formulario tem opcoes e lista de copias concorrendo por atencao. | Painel de edicao opaco; descricao/valor/pagamento/data primeiro; configuracoes condicionais agrupadas; copiar lancamento em area recolhivel. | Facilita concluir um lancamento e reduz distracao. Campos e regras existentes permanecem. |
| D06 / alta | Busca e filtros da tabela ficam comprimidos; dois botoes de adicionar disputam destaque. | Barra de ferramentas alinhada e adaptavel; adicionar lancamento como principal; adicionar cartao como secundaria; filtros ativos claros. | Torna o caminho de uso mais evidente sem remover recursos. |
| D07 / media | Cada linha mistura checkbox de soma, checkbox de pago, lapis e X com pouco contexto. | Separar inclusao no planejamento de status de pagamento; nomes acessiveis e tooltips; acoes destrutivas menos proeminentes. | Evita interpretar pagamento como exclusao do total, ou exclusao como simples fechamento. |
| D08 / media | Mobile usa botao principal vermelho, enquanto Desktop usa azul; secoes alternam entre muitos estilos de botoes. | Cor primaria consistente para adicionar/salvar; vermelho reservado a exclusao, erro ou resultado negativo. | Da significado estavel as cores. |
| D09 / media | Marca e bloco de sessao ocupam parte grande do menu Desktop; textos e ferramentas tem pesos semelhantes. | Identidade MeuFin mais compacta; navegacao principal clara; conta e ferramentas organizadas sem perder acesso a backup. | Libera espaco e reforca identidade do produto. |
| D10 / media | Pizzas com muitas categorias exigem cruzar varias cores com a legenda. | Ranking de categorias com barras, valores completos e participacao; pizza pode continuar como visualizacao alternativa. | Torna a comparacao mais direta. Manter a distincao entre compromissos e consumo. |
| D11 / media | Calendario Mobile coloca numero do dia e valor em cada celula; alguns valores quebram linha. | Dia como informacao principal; intensidade/ponto como resumo; detalhes completos e valores no dia selecionado. | Reduz aperto visual sem remover a consulta financeira diaria. |
| D12 / media | Textos de produto revelam implementacao, como "pelo mesmo calculo do PC" no patrimonio Mobile. | Linguagem de tarefa: "1 conta acompanhada", "Adicionar movimentacao", "Resultado apos metas" quando adequado. | Ajuda quem usa o sistema sem precisar entender sua arquitetura. |

## Direcao visual recomendada

Uma interface financeira clara, precisa e discreta. Preservar o simbolo atual e
as cores azul/verde reconheciveis, sem transformar todas as superficies em
blocos coloridos.

Proposta inicial de tokens, ainda sujeita a teste de contraste e prototipo:

| Papel | Proposta |
|---|---|
| Fundo | #F6F7F9 |
| Superficie | #FFFFFF |
| Texto principal | #202124 |
| Texto secundario | #5B616C |
| Borda | #DCE1E8 |
| Acao principal | #2D63B8 |

Verde permanece associado a resultado positivo/confirmacao; vermelho a
negativo/erro/destruicao; amarelo a atencao. Categoria pode continuar tendo
cor propria, sem usar essa cor como substituta do status financeiro.

Tipografia: manter DM Sans como candidata para a interface, com poucos pesos.
Marca pode ter tratamento proprio. Prototipar titulos de 22-28 px no Desktop,
18-22 px no Mobile, corpo de 14-16 px e valores em escala coerente com sua
importancia. Estes numeros sao alvos de projeto, nao garantia de conformidade.
Inputs Mobile devem ser conferidos em iPhone real antes da homologacao.

Espacamento: sistema 4/8/12/16/24/32. Cantos mais contidos nos controles e
cartoes, sem obrigar modal, tabela e bottom sheet a terem o mesmo raio.
Campos e botoes com altura consistente, preservando area de toque confortavel.

## O que preservar

- As regras financeiras, dados e datas de competencia.
- As selecoes por mes, metodo, cartao e tag, incluindo pesquisa tolerante a erros.
- Emojis nas categorias, solicitados pelo usuario. Padronizar icones de acao
  nao significa remover esses emojis.
- Titulos de renda fixa/renda extra em caixa alta fora da edicao, como solicitado.
  Revisao de caixa alta em outros labels nao deve desfazer essa preferencia.
- Layout personalizado de widgets e escolhas existentes de periodo.
- Acessibilidade das tabelas dos graficos introduzida na entrega anterior.
- Confirmacao de salvamento remoto e fechamento de edicao apos sucesso.

Nao chamar resultado previsto de "dinheiro disponivel" sem que o indicador
represente efetivamente caixa disponivel. Uma melhoria de texto nao pode
alterar o significado financeiro.

## Interacoes e animacoes

Melhorar resposta ao pressionar, foco, confirmacao e transicao de modais/folhas.
Evitar animar toda navegacao, entradas de linhas ou valores financeiros a cada
troca de filtro. Os controles mais frequentes devem responder imediatamente.
Animacoes curtas devem respeitar a preferencia por movimento reduzido.

Ja existem regras de safe-area, toque e movimento reduzido em partes do CSS.
Nao propor aplicar tudo novamente de forma global. A cobertura deve ser
conferida por componente; seletores de hover, teclado, viewport e barras do
navegador exigem verificacao em aparelhos reais.

## Ordem de trabalho

1. Prototipo isolado da tela do mes, usando dados ficticios e os mesmos
   indicadores: superfícies, tipografia, tabela, filtros e formulario.
2. Levar os componentes aprovados ao Dashboard e ao patrimonio, conferindo
   Desktop, Mobile e os dois temas.
3. Ajustar calendario, estados vazios, textos e microinteracoes.

A aprovacao deve ser visual e operacional: ler valores, encontrar um
lancamento, adicionar, editar, cancelar e entender pago/pendente sem perda
de clareza. Depois, repetir os testes financeiros e responsivos existentes.

Nao ha autorizacao de implementacao ou deploy implicita nesta analise.
