import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Icon from '../components/Icon.jsx';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const DEV = import.meta.env.DEV;
  const [email, setEmail] = useState(DEV ? 'admin@demo.com' : '');
  const [password, setPassword] = useState(DEV ? 'admin123' : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [slow, setSlow] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    setSlow(false);
    const timer = setTimeout(() => setSlow(true), 6000);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      clearTimeout(timer);
      setBusy(false);
      setSlow(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-brand">
          <span className="brand-icon">
            <Icon name="shield" size={22} />
          </span>
          <div>
            <h1>Community Resilience Intelligence</h1>
            <p>Adaptive multi-factor risk assessment and proactive decision support</p>
          </div>
        </div>
        <form onSubmit={submit}>
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && <div className="error-box">{error}</div>}
          {slow && <div className="info-box">The server is waking up (free hosting). This can take up to a minute.</div>}
          <button className="btn primary full" disabled={busy}>
            {busy ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
        {DEV && (
          <div className="login-hint">
            Local demo accounts: admin@demo.com / admin123 and viewer@demo.com / viewer123
          </div>
        )}
      </div>
    </div>
  );
}
