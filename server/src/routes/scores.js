const express = require('express');
const pool = require('../db/pool');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { runScoring } = require('../services/scoring');

const router = express.Router();

router.get('/latest', requireAuth, async (req, res) => {
  try {
    const run = (await pool.query('SELECT id, period, params, created_at FROM score_runs ORDER BY id DESC LIMIT 1')).rows[0];
    if (!run) return res.json({ run: null, scores: [], weights: [], summary: {} });
    const scores = (
      await pool.query(
        `SELECT r.id AS "regionId", r.name, r.lat, r.lng, rs.score, rs.rank, rs.level,
                rs.top_driver AS "topDriver", rs.contributions
         FROM region_scores rs JOIN regions r ON r.id = rs.region_id
         WHERE rs.run_id = $1 ORDER BY rs.rank`,
        [run.id]
      )
    ).rows;
    const weights = (
      await pool.query(
        `SELECT i.code, i.name, w.entropy_w AS entropy, w.trend_s AS trend, w.final_w AS final
         FROM weight_history w JOIN indicators i ON i.id = w.indicator_id
         WHERE w.run_id = $1 ORDER BY i.id`,
        [run.id]
      )
    ).rows;
    const summary = { regions: scores.length, critical: 0, high: 0, medium: 0, low: 0, average: 0 };
    scores.forEach((s) => {
      summary[s.level.toLowerCase()] += 1;
      summary.average += s.score / scores.length;
    });
    res.json({ run, scores, weights, summary });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not load scores' });
  }
});

router.get('/weights', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT sr.id AS "runId", sr.period, i.code, w.final_w AS final, w.entropy_w AS entropy, w.trend_s AS trend
     FROM weight_history w
     JOIN score_runs sr ON sr.id = w.run_id
     JOIN indicators i ON i.id = w.indicator_id
     ORDER BY sr.id, i.id`
  );
  res.json(rows);
});

router.get('/region/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  const history = (
    await pool.query(
      `SELECT sr.id AS "runId", sr.period, rs.score, rs.rank, rs.level, rs.top_driver AS "topDriver"
       FROM region_scores rs JOIN score_runs sr ON sr.id = rs.run_id
       WHERE rs.region_id = $1 ORDER BY sr.id`,
      [id]
    )
  ).rows;
  const observations = (
    await pool.query(
      `SELECT i.code, o.period, o.value
       FROM observations o JOIN indicators i ON i.id = o.indicator_id
       WHERE o.region_id = $1 ORDER BY o.period, i.id`,
      [id]
    )
  ).rows;
  res.json({ history, observations });
});

// Re-run scoring with different settings, for example { "alpha": 0 } for the no-trend baseline
router.post('/run', requireAuth, requireAdmin, async (req, res) => {
  try {
    const run = await runScoring(req.app.get('io'), req.body || {});
    res.json({ runId: run.runId, period: run.period, params: run.params, newAlerts: run.alerts.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message || 'Scoring failed' });
  }
});

module.exports = router;
