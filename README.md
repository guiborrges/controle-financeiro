# MeuFin - Controle Financeiro

Documentacao revisada em 26/10/2026. Referencia funcional: `d83efd4`.

Aplicacao web multiusuario em Node.js/Express para planejamento mensal,
lancamentos, rendas, cartoes, metas, patrimonio, historico e importacao revisada.
Desktop e MobileV2 compartilham estado e contratos financeiros.

## Documentacao

- [Documento independente para reconstruir o sistema](docs/MEUFIN-RECONSTRUCAO-COMPLETA.md)

- [Indice dos guias](docs/README.md)
- [Arquitetura completa](docs/ARCHITECTURE.md)
- [Contexto atual para manutencao](docs/PROJECT_CONTEXT.md)
- [Calendario continuo](docs/CONTINUOUS_CALENDAR.md)
- [Publicacao Oracle/PM2](DEPLOY.md)
- [Checklist de entrega](DEPLOY_CHECKLIST.md)

Relatorios em docs/refatoracao/ sao historicos. Os guias acima descrevem o
estado atual e diferenciam funcionalidades de pendencias conhecidas.

## Fontes e workspace

Workspace canonico: `C:\Users\guisi\OneDrive\Controle Financeiro\DIretório Online`.

| Local | Funcao |
|---|---|
| server.js, server/http/ | Composicao Express, rotas e seguranca |
| server/services/ | App-state e backup |
| server/repositories/, server/integrations/, server/jobs/ | SQL, provedores e filas |
| public/app/ | Frontend ativo Desktop/Mobile |
| public/app/modules/shared/ | Valores, catalogos, datas e projecao |
| public/app/modules/mes-atual/ | Comandos e regras mensais |
| public/login/ | Login/cadastro |
| tests/, scripts/, workers/ | Validacao e pipelines |

Arquivos legados da raiz e copias de auditoria nao sao fontes ativas.
Nao versionar armazenamento real, credenciais ou fixtures pessoais.

## Executar localmente

Requisito declarado: Node.js >=20.

```powershell
npm ci
npm start
```

Abrir http://localhost:3000/login (ou PORT configurada).
Usar FIN_STORAGE_DIR isolado para desenvolvimento. Sem essa variavel, o
servidor usa a raiz do projeto. Este guia nao fornece senhas iniciais.

## Persistencia

JSON particionado e o backend padrao. SQLite e opcional, com pendencias de
restore/revisao: nao trocar automaticamente. Oracle Database atende integracoes,
nao todo o app-state. FIN_STORAGE_DIR deve ser persistente em producao.
Preservar tambem as chaves necessarias a dados criptografados.

## Validar e publicar

```powershell
npm test
npm run test:smoke
npm run check:legacy-paths
```

Referencia validada: 481 testes Node e 15 cenarios sinteticos de navegador.
Nao certifica contas/bancos reais nem ausencia de todos os defeitos.
Ferramentas adicionais: test:perf:refactor, check:refactor-risks e audit:ci.
audit:system pode escrever/corrigir arquivos; nao usar como leitura inocua.

Fluxo ativo: GitHub main -> GitHub Actions -> Oracle Cloud -> PM2.
Workflow nao executa suite funcional e bloqueia apenas alertas criticos.
Render e alternativa historica. Ver DEPLOY.md antes de publicar.

## Regras essenciais

- Preservar historico, isolamento, revisoes 409 e backups.
- Distinguir salvamento local de confirmacao no servidor.
- Nao duplicar fatura e compras nos totais.
- Calendario projeta meses sem gravar anos infinitos.
- Integracoes exigem revisao explicita.
- /app exige login; /app-assets distribui codigo e nao pode conter dados reais.
