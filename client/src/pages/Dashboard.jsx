import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api.js';
import { socket } from '../socket.js';
import { useAuth } from '../context/AuthContext.jsx';
import { IND_COLORS, LEVEL_COLORS, fmt, timeAgo } from '../lib.js';
import RiskBadge from '../components/RiskBadge.jsx';
import RiskMap from '../components/RiskMap.jsx';
import WeightBars from '../components/WeightBars.jsx';
import Icon from '../components/Icon.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [weightRows, setWeightRows] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadSecondary = useCallback(async () => {
    try {
      const [w, a] = await Promise.all([api.get('/scores/weights'), api.get('/alerts')]);
      setWeightRows(w);
      setAlerts(a);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    api.get('/scores/latest').then(setData).catch((e) => setError(e.message));
    loadSecondary();
    const onScores = (p) => {
      setData({
        run: { id: p.runId, period: p.period, created_at: p.createdAt, params: p.params },
        scores: p.scores,
        weights: p.weights,
      });
      loadSecondary();
    };
    socket.on('scores:updated', onScores);
    return () => socket.off('scores:updated', onScores);
  }, [loadSecondary]);

  const stats = useMemo(() => {
    const s = { regions: 0, critical: 0, high: 0, average: 0 };
    if (!data) return s;
    s.regions = data.scores.length;
    data.scores.forEach((r) => {
      if (r.level === 'Critical') s.critical += 1;
      if (r.level === 'High') s.high += 1;
      s.average += r.score / data.scores.length;
    });
    return s;
  }, [data]);

  const driverName = useMemo(() => {
    const map = {};
    (data ? data.weights : []).forEach((w) => {
      map[w.code] = w.name;
    });
    return map;
  }, [data]);

  const weightSeries = useMemo(() => {
    const byRun = new Map();
    weightRows.forEach((r) => {
      if (!byRun.has(r.runId)) byRun.set(r.runId, { label: `${r.period} (run ${r.runId})` });
      byRun.get(r.runId)[r.code] = Math.round(r.final * 1000) / 1000;
    });
    return [...byRun.values()];
  }, [weightRows]);

  async function runScoring() {
    setBusy(true);
    setError('');
    try {
      await api.post('/scores/run', {});
      setData(await api.get('/scores/latest'));
      loadSecondary();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) return <div className="error-box">{error}</div>;
  if (!data) return <div className="muted">Loading dashboard...</div>;

  if (!data.run) {
    return (
      <div className="card empty">
        <h2>No scores yet</h2>
        <p>Run the scoring engine on the data in the database to see the dashboard.</p>
        {user.role === 'admin' && (
          <button className="btn primary" onClick={runScoring} disabled={busy}>
            {busy ? 'Running...' : 'Run scoring'}
          </button>
        )}
      </div>
    );
  }

  const codes = data.weights.map((w) => w.code);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Community vulnerability dashboard</h1>
          <p className="muted">
            Scored for {data.run.period} · {data.scores.length} regions · updates live when new data arrives
          </p>
        </div>
        {user.role === 'admin' && (
          <button className="btn" onClick={runScoring} disabled={busy}>
            <Icon name="refresh" size={16} />
            {busy ? 'Running...' : 'Re-run scoring'}
          </button>
        )}
      </div>
      {error && <div className="error-box">{error}</div>}

      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label">Regions monitored</div>
          <div className="stat-value">{stats.regions}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Critical</div>
          <div className="stat-value" style={{ color: LEVEL_COLORS.Critical }}>{stats.critical}</div>
        </div>
        <div className="stat">
          <div className="stat-label">High risk</div>
          <div className="stat-value" style={{ color: LEVEL_COLORS.High }}>{stats.high}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Average score</div>
          <div className="stat-value">{fmt(stats.average)}</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Risk map</h2>
          <RiskMap scores={data.scores} onSelect={(id) => navigate(`/region/${id}`)} />
          <div className="legend">
            {Object.entries(LEVEL_COLORS).map(([level, color]) => (
              <span key={level}>
                <i style={{ background: color }} />
                {level}
              </span>
            ))}
          </div>
        </div>
        <div className="card">
          <h2>Ranking</h2>
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Region</th>
                  <th>Score</th>
                  <th>Level</th>
                  <th>Main driver</th>
                </tr>
              </thead>
              <tbody>
                {data.scores.map((r) => (
                  <tr key={r.regionId} className="clickable" onClick={() => navigate(`/region/${r.regionId}`)}>
                    <td>{r.rank}</td>
                    <td><strong>{r.name}</strong></td>
                    <td>
                      <div className="score-cell">
                        <span>{fmt(r.score)}</span>
                        <div className="mini-track">
                          <div className="mini-fill" style={{ width: `${r.score * 100}%`, background: LEVEL_COLORS[r.level] }} />
                        </div>
                      </div>
                    </td>
                    <td><RiskBadge level={r.level} /></td>
                    <td>{driverName[r.topDriver] || r.topDriver}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <h2>Live alerts</h2>
            <Link to="/alerts" className="link">View all</Link>
          </div>
          {alerts.length === 0 && <p className="muted">No alerts yet.</p>}
          {alerts.slice(0, 5).map((a) => (
            <div key={a.id} className="alert-item">
              <div>{a.message}</div>
              <div className="muted small">
                <Link to={`/region/${a.regionId}`} className="link">{a.regionName}</Link> · {timeAgo(a.createdAt)}
              </div>
            </div>
          ))}
        </div>
        <div className="card">
          <h2>Adaptive factor weights</h2>
          <p className="muted small">Entropy weight plus a boost for indicators that are getting worse.</p>
          <WeightBars weights={data.weights} />
        </div>
      </div>

      <div className="card">
        <h2>Weight evolution across scoring runs</h2>
        {weightSeries.length < 2 ? (
          <p className="muted">Run scoring again or simulate new data to see how the weights change over time.</p>
        ) : (
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={weightSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, 'auto']} />
                <Tooltip />
                <Legend />
                {codes.map((code) => (
                  <Line key={code} type="monotone" dataKey={code} stroke={IND_COLORS[code] || '#2563eb'} strokeWidth={2} dot={{ r: 3 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
