# Alteracoes realizadas

## Fase 1: historico do diagnostico

Foram criados os nove documentos `docs/refatoracao/01-...md` a `09-...md`.
Nenhum arquivo funcional, teste permanente, dependencia, API, esquema, visual
ou regra financeira foi alterado. Nenhum commit/push/deploy foi realizado nesta etapa.

### Problema original

Faltava um diagnostico atual com evidencia, linha de base de desempenho e plano
de refatoracao separado das correcoes funcionais e de seguranca.

### Trabalho executado

Inventario, leitura dirigida, grafo estatico, comparacao de responsabilidades,
testes/cobertura, auditoria de dependencias e medicoes em browser isolado.
Simulacoes F02/F04 executaram o codigo existente em processos filhos com
`FIN_STORAGE_DIR` temporario e registros ficticios. Nao alteraram fontes.

O navegador de teste usou o servidor de verificacao local preexistente,
somente leitura; arquivos tecnicos de log/launch ficaram fora do versionamento.
Nenhum navegador pessoal autenticado foi controlado. Backups privados e dados
de contas nao sao parte dos documentos.

### Por que isso ajuda

O plano preserva pontos compartilhados que ja funcionam, evita apagar fachadas
de compatibilidade e coloca integridade/privacidade antes de reorganizar pastas.

### Testes e resultados

316 testes aprovados, cobertura e limites no documento 06; baseline no 07.
F02: falha de bloco invalidou releitura no armazenamento ficticio.
F04: duas escritas SQLite com relogio fixo produziram mesma revisao.
F01: arquivo de historico embutido respondeu sem login em leitura HTTP publica.

### Riscos restantes

Todos os achados continuam abertos. Esta entrega e diagnostico, nao uma
refatoracao concluida nem correcao de seguranca. A aprovacao deve definir o
primeiro lote e autorizar separadamente publicacao.

## Modelo para cada lote futuro

Registrar: ID do lote/commit; arquivos alterados; problema original; solucao;
justificativa da estrutura; testes antes/depois; igualdade financeira; medidas;
riscos restantes; procedimento de reversao; autorizacao e resultado do deploy.

## Etapa 2A: protecao autorizada e executada

Foram acrescentados somente testes, fixtures ficticias e o harness de navegador,
com atualizacao destes documentos. Nenhum fonte funcional foi alterado.

Arquivos novos:

- `tests/helpers/refactor-fixtures.js`: dados inteiramente sinteticos e loader VM.
- `tests/helpers/refactor-browser-server.js`: HTTP local readonly por nonce/conta.
- `tests/refactor-financial-characterization.test.js`: 21 casos financeiros.
- `tests/refactor-projection-characterization.test.js`: 8 casos de adaptadores/datas.
- `tests/refactor-category-characterization.test.js`: 3 casos de catalogo mensal.
- `tests/refactor-browser-isolation.test.js`: 1 caso de bloqueio/isolamento do harness.
- `tests/refactor-state-roundtrip.test.js`: 3 casos de persistencia/reinicio.
- `scripts/test-refactor-smoke.js`: 8 cenarios Desktop/Mobile no Chrome isolado.
- `docs/refatoracao/10-etapa-2a-protecao.md`: procedimento e evidencia do lote.

Problema original: faltavam fixtures reutilizaveis com valores esperados fixos,
comparacao dos adaptadores e um smoke de browser independente de backup pessoal.
Solucao: fixtures sinteticas, asserts de contrato e persistencia em outro processo,
mais testes de UI sobre os fontes atuais sem implementar refatoracao antecipada.

Resultado: 352 testes Node aprovados, 8 cenarios browser aprovados, nenhum erro
JavaScript nos cenarios, fixtures do servidor intactas. Capturas sinteticas foram
inspecionadas em `tmp/refactor-2a-smoke/` e nao sao fonte do app.

Riscos restantes: F01-F06 continuam abertos; comportamentos de borda adicionais
estao registrados no documento 10, sem correcao silenciosa. Nao foram alterados
regras financeiras, APIs, banco, dependencias ou design. Sem commit/push/deploy.

Reversao: retirar somente os arquivos de teste/harness deste lote; nenhum dado
real ou formato persistido necessita reversao. Preservar documentos do diagnostico.

### Publicacao autorizada

Apos a conclusao local da etapa 2A, o usuario autorizou subir esta entrega.
O envio inclui apenas testes/harness e documentacao; nao inclui backups,
capturas, dados pessoais, pastas temporarias ou alteracoes funcionais.
Essa autorizacao nao inicia a etapa 2B nem a fase 3.
# Atualizacao da etapa 3A

Atualizacao posterior: 3A publicada no commit a6ef665. A 3B foi implementada
com regras mensais e simbolos no modulo MonthSelectionCatalog, mantendo as
fachadas. Seis novos testes; seletores reais Desktop/Mobile conferidos no smoke.
Sem migracao ou alteracao de dados reais. Detalhes no documento 13.

Helper de fatura extraido para OutflowAmounts, com fachadas e politicas de NaN
preservadas. Matriz de 2.904 combinacoes caracterizada antes/depois; 4 testes
novos. Suite: 379 aprovados; navegador: 8 cenarios aprovados. Nenhuma migracao,
alteracao visual ou publicacao. Detalhes no documento 12.

# Atualizacao da etapa 2B

Primeiro lote F01/F02 implementado localmente: historico privado no bootstrap
autenticado e gravacao por geracoes com publicacao do manifesto ao final.
24 testes novos; suite completa com 375 aprovados e 8 cenarios de navegador.
Sem publicacao ou alteracao de contas reais. Detalhes e limites no documento 11.
