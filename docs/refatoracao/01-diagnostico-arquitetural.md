# Diagnostico arquitetural do MeuFin

Data: 23/10/2026. Base: `a3011eac172bf9c538cd0199e442036a10e8bdca`.
Situacao: auditoria inicial entregue; refatoracao nao iniciada; nenhum deploy.

## Resumo em linguagem simples

O MeuFin nao precisa ser refeito em outro framework. Ja existem bons modulos
compartilhados, protecoes de salvamento, isolamento entre usuarios e testes.
O principal problema e que partes novas e antigas continuam convivendo dentro
de arquivos grandes. Consultar um numero pode normalizar dados, repetir calculos
e depender de funcoes de outras telas.

Ha tambem problemas que NAO sao apenas organizacao: dados historicos embutidos
em arquivo publico, risco de falha no salvamento por partes e diferencas do
backend SQLite opcional. Eles estao separados como correcoes funcionais ou de
seguranca, sem alteracoes silenciosas nesta auditoria.

## Escopo e metodo

- Inventario dos 251 arquivos versionados, incluindo 207 arquivos JS/CSS/HTML
  e 58 arquivos de teste. Dependencias instaladas nao contam como codigo proprio.
- Leitura dirigida dos pontos de entrada, dominios, persistencia, integracoes,
  configuracao de deploy e testes; busca estatica nos fontes versionados.
- Inspecao das referencias por HTML, globais, wrappers e carregamento dinamico.
- Grafo aproximado de `require` relativo: 80 arestas, sem ciclo detectado.
  Isso NAO prova ausencia de ciclos logicos entre globais do navegador.
- Execucao dos testes e cobertura V8; duas simulacoes de falha com dados ficticios.
- Navegacao e medicoes em Chrome isolado com copia local somente leitura.
- Uma leitura HTTP publica, sem cookie, para confirmar exposicao de asset.

Nao foram lidos segredos, conectados bancos, enviados PDFs a IA, executados
workers externos, modificados dados reais ou realizadas migracoes. A auditoria
arquitetural nao equivale a uma prova formal de cada funcao ou pentest completo.

## Os 20 principais problemas

P0 = tratar primeiro; P1 = proteger antes de extrair dominios; P2 = melhoria
incremental; P3 = organizacao posterior. Complexidade e risco: B baixo, M medio,
A alto. Gravidade considera o efeito potencial, nao frequencia comprovada.

