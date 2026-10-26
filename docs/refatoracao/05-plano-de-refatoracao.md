# Plano para aprovacao

## Autorizacao vigente de publicacao

Em 23/10/2026, apos a validacao da 3A, o usuario orientou publicar sempre ao
finalizar e conferir que todos os testes passaram. Esta orientacao substitui
as restricoes anteriores de publicacao por aprovacao individual neste plano.
Nao autoriza iniciar etapas ainda nao solicitadas. A 3A esta autorizada para deploy.

## Decisao solicitada

Atualizacao: etapa 2A concluida; primeiro lote 2B (F01/F02) publicado no commit
b277cbc. F03 a F06 continuam pendentes. A 3A foi publicada no commit a6ef665.
A 3B foi publicada no commit 57402ba e a 3C no commit 3458915. A limpeza de
testes foi publicada em 43b9296. A 3D foi autorizada e sua extracao compartilhada
implementada, conforme documento 16. Divergencias funcionais anteriores foram
registradas, nao corrigidas silenciosamente. A 4A foi solicitada em 26/10/2026:
reuso de totais por render e protecao do Dashboard oculto, conforme documento 17.
A 4A foi publicada em 1cd7e18. A 4B foi solicitada em seguida: eventos explicitos
de save/nav, inicializacao unica e CSS Mobile separado; escopo no documento 18.
A 4B foi publicada em deee36c. A etapa 5 foi solicitada: servicos de estado e
backups, fila de jobs e middleware de erros extraidos; escopo no documento 19.
A etapa 5 foi publicada em 8e08582. A etapa 6 foi solicitada: repositorio comum
de staging, prazos e filas limitadas por tenant, conforme documento 20.
A etapa 6 foi publicada em b2f8d58. A etapa 7 foi solicitada e executada como
validacao, com ressalvas e pendencias explicitadas no documento 21. Sem troca
de backend, major de biblioteca ou correcao financeira misturada a esta entrega.

Aprovar fases 2 a 7 em pequenas entregas, com correcoes F01-F06 tratadas em
mudancas separadas e explicitamente autorizadas. A fase 3 foi iniciada pela 3A.
Nao havera deploy automatico neste trabalho, mesmo apos testes locais.
Cada publicacao exigira autorizacao especifica.

Nao trocar framework, banco, biblioteca ou formato financeiro como atalho.
Usar os namespaces e modulos existentes, com fachadas mantendo nomes publicos.

## Ordem e complexidade

| Etapa | Conteudo | Complexidade | Dependencia / criterio de saida |
|---|---|---|---|
| 1 - Diagnostico | Inventario, mapa, riscos, baseline e cobertura | Media, concluida | Documentos 01-09; limites explicitos |
| 2A - Protecao | Caracterizacao financeira e dos adaptadores; fixtures sinteticas; smoke Desktop/Mobile | Alta, concluida neste lote | 36 testes adicionais e 8 cenarios browser; limites no documento 10 |
| 2B - Correcoes separadas | F01 privacidade; F02 integridade; F03/F04 SQLite; revisar F05/F06 | Alta | Autorizacao especifica, teste que reproduz cada problema, sem dados reais |
| 3A - Helpers | Fatura efetiva, contratos de valor/formatacao, helpers realmente equivalentes | Baixa/media | Contratos existentes preservados; sem mudar bases |
| 3B - Catalogos | Categorias/tags mensais e simbolos, indice com invalidacao explicita | Media/alta | Padroes + mes anterior positivo + excecoes atuais; mesmos IDs/ordem |
| 3C - Comandos | Extrair validacao e processamento de lancamentos do DOM | Alta | Desktop e Mobile enviam mesmo draft; criar/editar/excluir equivalentes |
| 3D - Projecao | Compartilhar contratos de datas/ocorrencias browser/servidor | Alta | Matriz de datas/parcelas/pagamentos equivalente; excecoes preservadas |
| 4A - Renderizacao | Um resumo por mes por render; nao reconstruir Dashboard oculto | Media | Ganho medido, mesmos numeros e grafico, filtros intactos |
| 4B - Mobile e CSS | Eventos explicitos substituem wrappers gradualmente; CSS por dominio | Alta | Design identico; cache atualizado e sem listeners duplicados |
| 5 - Backend | Separar servicos de HTTP/arquivos/jobs; contrato dos stores e erros | Alta | Mesmo HTTP, CSRF, ownership, revisoes, backup e restore |
| 6 - Integracoes | Repositorio SQL comum, prazos, jobs/locks e limites por tenant | Alta | Dedupe/multiplicidade intactos; falhas/retry nao duplicam |
| 7 - Validacao | Suite, E2E, desempenho, revisao de seguranca e operacao | Media/alta | Comparacao documentada; publicacao somente aprovada |

