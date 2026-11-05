// Runs when the server starts: makes sure the tables exist and, on an empty database, loads and scores the demo data.
async function bootstrap({ pool, schemaSql, seedFn, scoreFn, autoSeed = true, log = console.log }) {
  await pool.query(schemaSql);
  const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM regions');
  if (rows[0].n === 0 && autoSeed) {
    log('Empty database: loading demo data...');
    await seedFn();
    await scoreFn();
    log('Demo data loaded and scored.');
    return true;
  }
  return false;
}

module.exports = { bootstrap };
