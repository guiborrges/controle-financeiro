# Revisao de integridade de dados

Data: 2026-10-22.

> Revisao historica. Em 26/10/2026, a validacao posterior registrou ressalvas
> especificas de SQLite: as garantias de restore/revisao abaixo nao certificam
> o backend opcional. Ver [arquitetura atual](ARCHITECTURE.md) e
> [fechamento da etapa 7](refatoracao/21-fechamento-validacao.md).

## Escopo

Revisao de recorrencias, cartoes, normalizacao, migracao, persistencia,
sincronizacao entre abas, importacao e restauracao de backups.
Testes automatizados cobrem tambem os demais modulos da suite existente.
Nao e uma garantia de ausencia de todos os defeitos do sistema.

## Correcoes

- Excecoes mensais salvas continuam protegidas de alteracoes futuras da serie.
- Exclusao e transferencia de cartao atualizam as regras, nao apenas os meses carregados.
- Criacao, edicao e exclusao de cartoes atualizam as configuracoes projetadas.
- Transferencias preservam a posicao das parcelas e nao reativam compras encerradas.
- Desativar recorrencia respeita o escopo escolhido e nao duplica a ocorrencia ao recarregar.
- Marcacoes explicitas de planejamento sobrevivem a normalizacao e migracao.
- Datas completas informadas pelo usuario nao sao deslocadas pela inicializacao.
- Gravacoes sem revisao nao podem sobrescrever um estado existente.
- Gravacoes consecutivas recebem revisoes distintas, mesmo no mesmo milissegundo.
- Recuperacao legada nao mistura backups antigos com meses atuais ou calendario continuo.
- Restaurar backup publica uma revisao nova e invalida abas antigas.
- Importacao so anuncia sucesso quando o servidor confirma a gravacao.
- Gravacao forcada aguarda sua propria versao na fila de sincronizacao.
- Migracao local recarrega os dados e a revisao oficiais, inclusive se outra aba vencer a corrida.

## Limites

Reproducoes destrutivas, restauracoes e conflitos foram testados com dados
sinteticos e armazenamento temporario, nao contra os dados reais do usuario.
As correcoes preventivas nao tentam adivinhar ou reverter valores historicos
que possam ter sido sobrescritos anteriormente. Faturas manuais e pagamentos
nao sao recalculados retroativamente.
