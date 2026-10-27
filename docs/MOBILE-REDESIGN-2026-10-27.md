# MeuFin Mobile - entrega visual de 27/10/2026

Implementacao aprovada apos a auditoria local de design. Nao altera formulas,
competencia, schema, storage, importacao bancaria ou formato de backup.

## Mudancas entregues

| IDs da auditoria | Entrega |
|---|---|
| 001, 008 | Cabecalhos sem colisao em 320 px, acoes secundarias em menu acessivel |
| 002, 013 | Metricas adaptaveis; resultado destacado, valores completos e reserva preservada |
| 003 | Pilha de sheets e confirmacoes com foco contido, Esc, retorno, fundo inerte e z-index restaurado |
| 004, 011 | Barras reais; cinco categorias iniciais e expansao para todas; total/tabela integrais |
| 005, 016, 020 | Renda em duas linhas, nome identificavel, valor e acoes sem competir; recebido/pendente preservados |
| 006, 018 | Lista de metas antes da distribuicao opcional; nomes de categoria sem legenda truncada, excedente textual |
| 007, 009 | Contraste escuro corrigido; rotulos maiores, estado acessivel; Painel/Agenda como rotulos compactos |
| 010, 024 | Tokens e acabamento mobile isolados, controles/rotulos consistentes; sem remocao em lote de CSS legado |
| 012 | Intervalo inicial/final explicito, sem alterar selecao de 1/3/6/12/custom |
| 014, 025 | Trilhas separadas para visao e meios/cartoes; busca reutiliza filtro canonico do mes/visao |
| 015 | Menu linear de adicionar, tres caminhos existentes e sem blur forte |
| 017, 026 | Alvos maiores, campos uniformes, rodape estavel, scroll nao fecha editor; protecao ao sair por Esc/fundo/Voltar |
| 019, 021 | Estilo de linhas/grupos aplicado aos dados existentes de cartoes/reembolsos, sem recalcular faturas ou alterar estados |
| 022 | Patrimonio com menos aninhamento visual e editar/excluir em menu secundario |
| 023 | Historico por ano, preservando os 36 meses da fixture e todos os registros do usuario |
| 027 | Calendario com resumo visual mais leve, detalhe e selecao diaria preservados |
| 028 | Shell banking alinhado a tokens; conexao/importacao e destino financeiro inalterados |
| 029 | Icones de seguranca/tema/backup/importacao corretos e switch com estado acessivel |
| 030 | Login mobile opaco e Inter; autenticacao/cadastro/reset inalterados |
| 031 | Dashboard zerado explica ausencia de movimentos, sem escala arbitraria como unica apresentacao |
| 032 | Erros espelhados dentro do dialogo ativo e toasts sem OK decorativo em mensagens de falha |
| 033 | Contrato de foco dos paineis e onboarding compartilhado; notificacoes existentes mantidas |
| 034 | Ajustes de altura/paisagem e unidades dinamicas; homologacao fisica permanece pendente |
| 035 | Linha com Inter e cores semanticas por tema; tabelas acessiveis preservadas |
| 036 | Reduced-motion abrangente e gesto restrito a alca; sem animacao de confirmacao antecipada |

## Evidencias locais

Baseline: `docs/auditoria-design-mobile/evidencias/` e cinco referencias em
`docs/auditoria-design-mobile/referencias/`. Resultado visual:
`output/mobile-redesign-final-2026-10-27/` (capturas e manifestos locais, nao
embutidos no aplicativo nem no backup financeiro). A matriz principal cobre
oito tamanhos entre 320x568 e 480x960, claro/escuro. Capturas de pagina longa
mostram elementos fixos no ponto do primeiro viewport; para composicao inicial,
usar os arquivos `detail-normal-*.png`.

## Verificacoes

- `npm run test:mobile-design`: 19 cenarios novos em Chromium, Firefox e WebKit,
  incluindo recorrente mobile
  com cancelar escopo e salvar apenas o mes, teclado, foco, rascunho, erro,
  pesquisa aproximada textual e restrita ao metodo, patrimonio e estado vazio.
  A busca compacta os indices da lista virtual e restaura todos os itens ao
  limpar, sem exigir rolagem ate a posicao antiga do resultado.
- `npm run test:smoke`: 17 cenarios existentes, incluindo isolamento, totais,
  recorrencia/parcela e salvamento confirmado/pending/retry.
- `npm run test:responsive`: 12 cenarios existentes, incluindo Desktop e Mobile.
- `npm test`: 501 testes da suite completa, sem falhas na rodada de entrega.
- Nos tres motores, feedback tatil nao pode roubar foco do acionador. WebKit
  emulado nao representa homologacao fisica Safari/iOS.
- `npm run docs:build` e `npm run docs:verify`: manual reconstruivel atualizado
  com os novos fontes e teste, sem dados de usuarios.

Os scripts utilizam dados ficticios e armazenamento isolado. Integracoes reais
permanecem bloqueadas nas fixtures. Tentativas automaticas de backup recusadas
pelo servidor de fixture nao representam gravacao financeira efetivada.

## Revisao e limites

A revisao identificou bloqueio potencial do modal de escopo recorrente, avisos
inertes e Voltar sem guarda de rascunho. Foram corrigidos e cobertos pelos novos
testes, inclusive pelo fluxo de edicao/salvamento real sobre estado sintetico.
A segunda perspectiva arquitetural externa ficou indisponivel; a revisao final
de integracao foi feita localmente, sem declarar uma segunda aprovacao externa.

Pendencias de homologacao, nao certificadas por emulacao: aparelhos fisicos,
teclado virtual, leitor de tela real, safe areas com notch, instalacao PWA,
banking conectado e todas as combinacoes de notificacoes/erros de rede. O
registro PWA mobile segue desabilitado por decisao anterior do projeto.

`npm audit --audit-level=critical` passa, mas existe alerta alto preexistente
em Nodemailer. Nao houve atualizacao major de dependencia nesta entrega visual.

Nao foi adicionada biblioteca, framework, banco ou acesso a conta pessoal.
