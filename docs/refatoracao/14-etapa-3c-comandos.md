# Etapa 3C - Comandos de lancamentos de saida

Base: 57402ba. Trabalho autorizado em 23/10/2026. Publicacao autorizada apos
concluir a entrega e conferir os testes. Nao inicia 3D nem resolve F03 a F06.

## Mudanca principal

Antes, salvar uma saida misturava leitura de campos, validacao, alteracao dos
meses, confirmacao de escopo, salvamento e atualizacao da tela. O Mobile ainda
abria e preenchia o formulario Desktop oculto para conseguir salvar.

Agora `public/app/modules/mes-atual/outflow-commands.js` recebe os dados do
lancamento e as dependencias explicitamente. Esse modulo valida e processa o
salvamento e a exclusao, sem acessar document, seletores, DOM ou armazenamento
do navegador. Normalizadores, recorrencia, historico e persistencia existentes
continuam sendo utilizados por meio dessas dependencias.

O Desktop tem um adaptador que le os campos; sua coleta de compartilhamento
tambem fica no adaptador, com calculo/validacao delegados ao modulo comum.
O Mobile monta os mesmos campos de comando diretamente a partir de seu payload,
preservando as opcoes avancadas do registro editado. Ele nao abre nem preenche
mais a janela Desktop. As duas telas passam pelo mesmo bloqueio de envio em curso.

Mensagens, renderizacao e fechamento das telas continuam nos adaptadores.
As funcoes publicas antigas de salvar/excluir continuam disponiveis para os
botoes e outros consumidores. Rendas, metas e importacoes nao foram reescritas.

## Comportamentos preservados

- Descricao, categoria, valor e data validados antes de alterar os registros
  financeiros; normalizacao inicial do mes continua como antes.
- Escolha entre somente este mes e meses futuros antes da alteracao recorrente;
  cancelar nao aplica a mudanca. Motor de projecao existente mantido.
- Parcelas, grupo, indice e pagamento preservados na edicao Mobile.
- Divisao igual/manual, cota propria e valores das outras pessoas mantidos.
  Ao editar, identidades, nomes, pagamentos e metadados dos participantes
  continuam preservados, assim como os metadados originais do lancamento.
- Salvamento so retorna saved apos a confirmacao da promessa correspondente.
  Falha retorna pending; retry Mobile utiliza o flush existente, sem inserir
  outro lancamento. A protecao contra dois envios simultaneos e compartilhada.
- Exclusao continua com a confirmacao e o salvamento anteriores. Este lote nao
  torna a exclusao transacional nem acrescenta rollback apos falha de rede.

## Testes

Quatro testes de caracterizacao passaram antes da extracao: validacao/retry e
exclusao recorrente cancelada, mensal ou futura. Depois foram acrescentados
testes de edicao Mobile compartilhada (igual/manual), parcelas e envio simultaneo.

O novo arquivo `tests/outflow-command-contract.test.js` tem 20 testes: 16
combinacoes Desktop/Mobile de modo simples/recorrente/parcelado/compartilhado
com debito/Pix/boleto/cartao; validacao sem alteracao dos registros; compartilhamento;
confirmacao de persistencia; ausencia de dependencias diretas de DOM/storage.
Os contratos Mobile anteriores foram adaptados para verificar a chamada direta,
mantendo a cobertura de aguardar salvamento e nao fechar em invalid/cancelled/pending.

Comandos reproduziveis:

```powershell
node --test tests/outflow-command-contract.test.js tests/mes-atual-continuous-actions.test.js tests/mobile-save-contract.test.js
npm test
$env:MEUFIN_SMOKE_VENDOR_DIR = (Resolve-Path 'tmp/m01-preview/vendor').Path
node scripts/test-refactor-smoke.js
```

Resultado: 413 testes aprovados, zero falhas/skips/cancelamentos; 10 cenarios
de navegador aprovados, zero erros de pagina. Os oito cenarios anteriores
continuam cobrindo totais, filtros, graficos, cancelamentos e isolamento.

Os dois novos cenarios exercitam formularios reais em paginas ficticias isoladas:
criar/editar/excluir Desktop; salvar com falha simulada, tentar novamente sem
duplicar e editar Mobile. O teste Mobile substitui a abertura da janela Desktop
por uma funcao que lanca erro se for chamada. Usa o seletor de data efetivamente
ativo no Mobile, sem alterar seu codigo.

Nesses cenarios a resposta de persistencia e simulada apenas no navegador.
Nao e prova de gravacao HTTP ponta a ponta ou de reinicio do servidor. O servidor
da fixture permanece somente leitura, rejeita POSTs auxiliares e conserva os
dados originais; nenhuma escrita financeira foi enviada. Stores e confirmacao
de falhas/revisoes continuam cobertos pela suite isolada existente.

## Dados, limites e reversao

Sem alteracao da conta real, conexao bancaria ou IA externa. Sem migracao de
meses, novo formato de backup, novo banco ou dependencia. Aparencia mantida;
M10 e o painel de recorrencias continuam removidos.

Este lote cobre o fluxo unificado de saidas, nao todos os comandos do aplicativo.
O grande controlador ainda tem outras responsabilidades; extrair o motor de
datas/projecao e trabalho da 3D. Nao houve auditoria de todos os modos contra
dados pessoais em producao. Reversao e apenas de codigo, sem reescrever dados.
