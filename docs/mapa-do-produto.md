# Mapa do Produto

## Propósito
Organizar a evolução do Controle Financeiro com clareza sobre:
- o que define o produto
- o que apoia o produto
- o que protege o produto

Este mapa existe para reduzir expansão desnecessária de funcionalidades e aumentar consistência de produto.

## Posicionamento
O produto não deve competir como "super app financeiro" com foco em integração bancária.

O posicionamento ideal hoje é:
- controle manual inteligente
- planejamento mensal conectado ao patrimônio
- clareza patrimonial pessoal

## Os 4 pilares do produto

### 1. Visão geral
Página: `Dashboard`

Pergunta principal:
- como estou no geral?

Função:
- resumir o período
- mostrar indicadores principais
- aprofundar em gráficos e widgets

Não deve virar:
- tela de operação mensal
- tela de lançamentos

### 2. Operação do mês
Página: `Mês Atual`

Pergunta principal:
- como está este mês?

Função:
- registrar
- editar
- acompanhar renda, despesas, metas e gastos diários

Não deve virar:
- dashboard secundário
- área de análise histórica longa

### 3. Patrimônio acumulado
Página: `Patrimônio`

Pergunta principal:
- onde está meu dinheiro guardado?

Função:
- mostrar contas patrimoniais
- acompanhar saldo por movimentações
- registrar aporte, retirada e transferência

Não deve virar:
- segunda área de lançamentos mensais
- mistura com operação do mês

### 4. Evolução no tempo
Página: `Histórico`

Pergunta principal:
- como eu evoluí?

Função:
- comparar meses
- identificar tendência
- apoiar análise longitudinal

Não deve virar:
- dashboard concorrente
- página principal de operação

## Classificação das funcionalidades

### Núcleo
Funcionalidades que definem o produto:
- Dashboard
- Mês Atual
- Despesas
- Gastos diários
- Metas financeiras
- Patrimônio
- Histórico

Regra:
- devem ficar mais visíveis
- devem ser mais simples
- devem receber prioridade de acabamento

### Avançadas
Funcionalidades que apoiam o uso, mas não definem o produto sozinhas:
- filtros detalhados
- ordenações
- personalização de títulos
- mudança de ordem de blocos
- preferências visuais
- gráficos secundários
- atalhos de repetição

Regra:
- continuam existindo
- mas aparecem em segunda camada
- não devem disputar atenção com o núcleo

### Administrativas e de proteção
Funcionalidades que protegem o produto e aumentam confiança:
- backup
- restauração
- integridade
- exportação
- importação
- área do desenvolvedor

Regra:
- não devem parecer parte do uso cotidiano principal
- devem ficar disponíveis, mas em camada mais reservada

## O que deve aparecer primeiro

### Dashboard
- indicadores principais
- widgets
- filtros recolhidos

### Mês Atual
- leitura rápida do mês
- blocos operacionais
- ações principais por bloco

### Patrimônio
- patrimônio total
- variação do mês
- contas
- movimentações da conta escolhida

### Histórico
- período selecionado
- tabela e gráfico
- comparações do período

## O que não deve disputar atenção na primeira camada
- filtros avançados
- preferências visuais
- exportação e importação
- ações raras
- detalhes administrativos

## Critério para aceitar novas funcionalidades
Uma nova funcionalidade só deve entrar se fizer pelo menos um destes papéis:
- acelerar o uso
- esclarecer a leitura financeira
- reforçar o diferencial entre metas e patrimônio
- proteger o usuário e os dados

Se não fizer isso, não deve ter prioridade.

## Direção atual recomendada
O produto deve entrar numa fase de refino:
- menos expansão por feature
- mais clareza
- mais consistência
- mais previsibilidade
- mais qualidade percebida

## Próximas prioridades
1. Simplificar ainda mais o Patrimônio
2. Refinar o Mês Atual
3. Consolidar design system e consistência
4. Melhorar fluidez no uso rápido
5. Fortalecer compatibilidade e regressão