Complexidade expressa alcance e necessidade de caracterizacao, nao prazo
garantido. Extrair um helper e baixo risco; separar o controlador de lancamentos
ou persistencia transacional envolve varios lotes independentes de alto risco.

## Lotes verificaveis

Cada lote deve conter: fixture/teste antes da alteracao, mudanca pequena, testes
focados, suite completa, comparacao numerica, smoke de telas afetadas, atualizacao
do documento 08 e proposta de publicacao. Nao agrupar refatoracao com melhoria
visual ou correcao de calculo.

Exemplos iniciais apos aprovacao:

1. Testar precedencia de fatura em todos os consumidores, incluindo manual zero,
   previsao ausente, titular em despesa compartilhada e valores invalidos.
2. Extrair apenas a funcao de fatura; manter fachadas globais e API CommonJS/UMD.
3. Testar caracterizacao do catalogo: mes anterior sem gasto/com gasto, alias,
   categoria atual zero, visibilidade, tags acentuadas e simbolos internos.
4. Consolidar catalogo sem cache persistente; medir. So adicionar indice se
   houver beneficio, invalidado por revisao de dominio e nao por timer arbitrario.
5. Calcular resumo do Dashboard uma vez por mes dentro da renderizacao.
   Evitar memoizacao entre salvamentos enquanto leitura ainda normaliza estado.

## Contratos e testes obrigatorios

- Mensal: compromissos/consumo/caixa distintos; nao somar compra e fatura.
- Metas: reservas != limites; flags de inclusao preservadas.
- Compartilhadas: cota propria, participantes, reembolsos e proveniencia.
- Recorrencias: recebido/pago, excecao mensal, parada, escopo futuro,
  troca de cartao, parcelas finais e regra historica.
- Datas: dia 31, fevereiro comum/bissexto, 29/02, dezembro/janeiro,
  offsets compra-fechamento-vencimento e data completa explicita.
- Persistencia: conflito entre abas, falha offline, restore, cancelamento,
  falha de escrita em cada etapa e restart sem cache.
- Importacao: usuario/conta/provedor/ID nativo, duas compras iguais reais,
  credito/estorno, retry sem dupla gravacao, revisao mantida ate confirmacao.
- Patrimonio: transferencias neutras, checkpoints, inclusao e remocao de vinculos.

## Reversao e dados

Base de codigo: `a3011ea`. Cada lote em commit proprio, sem incluir pastas
de backup/output/tmp ou dados pessoais. Nao executar push enquanto nao houver
autorizacao de publicacao, pois o workflow atual publica automaticamente em main.

Para alteracoes puramente internas, reverter o commit deve restaurar codigo sem
reescrever dados. Se for indispensavel migrar formato: plano separado, backup
verificado, leitor compativel, teste de reversao e aprovacao antes de executar.
Uma reversao de codigo nao desfaz dados ja migrados; isso precisa ser explicitado.

## Fora do escopo

Atualizacao: primeiro lote F01/F02 da 2B publicado com autorizacao; detalhes no
documento 11. F03 a F06 continuam pendentes. A 3A e a 3B foram publicadas;
a 3C esta implementada. Nenhuma etapa seguinte foi iniciada.

M10 permanece removida. Sem novas funcionalidades, novos componentes visuais,
reactivacao de service worker, conexao bancaria real, IA externa, limpeza de
historico Git, troca de banco, migracao destrutiva ou mudanca de credenciais.
