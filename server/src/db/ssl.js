// Hosted databases need SSL; a local one does not. DATABASE_SSL=true/false overrides the guess.
function sslConfig(url, flag) {
  if (flag === 'true') return { rejectUnauthorized: false };
  if (flag === 'false') return false;
  if (!url) return false;
  return /@(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(url) ? false : { rejectUnauthorized: false };
}

module.exports = { sslConfig };
