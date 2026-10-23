# Etapa 2A - Protecao por caracterizacao

Executada apos autorizacao especifica do usuario. Codigo funcional de referencia:
`a3011eac172bf9c538cd0199e442036a10e8bdca`. Nenhuma refatoracao ou correcao
funcional foi incorporada. Etapa 2B e fase 3 nao iniciadas. Nenhum deploy.

## O que estes testes protegem

Caracterizacao registra o comportamento do codigo atual com valores e formatos
conhecidos. Quando houver uma inconsistencia, ela e identificada como tal, nao
transformada em regra desejada. A futura correcao deve ter sua propria aprovacao
e atualizar explicitamente o contrato afetado, sem esconder o motivo.

As fixtures sao construidas em `tests/helpers/refactor-fixtures.js`; nao leem
backup, Downloads, pasta de usuarios, credenciais ou snapshot de conta pessoal.
IDs e descricoes de pessoas/contas sao ficticios.

## Matriz financeira independente

Fixture de renda 3.000, extras 250, despesa fixa 1.200, gasto no debito 45,67,
compartilhada com cota propria 40, compras no cartao 230, fatura manual 250,
reserva financeira 100 e limite de consumo 500. Tambem inclui registros excluidos,
transferencia e estorno para provar que nao entram como despesas comuns.

| Base | Entradas | Saidas | Reservas | Resultado | Saidas pendentes |
|---|---:|---:|---:|---:|---:|
| Compromissos | 3.250,00 | 1.535,67 | 100,00 | 1.614,33 | 290,00 |
| Consumo | 3.250,00 | 1.515,67 | 100,00 | 1.634,33 | 270,00 |
| Caixa | 3.000,00 | 1.245,67 | 0,00 | 1.754,33 | 0,00 |

Os valores esperados sao constantes calculadas independentemente, nao copias
do resultado da propria implementacao. Asserts comparam centavos, linhas,
categorias e JSON antes/depois. A fatura substitui as compras na base de
compromissos; em consumo entram compras, nao fatura.

## Cobertura acrescentada: 36 testes

- 21 financeiros: tres bases, nove precedencias de fatura, caso invalido,
  cinco formas de cota compartilhada, flags/aliases, core-Mobile-widget e contas.
- 8 de adaptadores: fevereiro comum/bissexto, dia 31, virada de ano, offsets de
  fechamento/vencimento, reset de pagamento/participantes e clone de renda.
- 3 de categorias: padroes, mes anterior positivo, atuais zero, aliases,
  ordem, visibilidade, consulta historica, Unicode e campos publicos.
- 1 de isolamento do harness: tenant separado, token de acesso e quatro metodos
  de escrita rejeitados; sem acesso a fontes fora de public/app e public/shared.
- 3 de persistencia: JSON simples, JSON criptografado e SQLite criptografado.
  Uma instancia escreve duas contas e outro processo rele a mesma fixture,
  preservando todos os campos, marcadores, totais e separacao de usuarios.

Temporarios sinteticos de persistencia sao removidos apos verificar que o caminho
resolvido pertence ao diretorio temporario criado pelo proprio teste.

Os testes existentes continuam protegendo escopos de recorrencia, paradas,
excecoes pagas, ultima parcela, conflitos, importacao e checkpoints patrimoniais.
Eles nao foram modificados nem substituidos por mocks mais permissivos.

## Diferencas atuais explicitadas

1. Fatura invalida: helper de cartoes retorna zero para texto nao numerico;
   `FinancialQuery.billAmount` retorna NaN, depois `cents` converte esse NaN
   falsy para zero. Infinity gera erro. O teste nomeia essa diferenca, nao afirma
   que tal entrada e valida. Unificar helpers exigira decidir o contrato de erro.
2. Clone de saida: adaptador browser remove `patrimonioMovementId` durante
   normalizacao; servidor devolve string vazia. Ambos eliminam o vinculo antigo,
   mas o formato e diferente. Os testes verificam ambos explicitamente.
3. Simbolo de categoria: na fixture com preset e override, o catalogo atual
   prioriza o simbolo do preset. Foi registrado sem mudar a precedencia;
   confirmar a regra desejada antes de alterar o servico de simbolos.

Os testes de ocorrencia usam o callback real do adaptador browser com objetos
de mes explicitos e a projecao do servidor. Eles nao provam igualdade de todos
os caminhos de hidratacao completa: normalizacao, selecao e mutacoes ainda
dependem dos testes existentes e da caracterizacao futura do modulo extraido.

## Smoke real no navegador: 8 cenarios

1. Dashboard Desktop com tres indicadores do perfil generico e totais esperados;
   apenas quatro meses ficticios carregados, sem painel M10.
2. Troca real de ano, mes e base de categorias pelos selects.
3. Navegacao mensal/Historico, filtro preservado e dataset do grafico.
4. Formulario Desktop aberto e preenchido; cancelar nao altera registros.
5. Mobile com mesmos totais, Historico, grafico e sem overflow horizontal global.
6. Editor Mobile iniciado pela API real do componente, campos preenchidos e
   Cancelar acionado no DOM; registros financeiros permanecem iguais.
