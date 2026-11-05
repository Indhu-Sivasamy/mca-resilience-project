const express = require('express');
const pool = require('../db/pool');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/alerts', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    `SELECT a.id, a.message, a.driver, a.acknowledged, a.created_at AS "createdAt",
            r.id AS "regionId", r.name AS "regionName"
     FROM alerts a JOIN regions r ON r.id = a.region_id
     ORDER BY a.id DESC LIMIT 50`
  );
  res.json(rows);
});

router.post('/alerts/:id/ack', requireAuth, requireAdmin, async (req, res) => {
  const { rowCount } = await pool.query('UPDATE alerts SET acknowledged = true WHERE id = $1', [Number(req.params.id)]);
  if (!rowCount) return res.status(404).json({ error: 'Alert not found' });
  res.json({ acknowledged: true });
});

router.get('/rules', requireAuth, async (req, res) => {
  const { rows } = await pool.query('SELECT id, level, threshold, action_text AS "actionText" FROM alert_rules ORDER BY threshold DESC');
  res.json(rows);
});

router.put('/rules/:id', requireAuth, requireAdmin, async (req, res) => {
  const { threshold, actionText } = req.body || {};
  const t = Number(threshold);
  if (!Number.isFinite(t) || t < 0 || t > 1 || !actionText) {
    return res.status(400).json({ error: 'Threshold must be between 0 and 1, and an action is required' });
  }
  const { rowCount } = await pool.query('UPDATE alert_rules SET threshold = $1, action_text = $2 WHERE id = $3', [
    t,
    actionText,
    Number(req.params.id),
  ]);
  if (!rowCount) return res.status(404).json({ error: 'Rule not found' });
  res.json({ updated: true });
});

module.exports = router;
