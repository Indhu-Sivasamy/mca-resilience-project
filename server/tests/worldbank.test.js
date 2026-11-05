const test = require('node:test');
const assert = require('node:assert');
const wb = require('../src/db/worldbank');

const resp = (rows) => [
  { page: 1, pages: 1, per_page: 20000, total: rows.length },
  rows.map((r) => ({ indicator: { id: 'X', value: 'x' }, country: { id: 'IN', value: 'n' }, countryiso3code: r.iso3, date: String(r.year), value: r.value })),
];

test('parses indicator rows and keeps nulls as null', () => {
  const rows = wb.parseIndicatorResponse(resp([{ iso3: 'IND', year: 2020, value: 5.5 }, { iso3: 'IND', year: 2021, value: null }]), 'X');
  assert.deepStrictEqual(rows, [
    { iso3: 'IND', year: 2020, value: 5.5 },
    { iso3: 'IND', year: 2021, value: null },
  ]);
});

test('an API error payload gives a clear error', () => {
  assert.throws(() => wb.parseIndicatorResponse([{ message: [{ id: '120', value: 'Invalid value' }] }], 'BAD.CODE'), /BAD.CODE/);
});

test('country list skips entries without coordinates (aggregates)', () => {
  const meta = wb.parseCountryResponse([
    {},
    [
      { id: 'IND', name: 'India', latitude: '28.6353', longitude: '77.225', capitalCity: 'New Delhi' },
      { id: 'WLD', name: 'World', latitude: '', longitude: '' },
    ],
  ]);
  assert.strictEqual(meta.size, 1);
  assert.strictEqual(meta.get('IND').lat, 28.6353);
});

test('interpolation fills short internal gaps only', () => {
  const a = [1, null, 3, null, null, null, 7, null];
  const filled = wb.interpolateGaps(a, 2);
  assert.strictEqual(filled, 1);
  assert.deepStrictEqual(a, [1, 2, 3, null, null, null, 7, null]);
  const b = [null, 2, null, null, 5];
  assert.strictEqual(wb.interpolateGaps(b, 2), 2);
  assert.deepStrictEqual(b, [null, 2, 3, 4, 5]);
});

test('buildDataset keeps complete countries, fills small gaps, drops the rest', () => {
  const inds = [
    { code: 'a', direction: 'higher_worse' },
    { code: 'b', direction: 'higher_better' },
  ];
  const meta = new Map([
    ['AAA', { name: 'Alpha', lat: 1, lng: 1 }],
    ['BBB', { name: 'Beta', lat: 2, lng: 2 }],
    ['CCC', { name: 'Gamma', lat: 3, lng: 3 }],
  ]);
  const values = new Map();
  for (let y = 2010; y <= 2020; y++) {
    for (const c of ['AAA', 'BBB', 'CCC']) {
      for (const i of inds) {
        if (c === 'BBB' && i.code === 'a' && y === 2016) continue;
        if (c === 'CCC' && y >= 2014 && y <= 2018) continue;
        values.set(wb.key(i.code, c, y), y - 2000 + (c === 'AAA' ? 0 : 1));
      }
    }
  }
  const data = wb.buildDataset({ values, meta, indicators: inds, from: 2010, to: 2020, windowYears: 8, minShare: 0.6, minCountries: 2 });
  assert.deepStrictEqual(data.years, [2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020]);
  assert.deepStrictEqual(data.countries.map((c) => c.name), ['Alpha', 'Beta']);
  assert.strictEqual(data.dropped.length, 1);
  assert.strictEqual(data.dropped[0].name, 'Gamma');
  assert.strictEqual(data.filled, 1);
  assert.strictEqual(data.observations.length, 2 * 2 * 8);
});

test('buildDataset explains when too few countries remain', () => {
  const inds = [{ code: 'a', direction: 'higher_worse' }];
  const meta = new Map([['AAA', { name: 'Alpha', lat: 1, lng: 1 }]]);
  const values = new Map([[wb.key('a', 'AAA', 2020), 1]]);
  assert.throws(() => wb.buildDataset({ values, meta, indicators: inds, from: 2020, to: 2020, windowYears: 1, minCountries: 5 }), /Only 1 countries/);
});

test('fetchWorldBank applies the log10 transform and reads every indicator', async () => {
  const fetchJson = async (url) => {
    if (!url.includes('/indicator/')) {
      return [{}, [{ id: 'IND', name: 'India', latitude: '28.6', longitude: '77.2' }, { id: 'PAK', name: 'Pakistan', latitude: '33.7', longitude: '73.0' }]];
    }
    const code = wb.INDICATORS.find((i) => url.includes(i.wb));
    assert.ok(code, `unexpected url ${url}`);
    const base = code.code === 'income' ? 1000 : 10;
    return resp([
      { iso3: 'IND', year: 2020, value: base },
      { iso3: 'PAK', year: 2020, value: base * 10 },
    ]);
  };
  const out = await wb.fetchWorldBank({ countries: ['IND', 'PAK'], indicators: wb.INDICATORS, from: 2020, to: 2020, fetchJson });
  assert.ok(Math.abs(out.values.get(wb.key('income', 'IND', 2020)) - 3) < 1e-9);
  assert.ok(Math.abs(out.values.get(wb.key('income', 'PAK', 2020)) - 4) < 1e-9);
  assert.strictEqual(out.values.get(wb.key('unemployment', 'IND', 2020)), 10);
  assert.strictEqual(out.values.size, wb.INDICATORS.length * 2);
});
