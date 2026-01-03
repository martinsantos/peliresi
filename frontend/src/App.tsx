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
import AppMobile from './pages/AppMobile';
import AnalyticsAdmin from './pages/AnalyticsAdmin';
import Registro from './pages/Registro';
import AprobacionUsuarios from './pages/AprobacionUsuarios';
import LogAuditoria from './pages/LogAuditoria';
import './index.css';
import './pages/DemoApp.css';

// Base path para deployment en subdirectorio
const BASE_URL = import.meta.env.BASE_URL;

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router basename={BASE_URL.replace(/\/$/, '')}>
        <Routes>
          {/* Ruta de Login */}
          <Route path="/login" element={<Login />} />
          
          {/* Ruta de Registro (pública) */}
          <Route path="/registro" element={<Registro />} />

          {/* RUTA PRIVADA - Solo accesible por URL directa (no mostrar en menús) */}
          <Route path="/analytics-admin" element={<AnalyticsAdmin />} />

          {/* App Móvil PWA - Pantalla completa sin mockup (start_url de PWA) */}
          <Route path="/app" element={<AppMobile />} />

          {/* Demo App - Vista con mockup para demostración en desktop */}
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

          {/* Rutas Admin - Aprobación de usuarios y Auditoría */}
          <Route path="/admin/usuarios" element={
            <PasswordGate>
              <Layout><AprobacionUsuarios /></Layout>
            </PasswordGate>
          } />
          <Route path="/admin/auditoria" element={
            <PasswordGate>
              <Layout><LogAuditoria /></Layout>
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


