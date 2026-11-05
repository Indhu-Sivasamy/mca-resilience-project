// Usage:  npm run import:wb
//         npm run import:wb -- --db postgres://user:pass@localhost:5432/resilience_real
//         npm run import:wb -- --countries IND,PAK,BGD --years 12 --end 2022
// Replaces the regions, indicators and observations in the target database with real World Bank data.

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const next = argv[i + 1];
      out[argv[i].slice(2)] = next && !next.startsWith('--') ? argv[++i] : true;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (args.db) process.env.DATABASE_URL = args.db;

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const pool = require('./pool');
const { runScoring } = require('../services/scoring');
const { INDICATORS, DEFAULT_COUNTRIES, fetchWorldBank, buildDataset } = require('./worldbank');

async function fetchJson(url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastError = e;
      await new Promise((r) => setTimeout(r, 1500 * attempt));
    }
  }
  throw new Error(`Could not reach the World Bank API (${lastError.message}). Check your internet connection and try again.`);
}

async function main() {
  if (typeof fetch !== 'function') throw new Error('Node 18 or newer is required for this script.');
  const countries = (typeof args.countries === 'string' ? args.countries.split(',') : DEFAULT_COUNTRIES).map((c) => c.trim().toUpperCase());
  const windowYears = Number(args.years || 15);
  const endYear = args.end ? Number(args.end) : null;
  const from = 2000;
  const to = new Date().getFullYear();

  console.log(`Downloading ${INDICATORS.length} indicators for ${countries.length} countries from the World Bank...`);
  const { meta, values } = await fetchWorldBank({ countries, indicators: INDICATORS, from, to, fetchJson });
  const unknown = countries.filter((c) => !meta.has(c));
  if (unknown.length) console.log(`Skipped (not found or no map position): ${unknown.join(', ')}`);

  const data = buildDataset({ values, meta, indicators: INDICATORS, from, to, windowYears, endYear });
  console.log(`Years: ${data.years[0]} to ${data.years[data.years.length - 1]}`);
  console.log(`Kept ${data.countries.length} countries: ${data.countries.map((c) => c.name).join(', ')}`);
  if (data.dropped.length) console.log(`Dropped for gaps: ${data.dropped.map((d) => `${d.name} (${d.reason})`).join('; ')}`);
  console.log(`Filled ${data.filled} short gaps (1-2 years) by straight-line interpolation. Mention this in your report.`);

  const client = await pool.connect();
  try {
    await client.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
    await client.query('BEGIN');
    await client.query('TRUNCATE alerts, region_scores, weight_history, score_runs, observations, regions, indicators RESTART IDENTITY CASCADE');

    const regionIds = {};
    for (const c of data.countries) {
      const res = await client.query('INSERT INTO regions(name, lat, lng) VALUES($1,$2,$3) RETURNING id', [c.name, c.lat, c.lng]);
      regionIds[c.name] = res.rows[0].id;
    }
    const indicatorIds = {};
    for (const i of INDICATORS) {
      const res = await client.query('INSERT INTO indicators(code, name, unit, direction) VALUES($1,$2,$3,$4) RETURNING id', [i.code, i.name, i.unit, i.direction]);
      indicatorIds[i.code] = res.rows[0].id;
    }
    for (const o of data.observations) {
      await client.query('INSERT INTO observations(region_id, indicator_id, period, value) VALUES($1,$2,$3,$4)', [regionIds[o.region], indicatorIds[o.indicator], o.period, o.value]);
    }

    const users = await client.query('SELECT COUNT(*)::int AS n FROM users');
    if (users.rows[0].n === 0) {
      await client.query("INSERT INTO users(email, password_hash, role) VALUES('admin@demo.com',$1,'admin')", [await bcrypt.hash(process.env.ADMIN_PASSWORD || 'admin123', 10)]);
      await client.query("INSERT INTO users(email, password_hash, role) VALUES('viewer@demo.com',$1,'viewer')", [await bcrypt.hash(process.env.VIEWER_PASSWORD || 'viewer123', 10)]);
    }
    const rules = await client.query('SELECT COUNT(*)::int AS n FROM alert_rules');
    if (rules.rows[0].n === 0) {
      await client.query(`INSERT INTO alert_rules(level, threshold, action_text) VALUES
        ('Critical', 0.75, 'Escalate to district authority and start targeted intervention'),
        ('High', 0.5, 'Plan priority support programmes for the main driver'),
        ('Medium', 0.25, 'Monitor closely next period')`);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }

  const run = await runScoring(null);
  console.log(`Imported ${data.observations.length} values and scored ${run.period}. Top 5 most vulnerable:`);
  run.scores.slice(0, 5).forEach((s) => console.log(`  ${s.rank}. ${s.name}  score ${s.score.toFixed(2)}  (${s.level})`));
  console.log('Done. Restart the backend and refresh the dashboard.');
}

main()
  .catch((e) => {
    console.error('Import failed:', e.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
