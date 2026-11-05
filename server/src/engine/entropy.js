const EPS = 1e-6;

function entropyWeights(X) {
  const n = X.length;
  const m = X[0].length;
  if (n < 2) return new Array(m).fill(1 / m);

  const divergence = [];
  for (let j = 0; j < m; j++) {
    let colSum = 0;
    for (let i = 0; i < n; i++) colSum += X[i][j] + EPS;
    let e = 0;
    for (let i = 0; i < n; i++) {
      const p = (X[i][j] + EPS) / colSum;
      e -= p * Math.log(p);
    }
    e /= Math.log(n);
    divergence.push(Math.max(0, 1 - e));
  }

  const total = divergence.reduce((a, b) => a + b, 0);
  if (total === 0) return new Array(m).fill(1 / m);
  return divergence.map((d) => d / total);
}

module.exports = { entropyWeights };
