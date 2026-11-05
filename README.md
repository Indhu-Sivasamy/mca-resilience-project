Adaptive Community Resilience Intelligence

A web platform that scores the socio-economic vulnerability of regions, explains what drives each score, and raises alerts when a region's risk level worsens. Indicator weights are not fixed. They adapt to the data using entropy weighting and a trend adjustment, and results update live on every open dashboard when new data arrives.

Academic project (MCA). Author: INDHU S · Institution: RATHINAM TECHNICAL CAMPUS · Guide: Alamelumangai R · Year: 2026

Contents
Overview
Features
How the scoring works
Architecture
Getting started
Configuration
Using the application
API reference
Evaluation module
Using real data
Testing
Deployment
Project structure
Known limitations
Future work
Overview

Vulnerability indices usually combine indicators (unemployment, poverty, literacy, healthcare access, housing quality) with fixed weights chosen once by experts. Those weights cannot react when conditions change. This project computes the weights from the data on every run:

Entropy weighting gives more weight to indicators that differ more between regions, because they carry more information.
Trend adjustment boosts the weight of indicators that are getting worse across the monitored regions.
A rules engine turns scores into alerts that name the main driver and a recommended action.

The method is deterministic and explainable: every score can be traced to indicator values and weights. It uses no machine learning.

The two techniques are established ideas in the literature on composite indices. The contribution of this project is combining them in a working system that recomputes and alerts as data arrives.

Features
Scoring dashboard: summary cards, a risk map, a ranked region table with the main driver per region, live alerts, and the current adaptive weights.
Region detail: what drives a region's score, its score history, and its indicator values over time.
Data management: CSV upload with row-level validation, manual entry, and a "simulate next year" helper for demonstrations.
Alerts and rules: an alert is raised when a region reaches a higher alert level than in the previous run. Thresholds and recommended actions are editable.
Real-time updates: scores and alerts are pushed to all open dashboards over Socket.io.
Method comparison: the adaptive method against equal weights, fixed expert weights and static entropy weights, evaluated on a held-out indicator.
Accounts and roles: registration, login (JWT), password change, and an admin page for roles. Viewers can see everything. Admins can also change data, rules and users.
How the scoring works

For n regions and m indicators, using the latest complete period:

text
1. Normalise (0 = best, 1 = worst)
   higher-is-worse:   x'  = (x - min) / (max - min)
   higher-is-better:  x'  = (max - x) / (max - min)

2. Entropy weights
   p_ij = x'_ij / sum_i(x'_ij)            (a small epsilon avoids log(0))
   e_j  = -(1 / ln n) * sum_i p_ij * ln(p_ij)
   w_j  = (1 - e_j) / sum_k (1 - e_k)

3. Trend adjustment (default window: last 5 periods, needs at least 3)
   slope_j = least-squares slope of the regional mean of indicator j (worsening only)
   s_j     = slope_j / max_k(slope_k)                    in [0, 1]
   w'_j    = w_j * (1 + alpha * s_j), then renormalised to sum to 1   (default alpha = 1)

4. Score and level
   Score_i = sum_j w'_j * x'_ij
   Low < 0.25 <= Medium < 0.50 <= High < 0.75 <= Critical

5. Main driver = indicator with the largest w'_j * x'_ij for that region

Worked example (4 regions, 3 indicators). With these raw values, the entropy weights come out at 0.290, 0.290 and 0.421. This case is covered by the unit tests.

Region	Unemployment (%)	Literacy (%)	Healthcare index
A	12	70	60
B	8	85	62
C	15	60	55
D	10	78	61

Healthcare receives the largest weight because its gap is concentrated in one region (C), which is what entropy weighting rewards.

An alert is raised when a region's score reaches the High or Critical threshold and its alert level is higher than in the previous run.

Architecture
text
  Browser (React + Vite)                         Server (Node.js + Express)
 ┌──────────────────────────┐   REST + JWT     ┌──────────────────────────────┐
 │ Dashboard · Region page  │ ───────────────► │ Routes: auth, users, data,   │
 │ Data · Alerts · Compare  │                  │         scores, alerts,      │
 │ Account · Users          │ ◄─────────────── │         compare              │
 └──────────────────────────┘   Socket.io      │ Scoring engine (pure JS)     │
                                               │ Rules + alerts, rate limiter │
                                               └──────────────┬───────────────┘
                                                              │ SQL
                                                      ┌───────▼────────┐
                                                      │  PostgreSQL    │
                                                      └────────────────┘

