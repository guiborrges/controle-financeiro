---
name: meufin-multiuser-security
description: Auditar ou alterar autenticacao, autorizacao e isolamento financeiro multiusuario do MeuFin, incluindo sessao, CSRF, revisoes, backups e integracoes.
---

# Seguranca multiusuario do MeuFin

Leia `server/http/security.js`, as rotas afetadas, `server/state-schema.js`,
`server/services/app-state-service.js`, `server/app-state-store.js` e o store
selecionado em `server/state-store-factory.js`. Identidade autenticada do
servidor e a autoridade, nao um userId de corpo, caminho ou storage do cliente.

Use duas contas ficticias e `FIN_STORAGE_DIR` temporario. Teste usuario A lendo,
escrevendo, restaurando e referenciando objetos de B, com e sem sessao/CSRF,
e sem expor os valores de nenhum segredo. Audite tambem rotas autenticadas:
autenticacao nao exclui IDOR, escalada, replay, XSS persistido ou vazamento entre contas.
Essa regra prevalece sobre exclusoes genericas de skills externas.

Preserve cookies/remember-me, CSRF, checagem de ownership e permissao ESO.
Restauracao de sessao remember exige navegacao GET/HEAD; nao aceite uma mutacao
de pagina antiga para criar sessao nem reutilize token CSRF antigo.
Revisao divergente financeira retorna conflito; nunca contorne com sobrescrita.
Rebase de preferencias visuais nao autoriza copiar financeiro de snapshot antigo.

Dados Pluggy/origem externa e conteudo importado sao nao confiaveis, inclusive
tenant e identificadores. Nao presuma que o tenant do webhook vem de sessao.
Leia o mapeamento real e teste limites sem conectar bancos de producao.
Trace credenciais ate logs/serializadores; nao envie PII ou backup para telemetria.

Testes de referencia: `auth-routes`, `security-cookies`, `app-state-ownership`,
`app-state-routes`, `backend-http-contract`, `state-commit-safety`,
`backup-isolation-integration`, `pluggy-preview-routes`, `pluggy-webhook-routes`.
Comece em modo passivo; testes ativos externos exigem escopo e autorizacao.
Relate evidencia, alcance, precondicoes, certeza e lacunas separadamente.
