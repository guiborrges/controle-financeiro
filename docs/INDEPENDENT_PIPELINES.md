# Pipelines Independentes: Pluggy e Oracle AI

Este projeto agora suporta duas trilhas separadas, sem conciliação entre si:

- `Pluggy` -> grava em `transacoes_pluggy`
- `Oracle AI (PDF)` -> grava em `documentos_oracle_ai`

## 1) Criar tabelas no Oracle

Execute:

```sql
@scripts/sql/create_independent_pipelines.sql
```

Ou rode o conteúdo do arquivo manualmente no schema Oracle alvo.

## 2) Variáveis de ambiente

### Banco Oracle (obrigatório para ambos workers)

```env
ORACLE_DB_USER=...
ORACLE_DB_PASSWORD=...
ORACLE_DB_CONNECT_STRING=host:1521/service_name
```

### Pluggy worker

```env
PLUGGY_BASE_URL=https://api.pluggy.ai
PLUGGY_API_KEY=
PLUGGY_CLIENT_ID=
PLUGGY_CLIENT_SECRET=
PLUGGY_TENANT_USER_ID=guilherme
PLUGGY_SYNC_INTERVAL_MINUTES=10
PLUGGY_SYNC_DAYS_BACK=45
PLUGGY_ITEM_IDS=
```

Use `PLUGGY_API_KEY` **ou** `PLUGGY_CLIENT_ID/PLUGGY_CLIENT_SECRET`.

### Oracle AI worker (PDF)

```env
ORACLE_AI_OCI_BIN=oci
ORACLE_AI_REGION=sa-saopaulo-1
ORACLE_AI_TENANT_USER_ID=guilherme
ORACLE_AI_WATCH_DIR=/home/ubuntu/controle-financeiro/inbox-pdfs
ORACLE_AI_PROCESSED_DIR=/home/ubuntu/controle-financeiro/inbox-pdfs/processed
ORACLE_AI_FAILED_DIR=/home/ubuntu/controle-financeiro/inbox-pdfs/failed
ORACLE_AI_WATCH_INTERVAL_SECONDS=20
```

## 3) Subir processos no PM2

```bash
pm2 start workers/worker_pluggy.js --name "sync-pluggy"
pm2 start workers/worker_oracle_ai.js --name "process-pdf-ai"
pm2 save
```

Ou com ecosystem:

```bash
pm2 start workers/ecosystem.workers.config.js
pm2 save
```

## 4) Logs

```bash
pm2 logs sync-pluggy --lines 100
pm2 logs process-pdf-ai --lines 100
```

