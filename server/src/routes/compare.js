const express = require('express');
const pool = require('../db/pool');
const { requireAuth } = require('../middleware/auth');
const { loadDataset } = require('../services/scoring');
const { evaluateMethods } = require('../engine/compare');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const ds = await loadDataset(client);
    const result = evaluateMethods({
      regions: ds.regions.map((r) => r.name),
      indicators: ds.indicators,
      matrices: ds.matrices,
      periodLabels: ds.periods,
      outcomeCode: req.query.outcome || 'poverty',
      alpha: req.query.alpha === undefined ? 1 : Number(req.query.alpha),
      window: req.query.window === undefined ? 5 : Number(req.query.window),
      topK: req.query.topK === undefined ? 5 : Number(req.query.topK),
    });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message || 'Comparison failed' });
  } finally {
    client.release();
  }
});

module.exports = router;
