# Riscos e problemas funcionais separados

Nenhum item deste documento foi corrigido. Nao ha evidencia de perda de dados
reais; as simulacoes utilizaram apenas registros ficticios em armazenamento temporario.

## F01 / A01 - Historico embutido exposto

Gravidade: critica para privacidade. Prioridade P0.

- Evidencia: `public/app/data.js:529` e constantes de ESO contem historico
  embutido. `server.js:419` serve APP_DIR sem `requireAuth`.
- Confirmacao em 23/10/2026: GET sem cookie para `/app-assets/data.js` retornou
  HTTP 200 com 83.921 bytes e as constantes historicas. Valores/nomes nao sao
  reproduzidos aqui. Nao foi investigado historico de acesso ou terceiros.
- `canUseBundledFinanceData()` limita uso na UI, nao protege o conteudo entregue.
- Proposta sujeita a aprovacao: separar codigo publico de dados privados;
  garantir copia integra no armazenamento autenticado antes de retirar seeds;
  testar conta principal, nova, vazia, restore e permissao ESO. Apenas exigir
  login no asset nao isola o conteudo entre usuarios autenticados.
- A remocao do seed nao apaga copias previamente distribuidas ou historico Git.
  Essa parte exige decisao especifica; nao reescrever Git automaticamente.

## F02 / A02 - Falha no meio da escrita pode invalidar estado anterior

Gravidade: alta. Evidencia: `server/app-state-store.js:300`, `:369`, `:679`.

`writeMonthsPartition` remove o diretorio de blocos antigo, recria os blocos e
so depois `writeUserAppState` publica o manifesto. Atomicidade por arquivo nao
e atomicidade do conjunto. O limite de tamanho tambem e conferido depois da
escrita das particoes.

Simulacao: gravar dois meses ficticios em anos diferentes; injetar erro `EIO`
em `fs.renameSync` do proximo bloco; tentar salvar novamente; restaurar fs,
limpar cache e reler. Resultado: salvamento falhou e leitura anterior tambem
falhou com bloco mensal ausente/invalido. Nenhum arquivo real foi usado.

Proposta: montar geracao nova completa, validar tamanho/checksums, publicar
referencia atomica e apenas depois coletar a geracao anterior. Testar falha
em cada passo, falta de espaco, permissao Windows e reinicio sem cache.
Isso e correcao de integridade, com PR/commit independente da extracao de codigo.

## F03 / A03 - Restore com SQLite opcional

Gravidade: alta se `FIN_STATE_BACKEND=sqlite`. Codigo confirmado; efeito
end-to-end do restore nesse backend ainda precisa de teste especifico.

`state-store-factory.js:27` prioriza SQLite ao ler. `backup-store.js:585`
restaura bundle JSON diretamente e nao atualiza SQLite. O espelho JSON pode
falhar sem invalidar a escrita SQLite (`state-store-factory.js:40`).

Nao presumir SQLite ativo em producao. Nao mudar configuracao para investigar.
Proposta: contrato de backup/restore pelo store ou decisao explicita de manter
somente JSON suportado ate a paridade ser comprovada. Nenhuma migracao proposta.

## F04 / A04 - Revisoes SQLite podem repetir

Gravidade: alta, condicional ao backend SQLite.
Evidencia: `sqlite-app-state-store.js:70` versus `app-state-store.js:687`.

Simulacao em banco temporario: fixar o relogio e efetuar duas escritas diferentes.
SQLite gerou a mesma revisao nas duas. O store JSON usa maximo entre relogio e
revisao anterior + 1. O teste atual de SQLite nao congela o relogio.
Proposta: paridade monotona e verificacao de revisao no mesmo limite transacional.

## F05 / A06 - Nodemailer

`npm audit --json` encontrou uma dependencia de severidade alta e zero criticas.
Isso nao prova que todos os avisos sao exploraveis pelos formularios atuais.
O SMTP configurado e os caminhos de entrada precisam ser avaliados.

Fonte primaria consultada: [aviso do mantenedor sobre addressparser](https://github.com/nodemailer/nodemailer/security/advisories/GHSA-v53p-9fqp-m79j).
Nao atualizar versao major silenciosamente; revisar compatibilidade e manter o
teste de transporte JSON, adicionar casos dos enderecos aceitos pelo produto.

## F06 - Mensagem de metas pode divergir do total

Possivel inconsistencia, nao corrigida: `dashboard.js:360` soma diretamente
`financialGoals[].valor` para texto descritivo, enquanto FinancialQuery exclui
metas com `includeInTotals=false`. O texto pode tratar uma meta excluida como
reservada. Requer fixture com meta excluida e validacao da semantica do texto.

## Outros riscos de regressao

- Trocar centavos por soma decimal, incluir fatura e compra ao mesmo tempo,
  ou usar valor total de despesa compartilhada em vez da cota do titular.
- Alterar parcela/serie ja paga, excecao mensal, parada de recorrencia,
  cartao de destino ou data completa informada pelo usuario.
- Apagar categoria/tag oculta de registros historicos ou confundir simbolo com ID.
- Normalizar dados durante uma consulta e depois persistir a normalizacao sem
  acao do usuario. Separar preparacao de estado e consulta exige caracterizacao.
- Retirar wrappers globais antes de atualizar HTML inline e carregadores dinamicos.
- Emitir sucesso antes de resolver a promessa de salvamento; tratar 409 como sucesso.
- Transferencia patrimonial contada como despesa ou reconciliacao sobrescrita.
- Mudar esquema/API de importacao e perder identidade, multiplicidade ou tenant.

## Seguranca observada e limites

Existem autenticacao, CSRF, rate limiting, regeneracao de sessao, cookies
HttpOnly/SameSite, criptografia de estado e validacao de proprietario.
SQL Oracle/SQLite usa binds nos caminhos inspecionados; ha indexes compostos
por tenant e identidade. Nao remover essas protecoes para simplificar codigo.

CSP permite `unsafe-inline` (`security.js:7`); ha 221 handlers inline no HTML
principal. Isso pede reducao gradual da superficie de HTML e testes de escape,
nao uma troca abrupta de CSP que desative os formularios. Nao foi demonstrada
uma cadeia XSS completa nesta auditoria.

Workers possuem tenant por ambiente e defaults legados. Confirmar a vinculacao
de cada integracao antes de ampliar multiusuario; nao alterar credenciais.
O guarda `running` e local ao processo: nao e lease distribuido. Falta de timeout
explicito em fetch/OCI e evidencia de robustez incompleta, nao prova de travamento
ocorrido. Tratar como hardening com testes de idempotencia e interrupcao.
