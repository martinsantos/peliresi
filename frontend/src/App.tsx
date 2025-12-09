import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Layout from './components/Layout';
import PasswordGate from './components/PasswordGate';
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

          {/* Demo App - SIN password, acceso libre */}
          <Route path="/demo-app" element={<DemoApp />} />

          {/* Rutas del Dashboard - PROTEGIDAS con password */}
          <Route path="/dashboard" element={
            <PasswordGate>
              <Layout><Dashboard /></Layout>
            </PasswordGate>
          } />
          <Route path="/manifiestos" element={
            <PasswordGate>
              <Layout><Manifiestos /></Layout>
            </PasswordGate>
          } />
          <Route path="/manifiestos/nuevo" element={
            <PasswordGate>
              <Layout><ManifiestoForm /></Layout>
            </PasswordGate>
          } />
          <Route path="/manifiestos/:id" element={
            <PasswordGate>
              <Layout><ManifiestoDetalle /></Layout>
            </PasswordGate>
          } />
          <Route path="/tracking" element={
            <PasswordGate>
              <Layout><Tracking /></Layout>
            </PasswordGate>
          } />
          <Route path="/reportes" element={
            <PasswordGate>
              <Layout><Reportes /></Layout>
            </PasswordGate>
          } />
          <Route path="/actores" element={
            <PasswordGate>
              <Layout><GestionActores /></Layout>
            </PasswordGate>
          } />
          <Route path="/alertas" element={
            <PasswordGate>
              <Layout><ConfigurarAlertas /></Layout>
            </PasswordGate>
          } />
          <Route path="/carga-masiva" element={
            <PasswordGate>
              <Layout><CargaMasiva /></Layout>
            </PasswordGate>
          } />
          <Route path="/configuracion" element={
            <PasswordGate>
              <Layout><Configuracion /></Layout>
            </PasswordGate>
          } />

          {/* Redirección por defecto - al dashboard (con password) */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;

