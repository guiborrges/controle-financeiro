# Publicacao - Oracle Cloud e PM2

Atualizado em 26/10/2026. Conferido com .github/workflows/deploy.yml e
server/state-store-factory.js. Nao altera a configuracao online.

## Fluxo ativo

Push em main aciona Deploy para Oracle Cloud:

1. Checkout do codigo.
2. npm ci.
3. npm audit --audit-level=critical.
4. SCP do checkout para /home/ubuntu/controle-financeiro.
5. npm install --omit=dev no servidor.
6. pm2 restart all, com fallback node server.js conforme o script atual.

SSH usa secrets OCI_HOST e OCI_KEY; nao inserir seus valores em documentos.
Workflow usa source "." e NAO executa npm test ou test:smoke.
Nao oferece, por isso, build, deploy atomico, migracao, teste funcional completo
ou rollback automatico. pm2 restart all pode atingir outros processos PM2.

## Storage e runtime

- package.json declara Node.js >=20; conferir runtime real antes de habilitar SQLite.
- Definir NODE_ENV=production, PORT, FIN_STORAGE_DIR e FIN_SESSION_SECRET.
- FIN_STORAGE_DIR deve ser persistente e preservado entre publicacoes.
- Preservar usuarios, dados, backups e chaves de criptografia/recuperacao.
- Segredos Pluggy/Oracle/SMTP ficam fora do Git.
- Conferir FIN_STATE_BACKEND efetivo no servidor; nao presumir SQLite.

JSON e padrao; SQLite e selecionado explicitamente quando disponivel.
Nao trocar backend incidentalmente durante uma publicacao.

## Ressalva SQLite

A recomendacao antiga de SQLite como padrao foi retirada.
F03/F04 registram restore JSON que nao atualiza a copia prioritaria SQLite
e revisoes SQLite repetidas sob relogio congelado. Nao declarar restore
SQLite aprovado. Backend online nao foi certificado nesta revisao documental.

Uma eventual migracao exige backup e teste. Se SQLite for utilizado, manter
uma unica instancia escritora; nao usar cluster PM2 no mesmo arquivo.
409 nao substitui disciplina de processo. Filas/locks sao locais por processo.

## Validacao antes do push

```powershell
npm ci
npm test
npm run test:smoke
npm run check:legacy-paths
npm run audit:ci
npm run check:refactor-risks
```

Os dois ultimos podem retornar nao-zero pelas pendencias documentadas.
Nao esconder falhas nem confundir critical aprovado com audit high limpo.
Nao atualizar dependencias major sem revisao especifica.

Smoke usa contas sinteticas e intercepta escrita financeira no servidor.
MEUFIN_SMOKE_VENDOR_DIR permite bibliotecas locais.
Nao fazer restore/conflitos destrutivos em contas reais.

## Depois da publicacao

- Aguardar workflow do SHA enviado, nao apenas o push.
- Conferir /api/health, /login e assets alterados.
- Sem sessao, bootstrap/profile devem continuar protegidos.
- Conferir login/bootstrap e funcionalidade afetada em conta de teste.
- Revisar logs PM2, erros de pagina e persistencia apos reload.
- Confirmar que storage/chaves nao foram substituidos pelo checkout.

## Reversao, backups e integracoes

Reverter codigo nao restaura dados automaticamente. Mudanca de schema exige
plano de compatibilidade/restore antes da publicacao. Nunca apagar storage
para resolver um deploy.

Padroes do backup-store: 50 recentes e ate 12 ancoras mensais.
FIN_MAX_BACKUPS_PER_USER=0 nao desativa poda: usa o padrao.
FIN_MONTHLY_BACKUPS_PER_USER controla ancoras; conferir codigo ao mudar limites.

Workers, Oracle e OCI sao configurados separadamente. Ver
[docs/INDEPENDENT_PIPELINES.md](docs/INDEPENDENT_PIPELINES.md) e
[docs/refatoracao/20-etapa-6-integracoes.md](docs/refatoracao/20-etapa-6-integracoes.md).
Render/render.yaml sao alternativa historica, nao o online atual.
