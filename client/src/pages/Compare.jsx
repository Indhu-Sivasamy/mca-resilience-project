import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api.js';
import { fmt } from '../lib.js';

const SHORT_LABELS = { equal: 'Equal', expert: 'Expert', static: 'Static entropy', adaptive: 'Adaptive' };

export default function Compare() {
  const [indicators, setIndicators] = useState([]);
  const [outcome, setOutcome] = useState('');
  const [alpha, setAlpha] = useState('1');
  const [metric, setMetric] = useState('level');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .get('/data/indicators')
      .then((list) => {
        setIndicators(list);
        const preferred = ['poverty', 'infant_mortality'].find((c) => list.some((i) => i.code === c));
        setOutcome(preferred || (list[0] ? list[0].code : ''));
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!outcome) return;
    setLoading(true);
    setError('');
    api
      .get(`/compare?outcome=${outcome}&alpha=${alpha === '' ? 1 : alpha}`)
      .then(setResult)
      .catch((e) => {
        setResult(null);
        setError(e.message);
      })
      .finally(() => setLoading(false));
  }, [outcome, alpha]);

  const chart = result
    ? result.methods.map((m) => ({
        name: SHORT_LABELS[m.key] || m.label,
        level: Math.round(m.meanSpearmanLevel * 1000) / 1000,
        change: Math.round(m.meanSpearman * 1000) / 1000,
      }))
    : [];

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Compare weighting methods</h1>
          <p className="muted">How well does each method's ranking match what actually happened next?</p>
        </div>
      </div>

      <div className="card">
        <div className="form-grid">
          <div>
            <label>Outcome indicator (held out of the index)</label>
            <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
              {indicators.map((i) => (
                <option key={i.id} value={i.code}>{i.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label>Adaptive strength (alpha)</label>
            <input type="number" step="0.1" min="0" value={alpha} onChange={(e) => setAlpha(e.target.value)} />
          </div>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}
      {loading && <div className="muted">Calculating...</div>}

      {result && (
        <>
          <div className="grid-2">
            <div className="card">
              <h2>Mean rank correlation</h2>
              <p className="muted small">
                Spearman correlation between each method's score at year T and the held-out outcome. "Next-year level" compares with the outcome at T+1. "Change" compares with how much it moved from T to T+1.
              </p>
              <div className="chart-box">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chart}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                    <YAxis domain={[-1, 1]} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="level" name="vs next-year level" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="change" name="vs change" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="card">
              <h2>Results</h2>
              <table className="table">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Level</th>
                    <th>Change</th>
                    <th>Top-{result.topK} (level)</th>
                  </tr>
                </thead>
                <tbody>
                  {result.methods.map((m) => (
                    <tr key={m.key}>
                      <td>{m.label}</td>
                      <td>{fmt(m.meanSpearmanLevel)}</td>
                      <td>{fmt(m.meanSpearman)}</td>
                      <td>{fmt(m.meanTopKLevel)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="muted small">
                Index built from: {result.inputs.join(', ')}. Evaluated on {result.methods[0].perPeriod.length} year transitions.
              </p>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Per-year results</h2>
              <select value={metric} onChange={(e) => setMetric(e.target.value)} style={{ width: 'auto' }}>
                <option value="level">Correlation with next-year level</option>
                <option value="change">Correlation with change</option>
              </select>
            </div>
            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th>Year T</th>
                    {result.methods.map((m) => (
                      <th key={m.key}>{m.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.methods[0].perPeriod.map((p, idx) => (
                    <tr key={p.period}>
                      <td>{p.period}</td>
                      {result.methods.map((m) => (
                        <td key={m.key}>{fmt(metric === 'level' ? m.perPeriod[idx].spearmanLevel : m.perPeriod[idx].spearman)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="info-box">
            How to read this: the level measure should be positive if the index points to where the outcome is bad. The change measure is harder, and when most regions improve over time, the most vulnerable often improve fastest, so it can be negative for every method. Compare the gaps between methods rather than the sign. With few regions and years, small gaps are not evidence that one method is better, so report the results as they come out.
          </div>
        </>
      )}
    </div>
  );
}
