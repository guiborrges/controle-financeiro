# Calendario continuo

Revisado em 26/10/2026, codigo de referencia d83efd4.
Contexto geral: [ARCHITECTURE.md](ARCHITECTURE.md).

O seletor oferece os 12 meses do ano atual e os 12 do proximo ano. Meses
historicos gravados continuam disponiveis. A janela e recalculada ao abrir o
app e ao montar o seletor; navegar nao grava meses nem cria backups.

`finCalendarModel` guarda regras de rendas, despesas recorrentes e parcelas,
com revisoes por competencia e encerramento explicito. O motor compartilhado
fica em `public/app/modules/continuous-calendar.js`. O adaptador do app
preserva as regras existentes de datas, cartoes e totais. O widget usa o mesmo
motor para reconstruir competencias ausentes do armazenamento.

As ocorrencias projetadas comecam nao pagas/nao recebidas. Pagamentos,
recebimentos, exclusoes locais e edicoes individuais sao excecoes mensais.
Meses virtuais intactos sao omitidos de `finData`; em meses editados, o app
grava as diferencas e as exclusoes necessarias para reconstruir a competencia.
Os meses legados sao preservados para manter historico e referencias.

A primeira ativacao exige backup manual bem-sucedido do usuario autenticado.
A versao do modelo e salva no app-state e a ativacao nao se repete em outros
dispositivos. A chave participa do armazenamento criptografado, das particoes
do servidor, do export/import e dos snapshots de desfazer. O guard de revisao
409 e a protecao contra queda de quantidade de meses permanecem ativos.

Validacoes: testes de projecao sem predecessor, fim de parcelas, excecoes
apos varios ciclos de save/load, exclusao em um mes, alteracao futura,
preservacao de recebimentos, tamanho por navegacao e widget. QA de navegador
usa armazenamento local isolado e conta sintetica.

## Fronteiras atuais de responsabilidade

- continuous-calendar.js define regras, revisoes e excecoes sem depender da tela.
- continuous-calendar-app.js adapta o motor ao estado e comandos do navegador.
- modules/shared/calendar-projection.js centraliza deslocamento de datas,
  fechamento/pagamento e avanco de parcelas sem DOM.
- server/calendar-projection.js adapta projecao para consumidores do servidor,
  inclusive widget. Compartilhar helper nao torna todas as politicas identicas.
- modules/mes-atual/outflow-commands.js e os modulos de recorrencia atualizam
  series e excecoes conforme o escopo escolhido pelo usuario.

Ao editar serie/cartao a partir de um mes, nao copiar uma configuracao antiga
sobre revisoes futuras ou excecoes individuais. Categoria/tag selecionada para
uma competencia nao deve ser expandida automaticamente para todas as outras.

## Ressalvas e validacao

Ha diferencas anteriores entre adaptadores browser/servidor para datas de renda,
projetos e parcelas. A extracao 3D preservou essas politicas, sem aprovar uma nova
regra de negocio. Ver [relatorio 3D](refatoracao/16-etapa-3d-projecao.md).
Nao afirmar que todas as datas sao identicas apenas porque o helper e comum.

Testes de calendario/recorrencia/projecao integram npm test. O smoke usa dados
sinteticos e caracteriza datas Desktop/Mobile/servidor sem alterar contas reais.
O backup inicial confirmado e o guard 409 continuam obrigatorios.
