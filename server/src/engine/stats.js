function averageRanks(values) {
  const indexed = values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const ranks = new Array(values.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j + 1 < indexed.length && indexed[j + 1][0] === indexed[i][0]) j++;
    const rank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[indexed[k][1]] = rank;
    i = j + 1;
  }
  return ranks;
}

function pearson(a, b) {
  const n = a.length;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  if (da === 0 || db === 0) return 0;
  return num / Math.sqrt(da * db);
}

function spearman(a, b) {
  return pearson(averageRanks(a), averageRanks(b));
}

function topIndices(values, k) {
  return values
    .map((v, i) => [v, i])
    .sort((x, y) => y[0] - x[0] || x[1] - y[1])
    .slice(0, k)
    .map((p) => p[1]);
}

function topKOverlap(scores, outcome, k) {
  const a = new Set(topIndices(scores, k));
  const b = topIndices(outcome, k);
  return b.filter((i) => a.has(i)).length / k;
}

module.exports = { averageRanks, pearson, spearman, topKOverlap };
