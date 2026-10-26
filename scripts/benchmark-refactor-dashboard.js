'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const { dashboardFixture } = require('../tests/helpers/dashboard-render-fixture');

// Compare the same synthetic inputs and current financial engine; only the render is swapped.
const baselineSource = execFileSync('git', ['show', 'a956385:public/app/dashboard.js'], { encoding: 'utf8' });
const renderStart = baselineSource.indexOf('function renderDashboard()');
const renderEnd = baselineSource.indexOf('\nfunction ', renderStart + 1);
assert.ok(renderStart >= 0 && renderEnd > renderStart, 'Baseline render boundaries not found');
const baseline = baselineSource.slice(renderStart, renderEnd);
function measure(months, source) {
  const f = dashboardFixture(months);
  if (source) vm.runInContext(source, f.ctx);
  f.ctx.renderDashboard();
  f.ctx.renderDashboard();
  const samples = [];
  let calls;
  for (let index = 0; index < 7; index++) {
    const before = f.calls();
    const start = performance.now();
    f.ctx.renderDashboard();
    samples.push(performance.now() - start);
    const count = f.calls() - before;
    if (calls !== undefined) assert.equal(count, calls);
    calls = count;
  }
  samples.sort((a, b) => a - b);
  return { calls, medianMs: Number(samples[3].toFixed(3)), minMs: Number(samples[0].toFixed(3)),
    maxMs: Number(samples.at(-1).toFixed(3)),
    digest: crypto.createHash('sha256').update(JSON.stringify(f.snapshot())).digest('hex') };
}

const rows = [1, 12, 36].map(months => {
  const before = measure(months, baseline);
  const after = measure(months);
  assert.equal(after.calls, months);
  assert.equal(after.digest, before.digest);
  return { months, before, after, identicalOutput: true };
});
console.log(JSON.stringify({ baseline: 'a956385 (render only)', samples: 7, warmups: 2,
  environment: { node: process.version, platform: process.platform, architecture: process.arch }, rows }, null, 2));
