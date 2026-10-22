# Evolucao do MeuFin: M03 e M02

## M03 - Saber se o lancamento foi realmente salvo

O aviso de sucesso passa a depender da confirmacao do servidor, nao apenas de o lancamento aparecer na tela.

- O formulario do celular aguarda a escolha do alcance da alteracao recorrente e a resposta do salvamento.
- Se os dados forem invalidos ou a escolha de alcance for cancelada, o formulario continua aberto e nao mostra sucesso.
- Se o envio falhar, o formulario permanece com o aviso de salvamento pendente e a opcao de tentar novamente. Essa tentativa envia o que ja foi aplicado, sem criar outro lancamento.
- Durante o envio, os controles ficam bloqueados para evitar duplo clique ou alteracoes que nao corresponderiam ao pedido enviado.
- No Internet Banking, os itens so saem da revisao depois da confirmacao. Tentativas individuais e em lote mantem os itens recuperaveis e nao reaplicam a mesma transacao.
- A revisao de fatura tambem aguarda a confirmacao antes de fechar. O fluxo de faturas processadas confirma primeiro os salvamentos locais pendentes e trata respostas de erro sem anunciar sucesso.
- O celular deixa de emitir a vibracao de confirmacao bancaria quando o resultado e pendente ou falhou.

## M02 - Editar no celular sem perder dados

Alterar a descricao de um lancamento nao pode desfazer sua recorrencia, parcelamento ou divisao entre pessoas.

- A edicao preserva o objeto original e altera somente os campos editados.
- Permanecem os vinculos da serie, numero e posicao das parcelas, tag, estado de pagamento e dados dos participantes, incluindo seus identificadores e pagamentos confirmados.
- O formulario de um gasto compartilhado mostra o valor total original da compra, e nao apenas a parte do proprietario.
- Valores com centavos sao mantidos ao abrir e salvar a edicao.
- Categoria e saida antigas continuam selecionadas mesmo quando nao aparecem nas opcoes atuais.
- Cancelar a escolha do alcance nao muda os dados. Depois de fechar, o foco retorna ao lancamento quando ele ainda esta na tela.

## Verificacao

Foram acrescentados testes automatizados de preservacao de dados, cancelamento, confirmacao atrasada, falha e nova tentativa sem duplicacao. Os testes existentes de conflitos de versao, queda de conexao e fila de gravacoes tambem foram executados.

No navegador local, somente com conta ficticia, foram conferidos: edicao de recorrencia, parcela e compartilhamento; cancelamento do alcance; salvamento e recarga; centavos; retorno de foco; queda de conexao; erro HTTP 500 e tentativa posterior sem duplicacao.

O teste local usa sessoes temporarias em memoria para contornar a falha de permissao do Windows. Essa adaptacao nao faz parte do aplicativo publicado. A integracao bancaria real continua sem teste completo por falta de acesso nas contas ficticias; os fluxos de confirmacao bancaria foram testados com dados simulados.

Nao foram feitas migracoes de dados pessoais, alteracoes de formulas financeiras nem mudancas de permissoes bancarias. Os relatorios da pesquisa continuam como registro historico das propostas anteriores a esta implementacao.
