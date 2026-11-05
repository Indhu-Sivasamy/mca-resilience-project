// Pure helpers for loading real country-level data from the World Bank indicators API.

const INDICATORS = [
  { code: 'unemployment', wb: 'SL.UEM.TOTL.ZS', name: 'Unemployment rate', unit: '% of labour force', direction: 'higher_worse' },
  {
    code: 'income',
    wb: 'NY.GDP.PCAP.KD',
    name: 'GDP per capita (log10 of constant US$)',
    unit: 'log10 US$',
    direction: 'higher_better',
    transform: (v) => (v > 0 ? Math.log10(v) : null),
  },
  { code: 'infant_mortality', wb: 'SP.DYN.IMRT.IN', name: 'Infant mortality rate', unit: 'per 1,000 live births', direction: 'higher_worse' },
  { code: 'electricity', wb: 'EG.ELC.ACCS.ZS', name: 'Access to electricity', unit: '% of population', direction: 'higher_better' },
  { code: 'sanitation', wb: 'SH.STA.BASS.ZS', name: 'Basic sanitation access', unit: '% of population', direction: 'higher_better' },
];

const DEFAULT_COUNTRIES = [
  'IND', 'PAK', 'BGD', 'LKA', 'NPL', 'BTN', 'AFG', 'MDV',
  'CHN', 'IDN', 'THA', 'VNM', 'PHL', 'MYS', 'MMR', 'KHM', 'LAO', 'MNG', 'KOR', 'JPN', 'SGP',
  'IRN', 'TUR', 'JOR',
];

const key = (code, iso3, year) => `${code}|${iso3}|${year}`;

function wbIndicatorUrl(countries, wbCode, from, to) {
  return `https://api.worldbank.org/v2/country/${countries.join(';')}/indicator/${wbCode}?format=json&date=${from}:${to}&per_page=20000`;
}

function wbCountryUrl(countries) {
  return `https://api.worldbank.org/v2/country/${countries.join(';')}?format=json&per_page=300`;
}

function describeError(json) {
  if (Array.isArray(json) && json[0] && json[0].message) return JSON.stringify(json[0].message);
  return 'unexpected response';
}

function parseIndicatorResponse(json, wbCode) {
  if (!Array.isArray(json) || json.length < 2 || !Array.isArray(json[1])) {
    throw new Error(`World Bank API problem for ${wbCode}: ${describeError(json)}`);
  }
  const rows = [];
  for (const r of json[1]) {
    const year = Number(r.date);
    if (!r.countryiso3code || !Number.isInteger(year)) continue;
    rows.push({
      iso3: r.countryiso3code,
      year,
      value: r.value === null || r.value === undefined ? null : Number(r.value),
    });
  }
  return rows;
}

function parseCountryResponse(json) {
  if (!Array.isArray(json) || json.length < 2 || !Array.isArray(json[1])) {
    throw new Error(`World Bank API problem for the country list: ${describeError(json)}`);
  }
  const meta = new Map();
  for (const r of json[1]) {
    const lat = parseFloat(r.latitude);
    const lng = parseFloat(r.longitude);
    if (!r.id || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    meta.set(r.id, { name: r.name, lat, lng, capital: r.capitalCity });
  }
  return meta;
}

async function fetchWorldBank({ countries, indicators, from, to, fetchJson }) {
  const meta = parseCountryResponse(await fetchJson(wbCountryUrl(countries)));
  const values = new Map();
  for (const ind of indicators) {
    const rows = parseIndicatorResponse(await fetchJson(wbIndicatorUrl(countries, ind.wb, from, to)), ind.wb);
    for (const r of rows) {
      if (r.value === null || !Number.isFinite(r.value)) continue;
      const v = ind.transform ? ind.transform(r.value) : r.value;
      if (v === null || !Number.isFinite(v)) continue;
      values.set(key(ind.code, r.iso3, r.year), v);
    }
  }
  return { meta, values };
}

// Fills short gaps between two known values by straight-line interpolation. Returns how many values were filled.
function interpolateGaps(arr, maxGap) {
  let filled = 0;
  let i = 0;
  while (i < arr.length) {
    if (arr[i] !== null) {
      i++;
      continue;
    }
    let j = i;
    while (j < arr.length && arr[j] === null) j++;
    const len = j - i;
    if (i > 0 && j < arr.length && len <= maxGap) {
      const a = arr[i - 1];
      const b = arr[j];
      for (let k = 0; k < len; k++) arr[i + k] = a + ((b - a) * (k + 1)) / (len + 1);
      filled += len;
    }
    i = j;
  }
  return filled;
}

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

function buildDataset({ values, meta, indicators, from, to, windowYears = 15, endYear = null, minShare = 0.8, minCountries = 12, maxGap = 2 }) {
  const iso = [...meta.keys()];
  const hasAll = (c, y) => indicators.every((ind) => values.has(key(ind.code, c, y)));

  let last = endYear;
  if (!last) {
    for (let y = to; y >= from; y--) {
      const share = iso.filter((c) => hasAll(c, y)).length / iso.length;
      if (share >= minShare) {
        last = y;
        break;
      }
    }
    if (!last) throw new Error('No recent year has complete data for most countries. Try other countries.');
  }
  const years = range(last - windowYears + 1, last);

  let filled = 0;
  const kept = [];
  const dropped = [];
  for (const c of iso) {
    const series = {};
    let missing = null;
    for (const ind of indicators) {
      const arr = years.map((y) => (values.has(key(ind.code, c, y)) ? values.get(key(ind.code, c, y)) : null));
      filled += interpolateGaps(arr, maxGap);
      if (arr.some((v) => v === null)) {
        missing = ind.code;
        break;
      }
      series[ind.code] = arr;
    }
    if (missing) dropped.push({ iso3: c, name: meta.get(c).name, reason: `gaps in ${missing}` });
    else kept.push({ iso3: c, ...meta.get(c), series });
  }
  if (kept.length < minCountries) {
    throw new Error(`Only ${kept.length} countries have complete data for ${years[0]}-${last} (need ${minCountries}). Use a shorter --years window or other countries.`);
  }
  kept.sort((a, b) => a.name.localeCompare(b.name));

  const observations = [];
  for (const c of kept) {
    for (const ind of indicators) {
      years.forEach((y, i) => {
        observations.push({ region: c.name, indicator: ind.code, period: y, value: Math.round(c.series[ind.code][i] * 1000) / 1000 });
      });
    }
  }
  return { years, countries: kept, dropped, filled, observations };
}

module.exports = {
  INDICATORS,
  DEFAULT_COUNTRIES,
  key,
  wbIndicatorUrl,
  wbCountryUrl,
  parseIndicatorResponse,
  parseCountryResponse,
  fetchWorldBank,
  interpolateGaps,
  buildDataset,
};
