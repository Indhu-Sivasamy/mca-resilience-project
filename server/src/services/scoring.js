const pool = require('../db/pool');
const { computeScores } = require('../engine/score');
const { alertRuleFor, shouldAlert } = require('../engine/alerts');

async function loadDataset(client) {
  const regions = (await client.query('SELECT id, name, lat, lng FROM regions ORDER BY id')).rows;
  const indicators = (
    await client.query('SELECT id, code, name, unit, direction FROM indicators ORDER BY id')
  ).rows;
  const obs = (await client.query('SELECT region_id, indicator_id, period, value FROM observations')).rows;

  const lookup = new Map();
  const periodSet = new Set();
  for (const o of obs) {
    lookup.set(`${o.period}:${o.region_id}:${o.indicator_id}`, Number(o.value));
    periodSet.add(o.period);
  }
  const allPeriods = [...periodSet].sort((a, b) => a - b);
  const periods = allPeriods.filter((p) =>
    regions.every((r) => indicators.every((i) => lookup.has(`${p}:${r.id}:${i.id}`)))
  );
  const matrices = periods.map((p) =>
    regions.map((r) => indicators.map((i) => lookup.get(`${p}:${r.id}:${i.id}`)))
  );
  return { regions, indicators, periods, matrices };
}

async function runScoring(io, options = {}) {
  const alpha = options.alpha === undefined ? 1 : Number(options.alpha);
  const window = options.window === undefined ? 5 : Number(options.window);
  const client = await pool.connect();
  try {
    const ds = await loadDataset(client);
    if (ds.periods.length === 0) {
      throw new Error('No complete period found. Every region needs a value for every indicator.');
    }

    const result = computeScores({
      regions: ds.regions.map((r) => r.name),
      indicators: ds.indicators,
      periods: ds.matrices,
      alpha,
      window,
    });
    const period = ds.periods[ds.periods.length - 1];
    const rules = (await client.query('SELECT id, level, threshold, action_text FROM alert_rules')).rows;
    const previous = (
      await client.query(
        `SELECT region_id, score FROM region_scores
         WHERE run_id = (SELECT id FROM score_runs ORDER BY id DESC LIMIT 1)`
      )
    ).rows;
    const previousScore = new Map(previous.map((p) => [p.region_id, Number(p.score)]));

    const regionByName = new Map(ds.regions.map((r) => [r.name, r]));
    const indicatorByCode = new Map(ds.indicators.map((i) => [i.code, i]));

    await client.query('BEGIN');
    const run = (
      await client.query('INSERT INTO score_runs(period, params) VALUES($1,$2) RETURNING id, created_at', [
        period,
        JSON.stringify({ alpha, window }),
      ])
    ).rows[0];

    const scores = [];
    const newAlerts = [];
    for (const row of result.scores) {
      const region = regionByName.get(row.region);
      await client.query(
        `INSERT INTO region_scores(run_id, region_id, score, rank, level, top_driver, contributions)
         VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [run.id, region.id, row.score, row.rank, row.level, row.topDriver, JSON.stringify(row.contributions)]
      );
      scores.push({
        regionId: region.id,
        name: region.name,
        lat: region.lat,
        lng: region.lng,
        score: row.score,
        rank: row.rank,
        level: row.level,
        topDriver: row.topDriver,
        contributions: row.contributions,
      });

      const rule = alertRuleFor(row.score, rules);
      const previousRule = previousScore.has(region.id) ? alertRuleFor(previousScore.get(region.id), rules) : null;
      if (shouldAlert(rule, previousRule)) {
        const driver = indicatorByCode.get(row.topDriver);
        const message = `${region.name} is now ${rule.level.toLowerCase()} risk. Main driver: ${driver.name.toLowerCase()}. Suggested action: ${rule.action_text}.`;
        const alert = (
          await client.query(
            'INSERT INTO alerts(run_id, region_id, message, driver) VALUES($1,$2,$3,$4) RETURNING id, created_at',
            [run.id, region.id, message, row.topDriver]
          )
        ).rows[0];
        newAlerts.push({
          id: alert.id,
          regionId: region.id,
          regionName: region.name,
          level: rule.level,
          message,
          driver: row.topDriver,
          createdAt: alert.created_at,
          acknowledged: false,
        });
      }
    }

    const weights = [];
    for (const w of result.weights) {
      const ind = indicatorByCode.get(w.code);
      await client.query(
        'INSERT INTO weight_history(run_id, indicator_id, entropy_w, trend_s, final_w) VALUES($1,$2,$3,$4,$5)',
        [run.id, ind.id, w.entropy, w.trend, w.final]
      );
      weights.push({ code: w.code, name: ind.name, entropy: w.entropy, trend: w.trend, final: w.final });
    }
    await client.query('COMMIT');

    const payload = { runId: run.id, period, createdAt: run.created_at, params: { alpha, window }, scores, weights, alerts: newAlerts };
    if (io) {
      io.emit('scores:updated', payload);
      newAlerts.forEach((a) => io.emit('alert:new', a));
    }
    return payload;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { runScoring, loadDataset };
