# M01, M09 e M12

## Publicacao aprovada em 23/10/2026

O M01 substitui o calculo anterior de totais por FinancialQuery, compartilhado
entre core, planejamento mensal, dashboard, historico, mobile e widget.
Nao existe seletor de formato antigo/novo nem adaptador de simulacao no online.
Os dados financeiros e backups nao sao apagados nem reimportados nesta entrega.

## Criterios financeiros

- Compromissos: despesas selecionadas mais faturas, sem repetir compras do cartao.
- Caixa: somente valores pagos ou recebidos explicitamente.
- Consumo: compras por categoria, sem adicionar as faturas novamente.
- Despesas compartilhadas: somente a parcela do titular, pelo resolvedor existente.
- Metas financeiras: reservas separadas; limites por categoria nao sao despesas adicionais.
- Exclusoes: indicadores respeitam as escolhas de inclusao; pago nao reativa renda excluida.
- Somatorios e agrupamentos usam centavos inteiros.

O dashboard identifica compromissos pagos e pendentes. Desktop e mobile permitem
escolher Compromissos ou Consumo no grafico de categorias, sem confundir as bases.
O detalhamento mobile usa as mesmas linhas que formam cada grupo.
O dashboard considera meses iniciados; meses futuros continuam acessiveis na visao mensal.
Renda fixa, renda extra e acesso ao ESO conservam as regras de perfil de producao.

## M09

Categorias e tags usam os contratos existentes por mes. Revisao de fatura nao
oferece sugestoes ocultas e valida a categoria e a tag antes de liberar importacao.
Tags canonizam Unicode sem remover acentos. Edicao mobile inclui seletor de tags
e preserva o valor historico durante a edicao. Consultas historicas podem incluir
opcoes ocultas usando purpose=history. Ocultar nao apaga nem arquiva lancamentos.
Renomear categorias ou tags atualiza tambem as regras futuras do calendario.

## M12

Recorrencias abre uma consulta somente leitura em desktop e mobile: origem,
vigencia, cartao, proximas tres ocorrencias em ate 36 meses e excecoes locais.
Usa o motor existente e copias dos meses carregados; nao salva nem cria meses.

## Verificacao

- Suite automatizada completa e testes de contrato browser/mobile/widget.
- Faturas manuais zeradas, previsoes, compartilhados, transferencias e exclusoes.
- Comparacao do build final com a proposta aprovada: 88 meses e seis indicadores
  por mes, totalizando 528 valores, sem diferencas em centavos.
- Teste local com copia somente leitura: cinco indicadores de renda/resultado,
  81 registros ESO, seletores de categorias desktop/mobile e detalhes de faturas.
- Inspetor aberto e fechado com snapshot financeiro identico antes e depois.
- Nenhum dado pessoal de teste ou backup integra o commit.

## Limites

Nao houve transacao bancaria real, chamada externa de IA ou mudanca de permissoes
da conta real. A validacao do widget e automatizada, nao em aparelho fisico.
Reembolsos e conciliacao seguem os contratos existentes e nao sao implementados pelo M01.
