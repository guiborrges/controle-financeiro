# Etapa 5 - Servicos, contratos de persistencia e jobs

Data: 26/10/2026. Base: deee36c. Sem inicio da etapa 6.

## Escopo implementado

- services/app-state-service: recuperacao/preparacao do bootstrap, verificacao
  de revisao e perda de meses, commit e atualizacao auxiliar do widget.
- services/backup-service: criacao manual, cooldown e criacao do backup de saida.
- jobs/serial-queue: encadeamento de jobs por chave, usado nas filas PDF/usuario.
- http/error-handler: apresentacao HTTP dos erros gerais, extraida de server.js.

As rotas mantem autenticacao, CSRF, validacao do corpo, identidade da sessao,
metadados da requisicao, status e mensagens publicas. Servicos nao recebem
req/res, nao importam Express e nao escolhem caminhos de arquivos.
O conflito de estado e um erro de dominio com kind/details, traduzido para 409
pela rota. Erros de armazenamento continuam no caminho HTTP anterior.

## Contrato dos stores preservado

readUserAppState(userId, encryptionKey) retorna o envelope existente ou null;
writeUserAppState(userId, state, encryptionKey) retorna updatedAt e metadados;
hasUserAppState(userId) decide se a migracao legada pode escrever.
O servico recebe essas funcoes por injecao e nao muda sincronismo, ownership,
criptografia, tamanho maximo, schema, caches ou publicacao atomica do store.

A revisao e comparada antes da protecao contra perda de meses. Sem conflito,
grava-se primeiro o estado; uma falha do widget nao desfaz o commit. Bootstrap
mantem as mesmas regravacoes de recuperacao, particionamento e criptografia,
com a revisao realmente retornada pelo store. Nao existe nova migracao.

Criacao de backup continua usando o backup-store concreto. Restore, retencao,
ancoras mensais, validacao e auditoria de arquivos nao foram reimplementados.
Tokens de operacao e CSRF de saida permanecem na camada HTTP, na mesma ordem.

## Filas e limites

A fila PDF conserva uma chave unica e nao repete automaticamente o job que
falhou. A fila por usuario conserva a tentativa adicional que ja existia no
encadeamento then/catch. Ambas liberam jobs posteriores apos falha; chaves
distintas seguem independentes. As Promises terminais continuam retidas no mapa,
como antes; nao foi introduzida limpeza, lock distribuido ou nova concorrencia.

Esta entrega nao esvazia todas as rotas de autenticacao/perfil/importacao nem
reescreve o processamento de arquivos/OCI. Extrai os fluxos centrais descritos
acima; o restante continua nos modulos existentes. SQL comum, limites por tenant,
timeouts e workers pertencem a etapa 6. F03/F04 do SQLite e demais divergencias
financeiras documentadas continuam fora desta mudanca estrutural.

## Validacao

- 457 testes Node aprovados, contra 421 na base.
- 21 testes novos de servicos, fronteiras de conflitos, envelope de bootstrap,
  falhas de widget/disco, cooldown, fila serial, retry e erros gerais.
- Uma suite Express local com 14 subcenarios HTTP, somente fixtures em memoria.
  Total adicional: 36 testes contando a suite pai e seus subtestes.
- Os mesmos subcenarios tambem passaram carregando as rotas da base deee36c
  em memoria, sem alterar o checkout: comparacao de contrato antes/depois.
- Cobertura HTTP: autenticacao, CSRF, owner da sessao, primeiro save, revisao,
  isolamento, migracao idempotente, falha de leitura/grava/rewrite, tokens de
  backup, CSRF via body na saida e corpo excessivo.
- Suite existente de backup/restore com ownership, revisao nova e conteudo
  preservado nos formatos plain/encrypted/partitioned continua aprovada.
- 14 cenarios de navegador Desktop/Mobile aprovados, zero erros de pagina,
  fixture imutavel e zero escritas financeiras no servidor da fixture.

Nenhuma conta real foi acessada ou alterada. Oracle/OCR/SMTP reais nao foram
acionados. O teste HTTP usa sessoes sinteticas, nao certifica cookies do login
em producao. Nao foi medida latencia de disco ou rede de producao.

## Publicacao e reversao

Publicacao segue autorizacao permanente apos testes. E possivel reverter o
commit sem migrar dados, pois interfaces, banco e formato de backup nao mudaram.
Conferir workflow e login/bootstrap sem autenticacao depois do deploy.
