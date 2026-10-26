# Etapa 6 - Repositorio SQL, prazos e admissao de trabalho

Data: 26/10/2026. Base: 8e08582. Sem inicio da etapa 7.

## SQL comum sem mudar identidades

server/repositories/pluggy-staging centraliza DDL de conexoes/transacoes e os
MERGEs usados pelo worker e webhook. Os adaptadores conservam a normalizacao
dos binds, tenant, account, record_type, datas e limites de texto anteriores.
resolveStagingKey continua escolhendo identidade canonica ou legado inequivoco;
historico ambiguo continua sem gravacao automatica. Nenhuma linha e removida.

Existem duas politicas explicitas para o MERGE de transacao: o worker atualiza
balance_amount; o webhook nao toca nesse campo. Ambos mantem a chave composta
tenant_user_id/external_transaction_id e a propriedade de commit do chamador.
Hashes do SQL normalizado comparam os mesmos tokens anteriores, inclusive a
variante sem saldo. O webhook continua sem criar o indice de status do worker;
nao foram adicionados indices ou migracoes de schema neste lote.

## Prazos e falhas

- Pluggy HTTP e Muplug: prazo incluindo headers e leitura completa do corpo,
  com propagacao de cancelamento e limpeza do timer/listener. Nenhum novo retry
  automatico de POST. O GET Pluggy conserva uma repeticao apos 401.
- OCI CLI HTTP e worker: execFile assincrono, sem shell, com limite de stdout,
  timeout e terminacao do processo filho. A rota conserva seus tres ensaios
  somente para os erros de limite de servico, com backoff assincrono de 2/5s.
- Oracle: pool com fila finita, prazo de espera e callTimeout por conexao;
  uma falha de createPool nao fica cacheada permanentemente. O callback com erro
  tenta rollback e sempre fecha a conexao sem mascarar o erro inicial.
- Sucesso nao ganha commit automatico. O chamador continua definindo transacoes.

callTimeout e por round trip, nao prazo total de um job, conforme a
[documentacao do driver 6.8](https://node-oracledb.readthedocs.io/en/v6.8.0/user_guide/connection_handling.html#database-call-timeouts).
Tambem nao e um novo prazo global para estabelecer conexoes. Retries e espera
na fila podem ampliar a duracao total de um pedido.

## Capacidade e locks locais

serial-queue aceita limites de pendencias por chave/processo e jobId opcional.
Uma pendencia inclui o trabalho em execucao. O mesmo tenant/job ativo compartilha
uma Promise; outros IDs ou tenants continuam distintos. Finalizacao/falha libera
contadores, job e tail quando nao ha sucessor. As politicas de retry da etapa 5
continuam: fila de usuario com uma tentativa adicional, fila PDF sem retry extra.

Invoice/Muplug verificam capacidade antes de criar arquivo/registro ou redefinir
um job. Reprocessar um job ativo responde ok sem zerar resultado/progresso nem
enfileirar outra copia. Fila cheia responde 503; o usuario pode tentar novamente.
O parse direto tambem tem fila por tenant e os PDFs passam pela fila OCI comum.
Webhook serializa trabalho por tenant e rejeita lote excessivo com 413 antes do
SQL; excesso de pendencias responde 503. Respostas normais permanecem iguais.

## Configuracao e padroes

| Variavel | Padrao | Unidade/escopo |
|---|---:|---|
| PLUGGY_HTTP_TIMEOUT_MS | 45000 | ms por requisicao e corpo |
| ORACLE_AI_TIMEOUT_MS | 45000 | ms por chamada HTTP/ensaio CLI da rota |
| ORACLE_AI_CLI_TIMEOUT_MS | 120000 | ms por CLI do worker |
| ORACLE_DB_QUEUE_TIMEOUT_MS | 30000 | ms de espera no pool |
| ORACLE_DB_QUEUE_MAX | 100 | pendencias no pool |
| ORACLE_DB_CALL_TIMEOUT_MS | 45000 | ms por round trip |
| INVOICE_MAX_PENDING_PER_USER / INVOICE_MAX_PENDING_TOTAL | 10 / 100 | jobs por tenant/processo |
| INVOICE_PARSE_MAX_PENDING_PER_USER / INVOICE_PARSE_MAX_PENDING_TOTAL | 5 / 20 | parses por tenant/processo |
| ORACLE_AI_MAX_PENDING | 20 | PDFs na fila OCI do processo |
| PLUGGY_WEBHOOK_MAX_PENDING_PER_USER / PLUGGY_WEBHOOK_MAX_PENDING_TOTAL | 20 / 100 | eventos por tenant/processo |
| PLUGGY_WEBHOOK_MAX_TRANSACTIONS | 1000 | transacoes por evento |

Valores novos devem ser inteiros positivos ate 2147483647; valores invalidos
usam o padrao. Nao foram alteradas variaveis, credenciais ou configuracoes reais.

## Evidencias e limites

476 testes Node aprovados (457 anteriores + 19 novos) e 14 cenarios de navegador.
Contratos novos cobrem: rejeicao antes da execucao, isolamento de capacidade,
mesma Promise para job repetido, liberacao apos falha, corpo HTTP travado,
cancelamento, CLI assincrono e encerramento por prazo, pool recuperavel,
rollback/close, ausencia de commit implicito e hashes de SQL anteriores.

Os testes de rotas mantem dois tenants processando e confirmam que novo pedido
excedente nao cria outro job; reprocessar ativo nao reinicia. Webhook valida
capacidade e tamanho antes de invocar o staging. Testes existentes de identidade
e importacao continuam aprovados para multiplicidade, reembolso, legado ambiguo
e retry sem nova importacao. Fixture do navegador imutavel, zero erros de pagina.

Oracle foi simulado: nao ha certificacao de execucao SQL, plano ou desempenho
no banco real. Nenhum banco, provedor, OCI ou conta real foi acionado. O teste de
processo usa Node e o teste HTTP usa loopback, sem custos externos.

Locks/capacidades sao locais a cada instancia/processo. Nao sao leases
distribuidos, quotas de disco/bytes ou limites compartilhados entre replicas.
Nao ha retomada automatica de jobs apos restart; o arquivo existente permite
reprocessamento manual. A identidade SQL e o plano de importacao continuam como
protecao persistente contra duplicacao, com os limites de ambiguidade existentes.
Autenticacao de webhook, fallback de tenant e politicas de acesso nao mudaram.

Publicar apos testes conforme autorizacao permanente. Reversao de codigo nao
exige migracao de dados; conferir workflow e disponibilidade de login/API.
