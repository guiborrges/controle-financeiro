# Etapa 2B - Primeiro lote: privacidade e salvamento

Status: implementado e validado localmente em 23/10/2026. Sem commit, push ou
deploy. Nenhuma conta real foi alterada. A etapa 2B ainda nao esta concluida:
F03 a F06 continuam pendentes. M10 e o painel de recorrencias continuam removidos.

## F01: historico fora dos arquivos publicos

O JavaScript publico deixa de conter os valores pessoais de historico e ESO.
A copia original foi preservada em `server/legacy-seed-data.js`, fora das pastas
publicas. Sua igualdade com o conteudo anterior foi conferida por SHA-256 e teste.
Ela e entregue pelo bootstrap autenticado somente ao usuario principal, seguindo
o criterio ja existente no servidor. ESO exige tambem a permissao correspondente.
Outras contas recebem null. Os dados salvos da conta nao sao sobrescritos.

Isso preserva a compatibilidade sem executar uma migracao nos dados reais.
Nao apaga historico Git, caches ou copias que terceiros ja tenham baixado.

Arquivos: `public/app/data.js`, `public/app/bootstrap.js`,
`server/legacy-seed-data.js` e `server/http/routes/app-state.js`.

## F02: preservar a ultima versao salva

Antes, os arquivos antigos podiam ser apagados antes de terminar o salvamento.
Agora cada tentativa prepara uma nova geracao de arquivos, verifica o tamanho
antes de grava-los, sincroniza e confere seus bytes antes de trocar o manifesto.
Se falhar, a versao anterior permanece referenciada e legivel.
Depois do sucesso, os arquivos antigos e residuos de tentativas interrompidas
sao removidos para evitar crescimento continuo do armazenamento e dos backups.

O formato continua partitionVersion 3/by-year-v1, com nomes de arquivos variaveis
ja aceitos pelo leitor. Os nomes antigos tambem foram testados. Testes existentes
de backup passaram a obter os caminhos pelo manifesto, mantendo suas verificacoes.

O gravador atomico deixa de apagar o destino quando Windows bloqueia a troca:
o salvamento falha explicitamente, preservando a ultima versao confirmada.
Arquivos: `server/app-state-store.js` e `server/fs-atomic.js`.

## Verificacao

- `npm test`: 375 aprovados, zero falhas, cancelamentos ou testes ignorados.
- 24 testes novos: 4 de privacidade e 20 de integridade.
- Falhas simuladas: escrita, fsync, troca de partes e manifesto, bloqueio Windows,
  tamanho excessivo, bytes corrompidos e encerramento antes de publicar o manifesto.
- Casos simples e criptografados, releitura em processo novo, leitura do formato
  anterior e limpeza apos oito salvamentos consecutivos.
- `node scripts/test-refactor-smoke.js`: 8 cenarios Desktop/Mobile aprovados,
  zero erros de pagina, estado ficticio intacto e nenhuma escrita financeira.
  Para bibliotecas locais: definir MEUFIN_SMOKE_VENDOR_DIR como
  `tmp/m01-preview/vendor` antes de executar.

Todos os cenarios usam armazenamento temporario e contas ficticias. Nao houve
teste em producao, alteracao de credenciais ou conexao bancaria/IA externa.

## Limites e proximos lotes

Nao foi acrescentado bloqueio entre varios processos escritores. Nao ha garantia
nova contra falha fisica do disco ou queda de energia em qualquer ponto.
Restore interrompido nao foi tornado transacional neste lote; a compatibilidade
de backup/restore foi testada no fluxo normal. F03/F04 (SQLite), F05 (dependencia)
e F06 (descricao de metas no Dashboard) ficam para lotes separados.

Reverter apenas o codigo preserva a leitura pelos manifestos existentes; nao foi
executada migracao destrutiva. Publicacao depende de autorizacao especifica.
