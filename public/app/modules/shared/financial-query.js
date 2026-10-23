(function initFinancialQuery(global) {
  'use strict';
  const amounts = typeof module !== 'undefined' && module.exports ? require('./outflow-amounts') : global.OutflowAmounts;
  const cents = value => {
    const number = Number(value || 0);
    if (!Number.isFinite(number)) throw new TypeError('Valor financeiro invalido.');
    const result = Math.round((number + Number.EPSILON) * 100);
    if (!Number.isSafeInteger(result)) throw new RangeError('Valor financeiro fora do limite.');
    return result;
  };
  const clean = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
  const nonCategories = new Set(['PIX', 'DEBITO', 'DINHEIRO', 'CARTAO', 'CARTAO DE CREDITO', 'CREDITO', 'DESPESA', 'DESPESAS', 'GASTO', 'GASTOS', 'DESPESA FIXA', 'DESPESAS FIXAS', 'DESPESA VARIAVEL', 'DESPESAS VARIAVEIS']);
  function billAmount(bill) {
    const raw = Math.max(0, Number(bill?.amount || 0));
    return bill?.manualAmountSet === true || (String(bill?.source || '').toLowerCase() !== 'forecast' && raw > 0)
      ? raw : Math.max(0, Number(bill?.forecastAmount || 0));
  }
  function buildFacts(month, options = {}) {
    const result = [];
    const categoryName = value => {
      const name = options.resolveCategory ? options.resolveCategory(value || 'OUTROS') : clean(value || 'OUTROS');
      return nonCategories.has(clean(name)) ? 'OUTROS' : name || 'OUTROS';
    };
    const selected = item => {
      const index = (month.despesas || []).findIndex(row => item.id && row.id === item.id);
      return index < 0 || (month.despesas[index].entraNaSomatoriaPrincipal !== false && (!options.isSelected || options.isSelected(index)));
    };
    const push = (kind, index, item, direction, amount, category, included, extra = {}) => result.push({
      id: `${month.id || ''}:${kind}:${item.id || index}`, kind, direction,
      amount, category: categoryName(category), included,
      paid: item.paid === true || item.pago === true,
      description: item.description || item.fonte || item.descricao || item.nome || kind,
      date: item.date || item.dataRecebimento || '', sourceId: String(item.id || ''), tag: String(item.tag || ''), ...extra
    });
    const outflows = month.outflows || [];
    outflows.forEach((item, index) => {
      if (!item || !['expense', 'fixed', 'spend'].includes(String(item.type || 'spend').toLowerCase())) return;
      if (item.outputKind === 'card') {
        push('purchase', index, item, 'expense', amounts.getEffectiveOutflowAmount(item), item.category,
          item.includeInTotals !== false, { consumptionOnly: true });
        return;
      }
      const fixed = item.type === 'expense' || item.type === 'fixed' || item.expenseRecurring === true || item.showInMonthPlanning === true || item.includeInMonthPlanning === true;
      push(fixed ? 'fixed' : 'spend', index, item, 'expense', amounts.getEffectiveOutflowAmount(item), item.category,
        item.countsInPrimaryTotals !== false && item.includeInTotals !== false && selected(item));
    });
    const bills = [...(month.cardBills || [])];
    (month.outflowCards || []).forEach(card => {
      if (bills.some(bill => bill.cardId === card.id)) return;
      const forecast = outflows.filter(item => item.outputKind === 'card' && item.outputRef === card.id && item.recurringSpend === true)
        .reduce((sum, item) => sum + cents(amounts.getEffectiveOutflowAmount(item)), 0) / 100;
      bills.push({ id: `forecast_${card.id}`, cardId: card.id, source: 'forecast', forecastAmount: forecast, paid: false });
    });
    bills.forEach((bill, index) => {
      const card = (month.outflowCards || []).find(item => item.id === bill.cardId);
      push('bill', index, bill, 'expense', billAmount(bill), 'FATURAS DE CARTAO',
        bill.countsInPrimaryTotals !== false && bill.includeInTotals !== false && selected(bill),
        { description: `Fatura ${card?.name || 'Cartao'}`, commitmentOnly: true });
    });
    // Old backups are read through the same facts contract, without saving a migration.
    if (!outflows.length) {
      (month.despesas || []).forEach((item, index) => {
        if (bills.some(bill => item.id && bill.id === item.id)) return;
        push('fixed', index, item, 'expense', item.valor || 0, item.categoria,
          item.entraNaSomatoriaPrincipal !== false && (!options.isSelected || options.isSelected(index)));
      });
      (month.gastosVar || []).forEach((item, index) => push('spend', index, item, 'expense', item.valor || 0, item.categoria, item.incluirNoTotal !== false));
    }
    (month.renda || []).forEach((item, index) => push('income', index, item, 'income', item.valor || 0, 'RENDA FIXA', item.includeInTotals !== false));
    (month.projetos || []).forEach((item, index) => push('project', index, item, 'income', item.valor || 0, 'ENTRADAS EXTRAS', item.includeInTotals !== false));
    (month.financialGoals || []).forEach((item, index) => push('goal', index, item, 'reserve', item.valor || 0, 'METAS FINANCEIRAS', item.includeInTotals !== false));
    return result;
  }
  function query(month, options = {}) {
    const basis = options.basis || 'commitments';
    if (!['commitments', 'cash', 'consumption'].includes(basis)) throw new TypeError('Criterio financeiro invalido.');
    const rows = buildFacts(month, options).filter(row => row.included !== false
      && (basis === 'consumption' ? !row.commitmentOnly : !row.consumptionOnly)
      && (basis !== 'cash' || row.paid)).map(row => ({ ...row, cents: cents(row.amount) }));
    const incomeRows = rows.filter(row => row.direction === 'income');
    const expenseRows = rows.filter(row => row.direction === 'expense');
    const goalRows = options.includeGoals === false ? [] : rows.filter(row => row.direction === 'reserve');
    const sum = list => list.reduce((total, row) => total + row.cents, 0);
    const incomeCents = sum(incomeRows);
    const expenseCents = sum(expenseRows);
    const reserveCents = sum(goalRows);
    const categories = new Map();
    expenseRows.forEach(row => categories.set(row.category, (categories.get(row.category) || 0) + row.cents));
    return { version: 1, basis, incomeRows, expenseRows, goalRows, incomeCents, expenseCents, reserveCents,
      resultCents: incomeCents - expenseCents - reserveCents,
      pendingExpenseCents: sum(expenseRows.filter(row => !row.paid)),
      categories: Array.from(categories, ([category, amountCents]) => ({ category, amountCents })) };
  }
  function totals(month, options = {}) {
    const result = query(month, options);
    const sum = (list, predicate) => list.filter(predicate).reduce((value, row) => value + row.cents, 0) / 100;
    const fixed = sum(result.expenseRows, row => row.kind === 'fixed' || row.kind === 'bill');
    return {
      totalFixas: fixed, totalVar: sum(result.expenseRows, row => row.kind === 'spend'),
      totalGastos: result.expenseCents / 100, rendaTotal: result.incomeCents / 100,
      rendaFixa: sum(result.incomeRows, row => row.kind === 'income'), totalProj: sum(result.incomeRows, row => row.kind === 'project'),
      totalFinancialGoals: result.reserveCents / 100, resultadoMes: result.resultCents / 100,
      availableForVariableSpending: result.incomeCents / 100 - fixed - result.reserveCents / 100,
      catTotals: Object.fromEntries(result.categories.map(row => [row.category, row.amountCents / 100])), dinheiroVal: 0
    };
  }
  const api = { cents, billAmount, buildFacts, query, totals };
  global.FinancialQuery = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
