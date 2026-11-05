const test = require('node:test');
const assert = require('node:assert');
const { normalizeMatrix } = require('../src/engine/normalize');
const { entropyWeights } = require('../src/engine/entropy');
const { slope, trendScores } = require('../src/engine/trend');
const { computeScores, riskLevel } = require('../src/engine/score');

const directions = ['higher_worse', 'higher_better', 'higher_better'];
const raw = [
  [12, 70, 60],
  [8, 85, 62],
  [15, 60, 55],
  [10, 78, 61],
];
const near = (a, b, tol = 1e-3) => assert.ok(Math.abs(a - b) < tol, `${a} is not close to ${b}`);

test('normalization flips higher_better indicators', () => {
  const X = normalizeMatrix(raw, directions);
  near(X[0][0], 4 / 7);
  near(X[1][0], 0);
  near(X[2][0], 1);
  near(X[0][1], 0.6);
  near(X[2][2], 1);
  near(X[1][2], 0);
});

test('constant column normalizes to zero without NaN', () => {
  const X = normalizeMatrix([[5, 1], [5, 2]], ['higher_worse', 'higher_worse']);
  assert.strictEqual(X[0][0], 0);
  assert.ok(!Number.isNaN(X[1][0]));
});

test('entropy weights sum to 1 and survive zeros', () => {
  const w = entropyWeights(normalizeMatrix(raw, directions));
  near(w.reduce((a, b) => a + b, 0), 1, 1e-9);
  w.forEach((x) => assert.ok(x > 0 && !Number.isNaN(x)));
});

test('slope of a rising series is positive', () => {
  near(slope([1, 2, 3, 4]), 1, 1e-9);
  near(slope([4, 3, 2, 1]), -1, 1e-9);
});

test('trend gives 1 to the fastest worsening indicator and 0 to improving ones', () => {
  const periods = [
    [[10, 80], [20, 60]],
    [[12, 82], [22, 58]],
    [[16, 84], [26, 56]],
  ];
  const s = trendScores(periods, ['higher_worse', 'higher_better']);
  near(s[0], 1, 1e-9);
  near(s[1], 0, 1e-9);
});

test('final weights sum to 1 and the worsening factor gains weight', () => {
  const regions = ['A', 'B', 'C', 'D'];
  const indicators = [
    { code: 'unemployment', direction: 'higher_worse' },
    { code: 'literacy', direction: 'higher_better' },
    { code: 'healthcare', direction: 'higher_better' },
  ];
  const p1 = raw;
  const p2 = raw.map((r) => [r[0] + 1, r[1], r[2] - 1]);
  const p3 = raw.map((r) => [r[0] + 2, r[1], r[2] - 3]);
  const withTrend = computeScores({ regions, indicators, periods: [p1, p2, p3], alpha: 1 });
  const noTrend = computeScores({ regions, indicators, periods: [p1, p2, p3], alpha: 0 });
  near(withTrend.weights.reduce((a, w) => a + w.final, 0), 1, 1e-9);
  const h1 = withTrend.weights.find((w) => w.code === 'healthcare');
  const h0 = noTrend.weights.find((w) => w.code === 'healthcare');
  assert.ok(h1.final > h0.final);
});

test('scores are ranked, levelled and have a top driver', () => {
  const regions = ['A', 'B', 'C', 'D'];
  const indicators = [
    { code: 'unemployment', direction: 'higher_worse' },
    { code: 'literacy', direction: 'higher_better' },
    { code: 'healthcare', direction: 'higher_better' },
  ];
  const out = computeScores({ regions, indicators, periods: [raw], alpha: 0 });
  assert.strictEqual(out.scores[0].region, 'C');
  assert.strictEqual(out.scores[0].rank, 1);
  assert.strictEqual(out.scores[3].region, 'B');
  assert.ok(out.scores[0].topDriver);
});

test('risk level thresholds', () => {
  assert.strictEqual(riskLevel(0.1), 'Low');
  assert.strictEqual(riskLevel(0.3), 'Medium');
  assert.strictEqual(riskLevel(0.6), 'High');
  assert.strictEqual(riskLevel(0.9), 'Critical');
});
