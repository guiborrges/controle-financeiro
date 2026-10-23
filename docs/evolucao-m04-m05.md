# Evolucao do MeuFin: M04 e M05

## M04 - Identificar a origem sem depender do texto

Cada nova transacao importada recebe uma identificacao composta pelo usuario, provedor, conta de origem e identificador externo. Mudar a descricao exibida nao muda essa identificacao.

- Worker e webhook usam o mesmo contrato para criar a chave do registro no Oracle.
- A conta faz parte da identificacao: o mesmo codigo em duas contas ou em dois usuarios nao e considerado o mesmo fato.
- O identificador completo e usado para gerar a chave de armazenamento. IDs longos nao sao cortados para produzir a identidade.
- A origem permanece nos lancamentos e movimentos patrimoniais depois de normalizar, editar, salvar e recarregar.
- Os marcadores de importacao podem ser reconstruidos a partir dessas identidades persistidas.
- Um registro antigo com chave inequivoca continua sendo atualizado no lugar, sem renomear ou apagar sua chave antiga.
- Se houver mais de um registro antigo candidato, worker e webhook nao escolhem um automaticamente: deixam de aplicar aquela atualizacao e registram o impedimento no log.
- Transacoes sem identificador externo ou conta identificada nao recebem um ID inventado a partir de descricao e valor. No recebimento bancario, ficam contabilizadas como nao aplicadas, com aviso no log, ate a origem poder identifica-las.

Nenhuma migracao ou fusao de dados pessoais foi executada. Nao foram criadas novas tabelas ou removidos registros antigos.

### Inventario Somente Leitura

Foi acrescentado o comando abaixo para analisar um export JSON do staging, sem conectar ao Oracle nem escrever dados:

```powershell
node scripts/audit-import-identities.js caminho-do-export.json
```

O arquivo deve conter um array de linhas ou `{ "rows": [...] }`. O resultado informa quantos registros usam identificacao atual, quantos sao antigos, quantos estao sem identificador e quantos grupos sao ambiguos. O comando foi testado com dados ficticios. O inventario da base Oracle real nao foi executado por falta de acesso; qualquer reparo desse historico exige conferencias e aprovacao separadas.

## M05 - Separar Duplicata Confirmada de Compra Parecida

- Mesmo identificador de origem, usuario e conta: o mesmo fato nao e importado novamente.
- IDs externos distintos: duas compras podem ter a mesma descricao, data e valor e continuar sendo dois lancamentos.
- Sem identificacao suficiente: a semelhanca gera uma revisao, nao uma exclusao automatica. A previa informa o motivo e permite confirmar como nova ou recusar o item.
- Cada candidato antigo so e utilizado uma vez na comparacao de um lote. Uma compra antiga nao elimina varias compras iguais recebidas depois.
- A busca por duplicatas nao usa mais trechos de descricao para decidir que dois fatos sao o mesmo.
- Debito, credito e estorno nao sao confundidos apenas por terem o mesmo valor absoluto.
- Faturas conservam a identidade de cada linha do arquivo processado. Repetir o envio do mesmo lote nao cria novas linhas.
- O servidor repete a verificacao antes de gravar. Se a revisao ainda estiver ambigua, responde com impedimento e nao grava parte do lote.

Creditos e estornos continuam visiveis para revisao e ficam desmarcados. Nao sao descartados silenciosamente nem convertidos em despesas. A liquidacao e o efeito financeiro desses ajustes pertencem ao contrato de faturas M06; esta entrega nao antecipa essa mudanca de calculo.

## Correcoes Necessarias no Caminho de Faturas

A verificacao no navegador encontrou referencias antigas que impediam o fluxo real: os meses e o usuario eram procurados como propriedades que nao estavam disponiveis na janela, os indices de categorias nao chegavam a revisao e o servidor ainda procurava os meses no campo antigo `data`, em vez de `finData`.

Esses pontos foram alinhados ao calendario e ao armazenamento atuais. Depois de uma importacao confirmada pelo servidor, a tela recarrega os dados persistidos. O CSV tambem deixou de descartar valores negativos e de assumir um cartao XP para qualquer arquivo.

## Verificacao

- 295 testes automatizados aprovados, incluindo identidade por conta e usuario, worker/webhook, IDs longos e ausentes, legado ambiguo, round-trip de origem, multiplicidade, reimportacao e consumo unico de candidatos.
- No navegador local, com conta ficticia: CSV com duas compras iguais e um estorno; duas compras gravadas e preservadas apos recarregar; estorno visivel e desmarcado; reimportacao bloqueada para revisao; recusa de um candidato e confirmacao explicita de outro como novo.
- Os testes locais de CSV nao usaram IA externa nem conexao bancaria. A sessao temporaria em memoria e a habilitacao do parser CSV ficaram apenas no processo de teste.
- Nao houve teste de ponta a ponta com banco ou Oracle reais, por falta de acesso nas contas ficticias. Nao foram alteradas permissoes para contornar essa limitacao.

Os relatorios da pesquisa permanecem como registro historico das propostas anteriores a esta implementacao.
