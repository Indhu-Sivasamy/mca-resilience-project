const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'Enter your email and password' });
    const { rows } = await pool.query('SELECT id, email, password_hash, role FROM users WHERE email = $1', [email]);
    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Wrong email or password' });
    }
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '8h',
    });
    res.json({ token, user: { email: user.email, role: user.role } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;
