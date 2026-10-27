# Skills do MeuFin: instalacao, compatibilidade e riscos

Data: 27/10/2026. Base do projeto: `5d4f7d9`.
Escopo autorizado: instalar, configurar, validar e documentar skills.
Nenhuma funcionalidade, dado financeiro, dependencia de producao,
autenticacao, banco ou workflow de deploy foi alterado nesta entrega.

## Resultado

25 skills locais: 16 da lista principal, uma complementar e oito personalizadas.
O Skill Creator Anthropic avaliado nao foi instalado no projeto devido aos
problemas descritos abaixo. Alternativa: skill-creator nativo do Codex.
As instalacoes globais anteriores nao foram apagadas nem atualizadas.
As copias locais fixam as versoes deste projeto. Nomes iguais no escopo global
podem aparecer duas vezes no seletor; Codex nao os mescla. Prefira o caminho
local indicado no AGENTS.md, sem remover a instalacao global de outros projetos.

Pasta P = `.agents/skills/` na raiz deste repositorio, nao uma subpasta meufin
artificial. A descoberta desse caminho e documentada em
[OpenAI Docs](https://learn.chatgpt.com/docs/build-skills).
Cada linha abaixo indica sua subpasta em P. Origem imutavel e hashes completos:
[installation-lock.json](installation-lock.json).

## Versoes fixadas

| Ref | Repositorio | Commit completo | Licenca observada |
|---|---|---|---|
| A | [anthropics/skills](https://github.com/anthropics/skills) | dbd4588f9e1033efb41dad4bef2f7947c8993d44 | Apache-2.0 nas skills selecionadas |
| B | [c47-dev/skills](https://github.com/c47-dev/skills) | b158f5c583003ec0e42afa571e3c5c54bf25b73b | MIT |
| C | [obra/superpowers](https://github.com/obra/superpowers) | 2ce8aa15d05bd57213e6f746f953aafb7ded7a8b | MIT |
| D | [getsentry/skills](https://github.com/getsentry/skills) | d12f250460ffd961f549dbebf7eeb0cf4afd4c2e | Apache-2.0; referencias de security-review com CC BY-SA 4.0 |
| E | [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | 6ec269328bc400712ee225a173a14b6b29128df7 | MIT declarado no README, preservado junto da skill |
| F | [seb1n/awesome-ai-agent-skills](https://github.com/seb1n/awesome-ai-agent-skills) | 75865a5d037a4cdaa7f409a4ec14ab9b0292920b | MIT |

Licencas locais e de repositorio foram preservadas. Em security-review,
LICENSE identifica as referencias OWASP e LICENSE.repository preserva Apache-2.0.
Nao se atribui a documentacao de terceiros uma nova licenca do MeuFin.
Licencas c47 mantem a linha vazia final do upstream; o check de whitespace
omite apenas essa regra de EOF, sem desativar os demais checks de espacos.

## Externas instaladas

Compatibilidade significa instrucoes utilizaveis no Codex, nao disponibilidade
automatica de todos os comandos citados. Nomes de ferramentas de outro agente
nao concedem permissoes. Entradas com ressalvas sao controladas por AGENTS.md.

| Skill | Origem | Versao | Status | Codex | Local | Finalidade | Dependencias adicionais | Riscos / limites |
|---|---|---|---|---|---|---|---|---|
| webapp-testing | [Anthropic](https://github.com/anthropics/skills/tree/main/skills/webapp-testing) | A + adaptacao local | Instalada adaptada | Parcial | P/webapp-testing | Navegador e UI | Node Playwright existente; Python Playwright so se escolhido | Helper de servidor proibido neste projeto; preferir runners Node |
| qa-execute | [c47](https://github.com/c47-dev/skills/tree/main/skills/qa-execute) | B | Instalada | Sim | P/qa-execute | Executar QA congelado | Manifesto completo, ferramentas do caso | Nao cria testes nem conserta falhas; sem manifesto fica bloqueada |
| test-driven-development | [Superpowers](https://github.com/obra/superpowers/tree/main/skills/test-driven-development) | C | Instalada | Sim, com limites locais | P/test-driven-development | Regressao antes da correcao | Runner do projeto | Frases sobre apagar implementacao nao autorizam remover trabalho do usuario |
| frontend-design | [Anthropic](https://github.com/anthropics/skills/tree/main/skills/frontend-design) | A | Instalada | Sim | P/frontend-design | Design contextual | Nenhuma para ler | Brief e preferencias do MeuFin prevalecem sobre sugestoes genericas |
| web-design-guidelines | [Vercel](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines) | E | Instalada | Sim | P/web-design-guidelines | Revisao de UI/acessibilidade | Internet para regras atuais | Regras remotas nao sao executadas nem autoridade superior |
| analyze | [c47](https://github.com/c47-dev/skills/tree/main/skills/analyze) | B | Instalada | Sim | P/analyze | Explicacao apoiada no repositorio | Nenhuma | Somente leitura; nao substitui pedido de implementar |
| simplify-code | [c47](https://github.com/c47-dev/skills/tree/main/skills/simplify-code) | B | Instalada | Sim | P/simplify-code | Limpeza com comportamento preservado | Testes do projeto | Sem promessa de ganho de performance nao medido |
| code-review | [c47](https://github.com/c47-dev/skills/tree/main/skills/code-review) | B | Instalada | Sim | P/code-review | Revisao e tradeoffs | Git; agentes opcionais | Sem agentes, perspectivas sequenciais; sem CLI/modelo externo automatico |
| plan | [c47](https://github.com/c47-dev/skills/tree/main/skills/plan) | B | Instalada | Sim | P/plan | Plano e contratos de teste | Nenhuma; agentes opcionais | Planejamento somente quando pertinente, nao parada arbitraria da execucao |
| best-practice-research | [c47](https://github.com/c47-dev/skills/tree/main/skills/best-practice-research) | B | Instalada | Sim | P/best-practice-research | Pesquisa oficial com evidencias | Navegacao para fatos externos | Evidencia nao concede autoridade de alterar stack |
| optimize-performance | [c47](https://github.com/c47-dev/skills/tree/main/skills/optimize-performance) | B | Instalada | Sim, com limites locais | P/optimize-performance | Otimizacao mensuravel | Baseline/avaliador | Goals so por pedido explicito; nao inventar ferramenta ausente |
| security-review | [Sentry](https://github.com/getsentry/skills/tree/main/skills/security-review) | D | Instalada | Sim, com limites locais | P/security-review | Vulnerabilidades e fluxos | Nenhuma para revisao estatica | Exclusao generica de rotas autenticadas NAO se aplica ao SaaS multiusuario |
| security-model | [Sentry](https://github.com/getsentry/skills/tree/main/skills/security-model) | D | Instalada com restricao | Parcial | P/security-model | Politica de revisao/ameacas | Python 3.10+ e Git para resolver; uv opcional | Usar raiz Git sem links externos; sem nova politica ou exclusao sem aprovacao |
| secret-serialization | [Sentry](https://github.com/getsentry/skills/tree/main/skills/secret-serialization) | D | Instalada | Sim | P/secret-serialization | Segredos em logs/serializacao | Nenhuma | Escopo especifico; nao substitui auditoria de todos os segredos |
| skill-scanner | [Sentry](https://github.com/getsentry/skills/tree/main/skills/skill-scanner) | D | Instalada | Sim | P/skill-scanner | Triagem estatica de skills | Python + PyYAML; uv opcional | Heuristicas, falsos positivos e cobertura limitada; nao e certificacao |
| gha-security-review | [Sentry](https://github.com/getsentry/skills/tree/main/skills/gha-security-review) | D | Instalada | Sim | P/gha-security-review | Ataques em GitHub Actions | Git; gh apenas se necessario | Escopo externo da skill nao cobre sozinho toda a seguranca operacional |
| dependency-scanning | [seb1n](https://github.com/seb1n/awesome-ai-agent-skills/tree/main/security/dependency-scanning) | F | Complementar instalada | Sim | P/dependency-scanning | Inventario e vulnerabilidades npm | npm audit existente; SBOM/tooling opcional | Nao faz upgrade major ou envia inventario a SaaS sem escopo |

## Nao adotadas / incompatibilidades parciais

| Skill / componente | Origem e versao | Status | Compatibilidade | Local | Finalidade | Dependencias | Problema e alternativa |
|---|---|---|---|---|---|---|---|
| Skill Creator Anthropic | [origem](https://github.com/anthropics/skills/tree/main/skills/skill-creator), A, Apache-2.0 | Nao instalada no projeto | Evals nao equivalentes a Codex/Windows | Nenhum em P; copia global anterior preservada | Criar/avaliar skills | Claude CLI autenticado, Python/PyYAML, viewer | Riscos reais abaixo; usar skill-creator nativo do Codex |
| with_server.py | webapp-testing, A | Copiado como recurso upstream, execucao bloqueada nas instrucoes | Inadequado para gerenciar servidores Windows neste projeto | P/webapp-testing/scripts | Iniciar servidor de teste | Python stdlib | Shell/filhos/pipe/readiness; usar fixture Node existente |
| Resolver filesystem fora de Git | security-model, D | Caminho nao autorizado para arvores nao confiaveis | Parcial | P/security-model/scripts | Resolver politicas | Python | Busca de codigo pode seguir link externo; usar raiz Git validada |

Nenhum dos 17 links principais estava indisponivel na verificacao. Nao ha
instalacao ficticia para suprir o Skill Creator recusado. Ausencia de uv,
Claude CLI e gh nao impede as instrucoes compatíveis, mas limita comandos
especificos; nao foram instaladas ferramentas globais para contornar isso.

### Achados da revisao integral de scripts

Revisao independente, somente leitura, de 16 arquivos Python e dois templates
HTML, cobrindo skill-creator, webapp-testing e security-model:

- `skill-creator/eval-viewer/generate_review.py:279`: JSON inserido diretamente
  em script HTML permite escape com fechamento de script em dados de avaliacao.
- Mesmo arquivo, linha 288: lsof/SIGTERM sobre porta sem provar propriedade
  pode encerrar processos alheios. Isso nao se torna seguro por falhar no Windows.
- `skill-creator/scripts/run_eval.py`: exige Claude CLI, herda ambiente e usa
  select em pipes, incompatível no Windows. Falha pode virar falso resultado
  negativo. Nao e avaliacao de reconhecimento de skills pelo Codex.
- Viewer/empacotador podem seguir links externos; package_skill nao exclui
  automaticamente segredos como .env. Nao foram executados.
- `webapp-testing/scripts/with_server.py`: shell=True, pipes nao drenados,
  readiness por porta e terminacao so do shell. A adaptacao local do SKILL.md
  proibe seu uso e a regra upstream de executar antes de inspecionar.
- `security-model/scripts/resolve_security_model.py`: caminho de busca fora de
  Git pode ler symlink externo. Uso restringido a Git/arquivos confiaveis.

A revisao nao encontrou payload malicioso obvio, mas isso nao e prova de
ausencia de riscos. Arquivos de referencia nao executaveis nao receberam
auditoria semantica integral. Exemplos nao devem ser executados por descoberta
de testes: o npm test do MeuFin seleciona explicitamente tests/*.test.js.

## Catalogos complementares examinados

| Catalogo | Commit | Resultado / decisao |
|---|---|---|
| [OpenAI Plugins](https://github.com/openai/plugins) | 0722921d5542fc593105c27bd52630babd8b8c2a | Catalogo/README e arvore Git examinados; skills Codex Security e Sentry identificadas. Nao duplicar revisores instalados nem instalar conectores. Checkout integral encontrou paths longos no Windows; leitura por git show/ls-tree funcionou. |
| [Kodus Awesome](https://github.com/kodustech/awesome-agent-skills) | 40b93f9d6dea66f019140eef72a569be0b11de08 | Catalogo de links, nao skill unica. Identificadas deployment-pipeline-design, auditing-access-control, sast-configuration e authsome. Redundancia, broker novo ou stacks/servicos externos: nao adotados. |
| [Awesome AI Agent Skills](https://github.com/seb1n/awesome-ai-agent-skills) | F | dependency-scanning adotada. webhook-setup inspecionada, nao adotada: exemplo Stripe/Postgres, check-then-act/ack nao e contrato Pluggy. database-migration/backup e OAuth genericos nao substituem skills locais de storage/auth. |
| [Sentry for AI](https://github.com/getsentry/sentry-for-ai) | 45be405774d66f64ff61d5a16787f32253f558b7 | Repositorio-fonte orienta usar distribuicao. [plugin-codex](https://github.com/getsentry/plugin-codex), 8832fafe9b061151b80c34e7752bc3553de9f68a, tambem examinado. sentry-instrument e sentry-create-alert dependem de MCP/token/servico e mudancas no app; nao ativados. Skill global sentry ja existente atende leitura quando houver CLI/autenticacao. |

Nenhum catalogo autoriza acesso bancario ou implanta observabilidade. Nao houve
SDK Sentry, MCP, alertas, contas, tokens, troca de DB, Redis, tunel ou servico novo.

## Personalizadas criadas

Todas versao 1.0.0, base 5d4f7d9, origem no codigo/testes do MeuFin e sem
dependencias globais. Instrucoes novas, nao bibliotecas de runtime. Oito SKILL.md
curtos, sem scripts que possam modificar dados ao serem descobertos.

| Skill | Origem | Versao | Status | Codex | Local | Finalidade | Dependencias | Riscos / limites |
|---|---|---|---|---|---|---|---|---|
| meufin-financial-engine | Codigo/testes locais | 1.0.0 | Criada | Estrutura validada | P/meufin-financial-engine | Calculos/recorrencia/dupla contagem | Node/testes existentes | Nao muda reembolso por inferencia |
| meufin-dashboard-audit | Codigo/testes locais | 1.0.0 | Criada | Estrutura validada | P/meufin-dashboard-audit | Periodos/graficos/valores | Playwright/fixture | Oraculo independente; sem conta pessoal |
| meufin-responsive-qa | Codigo/testes locais | 1.0.0 | Criada | Estrutura validada | P/meufin-responsive-qa | Viewports/modais/PWA | Navegadores de teste | Emulacao nao homologa aparelho fisico |
| meufin-multiuser-security | Codigo/testes locais | 1.0.0 | Criada | Estrutura validada | P/meufin-multiuser-security | Auth/CSRF/ownership | Duas contas sinteticas | Testes autenticados fazem parte do escopo |
| meufin-pluggy-reconciliation | Codigo/testes locais | 1.0.0 | Criada | Estrutura validada | P/meufin-pluggy-reconciliation | Importacao/staging/idempotencia | Fixtures e dependencias injetadas | Nao conecta banco real |
| meufin-backup-integrity | Codigo/testes locais | 1.0.0 | Criada | Estrutura validada | P/meufin-backup-integrity | Backup/restore/migracoes | Storage temporario; SQLite so se disponivel | Backend padrao JSON; producao exige aprovacao |
| meufin-safe-refactor | Codigo/testes locais | 1.0.0 | Criada | Estrutura validada | P/meufin-safe-refactor | Refatoracao incremental | Testes existentes | Preservar compatibilidade, pending e retry |
| meufin-deployment-guard | Codigo/workflow locais | 1.0.0 | Criada | Estrutura validada | P/meufin-deployment-guard | Deploy/saude/rollback | Git/Actions; PM2 apenas na VM | Push nao e deploy; rollback de codigo nao recupera dados |

## Validacao e reconhecimento

- Instalador oficial skill-installer usado com --ref apontando para commits
  imutaveis, --dest .agents/skills, sem executar os scripts das skills durante
  download. Recursos e licencas preservados. Unica adaptacao externa:
  webapp-testing/SKILL.md, indicada no lock com hash upstream e hash instalado.
- 25 frontmatters validados com quick_validate.py do criador nativo; nomes e
  descricoes conferidos. Hashes dos 92 recursos em installation-lock.json.
- `node scripts/validate-project-skills.js`: confere inventario, hashes,
  versoes, caminhos, arquivos extras e ausencia de symlinks. `--self-test`
  cobre bundle valido, adulteracao, arquivo extra e tentativa de path traversal.
- Regressao do aplicativo: `npm test`, 501 testes passaram; nenhuma mudanca
  em public/, server/, workers/, package.json, lockfile npm ou workflow.
  Smoke/browser nao foi repetido para esta instalacao sem mudanca de UI/runtime.
- Scanner Sentry revisado integralmente antes de executar. PyYAML 6.0.3 foi
  instalado somente em venv temporario tmp/skills-tools-2026-10-27, nao global
  nem dependencia do aplicativo. Scanner nao executa os scripts analisados.
- [static-scan.json](static-scan.json) preserva achados sem evidencias cruas que
  possam expor segredos. Foram 45 alertas heuristicos: oito em exemplos de
  security-review, 36 em exemplos/detectores de skill-scanner, um no probe
  localhost do helper webapp-testing. Nao significam 45 vulnerabilidades.
  Os exemplos OWASP de senhas/LDAP/AWS, codigos de ataque e regex foram
  conferidos no contexto. O helper tem riscos reais descritos acima, mesmo
  quando o alerta especifico de socket apenas identifica seu probe localhost.
- A estrutura atende a descoberta documentada em .agents/skills. Nao existe
  nesta sessao uma API de inventario atualizado do host para afirmar que o
  seletor ja recarregou todas as entradas. Confirmar no proximo turno com `$`
  ou `/skills`; se nao aparecer, reiniciar o Codex. Isso e distinto de validar
  arquivos ou de um agente ler explicitamente o SKILL.md.
- Nao ha certificacao de seguranca, de reconhecimento automatico, de scanner
  completo ou de compatibilidade de cada exemplo com Windows.

Uma segunda revisao independente aplicou as oito skills a oito cenarios
sinteticos, sem executar fluxos: recorrencias futuras, metas no resultado,
iPhone/WebKit, IDOR autenticado, duplicidade Pluggy, backend de restore,
save pending e deploy enfileirado. As orientacoes respeitaram os limites nos
oito cenarios. A revisao encontrou um caminho Pluggy incorreto e uma frase
ambigua sobre garantia de revisao no SQLite; ambos foram corrigidos antes do
lock final. Isso nao equivale a testar a selecao automatica do host nem o app.
Também apontou texto historico F06 desatualizado nos mapas de arquitetura:
a skill do Dashboard segue o codigo atual, nao a ressalva antiga. Esse texto
historico nao foi usado como regra financeira nem alterado fora deste escopo.

## Manutencao

AGENTS.md roteia skills por tarefa e define limites para SaaS financeiro.
Nao editar skills externas sem marcar adaptacao e atualizar hashes apos revisao.
Nao atualizar automaticamente para main. Nova versao exige conferir diff,
licenca, scripts, dependencias e testes. Nao regenere hashes apenas para ocultar
um alerta de integridade. Skills/relatorios sao arquivos de desenvolvimento;
nao entram no app-state ou backup financeiro. Copia pelo deploy nao as executa.

Para revalidar o YAML, use o quick_validate.py nativo com Python/PyYAML de um
ambiente isolado. O validador Node de hashes nao exige dependencias novas.
As dependencias dos exemplos permanecem opcionais e nao foram provisionadas.
