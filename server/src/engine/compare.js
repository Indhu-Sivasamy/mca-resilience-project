const { normalizeMatrix, columnRange, normalizeValue } = require('./normalize');
const { computeScores } = require('./score');
const { spearman, topKOverlap } = require('./stats');

const EXPERT_WEIGHTS = {
  unemployment: 0.25, poverty: 0.25, literacy: 0.15, healthcare: 0.2, housing: 0.15,
  income: 0.25, infant_mortality: 0.25, electricity: 0.15, sanitation: 0.15,
};

const METHODS = [
  { key: 'equal', label: 'Equal weights' },
  { key: 'expert', label: 'Fixed expert weights' },
  { key: 'static', label: 'Static entropy (no trend)' },
  { key: 'adaptive', label: 'Adaptive (entropy + trend)' },
];

function dropColumn(matrix, j) {
  return matrix.map((row) => row.filter((_, k) => k !== j));
}

function fixedWeightScores(matrix, directions, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  const w = weights.map((x) => x / total);
  return normalizeMatrix(matrix, directions).map((row) => row.reduce((s, x, j) => s + w[j] * x, 0));
}

function inRegionOrder(result, regions) {
  const byName = new Map(result.scores.map((r) => [r.region, r.score]));
  return regions.map((name) => byName.get(name));
}

// The outcome indicator is held out of the index. Each method scores period t using data up to t,
// then is judged on how well its ranking matches the real change in the outcome from t to t+1.
function evaluateMethods({ regions, indicators, matrices, periodLabels, outcomeCode = 'poverty', alpha = 1, window = 5, topK = 5 }) {
  const oj = indicators.findIndex((i) => i.code === outcomeCode);
  if (oj < 0) throw new Error('Unknown outcome indicator');
  if (indicators.length < 3) throw new Error('At least 3 indicators are needed (outcome plus two inputs)');
  const n = matrices.length;
  const first = 2;
  if (n - 2 < first) throw new Error('At least 4 complete periods are needed for the comparison');

  const inputs = indicators.filter((_, k) => k !== oj);
  const directions = inputs.map((i) => i.direction);
  const reduced = matrices.map((m) => dropColumn(m, oj));
  const regionNames = regions;
  const expert = inputs.map((i) => EXPERT_WEIGHTS[i.code] || 1);
  const equal = inputs.map(() => 1);

  const range = columnRange(matrices.flat(), oj);
  const outcomeV = matrices.map((m) => m.map((row) => normalizeValue(row[oj], range.min, range.max, indicators[oj].direction)));

  const results = METHODS.map((m) => ({ ...m, perPeriod: [] }));
  for (let t = first; t <= n - 2; t++) {
    const levelNext = outcomeV[t + 1];
    const change = levelNext.map((v, i) => v - outcomeV[t][i]);
    const upTo = reduced.slice(0, t + 1);
    const scoresByMethod = {
      equal: fixedWeightScores(reduced[t], directions, equal),
      expert: fixedWeightScores(reduced[t], directions, expert),
      static: inRegionOrder(computeScores({ regions: regionNames, indicators: inputs, periods: upTo, alpha: 0, window }), regionNames),
      adaptive: inRegionOrder(computeScores({ regions: regionNames, indicators: inputs, periods: upTo, alpha, window }), regionNames),
    };
    for (const r of results) {
      r.perPeriod.push({
        period: periodLabels[t],
        spearman: spearman(scoresByMethod[r.key], change),
        spearmanLevel: spearman(scoresByMethod[r.key], levelNext),
        topK: topKOverlap(scoresByMethod[r.key], change, topK),
        topKLevel: topKOverlap(scoresByMethod[r.key], levelNext, topK),
      });
    }
  }
  for (const r of results) {
    r.meanSpearman = r.perPeriod.reduce((s, p) => s + p.spearman, 0) / r.perPeriod.length;
    r.meanTopK = r.perPeriod.reduce((s, p) => s + p.topK, 0) / r.perPeriod.length;
    r.meanSpearmanLevel = r.perPeriod.reduce((s, p) => s + p.spearmanLevel, 0) / r.perPeriod.length;
    r.meanTopKLevel = r.perPeriod.reduce((s, p) => s + p.topKLevel, 0) / r.perPeriod.length;
  }
  return { outcome: outcomeCode, inputs: inputs.map((i) => i.code), topK, alpha, methods: results };
}

module.exports = { evaluateMethods, METHODS, EXPERT_WEIGHTS };
