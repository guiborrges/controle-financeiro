# Mapa do Produto — Controle Financeiro

Atualizado em 2026-06-16.

Este mapa organiza o produto pelo que ele é hoje, pelo que ele está tentando se tornar e pelos limites que não devem ser rompidos.

## 1. Essência do produto

Controle Financeiro é um sistema de finanças pessoais com dois eixos principais:

- operação mensal
- visão patrimonial

Ele não depende de automação bancária total para ser útil. O valor principal está em:

- organizar a vida financeira com clareza
- transformar lançamentos em leitura prática do mês
- conectar rotina, planejamento e patrimônio

## 2. Posicionamento atual

O produto hoje se posiciona melhor como:

- controle financeiro pessoal guiado por planejamento
- sistema de patrimônio com operação mensal integrada
- ferramenta de uso recorrente para poucas pessoas por conta

O produto não deve derivar para:

- ERP genérico
- super app bancário
- agregador 100% automático onde o usuário perde controle da revisão

## 3. Pilares do produto

## 3.1 Dashboard

Pergunta que responde:

- como estou no geral?

Função:

- resumir o período
- apresentar leitura rápida de renda, despesas, resultado e composição
- apoiar exploração visual

Não deve virar:

- tela operacional de lançamentos
- substituto de Mês Atual

## 3.2 Mês Atual / Controle dos Meses

Pergunta que responde:

- como está este mês e o que ainda preciso ajustar?

Função:

- registrar lançamentos
- editar renda e saídas
- acompanhar planejamento
- acompanhar gastos por categoria
- acompanhar metas
- revisar Internet Banking

É o centro operacional do sistema.

## 3.3 Patrimônio

Pergunta que responde:

- onde meu dinheiro está e como ele evolui?

Função:

- contas patrimoniais
- saldo total
- movimentações
- aporte, retirada, transferência
- atualização direta de saldo com cálculo automático da diferença

Não deve virar:

- segunda tela de lançamentos do mês
- tabela crua sem leitura patrimonial

## 3.4 Histórico

Pergunta que responde:

- como eu evoluí ao longo do tempo?

Função:

- comparar meses
- ver tendência
- analisar períodos longos

Não deve virar:

- dashboard duplicado
- tela operacional do mês corrente

## 3.5 Internet Banking

Pergunta que responde:

- o que chegou do banco/cartão e ainda precisa da minha decisão?

Função:

- staging/revisão manual
- vincular conta/cartão
- sugerir categoria/tag
- importar só o que o usuário aprovar

Não deve virar:

- importação automática sem revisão
- segunda base financeira paralela ao sistema principal

## 4. Fluxos principais do usuário

## 4.1 Fluxo mensal

Fluxo dominante:

1. abrir o mês
2. revisar renda
3. revisar planejamento
4. revisar gastos
5. revisar Internet Banking
6. ajustar patrimônio quando necessário

## 4.2 Fluxo patrimonial

Fluxo dominante:

1. abrir patrimônio
2. ver saldo consolidado
3. movimentar conta
4. atualizar saldo quando o valor real mudar
5. deixar o sistema transformar a diferença em aporte/retirada

## 4.3 Fluxo mobile

No mobile, a experiência deve preservar o mesmo domínio do desktop, com shell mais rápida e adaptada.

Meta:

- mesma verdade financeira
- menos densidade visual
- zero divergência de totais

## 5. Fontes de verdade do produto

Fontes que precisam ser únicas:

- lançamentos do mês
- totais do dashboard
- totais de patrimônio
- itens pendentes do Internet Banking
- categorias visíveis no mês

PC e mobile não devem manter regras paralelas para essas fontes.

## 6. O que é estrutural e não pode regredir

- multiusuário real
- backups restauráveis
- revisão manual do Internet Banking
- não duplicação de lançamentos
- não duplicação entre cartão e fatura
- categoria não pode virar meio de pagamento
- mobile e desktop precisam bater nos mesmos totais

## 7. Áreas complementares

Áreas que apoiam o produto principal:

- widget iPhone
- busca universal
- preferências
- backups
- Fechamentos ESO
- trilha PDF/Oracle AI

Essas áreas são importantes, mas não podem quebrar os quatro pilares centrais.

## 8. Prioridades atuais de evolução

Direção que mais faz sentido hoje:

1. consolidar a mesma base de dados entre PC e mobile
2. tornar o Internet Banking previsível e confiável
3. reduzir lentidão de bootstrap e leitura de estado
4. fortalecer patrimônio
5. deixar o mobile-v2 com paridade real de uso

## 9. Coisas que parecem boas, mas precisam de cuidado

- automação bancária total
- filtros muito sofisticados sem fonte unificada
- novas visualizações que recalculam diferente do desktop
- reintrodução da separação antiga de gasto/despesa como domínio paralelo
- múltiplos sistemas de categoria concorrentes

## 10. Norte de produto

Se uma nova funcionalidade não melhorar pelo menos um desses pontos, ela provavelmente é secundária:

- clareza do mês
- controle do patrimônio
- confiabilidade do dado
- velocidade para operar
- confiança de que PC e mobile mostram a mesma verdade
