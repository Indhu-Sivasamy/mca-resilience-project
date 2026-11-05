require('dotenv').config();
const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const pool = require('./db/pool');
const { seedDatabase } = require('./db/seed');
const { runScoring } = require('./services/scoring');
const { bootstrap } = require('./bootstrap');
const { parseOrigins } = require('./config');
const authRoutes = require('./routes/auth');
const dataRoutes = require('./routes/data');
const scoreRoutes = require('./routes/scores');
const alertRoutes = require('./routes/alerts');
const compareRoutes = require('./routes/compare');

const origins = parseOrigins(process.env.FRONTEND_URL);

const app = express();
app.use(cors(origins ? { origin: origins } : undefined));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: origins || '*' } });
app.set('io', io);

io.on('connection', (socket) => {
  console.log('Dashboard connected:', socket.id);
});

app.get('/health', (req, res) => res.json({ ok: true }));
app.use('/auth', authRoutes);
app.use('/data', dataRoutes);
app.use('/scores', scoreRoutes);
app.use('/compare', compareRoutes);
app.use('/', alertRoutes);

const port = process.env.PORT || 4000;

bootstrap({
  pool,
  schemaSql: fs.readFileSync(path.join(__dirname, 'db', 'schema.sql'), 'utf8'),
  seedFn: () => seedDatabase(pool),
  scoreFn: () => runScoring(null),
  autoSeed: process.env.AUTO_SEED !== 'false',
})
  .then(() => {
    server.listen(port, () => console.log(`API running on http://localhost:${port}`));
  })
  .catch((e) => {
    console.error('Startup failed:', e.message);
    process.exit(1);
  });
