const test = require('node:test');
const assert = require('node:assert/strict');

function loadReview() {
  delete require.cache[require.resolve('../public/app/modules/shared/dates.js')];
  delete require.cache[require.resolve('../public/app/modules/import-bills-review.js')];
  global.data = [{ id: 'abril_2026', nome: 'ABRIL 2026' }];
  global.currentMonthId = 'abril_2026';
  global.BillImportUtils = { normalizeText: value => String(value || '').trim() };
  global.BillImportSchema = {
    getMonthIdFromDate(value) {
      return String(value || '').includes('/05/') ? 'maio_2026' : 'abril_2026';
    }
  };
  require('../public/app/modules/shared/dates.js');
  require('../public/app/modules/import-bills-review.js');
  return global.BillImportReview;
}

test('edicao manual de data na revisao por fatura resolve dia simples para mes seguinte', () => {
  const review = loadReview();
  const date = review._test.resolveManualReviewDate('10', { monthId: 'abril_2026' });
  assert.equal(date, '10/05/26');
});

test('edicao manual de data na revisao por fatura respeita data completa', () => {
  const review = loadReview();
  const date = review._test.resolveManualReviewDate('10/04/2026', { monthId: 'abril_2026' });
  assert.equal(date, '10/04/26');
});
