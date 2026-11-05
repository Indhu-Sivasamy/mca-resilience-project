# Adaptive Community Resilience Intelligence

Risk assessment platform: entropy weighting + trend adjustment + rules engine, live updates over Socket.io.

## Day 1 status (this folder)
- server/src/engine: normalize, entropy, trend, score (tested)
- server/src/db: schema.sql, seedData.js (15 regions, 5 indicators, 6 years), seed.js
- server/tests/engine.test.js: 8 passing tests

## Run
1. Install PostgreSQL and create a database named resilience
2. cd server, copy .env.example to .env and edit DATABASE_URL
3. npm install
4. npm test        (engine tests, no database needed)
5. npm run seed    (creates tables, demo data, users admin@demo.com / admin123 and viewer@demo.com / viewer123)

## Scoring method
1. Min-max normalize each indicator to 0..1 where 1 is worst (higher_better indicators are flipped)
2. Entropy weights: w_j = (1 - e_j) / sum(1 - e_k), with a small epsilon to avoid log(0)
3. Trend: slope of each indicator's regional mean over the last 5 periods, worsening only, scaled to 0..1
4. Final weight: w'_j = w_j * (1 + alpha * s_j), renormalized to sum to 1
5. Score_i = sum_j w'_j * x_ij; levels: <0.25 Low, <0.5 Medium, <0.75 High, otherwise Critical
6. Main driver = indicator with the largest w'_j * x_ij for that region

## 5-day plan
Day 1: engine, schema, seed (done) + API: login, upload, run scoring, regions, scores
Day 2: React shell, dashboard (cards, map, ranking), Socket.io live update, alerts
Day 3: region detail, weight-history chart, rules page, Simulate new data button
Day 4: comparison page (baselines + Spearman), UI polish, Docker or README run guide
Day 5: buffer, screenshots, report and presentation

## Day 1 part 2: backend API (modules 1, 2, 3, 4, 5)
Start: cd server, npm run dev (API on http://localhost:4000)

| Module | Endpoints |
|---|---|
| 1 Auth | POST /auth/login |
| 2 Data | GET /data/regions, GET /data/indicators, POST /data/upload (CSV), POST /data/observations, POST /data/simulate |
| 3 Scoring | GET /scores/latest, GET /scores/weights, GET /scores/region/:id, POST /scores/run |
| 4 Alerts and rules | GET /alerts, POST /alerts/:id/ack, GET /rules, PUT /rules/:id |
| 5 Real-time | Socket.io events scores:updated and alert:new |

CSV format for upload: region,indicator,period,value (see samples/upload-2026.csv). Indicator codes: unemployment, poverty, literacy, healthcare, housing.


## Frontend (client)
React + Vite. Pages: Login, Dashboard, Region detail, Data management, Alerts and rules, Compare methods.

## Run the whole project (two terminals)
Terminal 1 (backend): cd server, npm install, npm run seed, npm run dev   (http://localhost:4000)
Terminal 2 (frontend): cd client, npm install, npm run dev                (http://localhost:5173)
Open http://localhost:5173 and sign in with admin@demo.com / admin123.

## Demo flow (2 minutes)
1. Dashboard: click Re-run scoring once (or use Data, then Upload samples/upload-2026.csv)
2. Show the map, ranking, driver per region and adaptive weights
3. Data page: click Simulate new data and watch the dashboard, alerts and toast update live
4. Region page: score history and what drives the score
5. Compare page: baselines versus adaptive, with the honest reading note

## Tests (server)
npm test runs 13 tests: normalization, entropy, trend, scoring, alert rules, Spearman and the comparison module.


## Real data (World Bank)
The generated demo data can be replaced with real country-level data from the World Bank indicators API (free, no key).
1. Create a second database: psql -U postgres -c "CREATE DATABASE resilience_real;"
2. In server/.env set DATABASE_URL to the resilience_real database, then run: npm run import:wb
3. Restart the backend and refresh the dashboard. Switch back to the demo data by pointing .env at the original database.

Indicators: unemployment (SL.UEM.TOTL.ZS), GDP per capita as log10 (NY.GDP.PCAP.KD), infant mortality (SP.DYN.IMRT.IN), access to electricity (EG.ELC.ACCS.ZS), basic sanitation (SH.STA.BASS.ZS).
Options: npm run import:wb -- --countries IND,PAK,BGD --years 12 --end 2022
The script drops countries with gaps, fills gaps of 1 to 2 years by straight-line interpolation and prints how many it filled. State this in the report.

## Deploying online
See DEPLOY.md for putting the project on the internet (Render free plans, GitHub, render.yaml Blueprint). On an empty database the API now creates the tables, loads the demo data and scores it by itself when it starts.
