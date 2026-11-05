const test = require('node:test');
const assert = require('node:assert');
const { sslConfig } = require('../src/db/ssl');
const { parseOrigins } = require('../src/config');
const { bootstrap } = require('../src/bootstrap');

test('ssl is off for local databases and on for hosted ones', () => {
  assert.strictEqual(sslConfig('postgres://postgres:pw@localhost:5432/resilience'), false);
  assert.strictEqual(sslConfig('postgres://u:p@127.0.0.1:5432/db'), false);
  assert.deepStrictEqual(sslConfig('postgres://u:p@dpg-abc123-a.oregon-postgres.render.com/db'), { rejectUnauthorized: false });
  assert.deepStrictEqual(sslConfig('postgres://u:p@dpg-abc123-a/db'), { rejectUnauthorized: false });
  assert.strictEqual(sslConfig('postgres://u:p@dpg-abc123-a/db', 'false'), false);
  assert.deepStrictEqual(sslConfig('postgres://postgres:pw@localhost/db', 'true'), { rejectUnauthorized: false });
});

test('allowed website addresses are cleaned up', () => {
  assert.strictEqual(parseOrigins(''), null);
  assert.strictEqual(parseOrigins(undefined), null);
  assert.deepStrictEqual(parseOrigins('https://a.onrender.com/'), ['https://a.onrender.com']);
  assert.deepStrictEqual(parseOrigins(' https://a.com , http://localhost:5173/ '), ['https://a.com', 'http://localhost:5173']);
});

function stubPool(regionCount) {
  const calls = [];
  return {
    calls,
    query: async (sql) => {
      calls.push(sql);
      if (/COUNT/.test(sql)) return { rows: [{ n: regionCount }] };
      return { rows: [] };
    },
  };
}

test('an empty database is seeded and scored on startup', async () => {
  const pool = stubPool(0);
  const steps = [];
  const did = await bootstrap({ pool, schemaSql: 'CREATE TABLE x', seedFn: async () => steps.push('seed'), scoreFn: async () => steps.push('score'), log: () => {} });
  assert.strictEqual(did, true);
  assert.deepStrictEqual(steps, ['seed', 'score']);
  assert.strictEqual(pool.calls[0], 'CREATE TABLE x');
});

test('existing data is left alone, and auto-seed can be switched off', async () => {
  const steps = [];
  const seedFn = async () => steps.push('seed');
  const scoreFn = async () => steps.push('score');
  assert.strictEqual(await bootstrap({ pool: stubPool(15), schemaSql: 's', seedFn, scoreFn, log: () => {} }), false);
  assert.strictEqual(await bootstrap({ pool: stubPool(0), schemaSql: 's', seedFn, scoreFn, autoSeed: false, log: () => {} }), false);
  assert.deepStrictEqual(steps, []);
});
