# Etapa 3D - Contratos compartilhados de projecao

Base: 43b9296. Data: 23/10/2026. Extracao compartilhada implementada e validada;
publicacao autorizada apos os testes. Sem inicio da etapa 4A.

Retomada para verificacao final e publicacao em 26/10/2026, sem mudanca de escopo.

## O que foi compartilhado

O modulo `public/app/modules/shared/calendar-projection.js`, sem estado ou DOM,
oferece o calculo de deslocamento mensal, a aplicacao desse deslocamento a uma
data, a projecao das datas de fechamento/pagamento e o avanco de parcelas.
O mesmo codigo e usado pelo navegador e por `server/calendar-projection.js`.

Os adaptadores continuam responsaveis por interpretar entradas, clonar renda,
projetos e saidas, escolher datas e aplicar seus normalizadores. O novo projetor
recebe essas politicas explicitamente. MesAtualOutflowExpenseDate mantem sua API.
O motor ContinuousCalendar, suas regras, paradas, excecoes e formato persistido
nao foram alterados. Nao ha migracao, dependencia nova ou cache persistente.

## Diferencas anteriores encontradas e preservadas

Nao se concluiu que todos os adaptadores eram funcionalmente equivalentes.
As seguintes diferencas exigem uma decisao de regra antes de mudar vencimentos:

| Caso sintetico | Navegador | Servidor |
|---|---|---|
| Renda com data completa 31/01/26 projetada em fevereiro | 28/02/26 | Conserva 31/01/26 |
| Projeto com data completa 31/01/26 projetado em fevereiro | Conserva 31/01/26 | 28/02/26 |
| Parcela de cartao com compra dia 10 e fechamento dia 20, adaptador com cartao na origem | Usa dia 20 | Usa dia 10 |
| Parcela via motor, cuja origem e um descritor de mes sem cartoes | Pode usar o fallback dia 1 | Mantem o deslocamento da data original |
| Payload bruto nao saneado: saida de parcela unica com indice 5 e participante pago | Indice 1, participante nao pago | Conserva indice 5 e pagamento do participante |

O ultimo caso e de payload bruto construido diretamente: modelos criados pelo
motor ja limpam os templates. Nao foi demonstrado que a conta real possui esses
payloads. Nao se alteraram recebimentos ou pagamentos da conta do usuario.

O fallback dia 1 foi confirmado tambem executando getContinuousCalendarOptions
do commit anterior 43b9296: parcela de outubro/2026 para fevereiro/2027 resultou
em 01/02/27, indice 5. Portanto nao foi introduzido por esta extracao.
Esses casos ficam pendentes de correcao funcional separada; nao foram escondidos
para alegar que navegador e servidor agora produzem sempre as mesmas datas.

## Testes

Sete testes de caracterizacao passaram antes da extracao. Depois, foram
acrescentados a matriz de 216 combinacoes e o caso de payload bruto. O helper
de adaptadores existente foi apenas movido para permitir reutilizacao.

Resultado: `npm test`, 407 aprovados, zero falhas/skips/cancelamentos.
Datas de fim de mes, bissexto, virada de ano, deslocamentos negativos/positivos
e saltos longos foram conferidos com expectativas calculadas independentemente.
O estado original permanece identico apos projetar. Os testes anteriores de
parada de serie, parcela final, pagamento, excecao mensal e serializacao passaram.

`npm run test:smoke`: 11 cenarios aprovados, zero pageErrors, fixture intacta,
nenhuma escrita financeira enviada. O novo cenario executa o motor real no
Desktop e Mobile e compara com a projecao do servidor em dados ficticios.
Confere fechamento/pagamento, renda, indices e pagamentos, explicitando o
fallback divergente ja existente em parcelas. Usa bibliotecas locais via
MEUFIN_SMOKE_VENDOR_DIR=tmp/m01-preview/vendor.

Nao houve comparacao da conta real em producao, conexao bancaria ou IA externa.
Persistencia dos cenarios de comando do smoke continua simulada; nao equivale
a gravacao HTTP ponta a ponta. Nao ha alegacao nova de desempenho ou cobertura
global. O teste manual de carga continua pendente, conforme documento 15.

## Reversao e limites

Reversao apenas de codigo. Nenhum formato de backup, revisao do modelo ou arquivo
financeiro foi reescrito. M10 e o painel de recorrencias continuam removidos.
F03 a F06 continuam pendentes. A extracao esta entregue; a equalizacao funcional
das politicas diferentes listadas acima nao foi executada neste lote.