7. Segunda conta ficticia com valores distintos; reload da primeira nao mistura
   identidades nem totais.
8. Perfil principal ficticio com cinco indicadores, sem carregar meses pessoais
   embutidos; M10 permanece ausente.

O harness serve os fontes atuais em HTTP 127.0.0.1, porta temporaria, com token
aleatorio. O bootstrap e ficticio, save/flush/migracao automatica ficam desativados
APENAS pela injecao de teste; as regras e telas reais nao sao substituidas.
Todos os metodos de escrita sao rejeitados pelo servidor antes de processar corpo.
Chamadas externas do browser sao bloqueadas. Nenhum banco, SMTP ou IA e iniciado.

O app tentou criar backups de migracao/saida; o harness registrou e rejeitou
esses POSTs. Execucao validada: 6 tentativas bloqueadas, zero gravacoes aceitas,
fixtures do servidor intactas, zero erros JavaScript. Esse numero de tentativas
nao e um contrato financeiro nem motivo para desativar backups no produto.

A data do navegador foi fixada em 23/10/2026. Como o relogio fixo interfere nas
animacoes de Chart.js, os graficos Desktop sao finalizados no harness com
`stop()` / `update('none')` antes da inspecao. Capturas sinteticas Desktop/Mobile
foram inspecionadas; nao houve alteracao de CSS ou layout nesta etapa.

## Como repetir

Na raiz do projeto:

```powershell
npm test
node --test tests/refactor-financial-characterization.test.js tests/refactor-projection-characterization.test.js tests/refactor-category-characterization.test.js tests/refactor-state-roundtrip.test.js tests/refactor-browser-isolation.test.js
node scripts/test-refactor-smoke.js
```

O smoke usa Playwright ja declarado no projeto. No Windows procura Google Chrome
no caminho padrao; `MEUFIN_TEST_CHROME` permite indicar outro executavel. Em outros
sistemas usa o Chromium do Playwright, que precisa estar instalado previamente.
Nao instala browsers/dependencias automaticamente.

Sem configuracao adicional, o harness baixa apenas as duas bibliotecas publicas
nas mesmas versoes do HTML (Chart.js 4.4.1 e Fuse.js 7.0.0), nunca dados de conta.
Para rodar sem rede, fornecer copias dessas mesmas versoes:

```powershell
$env:MEUFIN_SMOKE_VENDOR_DIR = 'C:\caminho\bibliotecas-de-teste'
# Arquivos: chart.umd.js e fuse.min.js; preservar bytes/SRI do Chart.js.
$env:MEUFIN_SMOKE_OUTPUT_DIR = 'C:\caminho\capturas-sinteticas'
node scripts/test-refactor-smoke.js
```

As duas variaveis sao opcionais. Nada e gravado nas pastas public/app, server,
data ou auth. Capturas so sao geradas quando um diretorio de saida e informado.
Na execucao desta etapa foram reutilizadas bibliotecas locais e as capturas
ficaram em `tmp/refactor-2a-smoke/`, fora do produto e do versionamento.

## Resultado final e limites

Suite Node com cobertura: 352 passaram, zero falhas/skips/cancelamentos,
aproximadamente 11 segundos. Smoke browser: 8 passaram.

| Modulo | Baseline linhas / branches | Apos 2A linhas / branches |
|---|---:|---:|
| FinancialQuery | 89,09% / 87,25% | 89,09% / 87,85% |
| App-state JSON | 61,45% / 60,00% | 61,65% / 62,11% |
| SQLite | 83,33% / 35,71% | 83,33% / 37,93% |
| Widget snapshot | 85,12% / 60,61% | 85,12% / 62,50% |

O ganho principal e ter expectativas financeiras fixas, fixtures reutilizaveis,
roundtrip entre processos e exercicio de DOM real. Nao inflar a avaliacao pelo
numero de testes ou agregado V8, que inclui testes e nao representa o produto todo.

NAO valida persistencia HTTP real pelo navegador (o harness e readonly), login
real, todas as telas, integracoes Oracle/Pluggy/OCR/SMTP, celular fisico ou todas
as combinacoes de datas/participantes. Os achados F01-F06 permanecem abertos.
Nenhum teste considera essas falhas corrigidas. Correcao de falha de disco,
restore SQLite e exposicao de historico pertencem a etapa 2B, nao a este lote.

Nao houve mudanca de esquema, API, regra financeira ou dependencias. Nenhum
commit, push ou deploy. O servidor e os navegadores de teste sao encerrados no
`finally`, inclusive quando um cenario falha. A fase 3 depende de nova aprovacao.

## Autorizacao posterior de publicacao

Depois de receber o resultado desta etapa, o usuario autorizou subir os testes
e documentos. As referencias acima a ausencia de commit/push/deploy descrevem
o encerramento da validacao local, anterior a essa autorizacao. O escopo da
entrega continua sem alteracoes funcionais; 2B e fase 3 permanecem pendentes.
