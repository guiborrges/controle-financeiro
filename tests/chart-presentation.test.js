const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const presentation = require('../public/app/modules/shared/chart-presentation');

test('chart table escapes every user label and exposes full financial values', () => {
  const html = presentation.table('data', 'Period', ['Month', 'Income'], [['<script>bad</script>', 'R$ 1.000,00']]);
  assert.ok(!html.includes('<script>'));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /<caption>Period<\/caption>/);
  assert.match(html, /scope="col"/);
  assert.ok(html.includes('R$ 1.000,00'));
});

test('chart axis abbreviates extreme and negative values without dropping cents near zero', () => {
  assert.equal(presentation.axis(1e9), '1B');
  assert.equal(presentation.axis(-1.5e12), '-1,5T');
  assert.equal(presentation.axis(0.01), '0,01');
  assert.equal(presentation.axis(0), '0');
});

test('canvas backing store follows capped DPR and resets transform on each draw', () => {
  const transforms = [];
  const ctx = { setTransform:(...args) => transforms.push(args) };
  const canvas = { getContext:() => ctx };
  const sandbox = { devicePixelRatio:2 };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(require.resolve('../public/app/modules/shared/chart-presentation'),'utf8'), sandbox);
  sandbox.ChartPresentation.canvas(canvas, 286, 170);
  sandbox.ChartPresentation.canvas(canvas, 286, 170);
  assert.deepEqual([canvas.width, canvas.height], [572, 340]);
  assert.deepEqual(transforms, [[2,0,0,2,0,0],[2,0,0,2,0,0]]);
  sandbox.devicePixelRatio = 4;
  sandbox.ChartPresentation.canvas(canvas, 100, 100);
  assert.equal(canvas.width, 300);
});
