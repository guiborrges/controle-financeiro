---
name: meufin-safe-refactor
description: Refatorar MeuFin incrementalmente preservando contratos financeiros, historico, sincronizacao, compatibilidade de backups e comportamento Desktop/Mobile.
---

# Refatoracao segura

Leia `docs/ARCHITECTURE.md`, `docs/PROJECT_CONTEXT.md` e os consumidores reais.
Frontend usa scripts globais, sem SPA/build; variaveis lexicais como data nao
precisam existir em window. Use os acessores/adaptadores ja estabelecidos.

Defina fronteira de arquivos, comportamento preservado e testes antes de editar.
Prefira extracoes pequenas com consumidores identificados; nao reescreva o
framework, esquema de estado ou datas sob o nome de limpeza.
Preserve compatibilidade de backups/legados quando seus testes a caracterizam.
Nao remova fallback seguro sem compreender o caso de recuperacao que atende.

Comandos financeiros compartilhados ficam em modules/mes-atual; UI Mobile nao
deve depender de formulario Desktop escondido. Save confirmado fecha edicao;
pending mantem estado recuperavel, sem reaplicar o comando no retry.
Evento local mobileDataChanged nao e confirmacao remota. Nao reinstale wrappers
de nav/save ao montar cada tela nem multiplique listeners/caches.

Use caracterizacao antes da extracao, regressao depois de cada passo e
`npm test`, `npm run test:smoke`, `npm run check:legacy-paths` no encerramento.
Inclua responsividade quando tocar UI. `check:refactor-risks` e benchmark sao
ferramentas diagnosticas: leia seus requisitos e achados, nao invente PASS.
Ganho de desempenho exige baseline e medicao, nao apenas testes verdes.

Nao apague trabalho anterior do usuario para satisfazer TDD ou reduzir diff.
Nao atualize hashes de markup cegamente; valide numeros e comportamento com
oraculos independentes. Atualize arquitetura/especificacao quando contratos
mudarem e regenere o manual apenas quando fontes cobertas forem alteradas.
