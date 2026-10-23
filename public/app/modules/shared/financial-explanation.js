(function initFinancialExplanation(global) {
  'use strict';
  const financial = typeof module !== 'undefined' && module.exports ? require('./financial-query') : global.FinancialQuery;
  const metrics = new Set(['expenses', 'income', 'fixedIncome', 'projects', 'goals', 'result']);
  function build(months, options = {}) {
    const metric = options.metric || 'expenses';
    const basis = options.basis || 'commitments';
    if (!metrics.has(metric)) throw new TypeError('Indicador desconhecido.');
    if (options.categories && metric !== 'expenses') throw new TypeError('Categoria exige consulta de despesas.');
    const categories = options.categories ? new Set(options.categories) : null;
    const lines = [];
    let totalCents = 0;
    (months || []).forEach(month => {
      const query = options.queryMonth ? options.queryMonth(month, { basis }) : financial.query(month, { ...options, basis });
      let rows;
      let expected;
      if (metric === 'result') {
        rows = [...query.incomeRows, ...query.expenseRows, ...query.goalRows];
        expected = query.resultCents;
      } else if (metric === 'expenses') {
        rows = query.expenseRows.filter(row => !categories || categories.has(row.category));
        expected = categories ? rows.reduce((sum, row) => sum + row.cents, 0) : query.expenseCents;
      } else if (metric === 'goals') {
        rows = query.goalRows;
        expected = query.reserveCents;
      } else {
        rows = query.incomeRows.filter(row => metric === 'income' || row.kind === (metric === 'projects' ? 'project' : 'income'));
        expected = rows.reduce((sum, row) => sum + row.cents, 0);
      }
      totalCents += expected;
      rows.forEach(row => {
        if (!row.cents) return;
        lines.push({ ...row, monthId: month.id, monthName: month.nome || month.id,
          signedCents: metric === 'result' && row.direction !== 'income' ? -row.cents : row.cents });
      });
    });
    const sumCents = lines.reduce((sum, line) => sum + line.signedCents, 0);
    if (sumCents !== totalCents) throw new Error('Os lancamentos nao conferem com o indicador.');
    if (Number.isSafeInteger(options.expectedCents) && options.expectedCents !== totalCents) {
      throw new Error('Os dados mudaram desde a exibicao do indicador. Atualize a tela e tente novamente.');
    }
    return { metric, basis, totalCents, sumCents, lines,
      months: (months || []).map(month => ({ id: month.id, name: month.nome || month.id })),
      categories: categories ? [...categories] : null };
  }
  const api = { build };
  global.FinancialExplanation = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
