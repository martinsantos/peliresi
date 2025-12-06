import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
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
import './index.css';
import './pages/DemoApp.css';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Ruta pública */}
          <Route path="/login" element={<Login />} />

          {/* Rutas protegidas */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Layout>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/manifiestos"
            element={
              <ProtectedRoute>
                <Layout>
                  <Manifiestos />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/manifiestos/nuevo"
            element={
              <ProtectedRoute allowedRoles={['GENERADOR']}>
                <Layout>
                  <ManifiestoForm />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/manifiestos/:id"
            element={
              <ProtectedRoute>
                <Layout>
                  <ManifiestoDetalle />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/tracking"
            element={
              <ProtectedRoute>
                <Layout>
                  <Tracking />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/reportes"
            element={
              <ProtectedRoute>
                <Layout>
                  <Reportes />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/actores"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <Layout>
                  <GestionActores />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/alertas"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <Layout>
                  <ConfigurarAlertas />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/carga-masiva"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <Layout>
                  <CargaMasiva />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/configuracion"
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <Layout>
                  <Configuracion />
                </Layout>
              </ProtectedRoute>
            }
          />

          <Route
            path="/demo-app"
            element={
              <ProtectedRoute>
                <DemoApp />
              </ProtectedRoute>
            }
          />

          {/* Redirección por defecto */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App;

