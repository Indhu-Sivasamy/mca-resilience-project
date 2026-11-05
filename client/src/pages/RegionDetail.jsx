import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api.js';
import { IND_COLORS, LEVEL_COLORS, fmt } from '../lib.js';
import RiskBadge from '../components/RiskBadge.jsx';

export default function RegionDetail() {
  const { id } = useParams();
  const [latest, setLatest] = useState(null);
  const [detail, setDetail] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setLatest(null);
    setDetail(null);
    Promise.all([api.get('/scores/latest'), api.get(`/scores/region/${id}`)])
      .then(([l, d]) => {
        setLatest(l);
        setDetail(d);
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const me = latest ? latest.scores.find((s) => String(s.regionId) === String(id)) : null;

  const nameByCode = useMemo(() => {
    const map = {};
    (latest ? latest.weights : []).forEach((w) => {
      map[w.code] = w.name;
    });
    return map;
  }, [latest]);

  const contributions = useMemo(() => {
    if (!me) return [];
    return Object.entries(me.contributions)
      .map(([code, value]) => ({ code, name: nameByCode[code] || code, value: Math.round(value * 1000) / 1000 }))
      .sort((a, b) => b.value - a.value);
  }, [me, nameByCode]);

  const history = useMemo(
    () => (detail ? detail.history.map((h) => ({ label: `${h.period} (run ${h.runId})`, score: Math.round(h.score * 1000) / 1000 })) : []),
    [detail]
  );

  const trends = useMemo(() => {
    if (!detail) return { rows: [], codes: [] };
    const byPeriod = new Map();
    const codes = [];
    detail.observations.forEach((o) => {
      if (!byPeriod.has(o.period)) byPeriod.set(o.period, { period: o.period });
      byPeriod.get(o.period)[o.code] = o.value;
      if (!codes.includes(o.code)) codes.push(o.code);
    });
    return { rows: [...byPeriod.values()], codes };
  }, [detail]);

  if (error) return <div className="error-box">{error}</div>;
  if (!latest || !detail) return <div className="muted">Loading region...</div>;
  if (!me) return <div className="card">This region has no score yet.</div>;

  return (
    <div>
      <div className="page-head">
        <div>
          <Link to="/" className="link small">Back to dashboard</Link>
          <h1>{me.name}</h1>
          <p className="muted">Rank {me.rank} of {latest.scores.length} · main driver: {nameByCode[me.topDriver] || me.topDriver}</p>
        </div>
        <div className="region-score">
          <div className="region-score-value" style={{ color: LEVEL_COLORS[me.level] }}>{fmt(me.score)}</div>
          <RiskBadge level={me.level} />
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>What drives this score</h2>
          <p className="muted small">Each bar is the factor's weight multiplied by this region's vulnerability on it.</p>
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={contributions} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#2563eb" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card">
          <h2>Score history</h2>
          {history.length < 2 ? (
            <p className="muted">Only one scoring run so far. Simulate new data to build a history.</p>
          ) : (
            <div className="chart-box">
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis domain={[0, 1]} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="score" stroke={LEVEL_COLORS[me.level]} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Indicator values over time</h2>
        <div className="chart-box">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trends.rows}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="period" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend formatter={(code) => nameByCode[code] || code} />
              {trends.codes.map((code) => (
                <Line key={code} type="monotone" dataKey={code} stroke={IND_COLORS[code] || '#2563eb'} strokeWidth={2} dot={{ r: 3 }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
