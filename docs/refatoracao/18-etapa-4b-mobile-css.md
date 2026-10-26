# Etapa 4B - Eventos Mobile e CSS por dominio

Data: 26/10/2026. Base: 1cd7e18. Sem inicio da etapa 5.

## Eventos e ciclo de vida

O modulo AppEvents oferece emissao explicita com CustomEvent no document.
save emite mobileDataChanged depois de atualizar o snapshot local. Preserva o
retorno undefined normal e a mesma Promise de flush, inclusive quando pendente.
Esse evento significa mudanca local, nao confirmacao de persistencia no servidor.
Uma falha sincrona de armazenamento nao emite evento. nav emite app:navigated
ao terminar, sem ser substituida pelo Mobile.

MobileV2 e MobileV2Enhancements protegem init contra chamadas repetidas.
MobileV2 tem um listener de atualizacao visual por evento; Enhancements tem
um listener de persistencia do cache de sessao/widget. A invalidacao mensal
existente permanece instalada antes da atualizacao visual. A API publica
notifyDataChanged continua disponivel para consumidores existentes.

Foram removidos o wrapper de save, o wrapper de nav, os avisos redundantes de
mutacoes no adaptador e o timer que tentava reaplicar wrappers a cada segundo.
Pull refresh usa o evento existente sem executar uma segunda atualizacao direta.
O cache hidratado nao e regravado apenas pela notificacao de session-cache.

## Limites da substituicao gradual

Os adaptadores de feedback haptico continuam envolvendo funcoes legadas, mas
sao instalados uma vez e nao notificam mudancas de dados. O wrapper de fetch
para loading continua. Outros consumidores Mobile ainda podem solicitar refresh
diretamente; nao se afirma uma unica renderizacao para todo comando existente.
Nao se mudou a politica de cache por usuario, validade, revisao ou restauracao.
Nao se alteraram calculos financeiros, formato de backup, HTTP ou persistencia.

## CSS

mobile-v2.css passa a importar seis partes, nesta ordem:
onboarding, feedback, navigation, forms-and-charts, shell e screens.
As partes seguem fronteiras de blocos completos do arquivo anterior, sem
reordenar regras ou especificidade; screens conserva os overrides finais de
varios dominios para nao mudar a cascata. styles.css e dark-mode.css permanecem.
Nao e uma reorganizacao visual nem um bundler; ha seis requisicoes CSS adicionais.
URLs de recursos existentes sao absolutas e foram preservadas.

O teste recompone o CSS e exige SHA-256 identico ao registrado antes da extracao:
b307c2325aafba7281f029dbbc83b37d322446da5d5d8d656a59b5b6d124f286.

## Evidencias

- 421 testes Node aprovados, sete novos testes de eventos/contratos/CSS.
- 14 cenarios no Chrome isolado, Desktop e emulacao Pixel 7.
- Tres chamadas adicionais de init preservam as referencias de save/nav.
- Um save real da fixture emite um evento, renderiza a Home uma vez e grava
  o cache de sessao uma vez com o ID do usuario correto e a renda modificada.
- Uma edicao in-place de renda aparece no resumo mensal, mesmo sem mudar a
  quantidade de registros, comprovando a invalidacao do cache de metricas.
- Os seis imports CSS possuem regras carregadas no navegador.
- Captura Mobile sintetica antes/depois identica byte a byte: SHA-256
  6048f656f3be0b02008bf1ca5d15b492b8d7c633b1ce61783327f8866b055bd5.
- Totais e filtros anteriores continuam cobertos. Zero erros de pagina,
  fixture imutavel e zero escritas financeiras no servidor do teste.

Nao houve acesso a contas reais. Nenhum perfil de memoria ou dispositivo fisico
foi medido nesta etapa. Publicacao conforme autorizacao permanente do usuario.
