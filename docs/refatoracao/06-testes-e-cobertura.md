# Testes e cobertura atuais

## Atualizacao apos a limpeza da suite

Base 3458915, 23/10/2026: antes, 413 testes em 68 arquivos; depois, 398 testes
em 65 arquivos, todos aprovados. Smoke com 10 cenarios aprovado. Ver documento 15
para cada remocao e a cobertura substituta. Os numeros e lacunas abaixo sao
registros historicos, nao o estado atual completo. Nenhum percentual V8 novo
foi medido nesta limpeza.

Comandos atuais: `npm test` e `npm run test:smoke`. O alias test:ux:15points,
que apontava para arquivo inexistente, foi removido. Scripts manuais de carga e
integracao continuam separados; nao foram executados nem contados como aprovados.

Atualizacao: baseline da fase 1 preservada abaixo. Ao concluir a etapa 2A,
foram acrescentados 36 testes (total 352 aprovados) e executados 8 cenarios
de navegador. Ha agora 63 arquivos `*.test.js` no total. Ver documento 10
para comandos, resultados, diferencas conhecidas e limites da cobertura.

Base `a3011ea`, Windows, Node v24.14.1, npm 11.11.0, 23/10/2026.

## Resultado executado

Comando: `node --test --experimental-test-coverage tests/*.test.js`.

- 58 arquivos de teste versionados.
- 316 testes passaram; zero falhas, cancelamentos ou testes ignorados.
- Execucao de cobertura repetida para extrair o relatorio sem truncamento:
  aproximadamente 13,8 segundos na segunda execucao.
- `npm audit --json`: uma dependencia alta, nenhuma critica; ver F05.
- Nenhum teste alterado para encobrir falha. Nenhum teste permanente novo nesta
  etapa: testes de caracterizacao adicionais pertencem a fase 2 apos aprovacao.

## Cobertura V8 observada

Colunas: linhas, branches (caminhos condicionais), funcoes.

| Arquivo / conjunto observado | Linhas | Branches | Funcoes |
|---|---:|---:|---:|
| Agregado informado pelo runner | 39,05% | 52,13% | 46,38% |
| `shared/financial-query.js` | 89,09% | 87,25% | 94,12% |
| `shared/import-identity.js` | 98,39% | 86,67% | 100,00% |
| `server/import-identity.js` | 100,00% | 83,33% | 100,00% |
| `server/app-state-store.js` | 61,45% | 60,00% | 68,06% |
| `server/backup-store.js` | 70,34% | 62,43% | 81,03% |
| `server/sqlite-app-state-store.js` | 83,33% | 35,71% | 77,78% |
| `server/http/routes/bill-import-ai.js` | 71,97% | 44,55% | 80,68% |
| `server/widget-snapshot.js` | 85,12% | 60,61% | 66,67% |
| `workers/worker_pluggy.js` | 11,97% | 75,00% | 10,53% |

IMPORTANTE: o agregado e do conjunto carregado/instrumentado pelo Node; inclui
testes e nao e uma porcentagem confiavel de todo o produto. Modulos executados
por `vm`, funcoes extraidas e asserts de texto nao representam cobertura E2E de
DOM. Arquivos nao carregados podem ficar fora do denominador. O worker Oracle
nao foi executado. Nao prometer cobertura global ou visual a partir dessa tabela.

## Protecoes ja cobertas

| Area | Evidencias de testes existentes |
|---|---|
| Calculos e bases | `financial-query`, `financial-guards`, `outflow-amounts` |
| Datas e recorrencias | `shared-dates`, `audit-regressions`, `income-dates`, `income-recurrence`, `continuous-calendar`, `calendar-projection` |
| Faturas | `unified-card-bill-reconcile`, `mes-atual-extracted-modules` |
| Categorias/tags | `month-category-options` (inclui materializadas zero, historico e visibilidade) |
| Edicao Desktop/Mobile | `mes-atual-continuous-actions`, `mobile-save-contract`, `mobile-outflow-edit-visibility` |
| Patrimonio | `patrimonio-reconciliation`, `patrimonio-source-cleanup` |
| Importacao e estornos | `import-identity`, `import-save-contract`, `import-bills-schema`, `bill-import-ai-route` |
| Ownership / conflito | `app-state-ownership`, `app-state-routes`, `storage-sync-results` |
| Backups/restauracao | `backup-isolation-integration`, `app-state-read-write` |
| Seguranca de sessao | `auth-routes`, `security-cookies`, `profile-auto-exit-backup` |
| Filtros Dashboard | `dashboard-empty-period`, `dashboard-rules` |

Alguns testes sao de contrato de fonte, nao de interacao real. Por exemplo,
presenca de handler no JS nao prova que o seletor funciona no navegador.

## Lacunas prioritarias

1. Acesso publico/autenticado por usuario a seeds historicos: teste de privacidade.
2. Escrita particionada interrompida, falha entre blocos, limite excedido depois
   de preparar dados e releitura em novo processo.
3. Suite comum para JSON e SQLite: revisao monotona com relogio congelado,
   restore verdadeiro, espelho falhando, chave ausente e reinicio.
4. Adaptadores browser/server sobre a mesma fixture: pagamentos, participantes,
   datas de renda, parada de serie e virada de ano.
5. UI automatizada Desktop/Mobile com seletores reais, trocar ano/mes, editar,
   cancelar, pagar, salvar e recarregar em duas contas de teste locais.
6. Worker Oracle e Pluggy: timeout, lock, retry, queda, tenant e rollback.
7. Desempenho com volumes crescentes, sem alterar regras ou descartar registros.
8. Conteudo HTML hostil sintetico em categorias/descricao e contratos de erro.

## Harness de carga desatualizado

`scripts/load-test.js:144` envia PUT sem `baseRevision`; o backend atual exige
revisao exata depois da primeira escrita. O script nao atualiza revisao a cada
PUT. Nao foi usado como prova de desempenho/concorrencia, nem executado contra
producao. Corrigir o harness em lote de testes, sem relaxar a protecao 409.

`audit:system` nao foi executado sobre armazenamento real: ele conhece pastas de
usuarios e gera artefatos. Auditoria segura nao deve rodar scripts desconhecidos
em dados reais apenas pelo nome. Scripts E2E e UX devem ser revisados antes do uso.
