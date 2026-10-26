# Etapa 4A - Renderizacao do Dashboard

Data: 26/10/2026. Base: a956385. Sem inicio da 4B.

## Alteracao

O Dashboard Desktop calcula os totais uma vez para cada objeto de mes presente
no periodo e os reaproveita em indicadores, series, resultado e historico rapido.
As categorias de compromissos reutilizam os mesmos totais, somando em centavos.
A base de consumo continua independente para preservar sua regra financeira.
As series mantem compatibilidade com chamadas sem totais previamente calculados.

O mapa de totais existe apenas durante a chamada de renderDashboard; nao e
persistido nem reaproveitado depois de filtros, edicoes ou salvamentos.
renderAll atualiza apenas a pagina ativa. renderDashboard retorna imediatamente
se a pagina estiver oculta ou o MobileV2 estiver habilitado. Os calculos internos
da Home Mobile nao foram reescritos nesta etapa.

## Medicao reproduzivel

Fixture sintetica executando os modulos reais no sandbox de navegador:

| Meses | Chamadas getTotals antes | Depois |
|---|---:|---:|
| 1 | 16 | 1 |
| 12 | 163 | 12 |
| 36 | 403 | 36 |

Os hashes de indicadores, insights, categorias, historico rapido e dados de
graficos foram registrados antes da alteracao e preservados nos tres casos.
Isso mede trabalho repetido eliminado, nao uma porcentagem de velocidade do app.

## Validacao

- 414 testes Node aprovados, incluindo 7 novos testes de renderizacao.
- 12 cenarios Playwright aprovados em contas ficticias isoladas.
- Navegador real confirma uma chamada por mes, mesmos indicadores, nenhuma
  consulta de totais pelo Dashboard oculto e preservacao da instancia do grafico.
- Testes cobrem novo render apos edicao, troca de periodo, conta vazia e selecao
  anual, categorias de consumo/compromissos e persistencia da preferencia de UI.
- Nenhuma migracao, dependencia nova ou alteracao de formato de backup.
- Nenhuma escrita em contas reais; fixture do navegador imutavel e zero erros.

As divergencias de datas documentadas na 3D e demais correcoes funcionais
pendentes nao foram alteradas. Publicacao segue a autorizacao permanente do usuario.
