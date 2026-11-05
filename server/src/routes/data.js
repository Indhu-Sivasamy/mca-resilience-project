const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const pool = require('../db/pool');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { runScoring } = require('../services/scoring');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

router.get('/regions', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT id, name, lat, lng FROM regions ORDER BY name');
  res.json(rows);
});

router.get('/indicators', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT id, code, name, unit, direction FROM indicators ORDER BY id');
  res.json(rows);
});

async function lookupMaps() {
  const regions = (await pool.query('SELECT id, name FROM regions')).rows;
  const indicators = (await pool.query('SELECT id, code FROM indicators')).rows;
  return {
    regionId: new Map(regions.map((r) => [r.name.toLowerCase(), r.id])),
    indicatorId: new Map(indicators.map((i) => [i.code.toLowerCase(), i.id])),
  };
}

function upsert(client, regionId, indicatorId, period, value) {
  return client.query(
    `INSERT INTO observations(region_id, indicator_id, period, value) VALUES($1,$2,$3,$4)
     ON CONFLICT (region_id, indicator_id, period) DO UPDATE SET value = EXCLUDED.value`,
    [regionId, indicatorId, period, value]
  );
}

// CSV columns: region,indicator,period,value
router.post('/upload', requireAuth, requireAdmin, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Choose a CSV file to upload' });
    let records;
    try {
      records = parse(req.file.buffer.toString('utf8'), { columns: true, skip_empty_lines: true, trim: true });
    } catch (e) {
      return res.status(400).json({ error: 'Could not read the CSV file. Check the format.' });
    }
    const maps = await lookupMaps();
    const valid = [];
    const errors = [];
    records.forEach((rec, idx) => {
      const line = idx + 2;
      const regionId = maps.regionId.get(String(rec.region || '').toLowerCase());
      const indicatorId = maps.indicatorId.get(String(rec.indicator || '').toLowerCase());
      const period = Number(rec.period);
      const value = Number(rec.value);
      if (!regionId) return errors.push(`Line ${line}: unknown region "${rec.region}"`);
      if (!indicatorId) return errors.push(`Line ${line}: unknown indicator "${rec.indicator}"`);
      if (!Number.isInteger(period) || period < 1900 || period > 2100) return errors.push(`Line ${line}: invalid period "${rec.period}"`);
      if (rec.value === '' || !Number.isFinite(value)) return errors.push(`Line ${line}: invalid value "${rec.value}"`);
      valid.push({ regionId, indicatorId, period, value });
    });
    if (valid.length === 0) return res.status(400).json({ error: 'No valid rows found', errors: errors.slice(0, 20) });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const v of valid) await upsert(client, v.regionId, v.indicatorId, v.period, v.value);
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    const run = await runScoring(req.app.get('io'));
    res.json({
      accepted: valid.length,
      rejected: errors.length,
      errors: errors.slice(0, 20),
      scoredPeriod: run.period,
      newAlerts: run.alerts.length,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Upload failed' });
  }
});

router.post('/observations', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { region, indicator, period, value } = req.body || {};
    const maps = await lookupMaps();
    const regionId = maps.regionId.get(String(region || '').toLowerCase());
    const indicatorId = maps.indicatorId.get(String(indicator || '').toLowerCase());
    if (!regionId || !indicatorId) return res.status(400).json({ error: 'Unknown region or indicator' });
    if (!Number.isInteger(Number(period)) || !Number.isFinite(Number(value))) {
      return res.status(400).json({ error: 'Period must be a year and value must be a number' });
    }
    await upsert(pool, regionId, indicatorId, Number(period), Number(value));
    const run = await runScoring(req.app.get('io'));
    res.json({ saved: true, scoredPeriod: run.period, newAlerts: run.alerts.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Could not save' });
  }
});

// Demo helper: creates the next year of data from the latest year, with a couple of shocked regions
router.post('/simulate', requireAuth, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const maxRow = (await client.query('SELECT MAX(period) AS p FROM observations')).rows[0];
    if (!maxRow.p) return res.status(400).json({ error: 'No data to simulate from. Run the seed first.' });
    const last = maxRow.p;
    const rows = (
      await client.query(
        `SELECT o.region_id, o.indicator_id, o.value, i.direction
         FROM observations o JOIN indicators i ON i.id = o.indicator_id WHERE o.period = $1`,
        [last]
      )
    ).rows;
    const regionIds = [...new Set(rows.map((r) => r.region_id))];
    const shocked = new Set([...regionIds].sort(() => Math.random() - 0.5).slice(0, 2));

    await client.query('BEGIN');
    for (const r of rows) {
      let step = (Math.random() * 2 - 0.6) * 0.04;
      if (shocked.has(r.region_id)) step *= 3;
      const sign = r.direction === 'higher_worse' ? 1 : -1;
      let value = Number(r.value) * (1 + sign * step);
      value = Math.round(Math.min(100, Math.max(0, value)) * 10) / 10;
      await upsert(client, r.region_id, r.indicator_id, last + 1, value);
    }
    await client.query('COMMIT');
    const run = await runScoring(req.app.get('io'));
    res.json({ simulatedPeriod: last + 1, scoredPeriod: run.period, newAlerts: run.alerts.length });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    console.error(e);
    res.status(500).json({ error: e.message || 'Simulation failed' });
  } finally {
    client.release();
  }
});

module.exports = router;
