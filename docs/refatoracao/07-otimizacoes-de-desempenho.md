# Linha de base e oportunidades de desempenho

Os numeros abaixo sao o baseline historico da auditoria, nao SLA
da internet, de um aparelho real ou da Oracle.

## Atualizacoes implementadas

4A: resumo por mes por render e Dashboard oculto sem reconstrucao (documento 17).
4B: removido polling de wrappers a cada segundo; save/nav emitem eventos e o
Mobile instala seus listeners uma vez. Em navegador isolado, um save gera uma
renderizacao e uma escrita no cache de sessao mesmo apos tres chamadas de init.
CSS Mobile dividido em seis arquivos mantendo exatamente o conteudo e a ordem;
isso adiciona seis requisicoes CSS locais, nao representa ganho de carregamento.
Nao foi repetido o perfil CDP de heap/listeners e nao se afirma eliminar vazamento.

## Ambiente e metodo

Windows, Node v24.14.1, Chrome instalado em modo headless, Desktop 1440x1000
e emulacao Pixel 7. Mesma copia isolada de 88 meses / 2.742 saidas em memoria.
Servidor local somente leitura, assets locais, sem bancos/SMTP/IA externos.
Nenhum nome, valor financeiro individual ou conteudo de backup e publicado.

O servidor de verificacao substitui save/flush por operacoes sem escrita e usa
bootstrap de copia local. Portanto nao mede latencia de salvamento HTTP real,
disco da Oracle, login ou custo de rede/CDN. A conta de producao nao foi manipulada.

## Medicoes

| Operacao | Amostra | Resultado |
|---|---|---|
| `renderDashboard`, janeiro-outubro/2026, apos aquecimento | 7 execucoes | Mediana 66,9 ms; faixa 65,0-75,6 ms |
| Chamadas a FinancialQuery.totals por render acima | 7 execucoes | 163 chamadas para 10 meses |
| Trocar setembro/outubro via selectMonth, pagina mensal ativa | 8 execucoes | Mediana 16,7 ms; faixa 14,0-20,5 ms |
| Reload local + navegar ao Dashboard + indicadores montados | 3 execucoes | 595 / 730 / 669 ms (mediana 669 ms) |
| Carga local inicial Mobile + Dashboard disponivel | 1 execucao | 2.629 ms; amostra unica, nao percentil |
| MobileV2.refresh no Dashboard | 7 execucoes | Mediana 7,7 ms; faixa 7,4-9,1 ms |

Tempos de render sincrono nao incluem conclusao da animacao do Chart.js nem
pintura completa. A carga mobile inclui bootstrap e carregamento sequencial de
scripts. Um ensaio inicial de reload esperou indicadores em uma pagina mensal
restaurada e terminou em timeout; foi descartado, nao contado como falha do app.

## Memoria e listeners

Apos GC via CDP, antes e depois de 10 ciclos mes/Dashboard:

| Metrica CDP | Antes | Apos ciclos e estabilizacao |
|---|---:|---:|
| JSHeapUsedSize | 13.054.680 bytes | 13.201.108 bytes |
| Nodes (inclui DOM retido, nao apenas conectado) | 6.977 | 8.534 |
| JSEventListeners | 383 | 613 |

Nao houve erro JS. A amostra sugere investigar retencao de DOM/listeners, mas
NAO prova vazamento crescente ou origem especifica. Precisamos de mais ciclos,
heap snapshots e analise de retentores antes de corrigir algo nessa area.

## Oportunidades priorizadas e como validar

1. Resumo por mes dentro de renderDashboard: reutilizar totais em cards,
   medias, textos e datasets. Comparar 163 chamadas com alvo de uma por mes.
   Primeiro separar normalizacao, pois getTotals hoje tem efeitos colaterais.
2. Renderizar somente telas visiveis. `backup.js:232` sempre renderiza Dashboard
   mesmo quando a acao pertence a outra pagina. Preservar inicializacao dos
   filtros e restauracao de navegacao; usar invalidacao explicita da tela oculta.
3. `FinancialQuery.buildFacts` procura despesas por findIndex para cada saida e
   cartoes por find. Indexar IDs por consulta quando medido beneficio, mantendo
   comportamento de duplicatas e flags. Benchmark sintetico 100/1.000/10.000 linhas.
4. Catalogo de categorias consulta historico global para simbolos a cada montagem
   (`core.js:156`, `import-bills-utils.js:97`). Medir frequencia, depois indice por
   revisao de categorias; invalidar em rename, importacao e restore.
5. Mobile getMonthMetrics obtem totais mais de uma vez e planning normaliza de
   novo. Usar snapshot comum por render, sem cache global desatualizado.
6. Reduzir reconstrucoes de Chart.js, so depois de igualdade de dados/cores,
   filtros, destroy e navegacao ser comprovada por testes visuais.
7. Tirar OCI sincrono do processo HTTP. A fila atual limita simultaneidade,
   mas nao elimina bloqueio do event loop durante execFileSync/sleep de retry.
8. Perfil de escrita: Storage clona/serializa estado completo e particoes sao
   regravadas. Medir bytes, CPU, p50/p95 e evento de conflito antes de propor
   patch HTTP ou persistencia incremental. Isso exige contrato novo separado.
9. JS/CSS: 59 tags script defer no HTML, mais loader mobile sequencial. CSS
   principal 5.166 linhas e mobile 3.233. Medir custo de parse, estilos e requests
   antes de empacotar/carregar sob demanda; sem framework novo.

## Ainda nao medido

Persistencia HTTP real, salvamento em disco de producao, tempo de consulta SQL
Oracle, plano de execucao, sincronizacao bancaria, OCR real, abertura com rede
lenta, memoria de aparelho fisico e latencia de login. Nenhuma promessa de
melhoria e feita para essas areas. Apos cada lote, repetir ambiente, fixture,
periodo e amostras, comparando numeros e comportamento antes/depois.
