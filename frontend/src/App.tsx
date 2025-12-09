import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Manifiestos from './pages/Manifiestos';
import ManifiestoForm from './pages/ManifiestoForm';
import ManifiestoDetalle from './pages/ManifiestoDetalle';
import Tracking from './pages/Tracking';
import Configuracion from './pages/Configuracion';
import Reportes from './pages/Reportes';
import GestionActores from './pages/GestionActores';
import ConfigurarAlertas from './pages/ConfigurarAlertas';
import CargaMasiva from './pages/CargaMasiva';
import DemoApp from './pages/DemoApp';
import AnalyticsAdmin from './pages/AnalyticsAdmin';
import './index.css';
import './pages/DemoApp.css';

// Base path para deployment en subdirectorio
const BASE_PATH = import.meta.env.BASE_URL || '/demoambiente/';

// Auto-login como Admin si no hay usuario
const ensureUser = () => {
  if (!localStorage.getItem('user')) {
    localStorage.setItem('token', 'demo-token-' + Date.now());
    localStorage.setItem('user', JSON.stringify({
      id: '1',
      email: 'admin@example.com',
      nombre: 'Admin',
      apellido: 'Demo',
      rol: 'ADMIN'
    }));
  }
};

ensureUser();

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router basename={BASE_PATH.replace(/\/$/, '')}>
        <Routes>
          {/* Ruta de Login */}
          <Route path="/login" element={<Login />} />

          {/* RUTA PRIVADA - Solo accesible por URL directa (no mostrar en menús) */}
          <Route path="/analytics-admin" element={<AnalyticsAdmin />} />

          {/* Rutas SIN protección para demo */}
          <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
          <Route path="/manifiestos" element={<Layout><Manifiestos /></Layout>} />
          <Route path="/manifiestos/nuevo" element={<Layout><ManifiestoForm /></Layout>} />
          <Route path="/manifiestos/:id" element={<Layout><ManifiestoDetalle /></Layout>} />
          <Route path="/tracking" element={<Layout><Tracking /></Layout>} />
          <Route path="/reportes" element={<Layout><Reportes /></Layout>} />
          <Route path="/actores" element={<Layout><GestionActores /></Layout>} />
          <Route path="/alertas" element={<Layout><ConfigurarAlertas /></Layout>} />
          <Route path="/carga-masiva" element={<Layout><CargaMasiva /></Layout>} />
          <Route path="/configuracion" element={<Layout><Configuracion /></Layout>} />
          <Route path="/demo-app" element={<DemoApp />} />

          {/* Redirección por defecto - directo al dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;
