# MeuFin mobile: entrega final da implementacao

Data: 28/10/2026. Continua as entregas de 27/10. O escopo de software da lista
de 36 itens esta implementado. A homologacao em aparelho fisico continua
NAO EXECUTADA; testes emulados nao certificam WCAG, Safari/iPhone ou teclado
virtual. Nao houve acesso a bancos ou contas pessoais para a verificacao.

## O que faltava e foi entregue

- Filtros de pesquisa, tag e tipo guardados individualmente por competencia.
  A troca de metodo/cartao restringe o resultado; limpar nao muda competencia.
  O contador explicita mes, visao e tag. O sheet de filtros atua no Mobile,
  sem alterar por engano o filtro Desktop escondido.
- Renda mostra esperado, recebido e a receber. Reembolsos separam recebido
  de pendente por pessoa e no resumo geral; nenhuma receita nova e criada.
- Contas patrimoniais viraram linhas, sem card dentro de card. Textos longos
  e valores extremos foram exercitados em 320, 390 e 480 CSS px.
- Formularios agrupam dados essenciais e classificacao/opcoes. Cabecalho e
  acoes permanecem acessiveis por rolagem, inclusive em 640x360.
- Metas e valor da fatura so fecham apos confirmacao. Pending conserva o
  valor aplicado localmente e bloqueia edicao; retry usa flushServerStorage,
  sem reaplicar o comando. Um valor negativo e recusado antes da aplicacao.
  Fechar durante a operacao fica bloqueado; resultado tardio nao fecha outro
  editor que tenha substituido o anterior programaticamente.
- Busca universal e seletor de data entram no contrato de foco/Escape/retorno.
  Notificacoes tem fechar, estado expandido, retorno ao sino e preservacao de
  foco quando seu conteudo e atualizado. Identificadores usam atributos
  escapados e listeners, nao JavaScript inline construido com dados.
- Ajuda inicial pode ser dispensada e reaberta sem um timer antigo fecha-la.
  Perfil anuncia falhas e conserva o rascunho. Toasts tratam textos literalmente
  e executam uma acao no maximo uma vez.
- Banking informa quantos itens do lote foram confirmados e conserva os
  demais. Falhas de descarte sao recuperaveis; ignorar nao anuncia lancamento
  financeiro salvo. Nenhum aviso descartado de origem sem ID foi reintroduzido.
- Estilos especificos mobile sairam da folha compartilhada. Componentes usam
  captions legiveis e tracking nao negativo; o acabamento usa tokens comuns.
  Graficos respeitam reduced-motion tambem no JavaScript. A imagem exportada
  usa Inter e as cores semanticas do tema, com valores completos.
- O mes vazio apresenta um estado contextual, sem empilhar vazios de cartao.

## Calculos de apresentacao

Os calculos de dominio e o schema nao mudaram. Todas as quantias abaixo sao
apresentacao sobre os registros existentes, com soma arredondada em centavos:

- Renda esperada: total canonico MobileV2Data.getMonthMetrics(month).renda.
- Recebida: soma de valor das rendas/projetos com paid=true e includeInTotals
  diferente de false. A receber: esperada menos recebida.
- Reembolsos: linhas de getMonthReimbursementGroups, que exclui o titular.
  Soma de linhas paid=false indica pendencias; paid=true indica recebido.
  Esses valores nao entram novamente como receita nem como gasto bruto.
- Meta/cartao: comandos existentes e save confirmado; retry somente sincroniza
  o estado ja aplicado. Nao cria nova meta, parcela, compra ou fatura.

## Matriz dos 36 itens

PASS refere-se ao software e aos testes descritos, nao a homologacao fisica.
Os itens entregues nas rodadas anteriores foram mantidos e revalidados.

