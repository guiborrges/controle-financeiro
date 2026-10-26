# Mapa da arquitetura atual

## Atualizacao da etapa 5

App-state HTTP -> services/app-state-service -> contrato injetado do state store.
Backups manuais/saida HTTP -> services/backup-service -> backup-store/user-store.
Importacao HTTP -> jobs/serial-queue -> processador existente de importacao.
server.js -> http/error-handler para apresentacao dos erros nao tratados.
Os stores concretos e as interfaces publicas das rotas nao foram substituidos.

Base e limites: ver 01. Os caminhos abaixo sao relativos a raiz do projeto.

## Fluxo principal

```text
Chrome Desktop / Mobile
  -> public/app/index.html (scripts defer em ordem + loader mobile)
  -> bootstrap.js -> initializeServerStorage -> GET /api/app/bootstrap
  -> state.init -> normalizacao / calendario / preferencias
  -> globais de dominio -> telas Desktop ou MobileV2Data -> telas Mobile
  -> save / Storage -> cache + dirty keys -> PUT /api/app-state + baseRevision
  -> auth + CSRF -> verifica revisao e queda de meses -> stateStore
  -> JSON particionado (padrao) OU SQLite com espelho JSON (opcional)
```

O backend e Express, sem ORM. O dominio financeiro fica principalmente no
cliente; o servidor protege sessao, proprietario, formato e persistencia.
SQLite guarda o documento de estado por usuario, nao uma tabela de lancamentos.
Oracle e um banco separado para staging bancario e documentos; nao substitui
automaticamente o estado financeiro canonicamente salvo pelo usuario.

## Responsabilidades

| Dominio | Frontend | Backend / dependencia relevante |
|---|---|---|
| Autenticacao | `auth-client.js`, `public/login/login.js`, `public/shared/crypto-client.js` | `server/http/routes/auth.js`, `security.js`, `password.js`, `data-crypto.js` |
| Usuarios e perfil | `auth-client.js`, `preferences.js`, `mobile-v2/perfil-mobile.js` | `user-store.js`, rotas `profile.js` e `developer.js` |
| Lancamentos e despesas | `mes-atual.js`, `modules/mes-atual/{outflows,filters,selectors,modals}.js` | App-state; `invoice-import-plan.js` para importacao |
| Receitas e extras | `mes-atual.js`, `income-dates.js`, `income-recurrence.js` | Projecao de calendario; app-state |
| Categorias | `core.js` (getMonthCategoryOptions), `state.js` (aliases), `category-editor.js`, `ui-icons.js` | Mesmo app-state; contexto de importacao derivado |
| Tags | `core.js` (getMonthTagOptions), `category-editor.js` | Visibilidade e renomeacoes por mes / calendario |
| Recorrencias | `continuous-calendar.js`, `continuous-calendar-app.js`, `mes-atual/recurrence.js` | `server/calendar-projection.js` usa o motor comum |
| Parcelamentos | `mes-atual.js`, `continuous-calendar.js`, `import-bills-schema.js` | `invoice-import-plan.js`; metadados preservados |
| Cartoes e faturas | `mes-atual.js`, `mes-atual/cards.js`, `FinancialQuery` | App-state e projecao do widget |
| Compartilhadas / reembolsos | `shared/outflow-amounts.js`, `mes-atual/shared-expense.js`, `mes-atual.js` | Identidade/proveniencia em importacoes |
| Metas | `mes-atual.js`, `ui.js`, `core.js`, `FinancialQuery` | `widget-snapshot.js`; metas de consumo != reservas financeiras |
| Planejamento e resumo mensal | `mes-atual.js`, `mes-atual/totals.js`, `core.js` | FinancialQuery; nao confundir consumo com fatura |
| Patrimonio | `patrimonio-clean.js`, `mobile-v2/patrimonio-mobile.js`, bridge | Arrays de contas/movimentos no app-state |
| Dashboard | `dashboard.js`, `shared/dashboard-rules.js` | FinancialQuery, filtros de periodo e Chart.js |
| Historico e ESO | `historico-eso.js`, `mobile-v2/historico-mobile.js` | Permissao ESO na sessao; FinancialQuery |
| Calendario | `calendar.js`, `calendar-{utils,events,render}.js` | `shared/dates.js`, mesmos meses e lancamentos |
| Busca universal | `universal-search.js`, Fuse.js | Indice derivado dos meses, categorias e lancamentos |
| Notificacoes | `mes-atual/notifications.js`, `interactions.js` | Datas reais; adicionalmente `server/telegram-bot.js` |
| Preferencias e tema | `preferences.js`, `dark-mode.js`, `storage.js` | `captureCompatibilityPreferences`, app-state |
| Backup/restauracao | `backup.js`, area developer | `backup-store.js`, `fs-atomic.js`, `state-schema.js` |
| Internet Banking | `pluggy-banking.js`, `mobile-v2/internet-banking-mobile.js` | Rotas `pluggy-preview.js`, staging Oracle |
| Pluggy coleta / webhook | Revisao e memoria no Banking | `worker_pluggy.js`, `pluggy-webhook.js`, `workers/lib/pluggy-client.js` |
| PDF/IA / Muplug | `import-bills{,-utils,-schema,-review}.js` | `bill-import-ai.js`, `worker_oracle_ai.js`, OCI CLI / endpoint configurado |
| Widget | Configuracao em perfil | `routes/widget.js`, `widget-snapshot.js`, `widget-script-template.js` |
| Estado / sincronizacao | `data.js`, `state.js`, `storage.js`, `pending-sync.js` | `app-state.js`, `state-store-factory.js`, stores JSON/SQLite |
| Mobile | `mobile-v2.js`, `mobile-v2-enhancements.js`, `modules/mobile-v2/*` | Bridge e funcoes de dominio existentes |

