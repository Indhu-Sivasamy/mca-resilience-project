const test = require('node:test');
const assert = require('node:assert');
const { spearman, topKOverlap, averageRanks } = require('../src/engine/stats');
const { evaluateMethods } = require('../src/engine/compare');
const { generateSeed, toMatrices } = require('../src/db/seedData');

test('spearman of identical, reversed and tied series', () => {
  assert.ok(Math.abs(spearman([1, 2, 3, 4], [10, 20, 30, 40]) - 1) < 1e-9);
  assert.ok(Math.abs(spearman([1, 2, 3, 4], [4, 3, 2, 1]) + 1) < 1e-9);
  assert.deepStrictEqual(averageRanks([5, 5, 1]), [2.5, 2.5, 1]);
  assert.strictEqual(spearman([1, 1, 1], [1, 2, 3]), 0);
});

test('top-k overlap', () => {
  assert.strictEqual(topKOverlap([9, 8, 1, 0], [9, 8, 1, 0], 2), 1);
  assert.strictEqual(topKOverlap([9, 8, 1, 0], [0, 1, 8, 9], 2), 0);
});

test('comparison runs on the seed data and returns four methods', () => {
  const s = generateSeed();
  const out = evaluateMethods({
    regions: s.regions.map((r) => r.name),
    indicators: s.indicators,
    matrices: toMatrices(s),
    periodLabels: s.periods,
    outcomeCode: 'poverty',
  });
  assert.strictEqual(out.methods.length, 4);
  assert.strictEqual(out.methods[0].perPeriod.length, 3);
  out.methods.forEach((m) => assert.ok(Number.isFinite(m.meanSpearman) && Number.isFinite(m.meanSpearmanLevel) && Number.isFinite(m.meanTopKLevel)));
  assert.ok(!out.inputs.includes('poverty'));
});
