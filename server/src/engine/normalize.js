const DIRECTION = { HIGHER_WORSE: 'higher_worse', HIGHER_BETTER: 'higher_better' };

function columnRange(matrix, j) {
  let min = Infinity;
  let max = -Infinity;
  for (const row of matrix) {
    if (row[j] < min) min = row[j];
    if (row[j] > max) max = row[j];
  }
  return { min, max };
}

function normalizeValue(v, min, max, direction) {
  if (max === min) return 0;
  return direction === DIRECTION.HIGHER_BETTER
    ? (max - v) / (max - min)
    : (v - min) / (max - min);
}

function normalizeMatrix(matrix, directions) {
  const cols = directions.length;
  const ranges = [];
  for (let j = 0; j < cols; j++) ranges.push(columnRange(matrix, j));
  return matrix.map((row) =>
    row.map((v, j) => normalizeValue(v, ranges[j].min, ranges[j].max, directions[j]))
  );
}

module.exports = { DIRECTION, columnRange, normalizeValue, normalizeMatrix };
