import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { socket } from '../socket.js';
import { useAuth } from '../context/AuthContext.jsx';
import { timeAgo } from '../lib.js';

export default function AlertsRules() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const [alerts, setAlerts] = useState([]);
  const [rules, setRules] = useState([]);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    try {
      const [a, r] = await Promise.all([api.get('/alerts'), api.get('/rules')]);
      setAlerts(a);
      setRules(r.map((x) => ({ ...x, threshold: String(x.threshold) })));
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    }
  }, []);

  useEffect(() => {
    load();
    socket.on('alert:new', load);
    return () => socket.off('alert:new', load);
  }, [load]);

  async function acknowledge(id) {
    try {
      await api.post(`/alerts/${id}/ack`, {});
      setAlerts((list) => list.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)));
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    }
  }

  async function saveRule(rule) {
    try {
      await api.put(`/rules/${rule.id}`, { threshold: Number(rule.threshold), actionText: rule.actionText });
      setMessage({ type: 'ok', text: `Saved the ${rule.level} rule.` });
    } catch (e) {
      setMessage({ type: 'error', text: e.message });
    }
  }

  function editRule(id, patch) {
    setRules((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Alerts and rules</h1>
          <p className="muted">An alert is raised when a region reaches a higher risk level than in the previous scoring run.</p>
        </div>
      </div>
      {message && <div className={message.type === 'ok' ? 'ok-box' : 'error-box'}>{message.text}</div>}

      <div className="card">
        <h2>Alert rules</h2>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Level</th>
                <th>Score threshold</th>
                <th>Recommended action</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.level}</strong></td>
                  <td>
                    <input className="narrow" type="number" step="0.05" min="0" max="1" value={r.threshold} onChange={(e) => editRule(r.id, { threshold: e.target.value })} disabled={!isAdmin} />
                  </td>
                  <td>
                    <input type="text" value={r.actionText} onChange={(e) => editRule(r.id, { actionText: e.target.value })} disabled={!isAdmin} />
                  </td>
                  <td>
                    {isAdmin && <button className="btn small-btn" onClick={() => saveRule(r)}>Save</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted small">Only High and Critical rules raise alerts. The Medium rule is kept for reference.</p>
      </div>

      <div className="card">
        <h2>Alert history</h2>
        {alerts.length === 0 && <p className="muted">No alerts yet. Run scoring or upload data.</p>}
        {alerts.map((a) => (
          <div key={a.id} className={a.acknowledged ? 'alert-item done' : 'alert-item'}>
            <div>{a.message}</div>
            <div className="alert-meta">
              <span className="muted small">
                <Link to={`/region/${a.regionId}`} className="link">{a.regionName}</Link> · {timeAgo(a.createdAt)}
              </span>
              {a.acknowledged ? (
                <span className="muted small">Acknowledged</span>
              ) : (
                isAdmin && <button className="btn small-btn" onClick={() => acknowledge(a.id)}>Acknowledge</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
