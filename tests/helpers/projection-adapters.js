const { monthAt, browserSandbox, loadBrowser } = require('./refactor-fixtures');

function browserProjectionAdapter() {
  const ctx = browserSandbox();
  loadBrowser(ctx, ['modules/mes-atual/constants.js', 'modules/mes-atual/income-dates.js',
    'modules/mes-atual/income-recurrence.js', 'modules/mes-atual/outflow-expense-date.js',
    'modules/continuous-calendar.js', 'modules/continuous-calendar-app.js', 'mes-atual.js']);
  ctx.buildBlankMonth = date => monthAt(date.getFullYear(), date.getMonth());
  return ctx;
}

module.exports = { browserProjectionAdapter };
