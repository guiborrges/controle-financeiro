# Correcoes da auditoria do MeuFin

## O que foi corrigido

- MF-A001 e MF-A003: compras do cartao nao sao somadas novamente quando ja estao na fatura. O total do mes e o Dashboard usam a mesma base.
- MF-A002: resultados negativos no celular voltaram a mostrar o sinal de menos.
- MF-A004: cancelar uma recorrencia para os meses seguintes tambem impede que ela reapareca depois de recarregar a pagina. Pagamentos ja confirmados sao preservados.
- MF-A005: a data completa informada para receber uma renda fixa nao e mais transformada em uma data do mes seguinte ao salvar.
- MF-A006: o calendario do celular mostra os pagamentos e recebimentos previstos, como no computador.
- MF-A007: compras realizadas no debito, Pix ou dinheiro continuam sendo marcadas como pagas automaticamente. Lancamentos novos com data futura nao recebem essa marcacao. Confirmacoes antigas nao foram desfeitas em massa.
- MF-A008: se o salvamento falhar, o sistema avisa e tenta guardar uma copia protegida neste navegador. A copia pode ser recuperada ao recarregar a mesma aba. Quando a conexao volta, tenta salvar novamente. Se o servidor mudou nesse intervalo, bloqueia a sobrescrita e oferece baixar a copia pendente. Se o navegador nao permitir guardar a copia, o aviso orienta manter a aba aberta.
- MF-A009: datas impossiveis, como 31 de fevereiro, sao recusadas no formulario de lancamentos.
- MF-A010: os avisos de vencimento tambem consultam os meses do calendario continuo.
- MF-A011: a busca nao duplica o valor da fatura com suas compras. Quando o filtro mostra apenas uma compra, o valor dessa compra continua sendo somado.
- MF-A012: o resultado do mes e o Dashboard do celular descontam os valores incluidos nas metas financeiras.

## Internet Banking

As compras importadas para cartao passam a respeitar o mes selecionado pelo usuario. A tela de importacao destaca o mes de destino e explica que a data da compra e o fechamento nao mudam essa escolha.

Nao foi realizada uma importacao bancaria real: as contas ficticias nao possuem acesso a essa integracao. Nenhuma conta bancaria pessoal foi conectada e nenhuma permissao compartilhada foi alterada.

## Como foi conferido

- 269 testes automatizados passaram, incluindo testes novos para os erros encontrados.
- No navegador local, usando somente uma conta ficticia: totais do mes, fatura, Dashboard, busca, metas, cancelamento de recorrencia, datas, notificacoes e pagamentos no celular.
- Simulacao de queda de conexao, retorno da conexao e recuperacao de lancamento apos recarregar a pagina antes do envio ao servidor.
- O teste local usou sessoes em memoria para contornar a falha de permissao do Windows. Essa adaptacao ficou somente no processo de teste; nao foi incluida no aplicativo publicado.

Os relatorios anteriores continuam sendo o registro historico da auditoria, anterior a estas correcoes. Os testes dispensados pelo usuario nao foram apresentados como aprovados.
