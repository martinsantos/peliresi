import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Factory, Truck, FlaskConical } from 'lucide-react';
import { MendozaBrand } from '../components/MendozaBrand';
import { DemoEnvironmentBanner } from '../components/DemoEnvironmentBanner';
import '../pages/auth/institutional.css';

export const AuthLayout: React.FC = () => {
  const location = useLocation();
  const isRegistrationWizard = location.pathname.startsWith('/inscripcion/');

  return (
    <div className="min-h-screen flex flex-col">
      <DemoEnvironmentBanner />
      <div className={`institutional auth-shell flex-1 ${isRegistrationWizard ? 'auth-shell--wizard' : ''}`}>
        <aside className="auth-brand-panel" aria-label="Sistema de trazabilidad de Mendoza">
          <div>
            <MendozaBrand appearance="dark" />
            <div className="institutional-stripe" aria-hidden="true" />
            <h1>Sistema de Trazabilidad de Residuos Peligrosos</h1>
            <p className="text-white/85 leading-relaxed max-w-md">
              Gestión integral de manifiestos digitales para el control ambiental de la provincia de Mendoza.
            </p>
          </div>
          <div className="auth-brand-features">
            <div><Factory size={18} />Generadores</div>
            <div><Truck size={18} />Transportistas</div>
            <div><FlaskConical size={18} />Operadores</div>
          </div>
        </aside>
        <main className="auth-form-panel"><div><Outlet /></div></main>
      </div>
    </div>
  );
};

export default AuthLayout;
