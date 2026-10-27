# Matriz de resolucoes e ambientes

Referencia: `94d4dcca50c2e2e78318d1b2f0c6aea48705403b`. Resultados locais sinteticos, nao homologacao da conta online.

## Navegadores

| Navegador | Versao executada | Amostra principal |
|---|---|---:|
| chrome | 155.0.8059.85 | 336 medicoes |
| edge | 156.0.4314.42 | 28 medicoes |
| firefox | 148.0.2 | 28 medicoes |
| webkit | 26.4 | 28 medicoes |

Chrome teve Dashboard, Mes, Patrimonio e Historico; demais engines, subconjunto do Dashboard. Ambos os temas. WebKit Windows nao e Safari macOS/iOS. UA/toque sao emulacao, nao aparelho fisico.

## Viewports CSS efetivamente medidas

| Entrada | Largura | Altura | Registros | Engines | Overflow do documento nessa amostra |
|---|---:|---:|---:|---|---|
| mouse | 1024 | 768 | 14 | chrome, edge, firefox, webkit | Nao detectado; nao e aprovacao funcional |
| mouse | 1280 | 720 | 14 | chrome, edge, firefox, webkit | Nao detectado; nao e aprovacao funcional |
| mouse | 1366 | 768 | 8 | chrome | Nao detectado; nao e aprovacao funcional |
| mouse | 1440 | 900 | 8 | chrome | Nao detectado; nao e aprovacao funcional |
| mouse | 1536 | 864 | 8 | chrome | Nao detectado; nao e aprovacao funcional |
| mouse | 1920 | 1080 | 14 | chrome, edge, firefox, webkit | Nao detectado; nao e aprovacao funcional |
| mouse | 2560 | 1440 | 8 | chrome | Nao detectado; nao e aprovacao funcional |
| mouse | 3440 | 1440 | 8 | chrome | Nao detectado; nao e aprovacao funcional |
| mouse | 1280 | 600 | 14 | chrome, edge, firefox, webkit | Nao detectado; nao e aprovacao funcional |
| mouse | 1280 | 500 | 8 | chrome | Nao detectado; nao e aprovacao funcional |
| mouse | 960 | 1080 | 8 | chrome | Nao detectado; nao e aprovacao funcional |
| mouse | 768 | 900 | 14 | chrome, edge, firefox, webkit | Nao detectado; nao e aprovacao funcional |
| mouse | 640 | 900 | 14 | chrome, edge, firefox, webkit | Nao detectado; nao e aprovacao funcional |
| mouse | 430 | 1000 | 8 | chrome | Nao detectado; nao e aprovacao funcional |
| mouse | 320 | 900 | 14 | chrome, edge, firefox, webkit | Nao detectado; nao e aprovacao funcional |
| mouse | 1920 | 500 | 8 | chrome | Nao detectado; nao e aprovacao funcional |
| touch | 320 | 568 | 14 | chrome, edge, firefox, webkit | Nao detectado; nao e aprovacao funcional |
| touch | 568 | 320 | 8 | chrome | Nao detectado; nao e aprovacao funcional |
| touch | 360 | 640 | 8 | chrome | Nao detectado; nao e aprovacao funcional |
| touch | 640 | 360 | 8 | chrome | Nao detectado; nao e aprovacao funcional |
| touch | 375 | 667 | 8 | chrome | Nao detectado; nao e aprovacao funcional |
| touch | 667 | 375 | 8 | chrome | Nao detectado; nao e aprovacao funcional |
| touch | 390 | 844 | 14 | chrome, edge, firefox, webkit | Nao detectado; nao e aprovacao funcional |
| touch | 844 | 390 | 14 | chrome, edge, firefox, webkit | Nao detectado; nao e aprovacao funcional |
| touch | 393 | 873 | 8 | chrome | Nao detectado; nao e aprovacao funcional |
| touch | 873 | 393 | 8 | chrome | Nao detectado; nao e aprovacao funcional |
| touch | 412 | 915 | 8 | chrome | Nao detectado; nao e aprovacao funcional |
| touch | 915 | 412 | 8 | chrome | Nao detectado; nao e aprovacao funcional |
| touch | 430 | 932 | 8 | chrome | Nao detectado; nao e aprovacao funcional |
| touch | 932 | 430 | 8 | chrome | Nao detectado; nao e aprovacao funcional |
| touch | 480 | 960 | 8 | chrome | Nao detectado; nao e aprovacao funcional |
| touch | 960 | 480 | 8 | chrome | Nao detectado; nao e aprovacao funcional |
| tablet | 600 | 960 | 8 | chrome | Nao detectado; nao e aprovacao funcional |
| tablet | 960 | 600 | 8 | chrome | Nao detectado; nao e aprovacao funcional |
| tablet | 768 | 1024 | 14 | chrome, edge, firefox, webkit | Nao detectado; nao e aprovacao funcional |
| tablet | 1024 | 768 | 14 | chrome, edge, firefox, webkit | Nao detectado; nao e aprovacao funcional |
| tablet | 820 | 1180 | 8 | chrome | Nao detectado; nao e aprovacao funcional |
| tablet | 1180 | 820 | 14 | chrome, edge, firefox, webkit | Nao detectado; nao e aprovacao funcional |
| tablet | 1024 | 1366 | 14 | chrome, edge, firefox, webkit | Nao detectado; nao e aprovacao funcional |
| tablet | 1366 | 1024 | 8 | chrome | Nao detectado; nao e aprovacao funcional |
| tablet | 853 | 1280 | 8 | chrome | Nao detectado; nao e aprovacao funcional |
| tablet | 1280 | 853 | 8 | chrome | Nao detectado; nao e aprovacao funcional |

A mesma pagina foi reutilizada entre tamanhos na matriz: a ordem importa. Nao sao todas cargas novas. Algumas larguras em toque podem refletir expansao da viewport por conteudo; a tabela usa `innerWidth` observado, e as configuracoes solicitadas estao no script.

## Rodadas adicionais

- Matriz principal: 420 medicoes, 44 transicoes com navegacao/render, 12 extremos.
- Complementar: 32 transicoes sem nav entre tamanhos, 16 aberturas, 5 filtros, 12 extremos verificados apos splash, 5 fatores de zoom real.
- Fluxos locais finais: 21 checks passaram; 0 falharam. Conferir status por linha; sequencia exploratoria remember preservada separadamente.

## Limites da matriz

Sem baseline visual aprovado. Sem aparelhos fisicos, Safari real, teclado virtual real, leitor de tela ou PWA instalado. Janela dividida/barra lateral do navegador foram representadas por reducao de area CSS, nao pelo acionamento da interface nativa do Windows. Dobravavel foi representado por viewports intermediarias e orientacoes, sem emulacao de hinge/segmentos. Fontes remotas bloqueadas.
