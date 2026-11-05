const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { generateSeed } = require('./seedData');

async function seedDatabase(pool) {
  if (process.env.NODE_ENV === 'production' && (!process.env.ADMIN_PASSWORD || !process.env.VIEWER_PASSWORD)) {
    throw new Error('Set ADMIN_PASSWORD and VIEWER_PASSWORD before loading data in production');
  }
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const viewerPassword = process.env.VIEWER_PASSWORD || 'viewer123';
  const client = await pool.connect();
  try {
    await client.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
    await client.query('BEGIN');

    const data = generateSeed();
    const regionIds = {};
    const indicatorIds = {};

    for (const r of data.regions) {
      const res = await client.query(
        'INSERT INTO regions(name, lat, lng) VALUES($1,$2,$3) ON CONFLICT (name) DO UPDATE SET lat=EXCLUDED.lat RETURNING id',
        [r.name, r.lat, r.lng]
      );
      regionIds[r.name] = res.rows[0].id;
    }
    for (const i of data.indicators) {
      const res = await client.query(
        'INSERT INTO indicators(code, name, unit, direction) VALUES($1,$2,$3,$4) ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name RETURNING id',
        [i.code, i.name, i.unit, i.direction]
      );
      indicatorIds[i.code] = res.rows[0].id;
    }
    for (const o of data.observations) {
      await client.query(
        'INSERT INTO observations(region_id, indicator_id, period, value) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',
        [regionIds[o.region], indicatorIds[o.indicator], o.period, o.value]
      );
    }

    const hash = await bcrypt.hash(adminPassword, 10);
    await client.query(
      "INSERT INTO users(email, password_hash, role) VALUES('admin@demo.com',$1,'admin') ON CONFLICT (email) DO NOTHING",
      [hash]
    );
    const vhash = await bcrypt.hash(viewerPassword, 10);
    await client.query(
      "INSERT INTO users(email, password_hash, role) VALUES('viewer@demo.com',$1,'viewer') ON CONFLICT (email) DO NOTHING",
      [vhash]
    );

    await client.query(
      `INSERT INTO alert_rules(level, threshold, action_text)
       SELECT * FROM (VALUES
         ('Critical', 0.75, 'Escalate to district authority and start targeted intervention'),
         ('High', 0.5, 'Plan priority support programmes for the main driver'),
         ('Medium', 0.25, 'Monitor closely next period')
       ) AS v(level, threshold, action_text)
       WHERE NOT EXISTS (SELECT 1 FROM alert_rules)`
    );

    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { seedDatabase };

if (require.main === module) {
  const pool = require('./pool');
  seedDatabase(pool)
    .then(() => console.log('Seeded: 15 regions, 5 indicators, 6 periods, 2 users, 3 alert rules'))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}
