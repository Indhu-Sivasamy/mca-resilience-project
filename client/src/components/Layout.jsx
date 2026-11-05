import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { socket } from '../socket.js';
import Icon from './Icon.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: 'grid', end: true },
  { to: '/data', label: 'Data', icon: 'upload' },
  { to: '/alerts', label: 'Alerts and rules', icon: 'bell' },
  { to: '/compare', label: 'Compare methods', icon: 'compare' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [connected, setConnected] = useState(false);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onAlert = (alert) => {
      const toast = { id: alert.id, level: alert.level, text: alert.message };
      setToasts((t) => [toast, ...t].slice(0, 4));
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== toast.id)), 7000);
    };
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('alert:new', onAlert);
    socket.connect();
    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('alert:new', onAlert);
      socket.disconnect();
    };
  }, []);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-icon">
            <Icon name="shield" size={20} />
          </span>
          <div>
            <div className="brand-name">Resilience</div>
            <div className="brand-sub">Risk intelligence</div>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className={connected ? 'live-pill on' : 'live-pill'}>
            <span className="dot" />
            {connected ? 'Live updates on' : 'Offline'}
          </div>
          <div className="user-box">
            <div>
              <div className="user-email">{user.email}</div>
              <div className="user-role">{user.role}</div>
            </div>
            <button className="icon-btn" onClick={handleLogout} title="Log out">
              <Icon name="logout" />
            </button>
          </div>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${String(t.level).toLowerCase()}`}>
            <strong>New alert</strong>
            <div>{t.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
