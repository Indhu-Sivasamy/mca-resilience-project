const { normalizeMatrix } = require('./normalize');
const { entropyWeights } = require('./entropy');
const { trendScores } = require('./trend');

const LEVELS = [
  { max: 0.25, name: 'Low' },
  { max: 0.5, name: 'Medium' },
  { max: 0.75, name: 'High' },
  { max: Infinity, name: 'Critical' },
];

function riskLevel(score) {
  return LEVELS.find((l) => score < l.max).name;
}

function renormalize(w) {
  const total = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / total);
}

// periods: oldest to newest; each is a matrix [region][indicator]. The last one is scored.
// options: { alpha (trend strength, default 1), window (periods used for trend, default 5) }
function computeScores({ regions, indicators, periods, alpha = 1, window = 5 }) {
  const directions = indicators.map((i) => i.direction);
  const latest = periods[periods.length - 1];
  const X = normalizeMatrix(latest, directions);

  const entropyW = entropyWeights(X);
  const recent = periods.slice(-window);
  const trendS = recent.length >= 3 ? trendScores(recent, directions) : directions.map(() => 0);
  const finalW = renormalize(entropyW.map((w, j) => w * (1 + alpha * trendS[j])));

  const rows = X.map((row, i) => {
    const contributions = row.map((x, j) => finalW[j] * x);
    const score = contributions.reduce((a, b) => a + b, 0);
    let top = 0;
    contributions.forEach((c, j) => {
      if (c > contributions[top]) top = j;
    });
    return {
      region: regions[i],
      score,
      level: riskLevel(score),
      topDriver: indicators[top].code,
      contributions: Object.fromEntries(indicators.map((ind, j) => [ind.code, contributions[j]])),
    };
  });

  const ranked = [...rows].sort((a, b) => b.score - a.score).map((r, k) => ({ ...r, rank: k + 1 }));

  return {
    weights: indicators.map((ind, j) => ({
      code: ind.code,
      entropy: entropyW[j],
      trend: trendS[j],
      final: finalW[j],
    })),
    scores: ranked,
  };
}

module.exports = { computeScores, riskLevel, renormalize };
