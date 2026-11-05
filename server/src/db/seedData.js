function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const INDICATORS = [
  { code: 'unemployment', name: 'Unemployment rate', unit: '%', direction: 'higher_worse' },
  { code: 'poverty', name: 'Poverty rate', unit: '%', direction: 'higher_worse' },
  { code: 'literacy', name: 'Literacy rate', unit: '%', direction: 'higher_better' },
  { code: 'healthcare', name: 'Healthcare access index', unit: '0-100', direction: 'higher_better' },
  { code: 'housing', name: 'Housing quality index', unit: '0-100', direction: 'higher_better' },
];

const REGION_NAMES = [
  'Riverside', 'Hillcrest', 'Lakeview', 'Old Town', 'Greenfield',
  'Harbor Bay', 'Northgate', 'Southpark', 'Eastwood', 'Westend',
  'Maple Heights', 'Stonebridge', 'Cedar Grove', 'Sunnydale', 'Brookside',
];

const PERIODS = [2020, 2021, 2022, 2023, 2024, 2025];

// base[indicator] = starting value; drift[indicator] = change per year (in the "worse" direction if positive)
function generateSeed(seed = 42) {
  const rand = mulberry32(seed);
  const regions = REGION_NAMES.map((name, i) => ({
    name,
    lat: 13.0 + (i % 5) * 0.045 + rand() * 0.01,
    lng: 80.2 + Math.floor(i / 5) * 0.05 + rand() * 0.01,
  }));

  const observations = [];
  regions.forEach((region, ri) => {
    const vulnerability = 0.2 + rand() * 0.8;
    INDICATORS.forEach((ind, ii) => {
      const spread = vulnerability + (rand() - 0.5) * 0.3;
      const broad = ind.code === 'healthcare' || ind.code === 'unemployment';
      const drift = (broad ? 0.03 : 0.004) * (rand() > 0.2 ? 1 : -1);
      PERIODS.forEach((period, t) => {
        const v = Math.min(1, Math.max(0, spread + drift * t + (rand() - 0.5) * 0.02));
        let value;
        if (ind.code === 'unemployment') value = 3 + v * 20;
        else if (ind.code === 'poverty') value = 5 + v * 35;
        else if (ind.code === 'literacy') value = 95 - v * 40;
        else if (ind.code === 'healthcare') value = 90 - v * 55;
        else value = 88 - v * 50;
        observations.push({ region: region.name, indicator: ind.code, period, value: Math.round(value * 10) / 10 });
      });
    });
  });

  return { regions, indicators: INDICATORS, periods: PERIODS, observations };
}

// Convert seed observations into the matrices the engine expects (oldest to newest)
function toMatrices(seedData) {
  return seedData.periods.map((period) =>
    seedData.regions.map((r) =>
      seedData.indicators.map(
        (ind) =>
          seedData.observations.find(
            (o) => o.region === r.name && o.indicator === ind.code && o.period === period
          ).value
      )
    )
  );
}

module.exports = { generateSeed, toMatrices, INDICATORS, PERIODS };
