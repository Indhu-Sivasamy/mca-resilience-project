// FRONTEND_URL may hold one or more website addresses separated by commas.
function parseOrigins(value) {
  if (!value) return null;
  const list = value
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return list.length ? list : null;
}

module.exports = { parseOrigins };
