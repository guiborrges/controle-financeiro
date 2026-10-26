# Checklist de entrega do MeuFin

Atualizado em 26/10/2026. Oracle Cloud + PM2.
Procedimento: [DEPLOY.md](DEPLOY.md).

## Antes do push

- [ ] Conferir workspace, branch e diff; nao incluir dados reais/secrets.
- [ ] Ler docs/ARCHITECTURE.md e atualizar guias dos contratos alterados.
- [ ] Executar testes focados, npm test e npm run test:smoke.
- [ ] Executar check:legacy-paths e git diff --check.
- [ ] Conferir audit:ci e check:refactor-risks; registrar pendencias.
- [ ] Conferir compatibilidade de estado/backup e escopo mensal.
- [ ] Nao mudar backend, major de dependencia ou variaveis reais incidentalmente.

## Hospedagem

- [ ] Confirmar storage persistente e chaves fora do checkout publicado.
- [ ] Confirmar FIN_SESSION_SECRET e configuracoes de producao.
- [ ] Identificar FIN_STATE_BACKEND efetivo.
- [ ] Se SQLite, considerar F03/F04 e unica instancia escritora.
- [ ] Conferir impacto de pm2 restart all e workers ativos.

## Apos publicar

- [ ] Aguardar workflow do SHA enviado.
- [ ] Conferir health, login e versao dos assets.
- [ ] Conferir protecao de bootstrap/profile sem sessao.
- [ ] Validar login/logout e persistencia apos reload em conta sintetica.
- [ ] Conferir funcionalidade afetada no Desktop/Mobile.
- [ ] Conferir isolamento entre contas de teste.
- [ ] Navegar calendario futuro sem criar meses manualmente.
- [ ] Busca mensal: conferir mes/metodo/tag e textos/valores/datas.
- [ ] Importacao: conferir sucesso somente apos confirmacao do salvamento.
- [ ] Revisar logs/erros de pagina sem restore destrutivo em conta real.

Deploy verde nao equivale a audit high aprovado. Relatorios de refatoracao
registram ressalvas SQLite, dependencias e politicas de datas.
