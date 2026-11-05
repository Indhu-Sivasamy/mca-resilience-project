import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function DataManagement() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const [regions, setRegions] = useState([]);
  const [indicators, setIndicators] = useState([]);
  const [file, setFile] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState('');
  const [manual, setManual] = useState({ region: '', indicator: '', period: '', value: '' });
  const [alpha, setAlpha] = useState('1');
  const [windowSize, setWindowSize] = useState('5');

  useEffect(() => {
    Promise.all([api.get('/data/regions'), api.get('/data/indicators')])
      .then(([r, i]) => {
        setRegions(r);
        setIndicators(i);
        setManual((m) => ({ ...m, region: r[0] ? r[0].name : '', indicator: i[0] ? i[0].code : '' }));
      })
      .catch((e) => setMessage({ type: 'error', text: e.message }));
  }, []);

  async function run(key, action) {
    setBusy(key);
    setMessage(null);
    try {
      await action();
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
      if (e.details) setUploadResult({ errors: e.details });
    } finally {
      setBusy('');
    }
  }

  const upload = () =>
    run('upload', async () => {
      if (!file) throw new Error('Choose a CSV file first');
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.upload('/data/upload', fd);
      setUploadResult(res);
      setMessage({ type: 'ok', text: `Uploaded ${res.accepted} rows. Scored period ${res.scoredPeriod}. ${res.newAlerts} new alerts.` });
    });

  const simulate = () =>
    run('simulate', async () => {
      const res = await api.post('/data/simulate', {});
      setMessage({ type: 'ok', text: `Simulated ${res.simulatedPeriod}. Scored period ${res.scoredPeriod}. ${res.newAlerts} new alerts.` });
    });

  const saveManual = () =>
    run('manual', async () => {
      const res = await api.post('/data/observations', {
        region: manual.region,
        indicator: manual.indicator,
        period: Number(manual.period),
        value: Number(manual.value),
      });
      setMessage({ type: 'ok', text: `Saved. Scored period ${res.scoredPeriod}. ${res.newAlerts} new alerts.` });
    });

  const rescore = () =>
    run('rescore', async () => {
      const res = await api.post('/scores/run', { alpha: Number(alpha), window: Number(windowSize) });
      setMessage({ type: 'ok', text: `Scored period ${res.period} with alpha ${res.params.alpha} and window ${res.params.window}.` });
    });

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Data management</h1>
          <p className="muted">Add community indicators. Scores and alerts update for every open dashboard.</p>
        </div>
      </div>

      {!isAdmin && <div className="info-box">You are signed in as a viewer. Only admins can change data.</div>}
      {message && <div className={message.type === 'ok' ? 'ok-box' : 'error-box'}>{message.text}</div>}

      <div className="grid-2">
        <div className="card">
          <h2>Upload CSV</h2>
          <p className="muted small">
            Columns: region, indicator, period, value. Indicator codes: {indicators.map((i) => i.code).join(', ')}.
          </p>
          <input type="file" accept=".csv" onChange={(e) => setFile(e.target.files[0])} disabled={!isAdmin} />
          <div className="row">
            <button className="btn primary" onClick={upload} disabled={!isAdmin || busy === 'upload'}>
              {busy === 'upload' ? 'Uploading...' : 'Upload and score'}
            </button>
          </div>
          {uploadResult && uploadResult.errors && uploadResult.errors.length > 0 && (
            <div className="error-list">
              <strong>{uploadResult.rejected !== undefined ? `${uploadResult.rejected} rows rejected` : 'Problems found'}</strong>
              <ul>
                {uploadResult.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="card">
          <h2>Simulate next year</h2>
          <p className="muted small">
            Creates a new year of data from the latest year, with a few regions hit by a shock. Use it to demonstrate live updates, new alerts and changing weights.
          </p>
          <button className="btn primary" onClick={simulate} disabled={!isAdmin || busy === 'simulate'}>
            {busy === 'simulate' ? 'Simulating...' : 'Simulate new data'}
          </button>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h2>Add one value</h2>
          <div className="form-grid">
            <div>
              <label>Region</label>
              <select value={manual.region} onChange={(e) => setManual({ ...manual, region: e.target.value })} disabled={!isAdmin}>
                {regions.map((r) => (
                  <option key={r.id} value={r.name}>{r.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Indicator</label>
              <select value={manual.indicator} onChange={(e) => setManual({ ...manual, indicator: e.target.value })} disabled={!isAdmin}>
                {indicators.map((i) => (
                  <option key={i.id} value={i.code}>{i.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Year</label>
              <input type="number" value={manual.period} onChange={(e) => setManual({ ...manual, period: e.target.value })} disabled={!isAdmin} />
            </div>
            <div>
              <label>Value</label>
              <input type="number" step="0.1" value={manual.value} onChange={(e) => setManual({ ...manual, value: e.target.value })} disabled={!isAdmin} />
            </div>
          </div>
          <div className="row">
            <button className="btn primary" onClick={saveManual} disabled={!isAdmin || busy === 'manual'}>Save value</button>
          </div>
        </div>

        <div className="card">
          <h2>Scoring settings</h2>
          <p className="muted small">
            Alpha controls how strongly worsening indicators are boosted. Alpha 0 gives plain entropy weights. Window is the number of recent years used for the trend.
          </p>
          <div className="form-grid">
            <div>
              <label>Alpha</label>
              <input type="number" step="0.1" min="0" value={alpha} onChange={(e) => setAlpha(e.target.value)} disabled={!isAdmin} />
            </div>
            <div>
              <label>Trend window (years)</label>
              <input type="number" min="3" value={windowSize} onChange={(e) => setWindowSize(e.target.value)} disabled={!isAdmin} />
            </div>
          </div>
          <div className="row">
            <button className="btn" onClick={rescore} disabled={!isAdmin || busy === 'rescore'}>Re-run scoring</button>
          </div>
        </div>
      </div>
    </div>
  );
}