| ID | Problema e evidencia | Gravidade | Impacto | Complex. | Regressao | Beneficio | Prioridade |
|---|---|---|---|---|---|---|---|
| A01 | Historico/ESO embutidos em asset sem login: `public/app/data.js:529`, `server.js:419` | Critica | Privacidade | M | A | Separar dados privados do programa publico | P0 |
| A02 | Gravar meses apaga o conjunto anterior antes de publicar o novo: `server/app-state-store.js:300` | Alta | Integridade apos falha de disco | A | A | Ultimo salvamento valido sobrevive a interrupcao | P0 |
| A03 | SQLite e JSON podem divergir; restore trabalha no JSON: `server/state-store-factory.js:13`, `server/backup-store.js:585` | Alta, condicional | Restauracao e leitura inconsistentes se SQLite ativo | A | A | Um contrato de persistencia/restauracao | P1 |
| A04 | Revisao SQLite usa somente relogio, sem incremento monotono: `server/sqlite-app-state-store.js:70` | Alta, condicional | Conflitos podem nao ser identificados | M | A | Mesma protecao dos arquivos JSON | P1 |
| A05 | Deploy nao executa testes; copia `.` e reinicia todos os processos: `.github/workflows/deploy.yml:10` | Alta | Regressao e alcance operacional | M | M | Entrega limitada e verificavel | P1 |
| A06 | Dependencia Nodemailer com alerta alto; gates local/CI diferentes: `package.json:13`, deploy linha 19 | Alta | Seguranca de dependencia | M | M | Dependencias e politica consistentes | P1 |
| A07 | OCR executado sincronicamente dentro do servidor HTTP: `server/http/routes/bill-import-ai.js:354` | Alta | Disponibilidade de outros usuarios | A | A | Trabalho pesado fora do atendimento HTTP | P1 |
| A08 | Controlador mensal mistura regras, DOM, migracoes e persistencia em 6.297 linhas: `public/app/mes-atual.js` | Alta | Manutencao e regressao financeira | A | A | Limites de dominio verificaveis | P1 |
| A09 | Leitura de totais normaliza e pode alterar o mes: `public/app/core.js:859`, `mes-atual.js:1386` | Alta | Consultas com efeitos colaterais e recusto | A | A | Consulta pura sobre estado preparado | P1 |
| A10 | Categorias tem entrada comum, mas catalogo, simbolos e normalizacao ficam dispersos: `core.js:123`, `state.js:239`, `import-bills-utils.js:97` | Media | Consistencia e custo | M | A | Um servico de categorias mensais | P1 |
| A11 | Estado guarda/projeta colecoes novas e legadas: `mes-atual.js:1333` | Alta | Atualizacao parcial e compatibilidade | A | A | Adaptador explicito, sem gravadores concorrentes | P1 |
| A12 | Regra de fatura efetiva repetida: `shared/financial-query.js:13`, `mes-atual/cards.js:26` | Media | Divergencia futura em valor manual/previsto | B | M | Uma implementacao caracterizada | P2 |
| A13 | Adaptadores de ocorrencias e datas separados no servidor e navegador: `server/calendar-projection.js:9`, `continuous-calendar-app.js:52` | Alta, risco | Virada de mes, parcelas e pagamento | A | A | Contrato compartilhado de projecao | P1 |
| A14 | Formularios/validacoes e mutacoes ainda dependem do DOM desktop: `mobile-v2/outflow-form-mobile.js`, `mes-atual.js:3907` | Media | Edicao divergente e dificil de testar | A | A | Comandos de dominio usados pelas duas telas | P2 |
| A15 | Dashboard recalcula totais muitas vezes e renderiza mesmo oculto: `dashboard.js:288`, `backup.js:232` | Media | Responsividade | M | M | Um resumo por mes/renderizacao | P2 |
| A16 | Mobile intercepta globais/fetch e possui tratamento silencioso em wrappers: `mobile-v2-enhancements.js:91`, `:193` | Media | Eventos e diagnostico de falhas | M | M | Eventos explicitos e erros observaveis | P2 |
| A17 | Dirty keys nao evitam envio/copia do estado inteiro: `storage.js:341`, `state.js:996` | Media | Rede, CPU e memoria | A | A | Reduzir trabalho sem perder controle de revisao | P2 |
| A18 | Workers/webhook repetem DDL/MERGE; chamadas sem prazo explicito e trava so local: `workers/lib/pluggy-client.js:12`, `worker_oracle_ai.js:70` | Alta, risco | Robustez e isolamento operacional | A | A | Repositorio/contrato de jobs compartilhado | P1 |
| A19 | Frontend depende de ordem global e grande superficie HTML/CSS: `index.html:1746`, `styles.css`, `mobile-v2.css` | Media | Mudanca local afeta outra tela | A | M | Contratos explicitos e CSS por responsabilidade | P2 |
| A20 | Testes sem gate no deploy, cobertura parcial e carga com contrato antigo: `scripts/load-test.js:144`, `tests/` | Alta | Falsa confianca e regressao nao detectada | M | M | Caracterizacao e testes de integracao reais | P1 |

Os numeros de linha sao da base auditada. Para detalhes e distincoes entre
duplicacao e compatibilidade, consultar os documentos 03 e 04.

## O que deve permanecer

- Framework atual: Express e JavaScript modular progressivamente.
- Motor `FinancialQuery`, valores em centavos e bases distintas de consulta.
- Calendario continuo com regras e excecoes, sem meses infinitos persistidos.
- Protecao 409, revisoes, dados pendentes e isolamento por usuario.
- Mobile como apresentacao propria, sem copiar regras financeiras.
- Formatos de backup antigos e contratos de importacao/deduplicacao.
- Reversao da M10: nao reintroduzir detalhamento removido.

## Limites de conclusao

Nao foi confirmado qual backend esta ativo em producao, nem a configuracao do
proxy, wallet Oracle, SMTP ou quantidade de workers. Riscos condicionais estao
marcados como tais. Nao foi comprovada perda de dados reais. O acesso publico
ao historico embutido foi confirmado, mas nao foi investigado quem o acessou.
