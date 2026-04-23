# DEPLOY (Oracle + PM2 + SQLite)

## 1. Runtime recomendado
- Node.js LTS (20+)
- PM2
- Backend de estado: `FIN_STATE_BACKEND=sqlite`
- Execucao em instancia unica:
  - `pm2 start server.js -i 1 --name controle-financeiro`

## 2. Regra arquitetural obrigatoria (SQLite)
- SQLite com WAL suporta varios leitores, mas neste sistema o escritor deve ser unico.
- Nao rodar cluster Node.js (`-i max`) sobre o mesmo arquivo `.sqlite`.
- O guard `stateRevision` protege concorrencia de usuarios/abas, mas nao substitui disciplina de processo.
- Contrato operacional atual:
  - **usar uma unica instancia PM2** com SQLite.
- Escalabilidade horizontal futura:
  - migrar backend de estado para PostgreSQL (ou equivalente) via `server/state-store-factory.js`.
- Quando SQLite for backend definitivo no ambiente alvo:
  - planejar remocao do mirror JSON de compatibilidade.

## 3. Variaveis de ambiente recomendadas
- `NODE_ENV=production`
- `PORT=3000` (ou porta do ambiente)
- `FIN_STATE_BACKEND=sqlite`
- `FIN_STORAGE_DIR=/caminho/persistente`
- `FIN_APP_STATE_DEBUG=0`
- `FIN_MAX_BACKUPS_PER_USER=0` (nao podar backups automaticamente)
- `FIN_AUTO_EXIT_BACKUP_MIN_MS=60000`

## 4. Passo a passo de deploy
1. Atualizar codigo no servidor.
2. Instalar dependencias:
   - `npm ci --omit=dev`
3. Garantir pasta persistente para storage.
4. Exportar envs.
5. Subir com PM2 em instancia unica:
   - `pm2 start server.js -i 1 --name controle-financeiro`
6. Salvar configuracao:
   - `pm2 save`
7. Habilitar startup:
   - `pm2 startup`

## 5. Validacao pos-deploy
- Health basico:
  - `pm2 status`
  - `pm2 logs controle-financeiro --lines 200`
- Integridade de testes (quando aplicavel no servidor):
  - `npm test`
- Verificacao funcional minima:
  - login/logout
  - leitura de estado
  - salvar alteracao simples
  - criar backup manual
  - importar backup de teste
  - validar conflito real entre duas abas (409 esperado na aba stale)

## 6. Auditoria operacional rapida
- Confirmar 1 instancia:
  - `pm2 describe controle-financeiro | grep instances`
- Confirmar backend:
  - checar env `FIN_STATE_BACKEND=sqlite`
- Confirmar persistencia:
  - arquivos/dir em `FIN_STORAGE_DIR` existem e sao gravaveis