| ID | Resultado | Evidencia principal |
|---|---|---|
| 001 | PASS | Titulo e acoes sem intersecao a 320 px |
| 002 | PASS | Valores extremos integrais nas metricas |
| 003 | PASS | Sheets, busca universal, data aninhada, foco/Escape/retorno |
| 004 | PASS | Barras com geometria real |
| 005 | PASS | Nome/valor de renda legiveis e caixa alta preservada |
| 006 | PASS | Lista primeiro e distribuicao opcional |
| 007 | PASS | Texto ativo escuro com contraste medido >=4,5 |
| 008 | PASS | Cabecalhos e menu secundario comuns |
| 009 | PASS | Cinco destinos e selecao acessivel |
| 010 | PASS | Donos dos estilos, sem injecao e sem skin mobile no CSS compartilhado |
| 011 | PASS | Ranking expandivel sem remover totais |
| 012 | PASS | Periodo de referencia explicito |
| 013 | PASS | Resultado destacado e reserva preservada |
| 014 | PASS | Duas trilhas; filtros independentes por competencia |
| 015 | PASS | Menu linear de adicionar e fechamento |
| 016 | PASS | Nomes longos/valores extremos nas listas mensais |
| 017 | PASS | Inventario de controles nas cinco telas; alvos de conforto |
| 018 | PASS | Limite/restante/excedente, incluindo um centavo |
| 019 | PASS | Vencimento canonico e metadados de parcela/recorrencia |
| 020 | PASS | Esperado, recebido e pendente sem alterar total canonico |
| 021 | PASS | Reembolsos por pessoa e status, sem dupla receita |
| 022 | PASS | Contas sem card aninhado e menu secundario |
| 023 | PASS | Historico anual completo |
| 024 | PASS | Tokens, captions legiveis e tracking nao negativo |
| 025 | PASS | Mes/metodo/tag, contador e limpar filtros |
| 026 | PASS | Agrupamentos, baixa altura, rascunho e save/pending/retry |
| 027 | PASS | Calendario compacto, legenda, selecao e detalhes |
| 028 | PASS | Conexao, carregamento, lote parcial, descarte e retry sinteticos |
| 029 | PASS | Icones adequados e switch semantico |
| 030 | PASS | Identidade mobile no login, autenticacao preservada |
| 031 | PASS | Estados de ausencia de dados sem graficos ficticios |
| 032 | PASS | Estados anunciaveis, falhas recuperaveis e sucesso confirmado |
| 033 | PASS | Ajuda inicial, perfil e notificacoes exercitados |
| 034 | PARCIAL | Baixa altura emulada PASS; aparelho/teclado fisico NAO EXECUTADO |
| 035 | PASS | Paleta/fonte comuns, exportacao e valores exatos |
| 036 | PASS | Reduced-motion JS/CSS, reabertura e acao unica |

No calendario, os sete dias precisam caber a 320 px: celulas podem ter largura
menor que 44 px, mantendo altura de 44 px e alvo acima de 24 px. As barras
interativas usam 44 px e rolagem horizontal, sem reduzir fonte ou esconder valor.

## Validacao e limites

- npm test: 503 PASS, incluindo regressao de tokens e ordem de imports. O hash imutavel do
  CSS anterior foi substituido por contratos de cascata/escopo e testes visuais;
  um redesign aprovado deve poder mudar cores e tamanhos sem atualizar hashes
  cegamente. As protecoes financeiras e de isolamento continuam preservadas.
- npm run test:smoke: 17 PASS; npm run test:responsive: 12 PASS.
- npm run test:mobile-design: 29 cenarios por motor.
- npm run test:mobile-completion: 23 cenarios por motor, com estado sintetico.
- Chromium, Firefox e WebKit emulados; matriz visual com 146 capturas e uma
  rodada adicional das telas alteradas. Capturas sao evidencia, nao certificacao.
- npm run docs:build e docs:verify: manual reconstruivel atualizado.

A revisao independente encontrou foco perdido ao atualizar notificacoes e
risco de um save antigo fechar outro sheet; ambos receberam protecao. O campo
monetario fica intencionalmente bloqueado quando o estado ja foi aplicado e
aguarda sincronizacao, preservando o contrato de retry sem reaplicacao.

Somente validacao fisica e integracao bancaria real permanecem fora desta
homologacao. Registro/instalacao PWA continua desabilitado pela decisao anterior;
nenhuma funcionalidade PWA nova e prometida nesta entrega.

Gate de publicacao npm audit --audit-level=critical: PASS. Permanece alerta
alto preexistente em Nodemailer; nao foi feita atualizacao major nesta entrega.
