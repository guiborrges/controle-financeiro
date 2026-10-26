# Documentacao do MeuFin

Revisao: 26/10/2026. Referencia funcional: d83efd4.

## Ordem de leitura

Para reconstruir o sistema somente a partir de um documento, usar
[Especificacao completa e pacote independente](MEUFIN-RECONSTRUCAO-COMPLETA.md).
Ela inclui formulas, exemplos, campos, algoritmos, casos de aceitacao e o
pacote-fonte com extrator e hashes. Historico financeiro privado nao e incluido.
A parte explicativa editavel esta em [MEUFIN-ESPECIFICACAO.md](MEUFIN-ESPECIFICACAO.md).
Regenerar com npm run docs:build e conferir com npm run docs:verify.

Entrega da especificacao: 487 testes no original; 484 testes e 15 cenarios
de navegador na copia extraida do documento. Contagem menor da copia decorre
da substituicao dos testes de historico privado, descrita no proprio manual.

1. [Contexto atual](PROJECT_CONTEXT.md): resumo para retomar o trabalho.
2. [Arquitetura](ARCHITECTURE.md): camadas, dados, contratos e responsabilidades.
3. [Calendario continuo](CONTINUOUS_CALENDAR.md): projecoes, series e excecoes.
4. [Pipelines](INDEPENDENT_PIPELINES.md): workers Pluggy e PDF/Oracle AI.
5. [Publicacao](../DEPLOY.md) e [checklist](../DEPLOY_CHECKLIST.md): operacao Oracle/PM2.
6. [Mapa do produto](mapa-do-produto.md): intencao funcional e limites de produto.

## Documentos atuais versus historicos

ARCHITECTURE.md e PROJECT_CONTEXT.md sao referencias atuais. Se um relatorio
antigo disser que uma etapa ainda nao comecou, isso descreve a data daquele
relatorio. Nao significa que a implementacao atual ainda esteja pendente.

Relatorios preservados como evidencias:

- [Diagnostico original](refatoracao/01-diagnostico-arquitetural.md) e
  [dependencias originais](refatoracao/02-dependencias-e-modulos.md).
- [Helpers 3A](refatoracao/12-etapa-3a-helpers.md),
  [catalogos 3B](refatoracao/13-etapa-3b-catalogos.md),
  [comandos 3C](refatoracao/14-etapa-3c-comandos.md) e
  [projecao 3D](refatoracao/16-etapa-3d-projecao.md).
- [Renderizacao 4A](refatoracao/17-etapa-4a-renderizacao.md) e
  [eventos/CSS 4B](refatoracao/18-etapa-4b-mobile-css.md).
- [Backend 5](refatoracao/19-etapa-5-backend.md),
  [integracoes 6](refatoracao/20-etapa-6-integracoes.md) e
  [validacao 7](refatoracao/21-fechamento-validacao.md).
- [Revisao de integridade de 22/10](DATA_INTEGRITY_REVIEW.md) e
  [handoff historico](CHAT_HISTORY_HANDOFF.md).

As contagens historicas nao devem ser reescritas. Referencia funcional atual:
481 testes Node e 15 cenarios de navegador aprovados. Persistem ressalvas de
SQLite, dependencia, datas e seguranca, descritas no guia e na etapa 7.

## Quando atualizar

| Mudanca | Documentos a revisar |
|---|---|
| Modulo, contrato ou fonte de dados | ARCHITECTURE.md e PROJECT_CONTEXT.md |
| Projecao, recorrencia ou excecao mensal | CONTINUOUS_CALENDAR.md e arquitetura |
| Integracao, fila ou prazo | INDEPENDENT_PIPELINES.md e arquitetura |
| Hospedagem, workflow ou storage | DEPLOY.md e DEPLOY_CHECKLIST.md |
| Funcionalidade ou regra de produto | mapa-do-produto.md e contexto |

Registrar data, codigo de referencia, testes executados e limites conhecidos.
Nao transformar plano em funcionalidade entregue nem teste sintetico em
certificacao de producao. Nao inserir credenciais ou dados pessoais nos guias.

## Esta revisao

Atualizados: arquitetura, contexto, README principal, deploy/checklist,
calendario, orientacoes de pipelines e mapa do produto. Handoff anterior foi
marcado como historico. Nenhuma regra financeira, schema, dependencia ou
configuracao de producao foi modificada nesta entrega documental.

Validacao desta revisao: 47 links locais conferidos, check:legacy-paths aprovado,
481 testes Node aprovados e 15 cenarios de navegador aprovados na reexecucao.
A primeira execucao do smoke falhou no preenchimento da edicao Mobile: parte
do valor apareceu na descricao. A reexecucao passou sem mudar codigo/teste.
Isso registra uma possivel intermitencia de foco da automacao, nao uma causa
definitivamente diagnosticada nem uma correcao entregue. Zero erros de pagina
e zero escritas financeiras no servidor na execucao completa aprovada.
