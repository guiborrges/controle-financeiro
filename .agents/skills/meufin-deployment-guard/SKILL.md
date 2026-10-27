---
name: meufin-deployment-guard
description: Preparar e verificar publicacao do MeuFin na Oracle VM via GitHub Actions, com testes, revisao de diff, saude, assets, limites de rollback e protecao de dados.
---

# Guarda de publicacao

Leia `.github/workflows/deploy.yml`, `package.json` e o diff real.
Push de main dispara Deploy para Oracle Cloud. O workflow atual usa SCP,
instala dependencias e executa PM2; ele nao garante rollback atomico, pinning
de todas as actions ou reinicio de apenas um processo. Nao descreva o que
deveria existir como se ja estivesse implementado.

Respeite o pedido vigente e a instrucao do usuario de publicar apos terminar
e conferir testes. Isso nao autoriza restore de dados, reset destrutivo,
exposicao de segredos, instalacao de servicos ou mudanca de infraestrutura.
Quando houver trabalho alheio, versione apenas os arquivos da entrega.

Antes do push, confirme branch, remoto, diff, arquivos sensiveis ausentes,
`npm test`, smoke/responsividade quando aplicaveis e check de paths antigos.
O gate atual e `npm audit --audit-level=critical`; ausencia de erro nesse gate
nao significa zero vulnerabilidades. Registre alertas altos separadamente.
Nao use audit fix --force nem atualize majors durante uma mudanca nao relacionada.

Commit enviado nao e deploy concluido. Acompanhe a execucao correspondente ao
SHA enviado e espere Deploy para Oracle Cloud concluir com success, nao apenas
Guard Legacy Paths. Leia falhas antes de reenviar; evite loop de commits cegos.
Depois confira `/api/health` 200, `/login` 200 e bootstrap sem sessao 401.
Compare assets publicados com fontes locais normalizando BOM/CRLF para texto.
Nao faca login pessoal ou mutacao financeira para testar uma mudanca de estilo.

Rollback de codigo pode ser um revert revisado, mas nao reverte dados/migracoes.
Antes de qualquer rollback que altere dados, pare e apresente impacto e backup
confirmado. Nao execute pm2 restart all manualmente sem identificar processos
e obter autorizacao para a operacao concreta. Relate SHA, workflow e verificacoes.
