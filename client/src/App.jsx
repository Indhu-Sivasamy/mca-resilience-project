import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import RegionDetail from './pages/RegionDetail.jsx';
import DataManagement from './pages/DataManagement.jsx';
import AlertsRules from './pages/AlertsRules.jsx';
import Compare from './pages/Compare.jsx';

function Protected({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <Protected>
            <Layout />
          </Protected>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/region/:id" element={<RegionDetail />} />
        <Route path="/data" element={<DataManagement />} />
        <Route path="/alerts" element={<AlertsRules />} />
        <Route path="/compare" element={<Compare />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
