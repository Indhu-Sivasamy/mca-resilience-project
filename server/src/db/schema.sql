CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS regions (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS indicators (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  unit TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('higher_worse', 'higher_better'))
);

CREATE TABLE IF NOT EXISTS observations (
  region_id INT NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  indicator_id INT NOT NULL REFERENCES indicators(id) ON DELETE CASCADE,
  period INT NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  PRIMARY KEY (region_id, indicator_id, period)
);

CREATE TABLE IF NOT EXISTS score_runs (
  id SERIAL PRIMARY KEY,
  period INT NOT NULL,
  params JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS region_scores (
  run_id INT NOT NULL REFERENCES score_runs(id) ON DELETE CASCADE,
  region_id INT NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  score DOUBLE PRECISION NOT NULL,
  rank INT NOT NULL,
  level TEXT NOT NULL,
  top_driver TEXT NOT NULL,
  contributions JSONB NOT NULL,
  PRIMARY KEY (run_id, region_id)
);

CREATE TABLE IF NOT EXISTS weight_history (
  run_id INT NOT NULL REFERENCES score_runs(id) ON DELETE CASCADE,
  indicator_id INT NOT NULL REFERENCES indicators(id) ON DELETE CASCADE,
  entropy_w DOUBLE PRECISION NOT NULL,
  trend_s DOUBLE PRECISION NOT NULL,
  final_w DOUBLE PRECISION NOT NULL,
  PRIMARY KEY (run_id, indicator_id)
);

CREATE TABLE IF NOT EXISTS alert_rules (
  id SERIAL PRIMARY KEY,
  level TEXT NOT NULL CHECK (level IN ('Medium', 'High', 'Critical')),
  threshold DOUBLE PRECISION NOT NULL,
  action_text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  run_id INT NOT NULL REFERENCES score_runs(id) ON DELETE CASCADE,
  region_id INT NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  driver TEXT NOT NULL,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_obs_period ON observations(period);
CREATE INDEX IF NOT EXISTS idx_scores_run ON region_scores(run_id);
