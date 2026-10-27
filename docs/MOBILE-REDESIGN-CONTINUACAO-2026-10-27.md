# Redesign mobile: continuacao e controle dos 36 itens

Esta entrega continua a primeira rodada; nao declara a auditoria inteira
encerrada. A lista original em auditoria-design-mobile e um retrato anterior.

## Alteracoes desta rodada

- Metas: gasto, limite e restante; excedente em dinheiro ao ultrapassar.
- Cartoes: vencimento pelo helper canonico de competencia; parcelas e
  recorrencias nos metadados; compras sem segunda borda de card.
- Calendario: legenda usa a mesma funcao de cor dos dias, sem mudar totais.
- CSS: acabamento mobile separado em mobile-design.css. Banking passou de
  estilo injetado para folha estatica e escopada.
- Banking: destino mensal, selects nomeados, expansao acessivel, controles
  de 44 px, superficies opacas e textos sem tracking negativo.
- Banking: bloqueio durante importacao; sucesso somente para saved; pending
  nao confirma. Falha ao recarregar depois de saved nao anula o sucesso.
- Banking: erro de rede/HTTP nao vira desconexao falsa; Tentar novamente.
  Fechar invalida a abertura pendente.

Nenhum schema, calculo canonico, conciliacao, importador ou saldo persistido
foi alterado. Testes usam adaptador sintetico, nao bancos reais.

## Donos dos estilos

| Arquivo | Responsabilidade |
|---|---|
| product-design.css | Tokens e apresentacao compartilhados, incluindo Desktop |
| modules/mobile-v2/styles/*.css | Estrutura dos componentes MobileV2 |
| modules/mobile-v2/styles/banking.css | Estrutura estatica do banking |
| mobile-design.css | Acabamento mobile final, depois dos anteriores |
| login/login.css | Autenticacao, sem mudar seguranca |

A separacao nao elimina todo o CSS legado. Outras remocoes exigem comparacao.

## Situacao item a item

Entregue indica implementacao e verificacao do escopo descrito, nao certificacao
WCAG nem homologacao fisica. Parcial identifica trabalho restante.

| ID | Situacao | Evidencia ou trabalho restante |
|---|---|---|
| 001 | Entregue | Nao intersecao a 320 px |
| 002 | Entregue | Valores extremos integrais dentro das metricas |
| 003 | Parcial | Foco/Escape/retorno/rascunho testados; revisar sheets secundarios |
| 004 | Entregue | Geometria real das barras testada |
| 005 | Entregue | Espaco para nome/valor e caixa alta preservada |
| 006 | Entregue | Lista primeiro; distribuicao recolhida e legenda integral |
| 007 | Entregue | Contraste automatizado do ativo escuro >=4,5 |
| 008 | Entregue | Menu secundario comum; falta aceite com leitor fisico |
| 009 | Entregue | Rotulos e estado acessivel; navegacao preservada |
| 010 | Parcial | Folhas com dono e banking sem injecao; ainda ha estilos legados |
| 011 | Entregue | Ranking resumido com expansao sem excluir totais |
| 012 | Entregue | Periodo explicito e contratos preservados |
| 013 | Entregue | Resultado destacado e metricas secundarias |
| 014 | Parcial | Duas trilhas; revisar busca/tag ao alternar meses |
| 015 | Entregue | Menu linear sem blur radial |
| 016 | Parcial | Descricao/valor e parcelas melhorados; revisar todas as listas extremas |
| 017 | Parcial | Alvos ampliados; inventario geral incompleto |
| 018 | Entregue | Restante/excedente e ausencia de meta explicitos |
| 019 | Entregue | Vencimento canonico, parcela/recorrencia e compras subordinadas |
| 020 | Parcial | Renda legivel; revisar esperado/recebido em todas as combinacoes |
| 021 | Pendente | Unificar reembolsos e totais por status |
| 022 | Parcial | Menu secundario; terminar desaninhamento |
| 023 | Entregue | Anos agrupados sem perder meses |
| 024 | Parcial | Fonte/tokens preservados; escalas legadas por componente |
| 025 | Parcial | Busca mes/metodo testada; faltam contexto de tag e limpeza comuns |
| 026 | Parcial | Rascunho/foco/save testados; agrupamentos e baixa altura restantes |
| 027 | Entregue | Resumo compacto, legenda, selecao e detalhe do dia |
| 028 | Parcial | Destino, pending/saved e retry testados; falta lote parcial e descarte |
| 029 | Entregue | Icones corrigidos e switch semantico |
| 030 | Entregue | Identidade harmonizada sem trocar autenticacao |
| 031 | Parcial | Dashboard vazio explicito; revisar vazios combinados do mes |
| 032 | Parcial | Erros no dialogo e banking recuperavel; ampliar demais falhas/toasts |
| 033 | Parcial | Perfil modal; falta cobertura de onboarding/notificacoes |
| 034 | Bloqueado em parte | Emulacao nao valida teclado virtual, notch ou aparelho fisico |
| 035 | Parcial | Graficos principais com Inter/tokens; exportacao/paletas restantes |
| 036 | Parcial | Reduced-motion/gesto restrito; falta matriz completa de interrupcao |

## Verificacao

Runner mobile ampliado de 19 para 29 cenarios em Chromium, Firefox e WebKit,
com fixtures e armazenamento isolados. Inclui destino, campos, pending/saved,
bloqueio de reenvio e recuperacao de HTTP 503 no banking.
Testes de dominio/smoke existentes cobrem idempotencia, isolamento, competencia,
parcelas e confirmacao. Nao houve teste com instituicao ou conta bancaria real.
Revisao com duas perspectivas independentes: contratos/seguranca e arquitetura.
Corrigidos os achados de reabertura durante save, excedente de um centavo e
legenda escura com cor diferente dos dias; os cenarios ganharam regressao.
Risco residual: itens parciais e homologacao fisica acima.

Suite completa: 501 PASS; smoke: 17 PASS; responsividade: 12 PASS.
Gate npm audit --audit-level=critical: PASS, com alerta alto preexistente em
Nodemailer. Atualizacao major nao faz parte desta entrega visual.
