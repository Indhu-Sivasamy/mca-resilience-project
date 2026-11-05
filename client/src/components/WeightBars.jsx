import { fmt, IND_COLORS } from '../lib.js';

export default function WeightBars({ weights }) {
  const max = Math.max(...weights.map((w) => w.final), 0.01);
  const sorted = [...weights].sort((a, b) => b.final - a.final);
  return (
    <div className="weight-list">
      {sorted.map((w) => {
        const boost = w.final - w.entropy;
        return (
          <div key={w.code} className="weight-row">
            <div className="weight-head">
              <span>{w.name}</span>
              <span>
                <strong>{fmt(w.final)}</strong>
                {boost > 0.005 && <span className="boost">+{fmt(boost, 2)} trend</span>}
              </span>
            </div>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{ width: `${(w.final / max) * 100}%`, background: IND_COLORS[w.code] || '#2563eb' }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
