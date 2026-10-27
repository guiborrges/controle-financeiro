# Contexto atual do MeuFin

Atualizado em 27/10/2026. Base anterior ao redesign: `67fa380`.
Guia detalhado: [ARCHITECTURE.md](ARCHITECTURE.md). Indice: [README.md](README.md).

## Produto e workspace

Apresentacao vigente: `public/app/product-design.css`, carregado por ultimo,
com superficies opacas, tokens claro/escuro e tipografia Inter. Dashboard tem
modo Organizar painel, preserva layouts personalizados e mostra reservas em
metas no resultado. Categorias priorizam ranking; pizza opcional. Copiar
lancamento e recolhivel; calendario Mobile mantem valores nos detalhes do dia.
Regras financeiras, dados, pesquisa e contratos de salvamento nao mudaram.

Aplicacao web multiusuario de planejamento, lancamentos, rendas, cartoes,
metas, patrimonio, historico e calendario. Desktop/MobileV2 usam mesmo estado
e contratos de dominio. Pluggy/PDF exigem revisao; ESO e restrito.

Workspace canonico: `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online`.
Fontes: server.js/server/, public/app/, public/login/, tests/.
Nao tratar snapshots de auditoria como aplicativo ativo.

## Estado implementado

- Etapas 2A a 7 documentadas em refatoracao/. Etapa 7 encerrou validacao COM
  ressalvas; nao aprovacao irrestrita de seguranca ou SQLite.
- Helpers de valores, fatos financeiros, datas, catalogos e projecao em
  public/app/modules/shared/. Comandos compartilhados em mes-atual/.
- Mobile nao depende de formulario Desktop escondido para salvar lancamentos.
  Rendas continuam separadas de outflows.
- Calendario continuo oferece ano atual/proximo e historico; meses virtuais
  intactos nao sao gravados. Series/excecoes usam finCalendarModel.
- Recorrencias respeitam competencia e excecoes; nao copiar configuracao
  antiga de cartao sobre mudanca futura do usuario.
- Catalogos respeitam visibilidade mensal. Emojis sao apresentacao e usam
  mesmo resolver no formulario Desktop/Mobile e Internet Banking.
- Dashboard reaproveita totais por render, nao cache persistente; nao renderiza
  escondido no Mobile. M10 foi desfeito por decisao do usuario: nao reintroduzir.
- AppEvents substitui wrappers de notificacao save/nav; inicializacao Mobile
  protegida. CSS Mobile dividido em seis partes mantendo a cascata.
- Servicos de app-state/backup recebem dependencias; rotas preservam HTTP,
  identidade, autenticacao/CSRF, validacao e traducao de erros.
- SQL de staging, filas limitadas e prazos externos compartilhados. Locks
  continuam locais ao processo, nao distribuidos.

## Entregas recentes

- Aviso de origem sem identificador confiavel removido por pedido do usuario.
  Nao prometer dedupe perfeito sem ID. Protecoes de identidade confiavel,
  duplicata exata e reembolso permanecem.
- Internet Banking mostra sucesso somente apos save(true) confirmar. Pendencia
  conserva revisao e retry sem duplicar aplicacao local.
- Emojis alinhados entre adicionar lancamento e Internet Banking.
- Pesquisa mensal em todos os filtros, restrita a mes/metodo/cartao/tag.
  Textos toleram pequenos erros com Fuse.js; valores/datas nao usam aproximacao.

## Persistencia e protecoes

App-state pertence ao usuario autenticado. JSON particionado e padrao; SQLite
e opcional via FIN_STATE_BACKEND, com leitura prioritaria e mirror JSON.
Nao presumir backend online nem recomendar SQLite sem corrigir F03/F04.

409 protege revisao/perda de meses. Mudanca local e mobileDataChanged nao
confirmam gravacao remota. Restore JSON publica revisao nova.
Padroes: 50 backups recentes e ate 12 ancoras mensais.

/app exige sessao; /app-assets distribui codigo sem exigir sessao. Nunca
incluir dados pessoais/seeds financeiros em assets, testes ou documentos.
Nao versionar credenciais. Storage de producao deve ser persistente.

## Validacao e pendencias

Referencia: 481 testes Node e 15 cenarios de navegador aprovados, sem erros de
pagina, usando fixtures sinteticas. Oracle/SMTP/bancos reais nao certificados.

Pendencias: F03/F04 SQLite, alerta alto de dependencia registrado na etapa 7,
diferencas de datas da 3D, F06/texto de metas e revisao de configuracao/seguranca.
Ver relatorio 21 antes de afirmar que tudo esta aprovado.

## Manutencao e entrega

Correcoes da auditoria responsiva: widgets adaptam-se ao conteiner sem alterar
layout salvo; Mobile pode carregar depois da primeira entrada no breakpoint;
graficos possuem tabela equivalente, tema e Canvas com DPR. Recuperacao de
draft antigo so rebaseia preferencias visuais, nunca dados financeiros
divergentes. Remember nao cria sessao em autosave de pagina antiga.
Ver `auditoria-responsividade/15-correcao-e-validacao.md` e o novo comando
`npm run test:responsive`. Aparelhos fisicos continuam fora da homologacao.

1. Ler guia e modulo dono da regra; reutilizar contratos.
2. Preservar dados, historico, isolamento e conflitos 409.
3. Testar dominio afetado e executar npm test/test:smoke.
4. Publicar em main apos concluir e conferir testes, conforme pedido permanente
   do usuario. Aguardar workflow e conferir disponibilidade online.
5. Atualizar guias atuais sem reescrever evidencias historicas.

Deploy: GitHub Actions -> Oracle Cloud -> PM2. Workflow executa audit critical,
nao a suite funcional; deploy verde nao significa audit high aprovado.
Procedimento: [../DEPLOY.md](../DEPLOY.md).
