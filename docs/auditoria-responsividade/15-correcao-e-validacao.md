# Correcoes autorizadas da auditoria responsiva

O usuario autorizou corrigir os achados apos receber o diagnostico. Este
documento complementa, sem reescrever, as evidencias anteriores.

## Implementacao

| Achado | Correcao |
|---|---|
| R01 | Grid responsivo pela largura do conteiner; observador de resize; ajuste nao persiste nem substitui layout amplo salvo. Fallback sempre cabe. |
| R02 | Bootstrap acompanha entrada no breakpoint apos carga inicial ampla; loader unico; largura de layout usa clientWidth, sem depender de conteudo transbordado. |
| R03 | Minimo do grid de insights limitado a largura disponivel. |
| R04 | Legenda da pizza utiliza token do tema em vez de cor escura fixa. |
| R05 | Eixo Mobile mede texto e abrevia milhares/milhoes/bilhoes/trilhoes. Rotulos de meses sao espacados. |
| R06 | Tabelas equivalentes nos tres graficos Desktop e nos dois Mobile, com caption, cabecalhos e associacao ao canvas; abertura por teclado. |
| R07 | Bitmap Canvas Mobile dimensionado pelo DPR, limitado a 3, com transformacao reiniciada a cada desenho. |
| A01 | Rascunho antigo apenas de preferencias pode ser rebaseado; dados financeiros antigos nunca substituem o servidor. Conflitos financeiros reais continuam bloqueados. Remember nao gera sessao em autosave de pagina antiga. |

## Causa isolada de A01

A remocao/restauracao do cookie seguida de descarregamento da pagina antiga
produzia rascunho protegido de preferencias. Uma nova revisao do servidor
fazia esse rascunho ser tratado como conflito financeiro, bloqueando novos
lancamentos. A sequencia foi reproduzida antes da correcao e repetida com
perfil, renda, gasto, backup e restore depois da correcao.

O ajuste nao relaxa o controle de revisao para dados financeiros. Testes
especificos garantem que um rascunho misto (preferencias e finData diferente)
permanece bloqueado sem aplicacao parcial. Rascunho com dados identicos ao
servidor nao precisa bloquear a conta.

## Evidencias de validacao

As novas medicoes ficam em `validacao-correcoes/`, separadas dos prints do
diagnostico. Matriz: 420 medicoes em Chrome, Edge, Firefox e WebKit, com zero
overflow horizontal e zero pageErrors. Rodada complementar: resize sem nav,
cinco fatores de zoom real, Mobile/temas/estados extremos. Os cinco fatores
de zoom ficaram sem overflow.

Servidor local real, duas contas ficticias: 21 checks da sequencia com
remember antes das operacoes financeiras passaram. Nao houve uso de conta
pessoal nem gravacao de dados reais durante esses testes.

Validacao final antes da publicacao:

- `npm test`: 501 testes passaram.
- `npm run test:smoke`: 17 cenarios passaram, zero pageErrors.
- `npm run test:responsive`: sete cenarios passaram, zero pageErrors.
- Auditoria funcional com `MEUFIN_AUDIT_REMEMBER_FIRST=1`: 21 checks passaram.
- Matriz de quatro navegadores: 420 medicoes sem overflow ou pageErrors.
- Resize sem nav: 32 transicoes; zoom real: cinco fatores sem overflow.
- `npm run docs:verify`: integridade do manual reconstruivel aprovada.
- `npm run check:legacy-paths`: aprovado.
- `npm audit --audit-level=critical`: nao bloqueou publicacao; ainda registra
  um alerta alto preexistente de Nodemailer. Nao foi feita atualizacao major
  de dependencia incidentalmente nesta correcao de responsividade.

Foi adicionado ainda um teste do salto direto de 1920 para 900 px com dados
extremos. No evento inicial, innerWidth podia refletir conteudo de 1154 px
enquanto clientWidth ja era 900 px. Usar a largura real de layout evita que
esse transbordamento temporario impeça o carregamento Mobile.

Continuam fora da certificacao: aparelhos fisicos, teclado real de iOS/Android,
leitor de tela e PWA instalado. As melhorias nao reativam o service worker
desabilitado nem alteram os calculos ou o modelo financeiro.
