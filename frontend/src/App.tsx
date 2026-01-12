import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Loader2 } from 'lucide-react';
import Layout from './components/Layout';
import PasswordGate from './components/PasswordGate';

// Componente de carga para Suspense
const LoadingScreen = () => (
  <div style={{ 
    height: '100vh', 
    display: 'flex', 
    flexDirection: 'column',
    alignItems: 'center', 
    justifyContent: 'center', 
    background: '#0f172a',
    color: '#10b981'
  }}>
    <Loader2 className="animate-spin" size={48} />
    <p style={{ marginTop: '16px', color: '#94a3b8', fontSize: '14px' }}>Cargando sistema...</p>
  </div>
);

// Lazy Loading de páginas
const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Manifiestos = lazy(() => import('./pages/Manifiestos'));
const ManifiestoForm = lazy(() => import('./pages/ManifiestoForm'));
const ManifiestoDetalle = lazy(() => import('./pages/ManifiestoDetalle'));
const Tracking = lazy(() => import('./pages/Tracking'));
const Configuracion = lazy(() => import('./pages/Configuracion'));
const Reportes = lazy(() => import('./pages/Reportes'));
const GestionActores = lazy(() => import('./pages/GestionActores'));
const ConfigurarAlertas = lazy(() => import('./pages/ConfigurarAlertas'));
const CargaMasiva = lazy(() => import('./pages/CargaMasiva'));
const DemoApp = lazy(() => import('./pages/DemoApp'));
const AppMobile = lazy(() => import('./pages/AppMobile'));
const AnalyticsAdmin = lazy(() => import('./pages/AnalyticsAdmin'));
const Registro = lazy(() => import('./pages/Registro'));
const AprobacionUsuarios = lazy(() => import('./pages/AprobacionUsuarios'));
const UsuariosPanel = lazy(() => import('./pages/UsuariosPanel'));
const ActividadGlobal = lazy(() => import('./pages/ActividadGlobal'));
const CentroControl = lazy(() => import('./pages/CentroControl'));
const LogAuditoria = lazy(() => import('./pages/LogAuditoria'));
const ManifestoVerify = lazy(() => import('./pages/ManifestoVerify'));
import './index.css';
import './pages/DemoApp.css';

// Base path para deployment en subdirectorio
const BASE_URL = import.meta.env.BASE_URL;

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router basename={BASE_URL.replace(/\/$/, '')}>
        <Suspense fallback={<LoadingScreen />}>
          <Routes>
            {/* Rutas Públicas */}
            <Route path="/login" element={<Login />} />
            <Route path="/registro" element={<Registro />} />
            <Route path="/verify/:id" element={<ManifestoVerify />} />

            {/* Apps Especializadas */}
            <Route path="/app" element={<AppMobile />} />
            <Route path="/mobile" element={<AppMobile />} />
            <Route path="/demo-app" element={<DemoApp />} />
            <Route path="/analytics-admin" element={<AnalyticsAdmin />} />

            {/* Rutas Privadas / Dashboard */}
            <Route path="/dashboard" element={<PasswordGate><Layout><Dashboard /></Layout></PasswordGate>} />
            <Route path="/manifiestos" element={<PasswordGate><Layout><Manifiestos /></Layout></PasswordGate>} />
            <Route path="/manifiestos/nuevo" element={<PasswordGate><Layout><ManifiestoForm /></Layout></PasswordGate>} />
            <Route path="/manifiestos/:id" element={<PasswordGate><Layout><ManifiestoDetalle /></Layout></PasswordGate>} />
            <Route path="/tracking" element={<PasswordGate><Layout><Tracking /></Layout></PasswordGate>} />
            <Route path="/reportes" element={<PasswordGate><Layout><Reportes /></Layout></PasswordGate>} />
            <Route path="/actores" element={<PasswordGate><Layout><GestionActores /></Layout></PasswordGate>} />
            <Route path="/alertas" element={<PasswordGate><Layout><ConfigurarAlertas /></Layout></PasswordGate>} />
            <Route path="/carga-masiva" element={<PasswordGate><Layout><CargaMasiva /></Layout></PasswordGate>} />
            <Route path="/configuracion" element={<PasswordGate><Layout><Configuracion /></Layout></PasswordGate>} />

            {/* Administración */}
            <Route path="/admin/centro-control" element={<PasswordGate><Layout><CentroControl /></Layout></PasswordGate>} />
            <Route path="/admin/usuarios" element={<PasswordGate><Layout><AprobacionUsuarios /></Layout></PasswordGate>} />
            <Route path="/admin/usuarios-panel" element={<PasswordGate><Layout><UsuariosPanel /></Layout></PasswordGate>} />
            <Route path="/admin/actividad" element={<PasswordGate><Layout><ActividadGlobal /></Layout></PasswordGate>} />
            <Route path="/admin/auditoria" element={<PasswordGate><Layout><LogAuditoria /></Layout></PasswordGate>} />

            {/* Redirecciones */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </Router>
    </AuthProvider>
  );
};

export default App;