## Dependencias que devem ser preservadas

1. `shared/outflow-amounts` -> `shared/financial-query` -> core/dashboard,
   bridge mobile e snapshot widget no servidor.
2. `continuous-calendar` -> adaptador browser OU adaptador server -> recorrencias
   projetadas, cartoes e excecoes de pagamento/edicao.
3. `shared/import-identity` -> `server/import-identity` -> webhook e worker;
   cliente tambem utiliza a identidade compartilhada.
4. `getMonthCategoryOptions` / `getMonthTagOptions` -> formularios desktop,
   mobile, revisao de importacao e Banking. Consulta historica pode incluir
   categorias ocultas sem oferece-las para novos registros.
5. App-state -> patrimonio e lancamentos referenciam movimentos por ID;
   editar/apagar nao pode produzir saldo duplicado ou referencia orfa.
6. `save()` e promessas de flush -> revisao de importacao/edicao so confirma
   depois da persistencia; conflito nao e sucesso.

## Estado e persistencia

- `data.js` declara estado lexical global; `window.data` nao e garantia.
  `getAllFinanceMonths()` e o ponto preferivel para consumidores novos.
- `state.js` restaura, normaliza, migra e guarda snapshots de undo.
- `storage.js` junta cache do servidor, preferencias, dirty keys, revisao,
  namespace por usuario, sincronizacao entre abas e varias funcoes de UI.
- `pending-sync.js` protege alteracoes nao confirmadas; manter namespace e
  criptografia. Nao transformar conflito em sobrescrita automatica.
- JSON: manifesto, particoes e blocos anuais de meses; usuarios/sessoes/backups
  continuam em arquivos. `FIN_STORAGE_DIR` separa armazenamento de codigo.
- SQLite: opcional via `FIN_STATE_BACKEND=sqlite`, `node:sqlite` sincronico,
  WAL, chave primaria `user_id`. Fallback para JSON quando indisponivel.
- Oracle: conexoes, transacoes e documentos com indexes por tenant e identidade.
  Validacao do plano SQL real/estatisticas depende de ambiente de teste Oracle.

## Legado e referencias indiretas

Arquivos da raiz como `core.js` e `index.html` estao neutralizados, nao sao uma
segunda implementacao funcional. `app.js` e um wrapper de compatibilidade.
Nao remover apenas por tamanho pequeno. O service worker mobile ainda existe,
mas `index.html:30` cancela registros antigos e limpa seus caches; nao foi
classificado como cache ativo causador dos problemas atuais.

Funcoes chamadas por `onclick`, atributos de dados, wrappers e loaders dinamicos
nao podem ser classificadas como mortas por uma busca de imports. Os nomes
publicos devem permanecer como fachadas durante extracoes incrementais.
