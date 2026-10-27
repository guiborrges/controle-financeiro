---
name: meufin-responsive-qa
description: Validar responsividade e interacoes Desktop/MobileV2 do MeuFin em janelas reduzidas, navegadores, toque, modais, rolagem e PWA sem confundir emulacao com aparelho real.
---

# QA responsivo do MeuFin

Use `scripts/test-responsive-regressions.js`, `audit-responsive.js` e
`audit-responsive-extra.js` como cenarios existentes, nao como prova universal.
Leia seus requisitos e `tests/helpers/refactor-browser-server.js` antes de iniciar.
Use fixture sintetica, armazenamento temporario e porta livre; encerre os processos.
As bibliotecas Chart/Fuse podem exigir `MEUFIN_SMOKE_VENDOR_DIR`; verifique o
diretorio existente ou obtenha as versoes declaradas no HTML, sem trocar dependencias.

Teste Desktop com mouse e Mobile com toque, incluindo 320/390, 768/900/1024,
1280 e 1920 CSS pixels, alturas reduzidas, paisagem e zoom real. Uma janela
estreita com mouse nao necessariamente ativa Mobile. O breakpoint de toque
deve ser conferido na implementacao atual, inclusive ida/volta sem navegar.

Confira overflow de documento, conteudo recortado, scroll interno, modais,
bottom sheets, seletor de mes, filtros, formularios, fechamento, teclado, foco,
contraste claro/escuro, valores extremos, nomes longos e estados vazios.
Canvas precisa de area util, pixels e valores/tabelas acessiveis corretos.
Nunca reduza fontes ou suprima dados para fazer uma medicao de overflow passar.

Redimensionamento nao pode modificar financeiro, layout salvo ou disparar backup.
Navegacao normal pode normalizar projecoes legadas: compare isolamento de resize
antes de misturar esse fluxo com edicoes ou materializacao de competencias.

Execute `npm run test:responsive` e smoke relevante. Rodadas amplas usam
`MEUFIN_AUDIT_OUTPUT` apontando para uma nova pasta de evidencias, sem sobrescrever
rodadas historicas. Nao execute auditoria com defaults de storage real.
Teste fisico e necessario para afirmar teclado virtual, safe areas, instalacao
PWA, Safari/iPhone ou Android reais. WebKit Windows nao e Safari homologado.
Marque esses casos como nao executados quando houver apenas emulacao.