Data flow: an admin uploads or simulates data, the server stores it and runs the scoring engine, saves the scores, weights and any alerts as a new run, then broadcasts the result so dashboards refresh without a reload.

Database tables: users, regions, indicators, observations, score_runs, region_scores, weight_history, alert_rules, alerts. The schema is in server/src/db/schema.sql.

Layer	Technology
Frontend	React 18, Vite, React Router, Recharts, Leaflet (react-leaflet), socket.io-client
Backend	Node.js 18+, Express, Socket.io, JSON Web Tokens, bcryptjs, multer, csv-parse
Database	PostgreSQL
Testing	Node's built-in test runner
Getting started
Prerequisites
Node.js 18 or newer
PostgreSQL, with a database you can create
Git (only needed for deployment)
Install and run
bash
# 1. Create the database
psql -U postgres -c "CREATE DATABASE resilience;"

# 2. Backend
cd server
cp .env.example .env          # then edit DATABASE_URL and JWT_SECRET
npm install
npm test                      # unit tests, no database needed
npm run dev                   # http://localhost:4000

# 3. Frontend (second terminal)
cd client
npm install
npm run dev                   # http://localhost:5173

On first start the backend creates the tables and, if the database is empty, loads the demo data and scores it. You can also load it manually with npm run seed.

The local demo accounts are admin@demo.com / admin123 and viewer@demo.com / viewer123. They are created only when the ADMIN_PASSWORD and VIEWER_PASSWORD variables are not set, and they should never be used on a public site.

Resetting the database
bash
psql -U postgres -c "DROP DATABASE resilience;"
psql -U postgres -c "CREATE DATABASE resilience;"

Then start the backend again. The seed does not overwrite existing values, so a reset is needed to reload changed demo data.

