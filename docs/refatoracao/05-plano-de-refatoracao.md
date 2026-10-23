# Plano para aprovacao

## Decisao solicitada

Atualizacao da autorizacao: o usuario autorizou somente a etapa 2A, executada
conforme documento 10. A etapa 2B, a fase 3 e qualquer publicacao continuam
aguardando aprovacao especifica.

Aprovar fases 2 a 7 em pequenas entregas, com correcoes F01-F06 tratadas em
mudancas separadas e explicitamente autorizadas. A fase 3 NAO foi iniciada.
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

M10 permanece removida. Sem novas funcionalidades, novos componentes visuais,
reactivacao de service worker, conexao bancaria real, IA externa, limpeza de
historico Git, troca de banco, migracao destrutiva ou mudanca de credenciais.
