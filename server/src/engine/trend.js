const { columnRange, normalizeValue } = require('./normalize');

function slope(series) {
  const n = series.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = series.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let t = 0; t < n; t++) {
    num += (t - xMean) * (series[t] - yMean);
    den += (t - xMean) ** 2;
  }
  return num / den;
}

// periods: array (oldest to newest) of matrices [region][indicator] of raw values.
// Returns one value per indicator in [0, 1]: 0 = stable or improving, 1 = worsening fastest.
function trendScores(periods, directions) {
  const m = directions.length;
  const ranges = [];
  for (let j = 0; j < m; j++) {
    const all = periods.flat();
    ranges.push(columnRange(all, j));
  }

  const slopes = [];
  for (let j = 0; j < m; j++) {
    const series = periods.map((matrix) => {
      const vals = matrix.map((row) =>
        normalizeValue(row[j], ranges[j].min, ranges[j].max, directions[j])
      );
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    });
    slopes.push(Math.max(0, slope(series)));
  }

  const maxSlope = Math.max(...slopes);
  if (maxSlope === 0) return slopes.map(() => 0);
  return slopes.map((s) => s / maxSlope);
}

module.exports = { slope, trendScores };