Configuration
Backend (server/.env)
Variable	Required	Description
DATABASE_URL	yes	PostgreSQL connection string
JWT_SECRET	yes	Secret used to sign login tokens. Use a long random value.
PORT	no	Server port (default 4000)
FRONTEND_URL	production	Website address allowed to call the API. Comma-separated for several. When unset, any origin is allowed.
ADMIN_PASSWORD, VIEWER_PASSWORD	production	Passwords for the two initial accounts. Required when NODE_ENV=production.
ALLOW_REGISTRATION	no	Set to false to turn off self-registration
AUTO_SEED	no	Set to false to stop loading demo data into an empty database
DATABASE_SSL	no	true or false to override automatic SSL detection (SSL is used for non-local databases)
Frontend (client/.env)
Variable	Description
VITE_API_URL	Address of the backend API (default http://localhost:4000). Read at build time.
Using the application
Typical workflow
Sign in as an admin. The dashboard shows the latest scores.
Open Data and upload a CSV, add a single value, or click Simulate new data.
The server rescores the data. The dashboard, ranking, weights and alerts update immediately, and a notification appears for each new alert.
Open a region from the ranking to see what drives its score and how it changed.
Open Compare methods to see how the adaptive weights compare with the baselines.
CSV format
csv
region,indicator,period,value
Riverside,unemployment,2026,11.3
Riverside,poverty,2026,16.5

Regions and indicator codes must already exist. A period is scored only when every region has a value for every indicator, so incomplete years are ignored until they are complete. Invalid rows are rejected with their line number, and valid rows are still saved. See samples/upload-2026.csv.

Scoring settings on the Data page change alpha (strength of the trend boost; 0 gives plain entropy weights) and the trend window.

Roles
Role	Can do
Viewer	View the dashboard, regions, alerts, comparison and own account
Admin	Everything a viewer can, plus upload and edit data, change rules, acknowledge alerts, manage users

New registrations are always viewers. Admins promote users from the Users page.

API reference

All endpoints except login, registration and /health require an Authorization: Bearer <token> header.

Area	Endpoint	Access
Health	GET /health	public
Auth	POST /auth/login, POST /auth/register	public, rate limited
Auth	POST /auth/change-password	signed in
Users	GET /users, PUT /users/:id/role, DELETE /users/:id	admin
Data	GET /data/regions, GET /data/indicators	signed in
Data	POST /data/upload (CSV), POST /data/observations, POST /data/simulate	admin
Scores	GET /scores/latest, GET /scores/weights, GET /scores/region/:id	signed in
Scores	POST /scores/run with optional { "alpha": 1, "window": 5 }	admin
Alerts	GET /alerts, GET /rules	signed in
Alerts	POST /alerts/:id/ack, PUT /rules/:id	admin
Comparison	GET /compare?outcome=<code>&alpha=1&window=5&topK=5	signed in

Socket.io events sent by the server: scores:updated (full latest scores and weights) and alert:new (one alert).

Evaluation module

The comparison page checks whether adaptive weights help an index agree with what happens next.

One indicator is held out as the outcome and removed from the index.
For each year T, every method scores the regions using data up to T only.
Each ranking is compared with the held-out outcome in year T+1 using Spearman rank correlation, in two ways: against the next-year level and against the change from T to T+1. Top-k overlap is reported as well.
Methods: equal weights, fixed expert weights, static entropy weights (alpha = 0) and adaptive weights.
At least four complete periods are needed.

Read the results with care. With few regions and years, small gaps between methods are not evidence that one is better. The change measure can be negative for every method when most regions improve over time, because the most vulnerable often improve fastest, so compare the gaps between methods rather than the sign.

Using real data

The bundled demo data is generated: 15 fictional regions, 5 indicators, 2020 to 2025, produced with a fixed random seed. Healthcare and unemployment are made to worsen broadly so that the trend adjustment is visible. The map positions are placeholders.

A script loads real country-level data from the World Bank indicators API (free, no key):

bash
npm run import:wb                                   # from the server folder
npm run import:wb -- --countries IND,PAK,BGD --years 12 --end 2022
npm run import:wb -- --db postgres://user:pass@localhost:5432/resilience_real

It replaces the regions, indicators and observations in the target database, so point it at a separate database if you want to keep the demo data. Indicators: unemployment (SL.UEM.TOTL.ZS), GDP per capita as log10 (NY.GDP.PCAP.KD), infant mortality (SP.DYN.IMRT.IN), electricity access (EG.ELC.ACCS.ZS) and basic sanitation (SH.STA.BASS.ZS). Countries with gaps are dropped, and gaps of one or two years are filled by straight-line interpolation. The script prints what it dropped and filled, and both should be stated in any write-up.

Testing
bash
cd server
npm test

27 automated tests cover the normalisation, entropy weights, trend, scoring, alert rules, Spearman correlation and the comparison module, World Bank import logic, validators, the rate limiter, SSL detection, and the startup logic.

Not covered by automated tests: the HTTP routes against a real database, and the React frontend. Those were checked by running the application.

Deployment

The repository includes a render.yaml Blueprint for hosting the database, backend and frontend on Render's free plans. See DEPLOY.md for the steps, free-plan limits and troubleshooting.

Project structure
text
.
├── client/                    React frontend (Vite)
│   └── src/
│       ├── pages/             Dashboard, RegionDetail, DataManagement, AlertsRules,
│       │                      Compare, Login, Register, Account, Users
│       ├── components/        Layout, RiskMap, WeightBars, RiskBadge, Icon
│       ├── context/           Authentication state
│       └── api.js, socket.js  API client and live connection
├── server/                    Express API
│   ├── src/
│   │   ├── engine/            normalize, entropy, trend, score, alerts, compare, stats
│   │   ├── routes/            auth, users, data, scores, alerts, compare
│   │   ├── services/          scoring run (reads data, scores, saves, alerts, broadcasts)
│   │   ├── middleware/        authentication, rate limiting
│   │   └── db/                schema, seed data, World Bank import, connection
│   └── tests/
├── samples/                   Example CSV files
├── render.yaml                Render Blueprint
└── DEPLOY.md                  Deployment guide
Known limitations
The demo data is synthetic. On it, the adaptive method performed about the same as the baselines, and no advantage is claimed. A real-data evaluation is still to be done.
Regions and indicators are created by the seed or the import script. There is no page for adding them.
The Socket.io connection is not authenticated, so anyone who can reach the server can receive score and alert broadcasts.
The login rate limiter keeps its counts in memory, so they reset when the server restarts and are not shared between server instances.
There is no password reset by email.
Hosted on free plans, the backend sleeps after inactivity and the database expires after 30 days.
The trend adjustment uses one slope per indicator across all regions, so it does not capture region-specific trends.
Future work
Evaluation on real multi-year data, with an ablation study (entropy only, trend only, both), sensitivity analysis over alpha and the trend window, and confidence intervals
Region-specific trend terms and additional objective weighting baselines such as CRITIC
Admin pages for regions and indicators
Authenticated Socket.io connections and email-based password reset
Measured update latency for larger numbers of regions